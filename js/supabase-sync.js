// Supabase 클라우드 동기화 모듈
// Firebase보다 설정이 간단 (URL + anon key 2개만 필요)
// ⚠️ 무료 플랜: 1주일 미사용 시 프로젝트 일시정지 (접속하면 즉시 재개)

let _client = null;

// 기본 내장 설정 — 어느 기기에서든 설정 입력 없이 자동 연결 (개인용)
const DEFAULT_CFG = {
  url: 'https://uzkkkmrddarjbevpevod.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6a2trbXJkZGFyamJldnBldm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzY0NzksImV4cCI6MjA5NjI1MjQ3OX0.ZeMKpta9fkVVXsRBlojQK2_eD5dVATitPTrSlPNanX0',
};
const DEFAULT_SYNC_KEY = 'jackson';

export function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('gta_supabase_cfg') || 'null');
    if (saved?.url && saved?.anonKey) return saved;
  } catch {}
  return DEFAULT_CFG;
}

export function saveConfig(url, anonKey) {
  localStorage.setItem('gta_supabase_cfg', JSON.stringify({ url, anonKey }));
}

export function getSyncKey() {
  return (JSON.parse(localStorage.getItem('gta_settings') || '{}')).syncKey || DEFAULT_SYNC_KEY;
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

// ── 앱 데이터 동기화 (gta_chart_drafts / gta_setlists / gta_sheet_meta) ──

const DATA_KEYS = ['gta_chart_drafts', 'gta_setlists', 'gta_sheet_meta'];

// 로컬 → Supabase
export async function pushData(dataKey) {
  if (!isReady()) return;
  const key = getSyncKey();
  const payload = JSON.parse(localStorage.getItem(dataKey) || 'null');
  const { error } = await _client.from('gta_data').upsert({
    sync_key: key,
    data_key: dataKey,
    payload,
    updated_at: Date.now(),
  });
  if (error) console.error('pushData error:', error.message);
}

export async function pushAllData() {
  for (const k of DATA_KEYS) await pushData(k);
}

// 원격 데이터를 로컬에 적을 때 자동 push(에코 루프) 방지 — app.js의 setItem 패치가 이 플래그를 확인
function applyRemote(dataKey, payload) {
  window.__gtaApplyingRemote = true;
  try { localStorage.setItem(dataKey, JSON.stringify(payload)); }
  finally { window.__gtaApplyingRemote = false; }
}

// Supabase → 로컬
export async function pullAllData() {
  if (!isReady()) return;
  const key = getSyncKey();
  const { data, error } = await _client
    .from('gta_data')
    .select('data_key, payload')
    .eq('sync_key', key);
  if (error) { console.error('pullAllData error:', error.message); return; }
  for (const row of (data || [])) {
    if (row.payload !== null) {
      applyRemote(row.data_key, row.payload);
    }
  }
}

// Supabase Realtime 구독 — 다른 기기가 변경하면 로컬에 즉시 반영
let _channel = null;
export function subscribeDataChanges(onUpdate) {
  if (!isReady() || _channel) return;
  const key = getSyncKey();
  _channel = _client
    .channel('gta_data_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'gta_data',
      filter: `sync_key=eq.${key}`,
    }, payload => {
      const row = payload.new;
      if (row?.data_key && row?.payload !== null) {
        applyRemote(row.data_key, row.payload);
        onUpdate?.(row.data_key);
      }
    })
    .subscribe();
}

export function unsubscribeDataChanges() {
  if (_channel) { _client.removeChannel(_channel); _channel = null; }
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
