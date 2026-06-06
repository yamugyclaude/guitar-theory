// Supabase 클라우드 동기화 모듈
// Firebase보다 설정이 간단 (URL + anon key 2개만 필요)
// ⚠️ 무료 플랜: 1주일 미사용 시 프로젝트 일시정지 (접속하면 즉시 재개)

let _client = null;

export function getConfig() {
  try { return JSON.parse(localStorage.getItem('gta_supabase_cfg') || 'null'); }
  catch { return null; }
}

export function saveConfig(url, anonKey) {
  localStorage.setItem('gta_supabase_cfg', JSON.stringify({ url, anonKey }));
}

export function getSyncKey() {
  return (JSON.parse(localStorage.getItem('gta_settings') || '{}')).syncKey || '';
}

export function isReady() { return !!(_client && getSyncKey()); }

export async function connect() {
  const cfg = getConfig();
  const key = getSyncKey();
  if (!cfg?.url || !cfg?.anonKey) return { ok: false, error: 'Supabase URL과 Key를 입력해주세요.' };
  if (!key) return { ok: false, error: '동기화 키가 없습니다.' };
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    _client = createClient(cfg.url, cfg.anonKey);
    // 연결 테스트
    const { error } = await _client.from('gta_sheets').select('id').limit(1);
    if (error && error.code !== 'PGRST116') return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 악보 업로드 (파일 + 페이지 이미지 + 메타)
export async function pushSheet(id, file, pages, meta) {
  if (!isReady()) return;
  const key = getSyncKey();

  // 원본 파일 → Storage
  const filePath = `${key}/${id}/file`;
  const { error: fErr } = await _client.storage
    .from('gta-sheets')
    .upload(filePath, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
  if (fErr) throw new Error('파일 업로드 실패: ' + fErr.message);

  const { data: { publicUrl: fileUrl } } = _client.storage.from('gta-sheets').getPublicUrl(filePath);

  // 페이지 이미지 → Storage
  const pagesUrls = [];
  for (let i = 0; i < (pages?.length || 0); i++) {
    const pagePath = `${key}/${id}/p${i}`;
    await _client.storage.from('gta-sheets').upload(pagePath, pages[i], { upsert: true, contentType: 'image/jpeg' });
    const { data: { publicUrl } } = _client.storage.from('gta-sheets').getPublicUrl(pagePath);
    pagesUrls.push(publicUrl);
  }

  // 메타데이터 → DB
  const { thumbnail, pages: _p, ...safeMeta } = meta;
  const { error: dbErr } = await _client.from('gta_sheets').upsert({
    ...safeMeta,
    id,
    sync_key: key,
    file_url: fileUrl,
    pages_urls: pagesUrls,
    synced_at: Date.now(),
  });
  if (dbErr) throw new Error('메타 저장 실패: ' + dbErr.message);
}

// 원격 전체 메타 가져오기
export async function pullAll() {
  if (!isReady()) return null;
  const key = getSyncKey();
  const { data, error } = await _client
    .from('gta_sheets')
    .select('*')
    .eq('sync_key', key);
  if (error) { console.error('pullAll:', error); return null; }
  // DB 컬럼명 → 앱 내부 필드명 변환
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    key: row.key,
    bpm: row.bpm,
    tags: row.tags || [],
    folder: row.folder || '',
    type: row.type,
    fileUrl: row.file_url,
    pagesUrls: row.pages_urls || [],
    createdAt: row.created_at,
  }));
}

// URL → Blob 다운로드
export async function fetchBlob(url, mime) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`다운로드 실패 (${r.status})`);
  const buf = await r.arrayBuffer();
  return new Blob([buf], { type: mime });
}

// 원격 악보 삭제
export async function removeSheet(id) {
  if (!isReady()) return;
  const key = getSyncKey();
  await _client.from('gta_sheets').delete().eq('id', id).eq('sync_key', key);
  // Storage 파일 일괄 삭제 (page 수 모르므로 넉넉하게)
  const paths = [`${key}/${id}/file`];
  for (let i = 0; i < 40; i++) paths.push(`${key}/${id}/p${i}`);
  await _client.storage.from('gta-sheets').remove(paths);
}
