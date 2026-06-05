import { goTo, on } from './app.js';

// 코드 보이싱 DB: [fret, fret, fret, fret, fret, fret] (6현 low E→high e), -1=뮤트, 0=개방
const VOICINGS = {
  'C':     [[-1,3,2,0,1,0], [-1,3,5,5,5,3]],
  'Cm':    [[-1,3,5,5,4,3], [8,10,10,9,8,8]],
  'Cmaj7': [-1,3,2,0,0,0],
  'Cm7':   [-1,3,5,3,4,3],
  'C7':    [-1,3,2,3,1,0],
  'D':     [-1,-1,0,2,3,2],
  'Dm':    [-1,-1,0,2,3,1],
  'Dmaj7': [-1,-1,0,2,2,2],
  'Dm7':   [-1,-1,0,2,1,1],
  'D7':    [-1,-1,0,2,1,2],
  'E':     [0,2,2,1,0,0],
  'Em':    [0,2,2,0,0,0],
  'Emaj7': [0,2,1,1,0,0],
  'Em7':   [0,2,2,0,3,0],
  'E7':    [0,2,0,1,0,0],
  'F':     [1,3,3,2,1,1],
  'Fm':    [1,3,3,1,1,1],
  'Fmaj7': [-1,-1,3,2,1,0],
  'Fm7':   [1,3,1,1,1,1],
  'F7':    [1,3,1,2,1,1],
  'G':     [3,2,0,0,0,3],
  'Gm':    [3,5,5,3,3,3],
  'Gmaj7': [3,2,0,0,0,2],
  'Gm7':   [3,5,3,3,3,3],
  'G7':    [3,2,0,0,0,1],
  'A':     [-1,0,2,2,2,0],
  'Am':    [-1,0,2,2,1,0],
  'Amaj7': [-1,0,2,1,2,0],
  'Am7':   [-1,0,2,0,1,0],
  'A7':    [-1,0,2,0,2,0],
  'B':     [-1,2,4,4,4,2],
  'Bm':    [-1,2,4,4,3,2],
  'Bmaj7': [-1,2,4,3,4,2],
  'Bm7':   [-1,2,4,2,3,2],
  'B7':    [-1,2,1,2,0,-1],
};

const OPEN_STRINGS = [4,9,2,7,11,4]; // E A D G B e (MIDI 기준 음이름 인덱스)

function getVoicings(chord) {
  const v = VOICINGS[chord];
  if (!v) return [];
  return Array.isArray(v[0]) ? v : [v];
}

function drawDiagram(frets, leftHanded = false) {
  const strings = leftHanded ? [...frets].reverse() : frets;
  const validFrets = strings.filter(f => f > 0);
  if (!validFrets.length) { var minFret = 1; var maxFret = 5; }
  else {
    var minFret = Math.max(1, Math.min(...validFrets));
    var maxFret = Math.max(minFret + 4, Math.max(...validFrets));
  }
  const fretCount = Math.min(maxFret - minFret + 1, 5);
  const W = 200, cellW = 28, cellH = 30;
  const offsetX = 30, offsetY = 40;
  const totalW = offsetX + cellW * 5 + 20;
  const totalH = offsetY + cellH * fretCount + 20;

  let svgContent = '';
  // 세로줄 (현)
  for (let s = 0; s < 6; s++) {
    const x = offsetX + s * cellW;
    svgContent += `<line x1="${x}" y1="${offsetY}" x2="${x}" y2="${offsetY + cellH * fretCount}" stroke="var(--text2)" stroke-width="1.5"/>`;
  }
  // 가로줄 (프렛)
  for (let f = 0; f <= fretCount; f++) {
    const y = offsetY + f * cellH;
    const sw = f === 0 ? 3 : 1;
    svgContent += `<line x1="${offsetX}" y1="${y}" x2="${offsetX + cellW * 5}" y2="${y}" stroke="var(--text)" stroke-width="${sw}"/>`;
  }
  // 프렛 번호 (min > 1)
  if (minFret > 1) {
    svgContent += `<text x="${offsetX - 8}" y="${offsetY + cellH * 0.7}" fill="var(--text2)" font-size="11" text-anchor="end">${minFret}fr</text>`;
  }
  // 운지점 / 개방현 / 뮤트
  const dotColors = ['var(--danger)', '#4CAF50', '#2196F3', 'var(--link)', 'var(--text2)', 'var(--accent)'];
  strings.forEach((fret, si) => {
    const x = offsetX + si * cellW;
    if (fret === -1) {
      svgContent += `<text x="${x}" y="${offsetY - 10}" fill="var(--danger)" font-size="14" text-anchor="middle" font-weight="bold">×</text>`;
    } else if (fret === 0) {
      svgContent += `<circle cx="${x}" cy="${offsetY - 12}" r="6" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    } else {
      const relFret = fret - minFret + 1;
      const cy = offsetY + (relFret - 0.5) * cellH;
      svgContent += `<circle cx="${x}" cy="${cy}" r="10" fill="${dotColors[si % dotColors.length]}"/>`;
    }
  });

  return `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">${svgContent}</svg>`;
}

export function render(panel) {
  const settings = JSON.parse(localStorage.getItem('gta_settings') || '{}');
  const leftHanded = settings.leftHanded || false;

  panel.innerHTML = `
    <h1 class="page-title">🎼 코드 보이싱</h1>
    <div class="card">
      <div class="label">코드 검색</div>
      <input type="text" id="chord-input" placeholder="예: Am7, Gmaj7, D7">
      <div class="btn-row">
        <button class="btn btn-primary" id="search-btn">검색</button>
      </div>
    </div>
    <div id="voicing-result"></div>
  `;

  const input = panel.querySelector('#chord-input');
  const result = panel.querySelector('#voicing-result');

  function search() {
    const val = input.value.trim();
    if (!val) return;
    const voicings = getVoicings(val);
    if (!voicings.length) {
      result.innerHTML = `<div class="empty-state">코드를 찾을 수 없습니다.<br><small>예: C, Am, Gmaj7, D7</small></div>`;
      return;
    }
    const diagrams = voicings.map((v, i) => `
      <div style="text-align:center;margin-right:20px">
        <div style="font-size:0.8rem;color:var(--text2);margin-bottom:4px">보이싱 ${i+1}</div>
        ${drawDiagram(v, leftHanded)}
      </div>
    `).join('');

    result.innerHTML = `
      <div class="card">
        <div style="font-size:1.3rem;font-weight:700;color:var(--accent);margin-bottom:12px">${val}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${diagrams}</div>
        <hr class="divider">
        <button class="btn btn-link" id="to-chart">코드차트에 추가 →</button>
      </div>
    `;
    result.querySelector('#to-chart').addEventListener('click', () => {
      import('./app.js').then(({ goTo }) => goTo(7, { chord: val }));
    });
  }

  panel.querySelector('#search-btn').addEventListener('click', search);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

  // 탭1 연동
  on('route-payload', payload => {
    if (payload?.chord) { input.value = payload.chord; search(); }
  });
}
