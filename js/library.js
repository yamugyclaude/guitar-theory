import { on } from './app.js';

const GUITARISTS = [
  {
    name: 'Nick Johnston',
    genre: '네오클래식 · 멜로딕 퓨전',
    techniques: ['레가토', '스윕 피킹', '스트링 스키핑', '탭핑'],
    scales: ['하모닉 마이너', '리디안', '멜로딕 마이너'],
    description: '캐나다 출신 기타리스트. 클래시컬한 멜로디 라인과 폭발적인 테크닉이 특징. 하모닉 마이너 스케일을 적극 활용해 신고전주의 퓨전 사운드를 구사.',
    licks: [
      {
        name: 'Harmonic Minor Sweep',
        scale: 'A Harmonic Minor',
        tech: '스윕 피킹',
        tab: `e|------12---------|\nB|---13----13------|\nG|-12--------12----|\nD|-------------14--|\nA|-----------------|\nE|-----------------|`,
      },
      {
        name: 'Legato String Skip',
        scale: 'E Lydian',
        tech: '레가토 + 스트링 스키핑',
        tab: `e|-9-12--------12-9-|\nB|------12-10-------|\nG|----------11------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Two-Hand Tapping',
        scale: 'D Melodic Minor',
        tech: '탭핑',
        tab: `e|-T17p12h14-T17p12h14-|\nB|----------------------|\nG|----------------------|\nD|----------------------|\nA|----------------------|\nE|----------------------|`,
      },
      {
        name: 'Neo-Classical Sequence',
        scale: 'A Harmonic Minor',
        tech: '얼터네이트 피킹',
        tab: `e|-17-16-15-13-12-----------|\nB|-------------15-13-12------|\nG|----------------------14---|\nD|---------------------------|\nA|---------------------------|\nE|---------------------------|`,
      },
      {
        name: 'Lydian Arpeggio',
        scale: 'C Lydian',
        tech: '스윕 + 탭핑',
        tab: `e|-T15p8h10-T15p8h10--------|\nB|--------------------------|\nG|-8-10-12------------------|\nD|----------12-10-8---------|\nA|------------------10------|\nE|--------------------------|`,
      },
      {
        name: 'Melodic Minor Run',
        scale: 'G Melodic Minor',
        tech: '레가토',
        tab: `e|-10-12-14-15-14-12-10-----|\nB|--------------------------|\nG|-9-10-12------------------|\nD|---------------------------|\nA|---------------------------|\nE|---------------------------|`,
      },
    ],
  },
  {
    name: 'Mark Lettieri',
    genre: '펑크 · R&B · 재즈 퓨전',
    techniques: ['하이브리드 피킹', '컴핑', '어퍼스트럭처 트라이어드'],
    scales: ['도리안', '믹솔리디안', '펜타토닉'],
    description: 'Snarky Puppy의 기타리스트. 펑크와 재즈를 결합한 그루비한 컴핑과 하이브리드 피킹이 강점. 어퍼스트럭처 트라이어드를 활용한 색채감 있는 보이싱으로 유명.',
    licks: [
      {
        name: 'Funky Hybrid Picking',
        scale: 'G Dorian',
        tech: '하이브리드 피킹',
        tab: `e|---3-5-3----------|\nB|----------5-3-----|\nG|---------------5--|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Upper Structure Voicing',
        scale: 'Mixolydian',
        tech: '어퍼스트럭처 트라이어드',
        tab: `e|-5---5---5--------|\nB|-5---6---8--------|\nG|-6---7---9--------|\nD|-7---7---9--------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Pentatonic Groove',
        scale: 'A Minor Pentatonic',
        tech: '하이브리드 피킹',
        tab: `e|---5-8-5----------|\nB|----------8-5-7---|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Dorian Jazz Phrase',
        scale: 'D Dorian',
        tech: '레가토 + 슬라이드',
        tab: `e|-10-12-10---------|\nB|----------12-10-9-|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Comp Chord Stab',
        scale: 'Mixolydian',
        tech: '컴핑',
        tab: `e|-5---3---2--------|\nB|-5---3---3--------|\nG|-5---4---2--------|\nD|-7---5---4--------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'R&B Bend Phrase',
        scale: 'G Minor Pentatonic',
        tech: '하이브리드 피킹 + 벤딩',
        tab: `e|---6b8~~-6-3------|\nB|-6-----------6-3--|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
    ],
  },
  {
    name: 'Guthrie Govan',
    genre: '퓨전 · 블루스 · 재즈 · 컨트리 · 록',
    techniques: ['치킨피킹', '레가토', '탭핑', '와미바', '크로매틱'],
    scales: ['전 스케일 자유자재', '크로매틱 어프로치'],
    description: '영국 출신 기타계의 만능 플레이어. 장르를 초월한 올라운더. 크로매틱 어프로치 노트와 치킨피킹을 자유자재로 구사하며 어떤 스타일도 완벽히 소화.',
    licks: [
      {
        name: 'Chromatic Approach',
        scale: '크로매틱',
        tech: '크로매틱 어프로치',
        tab: `e|---9-8-7-6-5------|\nB|------------------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Chicken Picking Lick',
        scale: 'G Major Pentatonic',
        tech: '치킨피킹',
        tab: `e|---3--5--3--------|\nB|-3---------5-3----|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Whammy Dive Phrase',
        scale: 'E Blues',
        tech: '와미바 + 레가토',
        tab: `e|-12~~~(dive)------|\nB|------------------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Country Hybrid Lick',
        scale: 'G Major Pentatonic',
        tech: '치킨피킹 + 슬라이드',
        tab: `e|---5-7---5-7-5----|\nB|-8---------8------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Fusion Legato Run',
        scale: 'C Dorian',
        tech: '레가토 전 포지션',
        tab: `e|-8-10-12-13-12-10-8-------|\nB|------------------------10-|\nG|---------------------------|\nD|---------------------------|\nA|---------------------------|\nE|---------------------------|`,
      },
      {
        name: 'Chromatic Enclosure',
        scale: '크로매틱',
        tech: '인클로저 어프로치',
        tab: `e|---8-9-7-8--------|\nB|-6----------------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
    ],
  },
  {
    name: 'Joe Satriani',
    genre: '인스트루멘탈 록 · 퓨전',
    techniques: ['레가토', '와미바 다이브', '비브라토', '스피드 피킹'],
    scales: ['리디안 (시그니처)', '펜타토닉', '이그조틱'],
    description: '인스트루멘탈 기타의 황제. 리디안 스케일의 몽환적인 #4 음을 시그니처로 사용. 강력한 비브라토와 와미바 기술이 특징. 표정이 풍부한 멜로딕 솔로잉.',
    licks: [
      {
        name: 'Lydian Signature',
        scale: 'A Lydian',
        tech: '레가토 + 비브라토',
        tab: `e|-9-11-13-14~~~----|\nB|------------------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Speed Picking Run',
        scale: 'E Minor Pentatonic',
        tech: '얼터네이트 피킹',
        tab: `e|-12-15-12-15-12---|\nB|-----------13-15--|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Whammy Dive Bomb',
        scale: '-',
        tech: '와미바 다이브',
        tab: `e|-12(dive to 0)----|\nB|------------------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Lydian Dominant Phrase',
        scale: 'A Lydian Dominant',
        tech: '레가토 + 슬라이드',
        tab: `e|-9-11-12-14-12-11-9-------|\nB|---------------------------|\nG|-9-11----------------------|\nD|---------------------------|\nA|---------------------------|\nE|---------------------------|`,
      },
      {
        name: 'Pentatonic Sequencing',
        scale: 'E Minor Pentatonic',
        tech: '얼터네이트 피킹',
        tab: `e|-12-15-12-15------|\nB|-13-15-13-15------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Exotic Scale Run',
        scale: 'E Phrygian Dominant',
        tech: '레가토',
        tab: `e|-12-13-11-12-8-9-8--------|\nB|---------------------------|\nG|-9--------------------------|\nD|---------------------------|\nA|---------------------------|\nE|---------------------------|`,
      },
    ],
  },
  {
    name: 'John Mayer',
    genre: '블루스 · 록 · 팝',
    techniques: ['썸 테크닉', '하이브리드 피킹', '코드-멜로디'],
    scales: ['마이너 펜타토닉', '도리안', '믹솔리디안'],
    description: '현대 블루스 기타의 대표주자. SRV의 영향을 받은 강력한 블루스 감성과 팝적인 멜로디 감각이 공존. 엄지손가락을 활용한 썸 테크닉으로 독특한 코드-멜로디 보이싱 구사.',
    licks: [
      {
        name: 'BB King Box',
        scale: 'A Minor Pentatonic',
        tech: '블루스 벤딩',
        tab: `e|-8b10~~-8-5-------|\nB|----------8-5-7---|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Thumb Chord Melody',
        scale: 'G Mixolydian',
        tech: '썸 테크닉',
        tab: `e|-3---3---3--------|\nB|-3---3---1--------|\nG|-0---2---0--------|\nD|-0---0---2--------|\nA|-(G on thumb)-----|\nE|------------------|`,
      },
      {
        name: 'Hybrid Picking Fill',
        scale: 'E Dorian',
        tech: '하이브리드 피킹',
        tab: `e|---7-9-7----------|\nB|----------9-7-9---|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'SRV-Style Double Stop',
        scale: 'A Blues',
        tech: '더블스톱 벤딩',
        tab: `e|-10b12~-10--------|\nB|-10b12~-10--------|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
      {
        name: 'Chord Melody Intro',
        scale: 'G Major',
        tech: '썸 테크닉 + 코드-멜로디',
        tab: `e|-3---2---0--------|\nB|-3---3---1--------|\nG|-0---0---0--------|\nD|-0---0---2--------|\nA|-2---0---3--------|\nE|-3----------------|\n(thumb on 6th str)`,
      },
      {
        name: 'Dorian Blues Fusion',
        scale: 'A Dorian',
        tech: '하이브리드 피킹',
        tab: `e|---5-7-5----------|\nB|-5-------7-5-7----|\nG|------------------|\nD|------------------|\nA|------------------|\nE|------------------|`,
      },
    ],
  },
];

export function render(panel) {
  let selectedIdx = 0;

  function renderAll() {
    const g = GUITARISTS[selectedIdx];
    panel.innerHTML = `
      <h1 class="page-title">🌟 스타일 라이브러리</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${GUITARISTS.map((g, i) => `
          <button class="btn ${i === selectedIdx ? 'btn-primary' : 'btn-secondary'}" data-idx="${i}">${g.name}</button>
        `).join('')}
      </div>
      <div class="card">
        <div style="font-size:1.2rem;font-weight:700">${g.name}</div>
        <div style="color:var(--text2);font-size:0.85rem;margin-top:4px">${g.genre}</div>
        <p style="margin-top:10px;font-size:0.88rem;line-height:1.6">${g.description}</p>
        <hr class="divider">
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div>
            <div class="section-label">핵심 기법</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">${g.techniques.map(t => `<span class="badge">${t}</span>`).join('')}</div>
          </div>
          <div>
            <div class="section-label">대표 스케일</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap">${g.scales.map(s => `<span class="badge badge-accent">${s}</span>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="section-label" style="margin:0 0 8px">대표 릭</div>
      ${g.licks.map((l, i) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
            <span style="font-weight:600">${i+1}. ${l.name}</span>
            <span class="badge">${l.tech}</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text2);margin-top:4px">스케일: ${l.scale}</div>
          <pre class="tab" style="background:var(--bg3);padding:10px;border-radius:var(--radius);font-size:0.78rem;overflow-x:auto;margin-top:8px;border:1px solid var(--border)">${l.tab}</pre>
        </div>
      `).join('')}
    `;

    panel.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => { selectedIdx = Number(btn.dataset.idx); renderAll(); });
    });
  }

  renderAll();

  // 탭3/4 연동
  on('route-payload', payload => {
    if (payload?.artist) {
      const idx = GUITARISTS.findIndex(g => g.name === payload.artist);
      if (idx !== -1) { selectedIdx = idx; renderAll(); }
    }
  });
}
