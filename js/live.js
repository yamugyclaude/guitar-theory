import { getSheet } from './db.js';
import { buildChartHtml } from './chart.js';

// ── 데이터 구조 ─────────────────────────────────────────────────────
// gta_setlists: [{id, name, songs:[{title,type,id}]}]

function getFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!Array.isArray(raw)) return [];
    if (!raw.length) return [];
    // 구버전 마이그레이션: 최상위 아이템이 songs 배열 없이 type 필드만 있는 경우
    if (raw[0] && raw[0].type !== undefined && !Array.isArray(raw[0].songs)) {
      const folder = { id: 'folder_' + Date.now(), name: '셋리스트', songs: raw };
      _saveFolders([folder]);
      return [folder];
    }
    // 유효성 검사: songs 필드 없는 폴더 보정
    return raw.map(f => ({ ...f, songs: Array.isArray(f.songs) ? f.songs : [] }));
  } catch(e) {
    console.error('getFolders error:', e);
    return [];
  }
}

function _saveFolders(d) {
  localStorage.setItem('gta_setlists', JSON.stringify(d));
}

function getDrafts() {
  try { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
  catch { return []; }
}
function getSheetMeta() {
  try { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }
  catch { return []; }
}

// ── 라이브 테마 ──────────────────────────────────────────────────────
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

// ── 줌 ───────────────────────────────────────────────────────────────
let wakeLock = null;
let pagesPerView = 1;
let liveZoom = parseFloat(localStorage.getItem('gta_live_zoom') || '1.0');
let _contentEl = null;
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

function liveImgH() {
  if (_contentEl) return Math.max(200, _contentEl.clientHeight - 16) + 'px';
  return 'calc(100dvh - 140px)';
}
function makeImg(url, ppv, isBlob = false) {
  const img = document.createElement('img');
  img.src = url; img.className = 'live-img';
  const h = liveImgH();
  img.style.cssText = `height:${h};width:auto;max-width:${ppv===2?'calc(50vw - 16px)':'100%'};object-fit:contain;display:block;border-radius:4px;flex-shrink:0;`;
  if (isBlob) img.onload = () => URL.revokeObjectURL(url);
  return img;
}
function applyZoom() {
  document.querySelectorAll('.live-img').forEach(img => {
    const ppv = img.dataset.ppv ? +img.dataset.ppv : pagesPerView;
    if (liveZoom === 1.0) { img.style.height = liveImgH(); }
    else {
      const px = Math.max(200, (_contentEl?.clientHeight || 500) - 16);
      img.style.height = Math.round(px * liveZoom) + 'px';
    }
  });
}
async function renderContent(container, record, startPage, ppv) {
  container.innerHTML = '';
  if (record.type === 'image') {
    const img = makeImg(URL.createObjectURL(record.file), ppv, true);
    img.dataset.ppv = ppv; container.appendChild(img); return { totalPages: 1 };
  }
  if (record.pages?.length > 0) {
    const totalPages = record.pages.length;
    for (let p = startPage; p <= Math.min(startPage + ppv - 1, totalPages); p++) {
      const blob = record.pages[p - 1]; if (!blob) continue;
      const img = makeImg(URL.createObjectURL(blob), ppv, true);
      img.dataset.ppv = ppv; container.appendChild(img);
    }
    return { totalPages };
  }
  container.innerHTML = `<div style="color:var(--text2);padding:20px;text-align:center">로딩 중...</div>`;
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js 없음');
    const url = URL.createObjectURL(record.file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const totalPages = pdf.numPages; container.innerHTML = '';
    for (let p = startPage; p <= Math.min(startPage + ppv - 1, totalPages); p++) {
      const page = await pdf.getPage(p);
      const targetH = (_contentEl?.clientHeight || window.innerHeight) - 16;
      const baseVP = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: targetH / baseVP.height });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      canvas.className = 'live-img'; canvas.dataset.ppv = ppv;
      canvas.style.cssText = `height:${targetH}px;width:auto;max-width:${ppv===2?'calc(50vw - 16px)':'100%'};display:block;border-radius:4px;flex-shrink:0;`;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      container.appendChild(canvas);
    }
    URL.revokeObjectURL(url); return { totalPages };
  } catch(e) {
    container.innerHTML = `<div class="empty-state">PDF 오류: ${e.message}</div>`;
    return { totalPages: 1 };
  }
}

function getSongInfo(item) {
  if (!item) return {};
  if (item.type === 'chart') {
    const d = getDrafts().find(d => d.id === item.id);
    if (d) return { key: d.key, time: d.time, bpm: d.bpm };
  } else {
    const m = getSheetMeta().find(m => m.id === item.id);
    if (m) return { key: m.key, time: m.time, bpm: m.bpm };
  }
  return {};
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 메인 렌더 ────────────────────────────────────────────────────────
export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🎬 라이브 모드</h1>
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:16px">
      폴더 관리는 <strong>악보 탭</strong>에서 합니다. 여기서는 폴더를 선택해 바로 재생하세요.
    </p>
    <div id="folder-area"></div>
  `;
  renderFolderCards(panel);
}

function renderFolderCards(panel) {
  const folders = getFolders();
  const area = panel.querySelector('#folder-area');
  if (!area) return;

  if (!folders.length) {
    area.innerHTML = `<div class="card empty-state">
      악보 탭에서 폴더를 만들고 곡을 추가하면 여기에 표시됩니다.
    </div>`;
    return;
  }

  area.innerHTML = '';

  folders.forEach((folder, fi) => {
    const songs = folder.songs || [];
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'margin-bottom:10px;padding:12px 14px;';

    // 헤더
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap">
        <span style="font-size:1rem;flex-shrink:0">📁</span>
        <span style="flex:1;font-weight:700;font-size:0.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(folder.name)}</span>
        <span style="font-size:0.72rem;color:var(--text2);flex-shrink:0">${songs.length}곡</span>
        <button class="fs-folder-btn btn btn-primary" data-fi="${fi}"
          style="font-size:0.8rem;padding:6px 14px;flex-shrink:0" ${!songs.length?'disabled':''}>🎬 재생</button>
      </div>
    `;

    // 곡 목록 (항상 표시)
    const body = document.createElement('div');
    body.style.marginTop = songs.length ? '8px' : '0';

    if (!songs.length) {
      body.innerHTML = `<div style="font-size:0.78rem;color:var(--text2);padding:4px 0">
        악보 탭에서 곡을 추가하세요.
      </div>`;
    } else {
      songs.forEach((song, si) => {
        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 4px;
          ${si < songs.length-1 ? 'border-bottom:1px solid var(--border);' : ''}`;
        row.innerHTML = `
          <span style="font-size:0.68rem;color:var(--text2);min-width:16px;text-align:right;flex-shrink:0">${si+1}</span>
          <span style="font-size:0.8rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(song.title||'(제목 없음)')}</span>
          <span class="badge" style="font-size:0.58rem;flex-shrink:0">${song.type==='chart'?'차트':'악보'}</span>
          <button class="move-up-btn btn btn-secondary" data-fi="${fi}" data-si="${si}"
            style="font-size:0.6rem;padding:2px 5px;flex-shrink:0" ${si===0?'disabled':''}>↑</button>
          <button class="move-down-btn btn btn-secondary" data-fi="${fi}" data-si="${si}"
            style="font-size:0.6rem;padding:2px 5px;flex-shrink:0" ${si===songs.length-1?'disabled':''}>↓</button>
          <button class="fs-song-btn btn btn-secondary" data-fi="${fi}" data-si="${si}"
            style="font-size:0.68rem;padding:3px 8px;flex-shrink:0">🎬</button>
        `;
        body.appendChild(row);
      });
    }

    card.appendChild(body);
    area.appendChild(card);
  });

  // 이벤트 연결
  area.querySelectorAll('.fs-folder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi;
      const songs = getFolders()[fi]?.songs || [];
      if (songs.length) startFullscreen(songs, 0);
    });
  });
  area.querySelectorAll('.fs-song-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      const songs = getFolders()[fi]?.songs || [];
      if (songs.length) startFullscreen(songs, si);
    });
  });
  area.querySelectorAll('.move-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si; if (si === 0) return;
      const fs = getFolders(); const songs = fs[fi]?.songs || [];
      [songs[si-1], songs[si]] = [songs[si], songs[si-1]];
      _saveFolders(fs); renderFolderCards(panel);
    });
  });
  area.querySelectorAll('.move-down-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      const fs = getFolders(); const songs = fs[fi]?.songs || [];
      if (si >= songs.length-1) return;
      [songs[si], songs[si+1]] = [songs[si+1], songs[si]];
      _saveFolders(fs); renderFolderCards(panel);
    });
  });
}

// ── 인라인 뷰어 ──────────────────────────────────────────────────────
async function openItem(panel, item) {
  const viewer = panel.querySelector('#viewer-area');
  if (!viewer) return;
  viewer.innerHTML = `<div style="text-align:center;color:var(--text2);padding:20px">불러오는 중...</div>`;
  viewer.scrollIntoView({ behavior: 'smooth' });
  try {
    if (item.type === 'chart') {
      const draft = getDrafts().find(d => d.id === item.id);
      if (!draft) { viewer.innerHTML = '<div class="empty-state card">차트를 찾을 수 없습니다.</div>'; return; }
      const card = document.createElement('div');
      card.className = 'card'; card.style.marginTop = '12px';
      card.innerHTML = buildChartHtml(draft, { fontSize: '1rem', showBarNumbers: true });
      viewer.innerHTML = ''; viewer.appendChild(card);
    } else {
      const record = await getSheet(item.id);
      if (!record) { viewer.innerHTML = '<div class="empty-state card">악보를 찾을 수 없습니다.</div>'; return; }
      viewer.innerHTML = `<div class="card" style="margin-top:12px">
        <div style="font-weight:700;margin-bottom:8px">${esc(item.title)}</div>
        <div id="inline-content"></div>
      </div>`;
      await renderContent(viewer.querySelector('#inline-content'), record, 1, 1);
    }
  } catch(e) {
    viewer.innerHTML = `<div class="empty-state card">오류: ${e.message}</div>`;
  }
}

// ── 풀스크린 ─────────────────────────────────────────────────────────
async function startFullscreen(songs, startIdx = 0) {
  if (!songs || !songs.length) return;

  let currentIdx = Math.max(0, Math.min(startIdx, songs.length - 1));
  let currentPage = 1;
  let totalPages = 1;

  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  const overlay = document.createElement('div');
  overlay.id = 'live-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;overflow:hidden;';

  // ── 헤더: 3단 그리드 (이전 | 제목 | 정보+다음+닫기) ──
  const header = document.createElement('div');
  header.style.cssText = 'flex-shrink:0;padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;transition:opacity 0.3s;min-height:46px;';
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <button id="song-prev" class="btn btn-secondary" style="font-size:0.8rem;padding:6px 12px;white-space:nowrap">◀ 이전</button>
      <span id="live-counter" style="font-size:0.72rem;color:var(--text2);white-space:nowrap"></span>
    </div>
    <div id="live-title" style="font-weight:700;font-size:1rem;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px;"></div>
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
      <span id="live-info" style="font-size:0.72rem;color:var(--text2);white-space:nowrap;text-align:right;overflow:hidden;text-overflow:ellipsis;max-width:160px"></span>
      <button id="song-next" class="btn btn-secondary" style="font-size:0.8rem;padding:6px 12px;white-space:nowrap">다음 ▶</button>
      <button id="live-close" class="btn btn-secondary" style="font-size:0.8rem;padding:6px 12px">✕</button>
    </div>
  `;

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:8px;gap:8px;min-height:0;';
  _contentEl = content;

  const nav = document.createElement('div');
  nav.style.cssText = 'flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:6px 10px;display:flex;flex-direction:column;gap:6px;';
  nav.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:4px">
      <button id="page-prev" class="btn btn-secondary" style="padding:10px 14px;font-size:0.9rem">◀</button>
      <span id="page-label" style="font-size:0.72rem;color:var(--text2);min-width:40px;text-align:center"></span>
      <button id="page-next" class="btn btn-secondary" style="padding:10px 14px;font-size:0.9rem">▶</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap">
      <button id="zoom-out" class="btn btn-secondary" style="padding:7px 16px;font-size:1.1rem;line-height:1">−</button>
      <span id="zoom-label" style="font-size:0.78rem;color:var(--text2);min-width:44px;text-align:center"></span>
      <button id="zoom-in" class="btn btn-secondary" style="padding:7px 16px;font-size:1.1rem;line-height:1">+</button>
      <span style="font-size:0.7rem;color:var(--text2);margin-left:6px">색상:</span>
      ${LIVE_THEMES.map(t =>
        `<button class="live-theme-btn btn btn-secondary" data-theme="${t.id}"
          style="font-size:0.68rem;padding:4px 8px;${t.bg?`background:${t.bg};color:${t.text};`:''}">${t.label}</button>`
      ).join('')}
    </div>
  `;

  overlay.append(header, content, nav);
  document.body.appendChild(overlay);

  // 줌
  const ZOOM_STEPS = [0.6,0.7,0.8,0.9,1.0,1.1,1.25,1.5,1.75,2.0];
  function updateZoomLabel() { nav.querySelector('#zoom-label').textContent = Math.round(liveZoom*100)+'%'; }
  updateZoomLabel();
  nav.querySelector('#zoom-out').addEventListener('click', () => {
    const s = ZOOM_STEPS.filter(z => z < liveZoom);
    if (s.length) { saveZoom(s[s.length-1]); updateZoomLabel(); reloadWithZoom(); }
  });
  nav.querySelector('#zoom-in').addEventListener('click', () => {
    const s = ZOOM_STEPS.filter(z => z > liveZoom);
    if (s.length) { saveZoom(s[0]); updateZoomLabel(); reloadWithZoom(); }
  });
  function reloadWithZoom() {
    const item = songs[currentIdx];
    if (item?.type === 'chart') {
      const draft = getDrafts().find(d => d.id === item.id);
      if (draft) renderChart(content, draft);
    } else applyZoom();
  }

  // 테마
  function updateThemeBtns() {
    nav.querySelectorAll('.live-theme-btn').forEach(b => {
      b.style.outline = b.dataset.theme === liveThemeId ? '2px solid var(--accent)' : 'none';
    });
  }
  updateThemeBtns();
  nav.querySelectorAll('.live-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveLiveTheme(btn.dataset.theme); updateThemeBtns(); applyThemeToContainer(content);
    });
  });

  const resizeObs = new ResizeObserver(() => applyZoom());
  resizeObs.observe(content);

  // 헤더 자동 숨김
  let hideTimer;
  function showHeader() {
    header.style.opacity = '1'; clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { header.style.opacity = '0'; }, 4000);
  }
  overlay.addEventListener('touchstart', showHeader, { passive: true });
  overlay.addEventListener('mousemove', showHeader);
  showHeader();

  // 스와이프
  let touchStartX = 0, touchStartY = 0;
  overlay.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (Math.abs(dx) > 60 && dy < 40) navigateSong(dx < 0 ? 1 : -1);
  }, { passive: true });

  function updateHeader() {
    const item = songs[currentIdx];
    if (!item) return;
    header.querySelector('#live-title').textContent = item.title || '(제목 없음)';
    header.querySelector('#live-counter').textContent = `${currentIdx+1} / ${songs.length}`;
    const info = getSongInfo(item);
    const parts = [info.key, info.time, info.bpm ? info.bpm + 'BPM' : ''].filter(Boolean);
    header.querySelector('#live-info').textContent = parts.join(' · ');
    header.querySelector('#song-prev').disabled = currentIdx === 0;
    header.querySelector('#song-next').disabled = currentIdx === songs.length - 1;
  }

  async function loadCurrent() {
    updateHeader();
    const item = songs[currentIdx];
    if (!item) return;
    content.innerHTML = `<div style="text-align:center;color:var(--text2);padding:40px">불러오는 중...</div>`;
    currentPage = 1;
    try {
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
        await new Promise(r => requestAnimationFrame(r));
        const result = await renderContent(content, record, currentPage, pagesPerView);
        totalPages = result?.totalPages || 1;
        applyZoom();
      }
    } catch(e) {
      content.innerHTML = `<div class="empty-state">오류: ${e.message}</div>`;
    }
    updatePageBtns();
    content.scrollTop = 0;
  }

  async function navigatePage(dir) {
    const next = currentPage + dir * pagesPerView;
    if (next < 1 || next > totalPages) return;
    currentPage = next;
    const item = songs[currentIdx];
    if (!item || item.type === 'chart') return;
    const record = await getSheet(item.id);
    if (record) { const r = await renderContent(content, record, currentPage, pagesPerView); totalPages = r?.totalPages || totalPages; applyZoom(); }
    updatePageBtns(); content.scrollTop = 0;
  }

  function updatePageBtns() {
    const prevBtn = nav.querySelector('#page-prev');
    const nextBtn = nav.querySelector('#page-next');
    const label = nav.querySelector('#page-label');
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage + pagesPerView - 1 >= totalPages;
    const show = totalPages > 1;
    prevBtn.style.visibility = show ? '' : 'hidden';
    nextBtn.style.visibility = show ? '' : 'hidden';
    label.textContent = show ? `${currentPage}/${totalPages}` : '';
  }

  function navigateSong(dir) {
    const next = currentIdx + dir;
    if (next < 0 || next >= songs.length) return;
    currentIdx = next; loadCurrent();
  }

  nav.querySelector('#page-prev').addEventListener('click', () => navigatePage(-1));
  nav.querySelector('#page-next').addEventListener('click', () => navigatePage(1));
  header.querySelector('#song-prev').addEventListener('click', () => navigateSong(-1));
  header.querySelector('#song-next').addEventListener('click', () => navigateSong(1));
  header.querySelector('#live-close').addEventListener('click', () => {
    resizeObs.disconnect(); _contentEl = null;
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    clearTimeout(hideTimer); overlay.remove();
  });

  loadCurrent();
}
