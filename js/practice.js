import { spellInterval } from './theory.js';

// ═══════════════════════════════════════════════════════════════════
//  연습 탭 — 고급 화성 어법 트레이닝
//  모달 인터체인지 · 리디안 도미넌트 · 얼터드 · 디미니시
//  12키 선택 → 실전 진행 + 특성음 지판 다이어그램 + 연주 지침
// ═══════════════════════════════════════════════════════════════════

const KEYS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const NOTE_IDX = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 };

// 스케일 정의: semis + 도수 라벨 + 철자용 letterSteps + 특성음(color)
const SCALES = {
  'Lydian Dominant': {
    semis: [0,2,4,6,7,9,10], degs: ['R','9','3','#11','5','13','b7'],
    letters: [0,1,2,3,4,5,6], color: ['#11'],
    parent: (root) => `${spellInterval(root, 7, 4)} 멜로딕 마이너의 4번째 모드`,
  },
  'Altered': {
    semis: [0,1,3,4,6,8,10], degs: ['R','b9','#9','3','#11','b13','b7'],
    letters: [0,1,2,2,3,5,6], color: ['b9','#9','b13'],
    parent: (root) => `${spellInterval(root, 1, 1)} 멜로딕 마이너의 7번째 모드 (반음 위)`,
  },
  'HW Diminished': {
    semis: [0,1,3,4,6,7,9,10], degs: ['R','b9','#9','3','#11','5','13','b7'],
    letters: [0,1,2,2,3,4,5,6], color: ['b9','13'],
    parent: () => '반음–온음 반복의 8음 대칭 스케일 (도미넌트용)',
  },
  'WH Diminished': {
    semis: [0,2,3,5,6,8,9,11], degs: ['R','9','b3','11','b5','b13','6','7'],
    letters: [0,1,2,3,4,5,5,6], color: ['6','7'],
    parent: () => '온음–반음 반복의 8음 대칭 스케일 (dim7 코드용)',
  },
  'Dorian': {
    semis: [0,2,3,5,7,9,10], degs: ['R','9','b3','11','5','13','b7'],
    letters: [0,1,2,3,4,5,6], color: ['13'],
    parent: () => '메이저 스케일의 2번째 모드',
  },
  'Aeolian': {
    semis: [0,2,3,5,7,8,10], degs: ['R','9','b3','11','5','b13','b7'],
    letters: [0,1,2,3,4,5,6], color: ['b13'],
    parent: () => '내추럴 마이너',
  },
  'Lydian': {
    semis: [0,2,4,6,7,9,11], degs: ['R','9','3','#11','5','13','7'],
    letters: [0,1,2,3,4,5,6], color: ['#11'],
    parent: () => '메이저 스케일의 4번째 모드',
  },
  'Mixolydian': {
    semis: [0,2,4,5,7,9,10], degs: ['R','9','3','11','5','13','b7'],
    letters: [0,1,2,3,4,5,6], color: ['b7'],
    parent: () => '메이저 스케일의 5번째 모드',
  },
  'Melodic Minor': {
    semis: [0,2,3,5,7,9,11], degs: ['R','9','b3','11','5','13','7'],
    letters: [0,1,2,3,4,5,6], color: ['b3','7'],
    parent: () => '도리안의 b7을 ♮7로 — "마이너인데 메이저처럼 끝나는" 스케일',
  },
  'Locrian ♮2': {
    semis: [0,2,3,5,6,8,10], degs: ['R','9','b3','11','b5','b13','b7'],
    letters: [0,1,2,3,4,5,6], color: ['9'],
    parent: (root) => `${spellInterval(root, 3, 2)} 멜로딕 마이너의 6번째 모드`,
  },
  'Bebop Dominant': {
    semis: [0,2,4,5,7,9,10,11], degs: ['R','9','3','11','5','13','b7','7'],
    letters: [0,1,2,3,4,5,6,6], color: ['7'],
    parent: () => '믹솔리디안 + 경과 ♮7 — 8음이라 코드 톤이 항상 정박에 떨어진다',
  },
  'Dorian (Quartal)': {
    semis: [0,2,3,5,7,9,10], degs: ['R','9','b3','11','5','13','b7'],
    letters: [0,1,2,3,4,5,6], color: ['11','b7'],
    parent: () => '쿼털 보이싱의 모판 — 4도 쌓기가 모두 스케일 안에 있다',
  },
};

function scaleNotes(root, scaleName) {
  const s = SCALES[scaleName];
  return s.semis.map((semi, i) => ({
    semi, deg: s.degs[i],
    name: spellInterval(root, semi, s.letters[i]),
    isColor: s.color.includes(s.degs[i]),
  }));
}

// 키 루트에서 도수 코드 이름 생성
function chordFrom(keyRoot, semis, letterSteps, suffix) {
  return spellInterval(keyRoot, semis, letterSteps) + suffix;
}

// ── 지판 다이어그램 (가로형, 12프렛, 특성음 강조) ──────────────────
const OPEN_PCS = [4,9,2,7,11,4]; // 6번현(low E) → 1번현

function fretboardSVG(root, scaleName) {
  const notes = scaleNotes(root, scaleName);
  const rootPc = NOTE_IDX[root];
  const map = {};
  notes.forEach(n => { map[(rootPc + n.semi) % 12] = n; });

  const fretW = 46, strH = 22, ox = 34, oy = 18;
  const fretCount = 12;
  const W = ox + fretW * fretCount + 12, H = oy + strH * 5 + 30;
  let svg = '';

  // 프렛 세로선
  for (let f = 0; f <= fretCount; f++) {
    const x = ox + f * fretW;
    svg += `<line x1="${x}" y1="${oy}" x2="${x}" y2="${oy + strH * 5}" stroke="var(--border)" stroke-width="${f === 0 ? 3 : 1}"/>`;
  }
  // 현 가로선 (위 = 1번현)
  for (let s = 0; s < 6; s++) {
    const y = oy + s * strH;
    svg += `<line x1="${ox}" y1="${y}" x2="${ox + fretW * fretCount}" y2="${y}" stroke="var(--text2)" stroke-width="1"/>`;
  }
  // 프렛 번호
  [3,5,7,9,12].forEach(f => {
    svg += `<text x="${ox + (f - 0.5) * fretW}" y="${oy + strH * 5 + 18}" fill="var(--text2)" font-size="10" text-anchor="middle">${f}</text>`;
  });
  // 노트 (화면 위가 1번현이 되도록 역순)
  for (let s = 0; s < 6; s++) {
    const stringPc = OPEN_PCS[5 - s]; // s=0 → 1번현
    const y = oy + s * strH;
    for (let f = 0; f <= fretCount; f++) {
      const pc = (stringPc + f) % 12;
      const n = map[pc];
      if (!n) continue;
      const x = f === 0 ? ox - 14 : ox + (f - 0.5) * fretW;
      const fill = n.deg === 'R' ? 'var(--accent)' : n.isColor ? '#f0a500' : 'var(--bg3)';
      const txtFill = (n.deg === 'R' || n.isColor) ? '#fff' : 'var(--text2)';
      const stroke = n.deg === 'R' ? 'var(--accent)' : n.isColor ? '#f0a500' : 'var(--border)';
      svg += `<circle cx="${x}" cy="${y}" r="9" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${y + 3}" fill="${txtFill}" font-size="7.5" text-anchor="middle" font-weight="bold">${n.deg}</text>`;
    }
  }
  return `<div style="overflow-x:auto"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="min-width:${W}px">${svg}</svg></div>`;
}

// ═══ 모듈 정의 ═══════════════════════════════════════════════════════
const TOPICS = [
  {
    id: 'modal',
    title: '모달 인터체인지',
    intro: '같은 토닉의 다른 모드(주로 병행 마이너)에서 코드를 빌려오는 기법. 메이저 키의 햇살에 그림자를 한 줄 긋는 것 — 팝부터 재즈까지 현대 화성의 핵심 장치.',
    when: [
      '메이저 키 진행이 너무 밝고 평탄할 때 — IVm 하나로 즉시 깊이가 생긴다',
      '벌스→코러스 전환부에 감정 낙차를 만들고 싶을 때 (bVI, bVII)',
      'V7 없이 토닉으로 돌아가고 싶을 때 (백도어 IVm7–bVII7–I)',
      '엔딩/턴어라운드에 한 번 더 색을 입힐 때 (bII, IVm6)',
    ],
    how: [
      '핵심은 컬러 노트 — 차용 코드가 가져온 "원래 키에 없는 음"을 멜로디 정점이나 긴 음가에 배치한다. 그 음을 안 쓰면 차용한 의미가 없다.',
      '차용 코드 직후 토닉 코드 톤으로 해결하는 라인을 만든다. 색은 들어왔다 나가야 색이다.',
      '리듬 위치: 차용 코드는 보통 약박~경과 위치에서 가장 자연스럽다. 강박에 두면 전조처럼 들린다.',
      '귀 훈련: 컬러 노트만 허밍하면서 진행을 재생 — 손보다 귀가 먼저 그 음을 원해야 한다.',
    ],
    exercises: (key) => {
      const r = key;
      return [
        {
          title: 'IVm 차용 — 서브도미넌트 마이너',
          prog: [chordFrom(r,0,0,'maj7'), chordFrom(r,5,3,'maj7'), chordFrom(r,5,3,'m6'), chordFrom(r,0,0,'maj7')],
          roman: ['Imaj7','IVmaj7','IVm6','Imaj7'],
          guide: `가장 흔하고 강력한 차용. IVm6의 컬러 노트는 ${spellInterval(r,8,5)}(키의 b6) — IVmaj7에서 IVm6로 바뀌는 순간 ${spellInterval(r,9,5)}→${spellInterval(r,8,5)} 반음 하행을 멜로디로 직접 연주해 보라. 그 반음이 이 기법의 전부다. 이후 ${spellInterval(r,7,4)}(키의 5도)로 해결.`,
          scaleRoot: spellInterval(r,5,3), scaleName: 'Dorian',
          scaleNote: `IVm 위 스케일: ${spellInterval(r,5,3)} 도리안 (m6 사운드). 다이어그램의 13(도리안 특성음)이 키 관점에선 평범한 음이지만, b3가 바로 키의 b6 컬러.`,
        },
        {
          title: '백도어 캐던스',
          prog: [chordFrom(r,5,3,'m7'), chordFrom(r,10,6,'7'), chordFrom(r,0,0,'maj7')],
          roman: ['IVm7','bVII7','Imaj7'],
          guide: `V7 없이 뒷문으로 토닉 도달. bVII7 위에서 리디안 도미넌트를 쓰면 #11이 정확히 키의 리딩톤(${spellInterval(r,11,6)})이 된다 — 이 음을 거쳐 토닉 루트로 해결하는 라인을 만들 것. 비밥 스탠더드 "Lady Bird", 비틀즈 다수 곡의 어법.`,
          scaleRoot: spellInterval(r,10,6), scaleName: 'Lydian Dominant',
          scaleNote: `bVII7 위 스케일: ${spellInterval(r,10,6)} 리디안 도미넌트. 주황색 #11이 키의 7도 — 토닉으로 가는 다리.`,
        },
        {
          title: 'bVI–bVII–I 록 캐던스',
          prog: [chordFrom(r,8,5,'maj7'), chordFrom(r,10,6,''), chordFrom(r,0,0,'')],
          roman: ['bVImaj7','bVII','I'],
          guide: `병행 마이너에서 두 코드를 통째로 빌려 상행하는 락/영화음악 상용구. bVI–bVII 동안은 ${r} 에올리안으로 연주하다가 I 도착과 동시에 메이저 3도(${spellInterval(r,4,2)})를 쳐서 "구름이 걷히는" 효과를 만든다. 마지막 코드 직전까지 메이저 3도를 아껴두는 것이 요령.`,
          scaleRoot: r, scaleName: 'Aeolian',
          scaleNote: `bVI·bVII 구간 스케일: ${r} 에올리안. b13(주황)이 bVI의 루트와 일치 — 차용 구간의 무게중심.`,
        },
        {
          title: 'bII — 네아폴리탄 컬러',
          prog: [chordFrom(r,2,1,'m7'), chordFrom(r,1,1,'maj7'), chordFrom(r,0,0,'maj7')],
          roman: ['IIm7','bIImaj7','Imaj7'],
          guide: `프리지안에서 차용한 반음 위 메이저 코드. 베이스가 반음씩 하행(${spellInterval(r,2,1)}→${spellInterval(r,1,1)}→${r})하는 동안 bIImaj7 위에서 리디안을 쓰면 #11이 키의 5도와 일치해 부드럽게 녹는다. 발라드 엔딩, 보사노바에서 빈번.`,
          scaleRoot: spellInterval(r,1,1), scaleName: 'Lydian',
          scaleNote: `bIImaj7 위 스케일: ${spellInterval(r,1,1)} 리디안.`,
        },
      ];
    },
    routine: [
      '진행을 루프 녹음(또는 백킹 생성) — 코드만 4분음표로',
      '1바퀴: 컬러 노트 한 음만 — 차용 코드에서 그 음을 길게 노래시키기',
      '2바퀴: 컬러 노트 → 해결음 두 음 라인',
      '3바퀴: 자유 즉흥하되 차용 코드 정점은 반드시 컬러 노트',
      '키 이동: 5도권 순서로 (C→F→Bb→…) 12키',
    ],
  },
  {
    id: 'lyddom',
    title: '리디안 도미넌트 (리디안 b7)',
    intro: '믹솔리디안의 4도를 #4로 올린 스케일 — 도미넌트 7th의 어보이드 노트(11)를 없앤 "완전체 도미넌트 사운드". 멜로딕 마이너의 4번째 모드.',
    when: [
      '해결하지 않는 도미넌트 — IV7, bVII7(백도어), 블루스가 아닌 원코드 7th 뱀프',
      '트라이톤 서브(subV7) 위 — 이때 #11이 원래 V7의 루트라서 이론적으로 완벽한 선택',
      '7#11이 명시된 코드 (Simpsons 테마, "Girl from Ipanema"의 IV7 구간)',
      'V7→I에서도 의도적으로 — #11의 부유감을 원할 때 (단, 11→해결 성향은 약해짐)',
    ],
    how: [
      '특성음 #11을 3도와 5도 사이의 "반짝임"으로 사용 — 3→#11→5 또는 5→#11→3 사이를 오가는 라인이 기본 어휘.',
      '사고법: G7#11 = D 멜로딕 마이너. 멜로딕 마이너 핑거링 하나로 모든 리디안 도미넌트를 커버할 수 있다.',
      '어퍼 스트럭처: 루트 2도 위 메이저 트라이어드(G7 위 A 트라이어드 = 9·#11·13)를 아르페지오로 — 즉시 모던한 사운드.',
      '#11을 경과음이 아닌 도착음으로 — 프레이즈가 #11에서 멈추는 연습을 할 것. 귀가 익으면 그 부유감이 무기가 된다.',
    ],
    exercises: (key) => {
      const r = key;
      const iv = spellInterval(r,5,3);
      const sub = spellInterval(r,1,1);
      const bvii = spellInterval(r,10,6);
      return [
        {
          title: 'IV7 뱀프 — 가장 순수한 리디안 도미넌트',
          prog: [chordFrom(r,0,0,'maj7'), chordFrom(r,5,3,'7'), chordFrom(r,0,0,'maj7'), chordFrom(r,5,3,'7')],
          roman: ['Imaj7','IV7','Imaj7','IV7'],
          guide: `IV7은 어디로도 해결하지 않는 도미넌트 — 리디안 도미넌트의 고향. ${iv}7 위에서 #11(${spellInterval(iv,6,3)})을 도착음으로 쓰는 프레이즈를 만들 것. 이 음은 키의 리딩톤이기도 해서 Imaj7로 돌아갈 때 자연스럽게 녹는다.`,
          scaleRoot: iv, scaleName: 'Lydian Dominant',
          scaleNote: `${iv} 리디안 도미넌트 = ${spellInterval(iv,7,4)} 멜로딕 마이너. 주황 #11이 핵심.`,
        },
        {
          title: '트라이톤 서브 — subV7',
          prog: [chordFrom(r,2,1,'m7'), chordFrom(r,1,1,'7'), chordFrom(r,0,0,'maj7')],
          roman: ['IIm7','subV7','Imaj7'],
          guide: `${sub}7은 ${spellInterval(r,7,4)}7의 트라이톤 대리 — 3·7도(가이드 톤)가 같다. ${sub}7 위 리디안 도미넌트의 #11은 ${spellInterval(sub,6,3)} = 원래 도미넌트의 루트. 베이스 반음 하행(${spellInterval(r,2,1)}→${sub}→${r}) 위에서 #11→루트 해결 라인을 연주해 보라.`,
          scaleRoot: sub, scaleName: 'Lydian Dominant',
          scaleNote: `${sub} 리디안 도미넌트 = ${spellInterval(sub,7,4)} 멜로딕 마이너.`,
        },
        {
          title: '어퍼 스트럭처 트라이어드',
          prog: [chordFrom(r,5,3,'7#11'), chordFrom(r,5,3,'7#11'), chordFrom(r,0,0,'maj7'), chordFrom(r,0,0,'maj7')],
          roman: ['IV7#11','IV7#11','Imaj7','Imaj7'],
          guide: `${iv}7 위에서 ${spellInterval(iv,2,1)} 메이저 트라이어드(2도 위)만 아르페지오로 연주 — 이 세 음이 9·#11·13. 하성부(밴드/루프)가 7th를 깔고 있으면 트라이어드만으로 전체 텐션이 울린다. 트라이어드 인버전 3개를 지판 곳곳에서 찾는 것까지가 연습.`,
          scaleRoot: iv, scaleName: 'Lydian Dominant',
          scaleNote: `어퍼 스트럭처: ${spellInterval(iv,2,1)} 트라이어드 = ${iv}7의 9·#11·13.`,
        },
      ];
    },
    routine: [
      '멜로딕 마이너 핑거링 1개를 12키로 (사고: 도미넌트 루트의 5도 위 멜로딕 마이너)',
      '드론(루트) 위에서 3–#11–5 셀 반복 → #11에서 멈추는 프레이즈',
      '2도 위 메이저 트라이어드 인버전 3개 위치 암기',
      'ii–subV–I 진행 12키 — #11→루트 해결 라인 필수 포함',
    ],
  },
  {
    id: 'altered',
    title: '얼터드 스케일',
    intro: '도미넌트의 모든 텐션을 변화시킨 스케일(b9·#9·#11·b13) — 해결 직전 긴장의 최대치. 멜로딕 마이너의 7번째 모드.',
    when: [
      'V7이 마이너로 해결할 때 (V7alt→Im) — 사실상 기본 선택',
      'V7→I 메이저 해결에서 긴장을 극대화하고 싶을 때 — 발라드 마지막 V7, 빅밴드 샷',
      '7alt, 7b9b13, 7#9 표기가 명시된 코드',
      '연속 도미넌트 체인(V/ii→V→I)에서 색 대비를 만들 때 — 하나는 믹솔리디안, 하나는 얼터드',
    ],
    how: [
      '사고법이 전부: G7alt = Ab 멜로딕 마이너 (반음 위). 새 핑거링이 아니라 "반음 위 멜로딕 마이너"로 즉시 접근.',
      '해결 지도를 외울 것 — b13→5, #9→b3(마이너 해결 시), b9→루트, b7→3. 얼터드는 스케일 런이 아니라 "해결 직전 음 선택"이다.',
      '프레이즈 설계: 코드 톤(3·b7)에서 출발 → 알터드 텐션 경유 → 다음 코드의 코드 톤 착지. 출발·도착이 명확해야 아웃이 아닌 텐션으로 들린다.',
      '리듬: 얼터드 구간은 마지막 2박에만 써도 충분하다. V7 전체를 얼터드로 채우면 과식.',
    ],
    exercises: (key) => {
      const r = key;
      const five = spellInterval(r,7,4);
      const two = spellInterval(r,2,1);
      return [
        {
          title: '마이너 ii–V–i (필수)',
          prog: [chordFrom(r,2,1,'m7b5'), chordFrom(r,7,4,'7alt'), chordFrom(r,0,0,'m7')],
          roman: ['IIm7b5','V7alt','Im7'],
          guide: `마이너 키의 표준 ii–V. ${five}7alt에서 b13(${spellInterval(five,8,5)})→Im의 5도, b9(${spellInterval(five,1,1)})→Im의 루트로 가는 해결 두 줄을 먼저 외운다. 사고: ${five}7alt = ${spellInterval(five,1,1)} 멜로딕 마이너.`,
          scaleRoot: five, scaleName: 'Altered',
          scaleNote: `${five} 얼터드 = ${spellInterval(five,1,1)} 멜로딕 마이너. 주황 음들(b9·#9·b13)이 해결 대기 음.`,
        },
        {
          title: '메이저 해결 — 긴장의 낙차',
          prog: [chordFrom(r,2,1,'m7'), chordFrom(r,7,4,'7alt'), chordFrom(r,0,0,'maj7')],
          roman: ['IIm7','V7alt','Imaj7'],
          guide: `IIm7까지 다이아토닉(도리안)으로 평온하게 → V7alt에서 급격히 어두워졌다가 → Imaj7에서 풀린다. 낙차가 클수록 해결이 달다. 연습: V7의 앞 2박은 믹솔리디안, 뒤 2박만 얼터드 — 경계를 귀로 만들 것.`,
          scaleRoot: five, scaleName: 'Altered',
          scaleNote: `뒤 2박 전용: ${five} 얼터드.`,
        },
        {
          title: '도미넌트 체인 — 색 대비',
          prog: [chordFrom(r,9,5,'7alt'), chordFrom(r,2,1,'7'), chordFrom(r,7,4,'7alt'), chordFrom(r,0,0,'maj7')],
          roman: ['V7alt/II','V7/V','V7alt','Imaj7'],
          guide: `연속 도미넌트에서 얼터드(어두움)와 믹솔리디안/리디안 도미넌트(밝음)를 교대로 — 같은 7th 코드 행렬에 명암 그라데이션이 생긴다. 각 코드의 3·b7 가이드 톤이 반음씩 미끄러지는 것을 먼저 확인하고 시작할 것.`,
          scaleRoot: spellInterval(r,9,5), scaleName: 'Altered',
          scaleNote: `첫 코드: ${spellInterval(r,9,5)} 얼터드. 둘째 코드는 ${two} 믹솔리디안으로 대비.`,
        },
      ];
    },
    routine: [
      '멜로딕 마이너 1포지션 → "반음 위" 사고 변환 드릴 (코드명 보고 즉시 모스케일 말하기)',
      '해결 지도 4쌍(b13→5, b9→R, #9→b3, b7→3)을 한 쌍씩 ii–V–i 루프에서',
      'V7 마지막 2박만 얼터드 — 경계 만들기 연습',
      '12키 마이너 ii–V–i 순환 (5도권 하행)',
    ],
  },
  {
    id: 'dim',
    title: '디미니시 스케일',
    intro: '단3도 대칭 구조의 8음 스케일. 도미넌트엔 HW(반음-온음), dim7 코드엔 WH(온음-반음). 대칭성 덕분에 하나의 셰이프가 단3도 간격으로 무한 복제된다.',
    when: [
      'V7b9 — HW 디미니시의 본진 (b9·#9·#11·13을 모두 쓰면서 5도와 13은 유지)',
      '경과 dim7 코드 (#Idim7, #IVdim7 등) — WH 디미니시',
      '얼터드보다 "기계적/장식적" 긴장을 원할 때 — 13이 살아있어 얼터드보다 밝다',
      '대칭 시퀀스 자체가 목적일 때 — 인터벌릭한 모던 사운드',
    ],
    how: [
      '셰이프 복제가 본질: 4음 셀 하나를 만들고 단3도(3프렛) 위로 평행 이동 — 같은 스케일 안이다. 이것이 디미니시 어휘의 90%.',
      'HW에서 13이 살아있다는 게 얼터드와의 결정적 차이 — b9와 13을 한 프레이즈에 같이 쓰면 즉시 디미니시 사운드.',
      '도미넌트 루트 기준 "위 반음에서 시작하는 dim7 아르페지오"(= b9·3·5·b7)가 가장 빠른 진입로.',
      '대칭이라 방향감을 잃기 쉽다 — 반드시 다음 코드의 3도/루트로 착지 음을 미리 정하고 시작할 것.',
    ],
    exercises: (key) => {
      const r = key;
      const five = spellInterval(r,7,4);
      const sharp1 = spellInterval(r,1,0);
      return [
        {
          title: 'V7b9 → I — HW 디미니시 본진',
          prog: [chordFrom(r,2,1,'m7'), chordFrom(r,7,4,'7b9'), chordFrom(r,0,0,'maj7'), chordFrom(r,0,0,'6')],
          roman: ['IIm7','V7b9','Imaj7','I6'],
          guide: `${five}7b9 위에서 ${five} HW 디미니시. 입문 어휘: ${spellInterval(five,1,1)}dim7 아르페지오(루트 반음 위) = b9·3·5·b7 — 이 네 음만으로도 완전한 V7b9 사운드. b9(${spellInterval(five,1,1)})→${r}의 루트 해결을 매번 확인.`,
          scaleRoot: five, scaleName: 'HW Diminished',
          scaleNote: `${five} HW 디미니시 — b9와 13(주황)을 한 프레이즈에 쓰면 디미니시 고유의 색.`,
        },
        {
          title: '경과 dim7 — WH 디미니시',
          prog: [chordFrom(r,0,0,''), chordFrom(r,1,0,'dim7'), chordFrom(r,2,1,'m7'), chordFrom(r,7,4,'7')],
          roman: ['I','#Idim7','IIm7','V7'],
          guide: `베이스가 반음 상행(${r}→${sharp1}→${spellInterval(r,2,1)})하는 상용 진행. ${sharp1}dim7 위에선 ${sharp1} WH 디미니시 — 단 한 박짜리 코드이므로 dim7 아르페지오 + 위 온음 장식 정도면 충분하다. 다음 코드(IIm7)의 루트로 착지.`,
          scaleRoot: sharp1, scaleName: 'WH Diminished',
          scaleNote: `${sharp1} WH 디미니시. dim7 코드 톤 사이를 온음 위 음(주황 계열)으로 장식.`,
        },
        {
          title: '단3도 대칭 시퀀스',
          prog: [chordFrom(r,7,4,'13b9'), chordFrom(r,7,4,'13b9'), chordFrom(r,0,0,'maj7'), chordFrom(r,0,0,'maj7')],
          roman: ['V13b9','V13b9','Imaj7','Imaj7'],
          guide: `4음 셀(예: 3–b9–R–b7 모양 하나)을 만들어 3프렛 위로 3번 복제 — 4개 위치 모두 같은 ${five} HW 디미니시 안이다. 상행 복제 후 마지막 셀에서 ${r}의 3도(${spellInterval(r,4,2)})로 꺾어 착지. 기계적 상승 → 유기적 해결의 대비가 이 어법의 매력.`,
          scaleRoot: five, scaleName: 'HW Diminished',
          scaleNote: `대칭 확인: 다이어그램에서 같은 도수 패턴이 3프렛 간격으로 반복된다.`,
        },
      ];
    },
    routine: [
      'dim7 아르페지오 1셰이프 → 3프렛 평행 이동 드릴 (4위치)',
      '루트 반음 위 dim7 아르페지오 = V7b9 사고 변환 (12키 즉답)',
      'b9+13 동시 사용 프레이즈 3개 작곡 → 12키 이동',
      '착지음 선지정 훈련: 시작 전 "다음 코드 3도"를 소리 내어 말하고 연주',
    ],
  },
  {
    id: 'melmin',
    title: '멜로딕 마이너 시스템',
    intro: '하나의 스케일에서 7개의 모드가 나오는 "현대 재즈의 모판". 리디안 도미넌트(4모드)·얼터드(7모드)·로크리안 ♮2(6모드)가 전부 여기서 나온다 — 핑거링 하나로 세 가지 고급 사운드를 모두 얻는 시스템.',
    when: [
      'm6 · m(maj7) 코드 — 멜로딕 마이너 그 자체 (마이너 토닉의 모던한 색)',
      'm7b5 코드 — 로크리안 ♮2 (b3 위 멜로딕 마이너)로 9th 텐션 확보',
      '7#11 — 리디안 도미넌트 (5도 위 멜로딕 마이너)',
      '7alt — 얼터드 (반음 위 멜로딕 마이너)',
    ],
    how: [
      '핵심 사고: "어떤 멜로딕 마이너를 빌릴 것인가". 코드 → 모(母) 멜로딕 마이너 변환표를 즉답 수준으로 — m7b5는 b3 위, 7alt는 반음 위, 7#11은 5도 위.',
      '특성음은 b3와 ♮7의 공존 — 마이너의 어두움과 메이저의 상승감이 한 스케일에 있다. 이 모순이 모던 사운드의 원천.',
      '마이너 ii–V–i 전체를 멜로딕 마이너 3개로 처리: IIm7b5(b3 위) → V7alt(반음 위) → Im6(그 자체). 핑거링은 하나, 위치만 이동.',
      'm(maj7) 아르페지오(R–b3–5–7)를 독립 어휘로 — 제임스 본드 테마의 마지막 코드가 이 소리다.',
    ],
    exercises: (key) => {
      const r = key;
      const two = spellInterval(r,2,1);
      const five = spellInterval(r,7,4);
      return [
        {
          title: '마이너 토닉 — m6/m(maj7) 사운드',
          prog: [chordFrom(r,0,0,'m6'), chordFrom(r,0,0,'m(maj7)'), chordFrom(r,0,0,'m7'), chordFrom(r,0,0,'m6')],
          roman: ['Im6','Im(maj7)','Im7','Im6'],
          guide: `같은 마이너 토닉의 색 변화(6→7→b7→6)를 멜로디로 직접 연주 — 클리셰 라인의 본체. ${r} 멜로딕 마이너에서 13과 ♮7을 정점에 배치하면 영화음악적 마이너가 된다. b7(도리안)과 ♮7(멜로딕)을 의도적으로 구분해서 칠 것.`,
          scaleRoot: r, scaleName: 'Melodic Minor',
          scaleNote: `${r} 멜로딕 마이너 — 주황 b3(마이너 정체성)와 ♮7(상승감)의 공존이 핵심.`,
        },
        {
          title: '마이너 ii–V–i를 멜로딕 마이너 3개로',
          prog: [chordFrom(r,2,1,'m7b5'), chordFrom(r,7,4,'7alt'), chordFrom(r,0,0,'m6')],
          roman: ['IIm7b5','V7alt','Im6'],
          guide: `사고 변환: ${two}m7b5 = ${spellInterval(two,3,2)} 멜로딕 마이너(b3 위) / ${five}7alt = ${spellInterval(five,1,1)} 멜로딕 마이너(반음 위) / ${r}m6 = ${r} 멜로딕 마이너. 같은 핑거링이 ${spellInterval(two,3,2)}→${spellInterval(five,1,1)}→${r}로 이동할 뿐이다. 위치 이동을 소리 내어 말하면서 연주할 것.`,
          scaleRoot: two, scaleName: 'Locrian ♮2',
          scaleNote: `IIm7b5 위: ${two} 로크리안 ♮2. 주황 9가 일반 로크리안에 없는 텐션 — 이 음 때문에 멜로딕 마이너 시스템을 쓴다.`,
        },
        {
          title: 'm(maj7) 아르페지오 어휘',
          prog: [chordFrom(r,0,0,'m(maj7)'), chordFrom(r,0,0,'m(maj7)'), chordFrom(r,5,3,'7#11'), chordFrom(r,0,0,'m(maj7)')],
          roman: ['Im(maj7)','Im(maj7)','IV7#11','Im(maj7)'],
          guide: `R–b3–5–♮7 아르페지오를 모든 인버전으로. IV7#11 구간은 같은 ${r} 멜로딕 마이너가 그대로 통한다(${spellInterval(r,5,3)}7#11 = ${r} 멜로딕 마이너의 4모드) — 코드가 바뀌어도 스케일이 안 바뀌는 경험이 이 시스템의 핵심 통찰.`,
          scaleRoot: r, scaleName: 'Melodic Minor',
          scaleNote: `두 코드 모두 ${r} 멜로딕 마이너 하나로 — 모드 시스템의 경제성.`,
        },
      ];
    },
    routine: [
      '멜로딕 마이너 1포지션을 12키 (5도권 순환)',
      '변환표 즉답 드릴: 코드명 보고 모 멜로딕 마이너 말하기 (m7b5→b3 위, alt→반음 위, 7#11→5도 위)',
      '마이너 ii–V–i를 "핑거링 하나 + 위치 3개"로 12키',
      'm(maj7) 아르페지오 4인버전 → 클리셰 라인(6-7-b7-6)과 결합',
    ],
  },
  {
    id: 'quartal',
    title: '쿼털 보이싱',
    intro: '3도 대신 4도로 쌓는 보이싱 — 맥코이 타이너, 빌 에반스가 정착시킨 모달 재즈의 사운드. 장르 표식이 약해 "코드가 아니라 색"처럼 들리는 것이 무기.',
    when: [
      '모달 뱀프 (도리안/믹솔리디안 원코드) — So What 스타일 컴핑',
      'm7 코드에서 3도 보이싱이 너무 "설명적"으로 들릴 때',
      '록/퓨전에서 파워코드보다 세련된 미니멀 보이싱이 필요할 때',
      '솔로 중 셀프 컴핑 — 4도 2~3음 스탭은 한 손가락 모양으로 이동 가능',
    ],
    how: [
      '기본 단위는 스케일 안의 4도 3음 스택. 도리안에서 R–4–b7, 2–5–R, b3–13–9… 모두 같은 손모양(완전4도 2개)이거나 한 음만 다르다.',
      '"So What 보이싱" = 4도 3개 + 위에 장3도 하나 (예: Dm7: D–G–C–E–A... 기타에선 x-5-5-5-5-5 형태). 이 한 폼을 스케일 따라 평행 이동하는 것이 맥코이 어법.',
      '쿼털은 기능이 모호해서 "해결"이 아니라 "이동"으로 쓴다 — 스케일 안에서 2도씩 평행 이동하는 것 자체가 진행이다.',
      '솔로 어휘로도 사용: 4도 인터벌 라인(연속 4도 도약)은 즉시 모던한 멜로디가 된다.',
    ],
    exercises: (key) => {
      const r = key;
      const two = spellInterval(r,2,1);
      return [
        {
          title: '도리안 쿼털 평행 이동 (So What 어법)',
          prog: [chordFrom(r,0,0,'m7'), chordFrom(r,0,0,'m7'), chordFrom(r,0,0,'m7'), chordFrom(r,0,0,'m7')],
          roman: ['Im7 (도리안 뱀프)','—','—','—'],
          guide: `${r} 도리안 안에서 4도 3음 스택을 만들어 스케일 음 따라 위아래로 평행 이동. 기타 폼: 4·3·2번 현에서 같은 프렛 누르기(완전4도 2개) — 도리안 위에서 한 음씩 올리면 자동으로 쿼털 하모니가 흐른다. 2도 이동이 "코드 체인지"처럼 들리는 걸 확인할 것.`,
          scaleRoot: r, scaleName: 'Dorian (Quartal)',
          scaleNote: `${r} 도리안 — 주황 11·b7이 4도 스택의 뼈대.`,
        },
        {
          title: 'ii–V를 쿼털로 컴핑',
          prog: [chordFrom(r,2,1,'m11'), chordFrom(r,7,4,'7sus4'), chordFrom(r,0,0,'maj7'), chordFrom(r,0,0,'6')],
          roman: ['IIm11','V7sus4','Imaj7','I6'],
          guide: `m11과 7sus4는 본질적으로 쿼털 코드다 — ${two}m11(${two}–${spellInterval(two,5,3)}–${spellInterval(two,10,6)}–${spellInterval(two,15,2)} 4도 연쇄). ii–V 전체를 4도 스택 평행 이동으로 컴핑하면 베이스 없이도 모던 재즈 콰르텟 사운드. I 도착에서만 3도 보이싱으로 풀어 "도착감"을 만든다.`,
          scaleRoot: two, scaleName: 'Dorian (Quartal)',
          scaleNote: `${two} 도리안 — m11 쿼털 스택의 재료.`,
        },
        {
          title: '4도 인터벌 솔로 라인',
          prog: [chordFrom(r,0,0,'m7'), chordFrom(r,5,3,'7'), chordFrom(r,0,0,'m7'), chordFrom(r,10,6,'maj7')],
          roman: ['Im7','IV7','Im7','bVIImaj7'],
          guide: `도리안 모달 진행 위에서 연속 4도 도약 라인(예: R↗4↗b7↗b3) — 3도 멜로디에 익숙한 귀에 즉시 "모던"으로 들린다. 규칙: 4도 도약 2~3개 후 반드시 2도 스텝으로 숨 고르기. 도약만 계속되면 음악이 아니라 연습이 된다.`,
          scaleRoot: r, scaleName: 'Dorian (Quartal)',
          scaleNote: `4도 라인도 같은 도리안 안 — 인터벌 선택이 사운드를 바꾼다.`,
        },
      ];
    },
    routine: [
      '4·3·2번 현 동일 프렛 폼으로 도리안 전체를 수평 이동 (12프렛까지)',
      'So What 보이싱(쿼털+장3도) 2위치 암기 → 2도 평행 이동',
      'ii–V–I를 쿼털 컴핑 → I에서만 3도 보이싱 해결, 12키',
      '4도 도약 라인 작곡 3개 — "도약 2~3개 + 스텝 숨고르기" 규칙으로',
    ],
  },
  {
    id: 'bebop',
    title: '비밥 어휘',
    intro: '찰리 파커가 체계화한 선율 문법 — 크로매틱 경과음으로 코드 톤을 정박에 정렬하는 기술. 스케일이 아니라 "타이밍 시스템"이다.',
    when: [
      '8분음표 라인이 코드와 어긋나게 들릴 때 — 비밥 스케일이 정렬을 복원한다',
      'ii–V–I에서 "재즈답게" 들리고 싶을 때 — 인클로저와 3→9 아르페지오',
      '스윙/스트레이트 무관 — 펑크·퓨전·록 솔로에도 크로매틱 어프로치는 그대로 통한다',
      '솔로가 스케일 런처럼 들린다는 느낌이 들 때 (가장 흔한 처방전)',
    ],
    how: [
      '비밥 도미넌트 = 믹솔리디안 + ♮7 경과음. 8음이 되면서 코드 톤(R·3·5·b7)이 전부 정박에 떨어진다 — 하행 8분음표로 직접 확인할 것.',
      '인클로저: 목표 코드 톤을 반음 위 + 스케일 음 아래(또는 그 반대)로 감싸고 착지. 모든 코드 톤에 적용 가능한 만능 장식.',
      '3→9 아르페지오: m7 코드에서 3도부터 쌓는 아르페지오(b3–5–b7–9)는 자동으로 9th 텐션 라인이 된다. Dm7에서 F–A–C–E = Fmaj7 아르페지오를 치는 것.',
      '프레이즈는 "업비트 출발"이 기본 — 1박 정박이 아니라 1박 뒤 8분에서 시작하면 같은 음들도 재즈로 들린다.',
    ],
    exercises: (key) => {
      const r = key;
      const two = spellInterval(r,2,1);
      const five = spellInterval(r,7,4);
      const threeUp = spellInterval(two,3,2);
      return [
        {
          title: '비밥 도미넌트 하행 — 정박 정렬 체험',
          prog: [chordFrom(r,7,4,'7'), chordFrom(r,7,4,'7'), chordFrom(r,0,0,'maj7'), chordFrom(r,0,0,'maj7')],
          roman: ['V7','V7','Imaj7','Imaj7'],
          guide: `${five} 비밥 도미넌트를 루트에서 하행 8분음표로 — R·b7·13·5… 짝수 위치에 경과음이 끼면서 코드 톤이 전부 정박(1·2·3·4박)에 떨어진다. 먼저 믹솔리디안(7음)으로 하행해서 "어긋나는" 걸 듣고, ♮7을 추가해 "정렬되는" 걸 비교 청취할 것.`,
          scaleRoot: five, scaleName: 'Bebop Dominant',
          scaleNote: `${five} 비밥 도미넌트 — 주황 ♮7이 경과음. 화성음이 아니라 타이밍 장치다.`,
        },
        {
          title: 'ii–V–I 인클로저 + 3→9',
          prog: [chordFrom(r,2,1,'m7'), chordFrom(r,7,4,'7'), chordFrom(r,0,0,'maj7'), chordFrom(r,0,0,'6')],
          roman: ['IIm7','V7','Imaj7','I6'],
          guide: `${two}m7에서 3→9 아르페지오(${threeUp}maj7 아르페지오와 동일) → ${five}7의 3도(${spellInterval(five,4,2)})를 인클로저로 감싸 착지 → ${r}maj7의 3도로 해결. 이 한 문장이 비밥 ii–V 어휘의 골격이다. 처음엔 느리게, 음이름을 말하면서.`,
          scaleRoot: five, scaleName: 'Bebop Dominant',
          scaleNote: `V7 구간 스케일. 인클로저 목표음 = 3도(${spellInterval(five,4,2)}).`,
        },
        {
          title: '연속 ii–V 체인 — 어휘 이식 훈련',
          prog: [chordFrom(r,4,2,'m7'), chordFrom(r,9,5,'7'), chordFrom(r,2,1,'m7'), chordFrom(r,7,4,'7')],
          roman: ['IIIm7','V7/II','IIm7','V7'],
          guide: `같은 ii–V 프레이즈를 온음 아래로 이식(${spellInterval(r,4,2)}m7–${spellInterval(r,9,5)}7 → ${two}m7–${five}7). 비밥 어휘는 "한 번 만든 문장을 모든 ii–V에 이식"하는 방식으로 는다. 한 프레이즈를 12키 ii–V에서 즉시 재생할 수 있을 때 비로소 어휘가 된 것.`,
          scaleRoot: spellInterval(r,9,5), scaleName: 'Bebop Dominant',
          scaleNote: `첫 V7(${spellInterval(r,9,5)}7) 구간 스케일 — 같은 모양이 온음 아래로 복제된다.`,
        },
      ];
    },
    routine: [
      '비밥 도미넌트 하행을 메트로놈 2·4 클릭으로 — 코드 톤 정박 확인',
      '인클로저를 메이저 트라이어드 전 코드 톤에 적용, 12키',
      '3→9 사고 변환: m7 코드 보면 "3도 위 maj7 아르페지오" 즉답',
      'ii–V 프레이즈 1개 작곡 → 12키 이식 (5도권 하행)',
      '업비트 출발 훈련: 같은 프레이즈를 정박/업비트 두 버전으로 녹음 비교',
    ],
  },
];

// ═══ UI ══════════════════════════════════════════════════════════════
let activeTopic = 'modal';
let activeKey = 'C';

export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🏋️ 연습실</h1>
    <p style="font-size:0.8rem;color:var(--text2);margin-bottom:14px">고급 화성 어법 트레이닝 — 주제와 키를 선택하면 실전 진행과 지판이 그 키로 생성됩니다.</p>
    <div id="topic-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>
    <div id="key-chips" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px"></div>
    <div id="practice-body"></div>
  `;
  renderChips(panel);
  renderBody(panel);
}

function renderChips(panel) {
  const tc = panel.querySelector('#topic-chips');
  tc.innerHTML = TOPICS.map(t => `
    <button class="topic-chip" data-id="${t.id}" style="padding:7px 14px;border-radius:20px;cursor:pointer;font-size:0.82rem;
      font-weight:${t.id === activeTopic ? '700' : '400'};
      border:1px solid ${t.id === activeTopic ? 'var(--accent)' : 'var(--border)'};
      background:${t.id === activeTopic ? 'var(--accent)' : 'var(--bg2)'};
      color:${t.id === activeTopic ? '#fff' : 'var(--text)'}">${t.title}</button>
  `).join('');
  const kc = panel.querySelector('#key-chips');
  kc.innerHTML = KEYS.map(k => `
    <button class="key-chip" data-key="${k}" style="min-width:34px;padding:5px 0;border-radius:8px;cursor:pointer;font-size:0.78rem;
      font-weight:${k === activeKey ? '700' : '400'};
      border:1px solid ${k === activeKey ? 'var(--accent)' : 'var(--border)'};
      background:${k === activeKey ? 'var(--bg3)' : 'var(--bg2)'};
      color:${k === activeKey ? 'var(--accent)' : 'var(--text2)'}">${k}</button>
  `).join('');

  tc.querySelectorAll('.topic-chip').forEach(b => b.addEventListener('click', () => {
    activeTopic = b.dataset.id; renderChips(panel); renderBody(panel);
  }));
  kc.querySelectorAll('.key-chip').forEach(b => b.addEventListener('click', () => {
    activeKey = b.dataset.key; renderChips(panel); renderBody(panel);
  }));
}

function renderBody(panel) {
  const t = TOPICS.find(x => x.id === activeTopic);
  const exercises = t.exercises(activeKey);

  const exHtml = exercises.map((ex, i) => `
    <div class="card">
      <div style="font-weight:700;font-size:0.95rem;color:var(--accent)">연습 ${i+1}. ${ex.title}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
        ${ex.prog.map((ch, j) => `
          <div style="flex:1;min-width:70px;text-align:center;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 4px">
            <div style="font-weight:700;font-size:0.95rem">${ch}</div>
            <div style="font-size:0.65rem;color:var(--text2);margin-top:2px">${ex.roman[j]}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:0.82rem;line-height:1.7;background:var(--bg2);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;padding:10px 12px">${ex.guide}</div>
      <div style="margin-top:12px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--text2);margin-bottom:4px">
          ${ex.scaleRoot} ${ex.scaleName}
          <span style="font-weight:400">· ${SCALES[ex.scaleName].parent(ex.scaleRoot)}</span>
        </div>
        <div style="font-size:0.72rem;color:var(--text2);margin-bottom:6px">
          구성음: ${scaleNotes(ex.scaleRoot, ex.scaleName).map(n =>
            n.isColor ? `<strong style="color:#f0a500">${n.name}(${n.deg})</strong>` : n.deg === 'R' ? `<strong style="color:var(--accent)">${n.name}</strong>` : n.name
          ).join(' · ')}
        </div>
        ${fretboardSVG(ex.scaleRoot, ex.scaleName)}
        <div style="font-size:0.74rem;color:var(--text2);margin-top:4px;line-height:1.5">${ex.scaleNote}</div>
      </div>
    </div>
  `).join('');

  panel.querySelector('#practice-body').innerHTML = `
    <div class="card">
      <div style="font-size:1.1rem;font-weight:700">${t.title}</div>
      <p style="font-size:0.85rem;line-height:1.7;margin-top:8px">${t.intro}</p>
    </div>
    <div class="card">
      <div class="section-label">언제 쓰는가</div>
      <ul style="margin:6px 0 0;padding-left:18px">
        ${t.when.map(w => `<li style="font-size:0.82rem;line-height:1.7;margin-bottom:4px">${w}</li>`).join('')}
      </ul>
    </div>
    <div class="card">
      <div class="section-label">어떻게 연주하는가</div>
      <ul style="margin:6px 0 0;padding-left:18px">
        ${t.how.map(h => `<li style="font-size:0.82rem;line-height:1.7;margin-bottom:6px">${h}</li>`).join('')}
      </ul>
    </div>
    <div style="font-size:0.85rem;font-weight:700;color:var(--text2);margin:18px 0 8px;text-transform:uppercase;letter-spacing:0.5px">
      ${activeKey} 키 실전 연습
    </div>
    ${exHtml}
    <div class="card">
      <div class="section-label">연습 루틴</div>
      <ol style="margin:6px 0 0;padding-left:20px">
        ${t.routine.map(p => `<li style="font-size:0.82rem;line-height:1.7;margin-bottom:5px">${p}</li>`).join('')}
      </ol>
      <div style="font-size:0.72rem;color:var(--text2);margin-top:10px;border-top:1px dashed var(--border);padding-top:8px">
        💡 범례 — <span style="color:var(--accent);font-weight:700">파랑</span>: 루트 · <span style="color:#f0a500;font-weight:700">주황</span>: 특성음(이 어법의 정체성) · 회색: 나머지 스케일 톤
      </div>
    </div>
  `;
}
