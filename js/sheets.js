import { goTo } from './app.js';
import { saveSheet, getAllSheets, deleteSheet, getSheet } from './db.js';

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36); }

function getMeta() { return JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]'); }
function setMeta(data) { localStorage.setItem('gta_sheet_meta', JSON.stringify(data)); }

function checkBackup(panel) {
  const last = localStorage.getItem('gta_last_backup');
  if (!last) return;
  const days = Math.floor((Date.now() - new Date(last)) / 86400000);
  if (days >= 7) {
    panel.insertAdjacentHTML('afterbegin', `
      <div style="background:var(--danger);color:#fff;padding:10px 14px;border-radius:var(--radius);margin-bottom:12px;font-size:0.85rem">
        ⚠️ 마지막 백업으로부터 <strong>${days}일</strong> 경과. 설정 탭에서 백업을 권장합니다.
        <button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;color:#fff;cursor:pointer;font-size:1rem">×</button>
      </div>
    `);
  }
}

export async function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">📂 악보 보관함</h1>
    <div class="card">
      <div class="label">악보 업로드 (PDF · PNG · JPG)</div>
      <input type="file" id="file-input" accept=".pdf,.png,.jpg,.jpeg" style="margin-bottom:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px"><div class="label">곡명</div><input type="text" id="meta-title" placeholder="곡명"></div>
        <div style="flex:1;min-width:120px"><div class="label">아티스트</div><input type="text" id="meta-artist" placeholder="아티스트"></div>
        <div style="flex:1;min-width:80px"><div class="label">키</div><input type="text" id="meta-key" placeholder="예: Am"></div>
        <div style="flex:1;min-width:80px"><div class="label">BPM</div><input type="text" id="meta-bpm" placeholder="120"></div>
      </div>
      <div style="margin-top:8px"><div class="label">태그 (쉼표 구분)</div><input type="text" id="meta-tags" placeholder="예: 블루스, 펑크"></div>
      <div class="btn-row">
        <button class="btn btn-primary" id="upload-btn">저장</button>
      </div>
    </div>
    <div style="margin-bottom:8px">
      <input type="text" id="search-input" placeholder="검색 (곡명·태그·아티스트)">
    </div>
    <div id="sheet-list"></div>
    <div id="sheet-viewer"></div>
  `;

  checkBackup(panel);
  loadList(panel);

  panel.querySelector('#upload-btn').addEventListener('click', () => uploadSheet(panel));
  panel.querySelector('#search-input').addEventListener('input', e => filterList(panel, e.target.value));
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
  const type = file.type === 'application/pdf' ? 'pdf' : 'image';

  // 썸네일 생성
  let thumbnail = null;
  if (type === 'image') {
    thumbnail = await fileToDataURL(file);
  } else if (type === 'pdf') {
    thumbnail = await pdfThumbnail(file);
  }

  await saveSheet({ id, file, type, thumbnail, createdAt: Date.now() });

  const meta = getMeta();
  meta.unshift({ id, title, artist, key, bpm, tags, type, createdAt: Date.now() });
  setMeta(meta);

  panel.querySelector('#file-input').value = '';
  ['meta-title','meta-artist','meta-key','meta-bpm','meta-tags'].forEach(k => { panel.querySelector(`#${k}`).value = ''; });
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
  const meta = getMeta();
  const q = query.toLowerCase();
  const filtered = q ? meta.filter(m =>
    m.title.toLowerCase().includes(q) ||
    (m.artist || '').toLowerCase().includes(q) ||
    (m.tags || []).some(t => t.toLowerCase().includes(q))
  ) : meta;

  const list = panel.querySelector('#sheet-list');
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">저장된 악보가 없습니다.</div>`;
    return;
  }
  list.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
      ${filtered.map(m => `
        <div class="card" style="cursor:pointer;padding:10px" data-id="${m.id}">
          ${m.thumbnail ? `<img src="${m.thumbnail}" style="width:100%;border-radius:4px;margin-bottom:6px;aspect-ratio:3/4;object-fit:cover">` : `<div style="width:100%;aspect-ratio:3/4;background:var(--bg3);border-radius:4px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;font-size:2rem">${m.type==='pdf'?'📄':'🖼️'}</div>`}
          <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.title}</div>
          <div style="font-size:0.72rem;color:var(--text2)">${m.artist || ''}</div>
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

  const viewer = panel.querySelector('#sheet-viewer');
  const url = URL.createObjectURL(record.file);

  viewer.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:1.1rem;font-weight:700">${meta.title}</div>
          <div style="color:var(--text2);font-size:0.85rem">${meta.artist || ''} ${meta.key ? '· '+meta.key : ''} ${meta.bpm ? '· '+meta.bpm+'BPM' : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-link" id="to-chart-btn">코드차트 만들기 →</button>
          <button class="btn btn-link" id="to-live-btn">라이브 모드에 추가 →</button>
          <button class="btn btn-secondary" id="delete-btn" style="color:var(--danger)">삭제</button>
        </div>
      </div>
      <hr class="divider">
      ${record.type === 'image'
        ? `<img src="${url}" style="max-width:100%;border-radius:var(--radius)">`
        : `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:var(--radius)"></iframe>`
      }
    </div>
  `;

  viewer.querySelector('#to-chart-btn').addEventListener('click', () => goTo(7, { title: meta.title, artist: meta.artist, key: meta.key, bpm: meta.bpm }));
  viewer.querySelector('#to-live-btn').addEventListener('click', () => {
    const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!setlists.find(s => s.id === id)) setlists.push({ id, title: meta.title, type: 'sheet' });
    localStorage.setItem('gta_setlists', JSON.stringify(setlists));
    alert(`"${meta.title}"을 라이브 모드 셋리스트에 추가했습니다.`);
  });
  viewer.querySelector('#delete-btn').addEventListener('click', async () => {
    if (!confirm(`"${meta.title}"을 삭제하시겠습니까?`)) return;
    await deleteSheet(id);
    const m = getMeta().filter(m => m.id !== id);
    setMeta(m);
    viewer.innerHTML = '';
    loadList(panel);
  });

  viewer.scrollIntoView({ behavior: 'smooth' });
}
