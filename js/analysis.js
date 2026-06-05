import { goTo } from './app.js';

// 솔로 분석 정적 데이터
const SOLOS = [
  {
    id: 1,
    title: 'Scarified',
    artist: 'Racer X (Paul Gilbert)',
    key: 'E minor',
    style: 'Nick Johnston',
    sections: [
      {
        name: 'Intro Riff',
        scale: 'E Natural Minor',
        notes: '빠른 16분음표 레가토 라인. E 마이너 스케일 전 포지션 활용.',
        techniques: ['레가토', '핑거링 효율'],
      },
      {
        name: 'Main Solo',
        scale: 'E Harmonic Minor',
        notes: '하모닉 마이너 특유의 증2도 음정으로 클래시컬한 느낌 연출.',
        techniques: ['스윕 피킹', '스트링 스키핑', '탭핑'],
      },
    ],
    licks: [
      { name: 'Sweep Arpeggio', tab: 'e|-------------12-|\nB|----------12-----|\nG|-------12--------|\nD|----12-----------|\nA|-12--------------|\nE|-----------------|' },
      { name: 'Legato Run', tab: 'e|-12-14-15-12-14-15-|\nB|--------------------|\nG|--------------------|\nD|--------------------|\nA|--------------------|\nE|--------------------|' },
    ],
  },
  {
    id: 2,
    title: 'Cliffs of Dover',
    artist: 'Eric Johnson',
    key: 'G major',
    style: 'Guthrie Govan',
    sections: [
      {
        name: 'Intro',
        scale: 'G Major Pentatonic',
        notes: '메이저 펜타토닉 특유의 밝고 유려한 레가토 라인.',
        techniques: ['레가토', '슬라이드'],
      },
      {
        name: 'Main Theme',
        scale: 'G Major',
        notes: 'G 메이저 스케일 전체를 넘나드는 유동적인 프레이징.',
        techniques: ['하이브리드 피킹', '치킨피킹'],
      },
    ],
    licks: [
      { name: 'Pentatonic Run', tab: 'e|-7-10-7-----------|\nB|--------10-8-7----|\nG|---------------9--|\nD|------------------|\nA|------------------|\nE|------------------|' },
    ],
  },
  {
    id: 3,
    title: 'Surfing with the Alien',
    artist: 'Joe Satriani',
    key: 'A Lydian',
    style: 'Joe Satriani',
    sections: [
      {
        name: 'Main Riff',
        scale: 'A Lydian',
        notes: '#4 음이 특징적인 리디안 스케일. 밝고 몽환적인 색채.',
        techniques: ['레가토', '비브라토'],
      },
      {
        name: 'Solo',
        scale: 'A Lydian / A Mixolydian',
        notes: '리디안과 믹솔리디안을 넘나드는 유동적 모달 접근.',
        techniques: ['와미바', '스피드 피킹'],
      },
    ],
    licks: [
      { name: 'Lydian Motif', tab: 'e|-9-11-13-14-13-11-9-|\nB|---------------------|\nG|---------------------|\nD|---------------------|\nA|---------------------|\nE|---------------------|' },
    ],
  },
];

export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🔍 솔로 분석</h1>
    <div id="solo-list"></div>
    <div id="solo-detail"></div>
  `;

  const list = panel.querySelector('#solo-list');
  list.innerHTML = SOLOS.map(s => `
    <div class="card" style="cursor:pointer" data-id="${s.id}">
      <div style="font-weight:700;font-size:1rem">${s.title}</div>
      <div style="color:var(--text2);font-size:0.85rem;margin-top:4px">${s.artist}</div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge">${s.key}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      const solo = SOLOS.find(s => s.id === Number(el.dataset.id));
      showDetail(panel, solo);
    });
  });
}

function showDetail(panel, solo) {
  const sections = solo.sections.map(sec => `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:10px">
      <div style="font-weight:700;color:var(--accent)">${sec.name}</div>
      <div style="font-size:0.8rem;color:var(--text2);margin-top:4px">스케일: <span style="color:var(--text)">${sec.scale}</span></div>
      <div style="font-size:0.85rem;margin-top:6px">${sec.notes}</div>
      <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
        ${sec.techniques.map(t => `<span class="badge">${t}</span>`).join('')}
      </div>
    </div>
  `).join('');

  const licks = solo.licks.map(l => `
    <div style="margin-bottom:12px">
      <div style="font-size:0.85rem;font-weight:600;margin-bottom:6px">${l.name}</div>
      <pre class="tab" style="background:var(--bg3);padding:10px;border-radius:var(--radius);font-size:0.78rem;overflow-x:auto;border:1px solid var(--border)">${l.tab}</pre>
    </div>
  `).join('');

  panel.querySelector('#solo-detail').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:1.2rem;font-weight:700">${solo.title}</div>
          <div style="color:var(--text2);font-size:0.85rem">${solo.artist} · ${solo.key}</div>
        </div>
        <button class="btn btn-link" id="to-library-btn">스타일 라이브러리 보기 →</button>
      </div>
      <hr class="divider">
      <div class="section-label">섹션 분석</div>
      ${sections}
      <div class="section-label" style="margin-top:16px">대표 릭 TAB</div>
      ${licks}
    </div>
  `;
  panel.querySelector('#to-library-btn').addEventListener('click', () => goTo(5, { artist: solo.style }));
  panel.querySelector('#solo-detail').scrollIntoView({ behavior: 'smooth' });
}
