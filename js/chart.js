import { goTo, on } from './app.js';

function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
function saveDrafts(d) { localStorage.setItem('gta_chart_drafts', JSON.stringify(d)); }
function uuid() { return Date.now().toString(36) + Math.random().toString(36); }

// ── SVG 기호 (Unicode 미지원 대체) ──────────────────────────────────
function segnoSvg(size = 16, color = 'currentColor') {
  // 세뇨: S자 + 대각선(/) + 점 두 개 (대각선 기준 좌·우 동서)
  return `<svg width="${size}" height="${Math.round(size*1.2)}" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;display:inline-block">
    <line x1="12" y1="2" x2="4" y2="17" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M11.5 5 Q11.5 2.5 8 2.5 Q4.5 2.5 4.5 5 Q4.5 7.5 8 8 Q11.5 8.5 11.5 11 Q11.5 13.5 8 13.5 Q4.5 13.5 4.5 11" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <circle cx="2.5" cy="9"  r="1.3" fill="${color}"/>
    <circle cx="13.5" cy="9" r="1.3" fill="${color}"/>
  </svg>`;
}
function codaSvg(size = 16, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;display:inline-block">
    <circle cx="8" cy="8" r="5" stroke="${color}" stroke-width="1.5"/>
    <circle cx="8" cy="8" r="1.5" fill="${color}"/>
    <line x1="8" y1="1" x2="8" y2="15" stroke="${color}" stroke-width="1.3"/>
    <line x1="1" y1="8" x2="15" y2="8" stroke="${color}" stroke-width="1.3"/>
  </svg>`;
}
function fermataSvg(size = 14, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;display:inline-block">
    <path d="M1 9 Q7 1 13 9" stroke="${color}" stroke-width="1.3" fill="none"/>
    <circle cx="7" cy="6" r="1.5" fill="${color}"/>
    <line x1="1" y1="9" x2="13" y2="9" stroke="${color}" stroke-width="1.2"/>
  </svg>`;
}

// ── 음악 기호 정의 ───────────────────────────────────────────────────
// 마디 왼쪽 기호 (bar의 leftMark 필드)
const LEFT_MARK_OPTIONS = [
  { value: '',       label: '없음' },
  { value: '||:',    label: '||:',     desc: '반복 시작', color: 'var(--accent)', bold: true },
  { value: 'segno',  label: 'Segno',   desc: '세뇨',      color: 'var(--accent)' },
  { value: 'coda',   label: 'Coda',    desc: '코다',      color: '#e8a020' },
];
// 마디 오른쪽 기호 (bar의 rightMark 필드)
const RIGHT_MARK_OPTIONS = [
  { value: '',              label: '없음' },
  { value: ':||',           label: ':||',            desc: '반복 끝',        color: 'var(--accent)',    bold: true },
  { value: ':||:',          label: ':||:',           desc: '반복 끝+시작',   color: 'var(--accent)',    bold: true },
  { value: 'Fine',          label: 'Fine',           desc: '마침',           color: '#e060a0' },
  { value: 'D.C.',          label: 'D.C.',           desc: 'Da Capo (처음으로)', color: '#60a0e0' },
  { value: 'D.S.',          label: 'D.S.',           desc: 'Dal Segno (세뇨로)', color: '#60a0e0' },
  { value: 'D.C. al Coda', label: 'D.C. al Coda',   desc: '처음→코다',      color: '#60a0e0' },
  { value: 'D.S. al Coda', label: 'D.S. al Coda',   desc: '세뇨→코다',      color: '#60a0e0' },
  { value: 'D.C. al Fine', label: 'D.C. al Fine',   desc: '처음→Fine',      color: '#60a0e0' },
  { value: 'D.S. al Fine', label: 'D.S. al Fine',   desc: '세뇨→Fine',      color: '#60a0e0' },
  { value: 'To Coda',       label: 'To Coda',        desc: '코다로 점프',    color: '#e8a020' },
];
// 볼타 괄호 (1番括弧, 2番括弧)
const VOLTA_OPTIONS = [
  { value: '',    label: '없음' },
  { value: '1.',  label: '1.',  desc: '1번 엔딩', color: '#80c8a0' },
  { value: '2.',  label: '2.',  desc: '2번 엔딩', color: '#80c8a0' },
  { value: '3.',  label: '3.',  desc: '3번 엔딩', color: '#80c8a0' },
];
// 페르마타 / 다이나믹 (메모용, 특정 박에 표시)
const EXPR_OPTIONS = [
  { value: '',       label: '없음' },
  { value: 'fermata', label: '𝄐 Fermata',   desc: '늘임표' },
  { value: 'pp',     label: 'pp',           desc: '피아니시모' },
  { value: 'p',      label: 'p',            desc: '피아노' },
  { value: 'mp',     label: 'mp',           desc: '메조피아노' },
  { value: 'mf',     label: 'mf',           desc: '메조포르테' },
  { value: 'f',      label: 'f',            desc: '포르테' },
  { value: 'ff',     label: 'ff',           desc: '포르티시모' },
  { value: 'cresc.', label: 'cresc.',       desc: '점점 세게' },
  { value: 'dim.',   label: 'dim.',         desc: '점점 여리게' },
  { value: 'rit.',   label: 'rit.',         desc: '점점 느리게' },
  { value: 'accel.', label: 'accel.',       desc: '점점 빠르게' },
  { value: 'a tempo',label: 'a tempo',      desc: '원래 빠르기로' },
];

// 반복 끝 기호 (repeatEnd 필드) — 독립
const REPEAT_END_OPTIONS = [
  { value: '',     label: '없음' },
  { value: ':||',  label: ':||',  desc: '반복 끝',      color: 'var(--accent)', bold: true },
  { value: ':||:', label: ':||:', desc: '반복 끝+시작',  color: 'var(--accent)', bold: true },
];
// 텍스트 기호 (rightMark 필드) — Fine / D.C. 등
const TEXT_MARK_OPTIONS = [
  { value: '',              label: '없음' },
  { value: 'Fine',          label: 'Fine',         desc: '마침',           color: '#e060a0' },
  { value: 'D.C.',          label: 'D.C.',          desc: 'Da Capo',        color: '#60a0e0' },
  { value: 'D.S.',          label: 'D.S.',          desc: 'Dal Segno',      color: '#60a0e0' },
  { value: 'D.C. al Coda', label: 'D.C. al Coda',  desc: '처음→코다',      color: '#60a0e0' },
  { value: 'D.S. al Coda', label: 'D.S. al Coda',  desc: '세뇨→코다',      color: '#60a0e0' },
  { value: 'D.C. al Fine', label: 'D.C. al Fine',  desc: '처음→Fine',      color: '#60a0e0' },
  { value: 'D.S. al Fine', label: 'D.S. al Fine',  desc: '세뇨→Fine',      color: '#60a0e0' },
  { value: 'To Coda',      label: 'To Coda',        desc: '코다로 점프',    color: '#e8a020' },
];

const END_MARKS = ['', 'D.C.', 'D.S.', 'D.C. al Coda', 'D.S. al Coda', 'Fine'];
const START_MARKS = ['', 'segno', 'coda'];

// bar 데이터 정규화 (구버전 데이터 호환)
function normalizeBar(b) {
  // 구버전: leftMark='||:' → repeatStart=true, leftMark=''
  if (b.leftMark === '||:') { b.repeatStart = true; b.leftMark = ''; }
  // 구버전: rightMark=':||' or ':||:' → repeatEnd=value, rightMark=''
  if (b.rightMark === ':||' || b.rightMark === ':||:') { b.repeatEnd = b.rightMark; b.rightMark = ''; }
  return b;
}

// 기호값 → 표시 HTML (버튼 라벨용)
function markDisplayHtml(value, size = 14) {
  if (value === 'segno')   return segnoSvg(size, 'var(--accent)') + ' Segno';
  if (value === 'coda')    return codaSvg(size, '#e8a020') + ' Coda';
  if (value === 'fermata') return fermataSvg(size, 'var(--text2)');
  return value;
}
// 기호값 → 단독 아이콘 HTML (마디 표시용)
function markIconHtml(value, color, size = 16) {
  if (value === 'segno')   return segnoSvg(size, color);
  if (value === 'coda')    return codaSvg(size, color);
  if (value === 'fermata') return fermataSvg(size, color);
  return `<span style="color:${color};font-size:0.75rem;font-weight:700">${value}</span>`;
}

export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">📝 곡(코드)진행 만들기</h1>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-primary" id="new-btn">+ 새로 만들기</button>
    </div>
    <div id="draft-list"></div>
    <div id="editor" style="display:none"></div>
  `;
  panel.querySelector('#new-btn').addEventListener('click', () => openEditor(panel, null));
  renderDraftList(panel);
  on('route-payload', payload => {
    if (payload?.title || payload?.chord) openEditor(panel, null, payload);
  });
}

function renderDraftList(panel) {
  const drafts = getDrafts();
  const list = panel.querySelector('#draft-list');
  if (!drafts.length) { list.innerHTML = `<div class="empty-state">저장된 곡진행이 없습니다.</div>`; return; }
  list.innerHTML = drafts.map(d => `
    <div class="card" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center" data-id="${d.id}">
      <div>
        <div style="font-weight:600">${d.title || '(제목 없음)'}</div>
        <div style="font-size:0.8rem;color:var(--text2)">${d.key || ''} ${d.bpm ? d.bpm+'BPM' : ''}</div>
      </div>
      <button class="btn btn-secondary del-btn" style="font-size:0.75rem;padding:4px 8px" data-id="${d.id}">삭제</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-id]:not(.del-btn)').forEach(el => {
    el.addEventListener('click', e => { if (!e.target.classList.contains('del-btn')) openEditor(panel, el.dataset.id); });
  });
  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteDraft(panel, btn.dataset.id); });
  });
}

function deleteDraft(panel, id) {
  if (!confirm('삭제하시겠습니까?')) return;
  saveDrafts(getDrafts().filter(d => d.id !== id));
  renderDraftList(panel);
}

function openEditor(panel, id, prefill = {}) {
  let draft = id ? getDrafts().find(d => d.id === id) : null;
  if (!draft) {
    draft = { id: uuid(), title: prefill.title || '', artist: prefill.artist || '', key: prefill.key || '', bpm: prefill.bpm || '', time: '4/4', defaultBarsPerRow: 4, sections: [] };
  } else {
    // 저장된 곡을 열 때 모든 섹션은 저장 상태(editing:false)로
    draft.sections.forEach(s => { if (s.editing === undefined) s.editing = false; });
  }
  panel.querySelector('#draft-list').style.display = 'none';
  panel.querySelector('#editor').style.display = 'block';
  renderEditor(panel, draft);
}

function renderEditor(panel, draft) {
  const ed = panel.querySelector('#editor');
  ed.innerHTML = `
    <!-- 곡 정보 -->
    <div class="card" id="song-info-card">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:2;min-width:140px"><div class="label">곡명</div><input type="text" id="e-title" value="${draft.title}" placeholder="곡명"></div>
        <div style="flex:1;min-width:70px"><div class="label">키</div><input type="text" id="e-key" value="${draft.key}" placeholder="Am"></div>
        <div style="flex:1;min-width:55px"><div class="label">박자</div><input type="text" id="e-time" value="${draft.time}" placeholder="4/4"></div>
        <div style="flex:1;min-width:55px"><div class="label">BPM</div><input type="text" id="e-bpm" value="${draft.bpm}" placeholder="120"></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span style="font-size:0.78rem;color:var(--text2)">기본 마디/행:</span>
        <button class="btn bpr-btn ${(draft.defaultBarsPerRow||4)===4?'btn-primary':'btn-secondary'}" data-val="4">4마디</button>
        <button class="btn bpr-btn ${(draft.defaultBarsPerRow||4)===8?'btn-primary':'btn-secondary'}" data-val="8">8마디</button>
        <span style="font-size:0.75rem;color:var(--text2);margin-left:8px">💡 마디 셀 클릭 → 코드 입력 (2코드: Am G · Tab으로 이동)</span>
      </div>
    </div>

    <!-- 섹션 영역 (편집+미리보기 통합) -->
    <div id="sections-area"></div>

    <!-- 섹션 추가 -->
    <div class="card" style="padding:10px 14px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" id="section-name-input" placeholder="섹션 이름 (Intro, Verse, Chorus...)" style="flex:1;min-width:140px" list="section-suggestions">
        <datalist id="section-suggestions">
          <option>Intro</option><option>Verse</option><option>Pre-Chorus</option>
          <option>Chorus</option><option>Bridge</option><option>Solo</option><option>Outro</option>
        </datalist>
        <button class="btn btn-secondary" id="add-section-btn">+ 섹션 추가</button>
      </div>
    </div>

    <!-- AI 악보 불러오기 -->
    <div class="card" style="padding:10px 14px;border:1px dashed var(--accent)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:0.82rem;font-weight:600">📷 악보에서 불러오기</span>
        <input type="file" id="ai-sheet-file" accept=".png,.jpg,.jpeg,.pdf" style="flex:1;min-width:0;font-size:0.78rem">
        <button class="btn btn-primary" id="ai-step1-btn" style="font-size:0.78rem;white-space:nowrap">① 구조 분석</button>
      </div>
      <div id="ai-status" style="font-size:0.78rem;color:var(--text2);margin-top:6px"></div>
    </div>

    <!-- 하단 버튼 -->
    <div class="btn-row" style="margin-top:8px">
      <button class="btn btn-primary" id="save-btn">💾 저장</button>
      <button class="btn btn-secondary" id="png-btn">PNG</button>
      <button class="btn btn-secondary" id="print-btn">인쇄</button>
      <button class="btn btn-secondary" id="back-btn">← 목록</button>
    </div>
  `;

  function syncMeta() {
    draft.title = ed.querySelector('#e-title').value;
    draft.key   = ed.querySelector('#e-key').value;
    draft.time  = ed.querySelector('#e-time').value;
    draft.bpm   = ed.querySelector('#e-bpm').value;
  }

  // 기본 마디/행 버튼
  ed.querySelectorAll('.bpr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.defaultBarsPerRow = Number(btn.dataset.val);
      ed.querySelectorAll('.bpr-btn').forEach(b =>
        b.className = `btn bpr-btn ${b.dataset.val==draft.defaultBarsPerRow?'btn-primary':'btn-secondary'}`
      );
      renderSections(ed, draft);
    });
  });

  ['#e-title','#e-key','#e-time','#e-bpm'].forEach(sel => {
    ed.querySelector(sel).addEventListener('input', syncMeta);
  });

  renderSections(ed, draft);

  // 섹션 추가
  const secNameInput = ed.querySelector('#section-name-input');
  ed.querySelector('#add-section-btn').addEventListener('click', () => {
    const name = secNameInput.value.trim() || 'Section';
    syncMeta();
    const bpr = draft.defaultBarsPerRow || 4;
    draft.sections.push({
      type: name, bars: Array.from({ length: bpr }, () => ({ chords: '' })),
      memo: '', barsPerRow: bpr,
      pickup: false, repeatStart: false, repeatEnd: false, startMark: '', endMark: ''
    });
    secNameInput.value = '';
    renderSections(ed, draft);
    // 새 섹션으로 스크롤
    const lastSec = ed.querySelector('#sections-area').lastElementChild;
    if (lastSec) lastSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  secNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') ed.querySelector('#add-section-btn').click(); });

  // 저장
  ed.querySelector('#save-btn').addEventListener('click', () => {
    syncMeta();
    if (!draft.title.trim()) { alert('곡명을 입력해주세요.'); return; }
    const toSave = { ...draft, sections: draft.sections.map(({ symOpen, ...rest }) => rest) };
    const drafts = getDrafts();
    const idx = drafts.findIndex(d => d.id === toSave.id);
    if (idx >= 0) drafts[idx] = toSave; else drafts.unshift(toSave);
    saveDrafts(drafts);
    const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!setlists.find(s => s.id === draft.id)) {
      setlists.push({ id: draft.id, title: draft.title, type: 'chart' });
      localStorage.setItem('gta_setlists', JSON.stringify(setlists));
    }
    showToast('저장 완료 ✅');
  });

  // PNG
  ed.querySelector('#png-btn').addEventListener('click', async () => {
    syncMeta();
    const area = ed.querySelector('#sections-area');
    try {
      const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#1a1a1a';
      const canvas = await html2canvas(area, { backgroundColor: bg, scale: 2 });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
      a.download = `${draft.title || 'chord-chart'}.png`; a.click();
    } catch (e) { alert('PNG 저장 실패: ' + e.message); }
  });

  // 인쇄
  ed.querySelector('#print-btn').addEventListener('click', () => {
    syncMeta();
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>${draft.title||'Chord Chart'}</title>
      <style>body{font-family:sans-serif;padding:20px;color:#000;font-size:14px}
      .bar-cell-wrap{display:inline-flex;flex-direction:column;min-width:60px;border:1px solid #ccc;border-radius:4px;margin:2px;padding:2px 0;text-align:center}
      </style></head><body>${ed.querySelector('#sections-area').innerHTML}</body></html>`);
    win.document.close(); win.print();
  });

  ed.querySelector('#back-btn').addEventListener('click', () => {
    panel.querySelector('#draft-list').style.display = '';
    ed.style.display = 'none';
    renderDraftList(panel);
  });

  // AI
  ed.querySelector('#ai-step1-btn').addEventListener('click', () => runAiStep1(ed, draft));
}

async function getImageBlobFromFile(file) {
  if (!file) return null;
  if (file.type.startsWith('image/')) return file;
  // PDF → 첫 페이지 렌더
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js가 로드되지 않았습니다. 이미지 파일을 사용해주세요.');
    const url = URL.createObjectURL(file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    URL.revokeObjectURL(url);
    return await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  }
  return null;
}

async function runAiStep1(ed, draft) {
  const { isConfigured } = await import('./gemini-analysis.js?v=10');
  if (!isConfigured()) { alert('⚙️ 설정 탭에서 API 키를 먼저 입력해주세요.'); return; }

  const file = ed.querySelector('#ai-sheet-file').files[0];
  if (!file) { alert('악보 파일을 선택해주세요.'); return; }

  const statusEl = ed.querySelector('#ai-status');
  statusEl.textContent = '🔍 1단계: 구조 분석 중... (마디 수, 코드 배치 파악)';
  ed.querySelector('#ai-step1-btn').disabled = true;

  try {
    const blob = await getImageBlobFromFile(file);
    if (!blob) throw new Error('이미지를 읽을 수 없습니다.');

    const { callAiRaw } = await import('./gemini-analysis.js?v=10');
    const STRUCTURE_PROMPT = `이 악보 이미지의 구조만 분석해주세요. 코드명은 지금 필요 없습니다.

JSON으로만 응답하세요 (마크다운 없이):
{
  "title": "곡명 (있으면)",
  "key": "조성 (있으면)",
  "bpm": "템포 (있으면)",
  "time": "박자 기호 예: 4/4",
  "sections": [
    {
      "type": "섹션명 (Intro/Verse/Chorus 등)",
      "bars": [
        {"numChords": 1},
        {"numChords": 2},
        {"numChords": 1}
      ],
      "repeatStart": false,
      "repeatEnd": false,
      "startMark": "",
      "endMark": ""
    }
  ]
}

규칙:
- bars 배열 항목 수 = 실제 마디 수. 반드시 악보의 마디를 정확히 세어라
- numChords: 해당 마디 안에 코드가 몇 개인지 (1, 2, 3 중 하나)
- 못갖춘마디(pickup)가 있으면 첫 섹션의 첫 마디로 포함
- 도돌이표 ||: → repeatStart:true, :|| → repeatEnd:true
- 𝄋 → startMark:"𝄋 Segno", 𝄌 → startMark:"𝄌 Coda"
- D.S./D.C./Fine → endMark에 기록`;

    const structureText = await callAiRaw(blob, STRUCTURE_PROMPT);
    const jsonStr = structureText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    const structure = JSON.parse(jsonStr);

    // 곡 정보 반영
    if (structure.title) ed.querySelector('#e-title').value = structure.title;
    if (structure.key)   ed.querySelector('#e-key').value   = structure.key;
    if (structure.bpm)   ed.querySelector('#e-bpm').value   = structure.bpm;
    if (structure.time)  ed.querySelector('#e-time').value  = structure.time;

    // 구조로 섹션 생성 (bars는 numChords에 맞게 빈 셀)
    draft.sections = structure.sections.map(s => ({
      type: s.type || 'Section',
      bars: (s.bars || []).map(b => ({
        chords: '',
        numChords: b.numChords || 1
      })),
      memo: '',
      barsPerRow: draft.defaultBarsPerRow || 4,
      pickup: false,
      repeatStart: s.repeatStart || false,
      repeatEnd: s.repeatEnd || false,
      startMark: s.startMark || '',
      endMark: s.endMark || ''
    }));

    renderSections(ed, draft);

    // 총 마디 수 요약
    const totalBars = draft.sections.reduce((sum, s) => sum + s.bars.length, 0);
    const summary = draft.sections.map(s => `${s.type}(${s.bars.length}마디)`).join(' · ');
    statusEl.innerHTML = `
      ✅ 구조 분석 완료 — 총 ${totalBars}마디 · ${summary}<br>
      <span style="color:var(--text2)">마디 수가 맞으면 아래 버튼으로 코드를 채우세요.</span><br>
      <button class="btn btn-primary" id="ai-step2-btn" style="font-size:0.78rem;margin-top:6px">② 코드 채우기</button>
    `;
    statusEl.querySelector('#ai-step2-btn').addEventListener('click', () => runAiStep2(ed, draft, blob, statusEl));

  } catch (e) {
    statusEl.textContent = `❌ 구조 분석 실패: ${e.message}`;
  } finally {
    ed.querySelector('#ai-step1-btn').disabled = false;
  }
}

async function runAiStep2(ed, draft, imageBlob, statusEl) {
  const { callAiRaw } = await import('./gemini-analysis.js?v=10');

  statusEl.innerHTML = '🎵 2단계: 코드 채우는 중...';

  // 확정된 구조를 텍스트로 변환
  const structureDesc = draft.sections.map(s => {
    const barDesc = s.bars.map((b, i) =>
      `마디${i+1}(코드${b.numChords || 1}개)`
    ).join(', ');
    return `[${s.type}] ${s.bars.length}마디: ${barDesc}`;
  }).join('\n');

  const CHORD_PROMPT = `이 악보의 코드명만 읽어주세요.

악보 구조 (이미 확정됨):
${structureDesc}

위 구조 그대로 각 마디의 코드를 채워서 JSON으로만 응답하세요:
{
  "sections": [
    {
      "type": "섹션명",
      "bars": [
        "Am7",
        "D7 G",
        "Em"
      ]
    }
  ]
}

규칙:
- 마디 배열 순서와 개수는 반드시 위 구조와 정확히 일치
- 코드 1개짜리 마디: "Am7" (문자열)
- 코드 2개짜리 마디: "Am7 D7" (공백으로 구분)
- 코드 3개짜리 마디: "Am G Em" (공백으로 구분)
- 표준 코드 표기 사용 (Am7, Gmaj7, D7 등)`;

  try {
    const chordText = await callAiRaw(imageBlob, CHORD_PROMPT);
    const jsonStr = chordText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    const filled = JSON.parse(jsonStr);

    // 코드 채우기
    filled.sections.forEach((fs, si) => {
      if (!draft.sections[si]) return;
      (fs.bars || []).forEach((chord, bi) => {
        if (draft.sections[si].bars[bi] !== undefined) {
          draft.sections[si].bars[bi].chords = typeof chord === 'string' ? chord : '';
        }
      });
    });

    renderSections(ed, draft);
    statusEl.innerHTML = '✅ 완료! 셀을 클릭해 직접 수정할 수 있습니다.';

  } catch (e) {
    statusEl.textContent = `❌ 코드 채우기 실패: ${e.message}`;
  }
}

// ── 섹션 색상 팔레트 ─────────────────────────────────────────────────
const SEC_COLORS = [
  { bg: 'rgba(99,130,255,0.15)',  border: 'rgba(99,130,255,0.55)'  }, // 파랑
  { bg: 'rgba(80,200,130,0.15)', border: 'rgba(80,200,130,0.55)'  }, // 초록
  { bg: 'rgba(240,130,80,0.15)', border: 'rgba(240,130,80,0.55)'  }, // 주황
  { bg: 'rgba(200,80,200,0.15)', border: 'rgba(200,80,200,0.55)'  }, // 보라
  { bg: 'rgba(80,200,230,0.15)', border: 'rgba(80,200,230,0.55)'  }, // 하늘
  { bg: 'rgba(230,200,60,0.15)', border: 'rgba(230,200,60,0.55)'  }, // 노랑
  { bg: 'rgba(230,80,110,0.15)', border: 'rgba(230,80,110,0.55)'  }, // 빨강
  { bg: 'rgba(100,210,210,0.15)',border: 'rgba(100,210,210,0.55)' }, // 청록
];
function secColor(si) { return SEC_COLORS[si % SEC_COLORS.length]; }

// ── 4비트 슬롯 HTML 생성 헬퍼 ─────────────────────────────────────
const SLOT_MAP = { 1:[0], 2:[0,2], 3:[0,2,3], 4:[0,1,2,3] };

// 왼쪽 기호 시각화
function leftMarkHtml(mark) {
  if (!mark) return '';
  if (mark === '||:') {
    return `<div style="position:absolute;left:0;top:0;bottom:0;width:8px;display:flex;align-items:stretch;z-index:1;pointer-events:none">
      <div style="width:3px;background:var(--accent);border-radius:2px 0 0 2px"></div>
      <div style="width:1px;background:var(--accent);margin:3px 1px"></div>
      <div style="display:flex;flex-direction:column;justify-content:space-evenly;width:3px;padding:4px 0">
        <div style="width:2px;height:2px;border-radius:50%;background:var(--accent)"></div>
        <div style="width:2px;height:2px;border-radius:50%;background:var(--accent)"></div>
      </div>
    </div>`;
  }
  // segno/coda는 topRow(위 기호행)에서만 표시 — 셀 안에는 렌더 안 함
  return '';
}

// 오른쪽 기호 시각화
function rightMarkHtml(mark) {
  if (!mark) return '';
  if (mark === ':||') {
    return `<div style="position:absolute;right:0;top:0;bottom:0;width:8px;display:flex;align-items:stretch;flex-direction:row-reverse;z-index:1;pointer-events:none">
      <div style="width:3px;background:var(--accent);border-radius:0 2px 2px 0"></div>
      <div style="width:1px;background:var(--accent);margin:3px 1px"></div>
      <div style="display:flex;flex-direction:column;justify-content:space-evenly;width:3px;padding:4px 0">
        <div style="width:2px;height:2px;border-radius:50%;background:var(--accent)"></div>
        <div style="width:2px;height:2px;border-radius:50%;background:var(--accent)"></div>
      </div>
    </div>`;
  }
  if (mark === ':||:') {
    return `<div style="position:absolute;right:0;top:0;bottom:0;width:10px;display:flex;align-items:stretch;flex-direction:row-reverse;z-index:1;pointer-events:none">
      <div style="width:3px;background:var(--accent);border-radius:0 2px 2px 0"></div>
      <div style="width:1px;background:var(--accent);margin:3px 1px"></div>
      <div style="display:flex;flex-direction:column;justify-content:space-evenly;width:3px;padding:4px 0">
        <div style="width:2px;height:2px;border-radius:50%;background:var(--accent)"></div>
        <div style="width:2px;height:2px;border-radius:50%;background:var(--accent)"></div>
      </div>
    </div>`;
  }
  // 텍스트 기호(Fine, D.C. 등)는 하단 밴드에서 렌더 — 여기서는 아무것도 반환 안 함
  return '';
}

// 볼타 괄호 시각화
function voltaHtml(volta) {
  if (!volta) return '';
  return `<div style="position:absolute;top:0;left:0;right:0;height:12px;border-left:2px solid #80c8a0;border-top:2px solid #80c8a0;border-radius:3px 0 0 0;pointer-events:none;z-index:1">
    <span style="position:absolute;top:1px;left:4px;font-size:0.6rem;font-weight:700;color:#80c8a0;line-height:1">${volta}</span>
  </div>`;
}

// 마디 셀: 순수하게 4박 슬롯 + 반복 테두리만
function barCellHtml(sec, si, bi, barNum) {
  const b = sec.bars[bi];
  const isPickup = sec.pickup && bi === 0;
  const chord = (b.chords || '').trim();
  normalizeBar(b);
  const rs = b.repeatStart || false;   // ||:
  const lm = b.leftMark    || '';      // segno | coda
  const re = b.repeatEnd   || '';      // :|| | :||:
  const rm = b.rightMark   || '';      // Fine | D.C. ...

  const rawChords = chord.split(/\s+/).filter(Boolean);
  const positions = SLOT_MAP[Math.min(rawChords.length, 4)] || [0];
  const slots = ['','','',''];
  rawChords.slice(0,4).forEach((c, i) => { slots[positions[i]] = c; });

  const slotsHtml = slots.map((c, idx) => `
    <div style="flex:1;${idx>0?'border-left:1px solid rgba(128,128,128,0.13);':''}display:flex;align-items:center;justify-content:center;overflow:hidden;padding:1px">
      ${c ? `<span style="font-size:0.78rem;font-weight:700;white-space:nowrap;overflow:hidden;max-width:100%">${c}</span>` : `<span style="display:block;height:1em"></span>`}
    </div>`
  ).join('');

  const borderLeft  = rs                           ? 'border-left:3px solid var(--accent);'  : 'border-left:1px solid var(--border);';
  const borderRight = (re===':||'||re===':||:')    ? 'border-right:3px solid var(--accent);' : 'border-right:1px solid var(--border);';
  const pleft  = rs                        ? 'padding-left:8px;'  : '';
  const pright = (re===':||'||re===':||:') ? 'padding-right:8px;' : '';

  const sc = secColor(si);

  return `<div class="bar-cell" data-si="${si}" data-bi="${bi}"
    style="flex:1;min-width:0;background:${sc.bg};${borderLeft}${borderRight}border-top:1px solid ${sc.border};border-bottom:1px solid ${sc.border};border-radius:4px;position:relative;cursor:text;user-select:none;${pleft}${pright}${isPickup?'max-width:52px;opacity:0.75;':''}display:flex;flex-direction:column;">
    ${rs ? leftMarkHtml('||:') : ''}
    ${rightMarkHtml(re)}
    ${barNum != null ? `<span style="position:absolute;top:2px;${rs?'left:12px':'left:3px'};font-size:0.48rem;color:var(--text2);opacity:0.6;line-height:1;pointer-events:none;z-index:1">${isPickup?'↑':barNum}</span>` : ''}
    <div class="bar-display" style="display:flex;flex:1;min-height:2.6em;align-items:stretch;pointer-events:none;padding:4px 0">${slotsHtml}</div>
    <input class="bar-edit-input" data-si="${si}" data-bi="${bi}" value="${chord}"
      placeholder="${bi+1}"
      style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border:2px solid var(--accent);border-radius:4px;background:var(--bg2);text-align:center;font-weight:700;font-size:0.85rem;padding:0 2px;box-sizing:border-box;z-index:3;color:var(--text)">
  </div>`;
}

// 마디 기호 설정 툴바 HTML
function barMarkToolbarHtml(si, bi, bar) {
  normalizeBar(bar);
  const rs  = bar.repeatStart || false;   // ||: (bool)
  const lm  = bar.leftMark   || '';       // segno | coda | ''
  const re  = bar.repeatEnd  || '';       // :|| | :||: | ''
  const rm  = bar.rightMark  || '';       // Fine | D.C. | ...
  const vt  = bar.volta      || '';
  const ex  = bar.expr       || '';
  const bm  = bar.memo       || '';

  const mkToggle = (field, val, label, active, color) =>
    `<button class="bar-mark-btn" data-si="${si}" data-bi="${bi}" data-field="${field}" data-val="${val}"
      style="display:inline-flex;align-items:center;gap:3px;font-size:0.72rem;padding:4px 8px;border-radius:4px;
             border:1px solid ${active?(color||'var(--accent)'):'var(--border)'};
             background:${active?(color||'var(--accent)')+'22':'var(--bg3)'};
             color:${active?(color||'var(--accent)'):'var(--text2)'};
             cursor:pointer;font-weight:${active?'700':'400'};white-space:nowrap">${label}</button>`;

  // 왼쪽: ||:(toggle bool) + Segno/Coda(단일선택)
  const rsBtn  = mkToggle('repeatStart', 'true', '||: 반복시작', rs, 'var(--accent)');
  const lmBtns = LEFT_MARK_OPTIONS.filter(o=>o.value).map(o =>
    mkToggle('leftMark', o.value, markDisplayHtml(o.value), lm===o.value, o.color)
  ).join('');

  // 오른쪽: :|| / :||:(단일선택) + Fine/D.C. 등(단일선택)
  const reBtns = REPEAT_END_OPTIONS.filter(o=>o.value).map(o =>
    mkToggle('repeatEnd', o.value, o.label, re===o.value, o.color)
  ).join('');
  const rmBtns = TEXT_MARK_OPTIONS.filter(o=>o.value).map(o =>
    mkToggle('rightMark', o.value, o.label, rm===o.value, o.color)
  ).join('');

  const vBtns = VOLTA_OPTIONS.filter(o=>o.value).map(o =>
    mkToggle('volta', o.value, o.label, vt===o.value, '#80c8a0')
  ).join('');
  const eBtns = EXPR_OPTIONS.filter(o=>o.value).map(o =>
    mkToggle('expr', o.value, markDisplayHtml(o.value)||o.label, ex===o.value, 'var(--accent)')
  ).join('');

  return `<div class="bar-mark-toolbar" data-si="${si}" data-bi="${bi}"
    style="position:fixed;left:0;top:0;z-index:9999;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,0.45);min-width:320px;width:max-content;max-width:90vw">
    <div style="display:flex;justify-content:flex-end;margin-bottom:6px">
      <button class="bar-toolbar-close" style="background:none;border:none;color:var(--text2);font-size:1rem;cursor:pointer;padding:0 2px;line-height:1;opacity:0.6">✕</button>
    </div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">← 왼쪽 (복수 선택 가능)</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${rsBtn}${lmBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">→ 오른쪽 반복</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px">${reBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">→ 오른쪽 텍스트 기호</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${rmBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">볼타 괄호</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${vBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">다이나믹 / 템포</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${eBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">마디 메모</div>
    <textarea class="bar-memo-input" data-si="${si}" data-bi="${bi}"
      placeholder="가사, 운지법, 지시어..."
      style="width:100%;font-size:0.78rem;color:var(--text);background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:6px 8px;resize:vertical;min-height:52px;font-family:inherit;line-height:1.4;box-sizing:border-box;margin-bottom:6px">${escHtml(bm)}</textarea>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:0.65rem;color:var(--text2)">메모 색상</span>
      ${['var(--text2)','#e06c75','#61afef','#98c379','#e5c07b','#c678dd','#56b6c2','#ff9f43'].map(col =>
        `<div class="bar-memo-color-btn" data-si="${si}" data-bi="${bi}" data-color="${col}"
          style="width:16px;height:16px;border-radius:50%;background:${col};cursor:pointer;border:2px solid ${(bar.memoColor||'var(--text2)')===col?'white':'transparent'};box-sizing:border-box;flex-shrink:0"></div>`
      ).join('')}
    </div>
  </div>`;
}

function sectionRowsHtml(sec, si, barOffset) {
  const bpr = sec.barsPerRow || 4;
  const bars = sec.bars;
  const rowMemos = sec.rowMemos || {};
  const rowGroups = [];
  const start = sec.pickup && bars.length > 0 ? 1 : 0;
  if (sec.pickup && bars.length > 0) rowGroups.push([0]);
  for (let i = start; i < bars.length; i += bpr) {
    rowGroups.push(Array.from({ length: Math.min(bpr, bars.length - i) }, (_, k) => i + k));
  }

  return rowGroups.map((idxs, rowIdx) => {
    const missing = bpr - idxs.length;
    const spacerUnit = `<div style="flex:1;min-width:0"></div>`;
    const spacers = missing > 0 ? Array(missing).fill(spacerUnit).join('') : '';

    // ─── 볼타 그룹 계산: 연속된 같은 volta 값 → 첫 마디만 border-left, 전체 border-top ───
    // volta가 있는 연속 구간을 찾아 span 처리
    const voltaSpans = []; // { start, end, label }
    let vStart = null, vLabel = null;
    idxs.forEach((bi, pos) => {
      const v = bars[bi].volta || '';
      if (v && v !== vLabel) {
        if (vStart !== null) voltaSpans.push({ start: vStart, end: pos - 1, label: vLabel });
        vStart = pos; vLabel = v;
      } else if (!v && vStart !== null) {
        voltaSpans.push({ start: vStart, end: pos - 1, label: vLabel });
        vStart = null; vLabel = null;
      }
    });
    if (vStart !== null) voltaSpans.push({ start: vStart, end: idxs.length - 1, label: vLabel });
    // pos→span 매핑
    const voltaSpanMap = {}; // pos → { isFirst, isLast, label }
    voltaSpans.forEach(vs => {
      for (let p = vs.start; p <= vs.end; p++) {
        voltaSpanMap[p] = { isFirst: p === vs.start, isLast: p === vs.end, label: vs.label };
      }
    });

    // ─── 위 기호 행 (층 구조: 위=세뇨/코다, 아래=볼타 괄호) ───
    // 세뇨/코다 있는 마디가 있으면 topRow를 2층으로 (34px), 없으면 1층 (18px)
    const hasSymIcon = idxs.some(bi => { normalizeBar(bars[bi]); const lm = bars[bi].leftMark||''; return lm==='segno'||lm==='coda'; });
    const hasVolta   = idxs.some(bi => bars[bi].volta);
    const topH = (hasSymIcon && hasVolta) ? 34 : (hasSymIcon || hasVolta) ? 22 : 14;
    // 볼타 괄호 상단 위치: 세뇨/코다가 위층을 쓰면 아래로 밀림
    const voltaTop = hasSymIcon ? 16 : 4;

    const topRow = `<div style="display:flex;gap:3px;height:${topH}px;align-items:stretch">
      ${idxs.map((bi, pos) => {
        normalizeBar(bars[bi]);
        const b = bars[bi];
        const lm = b.leftMark || '';
        const vs = voltaSpanMap[pos];
        let inner = '';
        // 볼타 괄호 — 하단층
        if (vs) {
          const bl = vs.isFirst ? 'border-left:2px solid #80c8a0;' : '';
          const br = vs.isLast  ? 'border-right:2px solid #80c8a0;' : '';
          inner += `<div style="position:absolute;top:${voltaTop}px;left:0;right:0;bottom:0;${bl}${br}border-top:2px solid #80c8a0;border-radius:${vs.isFirst?'3px':0} ${vs.isLast?'3px':0} 0 0;pointer-events:none"></div>`;
          if (vs.isFirst) inner += `<span style="position:absolute;top:${voltaTop+2}px;left:6px;font-size:0.68rem;font-weight:700;color:#80c8a0;line-height:1">${vs.label}</span>`;
        }
        // 세뇨/코다 — 상단층 왼쪽
        if (lm === 'segno' || lm === 'coda') {
          const lmColor = LEFT_MARK_OPTIONS.find(o=>o.value===lm)?.color || 'var(--accent)';
          inner += `<div style="position:absolute;top:0;left:2px">${markIconHtml(lm, lmColor, 14)}</div>`;
        }
        return `<div style="flex:1;min-width:0;position:relative;height:${topH}px">${inner}</div>`;
      }).join('')}
      ${spacers}
    </div>`;

    // ─── 마디 셀 행 ───
    const cellRow = `<div style="display:flex;gap:3px">
      ${idxs.map(bi => barCellHtml(sec, si, bi, barOffset + bi + 1)).join('')}
      ${missing > 0 ? Array(missing).fill(`<div style="flex:1;min-width:0;visibility:hidden;border:1px solid var(--border);border-radius:4px;min-height:2.6em"></div>`).join('') : ''}
    </div>`;

    // ─── 마디별 메모 행 ───
    const hasBarMemo = idxs.some(bi => bars[bi].memo);
    const barMemoRow = `<div class="bar-memo-row" style="display:flex;gap:3px;margin-top:1px">
      ${idxs.map(bi => {
        const bm = bars[bi].memo || '';
        const mc = bars[bi].memoColor || 'var(--text2)';
        return `<div class="bar-memo-cell" data-si="${si}" data-bi="${bi}" style="flex:1;min-width:0;min-height:${hasBarMemo?'auto':'10px'};cursor:text;padding:${bm?'3px 5px':'2px 0'};border-radius:3px;transition:background 0.15s" title="클릭하여 메모">
          <div class="bar-memo-display" style="font-size:0.8rem;font-weight:600;color:${mc};white-space:pre-wrap;line-height:1.4;word-break:break-all">${bm ? escHtml(bm) : (hasBarMemo ? '' : '<span style="opacity:0;font-size:0.6rem">·</span>')}</div>
        </div>`;
      }).join('')}
      ${missing > 0 ? Array(missing).fill(`<div style="flex:1;min-width:0"></div>`).join('') : ''}
    </div>`;

    // ─── 아래 기호 행 ───
    const botRow = `<div style="display:flex;gap:3px;align-items:flex-start">
      ${idxs.map(bi => {
        const b = bars[bi];
        const rm = b.rightMark || '';   // Fine | D.C. ...
        const expr = b.expr || '';
        const color = TEXT_MARK_OPTIONS.find(o => o.value === rm)?.color || 'var(--accent)';
        let inner = '';
        if (rm)   inner += `<div style="font-size:0.62rem;font-weight:700;font-style:italic;color:${color};line-height:1.3;text-align:right;padding:1px 4px 0">${rm}</div>`;
        if (expr) inner += `<div style="font-size:0.6rem;font-style:italic;color:#aaa;line-height:1.3;padding:1px 4px 0">${expr}</div>`;
        return `<div style="flex:1;min-width:0;overflow:hidden;min-height:14px">${inner}</div>`;
      }).join('')}
      ${spacers}
    </div>`;

    // ─── 행 사이 메모 ───
    const memo = rowMemos[rowIdx] || '';
    const memoRow = `<div class="row-memo-wrap" data-si="${si}" data-row="${rowIdx}"
      style="display:flex;align-items:center;gap:4px;min-height:${memo?'auto':'16px'};padding:${memo?'3px':'1px'} 0;cursor:text;border-radius:3px;transition:background 0.15s"
      title="메모 클릭하여 편집">
      <span style="font-size:0.6rem;color:var(--text2);opacity:0.4;flex-shrink:0">✎</span>
      <div class="row-memo-display" style="flex:1;font-size:0.72rem;color:var(--text2);font-style:italic;white-space:pre-wrap;line-height:1.3;min-height:14px;word-break:break-all">${memo ? escHtml(memo) : '<span style="opacity:0.25">메모...</span>'}</div>
      <textarea class="row-memo-input" data-si="${si}" data-row="${rowIdx}"
        placeholder="메모, 가사, 운지법 등..."
        style="display:none;flex:1;font-size:0.72rem;color:var(--text);background:var(--bg2);border:1px solid var(--accent);border-radius:3px;padding:3px 6px;resize:vertical;min-height:28px;font-family:inherit;line-height:1.4;box-sizing:border-box">${memo ? escHtml(memo) : ''}</textarea>
    </div>`;

    return `<div style="margin-bottom:4px">${topRow}${cellRow}${botRow}${barMemoRow}${memoRow}</div>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderSections(ed, draft) {
  const area = ed.querySelector('#sections-area');
  // body에 붙은 툴바 정리
  document.querySelectorAll('.bar-mark-toolbar').forEach(t => t.remove());

  // 모든 bar 정규화 (구버전 데이터 호환)
  draft.sections.forEach(sec => sec.bars.forEach(normalizeBar));

  // 전체 마디 번호 offset 계산
  let offset = 0;
  const offsets = draft.sections.map(s => { const o = offset; offset += s.bars.length; return o; });

  area.innerHTML = draft.sections.map((sec, si) => {
    const bpr = sec.barsPerRow || draft.defaultBarsPerRow || 4;
    const symOpen = sec.symOpen || false;
    const symLabel = [
      sec.startMark || '',
      sec.repeatStart ? '||:' : '',
      sec.repeatEnd   ? ':||' : '',
      sec.endMark     || '',
    ].filter(Boolean).join(' ') || '';

    return `
    <div class="card sec-block" data-si="${si}" style="margin-bottom:8px">
      <!-- 섹션 헤더 -->
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <input type="text" class="sec-type-input" data-si="${si}" value="${sec.type}"
          placeholder="섹션 이름"
          style="font-weight:700;font-size:0.92rem;color:var(--accent);background:transparent;border:none;border-bottom:1px dashed var(--border);padding:2px 4px;min-width:60px;max-width:120px">
        ${symLabel ? `<span style="font-size:0.75rem;color:var(--text2);font-family:serif">${symLabel}</span>` : ''}
        <span style="font-size:0.72rem;color:var(--text2)">${sec.bars.length}마디</span>
        <!-- 마디/행 -->
        <button class="btn sec-bpr-btn ${bpr===4?'btn-primary':'btn-secondary'}" data-si="${si}" data-val="4" style="font-size:0.7rem;padding:2px 7px">4</button>
        <button class="btn sec-bpr-btn ${bpr===8?'btn-primary':'btn-secondary'}" data-si="${si}" data-val="8" style="font-size:0.7rem;padding:2px 7px">8</button>
        <input type="number" class="inp-bpr" data-si="${si}" min="1" max="16" value="${bpr}"
          style="width:40px;font-size:0.75rem;padding:1px 4px;text-align:center" title="커스텀 마디/행">
        <!-- 마디 추가/삭제 -->
        <button class="btn btn-secondary add-bar-btn" data-si="${si}" data-unit="1" style="font-size:0.7rem;padding:2px 7px">+1마디</button>
        <button class="btn btn-secondary add-bar-btn" data-si="${si}" data-unit="row" style="font-size:0.7rem;padding:2px 7px">+1행</button>
        <button class="btn btn-secondary remove-bar-btn" data-si="${si}" style="font-size:0.7rem;padding:2px 7px">−1마디</button>
        <!-- 기호 토글 -->
        <button class="btn btn-secondary sec-sym-toggle" data-si="${si}" style="font-size:0.7rem;padding:2px 7px">기호${symOpen?'▴':'▾'}</button>
        <!-- 삭제 -->
        <button class="btn btn-secondary del-sec" data-si="${si}" style="font-size:0.7rem;padding:2px 7px;color:var(--danger);margin-left:auto">🗑</button>
      </div>

      <!-- 섹션 옵션 패널 (접기/펼치기) -->
      <div class="sym-panel" data-si="${si}" style="display:${symOpen?'flex':'none'};flex-wrap:wrap;gap:6px;margin-bottom:10px;padding:8px;background:var(--bg2);border-radius:6px;align-items:center">
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-pickup" data-si="${si}" ${sec.pickup?'checked':''}> 못갖춘마디 (픽업)
        </label>
        <input type="text" class="memo-input" data-si="${si}" value="${sec.memo||''}"
          placeholder="메모 (카포2, 느리게, 8비트...)"
          style="flex:1;min-width:140px;font-size:0.78rem;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">
        <span style="font-size:0.72rem;color:var(--text2)">💡 마디 클릭 후 기호 버튼으로 ||: :|| Fine 등 설정</span>
      </div>

      <!-- 마디 그리드 (클릭 편집 가능) -->
      <div class="bar-rows" data-si="${si}">
        ${sectionRowsHtml(sec, si, offsets[si])}
      </div>
    </div>`;
  }).join('');

  // ── 이벤트 바인딩 ────────────────────────────────────────────────

  // 섹션 이름
  area.querySelectorAll('.sec-type-input').forEach(inp => {
    inp.addEventListener('input', () => { draft.sections[+inp.dataset.si].type = inp.value; });
  });

  // 기호 토글
  area.querySelectorAll('.sec-sym-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const si = +btn.dataset.si;
      draft.sections[si].symOpen = !draft.sections[si].symOpen;
      renderSections(ed, draft);
    });
  });

  // 섹션 삭제
  area.querySelectorAll('.del-sec').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('이 섹션을 삭제하시겠습니까?')) return;
      draft.sections.splice(+btn.dataset.si, 1);
      renderSections(ed, draft);
    });
  });

  // ── 마디 셀 인라인 편집 ──────────────────────────────────────────
  area.querySelectorAll('.bar-cell').forEach(cell => {
    cell.addEventListener('click', () => openBarCell(cell));
  });

  function openBarCell(cell) {
    const inp = cell.querySelector('.bar-edit-input');
    const disp = cell.querySelector('.bar-display');
    if (!inp || inp.style.display === 'block') return;

    // 열려 있는 다른 툴바 제거 (body 포함)
    document.querySelectorAll('.bar-mark-toolbar').forEach(t => t.remove());

    inp.style.display = 'block';
    disp.style.visibility = 'hidden';
    inp.focus();
    inp.select();

    // 기호 툴바 생성
    const si = +inp.dataset.si, bi = +inp.dataset.bi;
    const bar = draft.sections[si].bars[bi];
    const toolbar = document.createElement('div');
    toolbar.innerHTML = barMarkToolbarHtml(si, bi, bar);
    const toolbarEl = toolbar.firstElementChild;
    document.body.appendChild(toolbarEl);

    // 셀 아래에 위치, 뷰포트 경계 보정
    requestAnimationFrame(() => {
      const cellRect = cell.getBoundingClientRect();
      const tw = toolbarEl.offsetWidth;
      const th = toolbarEl.offsetHeight;
      let left = cellRect.left;
      let top = cellRect.bottom + 4;
      if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
      if (left < 8) left = 8;
      if (top + th > window.innerHeight - 8) top = cellRect.top - th - 4;
      toolbarEl.style.left = left + 'px';
      toolbarEl.style.top = top + 'px';
    });

    // 닫기 버튼
    const closeBtn = toolbarEl.querySelector('.bar-toolbar-close');
    if (closeBtn) {
      closeBtn.addEventListener('mousedown', e => e.preventDefault());
      closeBtn.addEventListener('click', () => { renderSections(ed, draft); });
    }

    // 기호 버튼 — mousedown으로 blur 방지, click으로 토글
    toolbarEl.querySelectorAll('.bar-mark-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault()); // blur 방지
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const val = btn.dataset.val;
        const b = draft.sections[si].bars[bi];
        normalizeBar(b);
        // repeatStart는 bool 토글, 나머지는 같은 값 클릭 시 해제
        if (field === 'repeatStart') {
          b.repeatStart = !b.repeatStart;
        } else {
          b[field] = (b[field] === val) ? '' : val;
        }
        // 툴바 버튼 상태 업데이트
        toolbarEl.querySelectorAll(`.bar-mark-btn[data-field="${field}"]`).forEach(b2 => {
          const opt = (field === 'leftMark' ? LEFT_MARK_OPTIONS : field === 'rightMark' ? RIGHT_MARK_OPTIONS : field === 'volta' ? VOLTA_OPTIONS : EXPR_OPTIONS).find(o => o.value === b2.dataset.val);
          const color = opt?.color || 'var(--accent)';
          const isActive = b[field] === b2.dataset.val;
          b2.style.border = `1px solid ${isActive ? color : 'var(--border)'}`;
          b2.style.background = isActive ? color + '22' : 'var(--bg3)';
          b2.style.color = isActive ? color : 'var(--text2)';
          b2.style.fontWeight = isActive ? '700' : '400';
        });
        // 섹션 재렌더 후 같은 셀 다시 열기
        renderSections(ed, draft);
        const updatedCell = area.querySelector(`.bar-cell[data-si="${si}"][data-bi="${bi}"]`);
        if (updatedCell) openBarCell(updatedCell);
      });
    });

    // 마디 메모 textarea (툴바 안)
    const memoTa = toolbarEl.querySelector('.bar-memo-input');
    if (memoTa) {
      memoTa.addEventListener('mousedown', e => e.stopPropagation());
      memoTa.addEventListener('input', () => {
        draft.sections[si].bars[bi].memo = memoTa.value;
      });
      memoTa.addEventListener('blur', () => {
        draft.sections[si].bars[bi].memo = memoTa.value;
        // 메모 표시 영역 즉시 갱신
        const dispEl = cell.querySelector('.bar-memo-display');
        if (memoTa.value) {
          if (dispEl) { dispEl.innerHTML = escHtml(memoTa.value); }
          else {
            const d = document.createElement('div');
            d.className = 'bar-memo-display';
            d.style.cssText = 'font-size:0.65rem;color:var(--text2);font-style:italic;padding:1px 4px 2px;border-top:1px dashed var(--border);line-height:1.3;white-space:pre-wrap;pointer-events:none';
            d.innerHTML = escHtml(memoTa.value);
            cell.querySelector('.bar-display').after(d);
          }
        } else {
          dispEl?.remove();
        }
        // 행 메모 셀 표시 갱신
        const memoCell = area.querySelector(`.bar-memo-cell[data-si="${si}"][data-bi="${bi}"]`);
        if (memoCell) {
          const mc = draft.sections[si].bars[bi].memoColor || 'var(--text2)';
          memoCell.querySelector('.bar-memo-display').innerHTML = memoTa.value ? escHtml(memoTa.value) : '';
          memoCell.querySelector('.bar-memo-display').style.color = mc;
          memoCell.style.padding = memoTa.value ? '3px 5px' : '2px 0';
        }
      });

      // 색상 버튼
      toolbarEl.querySelectorAll('.bar-memo-color-btn').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
          const color = btn.dataset.color;
          draft.sections[si].bars[bi].memoColor = color;
          toolbarEl.querySelectorAll('.bar-memo-color-btn').forEach(b2 => {
            b2.style.border = `2px solid ${b2.dataset.color === color ? 'white' : 'transparent'}`;
          });
          const memoCell = area.querySelector(`.bar-memo-cell[data-si="${si}"][data-bi="${bi}"]`);
          if (memoCell) memoCell.querySelector('.bar-memo-display').style.color = color;
        });
      });
    }
  }

  // bar-memo-cell 클릭 → 해당 bar-cell 열기
  area.querySelectorAll('.bar-memo-cell').forEach(mc => {
    mc.addEventListener('click', () => {
      const si2 = +mc.dataset.si, bi2 = +mc.dataset.bi;
      const cell = area.querySelector(`.bar-cell[data-si="${si2}"][data-bi="${bi2}"]`);
      if (cell) openBarCell(cell);
    });
    mc.addEventListener('mouseenter', () => mc.style.background = 'rgba(128,128,128,0.08)');
    mc.addEventListener('mouseleave', () => mc.style.background = '');
  });

  // 셀 표시만 업데이트 (툴바 유지, 입력 유지)
  function updateBarCellDisplay(cell, si, bi, draft) {
    let off = 0;
    for (let i = 0; i < si; i++) off += draft.sections[i].bars.length;
    const barNum = off + bi + 1;
    const sec = draft.sections[si];
    const b = sec.bars[bi];
    // 기호 레이어만 교체
    cell.querySelectorAll('.bar-left-mark-layer,.bar-right-mark-layer,.bar-volta-layer,.bar-expr-layer').forEach(el => el.remove());
    // 재삽입
    const temp = document.createElement('div');
    temp.innerHTML = leftMarkHtml(b.leftMark||'') + rightMarkHtml(b.rightMark||'') + voltaHtml(b.volta||'');
    [...temp.children].forEach(c => cell.insertBefore(c, cell.firstChild));
    // border 업데이트
    if (b.leftMark === '||:') { cell.style.borderLeft = '3px solid var(--accent)'; cell.style.paddingLeft = '10px'; }
    else { cell.style.borderLeft = '1px solid var(--border)'; cell.style.paddingLeft = ''; }
    if (b.rightMark === ':||' || b.rightMark === ':||:') { cell.style.borderRight = '3px solid var(--accent)'; cell.style.paddingRight = '10px'; }
    else { cell.style.borderRight = '1px solid var(--border)'; cell.style.paddingRight = ''; }
  }

  area.querySelectorAll('.bar-edit-input').forEach(inp => {
    const si = +inp.dataset.si;
    const bi = +inp.dataset.bi;

    inp.addEventListener('input', () => {
      draft.sections[si].bars[bi].chords = inp.value;
    });

    inp.addEventListener('blur', e => {
      draft.sections[si].bars[bi].chords = inp.value;
      // 포커스가 툴바 내부로 이동하는 경우 renderSections 하지 않음
      const relatedTarget = e.relatedTarget;
      const cell = inp.closest('.bar-cell');
      if (relatedTarget && cell && cell.contains(relatedTarget)) return;
      renderSections(ed, draft);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        inp.value = draft.sections[si].bars[bi].chords;
        inp.blur();
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        draft.sections[si].bars[bi].chords = inp.value;
        const nextBi = bi + 1;
        if (nextBi >= draft.sections[si].bars.length && e.key === 'Enter') {
          draft.sections[si].bars.push({ chords: '' });
        }
        renderSections(ed, draft);
        const nextCell = area.querySelector(`.bar-cell[data-si="${si}"][data-bi="${nextBi}"]`);
        if (nextCell) openBarCell(nextCell);
      }
    });
  });

  // ─── 행 메모 이벤트 ───
  area.querySelectorAll('.row-memo-wrap').forEach(wrap => {
    const si = +wrap.dataset.si;
    const rowIdx = +wrap.dataset.row;
    const disp = wrap.querySelector('.row-memo-display');
    const ta = wrap.querySelector('.row-memo-input');

    wrap.addEventListener('click', () => {
      if (ta.style.display === 'block') return;
      disp.style.display = 'none';
      ta.style.display = 'block';
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });

    ta.addEventListener('input', () => {
      if (!draft.sections[si].rowMemos) draft.sections[si].rowMemos = {};
      draft.sections[si].rowMemos[rowIdx] = ta.value;
    });

    ta.addEventListener('blur', () => {
      if (!draft.sections[si].rowMemos) draft.sections[si].rowMemos = {};
      draft.sections[si].rowMemos[rowIdx] = ta.value;
      // 표시 모드로 전환
      disp.style.display = 'block';
      ta.style.display = 'none';
      disp.innerHTML = ta.value
        ? escHtml(ta.value).replace(/\n/g, '<br>')
        : '<span style="opacity:0.25">메모...</span>';
    });

    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { ta.blur(); }
    });
  });

  // 마디 추가/삭제
  area.querySelectorAll('.add-bar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const si = +btn.dataset.si;
      const bpr = draft.sections[si].barsPerRow || draft.defaultBarsPerRow || 4;
      const count = btn.dataset.unit === 'row' ? bpr : 1;
      for (let i = 0; i < count; i++) draft.sections[si].bars.push({ chords: '' });
      renderSections(ed, draft);
    });
  });
  area.querySelectorAll('.remove-bar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const si = +btn.dataset.si, bars = draft.sections[si].bars;
      if (bars.length <= 1) return;
      draft.sections[si].bars = bars.slice(0, -1);
      renderSections(ed, draft);
    });
  });

  // 섹션 옵션
  area.querySelectorAll('.chk-pickup').forEach(c => c.addEventListener('change', () => { draft.sections[+c.dataset.si].pickup = c.checked; renderSections(ed, draft); }));
  area.querySelectorAll('.memo-input').forEach(inp => inp.addEventListener('input', () => { draft.sections[+inp.dataset.si].memo = inp.value; }));

  // 마디/행 변경
  area.querySelectorAll('.sec-bpr-btn').forEach(btn => btn.addEventListener('click', () => {
    draft.sections[+btn.dataset.si].barsPerRow = +btn.dataset.val;
    renderSections(ed, draft);
  }));
  area.querySelectorAll('.inp-bpr').forEach(inp => inp.addEventListener('input', () => {
    draft.sections[+inp.dataset.si].barsPerRow = Math.max(1, Math.min(16, +inp.value || 4));
    renderSections(ed, draft);
  }));
}

// (구버전 호환용 stub — 더 이상 사용하지 않음)
function renderPreview() {}



// ── 공개 렌더 함수 (live.js에서도 사용) ──────────────────────────
export function buildChartHtml(draft, opts = {}) {
  const fs = opts.fontSize || '0.95rem';
  const showNums = opts.showBarNumbers !== false;
  let globalBarCount = 0; // 전체 마디 번호 누적

  const sections = (draft.sections || []).map((sec, si) => {
    const bpr = sec.barsPerRow || draft.defaultBarsPerRow || 4;
    const allBars = sec.bars || [];
    if (!allBars.length && !sec.type) return '';

    // 모든 bar 정규화 (구버전 데이터 호환)
    allBars.forEach(normalizeBar);
    // 마디 번호 계산 (전체 bars 기준)
    const startNum = globalBarCount + 1;
    globalBarCount += allBars.length;

    // 못갖춘마디: 첫 마디 작게
    const pickupStyle = 'flex:0 0 auto;min-width:36px;max-width:54px;';
    const normalStyle = 'flex:1;min-width:0;';

    // 행 분할
    const rowGroups = [];
    const rstart = sec.pickup && allBars.length > 0 ? 1 : 0;
    if (sec.pickup && allBars.length > 0) rowGroups.push([0]);
    for (let i = rstart; i < allBars.length; i += bpr) {
      rowGroups.push(Array.from({ length: Math.min(bpr, allBars.length - i) }, (_, k) => i + k));
    }

    const rowMemos = sec.rowMemos || {};
    const rowsHtml = rowGroups.map((rowIdxs, rowIdx) => {
      const missing = bpr - rowIdxs.length;
      const spacerU = `<div style="flex:1;min-width:0"></div>`;
      const spacers = missing > 0 ? Array(missing).fill(spacerU).join('') : '';

      // 볼타 span 계산
      const voltaSpans = [];
      let vStart2 = null, vLabel2 = null;
      rowIdxs.forEach((bi, pos) => {
        const v = allBars[bi].volta || '';
        if (v && v !== vLabel2) {
          if (vStart2 !== null) voltaSpans.push({ start: vStart2, end: pos-1, label: vLabel2 });
          vStart2 = pos; vLabel2 = v;
        } else if (!v && vStart2 !== null) {
          voltaSpans.push({ start: vStart2, end: pos-1, label: vLabel2 });
          vStart2 = null; vLabel2 = null;
        }
      });
      if (vStart2 !== null) voltaSpans.push({ start: vStart2, end: rowIdxs.length-1, label: vLabel2 });
      const vsMap = {};
      voltaSpans.forEach(vs => {
        for (let p = vs.start; p <= vs.end; p++) vsMap[p] = { isFirst: p===vs.start, isLast: p===vs.end, label: vs.label };
      });

      // 위 기호 행 — 세뇨/코다와 볼타가 겹치면 2층으로
      const rHasSymIcon = rowIdxs.some(bi => { normalizeBar(allBars[bi]); const lm=allBars[bi].leftMark||''; return lm==='segno'||lm==='coda'; });
      const rHasVolta   = rowIdxs.some(bi => allBars[bi].volta);
      const rTopH = (rHasSymIcon && rHasVolta) ? 34 : (rHasSymIcon || rHasVolta) ? 22 : 14;
      const rVoltaTop = rHasSymIcon ? 16 : 4;

      const topRow = `<div style="display:flex;gap:3px;height:${rTopH}px;align-items:stretch">
        ${rowIdxs.map((bi, pos) => {
          const b = allBars[bi];
          const lm = b.leftMark || '';
          const vs = vsMap[pos];
          let inner = '';
          if (vs) {
            const bl = vs.isFirst ? 'border-left:2px solid #80c8a0;' : '';
            const br = vs.isLast  ? 'border-right:2px solid #80c8a0;' : '';
            inner += `<div style="position:absolute;top:${rVoltaTop}px;left:0;right:0;bottom:0;${bl}${br}border-top:2px solid #80c8a0;border-radius:${vs.isFirst?'3px':0} ${vs.isLast?'3px':0} 0 0"></div>`;
            if (vs.isFirst) inner += `<span style="position:absolute;top:${rVoltaTop+2}px;left:6px;font-size:0.68rem;font-weight:700;color:#80c8a0;line-height:1">${vs.label}</span>`;
          }
          if (lm === 'segno' || lm === 'coda') {
            const lmColor = LEFT_MARK_OPTIONS.find(o=>o.value===lm)?.color || 'var(--accent)';
            inner += `<div style="position:absolute;top:0;left:2px">${markIconHtml(lm, lmColor, 14)}</div>`;
          }
          return `<div style="flex:1;min-width:0;position:relative;height:${rTopH}px">${inner}</div>`;
        }).join('')}${spacers}
      </div>`;

      // 마디 셀 행
      const cellRow = `<div style="display:flex;gap:3px">
        ${rowIdxs.map(bi => {
          const b = allBars[bi];
          const isPickup = sec.pickup && bi === 0;
          const rawChords = (b.chords || '').trim().split(/\s+/).filter(Boolean);
          const slots = ['','','',''];
          const positions = SLOT_MAP[Math.min(rawChords.length, 4)] || [0];
          rawChords.slice(0,4).forEach((c, i) => { slots[positions[i]] = c; });
          const slotsHtml = slots.map((c, si2) =>
            `<div style="flex:1;${si2>0?'border-left:1px solid rgba(128,128,128,0.13);':''}display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px 1px">
              ${c ? `<span style="font-size:${fs};font-weight:700;white-space:nowrap;overflow:hidden;max-width:100%">${c}</span>` : `<span style="display:block;height:1em"></span>`}
            </div>`
          ).join('');
          normalizeBar(b);
          const barNum = startNum + bi;
          const rs2 = b.repeatStart || false;
          const re2 = b.repeatEnd   || '';
          const bMemo = b.memo || '';
          const sc2 = secColor(si);
          const borderL = rs2 ? 'border-left:3px solid var(--accent);'  : `border-left:1px solid ${sc2.border};`;
          const borderR = (re2===':||'||re2===':||:') ? 'border-right:3px solid var(--accent);' : `border-right:1px solid ${sc2.border};`;
          const pleft  = rs2                           ? 'padding-left:8px;'  : '';
          const pright = (re2===':||'||re2===':||:')   ? 'padding-right:8px;' : '';
          return `<div style="flex:1;min-width:0;background:${sc2.bg};${borderL}${borderR}border-top:1px solid ${sc2.border};border-bottom:1px solid ${sc2.border};border-radius:4px;position:relative;overflow:hidden;display:flex;flex-direction:column;${pleft}${pright}${isPickup?'max-width:54px;opacity:0.8;':''}">
            ${rs2 ? leftMarkHtml('||:') : ''}${rightMarkHtml(re2)}
            ${showNums ? `<span style="position:absolute;top:2px;${rs2?'left:12px':'left:3px'};font-size:0.48rem;color:var(--text2);opacity:0.6;line-height:1;pointer-events:none;z-index:1">${isPickup?'↑':barNum}</span>` : ''}
            <div style="display:flex;flex:1;min-height:2.2em;align-items:stretch;padding:4px 0">${slotsHtml}</div>
          </div>`;
        }).join('')}
        ${missing > 0 ? Array(missing).fill(`<div style="flex:1;min-width:0;visibility:hidden;border:1px solid var(--border);border-radius:4px;min-height:2.2em"></div>`).join('') : ''}
      </div>`;

      // 마디별 메모 행 (읽기 전용)
      const hasBarMemo2 = rowIdxs.some(bi => allBars[bi].memo);
      const barMemoRow2 = hasBarMemo2 ? `<div style="display:flex;gap:3px;margin-top:1px">
        ${rowIdxs.map(bi => {
          const bm2 = allBars[bi].memo || '';
          const mc2 = allBars[bi].memoColor || 'var(--text2)';
          return `<div style="flex:1;min-width:0;padding:${bm2?'3px 5px':'0'}">${bm2 ? `<span style="font-size:0.8rem;font-weight:600;color:${mc2};white-space:pre-wrap;line-height:1.4">${escHtml(bm2)}</span>` : ''}</div>`;
        }).join('')}${spacers}
      </div>` : '';

      // 아래 기호 행
      const botRow = `<div style="display:flex;gap:3px;align-items:flex-start">
        ${rowIdxs.map(bi => {
          const b = allBars[bi];
          const rm = b.rightMark || '';   // Fine | D.C. ...
          const ex = b.expr || '';
          const color = TEXT_MARK_OPTIONS.find(o => o.value === rm)?.color || 'var(--accent)';
          let inner = '';
          if (rm) inner += `<div style="font-size:0.62rem;font-weight:700;font-style:italic;color:${color};line-height:1.3;text-align:right;padding:1px 4px 0">${rm}</div>`;
          if (ex) inner += `<div style="font-size:0.6rem;font-style:italic;color:#aaa;line-height:1.3;padding:1px 4px 0">${ex}</div>`;
          return `<div style="flex:1;min-width:0;overflow:hidden;min-height:14px">${inner}</div>`;
        }).join('')}${spacers}
      </div>`;

      // 메모 (읽기 전용)
      const memo = rowMemos[rowIdx] || '';
      const memoHtmlRow = memo
        ? `<div style="font-size:0.72rem;color:var(--text2);font-style:italic;padding:2px 4px;white-space:pre-wrap;line-height:1.3">${escHtml(memo)}</div>`
        : '';

      return `<div style="margin-bottom:8px">${topRow}${cellRow}${botRow}${barMemoRow2}${memoHtmlRow}</div>`;
    }).join('');

    // 앞 기호
    const startMarkHtml = sec.startMark
      ? `<span style="font-size:1.1rem;margin-right:6px;color:var(--accent)">${sec.startMark}</span>`
      : '';
    // 반복 시작 기호
    const repeatStartHtml = sec.repeatStart
      ? `<span style="font-size:1.1rem;font-weight:900;margin-right:4px;color:var(--text2);font-family:serif">||:</span>`
      : '';
    // 반복 끝 기호
    const repeatEndHtml = sec.repeatEnd
      ? `<span style="font-size:1.1rem;font-weight:900;margin-left:4px;color:var(--text2);font-family:serif">:||</span>`
      : '';
    // 끝 기호
    const endMarkHtml = sec.endMark
      ? `<div style="text-align:right;font-size:0.82rem;font-weight:700;color:var(--accent);margin-top:3px;font-style:italic">${sec.endMark}</div>`
      : '';
    // 메모
    const memoHtml = sec.memo
      ? `<div style="font-size:0.78rem;color:var(--accent2,var(--text2));margin-top:4px;font-style:italic">✏️ ${sec.memo}</div>`
      : '';

    return `
      <div style="margin-bottom:18px">
        <div style="font-weight:700;font-size:0.88rem;color:var(--accent);margin-bottom:5px;display:flex;align-items:center;gap:6px">
          ${startMarkHtml}${repeatStartHtml}
          <span>${sec.type || '—'}</span>
          <span style="flex:1;height:1px;background:var(--border);display:block"></span>
          ${repeatEndHtml}
        </div>
        ${rowsHtml}
        ${endMarkHtml}
        ${memoHtml}
      </div>`;
  }).join('');

  return `
    <div style="padding:4px">
      <div style="font-size:1.15rem;font-weight:700;margin-bottom:2px">${draft.title || '(제목 없음)'}</div>
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:14px">
        ${[draft.key, draft.time, draft.bpm ? draft.bpm+'BPM' : '', draft.artist].filter(Boolean).join(' · ')}
      </div>
      ${sections || '<div style="color:var(--text2);font-size:0.85rem">섹션을 추가하세요.</div>'}
    </div>
  `;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--accent);color:#fff;padding:10px 20px;border-radius:20px;
    font-size:0.85rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);
    white-space:nowrap;animation:fadeInUp 0.2s ease;`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
