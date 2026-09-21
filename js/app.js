import { render as renderTheory } from './theory.js';
import { render as renderVoicing } from './voicing.js';
import { render as renderSolo } from './solo.js';
import { render as renderAnalysis } from './analysis.js';
import { render as renderLibrary } from './library.js';
import { render as renderSheets } from './sheets.js';
import { render as renderChart } from './chart.js';
import { render as renderLive } from './live.js';
import { render as renderSettings } from './settings.js';
import { render as renderPractice } from './practice.js';

// ===== 중앙 상태 =====
export const AppState = {
  currentAnalysis: {
    progression: [],
    detectedKey: '',
    mode: '',
    diatonic: [],
    scales: []
  },
  setlist: [],
  pendingRoute: null
};

// ===== 이벤트 버스 =====
const bus = new EventTarget();
export const emit = (name, data) => bus.dispatchEvent(new CustomEvent(name, { detail: data }));
export const on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));

// ===== 탭 라우터 =====
const renderers = {
  1: renderTheory,
  2: renderVoicing,
  3: renderSolo,
  4: renderAnalysis,
  5: renderLibrary,
  6: renderSheets,
  7: renderChart,
  8: renderLive,
  9: renderSettings,
  10: renderPractice
};

let activeTab = 1;

export function goTo(tab, payload = null) {
  if (payload) AppState.pendingRoute = { tab, payload };
  switchTab(tab);
}

// 드라이브에서 새 데이터를 받아온 뒤 현재 보고 있는 탭을 다시 그린다
// (설정 탭 로그인/동기화 버튼, app.js 배너 로그인 버튼에서 공용으로 호출)
export function refreshCurrentTab() {
  renderers[activeTab](document.getElementById(`tab-${activeTab}`));
}

function switchTab(tab) {
  // 재생 중인 사운드 정지
  import('./audio.js').then(a => a.stopAll()).catch(() => {});
  // 이전 탭 DOM 비우기
  document.getElementById(`tab-${activeTab}`).innerHTML = '';
  document.querySelector(`.tab-btn[data-tab="${activeTab}"]`).classList.remove('active');
  document.getElementById(`tab-${activeTab}`).classList.remove('active');

  activeTab = tab;

  const panel = document.getElementById(`tab-${tab}`);
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  panel.classList.add('active');
  btn.classList.add('active');
  document.body.classList.add('mobile-tab-open');

  renderers[tab](panel);

  // pendingRoute 소비
  if (AppState.pendingRoute?.tab === tab) {
    emit('route-payload', AppState.pendingRoute.payload);
    AppState.pendingRoute = null;
  }
}

// 모바일: 첫 화면(카테고리 그리드)으로 돌아가기
function goHome() {
  import('./audio.js').then(a => a.stopAll()).catch(() => {});
  document.getElementById(`tab-${activeTab}`).innerHTML = '';
  document.querySelector(`.tab-btn[data-tab="${activeTab}"]`)?.classList.remove('active');
  document.getElementById(`tab-${activeTab}`).classList.remove('active');
  document.body.classList.remove('mobile-tab-open');
}

// 새 기기에서 드라이브 로그인 이력이 없을 때 띄우는 배너 — 팝업 차단 때문에 자동 로그인이 안 되므로
// 사장님이 직접 버튼을 눌러야 한다 (토스트는 금방 사라져 놓치기 쉬워서 배너로 계속 노출)
function showDriveLoginBanner() {
  if (document.getElementById('drive-login-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'drive-login-banner';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:center;gap:10px;padding:8px;background:var(--accent,#d9822b);color:#fff;font-size:0.85rem';
  bar.innerHTML = `<span>이 기기는 구글 드라이브에 로그인되어 있지 않아 최신 데이터가 아닐 수 있습니다.</span>
    <button id="drive-login-banner-btn" class="btn btn-primary" style="padding:2px 10px">로그인</button>`;
  document.body.appendChild(bar);
  bar.querySelector('#drive-login-banner-btn').addEventListener('click', async () => {
    const { connect, pullAll } = await import('./drive-sync.js');
    const res = await connect();
    if (res.ok) {
      await pullAll();
      refreshCurrentTab(); // 받아온 데이터로 현재 탭 다시 그리기
      import('./sheets.js').then(({ pullMissingSheetFiles }) => {
        pullMissingSheetFiles().catch(e => { console.warn('악보 자동 동기화 실패:', e.message); import('./chart.js').then(({ showToast }) => showToast('악보 자동 동기화 실패: ' + e.message)); });
      });
      bar.remove();
    } else {
      const { showToast } = await import('./chart.js');
      showToast('드라이브 로그인 실패: ' + res.error);
    }
  });
}

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async () => {
  // 탭 버튼 이벤트
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(Number(btn.dataset.tab)));
  });

  // 모바일 첫 화면 카테고리 버튼
  document.querySelectorAll('.home-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(Number(btn.dataset.tab)));
  });
  document.getElementById('mobile-back-btn').addEventListener('click', goHome);

  // 설정 불러오기 (테마 등)
  const settings = JSON.parse(localStorage.getItem('gta_settings') || '{}');
  if (settings.theme) document.documentElement.dataset.theme = settings.theme;
  if (settings.fontSize) document.documentElement.style.fontSize = settings.fontSize + 'px';
  // 커스텀 테마 복원
  if (settings.customTheme) {
    const customThemes = JSON.parse(localStorage.getItem('gta_custom_themes') || '[]');
    const t = customThemes.find(t => t.name === settings.customTheme);
    if (t) {
      const { applyCustomThemeVars } = await import('./settings.js');
      applyCustomThemeVars(t.vars);
    }
  }

  // 메뉴 숨김 상태 복원
  const settings2 = JSON.parse(localStorage.getItem('gta_settings') || '{}');
  if (settings2.navHidden) document.body.classList.add('nav-hidden');

  // 메뉴 숨기기 버튼
  document.getElementById('nav-hide-btn').addEventListener('click', () => {
    document.body.classList.add('nav-hidden');
    const s = JSON.parse(localStorage.getItem('gta_settings') || '{}');
    s.navHidden = true;
    localStorage.setItem('gta_settings', JSON.stringify(s));
  });

  // 메뉴 토글 버튼 (숨겨진 상태에서 다시 열기)
  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.body.classList.remove('nav-hidden');
    const s = JSON.parse(localStorage.getItem('gta_settings') || '{}');
    s.navHidden = false;
    localStorage.setItem('gta_settings', JSON.stringify(s));
  });

  // 강력 새로고침 (localStorage/IndexedDB 안전)
  const hardRefresh = () => { location.href = location.pathname + '?v=' + Date.now(); };
  document.getElementById('hard-refresh-btn').addEventListener('click', hardRefresh);
  document.getElementById('mobile-hard-refresh-btn').addEventListener('click', hardRefresh);

  // 구글 드라이브 자동 연결 (이전에 로그인한 적 있으면 조용히 재인증 시도)
  {
    try {
      const { connect, isLoggedIn, pullAll } = await import('./drive-sync.js');
      if (isLoggedIn()) {
        const res = await connect();
        if (res.ok) {
          await pullAll(); // 다른 기기 변경사항 가져오기
          // 다른 기기에서 올린 악보 파일 자동 다운로드 (백그라운드, 조용히)
          import('./sheets.js').then(({ pullMissingSheetFiles }) => {
            pullMissingSheetFiles().catch(e => { console.warn('악보 자동 동기화 실패:', e.message); import('./chart.js').then(({ showToast }) => showToast('악보 자동 동기화 실패: ' + e.message)); });
          });
        }
      } else {
        // 이 기기에서 드라이브 로그인 이력이 없음 — 브라우저가 자동 팝업을 막으므로
        // 로그인 버튼이 있는 배너를 눈에 띄게 띄워서 사장님이 직접 누르게 한다.
        showDriveLoginBanner();
      }
    } catch (e) { console.warn('드라이브 자동 연결 실패:', e.message); }
  }

  // 첫 탭 렌더
  renderers[1](document.getElementById('tab-1'));

  // localStorage 변경 감지 → 드라이브 자동 push (2초 디바운스)
  const { DATA_KEYS } = await import('./drive-sync.js');
  let _pushTimer = null;
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    // 원격에서 받은 데이터를 적는 중이면 push 생략 (에코 루프 방지)
    if (DATA_KEYS.includes(key) && !window.__gtaApplyingRemote) {
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(() => {
        import('./drive-sync.js').then(({ isReady, pushAll }) => {
          if (isReady()) pushAll().catch(async e => {
            const { showToast } = await import('./chart.js');
            showToast('⚠️ 드라이브 저장 실패 — 기기에만 저장됨');
            console.error('드라이브 저장 실패:', e.message);
          });
        });
      }, 2000);
    }
  };
});
