import { getSheet } from './db.js';

function getSetlists() { return JSON.parse(localStorage.getItem('gta_setlists') || '[]'); }
function saveSetlists(d) { localStorage.setItem('gta_setlists', JSON.stringify(d)); }
function getMeta() { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }
function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }

let wakeLock = null;

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
          <div class="card" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;padding:10px 12px" data-idx="${i}">
            <span style="font-size:0.85rem">${i+1}. ${item.title} <span class="badge" style="font-size:0.65rem">${item.type}</span></span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-primary open-btn" data-idx="${i}" style="font-size:0.75rem;padding:5px 10px">열기</button>
              <button class="btn btn-secondary del-btn" data-idx="${i}" style="font-size:0.75rem;padding:5px 8px">×</button>
            </div>
          </div>
        `).join('')}
      </div>
      ${setlist.length > 1 ? `<button class="btn btn-primary" id="fullscreen-btn" style="margin-top:8px;width:100%">🎬 풀스크린 시작</button>` : ''}
    </div>
  `;

  area.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = getSetlists();
      list.splice(Number(btn.dataset.idx), 1);
      saveSetlists(list);
      renderSetlist(panel);
    });
  });

  area.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', () => openItem(panel, Number(btn.dataset.idx)));
  });

  area.querySelector('#fullscreen-btn')?.addEventListener('click', () => startFullscreen(panel, 0));
}

async function openItem(panel, idx) {
  const setlist = getSetlists();
  const item = setlist[idx];
  const viewer = panel.querySelector('#viewer-area');

  if (item.type === 'chart') {
    const draft = getDrafts().find(d => d.id === item.id);
    if (!draft) { viewer.innerHTML = '<div class="empty-state">차트를 찾을 수 없습니다.</div>'; return; }
    renderChartView(viewer, draft);
  } else {
    const record = await getSheet(item.id);
    if (!record) { viewer.innerHTML = '<div class="empty-state">악보를 찾을 수 없습니다.</div>'; return; }
    const url = URL.createObjectURL(record.file);
    viewer.innerHTML = `
      <div class="card" style="margin-top:12px">
        <div style="font-weight:700;margin-bottom:8px">${item.title}</div>
        ${record.type === 'image'
          ? `<img src="${url}" style="max-width:100%">`
          : `<iframe src="${url}" style="width:100%;height:70vh;border:none"></iframe>`
        }
        <div class="btn-row">
          <button class="btn btn-primary" onclick="startFullscreen(panel, ${idx})">🎬 풀스크린</button>
        </div>
      </div>
    `;
  }
  viewer.scrollIntoView({ behavior: 'smooth' });
}

function renderChartView(container, draft) {
  const sections = draft.sections.map(sec => {
    const bars = sec.bars.map(b => b.chords ? `<span style="min-width:60px;display:inline-block;padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;margin:3px;font-size:0.9rem;font-weight:600">${b.chords}</span>` : '').join('');
    const memo = sec.memo ? `<div style="font-size:0.78rem;color:var(--text2);margin-top:4px;font-style:italic">${sec.memo}</div>` : '';
    return `<div style="margin-bottom:14px"><div style="font-weight:700;color:var(--accent);margin-bottom:6px">${sec.type}</div><div style="display:flex;flex-wrap:wrap">${bars}</div>${memo}</div>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="margin-top:12px">
      <div style="font-size:1.2rem;font-weight:700">${draft.title}</div>
      <div style="color:var(--text2);font-size:0.85rem;margin-bottom:12px">${[draft.key,draft.time,draft.bpm?draft.bpm+'BPM':''].filter(Boolean).join(' · ')}</div>
      ${sections}
    </div>
  `;
}

async function startFullscreen(panel, startIdx) {
  const setlist = getSetlists();
  let currentIdx = startIdx;

  // Wake Lock
  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  const overlay = document.createElement('div');
  overlay.id = 'live-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;touch-action:none';

  const header = document.createElement('div');
  header.style.cssText = 'padding:12px 16px;background:var(--bg2);display:flex;justify-content:space-between;align-items:center;transition:opacity 0.3s';
  header.innerHTML = `<span id="live-title" style="font-weight:700"></span><button id="live-close" class="btn btn-secondary" style="font-size:0.8rem">✕ 닫기</button>`;

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;padding:16px';

  const nav = document.createElement('div');
  nav.style.cssText = 'display:flex;justify-content:space-between;padding:12px 16px;background:var(--bg2);gap:8px';
  nav.innerHTML = `
    <button class="btn btn-primary" id="live-prev" style="flex:1;padding:14px">← 이전</button>
    <span id="live-counter" style="align-self:center;color:var(--text2);font-size:0.85rem;white-space:nowrap"></span>
    <button class="btn btn-primary" id="live-next" style="flex:1;padding:14px">다음 →</button>
  `;

  overlay.append(header, content, nav);
  document.body.appendChild(overlay);

  // 헤더 자동 숨김
  let hideTimer;
  function showHeader() {
    header.style.opacity = '1';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { header.style.opacity = '0'; }, 3000);
  }
  overlay.addEventListener('touchstart', showHeader);
  overlay.addEventListener('mousemove', showHeader);
  showHeader();

  // 스와이프
  let touchStartX = 0;
  overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx < -50) navigate(1);
    else if (dx > 50) navigate(-1);
  });

  async function loadCurrent() {
    const item = setlist[currentIdx];
    header.querySelector('#live-title').textContent = item.title;
    nav.querySelector('#live-counter').textContent = `${currentIdx+1} / ${setlist.length}`;
    nav.querySelector('#live-prev').disabled = currentIdx === 0;
    nav.querySelector('#live-next').disabled = currentIdx === setlist.length - 1;

    content.innerHTML = '<div class="empty-state">불러오는 중...</div>';

    if (item.type === 'chart') {
      const draft = getDrafts().find(d => d.id === item.id);
      if (draft) renderChartView(content, draft);
    } else {
      const record = await getSheet(item.id);
      if (record) {
        const url = URL.createObjectURL(record.file);
        content.innerHTML = record.type === 'image'
          ? `<img src="${url}" style="max-width:100%;border-radius:var(--radius)">`
          : `<iframe src="${url}" style="width:100%;height:calc(100vh - 120px);border:none"></iframe>`;
      }
    }
    content.scrollTop = 0;
  }

  function navigate(dir) {
    const next = currentIdx + dir;
    if (next < 0 || next >= setlist.length) return;
    currentIdx = next;
    loadCurrent();
  }

  nav.querySelector('#live-prev').addEventListener('click', () => navigate(-1));
  nav.querySelector('#live-next').addEventListener('click', () => navigate(1));
  header.querySelector('#live-close').addEventListener('click', () => {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    overlay.remove();
  });

  loadCurrent();
}
