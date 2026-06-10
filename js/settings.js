import { getAllSheets, saveSheet } from './db.js';

function getSettings() { return JSON.parse(localStorage.getItem('gta_settings') || '{}'); }
function saveSettings(s) { localStorage.setItem('gta_settings', JSON.stringify(s)); }

// ===== 커스텀 테마 =====
const THEME_VARS = [
  { key: 'bg',      label: '배경' },
  { key: 'bg2',     label: '카드 배경' },
  { key: 'bg3',     label: '입력 배경' },
  { key: 'border',  label: '테두리' },
  { key: 'text',    label: '텍스트' },
  { key: 'text2',   label: '보조 텍스트' },
  { key: 'accent',  label: '강조색' },
  { key: 'accent2', label: '강조색2' },
  { key: 'danger',  label: '위험색' },
];

function getCustomThemes() { return JSON.parse(localStorage.getItem('gta_custom_themes') || '[]'); }
function setCustomThemes(t) { localStorage.setItem('gta_custom_themes', JSON.stringify(t)); }

function getCurrentVars() {
  const style = getComputedStyle(document.documentElement);
  const result = {};
  THEME_VARS.forEach(({ key }) => {
    const val = style.getPropertyValue(`--${key}`).trim();
    result[key] = val || '#000000';
  });
  return result;
}

function cssColorToHex(color) {
  // rgba(r,g,b,...) 또는 #hex 처리
  if (!color) return '#000000';
  if (color.startsWith('#')) {
    if (color.length === 4) return '#' + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
    return color.substring(0, 7);
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return '#888888';
}

export function applyCustomThemeVars(vars) {
  THEME_VARS.forEach(({ key }) => {
    if (vars[key]) document.documentElement.style.setProperty(`--${key}`, vars[key]);
  });
}

export function clearCustomThemeVars() {
  THEME_VARS.forEach(({ key }) => {
    document.documentElement.style.removeProperty(`--${key}`);
  });
}

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
  const fbCfgStr = ''; // Firebase 제거됨 (Supabase로 대체)
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
      <div class="section-label">커스텀 테마 색상</div>
      <p style="font-size:0.78rem;color:var(--text2);margin-bottom:10px">색상을 바꾸면 즉시 적용됩니다. 저장하면 이름으로 불러올 수 있습니다.</p>
      <div id="custom-theme-vars" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:12px">
        ${THEME_VARS.map(({ key, label }) => `
          <div style="display:flex;align-items:center;gap:6px">
            <input type="color" class="custom-var-input" data-key="${key}" value="#000000"
              style="width:32px;height:28px;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:1px;flex-shrink:0">
            <span style="font-size:0.78rem">${label}</span>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
        <button class="btn btn-secondary" id="theme-reset-btn" style="font-size:0.78rem;padding:5px 10px">↩ 기본 복원</button>
        <input type="text" id="custom-theme-name" placeholder="테마 이름" style="flex:1;min-width:100px;font-size:0.8rem;padding:5px 8px">
        <button class="btn btn-primary" id="theme-save-btn" style="font-size:0.78rem;padding:5px 10px">💾 저장</button>
      </div>
      <div id="saved-themes-list" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>

    <div class="card">
      <div class="section-label">폰트 크기</div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
        <input type="range" id="font-range" min="13" max="20" value="${curSize}" style="flex:1">
        <span id="font-val" style="min-width:32px;text-align:center">${curSize}px</span>
      </div>
    </div>

    <div class="card">
      <div class="section-label">목록 레이아웃</div>
      <p style="font-size:0.78rem;color:var(--text2);margin:6px 0 12px">악보 · 곡진행 탭의 목록 표시 방식을 선택합니다.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px" id="layout-btns">
        ${[
          { id:'list-b', label:'사이드바', desc:'컬러 구분선' },
          { id:'list-c', label:'타이포', desc:'텍스트 중심' },
          { id:'list-d', label:'테이블', desc:'컴팩트 표' },
        ].map(l => `
          <button class="layout-btn" data-layout="${l.id}" style="border:2px solid ${(s.layoutStyle||'list-b')===l.id?'var(--accent)':'var(--border)'};
            background:${(s.layoutStyle||'list-b')===l.id?'var(--bg3)':'var(--bg2)'};
            border-radius:10px;padding:12px 6px;cursor:pointer;color:var(--text);transition:all 0.15s;text-align:center">
            <div style="font-size:0.78rem;font-weight:700">${l.label}</div>
            <div style="font-size:0.65rem;color:var(--text2);margin-top:3px">${l.desc}</div>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-label">마디 표시 (곡진행 · 라이브)</div>
      <p style="font-size:0.78rem;color:var(--text2);margin:6px 0 12px">코드차트에서 한 마디를 그리는 방식을 선택합니다.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px" id="barstyle-btns">
        ${[
          { id:'slots',     label:'4분할',   desc:'박 구분선 표시' },
          { id:'leadsheet', label:'리드시트', desc:'빈 박은 ／ 슬래시' },
          { id:'minimal',   label:'심플',    desc:'코드만 깔끔하게' },
        ].map(l => `
          <button class="barstyle-btn" data-barstyle="${l.id}" style="border:2px solid ${(s.barStyle||'slots')===l.id?'var(--accent)':'var(--border)'};
            background:${(s.barStyle||'slots')===l.id?'var(--bg3)':'var(--bg2)'};
            border-radius:10px;padding:12px 6px;cursor:pointer;color:var(--text);transition:all 0.15s;text-align:center">
            <div style="font-size:0.78rem;font-weight:700">${l.label}</div>
            <div style="font-size:0.65rem;color:var(--text2);margin-top:3px">${l.desc}</div>
          </button>
        `).join('')}
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
      <div class="section-label">🤖 AI 악보 분석</div>
      <p style="font-size:0.82rem;color:var(--text2);margin:8px 0 12px">
        악보 이미지를 업로드하면 곡명·키·BPM·코드진행을 자동으로 분석합니다.<br>
        <strong>완전 무료 · 카드 불필요</strong> —
        🔵 <strong>Gemini (권장)</strong>: <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--link)">aistudio.google.com/apikey</a> → Create API key in new project<br>
        🟠 <strong>OpenRouter</strong>: <a href="https://openrouter.ai" target="_blank" style="color:var(--link)">openrouter.ai</a> → Keys → Create Key<br>
        두 키 모두 지원됩니다. 키는 이 기기에만 저장됩니다.
      </p>
      <div class="label">AI API Key (Gemini: AIza… / OpenRouter: sk-or-…)</div>
      <div style="display:flex;gap:8px">
        <input type="password" id="gemini-key-input" placeholder="AIza... 또는 sk-or-..." value="${localStorage.getItem('gta_gemini_key')||''}" style="flex:1">
        <button class="btn btn-secondary" id="gemini-toggle-btn" style="flex-shrink:0;font-size:0.75rem;padding:6px 10px">보기</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-primary" id="gemini-save-btn">저장</button>
        <button class="btn btn-secondary" id="gemini-test-btn">연결 테스트</button>
        <button class="btn btn-secondary" id="gemini-clear-btn">삭제</button>
      </div>
      <div id="gemini-status" style="font-size:0.82rem;margin-top:6px;color:var(--text2)">
        ${localStorage.getItem('gta_gemini_key') ? '✅ API 키 저장됨' : '키 미설정'}
      </div>
    </div>

    <div class="card">
      <div class="section-label">☁️ 클라우드 동기화 (Supabase)</div>
      <p style="font-size:0.82rem;color:var(--text2);margin:8px 0 4px">
        모든 기기에서 같은 악보를 공유할 수 있습니다. <strong>무료</strong>이며 URL + Key 2개만 입력하면 됩니다.<br>
        ⚠️ 무료 플랜은 1주일 미사용 시 일시정지 (접속하면 즉시 재개됨)
      </p>
      <details style="margin-bottom:12px">
        <summary style="cursor:pointer;font-size:0.82rem;color:var(--link);padding:6px 0">📋 설정 방법 펼치기</summary>
        <div style="font-size:0.8rem;line-height:1.9;padding:10px;background:var(--bg3);border-radius:var(--radius);margin-top:6px">
          <strong>① <a href="https://supabase.com" target="_blank" style="color:var(--link)">supabase.com</a></strong> → 무료 가입 → New Project<br>
          <strong>② Settings → API</strong> → Project URL과 anon public key 복사<br>
          <strong>③ SQL Editor</strong> → 아래 SQL 복사 후 실행:<br>
          <pre style="background:var(--bg);padding:8px;border-radius:4px;font-size:0.72rem;overflow-x:auto;margin:6px 0">create table if not exists gta_sheets (
  id text primary key,
  sync_key text not null,
  title text, artist text, key text,
  bpm text, tags jsonb default '[]',
  folder text default '', type text,
  file_url text, pages_urls jsonb default '[]',
  created_at bigint, synced_at bigint
);
alter table gta_sheets enable row level security;
create policy "allow_all" on gta_sheets
  for all using (true) with check (true);</pre>
          <strong>④ Storage</strong> → New bucket → 이름: <code>gta-sheets</code> → <strong>Public 체크</strong> → Create
        </div>
      </details>
      <div class="label">Project URL</div>
      <input type="text" id="sb-url" placeholder="https://xxxxxxxxxxxx.supabase.co" value="${JSON.parse(localStorage.getItem('gta_supabase_cfg')||'{}').url||''}">
      <div class="label" style="margin-top:8px">anon public key</div>
      <input type="text" id="sb-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${JSON.parse(localStorage.getItem('gta_supabase_cfg')||'{}').anonKey||''}" style="font-size:0.72rem">
      <div class="label" style="margin-top:8px">동기화 키 (같은 키를 입력한 기기끼리 데이터 공유)</div>
      <input type="text" id="sync-key" placeholder="예: myband2024" value="${syncKey}" style="max-width:260px">
      <div class="btn-row" style="margin-top:10px">
        <button class="btn btn-primary" id="sb-save-btn">저장 및 연결 테스트</button>
        <button class="btn btn-secondary" id="sb-clear-btn">연동 해제</button>
      </div>
      <div id="sb-status" style="font-size:0.82rem;margin-top:8px;color:var(--text2)"></div>
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
      clearCustomThemeVars(); // 프리셋 테마 선택 시 커스텀 변수 초기화
      const s = getSettings(); s.theme = theme; s.customTheme = null; saveSettings(s);
      panel.querySelectorAll('.theme-btn').forEach(b => {
        b.className = `btn ${b.dataset.theme === theme ? 'btn-primary' : 'btn-secondary'} theme-btn`;
      });
      refreshCustomVarInputs(); // 색상 입력값 갱신
    });
  });

  // ── 커스텀 테마 ──
  function refreshCustomVarInputs() {
    const vars = getCurrentVars();
    panel.querySelectorAll('.custom-var-input').forEach(inp => {
      inp.value = cssColorToHex(vars[inp.dataset.key]);
    });
  }
  refreshCustomVarInputs();

  function renderSavedThemes() {
    const themes = getCustomThemes();
    const list = panel.querySelector('#saved-themes-list');
    if (!list) return;
    list.innerHTML = themes.length ? themes.map((t, i) => `
      <div style="display:flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px">
        <div style="display:flex;gap:2px;margin-right:2px">
          ${Object.values(t.vars).slice(0,5).map(c => `<div style="width:8px;height:8px;border-radius:50%;background:${c}"></div>`).join('')}
        </div>
        <span style="font-size:0.78rem;font-weight:600;cursor:pointer" class="load-theme-btn" data-idx="${i}">${t.name}</span>
        <button class="del-theme-btn" data-idx="${i}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.8rem;padding:0 2px;margin-left:2px">×</button>
      </div>
    `).join('') : '<span style="font-size:0.75rem;color:var(--text2)">저장된 테마 없음</span>';

    list.querySelectorAll('.load-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = getCustomThemes()[+btn.dataset.idx];
        if (!t) return;
        applyCustomThemeVars(t.vars);
        const s = getSettings(); s.customTheme = t.name; saveSettings(s);
        refreshCustomVarInputs();
      });
    });
    list.querySelectorAll('.del-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const themes = getCustomThemes();
        themes.splice(+btn.dataset.idx, 1);
        setCustomThemes(themes);
        renderSavedThemes();
      });
    });
  }
  renderSavedThemes();

  // 색상 변경 → 즉시 적용
  panel.querySelectorAll('.custom-var-input').forEach(inp => {
    inp.addEventListener('input', () => {
      document.documentElement.style.setProperty(`--${inp.dataset.key}`, inp.value);
    });
  });

  // 기본 복원
  panel.querySelector('#theme-reset-btn').addEventListener('click', () => {
    clearCustomThemeVars();
    const s = getSettings(); s.customTheme = null; saveSettings(s);
    refreshCustomVarInputs();
  });

  // 저장
  panel.querySelector('#theme-save-btn').addEventListener('click', () => {
    const name = panel.querySelector('#custom-theme-name').value.trim();
    if (!name) { alert('테마 이름을 입력해주세요.'); return; }
    const vars = {};
    panel.querySelectorAll('.custom-var-input').forEach(inp => { vars[inp.dataset.key] = inp.value; });
    const themes = getCustomThemes();
    const existing = themes.findIndex(t => t.name === name);
    if (existing >= 0) themes[existing] = { name, vars };
    else themes.push({ name, vars });
    setCustomThemes(themes);
    const s = getSettings(); s.customTheme = name; saveSettings(s);
    panel.querySelector('#custom-theme-name').value = '';
    renderSavedThemes();
  });

  // 폰트
  panel.querySelector('#font-range').addEventListener('input', e => {
    const v = Number(e.target.value);
    document.documentElement.style.fontSize = v + 'px';
    panel.querySelector('#font-val').textContent = v + 'px';
    const s = getSettings(); s.fontSize = v; saveSettings(s);
  });

  // 레이아웃 선택
  panel.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.dataset.layout;
      const s = getSettings(); s.layoutStyle = layout; saveSettings(s);
      panel.querySelectorAll('.layout-btn').forEach(b => {
        const active = b.dataset.layout === layout;
        b.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
        b.style.background = active ? 'var(--bg3)' : 'var(--bg2)';
      });
    });
  });

  // 마디 표시 스타일
  panel.querySelectorAll('.barstyle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.barstyle;
      const s = getSettings(); s.barStyle = v; saveSettings(s);
      panel.querySelectorAll('.barstyle-btn').forEach(b => {
        const active = b.dataset.barstyle === v;
        b.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
        b.style.background = active ? 'var(--bg3)' : 'var(--bg2)';
      });
    });
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

  // Gemini API 키 관리
  const geminiInput = panel.querySelector('#gemini-key-input');
  const geminiStatus = panel.querySelector('#gemini-status');

  panel.querySelector('#gemini-toggle-btn').addEventListener('click', () => {
    geminiInput.type = geminiInput.type === 'password' ? 'text' : 'password';
  });
  panel.querySelector('#gemini-save-btn').addEventListener('click', () => {
    const key = geminiInput.value.trim();
    if (!key) { geminiStatus.textContent = '⚠️ 키를 입력해주세요.'; return; }
    localStorage.setItem('gta_gemini_key', key);
    geminiStatus.textContent = '✅ 저장됐습니다.';
  });
  panel.querySelector('#gemini-test-btn').addEventListener('click', async () => {
    const key = geminiInput.value.trim();
    if (!key) { geminiStatus.textContent = '⚠️ 키를 입력해주세요.'; return; }
    localStorage.setItem('gta_gemini_key', key);
    try {
      const { testConnection } = await import('./gemini-analysis.js?v=11');
      const msg = await testConnection(s => { geminiStatus.textContent = s; });
      geminiStatus.textContent = msg;
    } catch (e) {
      geminiStatus.textContent = `❌ ${e.message}`;
    }
  });
  panel.querySelector('#gemini-clear-btn').addEventListener('click', () => {
    if (!confirm('Gemini API 키를 삭제하시겠습니까?')) return;
    localStorage.removeItem('gta_gemini_key');
    geminiInput.value = '';
    geminiStatus.textContent = '키가 삭제됐습니다.';
  });

  // Supabase 설정 저장 + 연결 테스트
  panel.querySelector('#sb-save-btn').addEventListener('click', async () => {
    const url = panel.querySelector('#sb-url').value.trim();
    const anonKey = panel.querySelector('#sb-key').value.trim();
    const syncKey = panel.querySelector('#sync-key').value.trim();
    const status = panel.querySelector('#sb-status');
    if (!url || !anonKey || !syncKey) {
      status.textContent = '⚠️ URL, Key, 동기화 키를 모두 입력해주세요.'; return;
    }
    const { saveConfig, connect, pushAllData, pullAllData, subscribeDataChanges } = await import('./supabase-sync.js');
    saveConfig(url, anonKey);
    const s = getSettings(); s.syncKey = syncKey; saveSettings(s);
    status.textContent = '🔄 연결 중...';
    const res = await connect();
    if (res.ok) {
      status.textContent = '🔄 데이터 동기화 중...';
      // 원격 → 로컬 pull (다른 기기 작업 내용 가져오기)
      await pullAllData();
      // 로컬 → 원격 push (현재 기기 데이터 올리기)
      await pushAllData();
      // 실시간 구독 시작
      subscribeDataChanges(dataKey => {
        console.log('실시간 동기화:', dataKey);
        // 페이지 새로고침 없이 반영이 필요한 경우 이벤트 발생
        window.dispatchEvent(new CustomEvent('gta-data-synced', { detail: { dataKey } }));
      });
      status.textContent = '✅ 연결 성공! 모든 데이터가 실시간으로 동기화됩니다.';
    } else {
      status.textContent = `❌ 연결 실패: ${res.error}`;
    }
  });

  panel.querySelector('#sb-clear-btn').addEventListener('click', () => {
    if (!confirm('Supabase 연동을 해제하시겠습니까?')) return;
    localStorage.removeItem('gta_supabase_cfg');
    const s = getSettings(); delete s.syncKey; saveSettings(s);
    panel.querySelector('#sb-url').value = '';
    panel.querySelector('#sb-key').value = '';
    panel.querySelector('#sync-key').value = '';
    panel.querySelector('#sb-status').textContent = '연동이 해제되었습니다.';
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
