import { getSheet } from './db.js';
import { buildChartHtml } from './chart.js';

// ── 데이터 구조 ─────────────────────────────────────────────────────
// gta_setlists: [{id, name, songs:[{title,type,id}]}]
// (구버전: [{title,type,id}] → 자동 마이그레이션)

function getFolders() {
  const raw = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
  if (!raw.length) return [];
  // 구버전 마이그레이션: 최상위 아이템에 type 필드가 있으면 flat list
  if (raw[0]?.type !== undefined && !raw[0]?.songs) {
    const folder = { id: 'folder_' + Date.now(), name: '셋리스트', songs: raw };
    saveFolders([folder]);
    return [folder];
  }
  return raw;
}
function saveFolders(d) { localStorage.setItem('gta_setlists', JSON.stringify(d)); }
function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
function getSheetMeta() { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }

// 외부(chart.js, library.js)에서 셋리스트에 곡 추가할 때 사용
export function addToSetlist(item) {
  const folders = getFolders();
  if (!folders.length) {
    folders.push({ id: 'folder_' + Date.now(), name: '셋리스트', songs: [] });
  }
  folders[0].songs.push(item);
  saveFolders(folders);
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
  img.src = url;
  img.className = 'live-img';
  applyImgStyle(img, ppv);
  if (isBlob) img.onload = () => URL.revokeObjectURL(url);
  return img;
}

function applyImgStyle(img, ppv) {
  const h = liveImgH();
  img.style.cssText = `height:${h};width:auto;max-width:${ppv===2?'calc(50vw - 16px)':'100%'};object-fit:contain;display:block;border-radius:4px;flex-shrink:0;`;
}

function applyZoom() {
  const base = liveImgH();
  document.querySelectorAll('.live-img').forEach(img => {
    const ppv = img.dataset.ppv ? +img.dataset.ppv : pagesPerView;
    if (liveZoom === 1.0) { img.style.height = base; }
    else {
      const px = Math.max(200, (_contentEl?.clientHeight || 500) - 16);
      img.style.height = Math.round(px * liveZoom) + 'px';
    }
  });
}

async function renderContent(container, record, startPage, ppv) {
  container.innerHTML = '';
  if (record.type === 'image') {
    const url = URL.createObjectURL(record.file);
    const img = makeImg(url, ppv, true); img.dataset.ppv = ppv;
    container.appendChild(img); return { totalPages: 1 };
  }
  if (record.pages?.length > 0) {
    const totalPages = record.pages.length;
    for (let p = startPage; p <= Math.min(startPage + ppv - 1, totalPages); p++) {
      const blob = record.pages[p - 1]; if (!blob) continue;
      const img = makeImg(URL.createObjectURL(blob), ppv, true); img.dataset.ppv = ppv;
      container.appendChild(img);
    }
    return { totalPages };
  }
  container.innerHTML = `<div style="color:var(--text2);padding:20px;text-align:center">PDF 로딩 중...</div>`;
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js를 불러올 수 없습니다.');
    const url = URL.createObjectURL(record.file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const totalPages = pdf.numPages; container.innerHTML = '';
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
    URL.revokeObjectURL(url); return { totalPages };
  } catch (e) {
    container.innerHTML = `<div class="empty-state">PDF 렌더링 실패: ${e.message}</div>`;
    return { totalPages: 1 };
  }
}

// ── 곡 정보 읽기 ─────────────────────────────────────────────────────
function getSongInfo(item) {
  if (item.type === 'chart') {
    const draft = getDrafts().find(d => d.id === item.id);
    if (draft) return { key: draft.key, time: draft.time, bpm: draft.bpm };
  } else {
    const meta = getSheetMeta().find(m => m.id === item.id);
    if (meta) return { key: meta.key, time: meta.time, bpm: meta.bpm };
  }
  return {};
}

// ── 메인 렌더 ────────────────────────────────────────────────────────
export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🎬 라이브 모드</h1>
    <div id="folder-area"></div>
    <div id="viewer-area"></div>
  `;
  renderFolders(panel);
}

function renderFolders(panel) {
  const folders = getFolders();
  const area = panel.querySelector('#folder-area');

  area.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <button class="btn btn-primary" id="new-folder-btn" style="font-size:0.8rem;padding:6px 12px">＋ 새 폴더</button>
    </div>
    ${!folders.length ? `<div class="empty-state card">폴더를 만들고 악보/코드차트를 추가하세요.<br><span style="font-size:0.8rem;color:var(--text2)">악보 보관함 또는 곡진행 탭에서 🎬 버튼으로 추가</span></div>` : ''}
    <div id="folder-list">
      ${folders.map((folder, fi) => renderFolderHtml(folder, fi, folders.length)).join('')}
    </div>
  `;

  area.querySelector('#new-folder-btn').addEventListener('click', () => {
    const name = prompt('폴더 이름을 입력하세요', '새 폴더');
    if (!name) return;
    const fs = getFolders();
    fs.push({ id: 'folder_' + Date.now(), name, songs: [] });
    saveFolders(fs); renderFolders(panel);
  });

  // 폴더 이름 편집
  area.querySelectorAll('.folder-name-inp').forEach(inp => {
    inp.addEventListener('change', () => {
      const fi = +inp.dataset.fi;
      const fs = getFolders(); fs[fi].name = inp.value; saveFolders(fs);
    });
  });

  // 폴더 삭제
  area.querySelectorAll('.del-folder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi;
      const fs = getFolders();
      if (fs[fi].songs.length && !confirm(`"${fs[fi].name}" 폴더를 삭제하시겠습니까? (${fs[fi].songs.length}곡 포함)`)) return;
      fs.splice(fi, 1); saveFolders(fs); renderFolders(panel);
    });
  });

  // 폴더 접기/펼치기
  area.querySelectorAll('.folder-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi;
      const body = area.querySelector(`.folder-body[data-fi="${fi}"]`);
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      btn.textContent = isOpen ? '▶' : '▼';
    });
  });

  // 곡 열기
  area.querySelectorAll('.open-song-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      const folders = getFolders();
      openItem(panel, folders[fi].songs[si]);
    });
  });

  // 곡 풀스크린
  area.querySelectorAll('.fs-song-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      const folders = getFolders();
      startFullscreen(folders[fi].songs, si);
    });
  });

  // 폴더 전체 풀스크린
  area.querySelectorAll('.fs-folder-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi;
      const folders = getFolders();
      if (!folders[fi].songs.length) return;
      startFullscreen(folders[fi].songs, 0);
    });
  });

  // 곡 삭제
  area.querySelectorAll('.del-song-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      const fs = getFolders(); fs[fi].songs.splice(si, 1); saveFolders(fs); renderFolders(panel);
    });
  });

  // 순서 이동 (위/아래)
  area.querySelectorAll('.move-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      if (si === 0) return;
      const fs = getFolders(); const songs = fs[fi].songs;
      [songs[si-1], songs[si]] = [songs[si], songs[si-1]];
      saveFolders(fs); renderFolders(panel);
    });
  });
  area.querySelectorAll('.move-down-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi, si = +btn.dataset.si;
      const fs = getFolders(); const songs = fs[fi].songs;
      if (si >= songs.length - 1) return;
      [songs[si], songs[si+1]] = [songs[si+1], songs[si]];
      saveFolders(fs); renderFolders(panel);
    });
  });

  // 폴더 순서 이동
  area.querySelectorAll('.move-folder-up-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi; if (fi === 0) return;
      const fs = getFolders(); [fs[fi-1], fs[fi]] = [fs[fi], fs[fi-1]];
      saveFolders(fs); renderFolders(panel);
    });
  });
  area.querySelectorAll('.move-folder-down-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = +btn.dataset.fi;
      const fs = getFolders(); if (fi >= fs.length - 1) return;
      [fs[fi], fs[fi+1]] = [fs[fi+1], fs[fi]];
      saveFolders(fs); renderFolders(panel);
    });
  });
}

function renderFolderHtml(folder, fi, totalFolders) {
  const songs = folder.songs || [];
  return `
    <div class="card" style="margin-bottom:10px;padding:10px 12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <button class="folder-toggle-btn btn btn-secondary" data-fi="${fi}" style="font-size:0.7rem;padding:3px 7px;min-width:28px">▼</button>
        <input class="folder-name-inp" data-fi="${fi}" value="${esc(folder.name)}"
          style="flex:1;font-weight:700;font-size:0.9rem;background:transparent;border:none;border-bottom:1px dashed var(--border);padding:2px 4px;color:var(--text);outline:none;min-width:0">
        <span style="font-size:0.72rem;color:var(--text2);flex-shrink:0">${songs.length}곡</span>
        <button class="move-folder-up-btn btn btn-secondary" data-fi="${fi}" style="font-size:0.65rem;padding:2px 6px" ${fi===0?'disabled':''}>↑</button>
        <button class="move-folder-down-btn btn btn-secondary" data-fi="${fi}" style="font-size:0.65rem;padding:2px 6px" ${fi===totalFolders-1?'disabled':''}>↓</button>
        <button class="fs-folder-btn btn btn-primary" data-fi="${fi}" style="font-size:0.72rem;padding:4px 9px" ${!songs.length?'disabled':''}>🎬 재생</button>
        <button class="del-folder-btn btn btn-secondary" data-fi="${fi}" style="font-size:0.72rem;padding:4px 8px;color:var(--danger)">🗑</button>
      </div>
      <div class="folder-body" data-fi="${fi}">
        ${!songs.length ? `<div style="font-size:0.8rem;color:var(--text2);padding:8px 4px">곡이 없습니다. 악보/곡진행 탭에서 🎬 버튼으로 추가하세요.</div>` : ''}
        ${songs.map((song, si) => `
          <div style="display:flex;align-items:center;gap:4px;padding:6px 4px;border-bottom:1px solid var(--border);${si===songs.length-1?'border-bottom:none':''}">
            <span style="font-size:0.72rem;color:var(--text2);min-width:18px;text-align:right;flex-shrink:0">${si+1}</span>
            <span style="flex:1;font-size:0.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(song.title)}</span>
            <span class="badge" style="font-size:0.6rem;flex-shrink:0">${song.type==='chart'?'차트':'악보'}</span>
            <div style="display:flex;gap:2px;flex-shrink:0">
              <button class="move-up-btn btn btn-secondary" data-fi="${fi}" data-si="${si}" style="font-size:0.6rem;padding:2px 5px" ${si===0?'disabled':''}>↑</button>
              <button class="move-down-btn btn btn-secondary" data-fi="${fi}" data-si="${si}" style="font-size:0.6rem;padding:2px 5px" ${si===songs.length-1?'disabled':''}>↓</button>
              <button class="open-song-btn btn btn-secondary" data-fi="${fi}" data-si="${si}" style="font-size:0.68rem;padding:4px 8px">열기</button>
              <button class="fs-song-btn btn btn-primary" data-fi="${fi}" data-si="${si}" style="font-size:0.68rem;padding:4px 8px">🎬</button>
              <button class="del-song-btn btn btn-secondary" data-fi="${fi}" data-si="${si}" style="font-size:0.68rem;padding:4px 6px;color:var(--danger)">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function openItem(panel, item) {
  const viewer = panel.querySelector('#viewer-area');
  if (item.type === 'chart') {
    const draft = getDrafts().find(d => d.id === item.id);
    if (!draft) { viewer.innerHTML = '<div class="empty-state">차트를 찾을 수 없습니다.</div>'; return; }
    viewer.innerHTML = '';
    const card = document.createElement('div'); card.className = 'card'; card.style.marginTop = '12px';
    viewer.appendChild(card);
    try { card.innerHTML = buildChartHtml(draft, { fontSize: '1rem', showBarNumbers: true }); }
    catch(e) { card.innerHTML = `<div style="color:var(--danger)">오류: ${e.message}</div>`; }
  } else {
    const record = await getSheet(item.id);
    if (!record) { viewer.innerHTML = '<div class="empty-state">악보를 찾을 수 없습니다.</div>'; return; }
    viewer.innerHTML = `<div class="card" style="margin-top:12px"><div style="font-weight:700;margin-bottom:8px">${esc(item.title)}</div><div id="inline-content"></div></div>`;
    await renderContent(viewer.querySelector('#inline-content'), record, 1, 1);
  }
  viewer.scrollIntoView({ behavior: 'smooth' });
}

// ── 풀스크린 ─────────────────────────────────────────────────────────
async function startFullscreen(songs, startIdx = 0) {
  if (!songs.length) return;

  let currentIdx = Math.min(startIdx, songs.length - 1);
  let currentPage = 1;
  let totalPages = 1;

  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  const overlay = document.createElement('div');
  overlay.id = 'live-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;overflow:hidden;';

  // ── 헤더 ──
  const header = document.createElement('div');
  header.style.cssText = 'flex-shrink:0;padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;transition:opacity 0.3s;min-height:44px;';
  header.innerHTML = `
    <!-- 왼쪽: 이전곡 + 카운터 -->
    <div style="display:flex;align-items:center;gap:6px">
      <button id="song-prev" class="btn btn-secondary" style="font-size:0.78rem;padding:5px 10px">◀ 이전</button>
      <span id="live-counter" style="font-size:0.72rem;color:var(--text2);white-space:nowrap"></span>
    </div>
    <!-- 가운데: 곡 제목 -->
    <div id="live-title" style="font-weight:700;font-size:0.95rem;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
    <!-- 오른쪽: 정보 + 다음곡 + 닫기 -->
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
      <span id="live-info" style="font-size:0.72rem;color:var(--text2);white-space:nowrap;text-align:right"></span>
      <button id="song-next" class="btn btn-secondary" style="font-size:0.78rem;padding:5px 10px">다음 ▶</button>
      <button id="live-close" class="btn btn-secondary" style="font-size:0.78rem;padding:5px 10px">✕</button>
    </div>
  `;

  // ── 콘텐츠 ──
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:8px;gap:8px;min-height:0;';
  _contentEl = content;

  // ── 하단 컨트롤 ──
  const nav = document.createElement('div');
  nav.style.cssText = 'flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:6px 10px;display:flex;flex-direction:column;gap:6px;';
  nav.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:4px">
      <button id="page-prev" class="btn btn-secondary" style="padding:10px 12px;font-size:0.9rem">◀</button>
      <span id="page-label" style="font-size:0.72rem;color:var(--text2);min-width:40px;text-align:center"></span>
      <button id="page-next" class="btn btn-secondary" style="padding:10px 12px;font-size:0.9rem">▶</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap">
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

  // 줌
  const ZOOM_STEPS = [0.6,0.7,0.8,0.9,1.0,1.1,1.25,1.5,1.75,2.0];
  function updateZoomLabel() { nav.querySelector('#zoom-label').textContent = Math.round(liveZoom*100)+'%'; }
  updateZoomLabel();
  function reloadWithZoom() {
    const item = songs[currentIdx];
    if (item?.type === 'chart') {
      const draft = getDrafts().find(d => d.id === item.id);
      if (draft) renderChart(content, draft);
    } else { applyZoom(); }
  }
  nav.querySelector('#zoom-out').addEventListener('click', () => {
    const s = ZOOM_STEPS.filter(z => z < liveZoom);
    if (s.length) { saveZoom(s[s.length-1]); updateZoomLabel(); reloadWithZoom(); }
  });
  nav.querySelector('#zoom-in').addEventListener('click', () => {
    const s = ZOOM_STEPS.filter(z => z > liveZoom);
    if (s.length) { saveZoom(s[0]); updateZoomLabel(); reloadWithZoom(); }
  });

  // 테마
  function updateThemeBtns() {
    nav.querySelectorAll('.live-theme-btn').forEach(btn => {
      btn.style.outline = btn.dataset.theme === liveThemeId ? '2px solid var(--accent)' : 'none';
    });
  }
  updateThemeBtns();
  nav.querySelectorAll('.live-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveLiveTheme(btn.dataset.theme); updateThemeBtns(); applyThemeToContainer(content);
    });
  });

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

  // 헤더 업데이트
  function updateHeader() {
    const item = songs[currentIdx];
    header.querySelector('#live-title').textContent = item.title;
    header.querySelector('#live-counter').textContent = `${currentIdx+1} / ${songs.length}`;
    // 키·박자·BPM
    const info = getSongInfo(item);
    const parts = [info.key, info.time, info.bpm ? info.bpm+'BPM' : ''].filter(Boolean);
    header.querySelector('#live-info').textContent = parts.join(' · ');
    // 버튼 활성화
    header.querySelector('#song-prev').disabled = currentIdx === 0;
    header.querySelector('#song-next').disabled = currentIdx === songs.length - 1;
  }

  async function loadCurrent() {
    updateHeader();
    const item = songs[currentIdx];
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
    const item = songs[currentIdx];
    const record = await getSheet(item.id);
    if (record) {
      const result = await renderContent(content, record, currentPage, pagesPerView);
      totalPages = result?.totalPages || totalPages;
      applyZoom();
    }
    updatePageBtns(); content.scrollTop = 0;
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
