import { goTo, on } from './app.js';

function getDrafts() { return JSON.parse(localStorage.getItem('gta_chart_drafts') || '[]'); }
function saveDrafts(d) { localStorage.setItem('gta_chart_drafts', JSON.stringify(d)); }
function uuid() { return Date.now().toString(36) + Math.random().toString(36); }

const SECTION_TYPES = ['Intro','Verse','Pre-Chorus','Chorus','Bridge','Solo','Outro'];

export function render(panel) {
  panel.innerHTML = `
    <h1 class="page-title">📝 코드차트</h1>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-primary" id="new-btn">+ 새 차트</button>
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
    list.innerHTML = `<div class="empty-state">저장된 코드차트가 없습니다.</div>`;
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
    <div class="btn-row">
      <select id="section-type-sel">${SECTION_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
      <button class="btn btn-secondary" id="add-section-btn">+ 섹션 추가</button>
    </div>
    <hr class="divider">
    <div id="preview-area" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="save-btn">저장</button>
      <button class="btn btn-secondary" id="png-btn">PNG 저장</button>
      <button class="btn btn-secondary" id="print-btn">인쇄</button>
      <button class="btn btn-link" id="to-live-btn">라이브 모드에 추가 →</button>
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

  ed.querySelector('#add-section-btn').addEventListener('click', () => {
    syncDraft();
    const type = ed.querySelector('#section-type-sel').value;
    draft.sections.push({ type, bars: [{ chords: '' }], memo: '' });
    renderSections(ed, draft);
    renderPreview(ed, draft);
  });

  ed.querySelector('#save-btn').addEventListener('click', () => {
    syncDraft();
    const drafts = getDrafts();
    const idx = drafts.findIndex(d => d.id === draft.id);
    if (idx >= 0) drafts[idx] = draft; else drafts.unshift(draft);
    saveDrafts(drafts);
    alert('저장됐습니다.');
    renderDraftList(panel);
  });

  ed.querySelector('#to-live-btn').addEventListener('click', () => {
    syncDraft();
    const setlists = JSON.parse(localStorage.getItem('gta_setlists') || '[]');
    if (!setlists.find(s => s.id === draft.id)) setlists.push({ id: draft.id, title: draft.title || '(제목 없음)', type: 'chart' });
    localStorage.setItem('gta_setlists', JSON.stringify(setlists));
    alert('라이브 모드 셋리스트에 추가됐습니다.');
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:700;color:var(--accent)">${sec.type}</span>
        <button class="btn btn-secondary del-sec" data-si="${si}" style="font-size:0.72rem;padding:3px 8px">삭제</button>
      </div>
      <div class="label">마디별 코드 (쉼표로 구분)</div>
      <input type="text" class="bar-input" data-si="${si}" value="${sec.bars.map(b=>b.chords).join(', ')}" placeholder="예: Am7, D7, Gmaj7, Cmaj7">
      <div class="label" style="margin-top:8px">메모</div>
      <input type="text" class="memo-input" data-si="${si}" value="${sec.memo}" placeholder="이론 메모 (선택)">
    </div>
  `).join('');

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
  const sections = draft.sections.map(sec => {
    const bars = sec.bars.map(b => b.chords ? `<span style="min-width:60px;display:inline-block;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;margin:2px;font-size:0.85rem">${b.chords}</span>` : '').join('');
    const memo = sec.memo ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:4px;font-style:italic">${sec.memo}</div>` : '';
    return `<div style="margin-bottom:12px"><div style="font-weight:700;font-size:0.9rem;color:var(--accent);margin-bottom:4px">${sec.type}</div><div style="display:flex;flex-wrap:wrap;gap:2px">${bars}</div>${memo}</div>`;
  }).join('');

  preview.innerHTML = `
    <div style="font-size:1.1rem;font-weight:700;margin-bottom:2px">${draft.title || '(제목 없음)'}</div>
    <div style="font-size:0.8rem;color:var(--text2);margin-bottom:12px">${[draft.key, draft.time, draft.bpm ? draft.bpm+'BPM' : ''].filter(Boolean).join(' · ')}</div>
    ${sections || '<div style="color:var(--text2);font-size:0.85rem">섹션을 추가하세요.</div>'}
  `;
}
