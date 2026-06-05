import { getSheet } from './db.js';

function getSetlists() { return JSON.parse(localStorage.getItem('gta_setlists') || '[]'); }
function saveSetlists(d) { localStorage.setItem('gta_setlists', JSON.stringify(d)); }
function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }

let wakeLock = null;
let pagesPerView = 1; // 1 또는 2

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
      const list = getSetlists();
      list.splice(Number(btn.dataset.idx), 1);
      saveSetlists(list);
      renderSetlist(panel);
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

// PDF.js로 캔버스 렌더링 (iframe 대체)
async function renderContent(container, record, startPage, ppv) {
  if (record.type === 'image') {
    const url = URL.createObjectURL(record.file);
    container.innerHTML = `<img src="${url}" style="width:100%;border-radius:var(--radius)">`;
    return { totalPages: 1 };
  }

  // PDF → canvas 렌더링
  container.innerHTML = `<div style="text-align:center;color:var(--text2);padding:20px">PDF 로딩 중...</div>`;
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js 라이브러리를 불러올 수 없습니다.');
    const url = URL.createObjectURL(record.file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const totalPages = pdf.numPages;

    container.innerHTML = `<div id="pdf-pages" style="display:flex;gap:8px;justify-content:center"></div>`;
    const pagesEl = container.querySelector('#pdf-pages');

    for (let p = startPage; p <= Math.min(startPage + ppv - 1, totalPages); p++) {
      const page = await pdf.getPage(p);
      const scale = ppv === 2 ? 1.2 : 1.8;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.cssText = `width:${ppv === 2 ? 'calc(50% - 4px)' : '100%'};border-radius:4px;display:block`;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pagesEl.appendChild(canvas);
    }
    URL.revokeObjectURL(url);
    return { totalPages };
  } catch (e) {
    container.innerHTML = `<div class="empty-state">PDF 렌더링 실패: ${e.message}</div>`;
    return { totalPages: 1 };
  }
}

function renderChartInContainer(container, draft) {
  const sections = draft.sections.map(sec => {
    const bars = sec.bars.map(b => b.chords
      ? `<span style="display:inline-block;padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;margin:3px;font-size:0.95rem;font-weight:700">${b.chords}</span>`
      : '').join('');
    const memo = sec.memo ? `<div style="font-size:0.78rem;color:var(--text2);margin-top:4px;font-style:italic">${sec.memo}</div>` : '';
    return `<div style="margin-bottom:14px"><div style="font-weight:700;color:var(--accent);margin-bottom:6px;font-size:1rem">${sec.type}</div><div style="display:flex;flex-wrap:wrap">${bars}</div>${memo}</div>`;
  }).join('');

  container.innerHTML = `
    <div style="padding:8px">
      <div style="font-size:1.3rem;font-weight:700;margin-bottom:4px">${draft.title}</div>
      <div style="color:var(--text2);font-size:0.85rem;margin-bottom:16px">${[draft.key,draft.time,draft.bpm?draft.bpm+'BPM':''].filter(Boolean).join(' · ')}</div>
      ${sections || '<div style="color:var(--text2)">섹션 없음</div>'}
    </div>
  `;
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

  // Wake Lock
  if ('wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }

  // 오버레이 생성
  const overlay = document.createElement('div');
  overlay.id = 'live-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:var(--bg);z-index:9999;
    display:flex;flex-direction:column;overflow:hidden;
  `;

  // 헤더
  const header = document.createElement('div');
  header.style.cssText = 'flex-shrink:0;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px;transition:opacity 0.3s';
  header.innerHTML = `
    <span id="live-title" style="font-weight:700;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1"></span>
    <div style="display:flex;gap:6px;flex-shrink:0">
      <button id="view-toggle" class="btn btn-secondary" style="font-size:0.75rem;padding:5px 10px">1장 보기</button>
      <button id="live-close" class="btn btn-secondary" style="font-size:0.75rem;padding:5px 10px">✕ 닫기</button>
    </div>
  `;

  // 콘텐츠 영역
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;padding:12px';

  // 하단 네비게이션
  const nav = document.createElement('div');
  nav.style.cssText = `
    flex-shrink:0;display:grid;grid-template-columns:1fr auto auto 1fr;
    align-items:center;gap:6px;padding:10px 12px;background:var(--bg2);border-top:1px solid var(--border);
  `;
  nav.innerHTML = `
    <button id="live-prev" class="btn btn-primary" style="padding:12px 8px;font-size:0.85rem">← 이전 곡</button>
    <button id="page-prev" class="btn btn-secondary" style="padding:12px 8px;font-size:0.85rem">◀ 페이지</button>
    <button id="page-next" class="btn btn-secondary" style="padding:12px 8px;font-size:0.85rem">페이지 ▶</button>
    <button id="live-next" class="btn btn-primary" style="padding:12px 8px;font-size:0.85rem">다음 곡 →</button>
  `;

  // 카운터 (헤더에 추가)
  const counter = document.createElement('span');
  counter.id = 'live-counter';
  counter.style.cssText = 'font-size:0.75rem;color:var(--text2);flex-shrink:0;white-space:nowrap';
  header.querySelector('div').prepend(counter);

  overlay.append(header, content, nav);
  document.body.appendChild(overlay);

  // 뷰 토글
  header.querySelector('#view-toggle').addEventListener('click', () => {
    pagesPerView = pagesPerView === 1 ? 2 : 1;
    header.querySelector('#view-toggle').textContent = pagesPerView === 1 ? '1장 보기' : '2장 보기';
    currentPage = 1;
    loadCurrent();
  });

  // 헤더 자동 숨김
  let hideTimer;
  function showHeader() {
    header.style.opacity = '1';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { header.style.opacity = '0'; }, 3000);
  }
  overlay.addEventListener('touchstart', showHeader, { passive: true });
  overlay.addEventListener('mousemove', showHeader);
  showHeader();

  // 스와이프 (곡 이동)
  let touchStartX = 0, touchStartY = 0;
  overlay.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    if (Math.abs(dx) > 60 && dy < 40) {
      if (dx < 0) navigateSong(1);
      else navigateSong(-1);
    }
  }, { passive: true });

  async function loadCurrent() {
    const item = setlist[currentIdx];
    header.querySelector('#live-title').textContent = item.title;
    counter.textContent = `${currentIdx + 1}/${setlist.length}`;

    // 곡 이동 버튼 상태
    nav.querySelector('#live-prev').disabled = currentIdx === 0;
    nav.querySelector('#live-next').disabled = currentIdx === setlist.length - 1;

    content.innerHTML = `<div style="text-align:center;color:var(--text2);padding:40px">불러오는 중...</div>`;
    currentPage = 1;

    if (item.type === 'chart') {
      const draft = getDrafts().find(d => d.id === item.id);
      totalPages = 1;
      if (draft) renderChartInContainer(content, draft);
      else content.innerHTML = '<div class="empty-state">차트를 찾을 수 없습니다.</div>';
    } else {
      const record = await getSheet(item.id);
      if (!record) { content.innerHTML = '<div class="empty-state">악보를 찾을 수 없습니다.</div>'; return; }

      if (record.type === 'image') {
        totalPages = 1;
        const url = URL.createObjectURL(record.file);
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `display:flex;gap:8px;justify-content:center`;
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = pagesPerView === 1 ? 'width:100%' : 'width:calc(50% - 4px)';
        wrapper.appendChild(img);
        content.innerHTML = '';
        content.appendChild(wrapper);
      } else {
        const result = await renderContent(content, record, currentPage, pagesPerView);
        totalPages = result?.totalPages || 1;
      }
    }
    updatePageBtns();
    content.scrollTop = 0;
  }

  async function navigatePage(dir) {
    const step = pagesPerView;
    const next = currentPage + dir * step;
    if (next < 1 || next > totalPages) return;
    currentPage = next;

    const item = setlist[currentIdx];
    if (item.type !== 'chart') {
      const record = await getSheet(item.id);
      if (record && record.type !== 'image') {
        const result = await renderContent(content, record, currentPage, pagesPerView);
        totalPages = result?.totalPages || totalPages;
      }
    }
    updatePageBtns();
    content.scrollTop = 0;
  }

  function updatePageBtns() {
    const step = pagesPerView;
    nav.querySelector('#page-prev').disabled = currentPage <= 1;
    nav.querySelector('#page-next').disabled = currentPage + step - 1 >= totalPages;
    // 단일 페이지 아이템은 페이지 버튼 숨기기
    const showPageBtns = totalPages > 1;
    nav.querySelector('#page-prev').style.display = showPageBtns ? '' : 'none';
    nav.querySelector('#page-next').style.display = showPageBtns ? '' : 'none';
  }

  function navigateSong(dir) {
    const next = currentIdx + dir;
    if (next < 0 || next >= setlist.length) return;
    currentIdx = next;
    loadCurrent();
  }

  nav.querySelector('#live-prev').addEventListener('click', () => navigateSong(-1));
  nav.querySelector('#live-next').addEventListener('click', () => navigateSong(1));
  nav.querySelector('#page-prev').addEventListener('click', () => navigatePage(-1));
  nav.querySelector('#page-next').addEventListener('click', () => navigatePage(1));
  header.querySelector('#live-close').addEventListener('click', () => {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    clearTimeout(hideTimer);
    overlay.remove();
  });

  loadCurrent();
}
