import { goTo, on } from './app.js';

function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
function saveDrafts(d) { localStorage.setItem('gta_chart_drafts', JSON.stringify(d)); }
function uuid() { return Date.now().toString(36) + Math.random().toString(36); }

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
  if (!drafts.length) {
    list.innerHTML = `<div class="empty-state">저장된 곡진행이 없습니다.</div>`;
    return;
  }
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
  const drafts = getDrafts();
  let draft = id ? drafts.find(d => d.id === id) : null;
  if (!draft) {
    draft = { id: uuid(), title: prefill.title || '', artist: prefill.artist || '', key: prefill.key || '', bpm: prefill.bpm || '', time: '4/4', sections: [] };
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
    </div>
    <div id="sections-area"></div>

    <!-- 섹션 추가: 자유 텍스트 -->
    <div class="card" style="padding:10px 14px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="text" id="section-name-input" placeholder="섹션 이름 (예: Verse, 솔로, 브릿지, 🎸 인트로...)"
          style="flex:1;min-width:160px" list="section-suggestions">
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

  renderSections(ed, draft);
  renderPreview(ed, draft);

  const secNameInput = ed.querySelector('#section-name-input');
  ed.querySelector('#add-section-btn').addEventListener('click', () => {
    const name = secNameInput.value.trim() || 'Section';
    syncDraft();
    draft.sections.push({ type: name, bars: [{ chords: '' }], memo: '' });
    secNameInput.value = '';
    renderSections(ed, draft);
    renderPreview(ed, draft);
  });
  // Enter 키로도 섹션 추가
  secNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') ed.querySelector('#add-section-btn').click();
  });

  ed.querySelector('#save-btn').addEventListener('click', () => {
    syncDraft();
    if (!draft.title.trim()) { alert('곡명을 입력해주세요.'); return; }
    // 드래프트 저장
    const drafts = getDrafts();
    const idx = drafts.findIndex(d => d.id === draft.id);
    if (idx >= 0) drafts[idx] = draft; else drafts.unshift(draft);
    saveDrafts(drafts);
    // 라이브 셋리스트에 자동 추가 (중복 방지)
    const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!setlists.find(s => s.id === draft.id)) {
      setlists.push({ id: draft.id, title: draft.title, type: 'chart' });
      localStorage.setItem('gta_setlists', JSON.stringify(setlists));
    }
    // 토스트 알림
    showToast('저장 완료 · 라이브 모드에 추가됐습니다 ✅');
  });

  ed.querySelector('#png-btn').addEventListener('click', async () => {
    syncDraft();
    const preview = ed.querySelector('#preview-area');
    try {
      const { default: html2canvas } = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js');
      const canvas = await html2canvas(preview, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#1a1a1a', scale: 2 });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${draft.title || 'chord-chart'}.png`;
      a.click();
    } catch (e) {
      alert('PNG 저장 실패: ' + e.message);
    }
  });

  ed.querySelector('#print-btn').addEventListener('click', () => {
    syncDraft();
    const preview = ed.querySelector('#preview-area');
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>${draft.title || 'Chord Chart'}</title>
      <style>body{font-family:sans-serif;padding:20px;color:#000}
      .section-header{font-weight:700;color:#333;margin-bottom:4px}
      .bar{display:inline-block;min-width:60px;padding:4px 8px;border:1px solid #ccc;border-radius:4px;margin:2px;font-weight:600}
      </style></head><body>${preview.innerHTML}</body></html>`);
    win.document.close();
    win.print();
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
  area.innerHTML = draft.sections.map((sec, si) => `
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <input type="text" class="sec-type-input" data-si="${si}"
          value="${sec.type}"
          placeholder="섹션 이름"
          style="flex:1;font-weight:700;color:var(--accent);background:transparent;border:1px dashed var(--border);border-radius:4px;padding:4px 8px">
        <button class="btn btn-secondary del-sec" data-si="${si}" style="font-size:0.72rem;padding:3px 8px;flex-shrink:0">삭제</button>
      </div>
      <div class="label">마디별 코드 (쉼표로 구분)</div>
      <input type="text" class="bar-input" data-si="${si}"
        value="${sec.bars.map(b=>b.chords).join(', ')}"
        placeholder="예: Am7, D7, Gmaj7, Cmaj7">
      <div class="label" style="margin-top:8px">메모 / 연주 지시어 (자유 입력)</div>
      <input type="text" class="memo-input" data-si="${si}"
        value="${sec.memo}"
        placeholder="예: 카포 2, 8비트, 코드 연타, 느리게...">
    </div>
  `).join('');

  area.querySelectorAll('.sec-type-input').forEach(inp => {
    inp.addEventListener('input', () => {
      draft.sections[Number(inp.dataset.si)].type = inp.value;
      renderPreview(ed, draft);
    });
  });
  area.querySelectorAll('.bar-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const si = Number(inp.dataset.si);
      draft.sections[si].bars = inp.value.split(',').map(s => ({ chords: s.trim() }));
      renderPreview(ed, draft);
    });
  });
  area.querySelectorAll('.memo-input').forEach(inp => {
    inp.addEventListener('input', () => { draft.sections[Number(inp.dataset.si)].memo = inp.value; renderPreview(ed, draft); });
  });
  area.querySelectorAll('.del-sec').forEach(btn => {
    btn.addEventListener('click', () => { draft.sections.splice(Number(btn.dataset.si), 1); renderSections(ed, draft); renderPreview(ed, draft); });
  });
}

function renderPreview(ed, draft) {
  const preview = ed.querySelector('#preview-area');
  // 미리보기도 라이브와 동일한 A+B 형식으로 표시
  preview.innerHTML = buildChartHtml(draft, { fontSize: '0.85rem' });
}

// 라이브 모드와 공유하는 차트 렌더 함수 (export해서 live.js에서도 사용)
export function buildChartHtml(draft, opts = {}) {
  const fs = opts.fontSize || '0.95rem';
  const sections = draft.sections.map(sec => {
    const validBars = sec.bars.filter(b => b.chords?.trim());
    if (!validBars.length && !sec.type) return '';

    // B안: 마디 그리드
    const grid = validBars.map(b =>
      `<div style="
        padding:8px 12px;background:var(--bg3);
        border:1px solid var(--border);border-radius:4px;
        font-size:${fs};font-weight:700;white-space:nowrap;
        min-width:56px;text-align:center
      ">${b.chords}</div>`
    ).join('');

    // 메모
    const memo = sec.memo
      ? `<div style="font-size:0.78rem;color:var(--accent2,var(--text2));margin-top:6px;font-style:italic;padding:0 2px">✏️ ${sec.memo}</div>`
      : '';

    return `
      <div style="margin-bottom:16px">
        <div style="
          font-weight:700;font-size:0.88rem;
          color:var(--accent);margin-bottom:6px;
          display:flex;align-items:center;gap:8px
        ">
          <span>${sec.type || '—'}</span>
          <span style="flex:1;height:1px;background:var(--border);display:block"></span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${grid}</div>
        ${memo}
      </div>`;
  }).join('');

  return `
    <div style="padding:4px">
      <div style="font-size:1.15rem;font-weight:700;margin-bottom:2px">${draft.title || '(제목 없음)'}</div>
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:14px">
        ${[draft.key, draft.time, draft.bpm ? draft.bpm + 'BPM' : '', draft.artist].filter(Boolean).join(' · ')}
      </div>
      ${sections || '<div style="color:var(--text2);font-size:0.85rem">섹션을 추가하세요.</div>'}
    </div>
  `;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--accent);color:#fff;padding:10px 20px;
    border-radius:20px;font-size:0.85rem;z-index:9999;
    box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;
    animation:fadeInUp 0.2s ease;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
