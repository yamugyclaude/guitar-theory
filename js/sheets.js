import { goTo } from './app.js';
import { saveSheet, getAllSheets, deleteSheet, getSheet, updateSheet } from './db.js';

// jsPDF / PDF.js lazy load (악보 탭 진입 시 1회만 로드)
async function ensurePdfLibs() {
  const loads = [];
  if (!window.pdfjsLib) {
    loads.push(new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    }));
  }
  if (!window.jspdf) {
    loads.push(new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    }));
  }
  if (loads.length) await Promise.all(loads);
}

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36); }

function getMeta() { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }
function setMeta(data) { localStorage.setItem('gta_sheet_meta', JSON.stringify(data)); }
function getDrafts() { try { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); } catch { return []; } }

// ===== 통합 폴더 시스템 (gta_setlists) =====
// 형식: [{id, name, songs:[{id,title,type:'chart'|'pdf'|'image'}]}]
function getSetlistFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!Array.isArray(raw) || !raw.length) return [];
    // 구버전 flat list 마이그레이션
    if (raw[0] && raw[0].type !== undefined && !Array.isArray(raw[0].songs)) {
      const folder = { id: 'folder_' + Date.now(), name: '셋리스트', songs: raw };
      saveSetlistFolders([folder]);
      return [folder];
    }
    return raw.map(f => ({ ...f, songs: Array.isArray(f.songs) ? f.songs : [] }));
  } catch { return []; }
}
function saveSetlistFolders(data) {
  localStorage.setItem('gta_setlists', JSON.stringify(data));
}

// 아이템을 폴더에 추가 (중복 방지)
function addItemToFolder(folderId, item) {
  const folders = getSetlistFolders();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  if (!folder.songs.find(s => s.id === item.id)) {
    folder.songs.push(item);
    saveSetlistFolders(folders);
  }
}
// 어느 폴더에도 없는 경우 첫 번째 폴더(없으면 생성)에 추가
function ensureInFolder(item) {
  const folders = getSetlistFolders();
  if (folders.some(f => f.songs.find(s => s.id === item.id))) return; // 이미 있음
  if (!folders.length) folders.push({ id: 'folder_' + Date.now(), name: '셋리스트', songs: [] });
  folders[0].songs.push(item);
  saveSetlistFolders(folders);
}

// 구버전 gta_folders + gta_sheet_meta.folder → gta_setlists 1회 마이그레이션
function migrateOldFolders() {
  if (localStorage.getItem('gta_folders_migrated')) return;
  try {
    const oldFolders = JSON.parse(localStorage.getItem('gta_folders') || '[]');
    if (!oldFolders.length) { localStorage.setItem('gta_folders_migrated', '1'); return; }
    const meta = getMeta();
    const setlists = getSetlistFolders();
    for (const of_ of oldFolders.filter(f => !f.parentId)) {
      const sheetsInFolder = meta.filter(m => m.folder === of_.id);
      if (!sheetsInFolder.length) continue;
      let folder = setlists.find(f => f.name === of_.name);
      if (!folder) {
        folder = { id: 'folder_' + Date.now() + Math.random().toString(36).slice(2), name: of_.name, songs: [] };
        setlists.push(folder);
      }
      for (const m of sheetsInFolder) {
        if (!folder.songs.find(s => s.id === m.id)) {
          folder.songs.push({ id: m.id, title: m.title, type: m.type || 'sheet' });
        }
      }
    }
    saveSetlistFolders(setlists);
  } catch(e) { console.warn('migration error:', e); }
  localStorage.setItem('gta_folders_migrated', '1');
}

// 현재 선택된 폴더 (모듈 내 상태)
let activeFolder = null; // null = 전체

function checkBackup(panel) {
  const last = localStorage.getItem('gta_last_backup');
  if (!last) return;
  const days = Math.floor((Date.now() - new Date(last)) / 86400000);
  if (days >= 7) {
    panel.insertAdjacentHTML('afterbegin', `
      <div style="background:var(--danger);color:#fff;padding:10px 14px;border-radius:var(--radius);margin-bottom:12px;font-size:0.85rem">
        ⚠️ 마지막 백업으로부터 <strong>${days}일</strong> 경과. 설정 탭에서 백업을 권장합니다.
        <button id="backup-dismiss" style="float:right;background:none;border:none;color:#fff;cursor:pointer;font-size:1rem">×</button>
      </div>
    `);
    panel.querySelector('#backup-dismiss').addEventListener('click', e => e.target.closest('div').remove());
  }
}

export async function render(panel) {
  await ensurePdfLibs();
  migrateOldFolders();

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px">
      <h1 class="page-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0">📂 악보 보관함</h1>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-secondary" id="sync-btn" style="font-size:0.78rem;padding:6px 10px" title="클라우드 동기화">☁️</button>
        <button class="btn btn-primary" id="upload-fab" style="font-size:0.8rem;padding:6px 14px">＋ 업로드</button>
      </div>
    </div>

    <!-- 업로드 폼 (숨김) -->
    <div id="upload-card" style="display:none;margin-bottom:16px">
      <div class="card" style="border:2px solid var(--accent);padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-weight:700;font-size:0.9rem">악보 파일 업로드</span>
          <button id="upload-close" style="background:none;border:none;color:var(--text2);font-size:1.2rem;cursor:pointer;padding:0 4px">×</button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="pick-file-btn" style="font-size:0.82rem;flex:1;min-width:140px">📁 파일 가져오기</button>
          <button class="btn btn-secondary" id="pick-photo-btn" style="font-size:0.82rem;flex:1;min-width:140px">🖼️ 사진 앨범</button>
        </div>
        <input type="file" id="file-input" accept=".pdf,.png,.jpg,.jpeg" multiple style="display:none">
        <input type="file" id="photo-input" accept="image/*" multiple style="display:none">
        <div id="file-preview" style="margin-bottom:10px;font-size:0.8rem;color:var(--accent)"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><div class="label">곡명</div><input type="text" id="meta-title" placeholder="곡명"></div>
          <div><div class="label">아티스트</div><input type="text" id="meta-artist" placeholder="아티스트"></div>
          <div><div class="label">키</div><input type="text" id="meta-key" placeholder="Am"></div>
          <div><div class="label">BPM</div><input type="text" id="meta-bpm" placeholder="120"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div><div class="label">태그 (쉼표 구분)</div><input type="text" id="meta-tags" placeholder="블루스, 펑크"></div>
          <div><div class="label">폴더</div><select id="meta-folder"><option value="">폴더 없음</option></select></div>
        </div>
        <button class="btn btn-primary" id="upload-btn" style="width:100%;margin-top:12px">저장</button>
      </div>
    </div>

    <!-- 폴더 칩 -->
    <div id="folder-chips-wrap" style="margin-bottom:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
      <div id="folder-chips" style="display:flex;gap:6px;flex-wrap:nowrap;min-width:max-content;padding:2px 0"></div>
    </div>

    <!-- 검색 -->
    <div style="position:relative;margin-bottom:14px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:0.9rem;pointer-events:none">🔍</span>
      <input type="text" id="search-input" placeholder="검색 (곡명·태그·아티스트)"
        style="padding:8px 10px 8px 32px;font-size:0.85rem;border-radius:20px">
    </div>

    <!-- 카드 그리드 -->
    <div id="sheet-list"></div>

    <div id="sheet-viewer"></div>
  `;

  checkBackup(panel);
  renderFolderChips(panel);
  loadList(panel);

  // 업로드 FAB
  panel.querySelector('#upload-fab').addEventListener('click', () => {
    const card = panel.querySelector('#upload-card');
    card.style.display = card.style.display === 'none' ? '' : 'none';
  });
  panel.querySelector('#upload-close').addEventListener('click', () => {
    panel.querySelector('#upload-card').style.display = 'none';
  });

  panel.querySelector('#pick-file-btn').addEventListener('click', () => panel.querySelector('#file-input').click());
  panel.querySelector('#pick-photo-btn').addEventListener('click', () => panel.querySelector('#photo-input').click());

  const showFilePreview = files => {
    const p = panel.querySelector('#file-preview');
    if (!files.length) { p.textContent = ''; return; }
    p.textContent = `📎 ${files.length}개 파일: ${Array.from(files).map(f => f.name).join(', ')}`;
  };
  panel.querySelector('#file-input').addEventListener('change', e => showFilePreview(e.target.files));
  panel.querySelector('#photo-input').addEventListener('change', e => {
    const fileInput = panel.querySelector('#file-input');
    const dt = new DataTransfer();
    Array.from(e.target.files).forEach(f => dt.items.add(f));
    fileInput.files = dt.files;
    showFilePreview(dt.files);
    e.target.value = '';
  });
  panel.querySelector('#upload-btn').addEventListener('click', () => uploadSheet(panel));
  panel.querySelector('#search-input').addEventListener('input', e => filterList(panel, e.target.value));
  panel.querySelector('#sync-btn').addEventListener('click', () => syncFromCloud(panel));
}

function renderFolderChips(panel) {
  const folders = getSetlistFolders();
  const allMeta = getMeta();
  const allDrafts = getDrafts();
  const totalCount = allDrafts.filter(d=>!d.deleted).length + allMeta.filter(m=>!m.deleted).length;

  // 업로드 폼 폴더 select 업데이트
  const sel = panel.querySelector('#meta-folder');
  if (sel) {
    sel.innerHTML = `<option value="">폴더 없음</option>` +
      folders.map(f => `<option value="${f.id}">📁 ${f.name}</option>`).join('');
    if (activeFolder) sel.value = activeFolder;
  }

  const chips = panel.querySelector('#folder-chips');
  if (!chips) return;

  chips.innerHTML = '';

  // "전체" 칩
  const allChip = document.createElement('div');
  const allActive = activeFolder === null;
  allChip.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;cursor:pointer;
    font-size:0.82rem;font-weight:${allActive?'700':'400'};white-space:nowrap;user-select:none;transition:all 0.15s;
    ${allActive
      ? 'background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.2)'
      : 'background:var(--bg3);color:var(--text);border:1px solid var(--border)'}`;
  allChip.innerHTML = `🗂 전체 <span style="font-size:0.72rem;opacity:0.8">${totalCount}</span>`;
  allChip.addEventListener('click', () => {
    activeFolder = null; renderFolderChips(panel);
    filterList(panel, panel.querySelector('#search-input')?.value || '');
  });
  chips.appendChild(allChip);

  // 폴더 칩들
  folders.forEach((f, fi) => {
    const isActive = activeFolder === f.id;
    const count = (f.songs || []).length;

    const chip = document.createElement('div');
    chip.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;cursor:pointer;
      font-size:0.82rem;font-weight:${isActive?'700':'400'};white-space:nowrap;user-select:none;transition:all 0.15s;
      ${isActive
        ? 'background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.2)'
        : 'background:var(--bg3);color:var(--text);border:1px solid var(--border)'}`;
    chip.innerHTML = `
      📁 ${escHtml(f.name)}
      <span style="font-size:0.72rem;opacity:0.8">${count}</span>
      <button class="chip-ctx" data-fi="${fi}"
        style="background:none;border:none;cursor:pointer;padding:0 0 0 2px;font-size:0.75rem;
        color:${isActive?'rgba(255,255,255,0.8)':'var(--text2)'};line-height:1" title="편집">⋯</button>
    `;

    chip.addEventListener('click', e => {
      if (e.target.closest('.chip-ctx')) return;
      activeFolder = f.id; renderFolderChips(panel);
      filterList(panel, panel.querySelector('#search-input')?.value || '');
    });
    chips.appendChild(chip);
  });

  // 휴지통 칩
  const trashMeta = getMeta().filter(m => m.deleted);
  const trashDrafts = getDrafts().filter(d => d.deleted);
  const trashCount = trashMeta.length + trashDrafts.length;
  const trashActive = activeFolder === 'trash';
  const trashChip = document.createElement('div');
  trashChip.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;cursor:pointer;
    font-size:0.82rem;font-weight:${trashActive?'700':'400'};white-space:nowrap;user-select:none;transition:all 0.15s;
    ${trashActive
      ? 'background:var(--danger);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.2)'
      : 'background:var(--bg3);color:var(--text2);border:1px solid var(--border)'}`;
  trashChip.innerHTML = `🗑 휴지통 <span style="font-size:0.72rem;opacity:0.8">${trashCount}</span>`;
  trashChip.addEventListener('click', () => {
    activeFolder = 'trash'; renderFolderChips(panel);
    filterList(panel, panel.querySelector('#search-input')?.value || '');
  });
  chips.appendChild(trashChip);

  // "새 폴더" 칩
  const newChip = document.createElement('div');
  newChip.style.cssText = `display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:20px;cursor:pointer;
    font-size:0.82rem;white-space:nowrap;user-select:none;
    background:transparent;color:var(--accent);border:1px dashed var(--accent);transition:all 0.15s`;
  newChip.textContent = '＋ 폴더';
  newChip.addEventListener('click', () => {
    const name = prompt('새 폴더 이름:');
    if (!name?.trim()) return;
    const fs = getSetlistFolders();
    if (fs.find(f => f.name === name.trim())) { alert('이미 같은 이름의 폴더가 있습니다.'); return; }
    fs.push({ id: 'folder_' + Date.now(), name: name.trim(), songs: [] });
    saveSetlistFolders(fs);
    renderFolderChips(panel);
  });
  chips.appendChild(newChip);

  // ⋯ 컨텍스트
  chips.querySelectorAll('.chip-ctx').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const fi = +btn.dataset.fi;
      const fs = getSetlistFolders();
      const f = fs[fi];
      // 인라인 미니 메뉴
      showFolderMenu(btn, f, fi, panel);
    });
  });
}

function showFolderMenu(anchor, folder, fi, panel) {
  // 기존 메뉴 닫기
  document.querySelector('#folder-ctx-menu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'folder-ctx-menu';
  menu.style.cssText = `position:fixed;background:var(--bg2);border:1px solid var(--border);border-radius:8px;
    box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9000;min-width:160px;padding:4px 0;font-size:0.84rem`;

  const items = [
    { label: '✏️ 이름 변경', action: 'rename' },
    { label: '↑ 위로', action: 'up', disabled: fi === 0 },
    { label: '↓ 아래로', action: 'down', disabled: fi === getSetlistFolders().length - 1 },
    { label: '🗑 삭제', action: 'delete', danger: true },
  ];
  items.forEach(item => {
    const el = document.createElement('div');
    el.style.cssText = `padding:8px 14px;cursor:pointer;${item.danger?'color:var(--danger)':''}${item.disabled?'opacity:0.35;pointer-events:none':''}`;
    el.textContent = item.label;
    el.addEventListener('click', () => {
      menu.remove();
      const fs = getSetlistFolders();
      if (item.action === 'rename') {
        const name = prompt('폴더 이름 변경:', fs[fi]?.name || '');
        if (!name?.trim()) return;
        fs[fi].name = name.trim(); saveSetlistFolders(fs); renderFolderChips(panel);
      } else if (item.action === 'up') {
        if (fi > 0) { [fs[fi-1],fs[fi]]=[fs[fi],fs[fi-1]]; saveSetlistFolders(fs); renderFolderChips(panel); }
      } else if (item.action === 'down') {
        if (fi < fs.length-1) { [fs[fi],fs[fi+1]]=[fs[fi+1],fs[fi]]; saveSetlistFolders(fs); renderFolderChips(panel); }
      } else if (item.action === 'delete') {
        if (!confirm(`"${fs[fi]?.name}" 폴더를 삭제합니다. (악보는 유지됩니다)`)) return;
        fs.splice(fi, 1);
        if (activeFolder === folder.id) activeFolder = null;
        saveSetlistFolders(fs);
        renderFolderChips(panel);
        filterList(panel, panel.querySelector('#search-input')?.value || '');
      }
    });
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg3)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
    menu.appendChild(el);
  });

  // 위치 계산
  const rect = anchor.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 170) + 'px';
  document.body.appendChild(menu);

  // 외부 클릭 시 닫기
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 10);
}

async function uploadSheet(panel) {
  const files = Array.from(panel.querySelector('#file-input').files);
  if (!files.length) { alert('파일을 선택해주세요.'); return; }

  const btn = panel.querySelector('#upload-btn');
  btn.disabled = true;

  const commonArtist = panel.querySelector('#meta-artist').value;
  const commonKey    = panel.querySelector('#meta-key').value;
  const commonBpm    = panel.querySelector('#meta-bpm').value;
  const commonTags   = panel.querySelector('#meta-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const commonFolder = panel.querySelector('#meta-folder').value;

  const { isReady, connect, pushSheet: fbPush } = await import('./supabase-sync.js');
  let fbReady = isReady();
  if (!fbReady) {
    const res = await connect();
    fbReady = res.ok;
  }

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const id = uuid();
    const title = files.length === 1
      ? (panel.querySelector('#meta-title').value || file.name.replace(/\.[^.]+$/, ''))
      : file.name.replace(/\.[^.]+$/, '');
    const type = file.type === 'application/pdf' ? 'pdf' : 'image';

    btn.textContent = `저장 중... (${fi + 1}/${files.length})`;

    let thumbnail = null;
    if (type === 'image') thumbnail = await fileToDataURL(file);
    else if (type === 'pdf') thumbnail = await pdfThumbnail(file);

    await saveSheet({ id, file, type, thumbnail, createdAt: Date.now() });

    let pages = null;
    if (type === 'pdf') {
      btn.textContent = `PDF 변환 중... (${fi + 1}/${files.length})`;
      pages = await prerenderPdfPages(file);
      if (pages?.length) await updateSheet(id, { pages });
    }

    const meta = getMeta();
    const metaItem = { id, title, artist: commonArtist, key: commonKey, bpm: commonBpm, tags: commonTags, type, createdAt: Date.now() };
    meta.unshift(metaItem);
    setMeta(meta);

    // gta_setlists 폴더에 추가
    if (commonFolder) {
      addItemToFolder(commonFolder, { id, title, type: type === 'pdf' ? 'pdf' : 'image' });
    } else {
      ensureInFolder({ id, title, type: type === 'pdf' ? 'pdf' : 'image' });
    }

    // Supabase 동기화
    if (fbReady) {
      try {
        btn.textContent = `☁️ 업로드 중... (${fi + 1}/${files.length})`;
        await fbPush(id, file, pages || [], metaItem);
      } catch (e) { console.warn('Supabase push failed:', e); }
    }
  }

  btn.disabled = false;
  btn.textContent = '저장';
  panel.querySelector('#file-input').value = '';
  ['meta-title','meta-artist','meta-key','meta-bpm','meta-tags'].forEach(k => { panel.querySelector(`#${k}`).value = ''; });
  panel.querySelector('#meta-folder').value = '';

  loadList(panel);
}

// PDF 전 페이지를 JPEG 블롭 배열로 변환
async function prerenderPdfPages(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) return null;
  const url = URL.createObjectURL(file);
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.88));
      pages.push(blob);
    }
    return pages;
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

async function pdfThumbnail(file) {
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) return null;
    const url = URL.createObjectURL(file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch { return null; }
}

function loadList(panel) {
  filterList(panel, panel.querySelector('#search-input')?.value || '');
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 카드 그라디언트 (id 기반 결정)
const CARD_COLORS = [
  ['#1a237e','#283593'],['#4a148c','#6a1b9a'],['#880e4f','#ad1457'],
  ['#1b5e20','#2e7d32'],['#0d47a1','#1565c0'],['#bf360c','#d84315'],
  ['#006064','#00838f'],['#37474f','#546e7a'],['#4e342e','#6d4c41'],
];
function cardGradient(id) {
  const idx = id ? (id.charCodeAt(id.length-1) % CARD_COLORS.length) : 0;
  const [a,b] = CARD_COLORS[idx];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function filterList(panel, query) {
  const folders = getSetlistFolders();
  const allMeta = getMeta();
  const allDrafts = getDrafts();
  const q = query.toLowerCase();
  const list = panel.querySelector('#sheet-list');

  // ── 휴지통 뷰 ──
  if (activeFolder === 'trash') {
    const trashItems = [
      ...allDrafts.filter(d => d.deleted).map(d => ({ id: d.id, title: d.title, itemType: 'chart', draft: d })),
      ...allMeta.filter(m => m.deleted).map(m => ({ id: m.id, title: m.title, itemType: 'sheet', meta: m })),
    ];
    if (!trashItems.length) {
      list.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text2)">
        <div style="font-size:2.5rem;margin-bottom:12px">🗑</div>
        <div style="font-size:0.9rem;font-weight:600">휴지통이 비어있습니다</div>
      </div>`;
      return;
    }
    list.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:0.72rem;color:var(--text2)">${trashItems.length}개 항목</span>
      <button id="empty-trash-btn" style="font-size:0.72rem;color:var(--danger);background:none;border:1px solid var(--danger);border-radius:6px;padding:3px 10px;cursor:pointer">전체 영구삭제</button>
    </div><div id="trash-container"></div>`;
    const tc = list.querySelector('#trash-container');

    list.querySelector('#empty-trash-btn').addEventListener('click', async () => {
      if (!confirm('휴지통을 모두 영구 삭제합니까? 복구할 수 없습니다.')) return;
      for (const item of trashItems) {
        if (item.itemType === 'sheet') {
          await deleteSheet(item.id);
          const { isReady, removeSheet } = await import('./supabase-sync.js');
          if (isReady()) removeSheet(item.id).catch(() => {});
        }
      }
      setMeta(allMeta.filter(m => !m.deleted));
      localStorage.setItem('gta_chart_drafts', JSON.stringify(allDrafts.filter(d => !d.deleted)));
      renderFolderChips(panel); filterList(panel, '');
    });

    trashItems.forEach(item => {
      const isChart = item.itemType === 'chart';
      const m = item.meta;
      const d = item.draft;
      const sub = isChart
        ? [d?.key, d?.bpm ? d.bpm+'BPM' : ''].filter(Boolean).join(' · ')
        : [m?.artist, m?.bpm ? m.bpm+'BPM' : ''].filter(Boolean).join(' · ');
      const typeLabel = isChart ? 'Chart' : (m?.type === 'pdf' ? 'PDF' : 'IMG');
      const deletedAt = isChart ? d?.deletedAt : m?.deletedAt;
      const dateStr = deletedAt ? new Date(deletedAt).toLocaleDateString('ko-KR') : '';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--border)';

      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      info.innerHTML = '<div style="font-size:0.86rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(item.title) + '</div>'
        + '<div style="font-size:0.7rem;color:var(--text2);margin-top:2px">' + typeLabel + (sub ? ' · ' + escHtml(sub) : '') + (dateStr ? ' · ' + dateStr + ' 삭제' : '') + '</div>';

      const restoreBtn = document.createElement('button');
      restoreBtn.style.cssText = 'font-size:0.72rem;padding:4px 10px;border-radius:6px;border:1px solid var(--accent);color:var(--accent);background:none;cursor:pointer;flex-shrink:0;white-space:nowrap';
      restoreBtn.textContent = '복구';
      restoreBtn.addEventListener('click', () => {
        if (isChart) {
          const drafts = getDrafts();
          const idx = drafts.findIndex(x => x.id === item.id);
          if (idx >= 0) { delete drafts[idx].deleted; delete drafts[idx].deletedAt; }
          localStorage.setItem('gta_chart_drafts', JSON.stringify(drafts));
        } else {
          const meta = getMeta();
          const idx = meta.findIndex(x => x.id === item.id);
          if (idx >= 0) { delete meta[idx].deleted; delete meta[idx].deletedAt; }
          setMeta(meta);
        }
        renderFolderChips(panel); filterList(panel, '');
      });

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'font-size:0.72rem;padding:4px 10px;border-radius:6px;border:1px solid var(--danger);color:var(--danger);background:none;cursor:pointer;flex-shrink:0;white-space:nowrap';
      delBtn.textContent = '영구삭제';
      delBtn.addEventListener('click', async () => {
        if (!confirm('"' + item.title + '"을 영구 삭제합니까? 복구할 수 없습니다.')) return;
        if (isChart) {
          localStorage.setItem('gta_chart_drafts', JSON.stringify(getDrafts().filter(x => x.id !== item.id)));
        } else {
          await deleteSheet(item.id);
          setMeta(getMeta().filter(x => x.id !== item.id));
          const { isReady, removeSheet } = await import('./supabase-sync.js');
          if (isReady()) removeSheet(item.id).catch(() => {});
        }
        const fs = getSetlistFolders();
        fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== item.id); });
        saveSetlistFolders(fs);
        renderFolderChips(panel); filterList(panel, '');
      });

      row.appendChild(info); row.appendChild(restoreBtn); row.appendChild(delBtn);
      tc.appendChild(row);
    });
    return;
  }

  // ── 일반 뷰 ──
  let items = [];
  if (activeFolder) {
    const folder = folders.find(f => f.id === activeFolder);
    if (folder) {
      for (const song of (folder.songs || [])) {
        if (song.type === 'chart') {
          const d = allDrafts.find(d => d.id === song.id && !d.deleted);
          if (d) items.push({ id: d.id, title: d.title, itemType: 'chart', draft: d });
        } else {
          const m = allMeta.find(m => m.id === song.id && !m.deleted);
          if (m) items.push({ id: m.id, title: m.title, itemType: 'sheet', meta: m });
        }
      }
    }
  } else {
    for (const d of allDrafts.filter(d => !d.deleted)) {
      const f = folders.find(f => f.songs?.find(s => s.id === d.id));
      items.push({ id: d.id, title: d.title, itemType: 'chart', draft: d, folderName: f?.name });
    }
    for (const m of allMeta.filter(m => !m.deleted)) {
      const f = folders.find(f => f.songs?.find(s => s.id === m.id));
      items.push({ id: m.id, title: m.title, itemType: 'sheet', meta: m, folderName: f?.name });
    }
  }

  // 검색
  if (q) items = items.filter(item => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.itemType === 'sheet') {
      if ((item.meta?.artist||'').toLowerCase().includes(q)) return true;
      if ((item.meta?.tags||[]).some(t => t.toLowerCase().includes(q))) return true;
    }
    if (item.itemType === 'chart') {
      if ((item.draft?.artist||'').toLowerCase().includes(q)) return true;
      if ((item.draft?.key||'').toLowerCase().includes(q)) return true;
    }
    return false;
  });

  if (!items.length) {
    const folderName = activeFolder ? folders.find(f=>f.id===activeFolder)?.name : null;
    list.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--text2)">
      <div style="font-size:2.5rem;margin-bottom:12px">📭</div>
      <div style="font-size:0.9rem;font-weight:600;margin-bottom:6px">${folderName ? '"'+folderName+'" 폴더가 비어있습니다' : '항목이 없습니다'}</div>
      <div style="font-size:0.78rem">악보 파일을 업로드하거나 곡진행 탭에서 차트를 저장하세요.</div>
    </div>`;
    return;
  }

  const layoutStyle = (() => { try { return JSON.parse(localStorage.getItem('gta_settings')||'{}').layoutStyle || 'list-b'; } catch { return 'list-b'; } })();

  // list-d: 테이블 헤더
  if (layoutStyle === 'list-d') {
    list.innerHTML = `
      <div style="font-size:0.72rem;color:var(--text2);margin-bottom:8px;padding:0 2px">${items.length}개 항목</div>
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 54px 48px;padding:7px 12px;background:var(--bg3);font-size:0.62rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px">
          <span>곡명</span><span>키</span><span>타입</span>
        </div>
        <div id="item-container"></div>
      </div>`;
  } else {
    list.innerHTML = `<div style="font-size:0.72rem;color:var(--text2);margin-bottom:8px;padding:0 2px">${items.length}개 항목</div><div id="item-container"></div>`;
  }
  const container = list.querySelector('#item-container');

  // 폴더 select 생성 + 이벤트
  function makeFolderSel(item, isChart, m) {
    if (!folders.length) return null;
    const sel = document.createElement('select');
    sel.className = 'move-folder-sel';
    sel.style.cssText = 'font-size:0.62rem;padding:2px 4px;margin-top:4px;border-radius:4px;width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text2)';
    sel.innerHTML = '<option value="">폴더 없음</option>' + folders.map(f => '<option value="' + f.id + '">' + escHtml(f.name) + '</option>').join('');
    const cur = folders.find(f => f.songs?.find(s => s.id === item.id));
    sel.value = cur?.id || '';
    sel.addEventListener('change', e => {
      e.stopPropagation();
      const fs = getSetlistFolders();
      fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== item.id); });
      if (sel.value) { const t = fs.find(f => f.id === sel.value); if (t) t.songs.push({id:item.id, title:item.title, type:isChart?'chart':(m?.type||'sheet')}); }
      saveSetlistFolders(fs); renderFolderChips(panel);
    });
    sel.addEventListener('click', e => e.stopPropagation());
    return sel;
  }

  // 공통 삭제 핸들러 (소프트 삭제 — 휴지통으로 이동)
  function onDelete(item) {
    return e => {
      e.stopPropagation();
      if (!confirm('"' + item.title + '"을 휴지통으로 이동합니까?\n휴지통에서 복구하거나 영구 삭제할 수 있습니다.')) return;
      if (item.itemType === 'chart') {
        const drafts = getDrafts();
        const idx = drafts.findIndex(x => x.id === item.id);
        if (idx >= 0) { drafts[idx].deleted = true; drafts[idx].deletedAt = Date.now(); }
        localStorage.setItem('gta_chart_drafts', JSON.stringify(drafts));
      } else {
        const meta = getMeta();
        const idx = meta.findIndex(x => x.id === item.id);
        if (idx >= 0) { meta[idx].deleted = true; meta[idx].deletedAt = Date.now(); }
        setMeta(meta);
      }
      const fs = getSetlistFolders();
      fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== item.id); });
      saveSetlistFolders(fs);
      loadList(panel); renderFolderChips(panel);
    };
  }

  // 공통 클릭 핸들러
  function onClick(item) {
    return e => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      if (item.itemType === 'chart') goTo(7, {openDraftId: item.id});
      else openSheet(panel, item.id);
    };
  }

  // 컬러 사이드바용 accent 색상
  const ACCENT_COLORS = ['#4a7cff','#9b4aff','#4aff9b','#ff9b4a','#4afff0','#ff4a7c','#ffcc4a','#4affcc'];
  function accentColor(id) { let h=0; for (const c of id) h=(h*31+c.charCodeAt(0))&0xffff; return ACCENT_COLORS[h%ACCENT_COLORS.length]; }

  items.forEach(item => {
    const isChart = item.itemType === 'chart';
    const d = item.draft;
    const m = item.meta;
    const key = isChart ? (d?.key||'') : (m?.key||'');
    const artist = isChart ? (d?.artist||'') : (m?.artist||'');
    const bpm = isChart ? (d?.bpm||'') : (m?.bpm||'');
    const typeLabel = isChart ? 'Chart' : (m?.type==='pdf' ? 'PDF' : 'IMG');
    const sub = [artist, bpm ? bpm+'BPM' : ''].filter(Boolean).join(' · ');

    // ── list-b: 컬러 사이드바 ──
    if (layoutStyle === 'list-b') {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:stretch;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s';
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg3)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });

      const bar = document.createElement('div');
      bar.style.cssText = 'width:3px;flex-shrink:0;border-radius:0 2px 2px 0;background:' + accentColor(item.id);

      const content = document.createElement('div');
      content.style.cssText = 'flex:1;min-width:0;padding:11px 12px';
      content.innerHTML = '<div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(item.title) + '</div>'
        + '<div style="font-size:0.7rem;color:var(--text2);margin-top:2px">' + escHtml(sub || key || '—') + '</div>';
      const sel = makeFolderSel(item, isChart, m);
      if (sel) content.appendChild(sel);

      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:0.6rem;padding:0 12px;display:flex;align-items:center;color:var(--text2);text-transform:uppercase;letter-spacing:0.3px;flex-shrink:0';
      badge.textContent = typeLabel;

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'background:none;border:none;color:var(--text2);font-size:0.85rem;cursor:pointer;padding:0 10px;flex-shrink:0;opacity:0;transition:opacity 0.15s';
      delBtn.textContent = '✕';
      row.addEventListener('mouseenter', () => { delBtn.style.opacity='1'; });
      row.addEventListener('mouseleave', () => { delBtn.style.opacity='0'; });
      let tt; row.addEventListener('touchstart', () => { tt=setTimeout(()=>delBtn.style.opacity='1',600); },{passive:true});
      row.addEventListener('touchend', () => clearTimeout(tt), {passive:true});

      row.appendChild(bar); row.appendChild(content); row.appendChild(badge); row.appendChild(delBtn);
      row.addEventListener('click', onClick(item));
      delBtn.addEventListener('click', onDelete(item));
      container.appendChild(row);

    // ── list-c: 풀와이드 타이포 ──
    } else if (layoutStyle === 'list-c') {
      const row = document.createElement('div');
      row.style.cssText = 'padding:13px 2px;border-bottom:1px solid var(--border);cursor:pointer;transition:opacity 0.15s';
      row.addEventListener('mouseenter', () => { row.style.opacity='0.65'; });
      row.addEventListener('mouseleave', () => { row.style.opacity='1'; });

      const top = document.createElement('div');
      top.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:8px';
      const title = document.createElement('div');
      title.style.cssText = 'font-size:0.92rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';
      title.textContent = item.title;
      const keyEl = document.createElement('div');
      keyEl.style.cssText = 'font-size:0.78rem;font-weight:600;color:var(--text2);flex-shrink:0';
      keyEl.textContent = key;
      top.appendChild(title); top.appendChild(keyEl);

      const bot = document.createElement('div');
      bot.style.cssText = 'display:flex;justify-content:space-between;margin-top:4px';
      const artistEl = document.createElement('div');
      artistEl.style.cssText = 'font-size:0.7rem;color:var(--text2)';
      artistEl.textContent = artist || '—';
      const typeEl = document.createElement('div');
      typeEl.style.cssText = 'font-size:0.62rem;color:var(--border);text-transform:uppercase;letter-spacing:0.5px';
      typeEl.textContent = typeLabel;
      bot.appendChild(artistEl); bot.appendChild(typeEl);

      const sel = makeFolderSel(item, isChart, m);

      row.appendChild(top); row.appendChild(bot);
      if (sel) row.appendChild(sel);
      row.addEventListener('click', onClick(item));
      container.appendChild(row);

    // ── list-d: 컴팩트 테이블 ──
    } else {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:1fr 54px 48px;padding:10px 12px;border-top:1px solid var(--border);cursor:pointer;align-items:center;transition:background 0.15s';
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg3)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });

      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:0.84rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0';
      titleEl.textContent = item.title;

      const keyEl = document.createElement('div');
      keyEl.style.cssText = 'font-size:0.78rem;font-weight:600;color:var(--text2)';
      keyEl.textContent = key || '—';

      const typeEl = document.createElement('div');
      typeEl.style.cssText = 'font-size:0.65rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.3px';
      typeEl.textContent = typeLabel;

      row.appendChild(titleEl); row.appendChild(keyEl); row.appendChild(typeEl);
      row.addEventListener('click', onClick(item));
      container.appendChild(row);
    }
  });
}



async function deleteSheetItem(id, panel) {
  await deleteSheet(id);
  setMeta(getMeta().filter(m => m.id !== id));
  loadList(panel);
  const { isReady, removeSheet: fbRemove } = await import('./supabase-sync.js');
  if (isReady()) fbRemove(id).catch(() => {});
}

// ===== 이미지/PDF → 단일 PDF 변환 =====
async function sheetsToPdf(ids, title) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error('jsPDF 라이브러리를 불러오지 못했습니다.');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let firstPage = true;

  for (const id of ids) {
    const record = await getSheet(id);
    if (!record) continue;

    // 이미 렌더된 페이지 이미지(JPEG blob 배열)가 있으면 우선 사용
    const pageBlobs = record.pages?.length ? record.pages : null;

    if (pageBlobs) {
      for (const pageBlob of pageBlobs) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        const dataUrl = await blobToDataUrl(pageBlob);
        const { w, h } = fitToA4(await getImageDimensions(dataUrl));
        doc.addImage(dataUrl, 'JPEG', (210 - w) / 2, (297 - h) / 2, w, h);
      }
    } else if (record.type === 'image') {
      if (!firstPage) doc.addPage();
      firstPage = false;
      const dataUrl = await blobToDataUrl(record.file);
      const imgType = record.file.type.includes('png') ? 'PNG' : 'JPEG';
      const { w, h } = fitToA4(await getImageDimensions(dataUrl));
      doc.addImage(dataUrl, imgType, (210 - w) / 2, (297 - h) / 2, w, h);
    } else if (record.type === 'pdf') {
      // PDF → 각 페이지를 canvas로 렌더해서 삽입
      const pages = await renderPdfToImages(record.file);
      for (const dataUrl of pages) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        const { w, h } = fitToA4(await getImageDimensions(dataUrl));
        doc.addImage(dataUrl, 'JPEG', (210 - w) / 2, (297 - h) / 2, w, h);
      }
    }
  }

  return doc.output('blob');
}

function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

function fitToA4({ width, height }) {
  const maxW = 200, maxH = 287; // A4 여백 포함
  const ratio = Math.min(maxW / width, maxH / height);
  return { w: width * ratio, h: height * ratio };
}

async function renderPdfToImages(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) return [];
  const url = URL.createObjectURL(file);
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    const results = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      results.push(canvas.toDataURL('image/jpeg', 0.9));
    }
    return results;
  } finally { URL.revokeObjectURL(url); }
}

function addPdfToLive(pdfBlob, title, sourceId) {
  const liveId = 'live_pdf_' + sourceId;
  import('./db.js').then(({ saveSheet }) => {
    saveSheet({ id: liveId, file: pdfBlob, type: 'pdf', thumbnail: null, createdAt: Date.now() });
  });
  const allMeta = getMeta();
  if (!allMeta.find(m => m.id === liveId)) {
    allMeta.unshift({ id: liveId, title, artist: '', key: '', bpm: '', tags: [], type: 'pdf', createdAt: Date.now(), isLivePdf: true });
    setMeta(allMeta);
  }
  ensureInFolder({ id: liveId, title, type: 'pdf' });
}

async function openSheet(panel, id) {
  const meta = getMeta().find(m => m.id === id);
  const record = await getSheet(id);
  if (!record) return;

  const folders = getFolders();
  const url = URL.createObjectURL(record.file);

  const viewer = panel.querySelector('#sheet-viewer');
  viewer.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:1.1rem;font-weight:700">${meta.title}</div>
          <div style="color:var(--text2);font-size:0.85rem">
            ${[meta.artist, meta.key ? '키: '+meta.key : '', meta.bpm ? meta.bpm+'BPM' : ''].filter(Boolean).join(' · ')}
          </div>
          ${meta.folder ? `<div style="font-size:0.8rem;color:var(--accent);margin-top:2px">📁 ${meta.folder}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary" id="ai-analyze-btn">🤖 AI 자동 분석</button>
          <button class="btn btn-link" id="extract-btn">🎵 코드 추출 → 라이브차트</button>
          <button class="btn btn-link" id="to-chart-btn">코드차트 만들기 →</button>
          <button class="btn btn-link" id="to-live-btn">라이브 모드에 추가 →</button>
          <button class="btn btn-secondary" id="delete-btn" style="color:var(--danger)">삭제</button>
        </div>
      </div>
      <!-- 폴더 이동 -->
      ${getSetlistFolders().length ? `
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:0.8rem;color:var(--text2)">폴더:</span>
          <select id="move-folder-sel" style="width:auto">
            <option value="">폴더 없음</option>
            ${getSetlistFolders().map(f => {
              const currentFolder = getSetlistFolders().find(x => x.songs?.find(s => s.id === meta.id));
              return `<option value="${f.id}" ${currentFolder?.id===f.id?'selected':''}>📁 ${f.name}</option>`;
            }).join('')}
          </select>
          <button class="btn btn-secondary" id="move-folder-btn" style="font-size:0.78rem;padding:5px 10px">이동</button>
        </div>
      ` : ''}
      <hr class="divider">
      ${record.type === 'image'
        ? `<img src="${url}" style="max-width:100%;border-radius:var(--radius)">`
        : `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:var(--radius)"></iframe>`
      }
    </div>
  `;

  viewer.querySelector('#to-chart-btn').addEventListener('click', () =>
    goTo(7, { title: meta.title, artist: meta.artist, key: meta.key, bpm: meta.bpm }));

  viewer.querySelector('#to-live-btn').addEventListener('click', () => {
    ensureInFolder({ id, title: meta.title, type: meta.type || 'sheet' });
    alert(`"${meta.title}"을 셋리스트 폴더에 추가했습니다.`);
    renderFolderTree(panel);
  });

  viewer.querySelector('#delete-btn').addEventListener('click', async () => {
    if (!confirm(`"${meta.title}"을 삭제하시겠습니까?`)) return;
    await deleteSheet(id);
    setMeta(getMeta().filter(m => m.id !== id));
    viewer.innerHTML = '';
    loadList(panel);
    // Supabase에서도 삭제
    const { isReady, removeSheet: fbRemove } = await import('./supabase-sync.js');
    if (isReady()) fbRemove(id).catch(() => {});
  });

  viewer.querySelector('#move-folder-btn')?.addEventListener('click', () => {
    const newFolderId = viewer.querySelector('#move-folder-sel').value;
    // 기존 폴더에서 제거
    const fs = getSetlistFolders();
    fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== id); });
    // 새 폴더에 추가
    if (newFolderId) {
      const target = fs.find(f => f.id === newFolderId);
      if (target && !target.songs.find(s => s.id === id)) {
        target.songs.push({ id, title: meta.title, type: meta.type || 'sheet' });
      }
    }
    saveSetlistFolders(fs);
    loadList(panel); renderFolderTree(panel);
    const newFolder = newFolderId ? getSetlistFolders().find(f=>f.id===newFolderId) : null;
    viewer.querySelector('[style*="color:var(--accent)"]')?.remove();
    if (newFolder) {
      viewer.querySelector('.card > div:first-child').insertAdjacentHTML('beforeend',
        `<div style="font-size:0.8rem;color:var(--accent);margin-top:2px">📁 ${newFolder.name}</div>`);
    }
  });

  viewer.querySelector('#ai-analyze-btn').addEventListener('click', () =>
    runAiAnalysis(meta, record, viewer, panel));

  viewer.querySelector('#extract-btn').addEventListener('click', () =>
    extractAndCreateLiveChart(meta, record, viewer));

  viewer.scrollIntoView({ behavior: 'smooth' });
}

// ===== 코드 추출 → 라이브 차트 생성 =====
const CHORD_RE = /\b([A-G][#b]?(?:maj7|maj9|maj|m7b5|m7|m9|m|7|9|11|13|sus[24]|dim7|dim|aug|add9|\+|°)?)\b/g;

async function extractChordsFromPdf(record) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF.js 없음');
  const url = URL.createObjectURL(record.file);
  const pdf = await pdfjsLib.getDocument(url).promise;
  const chordsByPage = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ');
    const matches = [...text.matchAll(CHORD_RE)].map(m => m[1]);
    // 중복 제거하되 순서 유지
    const unique = [...new Set(matches)];
    if (unique.length) chordsByPage.push({ page: p, chords: unique });
  }
  URL.revokeObjectURL(url);
  return chordsByPage;
}

async function extractAndCreateLiveChart(meta, record, viewer) {
  // 추출 결과 표시 영역
  let extractArea = viewer.querySelector('#extract-area');
  if (!extractArea) {
    extractArea = document.createElement('div');
    extractArea.id = 'extract-area';
    viewer.querySelector('.card').appendChild(extractArea);
  }
  extractArea.innerHTML = `<hr class="divider"><div style="color:var(--text2);font-size:0.85rem">분석 중...</div>`;

  let sections = [];

  if (record.type === 'pdf') {
    try {
      const byPage = await extractChordsFromPdf(record);
      if (byPage.length === 0) {
        // 텍스트 추출 실패 → 수동 입력 fallback
        showManualInput(meta, extractArea);
        return;
      }
      // 페이지별 → 섹션으로 변환
      sections = byPage.map((pg, i) => ({
        type: i === 0 ? 'Intro' : `Page ${pg.page}`,
        bars: pg.chords.map(c => ({ chords: c })),
        memo: ''
      }));
    } catch {
      showManualInput(meta, extractArea);
      return;
    }
  } else {
    // 이미지 → 수동 입력
    showManualInput(meta, extractArea);
    return;
  }

  renderExtractResult(meta, sections, extractArea);
}

function showManualInput(meta, container) {
  container.innerHTML = `
    <hr class="divider">
    <div class="section-label">코드 직접 입력 (이미지/스캔 악보)</div>
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:8px">PDF 텍스트 추출이 불가능합니다. 악보를 보면서 코드를 직접 입력해주세요.</p>
    <div id="manual-sections"></div>
    <div class="btn-row">
      <button class="btn btn-secondary" id="add-manual-sec">+ 섹션 추가</button>
      <button class="btn btn-primary" id="save-manual">라이브 차트 생성</button>
    </div>
  `;

  const secTypes = ['Intro','Verse','Chorus','Bridge','Solo','Outro'];
  let manualSections = [{ type: 'Verse', chords: '' }];

  function renderManual() {
    container.querySelector('#manual-sections').innerHTML = manualSections.map((s, i) => `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <select class="sec-type" data-i="${i}" style="width:auto;flex-shrink:0">
          ${secTypes.map(t => `<option ${t===s.type?'selected':''}>${t}</option>`).join('')}
        </select>
        <input type="text" class="sec-chords" data-i="${i}" value="${s.chords}" placeholder="Am7, D7, Gmaj7, Cmaj7" style="flex:1">
        <button class="del-sec btn btn-secondary" data-i="${i}" style="padding:6px 8px;color:var(--danger)">×</button>
      </div>
    `).join('');
    container.querySelectorAll('.sec-type').forEach(el => el.addEventListener('change', e => { manualSections[e.target.dataset.i].type = e.target.value; }));
    container.querySelectorAll('.sec-chords').forEach(el => el.addEventListener('input', e => { manualSections[e.target.dataset.i].chords = e.target.value; }));
    container.querySelectorAll('.del-sec').forEach(el => el.addEventListener('click', e => { manualSections.splice(Number(e.target.dataset.i), 1); renderManual(); }));
  }
  renderManual();

  container.querySelector('#add-manual-sec').addEventListener('click', () => {
    manualSections.push({ type: 'Verse', chords: '' });
    renderManual();
  });
  container.querySelector('#save-manual').addEventListener('click', () => {
    const sections = manualSections.map(s => ({
      type: s.type,
      bars: s.chords.split(',').map(c => ({ chords: c.trim() })).filter(b => b.chords),
      memo: ''
    }));
    renderExtractResult(meta, sections, container);
  });
}

function renderExtractResult(meta, sections, container) {
  const preview = sections.map(s =>
    `<div style="margin-bottom:10px">
      <div style="font-weight:700;color:var(--accent);font-size:0.85rem;margin-bottom:4px">${s.type}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${s.bars.map(b => `<span style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:0.85rem;font-weight:600">${b.chords}</span>`).join('')}
      </div>
    </div>`
  ).join('');

  container.innerHTML = `
    <hr class="divider">
    <div class="section-label">추출된 코드 진행 미리보기</div>
    <div style="background:var(--bg3);border-radius:var(--radius);padding:12px;margin-bottom:12px">${preview}</div>
    <div class="btn-row">
      <button class="btn btn-primary" id="create-live-chart">라이브 차트로 저장 + 셋리스트 추가</button>
      <button class="btn btn-secondary" id="edit-before-save">수정 후 저장 →</button>
    </div>
  `;

  container.querySelector('#create-live-chart').addEventListener('click', () => {
    saveLiveChart(meta, sections);
    container.innerHTML = `<hr class="divider"><div style="color:var(--accent);font-size:0.85rem;padding:8px 0">✅ 라이브 셋리스트에 추가됐습니다.</div>`;
  });

  container.querySelector('#edit-before-save').addEventListener('click', () => {
    const draft = buildDraft(meta, sections);
    const drafts = JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]');
    drafts.unshift(draft);
    localStorage.setItem('gta_chart_drafts', JSON.stringify(drafts));
    goTo(7); // 곡(코드)진행 탭으로 이동
  });
}

function buildDraft(meta, sections) {
  const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36));
  return {
    id,
    title: meta.title + ' (라이브)',
    artist: meta.artist || '',
    key: meta.key || '',
    bpm: meta.bpm || '',
    time: '4/4',
    sections
  };
}

function saveLiveChart(meta, sections) {
  const draft = buildDraft(meta, sections);
  const drafts = JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]');
  drafts.unshift(draft);
  localStorage.setItem('gta_chart_drafts', JSON.stringify(drafts));

  ensureInFolder({ id: draft.id, title: draft.title, type: 'chart' });
}

// ===== 클라우드 동기화 =====
async function syncFromCloud(panel) {
  const syncBtn = panel.querySelector('#sync-btn');
  const orig = syncBtn.textContent;
  syncBtn.disabled = true;
  syncBtn.textContent = '☁️ 연결 중...';

  try {
    const { isReady, connect, pullAll, fetchBlob } = await import('./supabase-sync.js');
    let ready = isReady();
    if (!ready) {
      const res = await connect();
      if (!res.ok) { alert('Supabase 연결 실패: ' + res.error + '\n\n설정 탭에서 Supabase URL과 Key를 확인해주세요.'); return; }
      ready = true;
    }

    syncBtn.textContent = '☁️ 목록 받는 중...';
    const remoteList = await pullAll();
    if (!remoteList) { alert('동기화 실패: 원격 데이터를 가져올 수 없습니다.'); return; }

    const localMeta = getMeta();
    const localIds = new Set(localMeta.map(m => m.id));
    const toDownload = remoteList.filter(r => !localIds.has(r.id));

    let downloaded = 0;
    for (let i = 0; i < toDownload.length; i++) {
      const remote = toDownload[i];
      syncBtn.textContent = `☁️ 다운로드 중 (${i + 1}/${toDownload.length})...`;
      try {
        const mime = remote.type === 'pdf' ? 'application/pdf' : 'image/jpeg';
        const fileBlob = await fetchBlob(remote.fileUrl, mime);

        const pages = [];
        for (const pUrl of (remote.pagesUrls || [])) {
          pages.push(await fetchBlob(pUrl, 'image/jpeg'));
        }

        await saveSheet({ id: remote.id, file: fileBlob, type: remote.type, thumbnail: null, createdAt: remote.createdAt, ...(pages.length ? { pages } : {}) });
        localMeta.unshift({ id: remote.id, title: remote.title, artist: remote.artist, key: remote.key, bpm: remote.bpm, tags: remote.tags || [], folder: remote.folder || '', type: remote.type, createdAt: remote.createdAt });
        downloaded++;
      } catch (e) { console.warn('download failed:', remote.id, e); }
    }

    setMeta(localMeta);
    loadList(panel);
    alert(`동기화 완료!\n새로 받은 파일: ${downloaded}개\n(전체 원격: ${remoteList.length}개, 이미 보유: ${localIds.size}개)`);
  } catch (e) {
    alert('동기화 오류: ' + e.message);
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = orig;
  }
}

// ===== AI 자동 분석 (Gemini Vision) =====
async function runAiAnalysis(meta, record, viewer, panel) {
  const { isConfigured, analyzeSheet } = await import('./gemini-analysis.js?v=11');
  if (!isConfigured()) {
    alert('⚙️ 설정 탭에서 Gemini API 키를 먼저 입력해주세요.\n(Google AI Studio에서 무료 발급)');
    return;
  }

  // 분석용 이미지 준비 (PDF면 첫 페이지 이미지 사용)
  let imageBlob = null;
  if (record.type === 'image') {
    imageBlob = record.file;
  } else if (record.pages?.length) {
    imageBlob = record.pages[0]; // 업로드 시 변환된 JPEG
  } else {
    alert('분석할 이미지를 준비할 수 없습니다. 파일을 다시 업로드해주세요.');
    return;
  }

  // 분석 진행 UI
  let resultArea = viewer.querySelector('#ai-result-area');
  if (!resultArea) {
    resultArea = document.createElement('div');
    resultArea.id = 'ai-result-area';
    viewer.querySelector('.card').appendChild(resultArea);
  }
  resultArea.innerHTML = `<hr class="divider"><div style="color:var(--text2);padding:12px 0">🤖 AI 분석 중... (5~15초 소요)</div>`;

  try {
    const result = await analyzeSheet(imageBlob);
    renderAnalysisReview(result, meta, resultArea, panel);
  } catch (e) {
    resultArea.innerHTML = `<hr class="divider"><div style="color:var(--danger);padding:8px 0">❌ 분석 실패: ${e.message}</div>`;
  }
}

function renderAnalysisReview(result, meta, container, panel) {
  // 섹션 편집용 상태
  let editResult = JSON.parse(JSON.stringify(result)); // 깊은 복사

  function buildSectionRows() {
    return (editResult.sections || []).map((sec, si) => `
      <div style="background:var(--bg3);border-radius:var(--radius);padding:10px 12px;margin-bottom:6px">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <input class="rev-sec-type" data-si="${si}" value="${sec.type || ''}"
            placeholder="섹션 이름"
            style="flex:1;font-weight:700;color:var(--accent);background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:4px 8px">
          <button class="btn btn-secondary rev-del-sec" data-si="${si}" style="font-size:0.7rem;padding:3px 7px">×</button>
        </div>
        <input class="rev-sec-chords" data-si="${si}" value="${(sec.chords||[]).join(', ')}"
          placeholder="코드 (쉼표 구분)"
          style="width:100%;margin-bottom:4px">
        <input class="rev-sec-memo" data-si="${si}" value="${sec.memo||''}"
          placeholder="메모 (선택)"
          style="width:100%;font-size:0.8rem">
      </div>
    `).join('');
  }

  container.innerHTML = `
    <hr class="divider">
    <div style="font-weight:700;font-size:1rem;margin-bottom:12px">🤖 AI 분석 결과 — 검토 후 적용</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div><div class="label">곡명</div><input id="rev-title" value="${result.title||meta.title||''}"></div>
      <div><div class="label">아티스트</div><input id="rev-artist" value="${result.artist||meta.artist||''}"></div>
      <div><div class="label">키</div><input id="rev-key" value="${result.key||meta.key||''}"></div>
      <div><div class="label">BPM</div><input id="rev-bpm" value="${result.bpm||meta.bpm||''}"></div>
      <div><div class="label">박자</div><input id="rev-time" value="${result.time||'4/4'}"></div>
      <div><div class="label">태그</div><input id="rev-tags" value="${(result.tags||[]).join(', ')}"></div>
    </div>

    ${result.notes ? `<div style="font-size:0.8rem;color:var(--text2);margin-bottom:12px;padding:8px;background:var(--bg3);border-radius:var(--radius)">💡 ${result.notes}</div>` : ''}

    <div class="section-label">코드 진행 (섹션별 편집 가능)</div>
    <div id="rev-sections">${buildSectionRows()}</div>
    <button class="btn btn-secondary" id="rev-add-sec" style="font-size:0.78rem;margin-bottom:12px">+ 섹션 추가</button>

    <div class="btn-row">
      <button class="btn btn-primary" id="rev-apply-btn">✅ 전체 적용 (저장 + 라이브 + 이론분석)</button>
      <button class="btn btn-secondary" id="rev-cancel-btn">취소</button>
    </div>
  `;

  // 섹션 이벤트
  function bindSectionEvents() {
    container.querySelectorAll('.rev-sec-type').forEach(inp => {
      inp.addEventListener('input', () => { editResult.sections[+inp.dataset.si].type = inp.value; });
    });
    container.querySelectorAll('.rev-sec-chords').forEach(inp => {
      inp.addEventListener('input', () => {
        editResult.sections[+inp.dataset.si].chords = inp.value.split(',').map(s=>s.trim()).filter(Boolean);
      });
    });
    container.querySelectorAll('.rev-sec-memo').forEach(inp => {
      inp.addEventListener('input', () => { editResult.sections[+inp.dataset.si].memo = inp.value; });
    });
    container.querySelectorAll('.rev-del-sec').forEach(btn => {
      btn.addEventListener('click', () => {
        editResult.sections.splice(+btn.dataset.si, 1);
        container.querySelector('#rev-sections').innerHTML = buildSectionRows();
        bindSectionEvents();
      });
    });
  }
  bindSectionEvents();

  container.querySelector('#rev-add-sec').addEventListener('click', () => {
    editResult.sections.push({ type: '', chords: [], memo: '' });
    container.querySelector('#rev-sections').innerHTML = buildSectionRows();
    bindSectionEvents();
  });

  container.querySelector('#rev-cancel-btn').addEventListener('click', () => {
    container.innerHTML = '';
  });

  container.querySelector('#rev-apply-btn').addEventListener('click', async () => {
    // 1. 메타데이터 업데이트
    const newMeta = {
      title:  container.querySelector('#rev-title').value.trim()  || meta.title,
      artist: container.querySelector('#rev-artist').value.trim() || meta.artist,
      key:    container.querySelector('#rev-key').value.trim()    || meta.key,
      bpm:    container.querySelector('#rev-bpm').value.trim()    || meta.bpm,
      time:   container.querySelector('#rev-time').value.trim()   || '4/4',
      tags:   container.querySelector('#rev-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    };
    const allMeta = getMeta();
    const idx = allMeta.findIndex(m => m.id === meta.id);
    if (idx >= 0) Object.assign(allMeta[idx], newMeta);
    setMeta(allMeta);

    // 2. 코드차트 생성 + 라이브 셋리스트 추가
    const draftId = uuid();
    const draft = {
      id: draftId,
      title: newMeta.title,
      artist: newMeta.artist,
      key: newMeta.key,
      bpm: newMeta.bpm,
      time: newMeta.time,
      sections: editResult.sections.map(sec => ({
        type: sec.type,
        bars: (sec.chords||[]).map(c => ({ chords: c })),
        memo: sec.memo || ''
      }))
    };
    const drafts = JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]');
    drafts.unshift(draft);
    localStorage.setItem('gta_chart_drafts', JSON.stringify(drafts));

    ensureInFolder({ id: draftId, title: newMeta.title, type: 'chart' });

    // 3. 이론 분석 탭에 코드 진행 전달
    const allChords = editResult.sections.flatMap(s => s.chords || []);
    goTo(1, { progression: allChords.join(' - ') });

    container.innerHTML = `
      <hr class="divider">
      <div style="color:var(--accent);padding:8px 0;font-size:0.85rem">
        ✅ 적용 완료!<br>
        <span style="color:var(--text2);font-size:0.8rem">
          메타정보 업데이트 · 코드차트 생성 · 라이브 셋리스트 추가 · 이론 분석 탭 연동
        </span>
      </div>
    `;
    loadList(panel);
  });
}


// ===== 일괄 AI 분석 (여러 페이지 → 한 곡) =====
async function runBatchAiAnalysis(ids, panel) {
  const { isConfigured, analyzeSheets } = await import('./gemini-analysis.js?v=11');
  if (!isConfigured()) { alert('⚙️ 설정 탭에서 API 키를 먼저 입력해주세요.'); return; }

  const viewer = panel.querySelector('#sheet-viewer');
  viewer.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div style="font-weight:700;margin-bottom:8px">🤖 일괄 AI 분석</div>
      <div id="batch-status" style="color:var(--text2);font-size:0.85rem">이미지 준비 중...</div>
    </div>
  `;
  viewer.scrollIntoView({ behavior: 'smooth' });
  const statusEl = viewer.querySelector('#batch-status');

  // 이미지 수집
  const images = [];
  for (let i = 0; i < ids.length; i++) {
    statusEl.textContent = `이미지 준비 중... (${i+1}/${ids.length})`;
    const record = await getSheet(ids[i]);
    if (!record) continue;
    if (record.type === 'image' && record.file) images.push(record.file);
    else if (record.pages?.length) record.pages.forEach(b => b && images.push(b));
  }

  if (!images.length) { statusEl.textContent = '❌ 분석할 이미지를 찾을 수 없습니다.'; return; }

  statusEl.textContent = `🤖 AI 분석 중... (${images.length}장 · 모델 자동 선택 · 10~30초 소요)`;

  try {
    const result = await analyzeSheets(images);
    const firstMeta = getMeta().find(m => m.id === ids[0]) || { id: ids[0], title: '' };
    renderAnalysisReview(result, firstMeta, viewer.querySelector('.card'), panel);
  } catch (e) {
    statusEl.innerHTML = `<div style="color:var(--danger);white-space:pre-wrap;font-size:0.78rem">❌ ${e.message}</div>`;
  }
}
