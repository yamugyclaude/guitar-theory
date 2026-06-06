import { goTo, on } from './app.js';

function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
function saveDrafts(d) { localStorage.setItem('gta_chart_drafts', JSON.stringify(d)); }
function uuid() { return Date.now().toString(36) + Math.random().toString(36); }

// ── 음악 기호 정의 ───────────────────────────────────────────────────
// 마디 왼쪽 기호 (bar의 leftMark 필드)
const LEFT_MARK_OPTIONS = [
  { value: '',      label: '없음' },
  { value: '||:',   label: '||:',        desc: '반복 시작', color: 'var(--accent)',    bold: true },
  { value: '𝄋',     label: '𝄋 Segno',    desc: '세뇨',     color: 'var(--accent)' },
  { value: '𝄌',     label: '𝄌 Coda',     desc: '코다',     color: '#e8a020' },
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
  { value: 'To 𝄌',         label: 'To Coda',        desc: '코다로 점프',    color: '#e8a020' },
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
  { value: '𝄐',      label: '𝄐 Fermata',   desc: '늘임표' },
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

// 하위 호환
const END_MARKS = ['', 'D.C.', 'D.S.', 'D.C. al Coda', 'D.S. al Coda', 'Fine'];
const START_MARKS = ['', '𝄋 Segno', '𝄌 Coda'];

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

// ── 4비트 슬롯 HTML 생성 헬퍼 ──────────────────────────────────────
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
  const opt = LEFT_MARK_OPTIONS.find(o => o.value === mark);
  const color = opt?.color || 'var(--accent)';
  return `<div style="position:absolute;left:2px;top:2px;font-size:0.7rem;font-weight:700;color:${color};z-index:1;pointer-events:none;line-height:1">${mark}</div>`;
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
function barCellHtml(sec, si, bi) {
  const b = sec.bars[bi];
  const isPickup = sec.pickup && bi === 0;
  const chord = (b.chords || '').trim();
  const lm = b.leftMark || '';
  const rm = b.rightMark || '';

  const rawChords = chord.split(/\s+/).filter(Boolean);
  const positions = SLOT_MAP[Math.min(rawChords.length, 4)] || [0];
  const slots = ['','','',''];
  rawChords.slice(0,4).forEach((c, i) => { slots[positions[i]] = c; });

  const slotsHtml = slots.map((c, idx) => `
    <div style="flex:1;${idx>0?'border-left:1px solid var(--border);':''}display:flex;align-items:center;justify-content:center;overflow:hidden;padding:1px">
      ${c ? `<span style="font-size:0.78rem;font-weight:700;white-space:nowrap;overflow:hidden;max-width:100%">${c}</span>` : `<span style="display:block;height:1em"></span>`}
    </div>`
  ).join('');

  const borderLeft  = lm === '||:'               ? 'border-left:3px solid var(--accent);'  : 'border-left:1px solid var(--border);';
  const borderRight = (rm===':||'||rm===':||:')  ? 'border-right:3px solid var(--accent);' : 'border-right:1px solid var(--border);';
  const pleft  = lm === '||:'              ? 'padding-left:8px;'  : '';
  const pright = (rm===':||'||rm===':||:') ? 'padding-right:8px;' : '';

  return `<div class="bar-cell" data-si="${si}" data-bi="${bi}"
    style="flex:1;min-width:0;background:var(--bg3);${borderLeft}${borderRight}border-top:1px solid var(--border);border-bottom:1px solid var(--border);border-radius:4px;position:relative;cursor:text;user-select:none;${pleft}${pright}${isPickup?'max-width:52px;opacity:0.75;':''}">
    ${leftMarkHtml(lm)}
    ${rightMarkHtml(rm)}
    <div class="bar-display" style="display:flex;min-height:2.6em;align-items:stretch;pointer-events:none">${slotsHtml}</div>
    <input class="bar-edit-input" data-si="${si}" data-bi="${bi}" value="${chord}"
      placeholder="${bi+1}"
      style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border:2px solid var(--accent);border-radius:4px;background:var(--bg2);text-align:center;font-weight:700;font-size:0.85rem;padding:0 2px;box-sizing:border-box;z-index:3;color:var(--text)">
  </div>`;
}

// 마디 기호 설정 툴바 HTML
function barMarkToolbarHtml(si, bi, bar) {
  const lm = bar.leftMark || '';
  const rm = bar.rightMark || '';
  const vt = bar.volta || '';
  const ex = bar.expr || '';

  const lBtns = LEFT_MARK_OPTIONS.filter(o => o.value).map(o =>
    `<button class="bar-mark-btn" data-si="${si}" data-bi="${bi}" data-field="leftMark" data-val="${o.value}"
      style="font-size:0.68rem;padding:2px 5px;border-radius:3px;border:1px solid ${lm===o.value?o.color||'var(--accent)':'var(--border)'};background:${lm===o.value?(o.color||'var(--accent)')+'22':'var(--bg3)'};color:${lm===o.value?(o.color||'var(--accent)'):'var(--text2)'};cursor:pointer;font-weight:${lm===o.value?'700':'400'};white-space:nowrap"
      title="${o.desc||''}">${o.label}</button>`
  ).join('');

  const rBtns = RIGHT_MARK_OPTIONS.filter(o => o.value).map(o =>
    `<button class="bar-mark-btn" data-si="${si}" data-bi="${bi}" data-field="rightMark" data-val="${o.value}"
      style="font-size:0.68rem;padding:2px 5px;border-radius:3px;border:1px solid ${rm===o.value?o.color||'var(--accent)':'var(--border)'};background:${rm===o.value?(o.color||'var(--accent)')+'22':'var(--bg3)'};color:${rm===o.value?(o.color||'var(--accent)'):'var(--text2)'};cursor:pointer;font-weight:${rm===o.value?'700':'400'};white-space:nowrap"
      title="${o.desc||''}">${o.label}</button>`
  ).join('');

  const vBtns = VOLTA_OPTIONS.filter(o => o.value).map(o =>
    `<button class="bar-mark-btn" data-si="${si}" data-bi="${bi}" data-field="volta" data-val="${o.value}"
      style="font-size:0.68rem;padding:2px 5px;border-radius:3px;border:1px solid ${vt===o.value?'#80c8a0':'var(--border)'};background:${vt===o.value?'#80c8a022':'var(--bg3)'};color:${vt===o.value?'#80c8a0':'var(--text2)'};cursor:pointer;white-space:nowrap"
      title="${o.desc||''}">${o.label}</button>`
  ).join('');

  const eBtns = EXPR_OPTIONS.filter(o => o.value).map(o =>
    `<button class="bar-mark-btn" data-si="${si}" data-bi="${bi}" data-field="expr" data-val="${o.value}"
      style="font-size:0.65rem;padding:2px 5px;border-radius:3px;border:1px solid ${ex===o.value?'var(--accent)':'var(--border)'};background:${ex===o.value?'var(--accent)22':'var(--bg3)'};color:${ex===o.value?'var(--accent)':'var(--text2)'};cursor:pointer;white-space:nowrap;font-style:italic"
      title="${o.desc||''}">${o.label}</button>`
  ).join('');

  return `<div class="bar-mark-toolbar" data-si="${si}" data-bi="${bi}"
    style="position:absolute;left:0;right:0;top:calc(100% + 2px);z-index:20;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:6px 8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:220px">
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">왼쪽 기호</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${lBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">오른쪽 기호</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${rBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">볼타 괄호</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">${vBtns}</div>
    <div style="font-size:0.65rem;color:var(--text2);margin-bottom:3px">다이나믹 / 템포</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap">${eBtns}</div>
  </div>`;
}

function sectionRowsHtml(sec, si, barOffset) {
  const bpr = sec.barsPerRow || 4;
  const bars = sec.bars;
  const rowGroups = [];
  const start = sec.pickup && bars.length > 0 ? 1 : 0;
  if (sec.pickup && bars.length > 0) rowGroups.push([0]);
  for (let i = start; i < bars.length; i += bpr) {
    rowGroups.push(Array.from({ length: Math.min(bpr, bars.length - i) }, (_, k) => i + k));
  }

  return rowGroups.map(idxs => {
    const missing = bpr - idxs.length;
    const spacerUnit = `<div style="flex:1;min-width:0"></div>`;
    const spacers = missing > 0 ? Array(missing).fill(spacerUnit).join('') : '';

    // ─── 위 기호 행 (마디 번호 + 볼타 괄호 + 왼쪽 기호) ───
    const topRow = `<div style="display:flex;gap:3px;height:18px;align-items:flex-end">
      ${idxs.map(bi => {
        const b = bars[bi];
        const isPickup = sec.pickup && bi === 0;
        const barNum = barOffset + bi + 1;
        const volta = b.volta || '';
        const lm = b.leftMark || '';
        let inner = '';
        if (volta) {
          inner += `<div style="position:absolute;inset:0 0 0 0;border-left:2px solid #80c8a0;border-top:2px solid #80c8a0;border-radius:3px 0 0 0;pointer-events:none"></div>
            <span style="position:absolute;top:1px;left:4px;font-size:0.62rem;font-weight:700;color:#80c8a0;line-height:1">${volta}</span>`;
        }
        if (lm === '𝄋' || lm === '𝄌') {
          inner += `<span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:0.85rem;line-height:1">${lm}</span>`;
        }
        const numColor = isPickup ? '#aaa' : 'var(--text2)';
        inner += `<span style="position:absolute;bottom:1px;left:4px;font-size:0.5rem;color:${numColor};line-height:1">${isPickup?'↑':barNum}</span>`;
        return `<div style="flex:1;min-width:0;position:relative;height:18px">${inner}</div>`;
      }).join('')}
      ${spacers}
    </div>`;

    // ─── 마디 셀 행 (코드 슬롯만, 항상 동일 크기) ───
    const cellRow = `<div style="display:flex;gap:3px">
      ${idxs.map(bi => barCellHtml(sec, si, bi)).join('')}
      ${missing > 0 ? Array(missing).fill(`<div style="flex:1;min-width:0;visibility:hidden;border:1px solid var(--border);border-radius:4px;min-height:2.6em"></div>`).join('') : ''}
    </div>`;

    // ─── 아래 기호 행 (Fine / D.C. / expr 등) ───
    const botRow = `<div style="display:flex;gap:3px;height:16px;align-items:flex-start">
      ${idxs.map(bi => {
        const b = bars[bi];
        const rm = b.rightMark || '';
        const expr = b.expr || '';
        const bottomMark = (rm && rm !== ':||' && rm !== ':||:') ? rm : '';
        const color = RIGHT_MARK_OPTIONS.find(o => o.value === bottomMark)?.color || 'var(--accent)';
        let inner = '';
        if (bottomMark) inner += `<span style="position:absolute;top:1px;right:4px;font-size:0.6rem;font-weight:700;font-style:italic;color:${color};line-height:1">${bottomMark}</span>`;
        if (expr)       inner += `<span style="position:absolute;top:1px;left:4px;font-size:0.58rem;font-style:italic;color:#aaa;line-height:1">${expr}</span>`;
        return `<div style="flex:1;min-width:0;position:relative;height:16px">${inner}</div>`;
      }).join('')}
      ${spacers}
    </div>`;

    return `<div style="margin-bottom:12px">${topRow}${cellRow}${botRow}</div>`;
  }).join('');
}

function renderSections(ed, draft) {
  const area = ed.querySelector('#sections-area');

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

    // 열려 있는 다른 툴바 제거
    area.querySelectorAll('.bar-mark-toolbar').forEach(t => t.remove());

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
    cell.style.position = 'relative';
    cell.appendChild(toolbarEl);

    // 기호 버튼 — mousedown으로 blur 방지, click으로 토글
    toolbarEl.querySelectorAll('.bar-mark-btn').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault()); // blur 방지
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const val = btn.dataset.val;
        const b = draft.sections[si].bars[bi];
        // 같은 값 클릭하면 해제 (토글)
        b[field] = (b[field] === val) ? '' : val;
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
  }

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

    inp.addEventListener('blur', () => {
      draft.sections[si].bars[bi].chords = inp.value;
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

  const sections = (draft.sections || []).map(sec => {
    const bpr = sec.barsPerRow || draft.defaultBarsPerRow || 4;
    const allBars = sec.bars || [];
    if (!allBars.length && !sec.type) return '';

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

    const rowsHtml = rowGroups.map(rowIdxs => {
      const missing = bpr - rowIdxs.length;
      const spacerU = `<div style="flex:1;min-width:0"></div>`;
      const spacers = missing > 0 ? Array(missing).fill(spacerU).join('') : '';

      // 위 기호 행
      const topRow = `<div style="display:flex;gap:3px;height:18px;align-items:flex-end">
        ${rowIdxs.map(bi => {
          const b = allBars[bi];
          const barNum = startNum + bi;
          const isPickup = sec.pickup && bi === 0;
          const vt = b.volta || '';
          const lm = b.leftMark || '';
          let inner = '';
          if (vt) inner += `<div style="position:absolute;inset:0;border-left:2px solid #80c8a0;border-top:2px solid #80c8a0;border-radius:3px 0 0 0"></div><span style="position:absolute;top:1px;left:4px;font-size:0.62rem;font-weight:700;color:#80c8a0;line-height:1">${vt}</span>`;
          if (lm === '𝄋' || lm === '𝄌') inner += `<span style="position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:0.85rem;line-height:1">${lm}</span>`;
          if (showNums) inner += `<span style="position:absolute;bottom:1px;left:4px;font-size:0.5rem;color:var(--text2);line-height:1">${isPickup?'↑':barNum}</span>`;
          return `<div style="flex:1;min-width:0;position:relative;height:18px">${inner}</div>`;
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
            `<div style="flex:1;${si2>0?'border-left:1px solid var(--border);':''}display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px 1px">
              ${c ? `<span style="font-size:${fs};font-weight:700;white-space:nowrap;overflow:hidden;max-width:100%">${c}</span>` : `<span style="display:block;height:1em"></span>`}
            </div>`
          ).join('');
          const lm = b.leftMark || '';
          const rm = b.rightMark || '';
          const borderL = lm === '||:' ? 'border-left:3px solid var(--accent);' : 'border-left:1px solid var(--border);';
          const borderR = (rm===':||'||rm===':||:') ? 'border-right:3px solid var(--accent);' : 'border-right:1px solid var(--border);';
          const pleft = lm === '||:' ? 'padding-left:8px;' : '';
          const pright = (rm===':||'||rm===':||:') ? 'padding-right:8px;' : '';
          return `<div style="flex:1;min-width:0;background:var(--bg3);${borderL}${borderR}border-top:1px solid var(--border);border-bottom:1px solid var(--border);border-radius:4px;position:relative;overflow:hidden;display:flex;min-height:2.2em;align-items:stretch;${pleft}${pright}${isPickup?'max-width:54px;opacity:0.8;':''}">
            ${leftMarkHtml(lm)}${rightMarkHtml(rm)}
            ${slotsHtml}
          </div>`;
        }).join('')}
        ${missing > 0 ? Array(missing).fill(`<div style="flex:1;min-width:0;visibility:hidden;border:1px solid var(--border);border-radius:4px;min-height:2.2em"></div>`).join('') : ''}
      </div>`;

      // 아래 기호 행
      const botRow = `<div style="display:flex;gap:3px;height:16px;align-items:flex-start">
        ${rowIdxs.map(bi => {
          const b = allBars[bi];
          const rm = b.rightMark || '';
          const ex = b.expr || '';
          const bm = (rm && rm !== ':||' && rm !== ':||:') ? rm : '';
          const color = RIGHT_MARK_OPTIONS.find(o => o.value === bm)?.color || 'var(--accent)';
          let inner = '';
          if (bm) inner += `<span style="position:absolute;top:1px;right:4px;font-size:0.6rem;font-weight:700;font-style:italic;color:${color};line-height:1">${bm}</span>`;
          if (ex) inner += `<span style="position:absolute;top:1px;left:4px;font-size:0.58rem;font-style:italic;color:#aaa;line-height:1">${ex}</span>`;
          return `<div style="flex:1;min-width:0;position:relative;height:16px">${inner}</div>`;
        }).join('')}${spacers}
      </div>`;

      return `<div style="margin-bottom:8px">${topRow}${cellRow}${botRow}</div>`;
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
