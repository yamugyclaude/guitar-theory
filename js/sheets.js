import { goTo } from './app.js';
import { saveSheet, getAllSheets, deleteSheet, getSheet, updateSheet } from './db.js';

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36); }

function getMeta() { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }
function setMeta(data) { localStorage.setItem('gta_sheet_meta', JSON.stringify(data)); }
// ===== 폴더 관리 (하위폴더 지원) =====
// 형식: [{id, name, parentId}]  parentId=null → 루트 폴더
// 하위폴더 id: 'ParentName/ChildName' 형태
function getFolders() {
  const raw = JSON.parse(localStorage.getItem('gta_folders') || '[]');
  // 구버전(string[]) 마이그레이션
  if (raw.length && typeof raw[0] === 'string') {
    const migrated = raw.map(name => ({ id: name, name, parentId: null }));
    setFolders(migrated);
    return migrated;
  }
  return raw;
}
function setFolders(data) { localStorage.setItem('gta_folders', JSON.stringify(data)); }
function rootFolders() { return getFolders().filter(f => !f.parentId); }
function subFolders(pid) { return getFolders().filter(f => f.parentId === pid); }
function folderById(id) { return getFolders().find(f => f.id === id); }
function folderLabel(id) {
  const f = folderById(id);
  if (!f) return id || '';
  if (!f.parentId) return f.name;
  const p = folderById(f.parentId);
  return p ? `${p.name} › ${f.name}` : f.name;
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
  panel.innerHTML = `
    <h1 class="page-title">📂 악보 보관함</h1>

    <!-- 업로드 폼 -->
    <div class="card">
      <div class="label">악보 업로드 (PDF · PNG · JPG · 복수 선택 가능)</div>
      <input type="file" id="file-input" accept=".pdf,.png,.jpg,.jpeg" multiple style="margin-bottom:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:2;min-width:120px"><div class="label">곡명</div><input type="text" id="meta-title" placeholder="곡명"></div>
        <div style="flex:1;min-width:100px"><div class="label">아티스트</div><input type="text" id="meta-artist" placeholder="아티스트"></div>
        <div style="flex:1;min-width:70px"><div class="label">키</div><input type="text" id="meta-key" placeholder="Am"></div>
        <div style="flex:1;min-width:60px"><div class="label">BPM</div><input type="text" id="meta-bpm" placeholder="120"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <div style="flex:2;min-width:140px"><div class="label">태그 (쉼표 구분)</div><input type="text" id="meta-tags" placeholder="블루스, 펑크"></div>
        <div style="flex:1;min-width:120px">
          <div class="label">폴더</div>
          <select id="meta-folder"><option value="">폴더 없음</option></select>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="upload-btn">저장</button>
      </div>
    </div>

    <!-- 폴더 관리 -->
    <div class="card" style="padding:12px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
        <span class="section-label" style="margin-bottom:0">폴더</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary" id="new-folder-btn" style="font-size:0.75rem;padding:4px 10px">+ 새 폴더</button>
          <button class="btn btn-secondary" id="sync-btn" style="font-size:0.75rem;padding:4px 10px">☁️ 동기화</button>
        </div>
      </div>
      <div id="folder-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      <div id="subfolder-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;padding-left:12px;border-left:2px solid var(--border)"></div>
    </div>

    <!-- 검색 + 목록 -->
    <div style="margin-bottom:8px">
      <input type="text" id="search-input" placeholder="검색 (곡명·태그·아티스트)">
    </div>
    <div id="sheet-list"></div>
    <div id="sheet-viewer"></div>
  `;

  checkBackup(panel);
  renderFolderList(panel);
  loadList(panel);

  panel.querySelector('#upload-btn').addEventListener('click', () => uploadSheet(panel));
  panel.querySelector('#search-input').addEventListener('input', e => filterList(panel, e.target.value));
  panel.querySelector('#new-folder-btn').addEventListener('click', () => {
    const name = prompt('새 폴더 이름:');
    if (!name?.trim()) return;
    const folders = getFolders();
    if (folders.find(f => f.id === name.trim())) { alert('이미 있는 폴더입니다.'); return; }
    folders.push({ id: name.trim(), name: name.trim(), parentId: null });
    setFolders(folders);
    renderFolderList(panel);
  });
  panel.querySelector('#sync-btn').addEventListener('click', () => syncFromCloud(panel));
}

function renderFolderList(panel) {
  const roots = rootFolders();

  // 업로드 폼 폴더 select 업데이트 (계층 표시)
  const sel = panel.querySelector('#meta-folder');
  if (sel) {
    sel.innerHTML = `<option value="">폴더 없음</option>` +
      roots.map(f => {
        const subs = subFolders(f.id);
        return `<option value="${f.id}">📁 ${f.name}</option>` +
          subs.map(s => `<option value="${s.id}">　└ ${s.name}</option>`).join('');
      }).join('');
    sel.value = sel.querySelector(`option[value="${activeFolder}"]`) ? activeFolder : '';
  }

  // 루트 폴더 탭
  const list = panel.querySelector('#folder-list');
  // 현재 activeFolder의 루트를 파악
  const activeFolderObj = activeFolder ? folderById(activeFolder) : null;
  const activeRoot = activeFolderObj
    ? (activeFolderObj.parentId ? activeFolderObj.parentId : activeFolderObj.id)
    : null;

  list.innerHTML = `
    <button class="btn ${activeFolder === null ? 'btn-primary' : 'btn-secondary'} folder-tab" data-folder="" style="font-size:0.78rem;padding:5px 12px">전체</button>
    ${roots.map(f => `
      <div style="display:inline-flex;align-items:center;gap:2px">
        <button class="btn ${activeRoot === f.id ? 'btn-primary' : 'btn-secondary'} folder-tab" data-folder="${f.id}" style="font-size:0.78rem;padding:5px 12px">📁 ${f.name}</button>
        <button class="btn btn-secondary del-folder" data-folder="${f.id}" style="font-size:0.7rem;padding:4px 6px;color:var(--danger)">×</button>
      </div>
    `).join('')}
  `;

  // 하위폴더 탭 (루트 선택 시)
  const subList = panel.querySelector('#subfolder-list');
  const subs = activeRoot ? subFolders(activeRoot) : [];
  if (subs.length || activeRoot) {
    subList.style.display = '';
    subList.innerHTML = `
      <button class="btn ${activeFolder === activeRoot ? 'btn-primary' : 'btn-secondary'} folder-tab" data-folder="${activeRoot || ''}" style="font-size:0.72rem;padding:4px 10px">전체</button>
      ${subs.map(s => `
        <div style="display:inline-flex;align-items:center;gap:2px">
          <button class="btn ${activeFolder === s.id ? 'btn-primary' : 'btn-secondary'} folder-tab" data-folder="${s.id}" style="font-size:0.72rem;padding:4px 10px">${s.name}</button>
          <button class="btn btn-secondary del-folder" data-folder="${s.id}" style="font-size:0.65rem;padding:3px 5px;color:var(--danger)">×</button>
        </div>
      `).join('')}
      <button class="btn btn-secondary" id="new-subfolder-btn" style="font-size:0.72rem;padding:4px 10px">+ 하위폴더</button>
    `;
    subList.querySelector('#new-subfolder-btn')?.addEventListener('click', () => {
      const name = prompt(`"${folderById(activeRoot)?.name}" 안에 새 하위폴더 이름:`);
      if (!name?.trim()) return;
      const folders = getFolders();
      const newId = `${activeRoot}/${name.trim()}`;
      if (folders.find(f => f.id === newId)) { alert('이미 있는 폴더입니다.'); return; }
      folders.push({ id: newId, name: name.trim(), parentId: activeRoot });
      setFolders(folders);
      renderFolderList(panel);
    });
  } else {
    subList.style.display = 'none';
    subList.innerHTML = '';
  }

  panel.querySelectorAll('.folder-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFolder = btn.dataset.folder || null;
      renderFolderList(panel);
      filterList(panel, panel.querySelector('#search-input')?.value || '');
    });
  });

  panel.querySelectorAll('.del-folder').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.folder;
      const f = folderById(fid);
      if (!confirm(`"${f?.name || fid}" 폴더를 삭제하시겠습니까? (악보는 유지됩니다)`)) return;
      // 해당 폴더+하위폴더 id 수집
      const toRemove = new Set([fid, ...getFolders().filter(x => x.parentId === fid).map(x => x.id)]);
      const meta = getMeta().map(m => toRemove.has(m.folder) ? { ...m, folder: '' } : m);
      setMeta(meta);
      setFolders(getFolders().filter(x => !toRemove.has(x.id)));
      if (activeFolder && toRemove.has(activeFolder)) activeFolder = null;
      renderFolderList(panel);
      filterList(panel, panel.querySelector('#search-input')?.value || '');
    });
  });
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

  const { isReady, connect, pushSheet: fbPush } = await import('./firebase-sync.js');
  let fbReady = isReady();
  if (!fbReady && localStorage.getItem('gta_firebase_cfg')) {
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
    const metaItem = { id, title, artist: commonArtist, key: commonKey, bpm: commonBpm, tags: commonTags, folder: commonFolder, type, createdAt: Date.now() };
    meta.unshift(metaItem);
    setMeta(meta);

    // Firebase 동기화
    if (fbReady) {
      try {
        btn.textContent = `☁️ 업로드 중... (${fi + 1}/${files.length})`;
        await fbPush(id, file, pages || [], metaItem);
      } catch (e) { console.warn('Firebase push failed:', e); }
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

function filterList(panel, query) {
  let meta = getMeta();
  const q = query.toLowerCase();

  // 폴더 필터 (하위폴더 포함)
  if (activeFolder) {
    const activeFolderObj = folderById(activeFolder);
    if (activeFolderObj && !activeFolderObj.parentId) {
      // 루트 폴더 선택 → 루트 + 모든 하위폴더 포함
      const childIds = new Set([activeFolder, ...subFolders(activeFolder).map(s => s.id)]);
      meta = meta.filter(m => childIds.has(m.folder));
    } else {
      meta = meta.filter(m => m.folder === activeFolder);
    }
  }

  // 검색 필터
  if (q) meta = meta.filter(m =>
    m.title.toLowerCase().includes(q) ||
    (m.artist || '').toLowerCase().includes(q) ||
    (m.tags || []).some(t => t.toLowerCase().includes(q))
  );

  const list = panel.querySelector('#sheet-list');
  if (!meta.length) {
    list.innerHTML = `<div class="empty-state">${activeFolder ? `"${activeFolder}" 폴더에 ` : ''}저장된 악보가 없습니다.</div>`;
    return;
  }

  list.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
      ${meta.map(m => `
        <div class="card" style="cursor:pointer;padding:10px" data-id="${m.id}">
          ${m.thumbnail
            ? `<img src="${m.thumbnail}" style="width:100%;border-radius:4px;margin-bottom:6px;aspect-ratio:3/4;object-fit:cover">`
            : `<div style="width:100%;aspect-ratio:3/4;background:var(--bg3);border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;font-size:2rem">${m.type==='pdf'?'📄':'🖼️'}</div>`
          }
          <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.title}</div>
          <div style="font-size:0.72rem;color:var(--text2)">${m.artist || ''}</div>
          ${m.folder ? `<div style="font-size:0.68rem;color:var(--accent);margin-top:2px">📁 ${folderLabel(m.folder)}</div>` : ''}
          <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">${(m.tags||[]).map(t=>`<span class="badge" style="font-size:0.65rem">${t}</span>`).join('')}</div>
        </div>
      `).join('')}
    </div>
  `;

  list.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => openSheet(panel, el.dataset.id));
  });
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
          <button class="btn btn-link" id="extract-btn">🎵 코드 추출 → 라이브차트</button>
          <button class="btn btn-link" id="to-chart-btn">코드차트 만들기 →</button>
          <button class="btn btn-link" id="to-live-btn">라이브 모드에 추가 →</button>
          <button class="btn btn-secondary" id="delete-btn" style="color:var(--danger)">삭제</button>
        </div>
      </div>
      <!-- 폴더 이동 -->
      ${getFolders().length ? `
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:0.8rem;color:var(--text2)">폴더 이동:</span>
          <select id="move-folder-sel" style="width:auto">
            <option value="">폴더 없음</option>
            ${rootFolders().map(f => {
              const subs = subFolders(f.id);
              return `<option value="${f.id}" ${meta.folder===f.id?'selected':''}>📁 ${f.name}</option>` +
                subs.map(s => `<option value="${s.id}" ${meta.folder===s.id?'selected':''}>　└ ${s.name}</option>`).join('');
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
    const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!setlists.find(s => s.id === id)) setlists.push({ id, title: meta.title, type: 'sheet' });
    localStorage.setItem('gta_setlists', JSON.stringify(setlists));
    alert(`"${meta.title}"을 라이브 모드 셋리스트에 추가했습니다.`);
  });

  viewer.querySelector('#delete-btn').addEventListener('click', async () => {
    if (!confirm(`"${meta.title}"을 삭제하시겠습니까?`)) return;
    await deleteSheet(id);
    setMeta(getMeta().filter(m => m.id !== id));
    viewer.innerHTML = '';
    loadList(panel);
    // Firebase에서도 삭제
    const { isReady, removeSheet: fbRemove } = await import('./firebase-sync.js');
    if (isReady()) fbRemove(id).catch(() => {});
  });

  viewer.querySelector('#move-folder-btn')?.addEventListener('click', () => {
    const newFolder = viewer.querySelector('#move-folder-sel').value;
    const allMeta = getMeta();
    const idx = allMeta.findIndex(m => m.id === id);
    if (idx >= 0) { allMeta[idx].folder = newFolder; setMeta(allMeta); }
    loadList(panel);
    viewer.querySelector('[style*="color:var(--accent)"]')?.remove();
    if (newFolder) {
      viewer.querySelector('.card > div:first-child').insertAdjacentHTML('beforeend',
        `<div style="font-size:0.8rem;color:var(--accent);margin-top:2px">📁 ${newFolder}</div>`);
    }
  });

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
    const { goTo } = saveLiveChartAndGetId(meta, sections);
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

  const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
  if (!setlists.find(s => s.id === draft.id)) {
    setlists.push({ id: draft.id, title: draft.title, type: 'chart' });
    localStorage.setItem('gta_setlists', JSON.stringify(setlists));
  }
}

// ===== 클라우드 동기화 =====
async function syncFromCloud(panel) {
  const syncBtn = panel.querySelector('#sync-btn');
  const orig = syncBtn.textContent;
  syncBtn.disabled = true;
  syncBtn.textContent = '☁️ 연결 중...';

  try {
    const { isReady, connect, pullAll, fetchBlob } = await import('./firebase-sync.js');
    let ready = isReady();
    if (!ready) {
      const res = await connect();
      if (!res.ok) { alert('Firebase 연결 실패: ' + res.error + '\n\n설정 탭에서 Firebase를 연결해주세요.'); return; }
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

