import { AppState, goTo, on } from './app.js';

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};

const SCALES = [
  { name:'Minor Pentatonic',   intervals:[0,3,5,7,10] },
  { name:'Major Pentatonic',   intervals:[0,2,4,7,9] },
  { name:'Blues',              intervals:[0,3,5,6,7,10] },
  { name:'Natural Minor',      intervals:[0,2,3,5,7,8,10] },
  { name:'Major (Ionian)',     intervals:[0,2,4,5,7,9,11] },
  { name:'Dorian',             intervals:[0,2,3,5,7,9,10] },
  { name:'Mixolydian',         intervals:[0,2,4,5,7,9,10] },
  { name:'Lydian',             intervals:[0,2,4,6,7,9,11] },
  { name:'Harmonic Minor',     intervals:[0,2,3,5,7,8,11] },
  { name:'Melodic Minor',      intervals:[0,2,3,5,7,9,11] },
  { name:'Lydian Dominant',    intervals:[0,2,4,6,7,9,10] },
  { name:'Altered',            intervals:[0,1,3,4,6,8,10] },
];

// 기타리스트별 스케일 추천
const STYLE_SCALES = {
  'Nick Johnston':  ['Harmonic Minor','Lydian','Melodic Minor','Major (Ionian)'],
  'Mark Lettieri':  ['Dorian','Mixolydian','Minor Pentatonic','Major Pentatonic'],
  'Guthrie Govan':  ['Natural Minor','Dorian','Blues','Mixolydian','Altered'],
  'Joe Satriani':   ['Lydian','Lydian Dominant','Minor Pentatonic','Harmonic Minor'],
  'John Mayer':     ['Minor Pentatonic','Blues','Dorian','Mixolydian'],
};

// 기타 줄 개방현 MIDI 번호 (low E=0기준 상대)
const OPEN = [0,5,10,15,19,24]; // E A D G B e

function noteIdx(note) {
  const n = ENHARMONIC[note] || note;
  return NOTES.indexOf(n);
}

function drawScaleDiagram(rootIdx, intervals) {
  const scaleNotes = new Set(intervals.map(i => (rootIdx + i) % 12));
  const fretCount = 12, strings = 6;
  const cellW = 28, cellH = 26, offsetX = 28, offsetY = 20;
  const W = offsetX + cellW * fretCount + 10;
  const H = offsetY + cellH * (strings - 1) + 20;

  let svg = '';
  // 줄
  for (let s = 0; s < strings; s++) {
    const y = offsetY + s * cellH;
    svg += `<line x1="${offsetX}" y1="${y}" x2="${offsetX + cellW * fretCount}" y2="${y}" stroke="var(--text2)" stroke-width="1"/>`;
  }
  // 프렛
  for (let f = 0; f <= fretCount; f++) {
    const x = offsetX + f * cellW;
    svg += `<line x1="${x}" y1="${offsetY}" x2="${x}" y2="${offsetY + cellH * (strings-1)}" stroke="var(--border)" stroke-width="${f === 0 ? 2 : 1}"/>`;
  }
  // 음표
  for (let s = 0; s < strings; s++) {
    const openNote = OPEN[s] % 12;
    for (let f = 0; f <= fretCount; f++) {
      const note = (openNote + f) % 12;
      if (scaleNotes.has(note)) {
        const x = offsetX + f * cellW;
        const y = offsetY + s * cellH;
        const isRoot = note === rootIdx % 12;
        svg += `<circle cx="${x}" cy="${y}" r="9" fill="${isRoot ? 'var(--accent)' : 'var(--bg3)'}" stroke="${isRoot ? 'var(--accent)' : 'var(--text2)'}" stroke-width="1.5"/>`;
        svg += `<text x="${x}" y="${y+4}" fill="${isRoot ? '#fff' : 'var(--text2)'}" font-size="8" text-anchor="middle">${NOTES[note]}</text>`;
      }
    }
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="max-width:100%;overflow-x:auto">${svg}</svg>`;
}

export function render(panel) {
  const state = AppState.currentAnalysis;
  const selKey = ENHARMONIC[state.detectedKey] || state.detectedKey; // Bb → A# 등 플랫 표기 호환

  panel.innerHTML = `
    <h1 class="page-title">🎯 솔로 메이킹</h1>
    <div class="card">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <div class="label">키</div>
          <select id="key-select">
            ${NOTES.map(n => `<option value="${n}" ${selKey === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:120px">
          <div class="label">모드</div>
          <select id="mode-select">
            <option value="major" ${state.mode === 'major' ? 'selected' : ''}>Major</option>
            <option value="minor" ${state.mode === 'minor' ? 'selected' : ''}>Minor</option>
          </select>
        </div>
        <div style="flex:1;min-width:140px">
          <div class="label">스타일 필터</div>
          <select id="style-select">
            <option value="">없음</option>
            ${Object.keys(STYLE_SCALES).map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="solo-btn">스케일 추천</button>
      </div>
    </div>
    <div id="solo-result"></div>
  `;

  panel.querySelector('#solo-btn').addEventListener('click', () => run(panel));

  on('route-payload', payload => {
    if (payload?.key) {
      panel.querySelector('#key-select').value = payload.key;
      if (payload.mode) panel.querySelector('#mode-select').value = payload.mode;
      run(panel);
    }
  });

  if (state.detectedKey) run(panel);
}

function run(panel) {
  const key = panel.querySelector('#key-select').value;
  const mode = panel.querySelector('#mode-select').value;
  const style = panel.querySelector('#style-select').value;
  const rootIdx = NOTES.indexOf(key);
  const result = panel.querySelector('#solo-result');

  let scales = SCALES;
  if (style) {
    const preferred = STYLE_SCALES[style] || [];
    scales = [...SCALES.filter(s => preferred.includes(s.name)), ...SCALES.filter(s => !preferred.includes(s.name))];
  }

  const rows = scales.map(s => {
    const isPreferred = style && STYLE_SCALES[style]?.includes(s.name);
    return `
      <div class="scale-row" data-root="${rootIdx}" data-intervals="${s.intervals.join(',')}" data-name="${key} ${s.name}">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:600;font-size:0.9rem">${key} ${s.name}</span>
          ${isPreferred ? `<span class="badge badge-accent">${style.split(' ')[0]}</span>` : ''}
        </div>
        <div style="font-size:0.78rem;color:var(--text2);margin-top:2px">
          ${s.intervals.map(i => NOTES[(rootIdx + i) % 12]).join(' · ')}
        </div>
        <button class="btn btn-secondary toggle-diagram" style="margin-top:8px;font-size:0.78rem;padding:5px 10px">다이어그램 보기/숨기기</button>
        <div class="scale-diagram" style="display:none;overflow-x:auto;margin-top:8px">
          ${drawScaleDiagram(rootIdx, s.intervals)}
        </div>
      </div>
    `;
  }).join('');

  const styleLink = style ? `<div class="btn-row"><button class="btn btn-link" id="to-library-btn">스타일 라이브러리 보기 →</button></div>` : '';

  result.innerHTML = `
    <div class="card">
      <div class="section-label">${key} ${mode} 추천 스케일 ${style ? `— ${style} 스타일` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">${rows}</div>
    </div>
    ${styleLink}
    <style>
      .scale-row{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px}
    </style>
  `;

  // 이벤트 위임으로 인라인 onclick 제거
  result.querySelectorAll('.toggle-diagram').forEach(btn => {
    btn.addEventListener('click', () => {
      const diag = btn.closest('.scale-row').querySelector('.scale-diagram');
      diag.style.display = diag.style.display === 'none' ? 'block' : 'none';
    });
  });

  if (style) {
    result.querySelector('#to-library-btn')?.addEventListener('click', () => goTo(5, { artist: style }));
  }
}
