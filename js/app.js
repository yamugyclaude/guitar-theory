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

function switchTab(tab) {
  // 이전 탭 DOM 비우기
  document.getElementById(`tab-${activeTab}`).innerHTML = '';
  document.querySelector(`.tab-btn[data-tab="${activeTab}"]`).classList.remove('active');
  document.getElementById(`tab-${activeTab}`).classList.remove('active');

  activeTab = tab;

  const panel = document.getElementById(`tab-${tab}`);
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  panel.classList.add('active');
  btn.classList.add('active');

  renderers[tab](panel);

  // pendingRoute 소비
  if (AppState.pendingRoute?.tab === tab) {
    emit('route-payload', AppState.pendingRoute.payload);
    AppState.pendingRoute = null;
  }
}

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async () => {
  // 탭 버튼 이벤트
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(Number(btn.dataset.tab)));
  });

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
  document.getElementById('hard-refresh-btn').addEventListener('click', () => {
    location.href = location.pathname + '?v=' + Date.now();
  });

  // Supabase 자동 연결 (설정된 경우)
  if (localStorage.getItem('gta_supabase_cfg') && settings.syncKey) {
    try {
      const { connect, pullAllData, pushAllData, subscribeDataChanges } = await import('./supabase-sync.js');
      const res = await connect();
      if (res.ok) {
        await pullAllData(); // 다른 기기 변경사항 가져오기
        subscribeDataChanges(dataKey => {
          window.dispatchEvent(new CustomEvent('gta-data-synced', { detail: { dataKey } }));
        });
      }
    } catch (e) { console.warn('자동 연결 실패:', e.message); }
  }

  // 첫 탭 렌더
  renderers[1](document.getElementById('tab-1'));

  // localStorage 변경 감지 → Supabase 자동 push
  const DATA_KEYS = ['gta_chart_drafts', 'gta_setlists', 'gta_sheet_meta'];
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    // 원격에서 받은 데이터를 적는 중이면 push 생략 (에코 루프 방지)
    if (DATA_KEYS.includes(key) && !window.__gtaApplyingRemote) {
      import('./supabase-sync.js').then(({ isReady, pushData }) => {
        if (isReady()) pushData(key);
      });
    }
  };
});
