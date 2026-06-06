import { goTo, on } from './app.js';

function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
function saveDrafts(d) { localStorage.setItem('gta_chart_drafts', JSON.stringify(d)); }
function uuid() { return Date.now().toString(36) + Math.random().toString(36); }

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

function barCellHtml(sec, si, bi, barNum) {
  const b = sec.bars[bi];
  const isPickup = sec.pickup && bi === 0;
  const chord = (b.chords || '').trim();
  const rawChords = chord.split(/\s+/).filter(Boolean);
  const positions = SLOT_MAP[Math.min(rawChords.length, 4)] || [0];
  const slots = ['','','',''];
  rawChords.slice(0,4).forEach((c, i) => { slots[positions[i]] = c; });

  const slotsHtml = slots.map((c, idx) => `
    <div style="flex:1;${idx>0?'border-left:1px solid var(--border);':''}display:flex;align-items:center;justify-content:center;overflow:hidden;padding:1px 1px">
      ${c ? `<span style="font-size:0.75rem;font-weight:700;white-space:nowrap;overflow:hidden;max-width:100%">${c}</span>` : `<span style="display:block;height:1em"></span>`}
    </div>`
  ).join('');

  return `<div class="bar-cell" data-si="${si}" data-bi="${bi}"
    style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:4px;position:relative;cursor:text;user-select:none;${isPickup?'max-width:52px;opacity:0.75;':''}">
    <div style="font-size:0.5rem;color:var(--text2);position:absolute;top:2px;left:3px;line-height:1;pointer-events:none">${isPickup?'↑':barNum}</div>
    <!-- 표시 레이어 -->
    <div class="bar-display" style="display:flex;min-height:2.2em;padding-top:12px;padding-bottom:3px;pointer-events:none">${slotsHtml}</div>
    <!-- 편집 인풋 (클릭 시 표시) -->
    <input class="bar-edit-input" data-si="${si}" data-bi="${bi}" value="${chord}"
      placeholder="${bi+1}"
      style="display:none;position:absolute;inset:0;width:100%;height:100%;border:2px solid var(--accent);border-radius:4px;background:var(--bg2);text-align:center;font-weight:700;font-size:0.82rem;padding:0 2px;box-sizing:border-box;z-index:2;color:var(--text)">
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
  return rowGroups.map(idxs => `
    <div style="display:flex;gap:3px;margin-bottom:3px">
      ${idxs.map(bi => barCellHtml(sec, si, bi, barOffset + bi + 1)).join('')}
    </div>`
  ).join('');
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

      <!-- 악보 기호 패널 (접기/펼치기) -->
      <div class="sym-panel" data-si="${si}" style="display:${symOpen?'flex':'none'};flex-wrap:wrap;gap:6px;margin-bottom:10px;padding:8px;background:var(--bg2);border-radius:6px;align-items:center">
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-repeat-start" data-si="${si}" ${sec.repeatStart?'checked':''}> ||:
        </label>
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-repeat-end" data-si="${si}" ${sec.repeatEnd?'checked':''}> :||
        </label>
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-pickup" data-si="${si}" ${sec.pickup?'checked':''}> 못갖춘마디
        </label>
        <select class="sel-start-mark" data-si="${si}" style="font-size:0.78rem;padding:2px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">
          ${START_MARKS.map(m => `<option value="${m}" ${sec.startMark===m?'selected':''}>${m||'앞기호 없음'}</option>`).join('')}
        </select>
        <select class="sel-end-mark" data-si="${si}" style="font-size:0.78rem;padding:2px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">
          ${END_MARKS.map(m => `<option value="${m}" ${sec.endMark===m?'selected':''}>${m||'끝기호 없음'}</option>`).join('')}
        </select>
        <input type="text" class="memo-input" data-si="${si}" value="${sec.memo||''}"
          placeholder="메모 (카포2, 느리게...)"
          style="flex:1;min-width:120px;font-size:0.78rem;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">
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

  // 마디 셀 클릭 → 편집 인풋 표시
  area.querySelectorAll('.bar-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const inp = cell.querySelector('.bar-edit-input');
      const disp = cell.querySelector('.bar-display');
      if (inp.style.display !== 'none') return;
      inp.style.display = 'block';
      disp.style.display = 'none';
      inp.focus();
      inp.select();
    });
  });

  // 마디 편집 인풋 이벤트
  area.querySelectorAll('.bar-edit-input').forEach(inp => {
    const si = +inp.dataset.si, bi = +inp.dataset.bi;

    // 입력 중 실시간으로 슬롯 갱신
    inp.addEventListener('input', () => {
      draft.sections[si].bars[bi].chords = inp.value;
    });

    // 포커스 잃을 때 → 표시 모드로 전환, 슬롯 업데이트
    const commitAndHide = () => {
      draft.sections[si].bars[bi].chords = inp.value;
      // 해당 셀만 슬롯 재렌더
      const cell = area.querySelector(`.bar-cell[data-si="${si}"][data-bi="${bi}"]`);
      if (cell) {
        let off = 0;
        for (let i = 0; i < si; i++) off += draft.sections[i].bars.length;
        const newCell = document.createElement('div');
        newCell.innerHTML = barCellHtml(draft.sections[si], si, bi, off + bi + 1);
        const replacement = newCell.firstElementChild;
        cell.replaceWith(replacement);
        // 새 셀에도 이벤트 등록
        replacement.addEventListener('click', () => {
          const ni = replacement.querySelector('.bar-edit-input');
          const nd = replacement.querySelector('.bar-display');
          if (ni.style.display !== 'none') return;
          ni.style.display = 'block'; nd.style.display = 'none';
          ni.focus(); ni.select();
        });
        replacement.querySelector('.bar-edit-input').addEventListener('input', () => {
          draft.sections[si].bars[bi].chords = replacement.querySelector('.bar-edit-input').value;
        });
        replacement.querySelector('.bar-edit-input').addEventListener('blur', commitAndHide);
        replacement.querySelector('.bar-edit-input').addEventListener('keydown', handleKey);
      }
    };

    const handleKey = e => {
      if (e.key === 'Escape') { inp.value = draft.sections[si].bars[bi].chords; inp.blur(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        inp.blur(); // commit 먼저
        // 다음 셀로 이동
        const nextBi = bi + 1;
        const nextCell = area.querySelector(`.bar-cell[data-si="${si}"][data-bi="${nextBi}"]`);
        if (nextCell) {
          nextCell.click();
        } else if (e.key === 'Enter') {
          // 마지막 셀 Enter → 마디 추가
          draft.sections[si].bars.push({ chords: '' });
          renderSections(ed, draft);
          const newCell = area.querySelector(`.bar-cell[data-si="${si}"][data-bi="${nextBi}"]`);
          if (newCell) newCell.click();
        }
      }
    };

    inp.addEventListener('blur', commitAndHide);
    inp.addEventListener('keydown', handleKey);
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

  // 악보 기호
  area.querySelectorAll('.chk-repeat-start').forEach(c => c.addEventListener('change', () => { draft.sections[+c.dataset.si].repeatStart = c.checked; renderSections(ed, draft); }));
  area.querySelectorAll('.chk-repeat-end').forEach(c => c.addEventListener('change', () => { draft.sections[+c.dataset.si].repeatEnd = c.checked; renderSections(ed, draft); }));
  area.querySelectorAll('.chk-pickup').forEach(c => c.addEventListener('change', () => { draft.sections[+c.dataset.si].pickup = c.checked; renderSections(ed, draft); }));
  area.querySelectorAll('.sel-start-mark').forEach(s => s.addEventListener('change', () => { draft.sections[+s.dataset.si].startMark = s.value; renderSections(ed, draft); }));
  area.querySelectorAll('.sel-end-mark').forEach(s => s.addEventListener('change', () => { draft.sections[+s.dataset.si].endMark = s.value; renderSections(ed, draft); }));
  area.querySelectorAll('.memo-input').forEach(inp => inp.addEventListener('input', () => { draft.sections[+inp.dataset.si].memo = inp.value; }));

  // 마디/행 변경
  function setBpr(si, val) {
    draft.sections[si].barsPerRow = val;
    renderSections(ed, draft);
  }
  area.querySelectorAll('.sec-bpr-btn').forEach(btn => btn.addEventListener('click', () => setBpr(+btn.dataset.si, +btn.dataset.val)));
  area.querySelectorAll('.inp-bpr').forEach(inp => inp.addEventListener('input', () => setBpr(+inp.dataset.si, Math.max(1, Math.min(16, +inp.value || 4)))));
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

    // 마디 셀 렌더 — 4비트 슬롯
    const barCells = allBars.map((b, bi) => {
      const barNum = startNum + bi;
      const isPickup = sec.pickup && bi === 0;
      const flexStyle = isPickup ? pickupStyle : normalStyle;
      // 공백 구분으로 최대 4개 코드 파싱
      const rawChords = (b.chords || '').trim().split(/\s+/).filter(Boolean);
      // 4 슬롯 배치: 1코드→1번, 2코드→1,3번, 3코드→1,3,4번, 4코드→전부
      const slotMap = SLOT_MAP;
      const slots = ['','','',''];
      const positions = slotMap[Math.min(rawChords.length, 4)] || [0];
      rawChords.slice(0,4).forEach((c, i) => { slots[positions[i]] = c; });

      const slotsHtml = slots.map((c, si2) => {
        const isFirst = si2 === 0;
        const divider = si2 > 0 ? `<span style="color:var(--border);font-size:0.75em;margin:0 1px">|</span>` : '';
        return divider + (c
          ? `<span style="font-size:${fs};font-weight:700;color:var(--text);white-space:nowrap">${c}</span>`
          : `<span style="display:inline-block;min-width:0.5em">&nbsp;</span>`
        );
      }).join('');

      return `<div style="
        ${flexStyle}
        padding:5px 3px 4px;
        background:var(--bg3);
        border:1px solid var(--border);
        border-radius:4px;
        position:relative;
        overflow:hidden;
        ${isPickup ? 'opacity:0.8;' : ''}
      ">
        ${showNums ? `<div style="font-size:0.55rem;color:var(--text2);position:absolute;top:2px;left:3px;line-height:1">${isPickup?'↑':barNum}</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:center;gap:0;padding-top:${showNums?'10px':'2px'};min-height:1.4em">
          ${slotsHtml}
        </div>
      </div>`;
    });

    // 행 분할
    const rows = [];
    const start = sec.pickup && allBars.length > 0 ? 1 : 0;
    if (sec.pickup && allBars.length > 0) rows.push([0]); // 못갖춘마디 단독 행
    for (let i = start; i < barCells.length; i += bpr) {
      rows.push(Array.from({ length: Math.min(bpr, barCells.length - i) }, (_, k) => i + k));
    }

    const rowsHtml = rows.map(rowIdxs => `
      <div style="display:flex;gap:3px;margin-bottom:3px">
        ${rowIdxs.map(i => barCells[i]).join('')}
      </div>
    `).join('');

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
