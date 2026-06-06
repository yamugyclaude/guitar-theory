import { getAllSheets, saveSheet } from './db.js';

function getSettings() { return JSON.parse(localStorage.getItem('gta_settings') || '{}'); }
function saveSettings(s) { localStorage.setItem('gta_settings', JSON.stringify(s)); }

const THEMES = [
  { id: 'dark-pro',     label: '다크 프로' },
  { id: 'light-clean',  label: '라이트 클린' },
  { id: 'blue-jazz',    label: '블루 재즈' },
  { id: 'vintage-amp',  label: '빈티지 앰프' },
  { id: 'forest',       label: '포레스트' },
  { id: 'neon-fusion',  label: '네온 퓨전' },
  { id: 'sunset-rock',  label: '선셋 록' },
  { id: 'paper',        label: '페이퍼' },
];

export function render(panel) {
  const s = getSettings();
  const curTheme = s.theme || 'dark-pro';
  const curSize = s.fontSize || 16;
  const curLeft = s.leftHanded || false;
  const fbCfgStr = localStorage.getItem('gta_firebase_cfg') || '';
  const syncKey = s.syncKey || '';

  panel.innerHTML = `
    <h1 class="page-title">⚙️ 설정</h1>

    <div class="card">
      <div class="section-label">테마</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:8px">
        ${THEMES.map(t => `
          <button class="btn ${t.id === curTheme ? 'btn-primary' : 'btn-secondary'} theme-btn" data-theme="${t.id}" style="padding:10px 8px">
            ${t.label}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-label">폰트 크기</div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
        <input type="range" id="font-range" min="13" max="20" value="${curSize}" style="flex:1">
        <span id="font-val" style="min-width:32px;text-align:center">${curSize}px</span>
      </div>
    </div>

    <div class="card">
      <div class="section-label">기타 설정</div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:8px">
        <input type="checkbox" id="lefthanded-chk" ${curLeft ? 'checked' : ''}>
        <span>왼손잡이 코드 다이어그램</span>
      </label>
    </div>

    <div class="card">
      <div class="section-label">데이터 백업 / 복원</div>
      <p style="font-size:0.82rem;color:var(--text2);margin-bottom:12px">
        iOS Safari는 7일 미사용 시 데이터가 삭제될 수 있습니다. 정기적으로 백업을 권장합니다.
      </p>
      <div class="btn-row">
        <button class="btn btn-primary" id="export-btn">전체 내보내기 (JSON)</button>
        <button class="btn btn-secondary" id="import-btn">가져오기 (JSON)</button>
        <input type="file" id="import-file" accept=".json" style="display:none">
      </div>
    </div>

    <div class="card">
      <div class="section-label">☁️ 클라우드 동기화 (Firebase)</div>
      <p style="font-size:0.82rem;color:var(--text2);margin:8px 0 12px">
        모든 기기에서 같은 악보를 공유하려면 Firebase 무료 프로젝트를 연결하세요.<br>
        <strong>설정 방법:</strong><br>
        1. <a href="https://console.firebase.google.com" target="_blank" style="color:var(--link)">Firebase Console</a> → 새 프로젝트 생성<br>
        2. 프로젝트 설정 → 앱 추가(웹) → 아래 JSON 복사하여 붙여넣기<br>
        3. Firestore Database 생성 (테스트 모드)<br>
        4. Storage 생성 (테스트 모드)<br>
        5. 동기화 키: 같은 키를 쓰는 기기끼리 데이터를 공유합니다
      </p>
      <div class="label">Firebase 설정 JSON</div>
      <textarea id="fb-config" rows="5" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'
        style="font-size:0.75rem;font-family:monospace;resize:vertical">${fbCfgStr}</textarea>
      <div class="label" style="margin-top:10px">동기화 키 (비밀번호처럼 사용 — 같은 키 = 같은 데이터)</div>
      <input type="text" id="sync-key" placeholder="예: myband2024" value="${syncKey}" style="max-width:300px">
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-primary" id="fb-save-btn">저장 및 연결 테스트</button>
        <button class="btn btn-secondary" id="fb-clear-btn">연동 해제</button>
      </div>
      <div id="fb-status" style="font-size:0.82rem;margin-top:8px;color:var(--text2)"></div>
    </div>

    <div class="card" style="border-color:var(--danger)">
      <div class="section-label" style="color:var(--danger)">위험 영역</div>
      <button class="btn" id="reset-btn" style="background:var(--danger);color:#fff;margin-top:8px">전체 데이터 초기화</button>
    </div>
  `;

  // 테마
  panel.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.documentElement.dataset.theme = theme;
      const s = getSettings(); s.theme = theme; saveSettings(s);
      panel.querySelectorAll('.theme-btn').forEach(b => {
        b.className = `btn ${b.dataset.theme === theme ? 'btn-primary' : 'btn-secondary'} theme-btn`;
      });
    });
  });

  // 폰트
  panel.querySelector('#font-range').addEventListener('input', e => {
    const v = Number(e.target.value);
    document.documentElement.style.fontSize = v + 'px';
    panel.querySelector('#font-val').textContent = v + 'px';
    const s = getSettings(); s.fontSize = v; saveSettings(s);
  });

  // 왼손잡이
  panel.querySelector('#lefthanded-chk').addEventListener('change', e => {
    const s = getSettings(); s.leftHanded = e.target.checked; saveSettings(s);
  });

  // 내보내기
  panel.querySelector('#export-btn').addEventListener('click', exportData);

  // 가져오기
  panel.querySelector('#import-btn').addEventListener('click', () => panel.querySelector('#import-file').click());
  panel.querySelector('#import-file').addEventListener('change', e => importData(e.target.files[0]));

  // Firebase 설정 저장 + 연결 테스트
  panel.querySelector('#fb-save-btn').addEventListener('click', async () => {
    const cfgStr = panel.querySelector('#fb-config').value.trim();
    const key = panel.querySelector('#sync-key').value.trim();
    const status = panel.querySelector('#fb-status');
    if (!cfgStr || !key) { status.textContent = '⚠️ Firebase 설정과 동기화 키를 모두 입력해주세요.'; return; }
    try { JSON.parse(cfgStr); } catch { status.textContent = '⚠️ 올바른 JSON 형식이 아닙니다.'; return; }
    const { saveConfig, connect } = await import('./firebase-sync.js');
    saveConfig(cfgStr);
    const s = getSettings(); s.syncKey = key; saveSettings(s);
    status.textContent = '🔄 연결 중...';
    const res = await connect();
    status.textContent = res.ok ? '✅ 연결 성공! 악보 탭에서 동기화 버튼을 사용하세요.' : `❌ 연결 실패: ${res.error}`;
  });

  panel.querySelector('#fb-clear-btn').addEventListener('click', () => {
    if (!confirm('Firebase 연동을 해제하시겠습니까?')) return;
    localStorage.removeItem('gta_firebase_cfg');
    const s = getSettings(); delete s.syncKey; saveSettings(s);
    panel.querySelector('#fb-config').value = '';
    panel.querySelector('#sync-key').value = '';
    panel.querySelector('#fb-status').textContent = '연동이 해제되었습니다.';
  });

  // 초기화
  panel.querySelector('#reset-btn').addEventListener('click', () => {
    if (!confirm('정말 전체 데이터를 삭제하시겠습니까?')) return;
    if (!confirm('이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
    ['gta_settings','gta_sheet_meta','gta_folders','gta_setlists','gta_chart_drafts','gta_last_backup','gta_current_analysis']
      .forEach(k => localStorage.removeItem(k));
    indexedDB.deleteDatabase('GuitarTheoryApp');
    alert('초기화 완료. 페이지를 새로고침합니다.');
    location.reload();
  });
}

async function exportData() {
  const sheets = await getAllSheets();
  const meta = JSON.parse(localStorage.getItem('gta_sheet_meta') || '[]');
  const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
  const drafts = JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]');
  const settings = JSON.parse(localStorage.getItem('gta_settings') || '{}');

  // Blob을 base64로
  const sheetsEncoded = await Promise.all(sheets.map(async s => {
    const buf = await s.file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const thumbBuf = s.thumbnail ? await s.thumbnail.arrayBuffer() : null;
    const thumbB64 = thumbBuf ? btoa(String.fromCharCode(...new Uint8Array(thumbBuf))) : null;
    return { ...s, file: b64, fileType: s.file.type, thumbnail: thumbB64, thumbType: s.thumbnail?.type };
  }));

  const data = { version: 1, exportedAt: new Date().toISOString(), meta, setlists, drafts, settings, sheets: sheetsEncoded };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `gta-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);

  localStorage.setItem('gta_last_backup', new Date().toISOString());
  alert('백업 완료!');
}

async function importData(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.version !== 1) { alert('지원하지 않는 백업 파일 형식입니다.'); return; }
    if (!confirm('현재 데이터를 덮어씁니다. 계속하시겠습니까?')) return;

    localStorage.setItem('gta_sheet_meta', JSON.stringify(data.meta || []));
    localStorage.setItem('gta_setlists', JSON.stringify(data.setlists || []));
    localStorage.setItem('gta_chart_drafts', JSON.stringify(data.drafts || []));
    localStorage.setItem('gta_settings', JSON.stringify(data.settings || {}));
    localStorage.setItem('gta_last_backup', new Date().toISOString());

    for (const s of (data.sheets || [])) {
      const bin = atob(s.file);
      const arr = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
      const blob = new Blob([arr], { type: s.fileType });
      let thumb = null;
      if (s.thumbnail) {
        const tb = atob(s.thumbnail);
        const ta = new Uint8Array(tb.length).map((_, i) => tb.charCodeAt(i));
        thumb = new Blob([ta], { type: s.thumbType });
      }
      await saveSheet({ id: s.id, file: blob, type: s.type, thumbnail: thumb, createdAt: s.createdAt });
    }

    alert('가져오기 완료! 페이지를 새로고침합니다.');
    location.reload();
  } catch (e) {
    alert('가져오기 실패: ' + e.message);
  }
}
