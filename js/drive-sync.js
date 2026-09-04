// 구글 드라이브 악보 연동 (공개 공유 폴더 + Drive API 키, OAuth 없음)

export function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('gta_drive_cfg') || 'null');
    if (saved?.folderId && saved?.apiKey) return saved;
  } catch {}
  return null;
}

export function saveConfig(folderId, apiKey) {
  localStorage.setItem('gta_drive_cfg', JSON.stringify({ folderId, apiKey }));
}

// 폴더 내 파일 목록 조회 (id, name, mimeType, thumbnailLink)
export async function listFiles() {
  const cfg = getConfig();
  if (!cfg) throw new Error('구글 드라이브 폴더 ID와 API 키를 먼저 설정해주세요.');
  const params = new URLSearchParams({
    q: `'${cfg.folderId}' in parents and trashed=false`,
    key: cfg.apiKey,
    fields: 'files(id,name,mimeType,thumbnailLink)',
    pageSize: '100',
  });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  if (!r.ok) throw new Error(`드라이브 목록 조회 실패 (${r.status})`);
  const data = await r.json();
  return data.files || [];
}

// 파일 바이너리 다운로드 → Blob
export async function fetchBlob(fileId, mimeType) {
  const cfg = getConfig();
  if (!cfg) throw new Error('구글 드라이브 설정이 없습니다.');
  const params = new URLSearchParams({ alt: 'media', key: cfg.apiKey });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params}`);
  if (!r.ok) throw new Error(`드라이브 다운로드 실패 (${r.status})`);
  const buf = await r.arrayBuffer();
  return new Blob([buf], { type: mimeType || 'application/octet-stream' });
}
