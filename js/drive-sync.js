// 구글 드라이브 클라우드 동기화 모듈 (Supabase/Firebase 대체)
// Google Identity Services로 OAuth 토큰을 받고, Drive REST API v3를 fetch로 직접 호출한다.
// scope: drive.file (앱이 만든 파일만 접근 — 사용자가 드라이브에서 직접 확인/백업 가능)

import { showToast } from './chart.js';

const CLIENT_ID = '720647521956-qveh2b5703c7fphf9g8l5uct6mc9v454.apps.googleusercontent.com';
const API_KEY = 'AIzaSyA41VqbAlZ1UmmN9RjJkeqBvj5HPz9MV4o';
const APP_ID = '720647521956';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = '기타이론';
const DATA_FILE_NAME = 'guitar-theory-data.json';

const JSON_DATA_KEYS = ['gta_chart_drafts', 'gta_setlists', 'gta_sheet_meta', 'gta_settings', 'gta_custom_themes'];
const RAW_DATA_KEYS = ['gta_gemini_key', 'gta_live_zoom', 'gta_live_chordscale', 'gta_live_chordweight', 'gta_live_rotation'];
export const DATA_KEYS = [...JSON_DATA_KEYS, ...RAW_DATA_KEYS];

let _token = null;       // 메모리 보관 (새로고침 시 소멸 → 자동 재인증)
let _tokenClient = null;
let _folderId = null;
let _dataFileId = null;

export function isReady() { return !!_token; }
export function isLoggedIn() { return localStorage.getItem('gta_drive_logged_in') === '1'; }

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Google Identity Services 로드 실패'));
    document.head.appendChild(s);
  });
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    _tokenClient.callback = res => {
      if (res.error) { reject(new Error(res.error)); return; }
      _token = res.access_token;
      localStorage.setItem('gta_drive_logged_in', '1');
      resolve(_token);
    };
    _tokenClient.requestAccessToken({ prompt });
  });
}

// 로그인 (버튼 클릭 등 사용자 동작에서 호출) — prompt로 계정 선택창 표시
export async function connect() {
  try {
    await loadGis();
    if (!_tokenClient) {
      _tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {},
      });
    }
    const wasLoggedIn = isLoggedIn();
    await requestToken(wasLoggedIn ? '' : 'consent');
    await ensureFolder();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function signOut() {
  if (_token) window.google?.accounts?.oauth2?.revoke(_token, () => {});
  _token = null;
  _folderId = null;
  _dataFileId = null;
  localStorage.removeItem('gta_drive_logged_in');
  localStorage.removeItem('gta_drive_folder_id');
}

async function driveFetch(url, options = {}) {
  if (!_token) throw new Error('로그인이 필요합니다.');
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${_token}` },
  });
  if (res.status === 401) {
    // 토큰 만료 → 조용히 재요청 후 1회 재시도
    await requestToken('');
    return driveFetch(url, options);
  }
  if (!res.ok) throw new Error(`Drive API 오류 (${res.status}): ${await res.text()}`);
  return res;
}

async function findOrCreateFolder(name, parentId) {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`);
  const searchRes = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
  const { files } = await searchRes.json();
  if (files?.length) return files[0].id;

  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await createRes.json()).id;
}

// 루트에 '기타이론' 폴더를 만든다. 사장님이 드라이브에서 원하는 위치로 옮겨도
// 폴더 ID는 그대로라 계속 동작한다.
async function ensureFolder() {
  if (_folderId) return _folderId; // 이번 세션에서 이미 확인함

  const cached = localStorage.getItem('gta_drive_folder_id');
  if (cached) {
    // 캐시된 폴더가 삭제/휴지통행 됐을 수 있으니 실제 존재 여부 확인
    try {
      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${cached}?fields=id,trashed`);
      const { trashed } = await res.json();
      if (trashed) throw new Error('폴더가 휴지통에 있음');
      _folderId = cached;
      return _folderId;
    } catch (e) {
      localStorage.removeItem('gta_drive_folder_id');
      showToast('드라이브 폴더를 찾을 수 없어 다시 만듭니다.');
    }
  }

  _folderId = await findOrCreateFolder(FOLDER_NAME, null);
  localStorage.setItem('gta_drive_folder_id', _folderId);
  return _folderId;
}

async function findFileByName(name) {
  const q = encodeURIComponent(`name='${name}' and '${_folderId}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`);
  const { files } = await res.json();
  return files?.[0] || null;
}

// appProperties(sheetId)로 찾는다 — 파일 이름이 곡 제목으로 바뀌어도, 사장님이 이름을 바꿔도 안 깨진다.
async function findFileBySheetId(id) {
  const q = encodeURIComponent(`appProperties has { key='sheetId' and value='${id}' } and '${_folderId}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
  const { files } = await res.json();
  return files?.[0] || null;
}

// 파일 확장자를 원본 파일명/타입에서 뽑는다 (드라이브 미리보기가 확장자에 의존함)
function extOf(file) {
  const fromName = /\.[^.]+$/.exec(file?.name || '')?.[0];
  if (fromName) return fromName;
  if (file?.type === 'application/pdf') return '.pdf';
  if (file?.type === 'image/png') return '.png';
  if (file?.type === 'image/jpeg') return '.jpg';
  return '';
}

async function uploadJson(fileId, name, data) {
  const metadata = { name, parents: fileId ? undefined : [_folderId] };
  const boundary = 'gta-boundary';
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;
  const res = await driveFetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json(); // { id, modifiedTime }
}

// 이 기기가 마지막으로 받아간 데이터 파일의 수정 시각 (덮어쓰기 충돌 감지용)
const LAST_MODIFIED_KEY = 'gta_drive_last_modified';

// ── 앱 데이터 (localStorage 전체) ──
// force=true면 충돌 확인 없이 무조건 덮어쓴다 (사장님이 "덮어쓰기"를 선택했을 때)
export async function pushAll({ force = false, skipOnConflict = false } = {}) {
  await ensureFolder();
  const data = {};
  for (const k of JSON_DATA_KEYS) {
    const raw = localStorage.getItem(k);
    if (raw !== null) data[k] = JSON.parse(raw);
  }
  for (const k of RAW_DATA_KEYS) {
    const raw = localStorage.getItem(k);
    if (raw !== null) data[k] = raw;
  }
  if (!_dataFileId) {
    const existing = await findFileByName(DATA_FILE_NAME);
    _dataFileId = existing?.id || null;
  }

  // 다른 기기가 이 기기 모르게 더 최신 데이터를 올려뒀는지 확인 (기존 파일이 있을 때만)
  if (_dataFileId && !force) {
    const lastKnown = localStorage.getItem(LAST_MODIFIED_KEY);
    if (lastKnown) {
      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${_dataFileId}?fields=modifiedTime`);
      const { modifiedTime } = await res.json();
      if (modifiedTime && modifiedTime !== lastKnown) {
        if (skipOnConflict) { console.warn('드라이브에 더 최신 데이터가 있어 덮어쓰기를 건너뜀'); return; }
        const pullInstead = confirm(
          '드라이브에 이 기기가 아직 받지 않은 최신 데이터가 있습니다.\n' +
          '확인 = 드라이브 데이터를 받아옵니다 (이 기기의 편집 내용은 버려짐)\n' +
          '취소 = 이 기기 데이터로 드라이브를 덮어씁니다'
        );
        if (pullInstead) {
          await pullAll();
          showToast('드라이브 데이터를 받아왔습니다.');
          return;
        }
      }
    }
  }

  const uploaded = await uploadJson(_dataFileId, DATA_FILE_NAME, data);
  _dataFileId = uploaded.id;
  if (uploaded.modifiedTime) localStorage.setItem(LAST_MODIFIED_KEY, uploaded.modifiedTime);
}

// 원격 데이터를 로컬에 적용 — 에코 루프 방지 플래그는 app.js의 setItem 패치가 확인
function applyRemote(key, value) {
  window.__gtaApplyingRemote = true;
  try {
    if (RAW_DATA_KEYS.includes(key)) localStorage.setItem(key, value ?? '');
    else localStorage.setItem(key, JSON.stringify(value));
  } finally { window.__gtaApplyingRemote = false; }
}

export async function pullAll() {
  await ensureFolder();
  const existing = await findFileByName(DATA_FILE_NAME);
  if (!existing) return null;
  _dataFileId = existing.id;
  if (existing.modifiedTime) localStorage.setItem(LAST_MODIFIED_KEY, existing.modifiedTime);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  const data = await res.json();
  for (const [key, value] of Object.entries(data)) {
    if (DATA_KEYS.includes(key)) applyRemote(key, value);
  }
  return data;
}

// ── 악보 원본 파일 ──
async function uploadBinary(fileId, name, blob, appProperties) {
  const metadata = { name, parents: fileId ? undefined : [_folderId], appProperties };
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const boundary = 'gta-boundary';
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, blob, tail]);
  const res = await driveFetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()).id;
}

export async function pushSheetFile(id, file, meta) {
  await ensureFolder();
  const name = (meta?.title || `sheet-${id}`) + extOf(file);
  // appProperties(sheetId)로 찾는게 기본, 옛 sheet-<uuid> 이름 파일은 이름으로 폴백
  const existing = await findFileBySheetId(id) || await findFileByName(`sheet-${id}`);
  await uploadBinary(existing?.id || null, name, file, { sheetId: id });
}

// 옛 sheet-<uuid> 이름으로 남아있는 파일을 곡 제목으로 정리 (메타데이터만 PATCH, 재업로드 없음)
export async function renameLegacySheetFiles(onProgress) {
  await ensureFolder();
  const legacyQ = encodeURIComponent(`name contains 'sheet-' and '${_folderId}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${legacyQ}&fields=files(id,name,mimeType,appProperties)`);
  const { files } = await res.json();
  const legacy = (files || []).filter(f => !f.appProperties?.sheetId);
  const meta = JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]');

  let done = 0;
  for (const f of legacy) {
    onProgress?.(done, legacy.length);
    const id = f.name.replace(/^sheet-/, '').replace(/\.[^.]+$/, '');
    const item = meta.find(m => m.id === id);
    if (!item?.title) { done++; continue; } // 제목 못 찾으면 건드리지 않음
    const ext = extOf({ name: f.name }) || (f.mimeType === 'application/pdf' ? '.pdf' : f.mimeType === 'image/png' ? '.png' : f.mimeType === 'image/jpeg' ? '.jpg' : '');
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: item.title + ext, appProperties: { sheetId: id } }),
    });
    done++;
  }
  onProgress?.(done, legacy.length);
}

// title은 드라이브에서 이름이 곡 제목으로 바뀐 파일을 찾기 위한 마지막 수단
export async function pullSheetFile(id, title) {
  await ensureFolder();
  let existing = await findFileBySheetId(id) || await findFileByName(`sheet-${id}`);
  if (!existing && title) {
    for (const ext of ['.pdf', '.png', '.jpg', '']) {
      existing = await findFileByName(title + ext);
      if (existing) break;
    }
  }
  if (!existing) return null;
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  return res.blob();
}

export async function listSheetFiles() {
  await ensureFolder();
  const q = encodeURIComponent(`appProperties has { key='sheetId' } and '${_folderId}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,appProperties)`);
  const { files } = await res.json();
  const found = new Set();
  const result = (files || []).map(f => { found.add(f.appProperties.sheetId); return { id: f.appProperties.sheetId, driveId: f.id }; });

  // 옛 sheet-<uuid> 이름 파일 (appProperties 없음) 폴백
  const legacyQ = encodeURIComponent(`name contains 'sheet-' and '${_folderId}' in parents and trashed=false`);
  const legacyRes = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${legacyQ}&fields=files(id,name)`);
  const { files: legacyFiles } = await legacyRes.json();
  for (const f of legacyFiles || []) {
    const id = f.name.replace(/^sheet-/, '').replace(/\.[^.]+$/, '');
    if (!found.has(id)) result.push({ id, driveId: f.id });
  }
  return result;
}

// ── 구글 피커 (사장님이 직접 올려둔 임의 위치의 악보를 순서대로 고르기) ──
function loadPicker() {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => window.gapi.load('picker', { callback: resolve });
    s.onerror = () => reject(new Error('Google Picker 로드 실패'));
    document.head.appendChild(s);
  });
}

// 사용자가 고른 순서대로 { id, name, mimeType } 배열을 반환 (취소 시 빈 배열)
export async function pickFiles() {
  if (!_token) {
    const res = await connect();
    if (!res.ok) throw new Error(res.error);
  }
  await loadPicker();
  return new Promise((resolve, reject) => {
    try {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setMimeTypes('application/pdf,image/png,image/jpeg')
        .setSelectFolderEnabled(false);
      const picker = new google.picker.PickerBuilder()
        .setAppId(APP_ID)
        .setOAuthToken(_token)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback(data => {
          if (data.action === google.picker.Action.PICKED) {
            resolve(data.docs.map(d => ({ id: d.id, name: d.name, mimeType: d.mimeType })));
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve([]);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) { reject(e); }
  });
}

// 피커로 고른(=drive.file 접근권 부여된) 파일을 드라이브 파일 ID로 직접 내려받는다
export async function downloadFile(driveId) {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`);
  return res.blob();
}
