import { getSheet } from './db.js';
import { buildChartHtml } from './chart.js';

function getSetlists() { return JSON.parse(localStorage.getItem('gta_setlists') || '[]'); }
function saveSetlists(d) { localStorage.setItem('gta_setlists', JSON.stringify(d)); }
function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }

let wakeLock = null;
let pagesPerView = 1;
let liveZoom = parseFloat(localStorage.getItem('gta_live_zoom') || '1.0');
let _contentEl = null;

// 라이브 테마
const LIVE_THEMES = [
  { id:'default', label:'기본',   bg:'',        text:'',        accent:'' },
  { id:'dark',    label:'다크',   bg:'#0a0a0a', text:'#f0f0f0', accent:'#4a9eff' },
  { id:'white',   label:'화이트', bg:'#ffffff', text:'#111111', accent:'#1a6ef5' },
  { id:'sepia',   label:'세피아', bg:'#f4ede0', text:'#3a2a10', accent:'#8a4020' },
  { id:'green',   label:'그린',   bg:'#0d1f0d', text:'#c8e8c0', accent:'#4caf50' },
  { id:'night',   label:'나이트', bg:'#1a0a2e', text:'#e0d0ff', accent:'#bf40ff' },
];
let liveThemeId = localStorage.getItem('gta_live_theme') || 'default';
function saveLiveTheme(id) { liveThemeId = id; localStorage.setItem('gta_live_theme', id); }
function getLiveTheme() { return LIVE_THEMES.find(t => t.id === liveThemeId) || LIVE_THEMES[0]; }

function saveZoom(z) { liveZoom = z; localStorage.setItem('gta_live_zoom', z); }

function chartFontSize() { return (liveZoom * 16).toFixed(1) + 'px'; }

function applyThemeToContainer(container) {
  const t = getLiveTheme();
  container.style.background = t.bg || '';
  container.style.color = t.text || '';
  if (t.accent) container.style.setProperty('--accent', t.accent);
  else container.style.removeProperty('--accent');
}

function renderChart(container, draft) {
  try {
    const html = buildChartHtml(draft, { fontSize: chartFontSize(), showBarNumbers: true });
    container.innerHTML = `<div style="padding:8px;font-size:${chartFontSize()}">${html}</div>`;
    applyThemeToContainer(container);
  } catch(e) {
    container.innerHTML = `<div style="color:red;padding:16px">오류: ${e.message}</div>`;
  }
}

// 실제 컨테이너 높이 기반으로 이미지 높이 계산
function liveImgH() {
  if (_contentEl) return Math.max(200, _contentEl.clientHeight - 16) + 'px';
  return 'calc(100dvh - 140px)';
}

export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🎬 라이브 모드</h1>
    <div id="setlist-area"></div>
    <div id="viewer-area"></div>
  `;
  renderSetlist(panel);
}

function renderSetlist(panel) {
  const setlist = getSetlists();
  const area = panel.querySelector('#setlist-area');
  area.innerHTML = `
    <div class="card">
      <div class="section-label">셋리스트 (${setlist.length}곡)</div>
      ${!setlist.length ? `<div class="empty-state">악보 보관함 또는 코드차트에서 추가하세요.</div>` : ''}
      <div id="setlist-items">
        ${setlist.map((item, i) => `
          <div class="card" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;padding:10px 12px">
            <span style="font-size:0.85rem">${i+1}. ${item.title} <span class="badge" style="font-size:0.65rem">${item.type}</span></span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-primary open-btn" data-idx="${i}" style="font-size:0.75rem;padding:5px 10px">열기</button>
              <button class="btn btn-primary fs-btn" data-idx="${i}" style="font-size:0.75rem;padding:5px 10px">🎬</button>
              <button class="btn btn-secondary del-btn" data-idx="${i}" style="font-size:0.75rem;padding:5px 8px">×</button>
            </div>
          </div>
        `).join('')}
      </div>
      ${setlist.length ? `
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-primary" id="fullscreen-all-btn" style="flex:1">🎬 풀스크린 (처음부터)</button>
        </div>
      ` : ''}
    </div>
  `;
  area.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = getSetlists(); list.splice(Number(btn.dataset.idx), 1);
      saveSetlists(list); renderSetlist(panel);
    });
  });
  area.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', () => openItem(panel, Number(btn.dataset.idx)));
  });
  area.querySelectorAll('.fs-btn').forEach(btn => {
    btn.addEventListener('click', () => startFullscreen(Number(btn.dataset.idx)));
  });
  area.querySelector('#fullscreen-all-btn')?.addEventListener('click', () => startFullscreen(0));
}

async function openItem(panel, idx) {
  const setlist = getSetlists();
  const item = setlist[idx];
  const viewer = panel.querySelector('#viewer-area');
  if (item.type === 'chart') {
    const draft = getDrafts().find(d => d.id === item.id);
    if (!draft) { viewer.innerHTML = '<div class="empty-state">차트를 찾을 수 없습니다.</div>'; return; }
    viewer.innerHTML = '';
    renderChartView(viewer, draft);
  } else {
    const record = await getSheet(item.id);
    if (!record) { viewer.innerHTML = '<div class="empty-state">악보를 찾을 수 없습니다.</div>'; return; }
    viewer.innerHTML = `<div class="card" style="margin-top:12px"><div style="font-weight:700;margin-bottom:8px">${item.title}</div><div id="inline-content"></div></div>`;
    await renderContent(viewer.querySelector('#inline-content'), record, 1, 1);
  }
  viewer.scrollIntoView({ behavior: 'smooth' });
}

// 이미지 생성 헬퍼
function makeImg(url, ppv, isBlob = false) {
  const img = document.createElement('img');
  img.src = url;
  img.className = 'live-img';
  applyImgStyle(img, ppv);
  if (isBlob) img.onload = () => URL.revokeObjectURL(url);
  return img;
}

function applyImgStyle(img, ppv) {
  const h = liveImgH();
  img.style.cssText = `
    height:${h};
    width:auto;
    max-width:${ppv === 2 ? 'calc(50vw - 16px)' : '100%'};
    object-fit:contain;
    display:block;
    border-radius:4px;
    flex-shrink:0;
  `;
}

// zoom 적용 (1.0 = 맞춤)
function applyZoom() {
  const base = liveImgH();
  document.querySelectorAll('.live-img').forEach(img => {
    const ppv = img.dataset.ppv ? +img.dataset.ppv : pagesPerView;
    if (liveZoom === 1.0) {
      img.style.height = base;
    } else {
      const px = Math.max(200, (_contentEl?.clientHeight || 500) - 16);
      img.style.height = Math.round(px * liveZoom) + 'px';
    }
  });
}

// 콘텐츠 렌더링
async function renderContent(container, record, startPage, ppv) {
  container.innerHTML = '';
  if (record.type === 'image') {
    const url = URL.createObjectURL(record.file);
    const img = makeImg(url, ppv, true);
    img.dataset.ppv = ppv;
    container.appendChild(img);
    return { totalPages: 1 };
  }
  // PDF: 미리 변환된 이미지 블롭 사용
  if (record.pages?.length > 0) {
    const totalPages = record.pages.length;
    for (let p = startPage; p <= Math.min(startPage + ppv - 1, totalPages); p++) {
      const blob = record.pages[p - 1];
      if (!blob) continue;
      const img = makeImg(URL.createObjectURL(blob), ppv, true);
      img.dataset.ppv = ppv;
      container.appendChild(img);
    }
    return { totalPages };
  }
  // 폴백: PDF.js
  container.innerHTML = `<div style="color:var(--text2);padding:20px;text-align:center">PDF 로딩 중...</div>`;
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js 라이브러리를 불러올 수 없습니다.');
    const url = URL.createObjectURL(record.file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const totalPages = pdf.numPages;
    container.innerHTML = '';
    for (let p = startPage; p <= Math.min(startPage + ppv - 1, totalPages); p++) {
      const page = await pdf.getPage(p);
      const targetH = (_contentEl?.clientHeight || window.innerHeight) - 16;
      const baseVP = page.getViewport({ scale: 1 });
      const scale = targetH / baseVP.height;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      canvas.className = 'live-img'; canvas.dataset.ppv = ppv;
      canvas.style.cssText = `height:${targetH}px;width:auto;max-width:${ppv===2?'calc(50vw - 16px)':'100%'};display:block;border-radius:4px;flex-shrink:0;`;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      container.appendChild(canvas);
    }
    URL.revokeObjectURL(url);
    return { totalPages };
  } catch (e) {
    container.innerHTML = `<div class="empty-state">PDF 렌더링 실패: ${e.message}</div>`;
    return { totalPages: 1 };
  }
}

function renderChartInContainer(container, draft) {
  try {
    container.innerHTML = buildChartHtml(draft, { fontSize: '1rem', showBarNumbers: true });
  } catch(e) {
    container.innerHTML = `<div style="color:var(--danger);padding:16px">렌더링 오류: ${e.message}<br><pre style="font-size:0.7rem;overflow:auto">${e.stack}</pre></div>`;
    console.error('buildChartHtml error:', e);
  }
}

function renderChartView(container, draft) {
  container.innerHTML = `<div class="card" style="margin-top:12px"></div>`;
  renderChartInContainer(container.querySelector('.card'), draft);
}

async function startFullscreen(startIdx) {
  const setlist = getSetlists();
  if (!setlist.length) return;

  let currentIdx = Math.min(startIdx, setlist.length - 1);
  let currentPage = 1;
  let totalPages = 1;

  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  const overlay = document.createElement('div');
  overlay.id = 'live-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;overflow:hidden;`;

  const header = document.createElement('div');
  header.style.cssText = 'flex-shrink:0;padding:8px 12px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px;transition:opacity 0.3s';
  header.innerHTML = `
    <span id="live-title" style="font-weight:700;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"></span>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <span id="live-counter" style="font-size:0.75rem;color:var(--text2);white-space:nowrap;align-self:center"></span>
      <button id="live-close" class="btn btn-secondary" style="font-size:0.75rem;padding:5px 10px">✕</button>
    </div>
  `;

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:8px;gap:8px;min-height:0;';
  _contentEl = content;

  const nav = document.createElement('div');
  nav.style.cssText = `flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:6px 10px;display:flex;flex-direction:column;gap:6px;`;
  nav.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
      <button id="live-prev" class="btn btn-primary" style="flex:1;padding:10px 6px;font-size:0.82rem">← 이전</button>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <button id="page-prev" class="btn btn-secondary" style="padding:10px 12px;font-size:0.9rem">◀</button>
        <span id="page-label" style="font-size:0.72rem;color:var(--text2);min-width:40px;text-align:center"></span>
        <button id="page-next" class="btn btn-secondary" style="padding:10px 12px;font-size:0.9rem">▶</button>
      </div>
      <button id="live-next" class="btn btn-primary" style="flex:1;padding:10px 6px;font-size:0.82rem">다음 →</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px">
      <button id="zoom-out" class="btn btn-secondary" style="padding:7px 16px;font-size:1.1rem;line-height:1">−</button>
      <span id="zoom-label" style="font-size:0.78rem;color:var(--text2);min-width:44px;text-align:center"></span>
      <button id="zoom-in" class="btn btn-secondary" style="padding:7px 16px;font-size:1.1rem;line-height:1">+</button>
      <span style="font-size:0.7rem;color:var(--text2);margin-left:8px">색상:</span>
      ${LIVE_THEMES.map(t =>
        `<button class="live-theme-btn btn btn-secondary" data-theme="${t.id}"
          style="font-size:0.68rem;padding:4px 8px;${t.bg?`background:${t.bg};color:${t.text};`:''}">${t.label}</button>`
      ).join('')}
    </div>
  `;

  overlay.append(header, content, nav);
  document.body.appendChild(overlay);

  // 줌 컨트롤
  const ZOOM_STEPS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
  function updateZoomLabel() {
    nav.querySelector('#zoom-label').textContent = Math.round(liveZoom * 100) + '%';
  }
  updateZoomLabel();

  function reloadWithZoom() {
    const item = setlist[currentIdx];
    if (item?.type === 'chart') {
      const draft = getDrafts().find(d => d.id === item.id);
      if (draft) renderChart(content, draft);
    } else {
      applyZoom();
    }
  }

  nav.querySelector('#zoom-out').addEventListener('click', () => {
    const s = ZOOM_STEPS.filter(z => z < liveZoom);
    if (s.length) { saveZoom(s[s.length - 1]); updateZoomLabel(); reloadWithZoom(); }
  });
  nav.querySelector('#zoom-in').addEventListener('click', () => {
    const s = ZOOM_STEPS.filter(z => z > liveZoom);
    if (s.length) { saveZoom(s[0]); updateZoomLabel(); reloadWithZoom(); }
  });

  // 테마 버튼
  function updateThemeBtns() {
    nav.querySelectorAll('.live-theme-btn').forEach(btn => {
      btn.style.outline = btn.dataset.theme === liveThemeId ? '2px solid var(--accent)' : 'none';
    });
  }
  updateThemeBtns();
  nav.querySelectorAll('.live-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveLiveTheme(btn.dataset.theme);
      updateThemeBtns();
      applyThemeToContainer(content);
    });
  });

  // 화면 크기 변경 시 이미지 재조정 (악보 타입만)
  const resizeObs = new ResizeObserver(() => { applyZoom(); });
  resizeObs.observe(content);

  // 헤더 자동 숨김
  let hideTimer;
  function showHeader() {
    header.style.opacity = '1'; clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { header.style.opacity = '0'; }, 3000);
  }
  overlay.addEventListener('touchstart', showHeader, { passive: true });
  overlay.addEventListener('mousemove', showHeader);
  showHeader();

  // 스와이프 (곡 이동)
  let touchStartX = 0, touchStartY = 0;
  overlay.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (Math.abs(dx) > 60 && dy < 40) navigateSong(dx < 0 ? 1 : -1);
  }, { passive: true });

  async function loadCurrent() {
    const item = setlist[currentIdx];
    header.querySelector('#live-title').textContent = item.title;
    header.querySelector('#live-counter').textContent = `${currentIdx + 1}/${setlist.length}`;
    nav.querySelector('#live-prev').disabled = currentIdx === 0;
    nav.querySelector('#live-next').disabled = currentIdx === setlist.length - 1;
    content.innerHTML = `<div style="text-align:center;color:var(--text2);padding:40px">불러오는 중...</div>`;
    currentPage = 1;

    if (item.type === 'chart') {
      content.style.cssText = 'flex:1;overflow-y:auto;display:block;min-height:0;';
      totalPages = 1;
      const draft = getDrafts().find(d => d.id === item.id);
      if (draft) renderChart(content, draft);
      else content.innerHTML = '<div class="empty-state">차트를 찾을 수 없습니다.</div>';
    } else {
      content.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:8px;gap:8px;min-height:0;';
      const record = await getSheet(item.id);
      if (!record) { content.innerHTML = '<div class="empty-state">악보를 찾을 수 없습니다.</div>'; return; }
      // content가 실제 크기를 가진 후 렌더해야 정확한 높이 계산 가능
      await new Promise(r => requestAnimationFrame(r));
      const result = await renderContent(content, record, currentPage, pagesPerView);
      totalPages = result?.totalPages || 1;
      applyZoom();
    }
    updatePageBtns();
    content.scrollTop = 0;
  }

  async function navigatePage(dir) {
    const next = currentPage + dir * pagesPerView;
    if (next < 1 || next > totalPages) return;
    currentPage = next;
    const item = setlist[currentIdx];
    const record = await getSheet(item.id);
    if (record) {
      const result = await renderContent(content, record, currentPage, pagesPerView);
      totalPages = result?.totalPages || totalPages;
      applyZoom();
    }
    updatePageBtns();
    content.scrollTop = 0;
  }

  function updatePageBtns() {
    nav.querySelector('#page-prev').disabled = currentPage <= 1;
    nav.querySelector('#page-next').disabled = currentPage + pagesPerView - 1 >= totalPages;
    const show = totalPages > 1;
    nav.querySelector('#page-prev').style.visibility = show ? '' : 'hidden';
    nav.querySelector('#page-next').style.visibility = show ? '' : 'hidden';
    nav.querySelector('#page-label').textContent = show ? `${currentPage}/${totalPages}` : '';
  }

  function navigateSong(dir) {
    const next = currentIdx + dir;
    if (next < 0 || next >= setlist.length) return;
    currentIdx = next; loadCurrent();
  }

  nav.querySelector('#live-prev').addEventListener('click', () => navigateSong(-1));
  nav.querySelector('#live-next').addEventListener('click', () => navigateSong(1));
  nav.querySelector('#page-prev').addEventListener('click', () => navigatePage(-1));
  nav.querySelector('#page-next').addEventListener('click', () => navigatePage(1));
  header.querySelector('#live-close').addEventListener('click', () => {
    resizeObs.disconnect();
    _contentEl = null;
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    clearTimeout(hideTimer);
    overlay.remove();
  });

  loadCurrent();
}
