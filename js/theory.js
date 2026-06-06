import { AppState, goTo, emit, on } from './app.js';

// ===== 음악이론 엔진 =====
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B','E#':'F','B#':'C'};

// 메이저 스케일 인터벌
const MAJOR_INTERVALS = [0,2,4,5,7,9,11];
const MINOR_INTERVALS = [0,2,3,5,7,8,10];

// 코드 타입 → 구성음 인터벌
const CHORD_INTERVALS = {
  'maj': [0,4,7], 'maj7': [0,4,7,11], 'maj9': [0,4,7,11,14],
  'm': [0,3,7], 'min': [0,3,7], 'm7': [0,3,7,10], 'm9': [0,3,7,10,14],
  '7': [0,4,7,10], '9': [0,4,7,10,14], '11': [0,4,7,10,14,17],
  'dim': [0,3,6], 'dim7': [0,3,6,9], 'm7b5': [0,3,6,10],
  'aug': [0,4,8], 'sus2': [0,2,7], 'sus4': [0,5,7],
  '6': [0,4,7,9], 'm6': [0,3,7,9], 'add9': [0,4,7,14],
};

// 스케일 데이터
const SCALES = [
  { name: 'Major (Ionian)',      intervals: [0,2,4,5,7,9,11] },
  { name: 'Natural Minor',       intervals: [0,2,3,5,7,8,10] },
  { name: 'Dorian',              intervals: [0,2,3,5,7,9,10] },
  { name: 'Phrygian',            intervals: [0,1,3,5,7,8,10] },
  { name: 'Lydian',              intervals: [0,2,4,6,7,9,11] },
  { name: 'Mixolydian',          intervals: [0,2,4,5,7,9,10] },
  { name: 'Locrian',             intervals: [0,1,3,5,6,8,10] },
  { name: 'Harmonic Minor',      intervals: [0,2,3,5,7,8,11] },
  { name: 'Melodic Minor',       intervals: [0,2,3,5,7,9,11] },
  { name: 'Minor Pentatonic',    intervals: [0,3,5,7,10] },
  { name: 'Major Pentatonic',    intervals: [0,2,4,7,9] },
  { name: 'Blues',               intervals: [0,3,5,6,7,10] },
  { name: 'Lydian Dominant',     intervals: [0,2,4,6,7,9,10] },
  { name: 'Altered',             intervals: [0,1,3,4,6,8,10] },
  { name: 'Whole Tone',          intervals: [0,2,4,6,8,10] },
  { name: 'Diminished (HW)',     intervals: [0,1,3,4,6,7,9,10] },
];

function noteToIdx(note) {
  const n = ENHARMONIC[note] || note;
  return NOTES.indexOf(n);
}

function parseChord(str) {
  str = str.trim();
  // 루트 추출 (A# / Bb 등 포함)
  const m = str.match(/^([A-G][#b]?)(.*)/);
  if (!m) return null;
  const root = m[1];
  const typeRaw = m[2].trim() || 'maj';
  const type = typeRaw === '' ? 'maj' : typeRaw;
  const idx = noteToIdx(root);
  if (idx === -1) return null;
  return { root, type, idx };
}

function getChordNotes(chord) {
  const intervals = CHORD_INTERVALS[chord.type] || CHORD_INTERVALS['maj'];
  return intervals.map(i => (chord.idx + i) % 12);
}

// 다이아토닉 코드 목록 (7개) - 메이저 기준
const DIATONIC_TYPES_MAJOR = ['maj','m','m','maj','7','m','m7b5'];
const DIATONIC_TYPES_MINOR = ['m','m7b5','maj','m','m','maj','7'];
const DEGREES = ['I','II','III','IV','V','VI','VII'];

function getDiatonicChords(keyIdx, isMinor) {
  const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const types = isMinor ? DIATONIC_TYPES_MINOR : DIATONIC_TYPES_MAJOR;
  return intervals.map((interval, i) => ({
    root: NOTES[(keyIdx + interval) % 12],
    type: types[i],
    degree: DEGREES[i]
  }));
}

function detectKey(chords) {
  let best = null, bestScore = -1;
  for (let ki = 0; ki < 12; ki++) {
    for (const isMinor of [false, true]) {
      const diatonic = getDiatonicChords(ki, isMinor);
      let score = 0;
      for (const c of chords) {
        if (diatonic.some(d => d.root === c.root && (d.type === c.type || (d.type === 'maj' && c.type === 'maj7') || (d.type === 'm' && c.type === 'm7')))) {
          score++;
        }
      }
      // 동점 시: major 우선, 마지막 코드가 I인 키 우선
      const lastChord = chords[chords.length - 1];
      const lastIsI = diatonic[0].root === lastChord?.root;
      const tiebreaker = (!isMinor ? 0.1 : 0) + (lastIsI ? 0.05 : 0);
      if (score + tiebreaker > bestScore) {
        bestScore = score + tiebreaker;
        best = { keyIdx: ki, isMinor, score };
      }
    }
  }
  return best;
}

function analyzeDiatonic(chords, keyResult) {
  const { keyIdx, isMinor } = keyResult;
  const diatonic = getDiatonicChords(keyIdx, isMinor);

  return chords.map(chord => {
    const match = diatonic.find(d => d.root === chord.root);
    if (match) {
      return { ...chord, degree: match.degree, status: 'diatonic' };
    }
    // Secondary dominant 체크: 다음 코드의 V7?
    const secDom = detectSecondaryDominant(chord, diatonic);
    if (secDom) return { ...chord, degree: `V/${secDom}`, status: 'secondary' };
    // Borrowed chord
    const borrowed = detectBorrowed(chord, keyIdx, isMinor);
    if (borrowed) return { ...chord, degree: borrowed, status: 'borrowed' };
    return { ...chord, degree: '?', status: 'chromatic' };
  });
}

function detectSecondaryDominant(chord, diatonic) {
  if (chord.type !== '7') return null;
  for (const d of diatonic) {
    const targetIdx = noteToIdx(d.root);
    if (targetIdx === -1) continue;
    if ((targetIdx + 5) % 12 === noteToIdx(chord.root)) return d.degree;
  }
  return null;
}

function detectBorrowed(chord, keyIdx, isMinor) {
  const parallel = getDiatonicChords(keyIdx, !isMinor);
  const match = parallel.find(d => d.root === chord.root && d.type === chord.type);
  if (match) return `${match.degree}(borrowed)`;
  return null;
}

function recommendScales(chords) {
  const allNotes = new Set();
  for (const c of chords) getChordNotes(c).forEach(n => allNotes.add(n));

  return SCALES.map(scale => {
    // 각 루트에서 스케일 구성음 계산해서 가장 높은 포함율 찾기
    let maxScore = 0;
    let bestRoot = '';
    for (let ri = 0; ri < 12; ri++) {
      const scaleNotes = new Set(scale.intervals.map(i => (ri + i) % 12));
      let match = 0;
      allNotes.forEach(n => { if (scaleNotes.has(n)) match++; });
      const score = match / allNotes.size;
      if (score > maxScore) { maxScore = score; bestRoot = NOTES[ri]; }
    }
    return { ...scale, score: maxScore, root: bestRoot };
  }).filter(s => s.score >= 0.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function parseProgression(input) {
  return input.split(/[\-\/,\s]+/).map(s => s.trim()).filter(Boolean).map(parseChord).filter(Boolean);
}

// ===== UI 렌더 =====
export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🎸 이론 분석</h1>
    <div class="card">
      <div class="label">코드 진행 입력</div>
      <input type="text" id="prog-input" placeholder="예: Am7 - D7 - Gmaj7 - Cmaj7" value="${AppState.currentAnalysis.progression.join(' - ')}">
      <div class="btn-row">
        <button class="btn btn-primary" id="analyze-btn">분석</button>
        <button class="btn btn-secondary" id="clear-btn">초기화</button>
      </div>
    </div>
    <div id="analysis-result"></div>
  `;

  panel.querySelector('#analyze-btn').addEventListener('click', () => runAnalysis(panel));
  panel.querySelector('#clear-btn').addEventListener('click', () => {
    panel.querySelector('#prog-input').value = '';
    panel.querySelector('#analysis-result').innerHTML = '';
  });
  panel.querySelector('#prog-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') runAnalysis(panel);
  });

  // 이전 분석 결과 복원
  if (AppState.currentAnalysis.diatonic.length) showResult(panel, AppState.currentAnalysis);

  // AI 분석 결과 수신 (sheets.js의 runAiAnalysis에서 goTo(1, {progression}) 호출 시)
  on('route-payload', payload => {
    if (payload?.progression) {
      panel.querySelector('#prog-input').value = payload.progression;
      runAnalysis(panel);
    }
  });
}

function runAnalysis(panel) {
  const input = panel.querySelector('#prog-input').value;
  const chords = parseProgression(input);
  if (!chords.length) return;

  const keyResult = detectKey(chords);
  const diatonic = analyzeDiatonic(chords, keyResult);
  const scales = recommendScales(chords);
  const keyNote = NOTES[keyResult.keyIdx];
  const mode = keyResult.isMinor ? 'minor' : 'major';

  const result = {
    progression: chords.map(c => c.root + (c.type === 'maj' ? '' : c.type)),
    detectedKey: keyNote,
    mode,
    diatonic,
    scales
  };
  Object.assign(AppState.currentAnalysis, result);
  showResult(panel, result);
}

function showResult(panel, result) {
  const statusColor = { diatonic: 'var(--accent)', secondary: 'var(--link)', borrowed: '#a0c0ff', chromatic: 'var(--text2)' };
  const statusLabel = { diatonic: '다이아토닉', secondary: 'Secondary Dom', borrowed: 'Borrowed', chromatic: '크로매틱' };

  const chordCards = result.diatonic.map(c => {
    const notes = getChordNotes(c);
    const noteNames = notes.map(n => NOTES[n]).join(' · ');
    const color = statusColor[c.status];
    return `
      <div class="chord-card">
        <div class="chord-name">${c.root}${c.type === 'maj' ? '' : c.type}</div>
        <div class="chord-degree" style="color:${color}">${c.degree}</div>
        <div class="chord-status" style="color:${color};font-size:0.7rem">${statusLabel[c.status]}</div>
        <div class="chord-notes">${noteNames}</div>
      </div>
    `;
  }).join('');

  const scaleRows = result.scales.map(s => `
    <tr>
      <td>${s.root} ${s.name}</td>
      <td style="color:var(--accent)">${Math.round(s.score * 100)}%</td>
    </tr>
  `).join('');

  panel.querySelector('#analysis-result').innerHTML = `
    <div class="card">
      <div class="section-label">감지된 키</div>
      <div style="font-size:1.4rem;font-weight:700;color:var(--accent);margin-bottom:4px">
        ${result.detectedKey} ${result.mode}
      </div>
    </div>
    <div class="card">
      <div class="section-label">다이아토닉 분석</div>
      <div class="chord-grid">${chordCards}</div>
    </div>
    <div class="card">
      <div class="section-label">추천 스케일</div>
      <table class="scale-table">
        <thead><tr><th>스케일</th><th>포함율</th></tr></thead>
        <tbody>${scaleRows}</tbody>
      </table>
    </div>
    <div class="btn-row">
      <button class="btn btn-link" id="to-voicing">코드 보이싱 보기 →</button>
      <button class="btn btn-link" id="to-solo">솔로 메이킹 →</button>
    </div>
    <style>
      .chord-grid { display:flex; flex-wrap:wrap; gap:10px; }
      .chord-card { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius); padding:10px 14px; min-width:90px; }
      .chord-name { font-weight:700; font-size:1rem; }
      .chord-degree { font-size:0.9rem; font-weight:600; margin-top:2px; }
      .chord-notes { font-size:0.72rem; color:var(--text2); margin-top:4px; }
      .scale-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
      .scale-table th { text-align:left; color:var(--text2); padding:6px 0; border-bottom:1px solid var(--border); font-weight:500; }
      .scale-table td { padding:6px 0; border-bottom:1px solid var(--border); }
    </style>
  `;

  panel.querySelector('#to-voicing').addEventListener('click', () => {
    goTo(2, { chord: result.diatonic[0]?.root + (result.diatonic[0]?.type === 'maj' ? '' : result.diatonic[0]?.type) });
  });
  panel.querySelector('#to-solo').addEventListener('click', () => {
    goTo(3, { key: result.detectedKey, mode: result.mode });
  });
}
