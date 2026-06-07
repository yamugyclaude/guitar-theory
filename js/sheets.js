import { goTo } from './app.js';
import { saveSheet, getAllSheets, deleteSheet, getSheet, updateSheet } from './db.js';

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
  migrateOldFolders();

  panel.innerHTML = `
    <h1 class="page-title">📂 악보 보관함</h1>

    <!-- 업로드 폼 -->
    <div class="card" id="upload-card">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="upload-toggle">
        <span style="font-weight:600;font-size:0.88rem">➕ 악보 파일 업로드</span>
        <span id="upload-arrow" style="font-size:0.8rem;color:var(--text2)">▼</span>
      </div>
      <div id="upload-body" style="display:none;margin-top:12px">
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" id="pick-file-btn" style="font-size:0.82rem;flex:1">📁 파일 / iCloud에서 가져오기</button>
          <button class="btn btn-secondary" id="pick-photo-btn" style="font-size:0.82rem;flex:1">🖼️ 사진 앨범에서 가져오기</button>
        </div>
        <input type="file" id="file-input" accept=".pdf,.png,.jpg,.jpeg" multiple style="display:none">
        <input type="file" id="photo-input" accept="image/*" multiple style="display:none">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <div style="flex:2;min-width:120px"><div class="label">곡명</div><input type="text" id="meta-title" placeholder="곡명"></div>
          <div style="flex:1;min-width:100px"><div class="label">아티스트</div><input type="text" id="meta-artist" placeholder="아티스트"></div>
          <div style="flex:1;min-width:70px"><div class="label">키</div><input type="text" id="meta-key" placeholder="Am"></div>
          <div style="flex:1;min-width:60px"><div class="label">BPM</div><input type="text" id="meta-bpm" placeholder="120"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <div style="flex:2;min-width:140px"><div class="label">태그 (쉼표 구분)</div><input type="text" id="meta-tags" placeholder="블루스, 펑크"></div>
          <div style="flex:1;min-width:120px">
            <div class="label">폴더에 추가</div>
            <select id="meta-folder"><option value="">폴더 없음</option></select>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="upload-btn">저장</button>
        </div>
      </div>
    </div>

    <!-- 탐색기 레이아웃 -->
    <div style="display:flex;gap:0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;min-height:400px;background:var(--bg2)">
      <!-- 왼쪽: 폴더 -->
      <div id="folder-pane" style="width:200px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;background:var(--bg3)">
        <div style="padding:8px 10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:4px">
          <span style="font-size:0.72rem;font-weight:700;color:var(--text2);letter-spacing:0.04em">폴더</span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary" id="new-folder-btn" style="font-size:0.65rem;padding:2px 7px">+ 폴더</button>
            <button class="btn btn-secondary" id="sync-btn" style="font-size:0.65rem;padding:2px 7px">☁️</button>
          </div>
        </div>
        <div id="folder-tree"></div>
      </div>
      <!-- 오른쪽: 파일 목록 -->
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div style="padding:8px 10px;border-bottom:1px solid var(--border)">
          <input type="text" id="search-input" placeholder="검색 (곡명·태그·아티스트)" style="padding:5px 10px;font-size:0.82rem">
        </div>
        <div id="sheet-list" style="flex:1;overflow-y:auto;padding:6px 8px"></div>
      </div>
    </div>

    <div id="sheet-viewer"></div>
  `;

  checkBackup(panel);
  renderFolderTree(panel);
  loadList(panel);

  // 업로드 접기/펼치기
  panel.querySelector('#upload-toggle').addEventListener('click', () => {
    const body = panel.querySelector('#upload-body');
    const arrow = panel.querySelector('#upload-arrow');
    const open = body.style.display === 'none';
    body.style.display = open ? '' : 'none';
    arrow.textContent = open ? '▲' : '▼';
  });

  panel.querySelector('#pick-file-btn').addEventListener('click', () => panel.querySelector('#file-input').click());
  panel.querySelector('#pick-photo-btn').addEventListener('click', () => panel.querySelector('#photo-input').click());
  panel.querySelector('#photo-input').addEventListener('change', e => {
    const fileInput = panel.querySelector('#file-input');
    const dt = new DataTransfer();
    Array.from(e.target.files).forEach(f => dt.items.add(f));
    fileInput.files = dt.files;
    e.target.value = '';
  });
  panel.querySelector('#upload-btn').addEventListener('click', () => uploadSheet(panel));
  panel.querySelector('#search-input').addEventListener('input', e => filterList(panel, e.target.value));
  panel.querySelector('#new-folder-btn').addEventListener('click', () => {
    const name = prompt('새 폴더 이름:');
    if (!name?.trim()) return;
    const folders = getSetlistFolders();
    if (folders.find(f => f.name === name.trim())) { alert('이미 같은 이름의 폴더가 있습니다.'); return; }
    folders.push({ id: 'folder_' + Date.now(), name: name.trim(), songs: [] });
    saveSetlistFolders(folders);
    renderFolderTree(panel);
  });
  panel.querySelector('#sync-btn').addEventListener('click', () => syncFromCloud(panel));
}

function renderFolderTree(panel) {
  const folders = getSetlistFolders();
  const allMeta = getMeta();
  const allDrafts = getDrafts();

  // 업로드 폼 폴더 select 업데이트
  const sel = panel.querySelector('#meta-folder');
  if (sel) {
    sel.innerHTML = `<option value="">폴더 없음</option>` +
      folders.map(f => `<option value="${f.id}">📁 ${f.name}</option>`).join('');
    // activeFolder가 있으면 선택
    if (activeFolder) sel.value = activeFolder;
  }

  const tree = panel.querySelector('#folder-tree');
  if (!tree) return;

  // 전체 개수 = 모든 차트 + 모든 악보 파일
  const totalCount = allDrafts.length + allMeta.length;

  function folderItemCount(f) {
    return (f.songs || []).length;
  }

  // 전체 항목
  const allActive = activeFolder === null;
  let html = `
    <div class="tree-item" data-fid="__all__"
      style="display:flex;align-items:center;gap:6px;padding:6px 10px;cursor:pointer;border-radius:4px;margin:2px 4px;
      ${allActive ? 'background:var(--accent);color:#fff;' : ''}">
      <span style="font-size:0.9rem">🗂</span>
      <span style="flex:1;font-size:0.82rem;font-weight:${allActive?'700':'400'}">전체</span>
      <span style="font-size:0.68rem;${allActive?'opacity:0.8':'color:var(--text2)'}">${totalCount}</span>
    </div>
  `;

  folders.forEach((f, fi) => {
    const isActive = activeFolder === f.id;
    const count = folderItemCount(f);
    html += `
      <div class="tree-item" data-fid="${f.id}"
        style="display:flex;align-items:center;gap:5px;padding:6px 8px;cursor:pointer;border-radius:4px;margin:2px 4px;
        ${isActive ? 'background:var(--accent);color:#fff;' : ''}">
        <span style="font-size:0.85rem;flex-shrink:0">📁</span>
        <span class="folder-name-span" style="flex:1;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${isActive?'700':'400'}">${f.name}</span>
        <span style="font-size:0.65rem;${isActive?'opacity:0.8':'color:var(--text2)'};flex-shrink:0">${count}</span>
        <button class="folder-up-btn btn btn-secondary" data-fi="${fi}"
          style="font-size:0.55rem;padding:1px 4px;flex-shrink:0;${isActive?'background:rgba(255,255,255,0.2);border-color:transparent;color:#fff;':''}"
          ${fi===0?'disabled':''} title="위로">↑</button>
        <button class="folder-down-btn btn btn-secondary" data-fi="${fi}"
          style="font-size:0.55rem;padding:1px 4px;flex-shrink:0;${isActive?'background:rgba(255,255,255,0.2);border-color:transparent;color:#fff;':''}"
          ${fi===folders.length-1?'disabled':''} title="아래로">↓</button>
        <button class="folder-ctx-btn btn btn-secondary" data-fi="${fi}"
          style="font-size:0.6rem;padding:1px 5px;flex-shrink:0;${isActive?'background:rgba(255,255,255,0.2);border-color:transparent;color:#fff;':''}"
          title="이름 변경 / 삭제">⋯</button>
      </div>
    `;
  });

  tree.innerHTML = html;

  // 트리 항목 클릭 (폴더 선택)
  tree.querySelectorAll('.tree-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const fid = el.dataset.fid;
      activeFolder = fid === '__all__' ? null : fid;
      renderFolderTree(panel);
      filterList(panel, panel.querySelector('#search-input')?.value || '');
    });
  });

  // 폴더 순서 ↑↓
  tree.querySelectorAll('.folder-up-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const fi = +btn.dataset.fi; if (fi === 0) return;
      const fs = getSetlistFolders();
      [fs[fi-1], fs[fi]] = [fs[fi], fs[fi-1]];
      saveSetlistFolders(fs);
      renderFolderTree(panel);
    });
  });
  tree.querySelectorAll('.folder-down-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const fi = +btn.dataset.fi;
      const fs = getSetlistFolders(); if (fi >= fs.length-1) return;
      [fs[fi], fs[fi+1]] = [fs[fi+1], fs[fi]];
      saveSetlistFolders(fs);
      renderFolderTree(panel);
    });
  });

  // ⋯ 컨텍스트 (이름 변경 / 삭제)
  tree.querySelectorAll('.folder-ctx-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const fi = +btn.dataset.fi;
      const fs = getSetlistFolders();
      const f = fs[fi];
      const action = prompt(`"${f.name}" 폴더\n\n이름 변경: 새 이름 입력\n삭제: "삭제" 입력`, f.name);
      if (action === null) return;
      if (action.trim() === '삭제') {
        if (!confirm(`"${f.name}" 폴더를 삭제합니다. (악보는 유지됩니다)`)) return;
        fs.splice(fi, 1);
        if (activeFolder === f.id) activeFolder = null;
        saveSetlistFolders(fs);
        renderFolderTree(panel);
        filterList(panel, panel.querySelector('#search-input')?.value || '');
      } else if (action.trim()) {
        fs[fi].name = action.trim();
        saveSetlistFolders(fs);
        renderFolderTree(panel);
      }
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

  const { isReady, connect, pushSheet: fbPush } = await import('./supabase-sync.js');
  let fbReady = isReady();
  if (!fbReady && localStorage.getItem('gta_supabase_cfg')) {
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

function filterList(panel, query) {
  const folders = getSetlistFolders();
  const allMeta = getMeta();
  const allDrafts = getDrafts();
  const q = query.toLowerCase();

  // activeFolder에 따른 항목 수집
  let items = []; // [{id, title, itemType:'chart'|'sheet', meta?, draft?, folderName?}]

  if (activeFolder) {
    // 특정 폴더: 해당 폴더의 songs 기준
    const folder = folders.find(f => f.id === activeFolder);
    if (folder) {
      for (const song of (folder.songs || [])) {
        if (song.type === 'chart') {
          const d = allDrafts.find(d => d.id === song.id);
          if (d) items.push({ id: d.id, title: d.title, itemType: 'chart', draft: d });
        } else {
          const m = allMeta.find(m => m.id === song.id);
          if (m) items.push({ id: m.id, title: m.title, itemType: 'sheet', meta: m });
        }
      }
    }
  } else {
    // 전체: 모든 차트 + 모든 악보 파일
    for (const d of allDrafts) {
      // 어느 폴더에 속하는지 찾기
      const folder = folders.find(f => f.songs?.find(s => s.id === d.id));
      items.push({ id: d.id, title: d.title, itemType: 'chart', draft: d, folderName: folder?.name });
    }
    for (const m of allMeta) {
      const folder = folders.find(f => f.songs?.find(s => s.id === m.id));
      items.push({ id: m.id, title: m.title, itemType: 'sheet', meta: m, folderName: folder?.name });
    }
  }

  // 검색 필터
  if (q) items = items.filter(item => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.itemType === 'sheet') {
      const m = item.meta;
      if ((m?.artist||'').toLowerCase().includes(q)) return true;
      if ((m?.tags||[]).some(t => t.toLowerCase().includes(q))) return true;
    }
    if (item.itemType === 'chart') {
      if ((item.draft?.artist||'').toLowerCase().includes(q)) return true;
      if ((item.draft?.key||'').toLowerCase().includes(q)) return true;
    }
    return false;
  });

  const list = panel.querySelector('#sheet-list');
  if (!items.length) {
    const folderName = activeFolder ? folders.find(f=>f.id===activeFolder)?.name : null;
    list.innerHTML = `<div class="empty-state">${folderName ? `"${folderName}" 폴더에 ` : ''}항목이 없습니다.<br>
      <span style="font-size:0.78rem">악보 파일을 업로드하거나 곡진행 탭에서 차트를 저장하세요.</span></div>`;
    return;
  }

  const folderOptions = `<option value="">폴더 없음</option>` +
    folders.map(f => `<option value="${f.id}">${escHtml(f.name)}</option>`).join('');

  list.innerHTML = `
    <div style="padding:4px 4px 6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:0.72rem;color:var(--text2)">${items.length}개 항목</span>
      <span style="font-size:0.7rem;color:var(--text2);margin-left:auto">📝=차트 · 📄=PDF · 🖼️=이미지</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">
      ${items.map(item => {
        const isChart = item.itemType === 'chart';
        const d = item.draft;
        const m = item.meta;
        const icon = isChart ? '📝' : (m?.type === 'pdf' ? '📄' : '🖼️');
        const subtitle = isChart
          ? [d?.key, d?.time, d?.bpm ? d.bpm+'BPM' : ''].filter(Boolean).join(' · ')
          : [m?.artist, m?.key ? '🎵 '+m.key : '', m?.bpm ? m.bpm+'BPM' : ''].filter(Boolean).join(' · ');
        const tags = isChart ? [] : (m?.tags || []);
        const folderBadge = item.folderName
          ? `<span style="color:var(--accent);font-size:0.65rem">📁 ${escHtml(item.folderName)}</span>` : '';
        return `
          <div class="sheet-item" data-id="${item.id}" data-type="${item.itemType}"
            style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:background 0.12s">
            <span style="font-size:1.1rem;flex-shrink:0">${icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.86rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.title)}</div>
              <div style="font-size:0.7rem;color:var(--text2);display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:1px">
                ${subtitle ? `<span>${escHtml(subtitle)}</span>` : ''}
                ${folderBadge}
                ${tags.map(t=>`<span class="badge" style="font-size:0.6rem">${escHtml(t)}</span>`).join('')}
              </div>
            </div>
            ${folders.length ? `
              <select class="move-folder-sel" data-id="${item.id}" style="width:auto;font-size:0.68rem;padding:2px 4px;max-width:90px;flex-shrink:0"
                onclick="event.stopPropagation()">${folderOptions}</select>
            ` : ''}
            <button class="sheet-del-btn btn btn-secondary" data-id="${item.id}" data-type="${item.itemType}"
              style="flex-shrink:0;font-size:0.72rem;padding:3px 7px;color:var(--danger)">🗑</button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // 폴더 select 현재 값 설정
  list.querySelectorAll('.move-folder-sel').forEach(sel => {
    const id = sel.dataset.id;
    const folder = folders.find(f => f.songs?.find(s => s.id === id));
    sel.value = folder?.id || '';
    sel.addEventListener('change', e => {
      e.stopPropagation();
      const newFolderId = sel.value;
      const itemId = sel.dataset.id;
      // 기존 폴더에서 제거
      const fs = getSetlistFolders();
      fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== itemId); });
      // 새 폴더에 추가
      if (newFolderId) {
        const target = fs.find(f => f.id === newFolderId);
        if (target) {
          const title = items.find(it => it.id === itemId)?.title || '';
          const type = items.find(it => it.id === itemId)?.itemType === 'chart' ? 'chart'
            : (allMeta.find(m => m.id === itemId)?.type || 'sheet');
          target.songs.push({ id: itemId, title, type });
        }
      }
      saveSetlistFolders(fs);
      renderFolderTree(panel);
    });
  });

  // 호버 미리보기 팝업 (PC, 악보 파일만)
  const preview = document.createElement('div');
  preview.style.cssText = 'position:fixed;z-index:9990;pointer-events:none;display:none;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,0.4);max-width:200px';
  document.body.appendChild(preview);

  list.querySelectorAll('.sheet-item').forEach(el => {
    if (el.dataset.type === 'sheet') {
      const m = allMeta.find(x => x.id === el.dataset.id);
      el.addEventListener('mouseenter', e => {
        if (!m?.thumbnail) return;
        preview.innerHTML = `<img src="${m.thumbnail}" style="width:180px;border-radius:4px;display:block">
          <div style="font-size:0.75rem;font-weight:600;margin-top:5px;padding:0 2px">${escHtml(m.title)}</div>`;
        preview.style.display = 'block';
      });
      el.addEventListener('mousemove', e => {
        let left = e.clientX + 16, top = e.clientY - 20;
        if (left + 210 > window.innerWidth) left = e.clientX - 210;
        if (top + 260 > window.innerHeight) top = window.innerHeight - 270;
        preview.style.left = left + 'px'; preview.style.top = top + 'px';
      });
    }
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg3)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; preview.style.display = 'none'; });
    el.addEventListener('click', e => {
      if (e.target.closest('.sheet-del-btn') || e.target.closest('select')) return;
      if (el.dataset.type === 'chart') {
        goTo(7, { openDraftId: el.dataset.id });
      } else {
        openSheet(panel, el.dataset.id);
      }
    });
  });

  // 삭제 버튼
  list.querySelectorAll('.sheet-del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      if (type === 'chart') {
        const d = allDrafts.find(x => x.id === id);
        if (!confirm(`"${d?.title || id}" 차트를 삭제하시겠습니까?`)) return;
        const newDrafts = allDrafts.filter(x => x.id !== id);
        localStorage.setItem('gta_chart_drafts', JSON.stringify(newDrafts));
        // 폴더에서도 제거
        const fs = getSetlistFolders();
        fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== id); });
        saveSetlistFolders(fs);
        loadList(panel); renderFolderTree(panel);
      } else {
        const m = allMeta.find(x => x.id === id);
        if (!confirm(`"${m?.title || id}" 을 삭제하시겠습니까?`)) return;
        await deleteSheetItem(id, panel);
        // 폴더에서도 제거
        const fs = getSetlistFolders();
        fs.forEach(f => { f.songs = (f.songs||[]).filter(s => s.id !== id); });
        saveSetlistFolders(fs);
        renderFolderTree(panel);
      }
    });
  });

  panel.addEventListener('panel-hide', () => preview.remove(), { once: true });
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
