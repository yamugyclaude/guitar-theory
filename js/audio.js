// ═══════════════════════════════════════════════════════════════════
//  사운드 엔진 — Web Audio API (외부 라이브러리 없음)
//  코드 재생 / 진행 루프 / 드론
// ═══════════════════════════════════════════════════════════════════

let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// ── 단일 코드 재생 (부드러운 EP 톤) ──────────────────────────────────
export function playChord(midis, when = 0, dur = 1.6) {
  const c = ac();
  const t = c.currentTime + when;
  midis.forEach((m, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiToFreq(m);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const g = c.createGain();
    const vol = 0.14 / Math.sqrt(midis.length) * (i === 0 ? 1.25 : 1); // 베이스 살짝 강조
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.018);
    g.gain.setTargetAtTime(vol * 0.55, t + 0.1, 0.35);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.78, 0.09);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.3);
  });
}

// ── 진행 시퀀서 ──────────────────────────────────────────────────────
let seqTimer = null;
let seqActive = false;

export function playProgression(chordMidis, { bpm = 76, beatsPerChord = 2, loop = false, onStep = null } = {}) {
  stopSequence();
  seqActive = true;
  const stepSec = (60 / bpm) * beatsPerChord;
  let i = 0;
  const tick = () => {
    if (!seqActive) return;
    playChord(chordMidis[i % chordMidis.length], 0, stepSec * 0.96);
    if (onStep) onStep(i % chordMidis.length);
    i++;
    if (!loop && i >= chordMidis.length) {
      seqTimer = setTimeout(() => { seqActive = false; if (onStep) onStep(-1); }, stepSec * 1000);
      return;
    }
    seqTimer = setTimeout(tick, stepSec * 1000);
  };
  tick();
}

export function stopSequence() {
  seqActive = false;
  if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
}

export function isPlaying() { return seqActive; }

// ── 드론 (루트 + 5도) ────────────────────────────────────────────────
let drone = null;

export function startDrone(midi) {
  stopDrone();
  const c = ac();
  const master = c.createGain();
  master.gain.setValueAtTime(0, c.currentTime);
  master.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.4);
  master.connect(c.destination);
  const oscs = [midi, midi + 7, midi + 12].map((m, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'triangle';
    o.frequency.value = midiToFreq(m);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 800;
    const g = c.createGain();
    g.gain.value = i === 0 ? 1 : 0.45;
    o.connect(f); f.connect(g); g.connect(master);
    o.start();
    return o;
  });
  drone = { oscs, master, ctx: c };
}

export function stopDrone() {
  if (!drone) return;
  const { oscs, master, ctx: c } = drone;
  master.gain.setTargetAtTime(0.0001, c.currentTime, 0.12);
  setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch {} }); try { master.disconnect(); } catch {} }, 400);
  drone = null;
}

export function isDroning() { return !!drone; }

export function stopAll() { stopSequence(); stopDrone(); }

// ── 코드명 → MIDI 노트 배열 (재생용 간이 보이싱) ─────────────────────
// parsed: theory.js parseChord 결과. 베이스 + 상성부 close voicing
export function chordToMidi(parsed, rootOctave = 3) {
  if (!parsed) return null;
  const root = 12 * (rootOctave + 1) + parsed.idx; // C3 = 48
  const ivs = [...parsed.intervals].slice(0, 5); // 최대 5음
  const notes = ivs.map(iv => root + iv);
  // 베이스 지정 시 (슬래시 코드) 맨 아래에 베이스
  if (parsed.bassIdx !== null && parsed.bassIdx !== undefined && parsed.bassIdx !== parsed.idx) {
    let b = 12 * rootOctave + parsed.bassIdx;
    while (b >= notes[0]) b -= 12;
    notes.unshift(b);
  }
  return notes;
}
