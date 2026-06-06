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
  }
  panel.querySelector('#draft-list').style.display = 'none';
  panel.querySelector('#editor').style.display = 'block';
  renderEditor(panel, draft);
}

function renderEditor(panel, draft) {
  const ed = panel.querySelector('#editor');
  ed.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:2;min-width:140px"><div class="label">곡명</div><input type="text" id="e-title" value="${draft.title}"></div>
        <div style="flex:1;min-width:80px"><div class="label">키</div><input type="text" id="e-key" value="${draft.key}"></div>
        <div style="flex:1;min-width:60px"><div class="label">박자</div><input type="text" id="e-time" value="${draft.time}"></div>
        <div style="flex:1;min-width:60px"><div class="label">BPM</div><input type="text" id="e-bpm" value="${draft.bpm}"></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
        <span style="font-size:0.82rem;color:var(--text2)">기본 마디/행:</span>
        <button class="btn bpr-btn ${draft.defaultBarsPerRow===4?'btn-primary':'btn-secondary'}" data-val="4">4마디</button>
        <button class="btn bpr-btn ${draft.defaultBarsPerRow===8?'btn-primary':'btn-secondary'}" data-val="8">8마디</button>
      </div>
    </div>
    <div id="sections-area"></div>
    <div class="card" style="padding:10px 14px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" id="section-name-input" placeholder="섹션 이름 (예: Verse, 솔로, 브릿지...)" style="flex:1;min-width:160px" list="section-suggestions">
        <datalist id="section-suggestions">
          <option>Intro</option><option>Verse</option><option>Pre-Chorus</option>
          <option>Chorus</option><option>Bridge</option><option>Solo</option><option>Outro</option>
          <option>인트로</option><option>버스</option><option>코러스</option><option>브릿지</option>
        </datalist>
        <button class="btn btn-secondary" id="add-section-btn">+ 섹션 추가</button>
      </div>
    </div>
    <hr class="divider">
    <div class="section-label">미리보기</div>
    <div id="preview-area" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="save-btn">💾 저장 + 라이브 추가</button>
      <button class="btn btn-secondary" id="png-btn">PNG</button>
      <button class="btn btn-secondary" id="print-btn">인쇄</button>
      <button class="btn btn-secondary" id="back-btn">← 목록</button>
    </div>
  `;

  function syncDraft() {
    draft.title = ed.querySelector('#e-title').value;
    draft.key   = ed.querySelector('#e-key').value;
    draft.time  = ed.querySelector('#e-time').value;
    draft.bpm   = ed.querySelector('#e-bpm').value;
  }

  // 기본 마디/행 버튼
  ed.querySelectorAll('.bpr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.defaultBarsPerRow = Number(btn.dataset.val);
      ed.querySelectorAll('.bpr-btn').forEach(b => b.className = `btn bpr-btn ${b.dataset.val==draft.defaultBarsPerRow?'btn-primary':'btn-secondary'}`);
      renderSections(ed, draft); renderPreview(ed, draft);
    });
  });

  renderSections(ed, draft);
  renderPreview(ed, draft);

  const secNameInput = ed.querySelector('#section-name-input');
  ed.querySelector('#add-section-btn').addEventListener('click', () => {
    const name = secNameInput.value.trim() || 'Section';
    syncDraft();
    draft.sections.push({
      type: name, bars: [{ chords: '' }], memo: '',
      barsPerRow: draft.defaultBarsPerRow || 4,
      pickup: false, repeatStart: false, repeatEnd: false,
      startMark: '', endMark: ''
    });
    secNameInput.value = '';
    renderSections(ed, draft); renderPreview(ed, draft);
  });
  secNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') ed.querySelector('#add-section-btn').click(); });

  ed.querySelector('#save-btn').addEventListener('click', () => {
    syncDraft();
    if (!draft.title.trim()) { alert('곡명을 입력해주세요.'); return; }
    const drafts = getDrafts();
    const idx = drafts.findIndex(d => d.id === draft.id);
    if (idx >= 0) drafts[idx] = draft; else drafts.unshift(draft);
    saveDrafts(drafts);
    const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!setlists.find(s => s.id === draft.id)) {
      setlists.push({ id: draft.id, title: draft.title, type: 'chart' });
      localStorage.setItem('gta_setlists', JSON.stringify(setlists));
    }
    showToast('저장 완료 · 라이브 모드에 추가됐습니다 ✅');
  });

  ed.querySelector('#png-btn').addEventListener('click', async () => {
    syncDraft();
    const preview = ed.querySelector('#preview-area');
    try {
      const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
      const canvas = await html2canvas(preview, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#1a1a1a', scale: 2 });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
      a.download = `${draft.title || 'chord-chart'}.png`; a.click();
    } catch (e) { alert('PNG 저장 실패: ' + e.message); }
  });

  ed.querySelector('#print-btn').addEventListener('click', () => {
    syncDraft();
    const preview = ed.querySelector('#preview-area');
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>${draft.title || 'Chord Chart'}</title>
      <style>body{font-family:sans-serif;padding:20px;color:#000}
      .bar-cell{display:inline-block;min-width:60px;padding:4px 8px;border:1px solid #ccc;border-radius:4px;margin:2px;font-weight:600}
      </style></head><body>${preview.innerHTML}</body></html>`);
    win.document.close(); win.print();
  });

  ed.querySelector('#back-btn').addEventListener('click', () => {
    panel.querySelector('#draft-list').style.display = '';
    ed.style.display = 'none';
    renderDraftList(panel);
  });

  ['#e-title','#e-key','#e-time','#e-bpm'].forEach(sel => {
    ed.querySelector(sel).addEventListener('input', () => { syncDraft(); renderPreview(ed, draft); });
  });
}

function renderSections(ed, draft) {
  const area = ed.querySelector('#sections-area');
  area.innerHTML = draft.sections.map((sec, si) => {
    const bpr = sec.barsPerRow || draft.defaultBarsPerRow || 4;
    return `
    <div class="card" style="margin-bottom:8px" data-si="${si}">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
        <input type="text" class="sec-type-input" data-si="${si}" value="${sec.type}"
          placeholder="섹션 이름"
          style="flex:1;min-width:100px;font-weight:700;color:var(--accent);background:transparent;border:1px dashed var(--border);border-radius:4px;padding:4px 8px">
        <button class="btn btn-secondary del-sec" data-si="${si}" style="font-size:0.72rem;padding:3px 8px">삭제</button>
      </div>

      <!-- 악보 기호 -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center">
        <span style="font-size:0.75rem;color:var(--text2)">기호:</span>
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-repeat-start" data-si="${si}" ${sec.repeatStart?'checked':''}>
          <span style="font-family:serif;font-weight:bold">||:</span> 반복시작
        </label>
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-repeat-end" data-si="${si}" ${sec.repeatEnd?'checked':''}>
          <span style="font-family:serif;font-weight:bold">:||</span> 반복끝
        </label>
        <label style="display:flex;align-items:center;gap:3px;font-size:0.78rem;cursor:pointer">
          <input type="checkbox" class="chk-pickup" data-si="${si}" ${sec.pickup?'checked':''}>
          못갖춘마디
        </label>
        <select class="sel-start-mark" data-si="${si}" style="font-size:0.78rem;padding:2px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">
          ${START_MARKS.map(m => `<option value="${m}" ${sec.startMark===m?'selected':''}>${m||'앞기호 없음'}</option>`).join('')}
        </select>
        <select class="sel-end-mark" data-si="${si}" style="font-size:0.78rem;padding:2px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">
          ${END_MARKS.map(m => `<option value="${m}" ${sec.endMark===m?'selected':''}>${m||'끝기호 없음'}</option>`).join('')}
        </select>
      </div>

      <!-- 마디/행 설정 -->
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:0.75rem;color:var(--text2)">마디/행:</span>
        <button class="btn sec-bpr-btn ${bpr===4?'btn-primary':'btn-secondary'}" data-si="${si}" data-val="4" style="font-size:0.72rem;padding:3px 8px">4</button>
        <button class="btn sec-bpr-btn ${bpr===8?'btn-primary':'btn-secondary'}" data-si="${si}" data-val="8" style="font-size:0.72rem;padding:3px 8px">8</button>
        <input type="number" class="inp-bpr" data-si="${si}" min="1" max="16" value="${bpr}"
          style="width:48px;font-size:0.78rem;padding:2px 6px;text-align:center"
          title="커스텀 마디/행">
      </div>

      <!-- 코드 입력 -->
      <div class="label">마디별 코드 <span style="font-size:0.75rem;color:var(--text2)">(쉼표 구분 · 한 마디 안에 여러 코드는 공백으로: "Am G")</span></div>
      <input type="text" class="bar-input" data-si="${si}"
        value="${sec.bars.map(b=>b.chords).join(', ')}"
        placeholder="예: Am7, D7, Gmaj7, Em · 또는 Am7 D7, Gmaj7, Em (한 마디 2코드)">
      <div class="label" style="margin-top:8px">메모 / 연주 지시어</div>
      <input type="text" class="memo-input" data-si="${si}" value="${sec.memo}" placeholder="예: 카포 2, 느리게, 8비트...">
    </div>
  `}).join('');

  // 이벤트 바인딩
  area.querySelectorAll('.sec-type-input').forEach(inp => {
    inp.addEventListener('input', () => { draft.sections[+inp.dataset.si].type = inp.value; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.bar-input').forEach(inp => {
    inp.addEventListener('input', () => {
      draft.sections[+inp.dataset.si].bars = inp.value.split(',').map(s => ({ chords: s.trim() }));
      renderPreview(ed, draft);
    });
  });
  area.querySelectorAll('.memo-input').forEach(inp => {
    inp.addEventListener('input', () => { draft.sections[+inp.dataset.si].memo = inp.value; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.del-sec').forEach(btn => {
    btn.addEventListener('click', () => { draft.sections.splice(+btn.dataset.si, 1); renderSections(ed, draft); renderPreview(ed, draft); });
  });
  area.querySelectorAll('.chk-repeat-start').forEach(chk => {
    chk.addEventListener('change', () => { draft.sections[+chk.dataset.si].repeatStart = chk.checked; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.chk-repeat-end').forEach(chk => {
    chk.addEventListener('change', () => { draft.sections[+chk.dataset.si].repeatEnd = chk.checked; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.chk-pickup').forEach(chk => {
    chk.addEventListener('change', () => { draft.sections[+chk.dataset.si].pickup = chk.checked; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.sel-start-mark').forEach(sel => {
    sel.addEventListener('change', () => { draft.sections[+sel.dataset.si].startMark = sel.value; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.sel-end-mark').forEach(sel => {
    sel.addEventListener('change', () => { draft.sections[+sel.dataset.si].endMark = sel.value; renderPreview(ed, draft); });
  });
  // 마디/행 버튼
  area.querySelectorAll('.sec-bpr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const si = +btn.dataset.si;
      const val = +btn.dataset.val;
      draft.sections[si].barsPerRow = val;
      area.querySelector(`.inp-bpr[data-si="${si}"]`).value = val;
      area.querySelectorAll(`.sec-bpr-btn[data-si="${si}"]`).forEach(b => {
        b.className = `btn sec-bpr-btn ${+b.dataset.val===val?'btn-primary':'btn-secondary'}`;
        b.style.fontSize = '0.72rem'; b.style.padding = '3px 8px';
      });
      renderPreview(ed, draft);
    });
  });
  area.querySelectorAll('.inp-bpr').forEach(inp => {
    inp.addEventListener('input', () => {
      const si = +inp.dataset.si;
      const val = Math.max(1, Math.min(16, +inp.value || 4));
      draft.sections[si].barsPerRow = val;
      area.querySelectorAll(`.sec-bpr-btn[data-si="${si}"]`).forEach(b => {
        b.className = `btn sec-bpr-btn ${+b.dataset.val===val?'btn-primary':'btn-secondary'}`;
        b.style.fontSize = '0.72rem'; b.style.padding = '3px 8px';
      });
      renderPreview(ed, draft);
    });
  });
}

function renderPreview(ed, draft) {
  ed.querySelector('#preview-area').innerHTML = buildChartHtml(draft, { fontSize: '0.85rem', showBarNumbers: true });
}

// ── 공개 렌더 함수 (live.js에서도 사용) ──────────────────────────
export function buildChartHtml(draft, opts = {}) {
  const fs = opts.fontSize || '0.95rem';
  const showNums = opts.showBarNumbers !== false;
  let globalBarCount = 0; // 전체 마디 번호 누적

  const sections = (draft.sections || []).map(sec => {
    const bpr = sec.barsPerRow || draft.defaultBarsPerRow || 4;
    const validBars = sec.bars.filter(b => b.chords?.trim());
    if (!validBars.length && !sec.type) return '';

    // 마디 번호 계산
    const startNum = globalBarCount + 1;
    globalBarCount += validBars.length;

    // 못갖춘마디: 첫 마디 작게
    const pickupStyle = 'flex:0 0 auto;min-width:40px;max-width:60px;';
    const normalStyle = 'flex:1;min-width:0;';

    // 마디 셀 렌더
    const barCells = validBars.map((b, bi) => {
      const barNum = startNum + bi;
      const isPickup = sec.pickup && bi === 0;
      const style = isPickup ? pickupStyle : normalStyle;
      // 한 마디 안 여러 코드 (공백 구분)
      const chords = b.chords.trim().split(/\s+/).filter(Boolean);
      const chordHtml = chords.length > 1
        ? chords.map(c => `<span style="font-size:${fs};font-weight:700">${c}</span>`).join('<span style="color:var(--text2);margin:0 2px;font-size:0.7em">/</span>')
        : `<span style="font-size:${fs};font-weight:700">${chords[0] || '—'}</span>`;

      return `<div style="
        ${style}
        padding:6px 4px 4px;
        background:var(--bg3);
        border:1px solid var(--border);
        border-radius:4px;
        text-align:center;
        position:relative;
        ${isPickup ? 'opacity:0.8;' : ''}
      ">
        ${showNums ? `<div style="font-size:0.6rem;color:var(--text2);position:absolute;top:2px;left:4px;line-height:1">${isPickup?'↑':barNum}</div>` : ''}
        <div style="padding-top:${showNums?'10px':'0'}">${chordHtml}</div>
      </div>`;
    });

    // 행 분할
    const rows = [];
    const start = sec.pickup && validBars.length > 0 ? 1 : 0;
    if (sec.pickup && validBars.length > 0) rows.push([0]); // 못갖춘마디 단독 행
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
