import { AppState, goTo, emit, on } from './app.js';

// ═══════════════════════════════════════════════════════════════════
//  이론 엔진 — 기능화성(Functional Harmony) + 코드-스케일 이론 기반
//  버클리/MI 커리큘럼 수준: ii–V 단위 인식, 세컨더리 도미넌트,
//  트라이톤 서브, 백도어, 모달 인터체인지, 경과 디미니시, 가이드 톤
// ═══════════════════════════════════════════════════════════════════

const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NOTE_IDX = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'Fb':4,'E#':5,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,'Cb':11,'B#':0 };

// 플랫 표기를 쓰는 키 (메이저: F Bb Eb Ab Db Gb / 마이너: d g c f bb eb)
const FLAT_MAJOR_KEYS = new Set([5,10,3,8,1,6]);
const FLAT_MINOR_KEYS = new Set([2,7,0,5,10,3]);

function spelledNotes(keyIdx, isMinor) {
  const useFlat = isMinor ? FLAT_MINOR_KEYS.has(keyIdx) : FLAT_MAJOR_KEYS.has(keyIdx);
  return useFlat ? NOTES_FLAT : NOTES_SHARP;
}

// ── 코드 타입 사전 (인터벌 = 반음 단위) ──────────────────────────────
const CHORD_TYPES = {
  'maj':    [0,4,7],          'm':      [0,3,7],          '5':      [0,7],
  'dim':    [0,3,6],          'dim7':   [0,3,6,9],        'm7b5':   [0,3,6,10],
  'aug':    [0,4,8],          'aug7':   [0,4,8,10],       'maj7#5': [0,4,8,11],
  'sus2':   [0,2,7],          'sus4':   [0,5,7],          '7sus4':  [0,5,7,10],
  '9sus4':  [0,5,7,10,14],
  'maj7':   [0,4,7,11],       'maj9':   [0,4,7,11,14],    'maj13':  [0,4,7,11,14,21],
  'maj7#11':[0,4,7,11,18],
  '6':      [0,4,7,9],        '69':     [0,4,7,9,14],
  'm6':     [0,3,7,9],        'm69':    [0,3,7,9,14],
  'm7':     [0,3,7,10],       'm9':     [0,3,7,10,14],    'm11':    [0,3,7,10,14,17],
  'm13':    [0,3,7,10,14,21],
  'mmaj7':  [0,3,7,11],       'mmaj9':  [0,3,7,11,14],
  '7':      [0,4,7,10],       '9':      [0,4,7,10,14],    '11':     [0,4,7,10,14,17],
  '13':     [0,4,7,10,14,21],
  '7b9':    [0,4,7,10,13],    '7#9':    [0,4,7,10,15],    '7#11':   [0,4,7,10,18],
  '7b13':   [0,4,7,10,20],    '7b5':    [0,4,6,10],       '7#5':    [0,4,8,10],
  '7alt':   [0,4,10,13,15,18,20],
  '13b9':   [0,4,7,10,13,21], '7b9b13': [0,4,7,10,13,20],
  'add9':   [0,4,7,14],       'madd9':  [0,3,7,14],
};

// 표기 동의어 → 정규형
const QUALITY_SYNONYMS = {
  '': 'maj', 'M': 'maj', 'major': 'maj',
  'M7': 'maj7', 'Maj7': 'maj7', 'MAJ7': 'maj7', 'ma7': 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', '△': 'maj7', '△7': 'maj7',
  'M9': 'maj9', 'Maj9': 'maj9', 'M13': 'maj13',
  'min': 'm', '-': 'm', 'mi': 'm',
  'min7': 'm7', '-7': 'm7', 'mi7': 'm7',
  'min9': 'm9', '-9': 'm9', 'min11': 'm11', '-11': 'm11',
  'm(maj7)': 'mmaj7', 'minmaj7': 'mmaj7', 'mM7': 'mmaj7', '-maj7': 'mmaj7', 'mΔ7': 'mmaj7',
  'ø': 'm7b5', 'ø7': 'm7b5', 'min7b5': 'm7b5', '-7b5': 'm7b5', 'm7(b5)': 'm7b5',
  '°': 'dim', 'o': 'dim', '°7': 'dim7', 'o7': 'dim7',
  '+': 'aug', '+7': 'aug7', 'aug7': 'aug7', '7+': 'aug7', '7aug': 'aug7',
  '6/9': '69', 'm6/9': 'm69',
  'alt': '7alt', 'alt7': '7alt', '7(alt)': '7alt',
  'sus': 'sus4', '7sus': '7sus4', '9sus': '9sus4',
  'dom7': '7',
};

export function parseChord(str) {
  str = str.trim();
  if (!str) return null;
  const m = str.match(/^([A-G](?:#|b|♯|♭)?)(.*)$/);
  if (!m) return null;
  const root = m[1].replace('♯','#').replace('♭','b');
  let rest = m[2];

  // 슬래시 베이스 분리 (6/9, m6/9는 베이스가 아님 — 베이스는 음이름이어야 함)
  let bass = null;
  const slash = rest.match(/^(.*?)\/([A-G](?:#|b|♯|♭)?)$/);
  if (slash) { rest = slash[1]; bass = slash[2].replace('♯','#').replace('♭','b'); }

  let q = rest.replace(/\(/g,'').replace(/\)/g,'').trim();
  if (QUALITY_SYNONYMS[q] !== undefined) q = QUALITY_SYNONYMS[q];

  let intervals = CHORD_TYPES[q];
  let type = q;

  if (!intervals) {
    // 베이스 타입 + 변화음 분해 (예: 13b9, maj7#11, m7b5b9...)
    const baseMatch = q.match(/^(maj13|maj11|maj9|maj7|maj|mmaj7|m13|m11|m9|m7b5|m7|m69|m6|madd9|m|dim7|dim|aug7|aug|7sus4|9sus4|sus2|sus4|add9|69|13|11|9|7|6|5)/);
    if (!baseMatch) return null;
    let base = baseMatch[1];
    if (QUALITY_SYNONYMS[base]) base = QUALITY_SYNONYMS[base];
    intervals = [...(CHORD_TYPES[base] || CHORD_TYPES['maj'])];
    const alters = q.slice(baseMatch[1].length).match(/(b5|#5|b9|#9|#11|b13|add9|add11|add13)/g) || [];
    for (const a of alters) {
      if (a === 'b5')  intervals = intervals.map(i => i === 7 ? 6 : i);
      else if (a === '#5') intervals = intervals.map(i => i === 7 ? 8 : i);
      else if (a === 'b9') intervals.push(13);
      else if (a === '#9') intervals.push(15);
      else if (a === '#11') intervals.push(18);
      else if (a === 'b13') intervals.push(20);
      else if (a === 'add9') intervals.push(14);
      else if (a === 'add11') intervals.push(17);
      else if (a === 'add13') intervals.push(21);
    }
    type = q;
  }

  const idx = NOTE_IDX[root];
  if (idx === undefined) return null;
  return {
    raw: str, root, type, idx, bass,
    bassIdx: bass !== null ? NOTE_IDX[bass] : null,
    intervals: [...new Set(intervals)].sort((a,b)=>a-b),
  };
}

function parseProgression(input) {
  // '-' ',' '|' 공백으로 분리 — 단 코드 내부의 슬래시(C/E)는 유지
  return input.split(/[\s,|]+|(?:\s*-\s*)/).map(s => s.trim()).filter(Boolean)
    .map(parseChord).filter(Boolean);
}

// ── 코드 성격 판별 ───────────────────────────────────────────────────
function has(c, semi) { return c.intervals.some(i => i % 12 === semi % 12); }
function isDom(c)     { return has(c,4) && has(c,10) || (c.type.includes('sus') && has(c,10)); }
function isMaj7th(c)  { return has(c,4) && has(c,11); }
function isMin7th(c)  { return has(c,3) && has(c,10) && !has(c,6); }
function isMinTriadOnly(c) { return has(c,3) && !has(c,10) && !has(c,11) && !has(c,6); }
function isMajTriadOnly(c) { return has(c,4) && !has(c,10) && !has(c,11); }
function isHalfDim(c) { return has(c,3) && has(c,6) && has(c,10); }
function isDim7(c)    { return has(c,3) && has(c,6) && has(c,9) && !has(c,10); }
function isMinMaj(c)  { return has(c,3) && has(c,11); }

// ── 도수 이름 ────────────────────────────────────────────────────────
const DEGREE_NAMES = ['I','bII','II','bIII','III','IV','#IV','V','bVI','VI','bVII','VII'];
function degreeOf(rootIdx, keyIdx) { return DEGREE_NAMES[(rootIdx - keyIdx + 12) % 12]; }

// ── 다이아토닉 7th 코드 ─────────────────────────────────────────────
function diatonicSeventh(keyIdx, isMinor) {
  if (!isMinor) {
    return [
      { off:0,  deg:'Imaj7',   types:['maj7','maj','6','69','maj9','maj13','add9'] },
      { off:2,  deg:'IIm7',    types:['m7','m','m9','m11','m6'] },
      { off:4,  deg:'IIIm7',   types:['m7','m','m9'] },
      { off:5,  deg:'IVmaj7',  types:['maj7','maj','6','69','maj9','maj7#11','add9'] },
      { off:7,  deg:'V7',      types:['7','maj','9','13','7sus4','sus4','9sus4','11'] },
      { off:9,  deg:'VIm7',    types:['m7','m','m9','m11'] },
      { off:11, deg:'VIIm7b5', types:['m7b5','dim'] },
    ];
  }
  return [
    { off:0,  deg:'Im',      types:['m','m7','m6','m69','mmaj7','mmaj9','madd9','m9','m11'] },
    { off:2,  deg:'IIm7b5',  types:['m7b5','dim','m7'] },
    { off:3,  deg:'bIIImaj7',types:['maj7','maj','6','maj9'] },
    { off:5,  deg:'IVm7',    types:['m7','m','m6','m9'] },
    { off:7,  deg:'V7',      types:['7','m7','m','7b9','7b13','7alt','13b9','7#9'] },
    { off:8,  deg:'bVImaj7', types:['maj7','maj','6','maj9'] },
    { off:10, deg:'bVII7',   types:['7','maj','9','13'] },
  ];
}

function matchDiatonic(chord, keyIdx, isMinor) {
  const dia = diatonicSeventh(keyIdx, isMinor);
  const off = (chord.idx - keyIdx + 12) % 12;
  const slot = dia.find(d => d.off === off);
  if (!slot) return null;
  if (slot.types.includes(chord.type)) return slot.deg;
  // 같은 계열(메이저/마이너/도미넌트)이면 허용
  if (slot.deg.includes('maj') && isMaj7th(chord)) return slot.deg;
  if (slot.deg.includes('m7b5') && isHalfDim(chord)) return slot.deg;
  if (/^(V7|bVII7)/.test(slot.deg) && isDom(chord)) return slot.deg;
  if (/m7?$/.test(slot.deg) && (isMin7th(chord) || isMinTriadOnly(chord))) return slot.deg;
  if (slot.deg === 'Im' && (isMin7th(chord) || isMinTriadOnly(chord) || isMinMaj(chord))) return slot.deg;
  return null;
}

// ── 키 감지 (기능 가중치 포함) ───────────────────────────────────────
function detectKey(chords) {
  let best = null, bestScore = -Infinity;
  for (let ki = 0; ki < 12; ki++) {
    for (const isMinor of [false, true]) {
      let score = 0;
      for (let i = 0; i < chords.length; i++) {
        const c = chords[i];
        if (matchDiatonic(c, ki, isMinor)) score += 1;
        // 블루스 크레딧: I7/IV7 도미넌트는 블루스 토닉/서브도미넌트로 인정
        if (isDom(c) && !isMinor) {
          const off = (c.idx - ki + 12) % 12;
          if (off === 0) score += 1.2;
          else if (off === 5) score += 0.5;
        }
        // V7 → I 해결 보너스 (가장 강한 키 신호)
        const next = chords[i+1];
        if (next && isDom(c) && (c.idx + 5) % 12 === next.idx && next.idx === ki) score += 2;
        // ii–V 페어 보너스
        if (next && (isMin7th(c) || isHalfDim(c)) && isDom(next) && (c.idx + 5) % 12 === ((next.idx + 12) % 12)) {
          const target = (next.idx + 5) % 12;
          if (target === ki) score += 2;
        }
      }
      const first = chords[0], last = chords[chords.length - 1];
      if (first && first.idx === ki) score += 0.7;
      if (first && first.idx === ki && isDom(first) && !isMinor) score += 1.5; // 블루스는 I7로 시작
      if (last && last.idx === ki) score += 0.7;
      if (!isMinor) score += 0.1;
      // 마이너 키 신호: 토닉이 마이너 계열
      if (isMinor && first && first.idx === ki && (has(first,3))) score += 0.8;
      if (!isMinor && first && first.idx === ki && (has(first,4))) score += 0.8;
      if (score > bestScore) { bestScore = score; best = { keyIdx: ki, isMinor, score }; }
    }
  }
  return best;
}

// ── 블루스 감지 ──────────────────────────────────────────────────────
function detectBlues(chords, keyIdx) {
  const tonicDoms = chords.filter(c => c.idx === keyIdx && isDom(c)).length;
  const ivDoms = chords.filter(c => c.idx === (keyIdx + 5) % 12 && isDom(c)).length;
  return tonicDoms >= 1 && (ivDoms >= 1 || tonicDoms >= 2);
}

// ── 코드-스케일 추천 (기능 기반) ─────────────────────────────────────
const SCALE_FORMULAS = {
  'Ionian':            [0,2,4,5,7,9,11],
  'Dorian':            [0,2,3,5,7,9,10],
  'Phrygian':          [0,1,3,5,7,8,10],
  'Lydian':            [0,2,4,6,7,9,11],
  'Mixolydian':        [0,2,4,5,7,9,10],
  'Aeolian':           [0,2,3,5,7,8,10],
  'Locrian':           [0,1,3,5,6,8,10],
  'Melodic Minor':     [0,2,3,5,7,9,11],
  'Lydian Augmented':  [0,2,4,6,8,9,11],
  'Lydian Dominant':   [0,2,4,6,7,9,10],
  'Mixolydian b6':     [0,2,4,5,7,8,10],
  'Locrian ♮2':        [0,2,3,5,6,8,10],
  'Altered':           [0,1,3,4,6,8,10],
  'Harmonic Minor':    [0,2,3,5,7,8,11],
  'Phrygian Dominant': [0,1,4,5,7,8,10],
  'WH Diminished':     [0,2,3,5,6,8,9,11],
  'HW Diminished':     [0,1,3,4,6,7,9,10],
  'Whole Tone':        [0,2,4,6,8,10],
  'Major Pentatonic':  [0,2,4,7,9],
  'Minor Pentatonic':  [0,3,5,7,10],
  'Blues':             [0,3,5,6,7,10],
  'Bebop Dominant':    [0,2,4,5,7,9,10,11],
  'Bebop Major':       [0,2,4,5,7,8,9,11],
};

// 분석 결과(funcType, 코드 성격)에 따른 코드별 스케일
function scalesForChord(c, analysis, keyIdx, isMinor, isBlues, NOTES) {
  const R = c.root; // 입력된 코드 루트 표기 그대로 사용
  const out = [];
  const add = (name, why) => out.push({ root: R, name, why });
  const ft = analysis.funcType;
  const deg = analysis.degree;

  if (isDim7(c)) { add('WH Diminished', '디미니시 코드의 기본 스케일 (whole-half)'); return out; }
  if (isHalfDim(c)) {
    add('Locrian', '반감7화음의 기본 모드');
    add('Locrian ♮2', '멜로딕 마이너 6th 모드 — 9th를 텐션으로 쓸 수 있어 모던한 사운드');
    return out;
  }
  if (isMinMaj(c)) { add('Melodic Minor', 'm(maj7)의 기본 스케일'); return out; }
  if (c.type === '7#11' || c.type.includes('#11') && isDom(c)) {
    add('Lydian Dominant', '#11 텐션 — 멜로딕 마이너 4th 모드'); return out;
  }
  if (c.type === '7alt') { add('Altered', 'alt 코드 — 멜로딕 마이너 7th 모드 (b9 #9 #11 b13)'); return out; }

  if (isDom(c)) {
    if (ft === 'tritone') { add('Lydian Dominant', '트라이톤 서브에는 리디안 도미넌트가 표준 (♮9, #11)'); return out; }
    if (ft === 'backdoor') { add('Lydian Dominant', '백도어 도미넌트(bVII7)의 표준 스케일'); return out; }
    // 해결 대상이 마이너인가?
    const target = (c.idx + 5) % 12;
    const targetMinor = (isMinor && target === keyIdx) || analysis.resolvesToMinor;
    if (isBlues && (c.idx === keyIdx || c.idx === (keyIdx+5)%12 || c.idx === (keyIdx+7)%12)) {
      add('Mixolydian', '블루스 컨텍스트의 기본');
      add('Blues', '블루 노트(b3, b5) 혼용 — 믹솔리디안과 겹쳐 쓰는 것이 블루스 어법');
      if (c.idx === keyIdx) add('Major Pentatonic', 'I7 위에서 메이저 펜타토닉 — BB King 박스');
      return out;
    }
    if (targetMinor) {
      add('Phrygian Dominant', '마이너로 해결하는 V7 — 하모닉 마이너 5th 모드');
      add('Altered', '최대 텐션 옵션 (b9 #9 b13)');
      add('HW Diminished', 'b9·#9·#11·13 조합 — 대칭 스케일 특유의 패턴 연주 가능');
    } else {
      add('Mixolydian', '메이저로 해결하는 V7의 기본');
      add('Altered', '해결 직전 텐션을 극대화하는 선택지');
      add('HW Diminished', '13th를 유지하면서 b9·#9를 쓰고 싶을 때');
      add('Bebop Dominant', '8음 스케일 — 비밥 라인의 크로매틱 어프로치');
    }
    if (has(c,13) || has(c,15)) out.splice(1, 0, { root: R, name: 'HW Diminished', why: 'b9/#9 텐션이 코드에 명시됨' });
    return out.slice(0, 3);
  }

  if (isMaj7th(c) || isMajTriadOnly(c) || c.type === '6' || c.type === '69') {
    if (deg === 'IVmaj7' || deg.startsWith('bVI') || deg.startsWith('bII') || c.type === 'maj7#11') {
      add('Lydian', '#11이 어보이드 없이 사용 가능 — 비토닉 메이저 코드의 표준');
    } else {
      add('Ionian', '토닉 메이저의 기본 (4th는 경과음으로)');
      add('Lydian', '#11 컬러 — 모던 재즈에서 토닉에도 자주 사용');
    }
    if (deg === 'Imaj7') add('Major Pentatonic', '안전한 5음 골격');
    return out;
  }

  if (isMin7th(c) || isMinTriadOnly(c)) {
    if (deg === 'IIm7' || ft === 'related-ii') { add('Dorian', 'ii 기능의 표준 모드 (♮6)'); }
    else if (deg === 'IIIm7') { add('Phrygian', 'iii 기능 — b9 주의, 도리안으로 대체 가능'); add('Dorian', '실전에서 더 자주 쓰는 선택'); }
    else if (deg === 'VIm7') { add('Aeolian', 'vi 기능의 기본'); add('Dorian', '♮6 컬러를 원할 때'); }
    else if (deg === 'Im') {
      add('Dorian', '마이너 토닉의 모던 선택 — ♮6 (재즈/퓨전 표준)');
      add('Aeolian', '내추럴 마이너 — 록/팝 컨텍스트');
      add('Melodic Minor', 'm6, m(maj7) 사운드로 확장할 때');
      add('Minor Pentatonic', '골격 라인');
    }
    else if (deg === 'IVm7' && ft === 'modal') { add('Dorian', '서브도미넌트 마이너 — 도리안이 표준'); }
    else { add('Dorian', '마이너 7th의 범용 선택'); add('Aeolian', '대안'); }
    return out;
  }

  add('Ionian', '기본');
  return out;
}

// ── 기능 분석 (순차, 문맥 인식) ──────────────────────────────────────
function analyzeFunctions(chords, keyIdx, isMinor) {
  const results = chords.map(() => null);

  for (let i = 0; i < chords.length; i++) {
    const c = chords[i];
    const next = chords[i + 1];
    const deg = degreeOf(c.idx, keyIdx);

    // 1) 다이아토닉
    const diaDeg = matchDiatonic(c, keyIdx, isMinor);
    if (diaDeg) {
      results[i] = { degree: diaDeg, funcType: 'diatonic', label: '다이아토닉' };
      // V7이 마이너 토닉으로 해결?
      if (diaDeg === 'V7' && isMinor) results[i].resolvesToMinor = true;
      continue;
    }

    // 2) 도미넌트 계열 — 세컨더리 / 트라이톤 / 백도어
    if (isDom(c)) {
      if (next) {
        const down5 = (c.idx + 5) % 12;
        const downHalf = (c.idx + 11) % 12;
        if (down5 === next.idx) {
          const targetDeg = degreeOf(next.idx, keyIdx);
          const targetMinor = has(next, 3);
          if (next.idx === keyIdx) {
            results[i] = { degree: 'V7', funcType: 'diatonic', label: '도미넌트', resolvesToMinor: isMinor };
          } else {
            results[i] = {
              degree: `V7/${targetDeg}`, funcType: 'secondary', label: '세컨더리 도미넌트',
              resolvesToMinor: targetMinor, target: targetDeg,
              comment: `${NOTES_SHARP[next.idx]}을(를) 일시적 토닉으로 만드는 세컨더리 도미넌트. 이 한 코드 동안만 ${NOTES_SHARP[next.idx]} 키로 들립니다.`
            };
          }
          continue;
        }
        if (downHalf === next.idx) {
          const targetDeg = degreeOf(next.idx, keyIdx);
          results[i] = {
            degree: `subV7/${targetDeg === 'I' ? 'I' : targetDeg}`, funcType: 'tritone', label: '트라이톤 서브',
            comment: `원래 도미넌트(${NOTES_SHARP[(next.idx+7)%12]}7)와 3·7도(가이드 톤)를 공유하는 대리 코드. 베이스가 반음 하행하며 같은 긴장-해결을 만듭니다.`
          };
          continue;
        }
      }
      // 백도어: bVII7 → (I)
      if ((c.idx - keyIdx + 12) % 12 === 10 && !isMinor) {
        results[i] = {
          degree: 'bVII7', funcType: 'backdoor', label: '백도어 도미넌트',
          comment: 'IVm 계열에서 파생된 서브도미넌트 마이너 기능. V7을 거치지 않고 뒷문으로 I에 도달합니다 (예: Fm7–Bb7–Cmaj7).'
        };
        continue;
      }
      // 해결 없는 도미넌트
      results[i] = { degree: `${deg}7`, funcType: 'nonres-dom', label: '비해결 도미넌트',
        comment: '5도 해결하지 않는 도미넌트 — 모달/블루스 컨텍스트이거나 색채적 사용.' };
      continue;
    }

    // 3) 디미니시 — 경과/보조
    if (isDim7(c)) {
      if (next && (c.idx + 1) % 12 === next.idx) {
        results[i] = {
          degree: `#${degreeOf((c.idx - 1 + 12) % 12, keyIdx)}dim7`, funcType: 'dim', label: '경과 디미니시',
          comment: `베이스가 반음 상행해 ${NOTES_SHARP[next.idx]}로 연결되는 경과 코드. 기능적으로는 ${NOTES_SHARP[(next.idx+7)%12]}7(b9)의 루트 생략형과 동일합니다.`
        };
      } else {
        results[i] = { degree: `${deg}dim7`, funcType: 'dim', label: '디미니시',
          comment: '보조(auxiliary) 디미니시 — 같은 베이스 위에서 색채를 바꾸는 용법이 일반적입니다.' };
      }
      continue;
    }

    // 4) 관련 ii (related ii of V) — m7/m7b5가 다음 도미넌트의 ii
    if ((isMin7th(c) || isHalfDim(c)) && next && isDom(next) && (c.idx + 5) % 12 === next.idx) {
      const target = (next.idx + 5) % 12;
      const after = chords[i + 2];
      // 백도어 예외: V가 bVII7이고 그 타깃으로 해결하지 않으면 → IVm7 (서브도미넌트 마이너)
      if (!isMinor && (next.idx - keyIdx + 12) % 12 === 10 && (!after || after.idx !== target)) {
        results[i] = {
          degree: 'IVm7', funcType: 'modal', label: '모달 인터체인지',
          comment: '서브도미넌트 마이너(에올리안 차용) — 뒤의 bVII7와 함께 백도어 캐던스(IVm7–bVII7–Imaj7)를 형성합니다.'
        };
        continue;
      }
      const targetDeg = degreeOf(target, keyIdx);
      const targetName = targetDeg.startsWith('b') ? NOTES_FLAT[target] : NOTES_SHARP[target];
      results[i] = {
        degree: `${isHalfDim(c) ? 'IIm7b5' : 'IIm7'}/${targetDeg}`, funcType: 'related-ii', label: '관련 ii',
        comment: `뒤따르는 ${NOTES_SHARP[next.idx]}7의 관련 ii — 함께 ${targetName}을(를) 향하는 ii–V 단위를 형성합니다.`
      };
      continue;
    }

    // 5) 모달 인터체인지
    const mi = detectModalInterchange(c, keyIdx, isMinor);
    if (mi) { results[i] = { ...mi, funcType: 'modal', label: '모달 인터체인지' }; continue; }

    // 6) 크로매틱
    results[i] = { degree: deg + (c.type === 'maj' ? '' : c.type), funcType: 'chromatic', label: '크로매틱',
      comment: '기능 화성으로 설명되지 않는 색채적/선율적 코드.' };
  }
  return results;
}

// 모달 인터체인지 사전 (메이저 키 기준)
function detectModalInterchange(c, keyIdx, isMinor) {
  if (isMinor) {
    // 마이너 키에서의 차용: 피카르디, IV7(도리안) 등
    const off = (c.idx - keyIdx + 12) % 12;
    if (off === 0 && isMaj7th(c)) return { degree: 'Imaj7', comment: '피카르디 3도 — 병행 메이저에서 차용한 메이저 토닉.' };
    if (off === 5 && isDom(c)) return { degree: 'IV7', comment: '도리안 모드에서 차용 — 마이너 블루스/모달의 핵심 사운드.' };
    return null;
  }
  const off = (c.idx - keyIdx + 12) % 12;
  const table = {
    1:  { cond: ch => isMaj7th(ch) || isMajTriadOnly(ch), deg: 'bIImaj7', src: '프리지안', note: '네아폴리탄 계열 — 반음 위에서 I로 떨어지는 드라마틱한 색채.' },
    3:  { cond: ch => isMaj7th(ch) || isMajTriadOnly(ch), deg: 'bIIImaj7', src: '에올리안(병행 마이너)', note: '병행 마이너에서 차용.' },
    5:  { cond: ch => isMin7th(ch) || isMinTriadOnly(ch) || ch.type === 'm6', deg: 'IVm', src: '에올리안(병행 마이너)', note: '서브도미넌트 마이너 — 가장 흔한 모달 인터체인지. IVm6는 멜로딕 마이너 소스.' },
    8:  { cond: ch => isMaj7th(ch) || isMajTriadOnly(ch), deg: 'bVImaj7', src: '에올리안(병행 마이너)', note: '병행 마이너 차용 — bVI–bVII–I 록 캐던스의 재료.' },
    10: { cond: ch => isMajTriadOnly(ch) || isMaj7th(ch), deg: 'bVII', src: '믹솔리디안', note: 'bVII–I — 믹솔리디안 캐던스 (록/팝 상용).' },
    0:  { cond: ch => isMin7th(ch) || isMinTriadOnly(ch), deg: 'Im7', src: '에올리안/도리안', note: '메이저 키에서 마이너 토닉 차용 — 모달 셔플.' },
    2:  { cond: ch => isHalfDim(ch), deg: 'IIm7b5', src: '에올리안(병행 마이너)', note: '마이너 ii–V를 메이저 키에서 빌려온 형태.' },
  };
  const t = table[off];
  if (t && t.cond(c)) return { degree: t.deg, comment: `${t.src} 모드에서 차용. ${t.note}` };
  return null;
}

// ── 진행 단위(ii–V–I 등) 검출 ────────────────────────────────────────
function detectUnits(chords, analyses, keyIdx, NOTES) {
  const units = [];
  for (let i = 0; i < chords.length - 1; i++) {
    const a = chords[i], b = chords[i + 1], c = chords[i + 2];
    const isII_V = (isMin7th(a) || isHalfDim(a)) && isDom(b) && (a.idx + 5) % 12 === b.idx;
    if (isII_V) {
      const target = (b.idx + 5) % 12;
      const resolved = c && c.idx === target;
      const minorType = isHalfDim(a);
      // 백도어 진행(IVm7–bVII7→I)은 ii–V가 아닌 캐던스로 별도 표기
      const isBackdoorPair = (b.idx - keyIdx + 12) % 12 === 10 && c && c.idx === keyIdx;
      if (isBackdoorPair) {
        units.push({ start: i, end: i + 2, type: '백도어', target: NOTES[keyIdx],
          text: `${a.raw} → ${b.raw} → ${c.raw} : IVm7–bVII7–Imaj7 백도어 캐던스` });
        i = i + 1;
        continue;
      }
      const targetDeg = degreeOf(target, keyIdx);
      const targetName = targetDeg.startsWith('b') ? NOTES_FLAT[target] : NOTES[target];
      units.push({
        start: i, end: resolved ? i + 2 : i + 1,
        type: resolved ? 'ii–V–I' : 'ii–V',
        target: targetName,
        minor: minorType,
        text: `${a.raw} → ${b.raw}${resolved ? ' → ' + c.raw : ''} : ${targetName}${minorType ? 'm' : ''}을(를) 향하는 ${minorType ? '마이너' : '메이저'} ii–V${resolved ? '–I (해결됨)' : ' (해결 보류)'}`
      });
      i = resolved ? i + 1 : i;
    }
  }
  // 캐던스 검출
  const cadences = [];
  for (let i = 0; i < chords.length - 1; i++) {
    const a = chords[i], b = chords[i + 1];
    if (isDom(a) && (a.idx + 5) % 12 === b.idx && b.idx === keyIdx) cadences.push({ at: i, type: 'Authentic (V–I)', text: `${a.raw} → ${b.raw}` });
    if ((a.idx - keyIdx + 12) % 12 === 5 && b.idx === keyIdx && !isDom(a)) cadences.push({ at: i, type: 'Plagal (IV–I)', text: `${a.raw} → ${b.raw}` });
    if (isDom(a) && (a.idx + 5) % 12 === keyIdx && (b.idx - keyIdx + 12) % 12 === 9) cadences.push({ at: i, type: 'Deceptive (V–vi)', text: `${a.raw} → ${b.raw}` });
    if ((a.idx - keyIdx + 12) % 12 === 10 && isDom(a) && b.idx === keyIdx) cadences.push({ at: i, type: 'Backdoor (bVII7–I)', text: `${a.raw} → ${b.raw}` });
  }
  return { units, cadences };
}

// ── 음정 철자 엔진 — 도수(letter) 기반 정확한 표기 (F의 b3 = Ab, D의 3 = F#) ──
const LETTERS = ['C','D','E','F','G','A','B'];
const LETTER_PITCH = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

export function spellInterval(rootName, semis, letterSteps) {
  const rl = rootName[0];
  const rootAcc = rootName.length > 1 ? (rootName[1] === '#' ? 1 : -1) : 0;
  const rootPitch = (LETTER_PITCH[rl] + rootAcc + 12) % 12;
  const targetLetter = LETTERS[(LETTERS.indexOf(rl) + letterSteps) % 7];
  const targetPitch = (rootPitch + semis) % 12;
  let diff = (targetPitch - LETTER_PITCH[targetLetter] + 12) % 12;
  if (diff > 6) diff -= 12;
  const acc = diff === 0 ? '' : diff === 1 ? '#' : diff === -1 ? 'b' : diff === 2 ? '𝄪' : '𝄫';
  return targetLetter + acc;
}

// ── 가이드 톤 ────────────────────────────────────────────────────────
function guideTones(c) {
  const third = c.intervals.find(i => i === 3 || i === 4);
  const seventh = c.intervals.find(i => i === 10 || i === 11) ?? c.intervals.find(i => i === 9);
  const gt = [];
  if (third !== undefined) gt.push({ deg: third === 3 ? 'b3' : '3', note: spellInterval(c.root, third, 2) });
  if (seventh !== undefined) {
    const isSixth = seventh === 9;
    gt.push({ deg: seventh === 10 ? 'b7' : (isSixth ? '6' : '7'), note: spellInterval(c.root, seventh, isSixth ? 5 : 6) });
  }
  return gt;
}

// ── 키 전체 스케일 (글로벌 — solo 탭 연동용) ─────────────────────────
function globalScales(keyIdx, isMinor, isBlues, NOTES) {
  const R = NOTES[keyIdx];
  if (isBlues) return [
    { root: R, name: 'Blues', score: 1 },
    { root: R, name: 'Mixolydian', score: 0.95 },
    { root: R, name: 'Minor Pentatonic', score: 0.9 },
    { root: R, name: 'Major Pentatonic', score: 0.85 },
  ];
  if (isMinor) return [
    { root: R, name: 'Aeolian', score: 1 },
    { root: R, name: 'Dorian', score: 0.95 },
    { root: R, name: 'Minor Pentatonic', score: 0.9 },
    { root: R, name: 'Harmonic Minor', score: 0.85 },
    { root: R, name: 'Melodic Minor', score: 0.8 },
    { root: R, name: 'Blues', score: 0.75 },
  ];
  return [
    { root: R, name: 'Ionian', score: 1 },
    { root: R, name: 'Major Pentatonic', score: 0.9 },
    { root: R, name: 'Lydian', score: 0.85 },
    { root: NOTES[(keyIdx + 9) % 12], name: 'Minor Pentatonic', score: 0.8 },
  ];
}

// ═══ 메인 분석 ═══════════════════════════════════════════════════════
function analyzeProgression(input) {
  const chords = parseProgression(input);
  if (!chords.length) return null;

  const keyResult = detectKey(chords);
  const { keyIdx, isMinor } = keyResult;
  const NOTES = spelledNotes(keyIdx, isMinor);
  const isBlues = detectBlues(chords, keyIdx);

  const analyses = analyzeFunctions(chords, keyIdx, isMinor);
  const { units, cadences } = detectUnits(chords, analyses, keyIdx, NOTES);

  const perChord = chords.map((c, i) => ({
    chord: c,
    analysis: analyses[i],
    scales: scalesForChord(c, analyses[i], keyIdx, isMinor, isBlues, NOTES),
    guideTones: guideTones(c),
  }));

  return {
    keyIdx, isMinor, isBlues, NOTES,
    keyName: NOTES[keyIdx],
    chords, perChord, units, cadences,
    globalScales: globalScales(keyIdx, isMinor, isBlues, NOTES),
  };
}

// ═══ UI ══════════════════════════════════════════════════════════════
function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }

function extractChordsFromDraft(draft) {
  const chords = [];
  (draft.sections || []).forEach(sec => {
    (sec.bars || []).forEach(bar => {
      const slots = Array.isArray(bar.chords) ? bar.chords : (bar.chords||'').split(/\s+/).filter(Boolean);
      slots.forEach(c => { if (c && c.trim()) chords.push(c.trim()); });
    });
  });
  return [...new Set(chords)];
}

function showChartPicker(panel) {
  const drafts = getDrafts().filter(d => !d.deleted);
  if (!drafts.length) { alert('저장된 코드차트가 없습니다.'); return; }
  document.querySelector('#chart-picker-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'chart-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;min-width:280px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;gap:10px">
      <div style="font-weight:700;font-size:1rem">코드차트 선택</div>
      <div style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px">
        ${drafts.map((d, i) => `
          <button class="chart-pick-btn" data-idx="${i}"
            style="text-align:left;padding:10px 14px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);cursor:pointer;font-size:0.88rem;color:var(--text)">
            <div style="font-weight:600">${d.title || '(제목 없음)'}</div>
            <div style="font-size:0.72rem;color:var(--text2);margin-top:2px">${(d.sections||[]).length}섹션 · ${(d.sections||[]).reduce((s,sec)=>s+(sec.bars||[]).length,0)}마디</div>
          </button>
        `).join('')}
      </div>
      <button id="chart-pick-cancel" class="btn btn-secondary">취소</button>
    </div>`;
  modal.querySelector('#chart-pick-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelectorAll('.chart-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const draft = drafts[+btn.dataset.idx];
      panel.querySelector('#prog-input').value = extractChordsFromDraft(draft).join(' - ');
      panel.querySelector('#prog-title').textContent = `📄 ${draft.title || '코드차트'}`;
      modal.remove();
      runAnalysis(panel);
    });
  });
  document.body.appendChild(modal);
}

export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">🎸 이론 분석</h1>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div class="label" style="margin:0">코드 진행 입력</div>
        <button class="btn btn-secondary" id="load-chart-btn" style="font-size:0.75rem;padding:5px 10px">📄 악보에서 불러오기</button>
      </div>
      <div id="prog-title" style="font-size:0.75rem;color:var(--accent);margin-bottom:4px;min-height:1em"></div>
      <input type="text" id="prog-input" placeholder="예: Dm7 G7 Cmaj7 / F7alt Bbmaj7 / C/E 도 인식" value="${AppState.currentAnalysis.progression.join(' ')}">
      <div style="font-size:0.7rem;color:var(--text2);margin-top:4px">슬래시 코드(C/E), 텐션(7b9, 13#11, alt), ø, dim7 모두 지원</div>
      <div class="btn-row">
        <button class="btn btn-primary" id="analyze-btn">분석</button>
        <button class="btn btn-secondary" id="clear-btn">초기화</button>
      </div>
    </div>
    <div id="analysis-result"></div>
  `;

  panel.querySelector('#load-chart-btn').addEventListener('click', () => showChartPicker(panel));
  panel.querySelector('#analyze-btn').addEventListener('click', () => runAnalysis(panel));
  panel.querySelector('#clear-btn').addEventListener('click', () => {
    panel.querySelector('#prog-input').value = '';
    panel.querySelector('#prog-title').textContent = '';
    panel.querySelector('#analysis-result').innerHTML = '';
  });
  panel.querySelector('#prog-input').addEventListener('keydown', e => { if (e.key === 'Enter') runAnalysis(panel); });

  if (AppState.currentAnalysis._full) showResult(panel, AppState.currentAnalysis._full);

  on('route-payload', payload => {
    if (payload?.progression) {
      panel.querySelector('#prog-input').value = payload.progression;
      runAnalysis(panel);
    }
  });
}

function runAnalysis(panel) {
  const input = panel.querySelector('#prog-input').value;
  const result = analyzeProgression(input);
  if (!result) return;

  // AppState 호환 형태 유지 (solo.js 등에서 사용)
  Object.assign(AppState.currentAnalysis, {
    progression: result.chords.map(c => c.raw),
    detectedKey: result.keyName,
    mode: result.isMinor ? 'minor' : 'major',
    diatonic: result.perChord.map(pc => ({ root: pc.chord.root, type: pc.chord.type, degree: pc.analysis.degree, status: pc.analysis.funcType })),
    scales: result.globalScales,
    _full: result,
  });
  showResult(panel, result);
}

const FUNC_COLORS = {
  diatonic: 'var(--accent)', secondary: '#f0a500', tritone: '#c084fc',
  backdoor: '#34d399', modal: '#60a5fa', dim: '#2dd4bf',
  'related-ii': '#f0a500', 'nonres-dom': '#fb923c', chromatic: 'var(--text2)',
};

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 간단 마크다운 → HTML (AI 해석 표시용)
function mdToHtml(md) {
  const lines = esc(md).split('\n');
  let html = '', inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^#{2,3}\s/.test(t)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<div style="font-weight:700;color:var(--accent);margin:14px 0 6px;font-size:0.9rem">${t.replace(/^#+\s*/,'')}</div>`;
    } else if (/^[-*]\s/.test(t)) {
      if (!inList) { html += '<ul style="margin:4px 0;padding-left:18px">'; inList = true; }
      html += `<li style="margin-bottom:4px">${t.replace(/^[-*]\s*/,'')}</li>`;
    } else if (t === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="margin:6px 0">${t}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function showResult(panel, r) {
  const tonality = r.isBlues
    ? `${r.keyName} 블루스 토널리티 <span style="font-size:0.72rem;color:var(--text2)">(도미넌트 I — 기능화성과 블루스 어법이 공존)</span>`
    : `${r.keyName} ${r.isMinor ? '마이너' : '메이저'}`;

  // 코드별 카드
  const chordCards = r.perChord.map((pc, i) => {
    const { chord: c, analysis: a } = pc;
    const color = FUNC_COLORS[a.funcType] || 'var(--text2)';
    const gtHtml = pc.guideTones.map(g => `<span style="margin-right:8px"><span style="color:var(--text2)">${g.deg}:</span> <strong>${g.note}</strong></span>`).join('');
    const scaleHtml = pc.scales.map(s =>
      `<div style="margin-top:4px;line-height:1.45"><span style="color:var(--accent);font-weight:600">${s.root} ${s.name}</span><br><span style="font-size:0.68rem;color:var(--text2)">${esc(s.why)}</span></div>`
    ).join('');
    const bassNote = c.bass ? `<span style="font-size:0.7rem;color:var(--text2)"> /${c.bass} 베이스</span>` : '';
    return `
      <div style="background:var(--bg3);border:1px solid var(--border);border-left:3px solid ${color};border-radius:8px;padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
          <div><span style="font-weight:700;font-size:1.05rem">${esc(c.raw)}</span>${bassNote}</div>
          <div style="font-weight:700;color:${color}">${esc(a.degree)}</div>
        </div>
        <div style="font-size:0.72rem;color:${color};margin-top:2px">${a.label}</div>
        ${a.comment ? `<div style="font-size:0.74rem;color:var(--text);margin-top:6px;line-height:1.5;background:var(--bg2);border-radius:6px;padding:7px 9px">${esc(a.comment)}</div>` : ''}
        <div style="font-size:0.74rem;margin-top:8px">${gtHtml ? '가이드 톤 — ' + gtHtml : ''}</div>
        <div style="font-size:0.76rem;margin-top:6px;border-top:1px dashed var(--border);padding-top:6px">${scaleHtml}</div>
      </div>`;
  }).join('');

  // 진행 단위
  const unitHtml = r.units.length
    ? r.units.map(u => `<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><strong style="color:var(--accent)">${u.type}</strong> — ${esc(u.text)}</div>`).join('')
    : '<div style="font-size:0.78rem;color:var(--text2)">ii–V 단위 없음</div>';
  const cadHtml = r.cadences.length
    ? r.cadences.map(cd => `<div style="padding:6px 0;font-size:0.8rem"><strong>${cd.type}</strong> · ${esc(cd.text)}</div>`).join('')
    : '<div style="font-size:0.78rem;color:var(--text2)">명시적 캐던스 없음</div>';

  const globalHtml = r.globalScales.map(s => `<tr><td>${s.root} ${s.name}</td><td style="color:var(--accent)">${Math.round(s.score*100)}%</td></tr>`).join('');

  panel.querySelector('#analysis-result').innerHTML = `
    <div class="card">
      <div class="section-label">감지된 키</div>
      <div style="font-size:1.3rem;font-weight:700;color:var(--accent)">${tonality}</div>
    </div>
    <div class="card">
      <div class="section-label">기능 분석 + 코드별 스케일</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">${chordCards}</div>
    </div>
    <div class="card">
      <div class="section-label">진행 단위 (ii–V 구조)</div>
      ${unitHtml}
      <div class="section-label" style="margin-top:14px">캐던스</div>
      ${cadHtml}
    </div>
    <div class="card">
      <div class="section-label">키 전체 스케일 (솔로용 베이스)</div>
      <table class="scale-table"><tbody>${globalHtml}</tbody></table>
    </div>
    <div class="card">
      <div class="section-label">🤖 AI 심층 해석</div>
      <p style="font-size:0.76rem;color:var(--text2);margin:4px 0 10px">엔진 분석을 바탕으로 화성적 서사 · 즉흥연주 전략 · 리하모니제이션 · 참고 레퍼토리를 해석합니다.</p>
      <button class="btn btn-primary" id="deep-ai-btn">심층 해석 요청</button>
      <div id="deep-ai-result" style="margin-top:12px"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-link" id="to-voicing">코드 보이싱 보기 →</button>
      <button class="btn btn-link" id="to-solo">솔로 메이킹 →</button>
    </div>
    <style>
      .scale-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
      .scale-table td { padding:6px 0; border-bottom:1px solid var(--border); }
    </style>
  `;

  panel.querySelector('#deep-ai-btn').addEventListener('click', async () => {
    const btn = panel.querySelector('#deep-ai-btn');
    const box = panel.querySelector('#deep-ai-result');
    btn.disabled = true; btn.textContent = '해석 중...';
    try {
      const { deepHarmonyAnalysis } = await import('./gemini-analysis.js');
      const progText = r.chords.map(c => c.raw).join(' - ');
      const summary = [
        `키: ${r.keyName} ${r.isMinor ? '마이너' : '메이저'}${r.isBlues ? ' (블루스 토널리티)' : ''}`,
        '코드별 기능: ' + r.perChord.map(pc => `${pc.chord.raw}=${pc.analysis.degree}(${pc.analysis.label})`).join(', '),
        r.units.length ? '진행 단위: ' + r.units.map(u => u.text).join(' / ') : '',
        r.cadences.length ? '캐던스: ' + r.cadences.map(cd => `${cd.type} ${cd.text}`).join(' / ') : '',
      ].filter(Boolean).join('\n');
      const text = await deepHarmonyAnalysis(progText, summary);
      box.innerHTML = `<div style="font-size:0.84rem;line-height:1.7;background:var(--bg3);border-radius:8px;padding:14px 16px">${mdToHtml(text)}</div>`;
    } catch (e) {
      box.innerHTML = `<div style="font-size:0.8rem;color:var(--danger)">⚠️ ${esc(e.message)}</div>`;
    }
    btn.disabled = false; btn.textContent = '심층 해석 요청';
  });

  panel.querySelector('#to-voicing').addEventListener('click', () => {
    goTo(2, { progression: r.chords.map(c => c.raw).join(' ') });
  });
  panel.querySelector('#to-solo').addEventListener('click', () => {
    goTo(3, { key: r.keyName, mode: r.isMinor ? 'minor' : 'major' });
  });
}
