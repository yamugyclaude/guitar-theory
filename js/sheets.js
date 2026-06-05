import { goTo } from './app.js';
import { saveSheet, getAllSheets, deleteSheet, getSheet } from './db.js';

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36); }

function getMeta() { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }
function setMeta(data) { localStorage.setItem('gta_sheet_meta', JSON.stringify(data)); }
function getFolders() { return JSON.parse(localStorage.getItem('gta_folders') || '[]'); }
function setFolders(data) { localStorage.setItem('gta_folders', JSON.stringify(data)); }

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
      <div class="label">악보 업로드 (PDF · PNG · JPG)</div>
      <input type="file" id="file-input" accept=".pdf,.png,.jpg,.jpeg" style="margin-bottom:10px">
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="section-label" style="margin-bottom:0">폴더</span>
        <button class="btn btn-secondary" id="new-folder-btn" style="font-size:0.75rem;padding:4px 10px">+ 새 폴더</button>
      </div>
      <div id="folder-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
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
    const name = prompt('폴더 이름을 입력하세요:');
    if (!name?.trim()) return;
    const folders = getFolders();
    if (folders.includes(name.trim())) { alert('이미 있는 폴더입니다.'); return; }
    folders.push(name.trim());
    setFolders(folders);
    renderFolderList(panel);
  });
}

function renderFolderList(panel) {
  const folders = getFolders();

  // 업로드 폼 폴더 select 업데이트
  const sel = panel.querySelector('#meta-folder');
  if (sel) {
    sel.innerHTML = `<option value="">폴더 없음</option>` +
      folders.map(f => `<option value="${f}">${f}</option>`).join('');
  }

  // 폴더 탭 버튼
  const list = panel.querySelector('#folder-list');
  list.innerHTML = `
    <button class="btn ${activeFolder === null ? 'btn-primary' : 'btn-secondary'} folder-tab" data-folder="" style="font-size:0.78rem;padding:5px 12px">전체</button>
    ${folders.map(f => `
      <div style="display:flex;align-items:center;gap:2px">
        <button class="btn ${activeFolder === f ? 'btn-primary' : 'btn-secondary'} folder-tab" data-folder="${f}" style="font-size:0.78rem;padding:5px 12px">${f}</button>
        <button class="btn btn-secondary del-folder" data-folder="${f}" style="font-size:0.7rem;padding:4px 6px;color:var(--danger)">×</button>
      </div>
    `).join('')}
  `;

  list.querySelectorAll('.folder-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFolder = btn.dataset.folder || null;
      renderFolderList(panel);
      filterList(panel, panel.querySelector('#search-input').value);
    });
  });

  list.querySelectorAll('.del-folder').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.folder;
      if (!confirm(`"${f}" 폴더를 삭제하시겠습니까? (악보는 유지됩니다)`)) return;
      // 해당 폴더 악보들의 folder 필드 초기화
      const meta = getMeta().map(m => m.folder === f ? { ...m, folder: '' } : m);
      setMeta(meta);
      const folders = getFolders().filter(x => x !== f);
      setFolders(folders);
      if (activeFolder === f) activeFolder = null;
      renderFolderList(panel);
      filterList(panel, panel.querySelector('#search-input').value);
    });
  });
}

async function uploadSheet(panel) {
  const file = panel.querySelector('#file-input').files[0];
  if (!file) { alert('파일을 선택해주세요.'); return; }

  const id = uuid();
  const title = panel.querySelector('#meta-title').value || file.name;
  const artist = panel.querySelector('#meta-artist').value;
  const key = panel.querySelector('#meta-key').value;
  const bpm = panel.querySelector('#meta-bpm').value;
  const tags = panel.querySelector('#meta-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const folder = panel.querySelector('#meta-folder').value;
  const type = file.type === 'application/pdf' ? 'pdf' : 'image';

  let thumbnail = null;
  if (type === 'image') {
    thumbnail = await fileToDataURL(file);
  } else if (type === 'pdf') {
    thumbnail = await pdfThumbnail(file);
  }

  await saveSheet({ id, file, type, thumbnail, createdAt: Date.now() });

  const meta = getMeta();
  meta.unshift({ id, title, artist, key, bpm, tags, folder, type, createdAt: Date.now() });
  setMeta(meta);

  panel.querySelector('#file-input').value = '';
  ['meta-title','meta-artist','meta-key','meta-bpm','meta-tags'].forEach(k => { panel.querySelector(`#${k}`).value = ''; });
  panel.querySelector('#meta-folder').value = '';

  loadList(panel);
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
    const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
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

  // 폴더 필터
  if (activeFolder) meta = meta.filter(m => m.folder === activeFolder);

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
          ${m.folder ? `<div style="font-size:0.68rem;color:var(--accent);margin-top:2px">📁 ${m.folder}</div>` : ''}
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
          <button class="btn btn-link" id="to-chart-btn">코드차트 만들기 →</button>
          <button class="btn btn-link" id="to-live-btn">라이브 모드에 추가 →</button>
          <button class="btn btn-secondary" id="delete-btn" style="color:var(--danger)">삭제</button>
        </div>
      </div>
      <!-- 폴더 이동 -->
      ${folders.length ? `
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:0.8rem;color:var(--text2)">폴더 이동:</span>
          <select id="move-folder-sel" style="width:auto">
            <option value="">폴더 없음</option>
            ${folders.map(f => `<option value="${f}" ${meta.folder===f?'selected':''}>${f}</option>`).join('')}
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

  viewer.scrollIntoView({ behavior: 'smooth' });
}
