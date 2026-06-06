// 선택적 Firebase 클라우드 동기화 모듈
// Settings에서 Firebase config + 동기화 키를 설정하면 활성화됨

let _db = null, _storage = null, _sdk = null;

export function getConfig() {
  try { return JSON.parse(localStorage.getItem('gta_firebase_cfg') || 'null'); }
  catch { return null; }
}
export function saveConfig(str) { localStorage.setItem('gta_firebase_cfg', str); }

export function getSyncKey() {
  return (JSON.parse(localStorage.getItem('gta_settings') || '{}')).syncKey || '';
}

export function isReady() { return !!((_db && _storage) && getSyncKey()); }

const FB = v => `https://www.gstatic.com/firebasejs/${v}`;
const VER = '10.12.2';

export async function connect() {
  const cfg = getConfig();
  const key = getSyncKey();
  if (!cfg) return { ok: false, error: 'Firebase 설정이 없습니다.' };
  if (!key) return { ok: false, error: '동기화 키가 없습니다.' };
  try {
    const [appMod, dbMod, stMod] = await Promise.all([
      import(`${FB(VER)}/firebase-app.js`),
      import(`${FB(VER)}/firebase-firestore.js`),
      import(`${FB(VER)}/firebase-storage.js`),
    ]);
    const existing = appMod.getApps().find(a => a.name === 'gta');
    const app = existing || appMod.initializeApp(cfg, 'gta');
    _db = dbMod.getFirestore(app);
    _storage = stMod.getStorage(app);
    _sdk = { ...dbMod, ...stMod };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 악보 한 건 업로드 (원본 파일 + 페이지 이미지 + 메타데이터)
export async function pushSheet(id, file, pages, meta) {
  if (!isReady()) return;
  const key = getSyncKey();
  const { ref, uploadBytes, getDownloadURL, doc, setDoc } = _sdk;

  const fileRef = ref(_storage, `${key}/${id}/file`);
  await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
  const fileUrl = await getDownloadURL(fileRef);

  const pagesUrls = [];
  for (let i = 0; i < (pages?.length || 0); i++) {
    const pRef = ref(_storage, `${key}/${id}/p${i}`);
    await uploadBytes(pRef, pages[i], { contentType: 'image/jpeg' });
    pagesUrls.push(await getDownloadURL(pRef));
  }

  // Blob 필드 제거 후 저장
  const { thumbnail, pages: _p, ...safeMeta } = meta;
  await setDoc(doc(_db, `gta/${key}/sheets`, id), {
    ...safeMeta, id, fileUrl, pagesUrls, syncedAt: Date.now()
  });
}

// 원격 전체 메타 목록 가져오기
export async function pullAll() {
  if (!isReady()) return null;
  const key = getSyncKey();
  const { collection, getDocs } = _sdk;
  try {
    const snap = await getDocs(collection(_db, `gta/${key}/sheets`));
    return snap.docs.map(d => d.data());
  } catch (e) { console.error('pullAll:', e); return null; }
}

// 원격에서 파일 Blob 다운로드
export async function fetchBlob(url, mime) {
  const r = await fetch(url);
  const buf = await r.arrayBuffer();
  return new Blob([buf], { type: mime });
}

// 원격 악보 삭제
export async function removeSheet(id) {
  if (!isReady()) return;
  const key = getSyncKey();
  const { doc, deleteDoc, ref, deleteObject } = _sdk;
  try { await deleteDoc(doc(_db, `gta/${key}/sheets`, id)); } catch {}
  try { await deleteObject(ref(_storage, `${key}/${id}/file`)); } catch {}
  for (let i = 0; i < 40; i++) {
    try { await deleteObject(ref(_storage, `${key}/${id}/p${i}`)); }
    catch { break; }
  }
}
