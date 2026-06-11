import { goTo, on } from './app.js';
import { parseChord, spellInterval } from './theory.js';

// ═══════════════════════════════════════════════════════════════════
//  보이싱 엔진 — Drop 2 / Drop 3 / 셸 보이싱을 코드 공식에서 자동 계산
//  버클리/MI 커리큘럼: 4성부 close → drop 변환 → 현 세트별 매핑
// ═══════════════════════════════════════════════════════════════════

// 표준 튜닝 MIDI (low E → high e)
const TUNING = [40, 45, 50, 55, 59, 64];
const STRING_NAMES = ['E','A','D','G','B','e'];
const MAX_FRET = 15;

// ── 4성부 코드 톤 추출 ──────────────────────────────────────────────
// 반환: [{semi, deg, letterSteps}] × 4 (R, 3rd, 5th, 7th 계열)
function fourNoteTones(c) {
  const iv = c.intervals;
  const pick = (cands) => cands.find(x => iv.includes(x.semi));

  const root  = { semi: 0, deg: 'R', letterSteps: 0 };
  const third = pick([
    { semi: 4, deg: '3', letterSteps: 2 }, { semi: 3, deg: 'b3', letterSteps: 2 },
    { semi: 5, deg: '4', letterSteps: 3 }, { semi: 2, deg: '2', letterSteps: 1 },
  ]);
  const fifth = pick([
    { semi: 7, deg: '5', letterSteps: 4 }, { semi: 6, deg: 'b5', letterSteps: 4 }, { semi: 8, deg: '#5', letterSteps: 4 },
  ]);
  const seventh = pick([
    { semi: 11, deg: '7', letterSteps: 6 }, { semi: 10, deg: 'b7', letterSteps: 6 },
    { semi: 9,  deg: c.type.includes('dim') ? 'bb7' : '6', letterSteps: c.type.includes('dim') ? 6 : 5 },
  ]);

  if (!third || !fifth) return null;

  // 트라이어드 → 7th 자동 확장
  let extended = null;
  let sev = seventh;
  if (!sev) {
    if (third.semi === 3) { sev = { semi: 10, deg: 'b7', letterSteps: 6 }; extended = 'm7'; }
    else { sev = { semi: 11, deg: '7', letterSteps: 6 }; extended = 'maj7'; }
  }
  return { tones: [root, third, fifth, sev], extended };
}

// ── close 스택 → 인버전 → drop 변환 ─────────────────────────────────
// 인버전 i: tones를 i만큼 회전한 순서로 위로 쌓음 → 절대 피치(상대) 배열
function closeStack(tones, inv) {
  const order = [...tones.slice(inv), ...tones.slice(0, inv)];
  const pitches = [];
  let prev = -1;
  for (const t of order) {
    let p = t.semi;
    while (p <= prev) p += 12;
    pitches.push({ pitch: p, tone: t });
    prev = p;
  }
  return pitches; // 낮은음 → 높은음 4개
}

function dropTransform(stack, dropIdxFromTop) {
  // stack: 오름차순 4음. dropIdxFromTop: 2 → drop2 (위에서 2번째), 3 → drop3
  const arr = stack.map(x => ({ ...x }));
  const idx = arr.length - dropIdxFromTop;
  arr[idx].pitch -= 12;
  return arr.sort((a, b) => a.pitch - b.pitch);
}

// ── 현 세트에 매핑 ───────────────────────────────────────────────────
// voiced: 오름차순 4음 {pitch(상대), tone}; strings: 현 인덱스 4개 (낮은현→높은현)
function mapToStrings(voiced, strings, rootIdx) {
  const results = [];
  for (let oct = 2; oct <= 6; oct++) {
    const base = rootIdx + oct * 12;
    const frets = [];
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const midi = base + voiced[i].pitch;
      const fret = midi - TUNING[strings[i]];
      if (fret < 0 || fret > MAX_FRET) { ok = false; break; }
      frets.push(fret);
    }
    if (ok) results.push(frets);
  }
  if (!results.length) return null;
  // 가장 낮은 포지션 선택
  results.sort((a, b) => Math.min(...a) - Math.min(...b));
  return results[0];
}

// 6현 프렛 배열로 변환 (-1 = 뮤트)
function toSixString(strings, frets, tones) {
  const out = Array(6).fill(-1);
  const degs = Array(6).fill(null);
  strings.forEach((s, i) => { out[s] = frets[i]; degs[s] = tones[i].tone.deg; });
  return { frets: out, degs };
}

// ── 보이싱 세트 생성 ─────────────────────────────────────────────────
const DROP2_SETS = [
  { label: '1~4번 현', strings: [2,3,4,5] },
  { label: '2~5번 현', strings: [1,2,3,4] },
  { label: '3~6번 현', strings: [0,1,2,3] },
];
const DROP3_SETS = [
  { label: '6-4-3-2번 현', strings: [0,2,3,4] },
  { label: '5-3-2-1번 현', strings: [1,3,4,5] },
];

function buildVoicings(c, kind) {
  const fn = fourNoteTones(c);
  if (!fn) return null;
  const { tones, extended } = fn;
  const sets = kind === 'drop2' ? DROP2_SETS : DROP3_SETS;
  const dropN = kind === 'drop2' ? 2 : 3;

  const bySet = sets.map(set => {
    const inversions = [];
    for (let inv = 0; inv < 4; inv++) {
      const stack = closeStack(tones, inv);
      const voiced = dropTransform(stack, dropN);
      const mapped = mapToStrings(voiced, set.strings, c.idx);
      if (!mapped) continue;
      const six = toSixString(set.strings, mapped, voiced.map((v) => v));
      const bassDeg = voiced[0].tone.deg;
      inversions.push({ ...six, bassDeg, inv });
    }
    return { ...set, inversions };
  }).filter(s => s.inversions.length);

  return { bySet, extended, tones };
}

// ═══ 보이스 리딩 엔진 ═══════════════════════════════════════════════
// 코드별 모든 후보 (전 인버전 × 전 현세트 × 전 옥타브 위치) — 절대 피치 포함
function drop2Candidates(c, kind = 'drop2') {
  const fn = fourNoteTones(c);
  if (!fn) return [];
  const out = [];
  const sets = kind === 'drop3' ? DROP3_SETS : DROP2_SETS;
  const dropN = kind === 'drop3' ? 3 : 2;
  for (const set of sets) {
    for (let inv = 0; inv < 4; inv++) {
      const stack = closeStack(fn.tones, inv);
      const voiced = dropTransform(stack, dropN);
      for (let oct = 2; oct <= 6; oct++) {
        const base = c.idx + oct * 12;
        const frets = [], pitches = [];
        let ok = true;
        for (let i = 0; i < 4; i++) {
          const midi = base + voiced[i].pitch;
          const fret = midi - TUNING[set.strings[i]];
          if (fret < 0 || fret > MAX_FRET) { ok = false; break; }
          frets.push(fret); pitches.push(midi);
        }
        if (!ok) continue;
        const six = toSixString(set.strings, frets, voiced);
        out.push({ ...six, pitches, setLabel: set.label, bassDeg: voiced[0].tone.deg,
          avgFret: frets.reduce((a, b) => a + b, 0) / 4, extended: fn.extended });
      }
    }
  }
  return out;
}

// DP로 전체 진행의 최소 움직임 경로 탐색
// opts: kind('drop2'|'drop3') / center(선호 프렛 중심) / topDir('down'|'up' 탑노트 라인 방향 유도)
function voiceLead(chords, opts = {}) {
  const { kind = 'drop2', center = 6, topDir = null } = opts;
  const cands = chords.map(c => drop2Candidates(c, kind));
  if (cands.some(cs => !cs.length)) return null;

  // 첫 코드: 선호 포지션 중심
  let prev = cands[0].map(c => ({ cost: Math.abs(c.avgFret - center) * 0.4, cand: c, back: -1 }));
  const layers = [prev];

  for (let i = 1; i < cands.length; i++) {
    const layer = cands[i].map(c => {
      let best = Infinity, bk = -1;
      prev.forEach((p, j) => {
        // 성부별 이동 거리 합 (보이스 리딩의 핵심 지표)
        const move = c.pitches.reduce((s, pp, k) => s + Math.abs(pp - p.cand.pitches[k]), 0);
        // 포지션 점프 패널티
        const jump = Math.abs(c.avgFret - p.cand.avgFret) * 0.6;
        // 탑노트 라인 방향 유도 (멜로딕 컴핑)
        const topMove = c.pitches[3] - p.cand.pitches[3];
        // 반대 방향뿐 아니라 정체(공통음 유지)에도 벌점 → 라인이 실제로 움직이게
        const topPen = topDir === 'down' ? Math.max(0, topMove + 1) * 4
                     : topDir === 'up'   ? Math.max(0, 1 - topMove) * 4 : 0;
        const cost = p.cost + move + jump + topPen;
        if (cost < best) { best = cost; bk = j; }
      });
      return { cost: best, cand: c, back: bk };
    });
    layers.push(layer);
    prev = layer;
  }

  let idx = prev.reduce((bi, p, i2) => (p.cost < prev[bi].cost ? i2 : bi), 0);
  const path = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    path.unshift(layers[i][idx].cand);
    idx = layers[i][idx].back;
  }
  return path;
}

// 두 보이싱 간 공통음/이동 요약
function movementSummary(a, b) {
  let common = 0, totalMove = 0;
  for (let k = 0; k < 4; k++) {
    const d = Math.abs(b.pitches[k] - a.pitches[k]);
    if (d === 0) common++;
    totalMove += d;
  }
  return { common, totalMove };
}

// 셸 보이싱: R–7–3 (프레디 그린 스타일)
function buildShells(c) {
  const fn = fourNoteTones(c);
  if (!fn) return null;
  const { tones } = fn;
  const third = tones[1], seventh = tones[3];
  const shells = [];
  // 6번현 루트: 6현 R, 4현 7th, 3현 3rd
  // 5번현 루트: 5현 R, 3현 7th, 2현 3rd
  const layouts = [
    { label: '6번현 루트', strings: [0, 2, 3], order: [tones[0], seventh, third] },
    { label: '5번현 루트', strings: [1, 3, 4], order: [tones[0], seventh, third] },
  ];
  for (const lay of layouts) {
    for (let oct = 2; oct <= 5; oct++) {
      const base = c.idx + oct * 12;
      const frets = [];
      let prev = -1; let ok = true;
      const pitches = [];
      for (const t of lay.order) {
        let p = t.semi;
        while (p <= prev) p += 12;
        pitches.push(p); prev = p;
      }
      for (let i = 0; i < 3; i++) {
        const fret = base + pitches[i] - TUNING[lay.strings[i]];
        if (fret < 0 || fret > MAX_FRET) { ok = false; break; }
        frets.push(fret);
      }
      if (!ok) continue;
      const out = Array(6).fill(-1); const degs = Array(6).fill(null);
      lay.strings.forEach((s, i) => { out[s] = frets[i]; degs[s] = lay.order[i].deg; });
      shells.push({ label: lay.label, frets: out, degs });
      break;
    }
  }
  return shells;
}

// ── 다이어그램 (도수 라벨 포함) ──────────────────────────────────────
const DEG_COLORS = { 'R': 'var(--accent)', '3': '#f0a500', 'b3': '#f0a500', '5': '#34d399', 'b5': '#34d399', '#5': '#34d399', '7': '#c084fc', 'b7': '#c084fc', 'bb7': '#c084fc', '6': '#c084fc', '4': '#f0a500', '2': '#f0a500' };

function drawDiagram(frets, degs, leftHanded = false) {
  const F = leftHanded ? [...frets].reverse() : frets;
  const D = leftHanded ? [...degs].reverse() : degs;
  const valid = F.filter(f => f > 0);
  let minFret = valid.length ? Math.max(1, Math.min(...valid)) : 1;
  let maxFret = valid.length ? Math.max(minFret + 3, Math.max(...valid)) : 4;
  const fretCount = Math.min(maxFret - minFret + 1, 5);
  const cellW = 26, cellH = 28, offsetX = 30, offsetY = 36;
  const totalW = offsetX + cellW * 5 + 16;
  const totalH = offsetY + cellH * fretCount + 14;

  let svg = '';
  for (let s = 0; s < 6; s++) {
    const x = offsetX + s * cellW;
    svg += `<line x1="${x}" y1="${offsetY}" x2="${x}" y2="${offsetY + cellH * fretCount}" stroke="var(--text2)" stroke-width="1.2"/>`;
  }
  for (let f = 0; f <= fretCount; f++) {
    const y = offsetY + f * cellH;
    svg += `<line x1="${offsetX}" y1="${y}" x2="${offsetX + cellW * 5}" y2="${y}" stroke="var(--text)" stroke-width="${f === 0 && minFret === 1 ? 3 : 1}"/>`;
  }
  if (minFret > 1) svg += `<text x="${offsetX - 6}" y="${offsetY + cellH * 0.65}" fill="var(--text2)" font-size="10" text-anchor="end">${minFret}</text>`;

  F.forEach((fret, si) => {
    const x = offsetX + si * cellW;
    if (fret === -1) {
      svg += `<text x="${x}" y="${offsetY - 8}" fill="var(--text2)" font-size="12" text-anchor="middle">×</text>`;
    } else if (fret === 0) {
      const color = DEG_COLORS[D[si]] || 'var(--accent)';
      svg += `<circle cx="${x}" cy="${offsetY - 11}" r="7" fill="${color}"/>`;
      svg += `<text x="${x}" y="${offsetY - 8}" fill="#fff" font-size="8" text-anchor="middle" font-weight="bold">${D[si]||''}</text>`;
    } else {
      const rel = fret - minFret + 1;
      const cy = offsetY + (rel - 0.5) * cellH;
      const color = DEG_COLORS[D[si]] || 'var(--accent)';
      svg += `<circle cx="${x}" cy="${cy}" r="9.5" fill="${color}"/>`;
      svg += `<text x="${x}" y="${cy + 3}" fill="#fff" font-size="8.5" text-anchor="middle" font-weight="bold">${D[si]||''}</text>`;
    }
  });
  return `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">${svg}</svg>`;
}

// 코드 톤 이름 (정확한 철자)
function toneNames(c, tones) {
  return tones.map(t => `<span style="margin-right:10px"><span style="color:var(--text2)">${t.deg}:</span> <strong>${t.deg === 'R' ? c.root : spellInterval(c.root, t.semi, t.letterSteps)}</strong></span>`).join('');
}

const INV_LABELS = { 'R': '루트 포지션', '3': '1st inv (3도 베이스)', 'b3': '1st inv (b3 베이스)', '5': '2nd inv (5도 베이스)', 'b5': '2nd inv (b5 베이스)', '#5': '2nd inv (#5 베이스)', '7': '3rd inv (7도 베이스)', 'b7': '3rd inv (b7 베이스)', '6': '3rd inv (6도 베이스)', 'bb7': '3rd inv', '4': '1st inv (4도 베이스)', '2': '1st inv (2도 베이스)' };

export function render(panel) {
  const settings = JSON.parse(localStorage.getItem('gta_settings') || '{}');
  const leftHanded = settings.leftHanded || false;

  panel.innerHTML = `
    <h1 class="page-title">🎼 코드 보이싱</h1>
    <div class="card">
      <div class="label">코드 입력</div>
      <input type="text" id="chord-input" placeholder="예: Cmaj7, Dm7, G13, F#m7b5, Bb7#11">
      <div style="font-size:0.7rem;color:var(--text2);margin-top:4px">모든 코드를 Drop 2 · Drop 3 · 셸 보이싱으로 자동 계산합니다 (텐션 코드 포함)</div>
      <div class="btn-row">
        <button class="btn btn-primary" id="search-btn">보이싱 생성</button>
      </div>
    </div>
    <div class="card">
      <div class="section-label">보이스 리딩 생성기</div>
      <p style="font-size:0.76rem;color:var(--text2);margin:4px 0 8px">코드 진행을 입력하면 성부 이동이 최소가 되도록 연결된 Drop 2 컴핑을 자동 설계합니다.</p>
      <input type="text" id="vl-input" placeholder="예: Dm7 G7 Cmaj7 / Fm7 Bb7 Ebmaj7">
      <div class="btn-row">
        <button class="btn btn-primary" id="vl-btn">보이스 리딩 생성</button>
      </div>
      <div id="vl-result" style="margin-top:14px"></div>
    </div>
    <div id="voicing-result"></div>
  `;

  const input = panel.querySelector('#chord-input');
  const result = panel.querySelector('#voicing-result');

  // ── 보이스 리딩 ──
  function runVoiceLead() {
    const box = panel.querySelector('#vl-result');
    const raw = panel.querySelector('#vl-input').value.trim();
    if (!raw) return;
    const chords = raw.split(/[\s,|]+|(?:\s*-\s*)/).map(s => s.trim()).filter(Boolean)
      .map(s => ({ raw: s, parsed: parseChord(s) }));
    const bad = chords.find(c => !c.parsed);
    if (bad) { box.innerHTML = `<div style="font-size:0.8rem;color:var(--danger)">"${bad.raw}" 를 해석할 수 없습니다.</div>`; return; }
    if (chords.length < 2) { box.innerHTML = `<div style="font-size:0.8rem;color:var(--danger)">코드를 2개 이상 입력해주세요.</div>`; return; }
    if (chords.length > 16) { box.innerHTML = `<div style="font-size:0.8rem;color:var(--danger)">최대 16개까지 지원합니다.</div>`; return; }

    const parsed = chords.map(c => c.parsed);
    // 복수 해법: 같은 진행을 여러 관점으로 설계 (실전 컴핑은 상황에 따라 선택)
    const variants = [
      { title: 'Drop 2 · 최소 이동',     desc: '성부 4개의 총 이동 거리가 최소가 되는 정석 연결. 컴핑의 기본형.', opts: { kind:'drop2' } },
      { title: 'Drop 2 · 탑노트 하행',   desc: '맨 윗성부가 내려가는 라인을 그리도록 유도 — 멜로딕 컴핑. 발라드·엔딩에 효과적.', opts: { kind:'drop2', topDir:'down' } },
      { title: 'Drop 2 · 탑노트 상행',   desc: '탑노트가 올라가며 긴장감을 만드는 연결. 빌드업 구간에 사용.', opts: { kind:'drop2', topDir:'up' } },
      { title: 'Drop 2 · 로우 포지션',   desc: '같은 원리를 낮은 포지션(1~5프렛)에서. 어둡고 두꺼운 음색.', opts: { kind:'drop2', center:3 } },
      { title: 'Drop 3 · 최소 이동',     desc: '베이스와 상성부가 분리된 Drop 3 — 솔로 기타·루바토 반주에 적합.', opts: { kind:'drop3' } },
    ];

    const results = [];
    const seen = new Set();
    for (const v of variants) {
      const path = voiceLead(parsed, v.opts);
      if (!path) continue;
      const sig = path.map(p => p.pitches.join('.')).join('|');
      if (seen.has(sig)) continue; // 동일 결과는 한 번만
      seen.add(sig);
      results.push({ ...v, path });
    }
    if (!results.length) { box.innerHTML = `<div style="font-size:0.8rem;color:var(--danger)">보이싱을 만들 수 없는 코드가 있습니다.</div>`; return; }

    const anyExtended = results[0].path.some(p => p.extended);
    const blockHtml = (r, ri) => {
      const cells = r.path.map((v, i) => {
        let moveHtml = '';
        if (i > 0) {
          const { common, totalMove } = movementSummary(r.path[i-1], v);
          moveHtml = `<div style="font-size:0.64rem;color:var(--text2);margin-top:2px">공통음 ${common} · 이동 ${totalMove}반음</div>`;
        }
        return `
          <div class="vl-cell" data-vlr="${ri}" data-vli="${i}" style="text-align:center;flex-shrink:0;border-radius:8px;padding:4px;transition:background 0.15s">
            <div style="font-weight:700;font-size:0.88rem">${chords[i].raw}</div>
            <div style="font-size:0.62rem;color:var(--text2)">${v.setLabel} · ${v.bassDeg} 베이스</div>
            ${drawDiagram(v.frets, v.degs, leftHanded)}
            ${moveHtml}
          </div>`;
      }).join('<div style="align-self:center;color:var(--text2);font-size:1.1rem;flex-shrink:0">→</div>');
      return `
        <div style="margin-bottom:18px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:2px">
            <span style="font-weight:700;font-size:0.85rem;color:var(--accent)">${r.title}</span>
            <button class="btn btn-secondary vl-play" data-vlr="${ri}" style="font-size:0.72rem;padding:4px 12px">▶ 재생</button>
          </div>
          <div style="font-size:0.72rem;color:var(--text2);margin-bottom:8px">${r.desc}</div>
          <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;align-items:flex-start">${cells}</div>
        </div>`;
    };

    box.innerHTML = `
      ${anyExtended ? '<div style="font-size:0.7rem;color:var(--link);margin-bottom:6px">트라이어드는 7th로 확장해 연결했습니다.</div>' : ''}
      <label style="font-size:0.74rem;color:var(--text2);display:flex;align-items:center;gap:4px;cursor:pointer;margin-bottom:4px">
        <input type="checkbox" id="vl-loop" checked> 루프 재생
      </label>
      ${results.map(blockHtml).join('')}
      <div style="font-size:0.72rem;color:var(--text2);line-height:1.5">
        같은 색 점(도수)이 코드마다 어떻게 이동하는지 따라가 보세요 — 그것이 보이스 리딩입니다. 같은 진행도 탑노트 방향·포지션·보이싱 타입에 따라 전혀 다른 사운드가 됩니다.
      </div>`;

    box.querySelectorAll('.vl-play').forEach(playBtn => {
      playBtn.addEventListener('click', async () => {
        const ri = +playBtn.dataset.vlr;
        const audio = await import('./audio.js');
        const wasPlaying = audio.isPlaying();
        audio.stopSequence();
        box.querySelectorAll('.vl-play').forEach(b => b.textContent = '▶ 재생');
        box.querySelectorAll('.vl-cell').forEach(el => el.style.background = '');
        if (wasPlaying && playBtn.dataset.active === '1') { playBtn.dataset.active = ''; return; }
        box.querySelectorAll('.vl-play').forEach(b => b.dataset.active = '');
        playBtn.dataset.active = '1';
        playBtn.textContent = '■ 정지';
        const loop = box.querySelector('#vl-loop').checked;
        audio.playProgression(results[ri].path.map(v => v.pitches), {
          bpm: 76, beatsPerChord: 2, loop,
          onStep: idx => {
            box.querySelectorAll('.vl-cell').forEach(el => el.style.background = '');
            if (idx >= 0) {
              const cur = box.querySelector(`.vl-cell[data-vlr="${ri}"][data-vli="${idx}"]`);
              if (cur) cur.style.background = 'var(--bg3)';
            } else {
              playBtn.textContent = '▶ 재생'; playBtn.dataset.active = '';
            }
          }
        });
      });
    });
  }
  panel.querySelector('#vl-btn').addEventListener('click', runVoiceLead);
  panel.querySelector('#vl-input').addEventListener('keydown', e => { if (e.key === 'Enter') runVoiceLead(); });

  function search() {
    const val = input.value.trim();
    if (!val) return;
    const c = parseChord(val);
    if (!c) {
      result.innerHTML = `<div class="empty-state">코드를 해석할 수 없습니다.<br><small>예: Cmaj7, Dm7, G7b9, F#m7b5</small></div>`;
      return;
    }

    const drop2 = buildVoicings(c, 'drop2');
    const drop3 = buildVoicings(c, 'drop3');
    const shells = buildShells(c);

    if (!drop2 && !drop3) {
      result.innerHTML = `<div class="empty-state">이 코드 타입은 4성부 보이싱을 만들 수 없습니다.</div>`;
      return;
    }

    const extNote = drop2?.extended
      ? `<div style="font-size:0.74rem;color:var(--link);margin-top:4px">트라이어드 입력 — 재즈 보이싱 표준에 따라 ${c.root}${drop2.extended}로 확장해 표시합니다.</div>` : '';

    const legendHtml = `<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.72rem;margin:8px 0">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--accent)"></span> 루트</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f0a500"></span> 3도</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#34d399"></span> 5도</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#c084fc"></span> 7도/6도</span>
    </div>`;

    const renderSet = (set) => `
      <div style="margin-bottom:14px">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text2);margin-bottom:6px">${set.label}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${set.inversions.map(v => `
            <div style="text-align:center">
              <div style="font-size:0.68rem;color:var(--text2);margin-bottom:2px">${INV_LABELS[v.bassDeg] || v.bassDeg + ' 베이스'}</div>
              ${drawDiagram(v.frets, v.degs, leftHanded)}
            </div>`).join('')}
        </div>
      </div>`;

    const shellHtml = shells?.length ? `
      <div class="card">
        <div class="section-label">셸 보이싱 (R–7–3)</div>
        <p style="font-size:0.74rem;color:var(--text2);margin:4px 0 10px">3도와 7도만으로 코드의 성격을 표현하는 최소 보이싱 — 프레디 그린 컴핑, 워킹 베이스 위 컴핑의 기본.</p>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${shells.map(s => `<div style="text-align:center"><div style="font-size:0.68rem;color:var(--text2)">${s.label}</div>${drawDiagram(s.frets, s.degs, leftHanded)}</div>`).join('')}
        </div>
      </div>` : '';

    result.innerHTML = `
      <div class="card">
        <div style="font-size:1.3rem;font-weight:700;color:var(--accent)">${val}</div>
        <div style="font-size:0.8rem;margin-top:6px">${toneNames(c, drop2?.tones || drop3.tones)}</div>
        ${extNote}
        ${legendHtml}
      </div>
      ${shellHtml}
      <div class="card">
        <div class="section-label">Drop 2</div>
        <p style="font-size:0.74rem;color:var(--text2);margin:4px 0 10px">close 보이싱의 위에서 2번째 음을 한 옥타브 내린 형태 — 기타에서 가장 실용적인 4성부. 현 세트별 4개 인버전을 모두 익히면 지판 전체에서 컴핑/치드 멜로디가 가능합니다.</p>
        ${drop2 ? drop2.bySet.map(renderSet).join('') : '<div style="font-size:0.78rem;color:var(--text2)">생성 불가</div>'}
      </div>
      <div class="card">
        <div class="section-label">Drop 3</div>
        <p style="font-size:0.74rem;color:var(--text2);margin:4px 0 10px">위에서 3번째 음을 옥타브 내린 형태 — 베이스와 상성부가 분리되어 솔로 기타/발라드 컴핑에 적합.</p>
        ${drop3 ? drop3.bySet.map(renderSet).join('') : '<div style="font-size:0.78rem;color:var(--text2)">생성 불가</div>'}
      </div>
      <div class="btn-row">
        <button class="btn btn-link" id="to-chart">코드차트에 추가 →</button>
      </div>
    `;
    result.querySelector('#to-chart').addEventListener('click', () => goTo(7, { chord: val }));
  }

  panel.querySelector('#search-btn').addEventListener('click', search);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

  on('route-payload', payload => {
    if (payload?.progression) {
      panel.querySelector('#vl-input').value = payload.progression;
      runVoiceLead();
    } else if (payload?.chord) { input.value = payload.chord; search(); }
  });
}
