// 구글 드라이브 클라우드 동기화 모듈 (Supabase/Firebase 대체)
// Google Identity Services로 OAuth 토큰을 받고, Drive REST API v3를 fetch로 직접 호출한다.
// scope: drive.file (앱이 만든 파일만 접근 — 사용자가 드라이브에서 직접 확인/백업 가능)

const CLIENT_ID = '';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = '기타이론';
const DATA_FILE_NAME = 'guitar-theory-data.json';

const JSON_DATA_KEYS = ['gta_chart_drafts', 'gta_setlists', 'gta_sheet_meta', 'gta_settings', 'gta_custom_themes'];
const RAW_DATA_KEYS = ['gta_gemini_key', 'gta_live_zoom', 'gta_live_chordscale', 'gta_live_chordweight'];
export const DATA_KEYS = [...JSON_DATA_KEYS, ...RAW_DATA_KEYS];

let _token = null;       // 메모리 보관 (새로고침 시 소멸 → 자동 재인증)
let _tokenClient = null;
let _folderId = null;
let _dataFileId = null;

export function getClientId() {
  return CLIENT_ID || localStorage.getItem('gta_drive_client_id') || '';
}
export function saveClientId(id) {
  localStorage.setItem('gta_drive_client_id', id);
}

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
  const clientId = getClientId();
  if (!clientId) return { ok: false, error: 'OAuth 클라이언트 ID를 먼저 입력해주세요.' };
  try {
    await loadGis();
    if (!_tokenClient || _tokenClient.__clientId !== clientId) {
      _tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: () => {},
      });
      _tokenClient.__clientId = clientId;
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

async function ensureFolder() {
  const cached = localStorage.getItem('gta_drive_folder_id');
  if (cached) { _folderId = cached; return _folderId; }

  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const searchRes = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`);
  const { files } = await searchRes.json();
  if (files?.length) {
    _folderId = files[0].id;
  } else {
    const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    _folderId = (await createRes.json()).id;
  }
  localStorage.setItem('gta_drive_folder_id', _folderId);
  return _folderId;
}

async function findFileByName(name) {
  const q = encodeURIComponent(`name='${name}' and '${_folderId}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
  const { files } = await res.json();
  return files?.[0] || null;
}

async function uploadJson(fileId, name, data) {
  const metadata = { name, parents: fileId ? undefined : [_folderId] };
  const boundary = 'gta-boundary';
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const res = await driveFetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()).id;
}

// ── 앱 데이터 (localStorage 전체) ──
export async function pushAll() {
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
  _dataFileId = await uploadJson(_dataFileId, DATA_FILE_NAME, data);
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
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  const data = await res.json();
  for (const [key, value] of Object.entries(data)) {
    if (DATA_KEYS.includes(key)) applyRemote(key, value);
  }
  return data;
}

// ── 악보 원본 파일 ──
async function uploadBinary(fileId, name, blob) {
  const metadata = { name, parents: fileId ? undefined : [_folderId] };
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
  const name = `sheet-${id}`;
  const existing = await findFileByName(name);
  await uploadBinary(existing?.id || null, name, file);
}

export async function pullSheetFile(id) {
  await ensureFolder();
  const existing = await findFileByName(`sheet-${id}`);
  if (!existing) return null;
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  return res.blob();
}

export async function listSheetFiles() {
  await ensureFolder();
  const q = encodeURIComponent(`name contains 'sheet-' and '${_folderId}' in parents and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
  const { files } = await res.json();
  return (files || []).map(f => ({ id: f.name.replace(/^sheet-/, ''), driveId: f.id }));
}
