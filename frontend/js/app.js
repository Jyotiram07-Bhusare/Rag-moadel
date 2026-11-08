/* ------------------------------------------------------------------
   app.js — UI: state, event reducer, rendering, interactions.
   Plain JS, no framework. Rendering is split per region so animations
   only play when something is actually new.
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = LL.esc;
  const TOTAL = LL.CHECKS.length;
  const VIEWS = ['run', 'lesson', 'log', 'lab', 'rubric', 'memory', 'design'];

  const I = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    gen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    eval: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    decide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 9-9 9-9-9z"/></svg>',
    ship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/></svg>',
    retry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  };

  /* ================= state ================= */
  const SETTINGS_KEY = 'lessonloop.settings.v1';
  const state = {
    view: 'run',
    settings: loadSettings(),
    retries: 2,
    speed: 'normal',
    run: null,
    open: {},
    openPrompt: {},
    draftAttempt: null,
    abort: null,
    lab: { text: LL.composeLesson('', {}), results: null, injected: null },
    fontScale: 1,
  };

  function loadSettings() {
    try { return Object.assign({ engine: 'demo', baseUrl: 'http://localhost:8000' }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
    catch (e) { return { engine: 'demo', baseUrl: 'http://localhost:8000' }; }
  }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch (e) { /* ignore */ } }

  /* The last finished run survives a page reload, so the lesson and its
     rejection log are never lost by accident. Only finished runs are stored. */
  const LASTRUN_KEY = 'lessonloop.lastrun.v1';
  function saveLastRun() {
    try { localStorage.setItem(LASTRUN_KEY, JSON.stringify(state.run)); } catch (e) { /* storage full or blocked */ }
  }
  function forgetLastRun() {
    try { localStorage.removeItem(LASTRUN_KEY); } catch (e) { /* ignore */ }
  }
  function restoreLastRun() {
    try {
      const r = JSON.parse(localStorage.getItem(LASTRUN_KEY) || 'null');
      const valid = r && typeof r.markdown === 'string' && Array.isArray(r.attempts) && r.attempts.length &&
        r.attempts.every(a => a && typeof a.n === 'number' && Array.isArray(a.results));
      if (!valid) return false;
      r.phase = 'ended'; r.rules = r.rules || [];
      state.run = r;
      return true;
    } catch (e) { return false; }
  }

  /* ================= helpers ================= */
  const fmtDate = ts => new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const fmtSecs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; };
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
  const latest = () => (state.run && state.run.attempts.length ? state.run.attempts[state.run.attempts.length - 1] : null);

  function toast(title, msg, tone) {
    const el = document.createElement('div');
    el.className = 'toast ' + (tone || '');
    el.innerHTML = `<b>${esc(title)}</b>${msg ? esc(msg) : ''}`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 4200);
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove(); return ok;
    }
  }

  /* ================= navigation ================= */
  function go(view, opts) {
    if (!VIEWS.includes(view)) view = 'run';
    state.view = view;
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== view; });
    $$('.tabs [data-nav]').forEach(b => { if (b.dataset.nav === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const el = $('#view-' + view);
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    if (!opts || opts.push !== false) { try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// */ } }
    renderView(view);
    if (!opts || opts.scroll !== false) window.scrollTo({ top: 0 });
  }
  function renderView(view) {
    if (view === 'lesson') renderLesson();
    else if (view === 'log') renderLog();
    else if (view === 'lab') renderLab();
    else if (view === 'memory') renderMemory();
  }

  /* ================= run reducer ================= */
  function reduce(e) {
    if (e.type === 'run_start') {
      state.run = {
        id: e.runId, topic: e.topic, maxAttempts: e.maxAttempts, status: 'running', phase: 'start',
        attempts: [], rules: e.rules || [], usedMemory: !!(e.rules && e.rules.length), startedAt: Date.now(), endedAt: null, markdown: null,
      };
      state.open = {}; state.openPrompt = {}; state.draftAttempt = null;
      return;
    }
    const r = state.run; if (!r) return;
    const a = r.attempts.find(x => x.n === e.attempt);

    switch (e.type) {
      case 'attempt_start':
        r.attempts.push({ n: e.attempt, prompt: e.prompt || '', markdown: null, results: [], status: 'generating', passed: false, failed: [], score: 0, total: TOTAL });
        r.phase = 'generating'; state.open = {};
        break;
      case 'lesson':
        if (a) { a.markdown = e.markdown; a.status = 'evaluating'; }
        r.phase = 'evaluating'; state.draftAttempt = e.attempt;
        break;
      case 'check':
        if (a) a.results.push(e.check);
        break;
      case 'attempt_end':
        if (a) { a.status = 'done'; a.passed = !!e.passed; a.failed = e.failed || a.results.filter(x => !x.pass).map(x => x.id); a.score = e.score; a.total = e.total || TOTAL; }
        r.phase = e.passed ? 'passed' : 'decided';
        break;
      case 'feedback':
        r.phase = 'retrying';
        break;
      case 'run_end':
        r.status = e.status; r.markdown = e.markdown; r.endedAt = Date.now(); r.phase = 'ended';
        break;
      case 'error':
        r.status = 'error'; r.error = e.message; r.endedAt = Date.now(); r.phase = 'error';
        break;
    }
  }

  /* Only finished runs (shipped / needs_review) are written to memory. */
  function afterRun() {
    const r = state.run; if (!r) return;
    const promoted = LL.memory.recordRun({ id: r.id, topic: r.topic, status: r.status, attempts: r.attempts, rulesUsed: r.rules.length });
    saveLastRun();
    updateBadges();
    if (r.status === 'shipped') toast('✓ Shipped', `Passed all ${TOTAL} checks on attempt ${r.attempts.length}.`, 'ok');
    else if (r.status === 'needs_review') toast('Held for human review', `Retry limit reached with ${r.attempts.length} attempts.`, 'bad');
    if (promoted.length) setTimeout(() => toast('🧠 Memory updated', `Learned ${promoted.length} new rule${promoted.length > 1 ? 's' : ''}: ${promoted.map(p => p.checkId).join(', ')}. They will be used in the next run.`), 600);
  }

  function handleEvent(e) {
    reduce(e);
    renderRunRegion();
    if (state.view === 'lesson' || state.view === 'log') renderView(state.view);
    if (e.type === 'run_end') {
      afterRun();
      if (state.view === 'memory') renderMemory();
    }
  }

  /* ================= run region rendering ================= */
  let lastStepKey = '';

  function stepStates() {
    const s = { generate: 'idle', evaluate: 'idle', decide: 'idle', ship: 'idle', l: ['idle', 'idle', 'idle'], retry: 'idle', retryText: '' };
    const r = state.run; if (!r) return s;
    const a = latest(); if (!a) return s;
    const retriesUsed = r.attempts.length - 1;
    s.retryText = `Regenerate with feedback · retry ${Math.max(retriesUsed, 1)} of ${r.maxAttempts - 1}`;
    switch (r.phase) {
      case 'generating': s.generate = 'active'; if (retriesUsed > 0) s.retry = 'active'; break;
      case 'evaluating': s.generate = 'done'; s.l[0] = 'done'; s.evaluate = 'active'; s.retry = retriesUsed > 0 ? 'done' : 'idle'; break;
      case 'decided': s.generate = s.evaluate = 'done'; s.l[0] = s.l[1] = 'done'; s.decide = 'active'; break;
      case 'retrying': s.generate = s.evaluate = 'done'; s.l[0] = s.l[1] = 'done'; s.decide = 'fail'; s.retry = 'active'; break;
      case 'passed': s.generate = s.evaluate = 'done'; s.l = ['done', 'done', 'done']; s.decide = 'done'; s.ship = 'active'; s.retry = retriesUsed > 0 ? 'done' : 'idle'; break;
      case 'ended':
        s.generate = s.evaluate = 'done'; s.l[0] = s.l[1] = 'done'; s.retry = retriesUsed > 0 ? 'done' : 'idle';
        if (r.status === 'shipped') { s.decide = 'done'; s.ship = 'done'; s.l[2] = 'done'; }
        else { s.decide = 'fail'; s.ship = 'warn'; s.l[2] = 'done'; }
        break;
      default: // 'stopped' | 'error': show how far the attempt got, nothing animated
        if (a.markdown) { s.generate = 'done'; s.l[0] = 'done'; }
        if (a.status === 'done') { s.evaluate = 'done'; s.l[1] = 'done'; }
        break;
    }
    return s;
  }

  function renderStepper() {
    const s = stepStates();
    const r = state.run;
    const a = latest();
    const regen = a && a.n > 1;
    const key = JSON.stringify([s, regen]);
    if (key === lastStepKey) return;
    lastStepKey = key;
    const step = (name, ico, title, sub, st) =>
      `<div class="step" data-state="${st}"><span class="step-ico">${st === 'done' ? I.check : st === 'fail' ? I.x : ico}</span><span class="step-text"><b>${title}</b><small>${sub}</small></span></div>`;
    const link = st => `<span class="step-link" data-state="${st}"></span>`;
    $('#stepper').innerHTML =
      step('generate', I.gen, regen ? 'Regenerate' : 'Generate', regen ? 'with feedback' : 'write the lesson', s.generate) + link(s.l[0]) +
      step('evaluate', I.eval, 'Evaluate', `${TOTAL} hard checks`, s.evaluate) + link(s.l[1]) +
      step('decide', I.decide, 'Decide', 'all pass?', s.decide) + link(s.l[2]) +
      step('ship', I.ship, s.ship === 'warn' ? 'Hold' : 'Ship', s.ship === 'warn' ? 'human review' : 'lesson + log', s.ship);
    let bar = $('#retry-bar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'retry-bar'; bar.className = 'retry-bar'; $('#stepper').after(bar); }
    bar.dataset.state = s.retry;
    bar.innerHTML = `${I.retry}<span>${s.retry === 'idle' ? 'Retry loop: on any failed check, the reasons are fed back and the lesson is regenerated' : esc(s.retryText)}</span>`;
  }

  function renderStatus() {
    const r = state.run; const el = $('#statusline');
    if (!r) { el.innerHTML = 'Ready. Press <b>Run pipeline</b> to start the loop.'; return; }
    const a = latest();
    const at = a ? `<b>Attempt ${a.n} of ${r.maxAttempts}</b> · ` : '';
    let t;
    switch (r.phase) {
      case 'start': t = 'Starting…'; break;
      case 'generating': t = at + (a.n > 1 ? 'Regenerating with the failure reasons in the prompt…' : 'Generating the lesson…'); break;
      case 'evaluating': t = at + `Evaluating check ${Math.min(a.results.length + 1, TOTAL)} of ${TOTAL}…`; break;
      case 'decided': t = at + `Rejected. ${a.failed.length} check${a.failed.length === 1 ? '' : 's'} failed.`; break;
      case 'retrying': t = at + 'Rejected. Feeding the reasons back to the generator…'; break;
      case 'passed': t = at + `All ${TOTAL} checks passed. Shipping…`; break;
      case 'ended':
        if (r.status === 'shipped') t = `✓ <b>Shipped</b> after ${r.attempts.length} attempt${r.attempts.length > 1 ? 's' : ''}. Every check passed.`;
        else t = `<b>Held for human review.</b> Retry limit reached and ${latest().failed.length} check${latest().failed.length === 1 ? '' : 's'} still failing.`;
        break;
      case 'stopped': t = 'Run stopped.'; break;
      case 'error': t = `<b>Error:</b> ${esc(r.error || 'something went wrong')}`; break;
      default: t = '';
    }
    el.innerHTML = t;
  }

  /* ---- checks ---- */
  function checkRow(r, opts) {
    opts = opts || {};
    const c = LL.checkById[r.id] || { title: r.id };
    return `<li class="check ${r.pass ? 'pass' : 'fail'}${opts.isNew ? ' new' : ''}">
      <span class="check-ico">${r.pass ? I.check : I.x}</span>
      <div class="check-main">
        <div class="check-top"><span class="check-id">${esc(r.id)}</span><span class="check-title">${esc(c.title)}</span></div>
        <p class="check-reason">${esc(r.reason)}</p>
        ${!r.pass && r.evidence ? `<blockquote class="check-evidence">“${esc(r.evidence)}”</blockquote>` : ''}
        ${!r.pass && opts.locate && r.evidence ? `<div class="check-actions"><button class="btn ghost sm" type="button" data-action="locate" data-id="${esc(r.id)}">Locate in text</button></div>` : ''}
      </div></li>`;
  }

  function groupedChecks(results, opts) {
    const byId = Object.fromEntries(results.map(r => [r.id, r]));
    return LL.DIMENSIONS.map(d => {
      const cs = LL.CHECKS.filter(c => c.dim === d.id);
      const rs = cs.map(c => byId[c.id]).filter(Boolean);
      const pass = rs.filter(r => r.pass).length;
      return `<div class="dim-group">
        <div class="dim-group-head"><span>${d.icon}</span>${esc(d.name)}<span class="score ${pass === cs.length ? 'ok' : 'bad'}">${pass}/${cs.length}</span></div>
        <ul class="checks">${rs.map(r => checkRow(r, opts)).join('')}</ul></div>`;
    }).join('');
  }

  /* ---- attempt cards (persistent elements, keyed by attempt number) ---- */
  function attemptInner(a, all) {
    const done = a.status === 'done';
    const rejected = done && !a.passed;
    const open = state.open[a.n] !== undefined ? state.open[a.n] : a.n === all.length;
    const passCount = a.results.filter(r => r.pass).length;
    const cells = Array.from({ length: TOTAL }, (_, i) => {
      const r = a.results[i];
      const cls = r ? (r.pass ? 'pass' : 'fail') : (a.status === 'evaluating' && i === a.results.length ? 'now' : '');
      return `<i class="seg-cell ${cls}"></i>`;
    }).join('');

    let badge, sub;
    if (a.status === 'generating') { badge = '<span class="badge run"><span class="spin"></span>Generating</span>'; sub = a.n > 1 ? 'Rewriting with the failure reasons' : 'Writing the first draft'; }
    else if (a.status === 'evaluating') { badge = '<span class="badge run"><span class="spin"></span>Evaluating</span>'; sub = `${a.results.length} of ${TOTAL} checks done · ${passCount} passed`; }
    else if (rejected) { badge = '<span class="badge fail">✕ Rejected</span>'; sub = `${a.score} of ${a.total} checks passed · ${a.failed.length} failed`; }
    else { badge = '<span class="badge pass">✓ Passed</span>'; sub = `All ${a.total} checks passed`; }

    const failed = a.results.filter(r => !r.pass);
    const passed = a.results.filter(r => r.pass);
    const lastIdx = a.results.length - 1;
    let body = '';

    if (a.status === 'generating') {
      body += `<p class="muted">The generator is writing the lesson…</p>`;
    } else {
      if (failed.length) {
        body += `<div><div class="sub-title">Failed checks <span class="n">${failed.length}</span></div>
          <ul class="checks" style="margin-top:10px">${failed.map(r => checkRow(r, { isNew: a.status === 'evaluating' && a.results.indexOf(r) === lastIdx })).join('')}</ul></div>`;
      }
      if (passed.length) {
        body += `<div><div class="sub-title">Passed checks <span class="n">${passed.length}</span></div>
          <div class="pass-chips" style="margin-top:10px">${passed.map(r => `<span class="chip pass" title="${esc(r.reason)}">${I.check}${esc((LL.checkById[r.id] || {}).title || r.id)}</span>`).join('')}</div></div>`;
      }
      const prev = a.n > 1 ? all.find(x => x.n === a.n - 1) : null;
      if (done && prev && prev.status === 'done') {
        const fixed = prev.failed.filter(id => !a.failed.includes(id));
        const still = prev.failed.filter(id => a.failed.includes(id));
        const added = a.failed.filter(id => !prev.failed.includes(id));
        const chips = (ids, cls) => ids.length ? ids.map(id => `<span class="chip ${cls}">${esc(id)}</span>`).join('') : '<span class="muted">none</span>';
        body += `<div class="changes">
          <div class="sub-title">What changed since attempt ${prev.n}</div>
          <div class="change-row"><b>Fixed</b>${chips(fixed, 'pass')}</div>
          <div class="change-row"><b>Still failing</b>${chips(still, 'warn')}</div>
          <div class="change-row"><b>New regressions</b>${chips(added, 'fail')}</div>
          ${fixed.length ? `<ul class="change-notes">${fixed.map(id => `<li><b>${esc(id)}</b>: ${esc((LL.checkById[id] || {}).fix || 'Fixed.')}</li>`).join('')}</ul>` : ''}
        </div>`;
      }
      if (a.prompt) {
        const isOpen = !!state.openPrompt[a.n];
        body += `<details class="prompt" data-n="${a.n}" ${isOpen ? 'open' : ''}><summary>Prompt sent to the generator${a.n > 1 ? ' (includes the failure reasons)' : ''}</summary><pre>${esc(a.prompt)}</pre></details>`;
      }
      if (a.markdown) {
        body += `<div class="attempt-foot"><button class="btn ghost sm" type="button" data-action="view-draft" data-n="${a.n}">View this draft</button></div>`;
      }
    }

    return `
      <button class="attempt-toggle" type="button" data-action="toggle-attempt" data-n="${a.n}" aria-expanded="${open}" aria-controls="att-body-${a.n}">
        <span class="attempt-num">${a.n}</span>
        <span class="attempt-title"><h3>Attempt ${a.n}</h3><p>${esc(sub)}</p>${rejected ? `<span class="fail-ids">${a.failed.map(id => `<span class="check-id">${esc(id)}</span>`).join('')}</span>` : ''}</span>
        ${badge}${I.chev}
      </button>
      <div class="segbar" aria-hidden="true">${cells}</div>
      ${open ? `<div class="attempt-body" id="att-body-${a.n}">${body}</div>` : ''}`;
  }

  function renderAttempts() {
    const host = $('#attempts');
    const r = state.run;
    if (!r) { host.innerHTML = ''; return; }
    const all = r.attempts;
    all.forEach(a => {
      let el = document.getElementById('att-' + a.n);
      if (!el) {
        el = document.createElement('article');
        el.id = 'att-' + a.n; el.className = 'card attempt';
        host.prepend(el);
      }
      el.dataset.status = a.status === 'done' ? (a.passed ? 'passed' : 'rejected') : 'running';
      el.innerHTML = attemptInner(a, all);
    });
  }

  /* ---- scoreboard (built once, updated in place) ---- */
  const CIRC = 2 * Math.PI * 42;
  function initScoreboard() {
    $('#scoreboard').innerHTML = `
      <div class="score-top">
        <div class="ring" id="ring" data-tone="">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="42"/><circle class="fg" id="ring-fg" cx="50" cy="50" r="42" stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"/></svg>
          <div class="ring-label"><b id="ring-num">0</b><small id="ring-of">of ${TOTAL} checks</small></div>
        </div>
        <div class="verdict"><h3 id="verdict-title">Waiting to run</h3><p id="verdict-desc">Nothing has been generated yet.</p></div>
      </div>
      <div class="stats">
        <div class="stat"><b id="st-attempts">0</b><small>Attempts</small></div>
        <div class="stat"><b id="st-rej">0</b><small>Rejections</small></div>
        <div class="stat"><b id="st-time">–</b><small>Time</small></div>
      </div>
      <div class="side-actions" id="side-actions"></div>`;
  }

  let lastActionsKey = '';
  function renderScoreboard() {
    const r = state.run; const a = latest();
    const passCount = a ? a.results.filter(x => x.pass).length : 0;
    let tone = '', title = 'Waiting to run', desc = 'Nothing has been generated yet.';
    if (r) {
      switch (r.phase) {
        case 'start': case 'generating': tone = ''; title = 'Generating…'; desc = `Attempt ${a ? a.n : 1} of ${r.maxAttempts}`; break;
        case 'evaluating': tone = ''; title = 'Evaluating…'; desc = `${a.results.length} of ${TOTAL} checks done`; break;
        case 'decided': case 'retrying': tone = 'fail'; title = 'Rejected'; desc = `${a.failed.length} failed. Retrying with the reasons.`; break;
        case 'passed': tone = 'pass'; title = 'All checks passed'; desc = 'Shipping the lesson…'; break;
        case 'ended':
          if (r.status === 'shipped') { tone = 'pass'; title = 'Ready to ship'; desc = `Passed ${TOTAL}/${TOTAL} on attempt ${r.attempts.length}.`; }
          else { tone = 'warn'; title = 'Needs human review'; desc = `Still failing ${latest().failed.length} check(s) after ${r.attempts.length} attempts.`; }
          break;
        case 'stopped': tone = ''; title = 'Stopped'; desc = 'The run was stopped.'; break;
        case 'error': tone = 'fail'; title = 'Error'; desc = r.error || 'Something went wrong.'; break;
      }
    }
    $('#ring').dataset.tone = tone;
    $('#ring-fg').setAttribute('stroke-dashoffset', String(CIRC * (1 - passCount / TOTAL)));
    $('#ring-num').textContent = passCount;
    $('#verdict-title').textContent = title;
    $('#verdict-desc').textContent = desc;
    const rej = r ? r.attempts.filter(x => x.status === 'done' && !x.passed).length : 0;
    $('#st-attempts').textContent = r ? `${r.attempts.length}/${r.maxAttempts}` : '0';
    $('#st-rej').textContent = rej;
    $('#st-time').textContent = r ? fmtSecs((r.endedAt || Date.now()) - r.startedAt) : '–';

    const ended = r && r.phase === 'ended' && (r.status === 'shipped' || r.status === 'needs_review');
    const key = ended ? 'ended:' + r.status : '';
    if (key !== lastActionsKey) {
      lastActionsKey = key;
      $('#side-actions').innerHTML = ended
        ? `<button class="btn primary" type="button" data-action="open-lesson">${r.status === 'shipped' ? 'Open final lesson' : 'Open best draft'}</button>
           <button class="btn ghost" type="button" data-action="open-log">View rejection log</button>`
        : '';
    }
  }

  /* ---- draft preview (updates only when content changes) ---- */
  let lastDraftKey = '';
  function renderDraft() {
    const host = $('#draft');
    const r = state.run;
    const done = r ? r.attempts.filter(a => a.markdown) : [];
    if (!done.length) {
      if (lastDraftKey !== 'empty') {
        lastDraftKey = 'empty';
        host.innerHTML = `<div class="draft-head"><h3>Draft preview</h3></div><div class="empty"><span class="em-ico">📝</span><b>No draft yet</b><span>Each attempt’s lesson appears here as soon as it is generated.</span></div>`;
      }
      return;
    }
    let sel = state.draftAttempt && done.find(a => a.n === state.draftAttempt) ? state.draftAttempt : done[done.length - 1].n;
    state.draftAttempt = sel;
    const a = done.find(x => x.n === sel);
    const key = [done.length, sel, a.markdown.length].join(':');
    if (key === lastDraftKey) return;
    lastDraftKey = key;
    host.innerHTML = `
      <div class="draft-head"><h3>Draft preview</h3>
        <label class="sr-only" for="draft-select">Attempt to preview</label>
        <select class="input select" id="draft-select">${done.map(x => `<option value="${x.n}" ${x.n === sel ? 'selected' : ''}>Attempt ${x.n}</option>`).join('')}</select>
      </div>
      <div class="draft-scroll"><div class="prose compact">${LL.renderMarkdown(a.markdown).html}</div></div>`;
  }

  function renderRunRegion() {
    renderStepper(); renderStatus(); renderAttempts(); renderScoreboard(); renderDraft(); updateBadges();
  }

  function updateBadges() {
    const mem = LL.memory.get();
    const rules = mem.rules.length;
    const mc = $('#mem-count'); mc.hidden = !rules; mc.textContent = rules;
    $('#memory-hint').textContent = rules ? `${rules} learned rule${rules > 1 ? 's' : ''} active` : 'no rules learned yet';
    const rej = state.run ? LL.buildRejectionLog(state.run.attempts).length : 0;
    const lc = $('#log-count'); lc.hidden = !rej; lc.textContent = rej; lc.classList.toggle('bad', rej > 0);
  }

  /* ================= final lesson view ================= */
  function feedbackCard() {
    return `<div class="card feedback-form" style="margin-top:22px">
      <div class="card-h"><h3>Reviewer feedback</h3></div>
      <p class="card-sub">Saved to memory and added to the generator prompt on the next run (👎 = fix this, 👍 = keep this).</p>
      <textarea class="input" data-fb-text placeholder="e.g. “The example was great, but explain embeddings with a simpler picture.”"></textarea>
      <div class="rate">
        <button class="btn ghost sm" type="button" data-action="rate" data-rating="up" aria-pressed="false">👍 Helpful</button>
        <button class="btn ghost sm" type="button" data-action="rate" data-rating="down" aria-pressed="false">👎 Needs work</button>
        <button class="btn primary sm" type="button" data-action="save-note" style="margin-left:auto">Save feedback</button>
      </div>
    </div>`;
  }

  function renderLesson() {
    const root = $('#lesson-root');
    const r = state.run;
    if (!r || !r.markdown) {
      root.innerHTML = `<div class="page-head"><p class="eyebrow">Output</p><h2>Final lesson</h2></div>
        <div class="card empty"><span class="em-ico">📘</span><b>No lesson yet</b><span>Run the pipeline. The lesson that clears the bar will appear here.</span>
        <button class="btn primary" type="button" data-action="go-run" style="margin-top:8px">Go to Run</button></div>`;
      return;
    }
    const md = r.markdown;
    const stats = LL.lessonStats(md);
    const parsed = LL.renderMarkdown(md);
    const shipped = r.status === 'shipped';
    const scoreBest = shipped ? TOTAL : LL.evaluate(md).filter(x => x.pass).length;
    root.innerHTML = `
      <div class="card reader-bar">
        <div class="rb-status">
          <span class="rb-icon ${shipped ? 'pass' : 'warn'}">${shipped ? '✅' : '⚠️'}</span>
          <div>
            <h3>${shipped ? `Passed all ${TOTAL} checks` : 'Best draft, not shipped'}</h3>
            <p>${shipped ? `Shipped on attempt ${r.attempts.length} of ${r.maxAttempts}` : `${scoreBest}/${TOTAL} checks passed. Held for human review.`}</p>
          </div>
        </div>
        <div class="rb-tools">
          <span class="fontbtns" role="group" aria-label="Text size"><button type="button" data-action="font-dec" aria-label="Smaller text">A−</button><button type="button" data-action="font-inc" aria-label="Larger text">A+</button></span>
          <button class="btn primary sm" type="button" data-action="copy-rich" title="Copies the lesson with headings, lists and bold, ready to paste into Google Docs or Notion">Copy for Docs</button>
          <button class="btn ghost sm" type="button" data-action="copy-lesson">Copy Markdown</button>
          <button class="btn ghost sm" type="button" data-action="download-lesson">Download .md</button>
          <button class="btn ghost sm" type="button" data-action="print-lesson">Print / PDF</button>
        </div>
      </div>
      <div class="reader">
        <nav class="toc" aria-label="Lesson contents"><h4>In this lesson</h4>${parsed.headings.map(h => `<a href="#${h.id}" data-scroll="${h.id}">${esc(h.text)}</a>`).join('')}</nav>
        <div>
          <article class="card article">
            <div class="meta-row">
              <span class="chip accent">⏱ ~${stats.minutes} min read</span>
              <span class="chip">${stats.words} words</span>
              <span class="chip">${stats.avgSentence.toFixed(1)} words / sentence</span>
              <span class="chip">${esc(r.topic)}</span>
            </div>
            <div class="prose" id="prose">${parsed.html}</div>
          </article>
          ${feedbackCard()}
        </div>
      </div>`;
    $('#prose').style.setProperty('--reader-scale', state.fontScale);
    root.style.setProperty('--reader-scale', state.fontScale);
  }

  /* ================= rejection log view ================= */
  function renderLog() {
    const root = $('#log-root');
    const r = state.run;
    if (!r || !r.attempts.length) {
      root.innerHTML = `<div class="page-head"><p class="eyebrow">Output</p><h2>Rejection log</h2></div>
        <div class="card empty"><span class="em-ico">🗒️</span><b>Nothing logged yet</b><span>After a run, every failed check, the reason, and what changed on retry appears here.</span>
        <button class="btn primary" type="button" data-action="go-run" style="margin-top:8px">Go to Run</button></div>`;
      return;
    }
    const log = LL.buildRejectionLog(r.attempts);
    const rejected = r.attempts.filter(a => a.status === 'done' && !a.passed).length;
    const fixed = log.filter(l => l.resolution === 'fixed').length;
    const groups = r.attempts.filter(a => a.status === 'done').map(a => {
      const items = log.filter(l => l.attempt === a.n);
      return `<div class="log-group">
        <h3>Attempt ${a.n} ${a.passed ? '<span class="badge pass">✓ Passed</span>' : `<span class="badge fail">✕ Rejected · ${a.score}/${a.total}</span>`}</h3>
        ${items.length ? items.map(l => `
          <div class="card log-item">
            <div class="lcheck"><span class="check-id">${esc(l.id)}</span><b>${esc(l.title)}</b></div>
            <div class="lwhy"><div class="col-label">Why it failed</div><p>${esc(l.reason)}</p>${l.evidence ? `<blockquote class="check-evidence">“${esc(l.evidence)}”</blockquote>` : ''}</div>
            <div class="lchange"><div class="col-label">What changed on retry</div><p>${esc(l.change)}</p></div>
            <div>${l.resolution === 'fixed' ? '<span class="badge pass">Fixed</span>' : l.resolution === 'still' ? '<span class="badge warn">Still failing</span>' : l.resolution === 'pending' ? '<span class="badge run">Retrying</span>' : '<span class="badge fail">Unresolved</span>'}</div>
          </div>`).join('')
          : `<div class="card"><p class="muted">No rejections. Every check passed on this attempt.</p></div>`}
      </div>`;
    }).join('');
    root.innerHTML = `
      <div class="log-head">
        <div class="page-head" style="margin:0"><p class="eyebrow">Output</p><h2>Rejection log</h2>
          <p class="lead" style="margin-top:8px">What failed, why, and what the generator changed on retry. Topic: <b>${esc(r.topic)}</b></p></div>
        <div class="log-actions">
          <button class="btn ghost" type="button" data-action="export-log-md">Export Markdown</button>
          <button class="btn ghost" type="button" data-action="export-log-json">Export JSON</button>
        </div>
      </div>
      <div class="tiles">
        <div class="card tile"><b>${r.attempts.length}</b><small>Attempts used (max ${r.maxAttempts})</small></div>
        <div class="card tile"><b>${rejected}</b><small>Drafts rejected</small></div>
        <div class="card tile"><b>${log.length}</b><small>Failed checks logged</small></div>
        <div class="card tile"><b>${fixed}</b><small>Fixed by retry</small></div>
      </div>
      ${groups}
      ${r.phase === 'ended' ? `<div class="card banner ${r.status === 'shipped' ? 'pass' : 'fail'}" style="margin-top:6px"><span class="b-ico">${r.status === 'shipped' ? '🚀' : '🛑'}</span><div><h3>${r.status === 'shipped' ? `Shipped on attempt ${r.attempts.length}` : 'Held for human review'}</h3><p>${r.status === 'shipped' ? 'Every check passed, so the lesson was released.' : 'The retry limit was reached, so the lesson was not shipped automatically.'}</p></div></div>` : ''}`;
  }

  function logAsMarkdown() {
    const r = state.run; const log = LL.buildRejectionLog(r.attempts);
    const lines = [`# Rejection log: ${r.topic}`, '', `Status: **${r.status}** · attempts: ${r.attempts.length}/${r.maxAttempts}`, ''];
    r.attempts.filter(a => a.status === 'done').forEach(a => {
      lines.push(`## Attempt ${a.n}: ${a.passed ? 'PASSED' : `REJECTED (${a.score}/${a.total})`}`, '');
      const items = log.filter(l => l.attempt === a.n);
      if (!items.length) lines.push('No failed checks.', '');
      items.forEach(l => {
        lines.push(`- **${l.id} ${l.title}**`, `  - Why: ${l.reason}`);
        if (l.evidence) lines.push(`  - Quote: "${l.evidence}"`);
        lines.push(`  - Change on retry: ${l.change} _(${l.resolution})_`);
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ================= evaluator lab ================= */
  function initLab() {
    $('#inject-select').innerHTML = LL.INJECTIONS.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join('');
    $('#lab-text').value = state.lab.text;
  }
  function renderLab() {
    updateLabMeta();
    const res = $('#lab-results');
    if (!state.lab.results) {
      res.innerHTML = `<div class="empty"><span class="em-ico">🧪</span><b>Evaluator results appear here</b><span>Pick an error, press <b>Inject error</b>, and watch the judge reject the lesson.</span>
        <button class="btn primary" type="button" data-action="lab-run" style="margin-top:8px">Run evaluator on current text</button></div>`;
      return;
    }
    const rs = state.lab.results;
    const failed = rs.filter(x => !x.pass);
    const inj = state.lab.injected;
    const caught = inj ? failed.some(f => f.id === inj.expects) : null;
    res.innerHTML = `
      <div class="banner ${failed.length ? 'fail' : 'pass'}" id="lab-banner">
        <span class="b-ico">${failed.length ? '🛑' : '✅'}</span>
        <div><h3>${failed.length ? `REJECTED · ${failed.length} of ${TOTAL} checks failed` : `PASS · all ${TOTAL} checks passed`}</h3>
        <p>${failed.length ? 'This lesson would not ship. The reasons would be sent back to the generator.' : 'This lesson clears the bar and can ship.'}</p></div>
      </div>
      ${inj ? `<div class="change-row" style="margin:-4px 0 16px"><b style="min-width:0">Injected:</b><span>${esc(inj.label)}</span><span class="chip ${caught ? 'pass' : 'fail'}">${caught ? `✓ caught by ${esc(inj.expects)}` : `✕ ${esc(inj.expects)} missed it`}</span></div>` : ''}
      ${groupedChecks(rs, { locate: true })}`;
    const b = $('#lab-banner'); if (failed.length) { b.classList.add('flash'); }
  }
  function updateLabMeta() {
    const t = $('#lab-text').value; const s = LL.lessonStats(t);
    $('#lab-meta').textContent = `${s.words} words · ${s.avgSentence.toFixed(1)} words/sentence · longest ${s.longest}`;
  }
  function runLab(injected) {
    state.lab.text = $('#lab-text').value;
    state.lab.results = LL.evaluate(state.lab.text);
    state.lab.injected = injected || null;
    renderLab();
  }
  function locateEvidence(id) {
    const r = (state.lab.results || []).find(x => x.id === id);
    const ta = $('#lab-text');
    if (!r || !r.evidence) return;
    const raw = ta.value; const map = []; let plain = '';
    for (let i = 0; i < raw.length; i++) { const ch = raw[i]; if (ch === '*' || ch === '`') continue; map.push(i); plain += ch; }
    const idx = plain.indexOf(r.evidence.slice(0, 60));
    if (idx === -1) { toast('Could not locate', 'The text was edited after the last run. Run the evaluator again.'); return; }
    const start = map[idx];
    const end = map[Math.min(idx + r.evidence.length - 1, map.length - 1)] + 1;
    ta.focus(); ta.setSelectionRange(start, end);
    const line = raw.slice(0, start).split('\n').length;
    ta.scrollTop = Math.max(0, (line - 4) * 21.7);
    ta.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ================= rubric view ================= */
  function renderRubric() {
    const cards = LL.DIMENSIONS.map(d => {
      const cs = LL.CHECKS.filter(c => c.dim === d.id);
      return `<article class="card dim-card">
        <header><span class="dim-ico">${d.icon}</span><div><h3>${esc(d.name)}</h3><p>${esc(d.why)}</p></div></header>
        <div>${cs.map(c => `<div class="rubric-check">
          <div class="rc-top"><span class="check-id">${c.id}</span><b>${esc(c.title)}</b><span class="rc-method">${esc(c.method)}</span></div>
          <p><b>Pass when</b>${esc(c.pass)}</p></div>`).join('')}</div>
      </article>`;
    }).join('');
    $('#rubric-root').innerHTML = cards + `
      <article class="card policy">
        <div><b>${TOTAL} / ${TOTAL}</b><small>needed to ship</small></div>
        <div><b>0</b><small>partial credit</small></div>
        <div><b>≤ 2</b><small>retries, so the loop always ends</small></div>
        <div style="flex:1;min-width:240px"><small>Any failed check rejects the draft and its reason is sent back to the generator. If the retry cap is reached, the lesson is held for a human, never shipped by default.</small></div>
      </article>`;
  }

  /* ================= memory view ================= */
  /* Suggestions only: the system never rewrites its own rubric. A human decides. */
  function rubricSuggestions(m) {
    const runs = m.runs.length;
    const out = [];
    m.rules.forEach(r => {
      const n = m.failures[r.checkId] || 0;
      if (n > r.afterFailures) {
        const c = LL.checkById[r.checkId];
        out.push({ tone: 'fail', id: r.checkId, text: `The learned rule is not working: "${c.title}" kept failing after the rule was added (${n} failures, ${r.afterFailures} when it was learned). Rewrite the rule, add a good/bad example to the prompt, or make the check clearer.` });
      }
    });
    if (runs >= 5) {
      LL.CHECKS.filter(c => !(m.failures[c.id] || 0)).forEach(c => {
        out.push({ tone: 'warn', id: c.id, text: `"${c.title}" has never failed in ${runs} runs. It may be too easy. Consider tightening it (for example a lower sentence-length limit) so it still catches weak drafts.` });
      });
    }
    return out.slice(0, 6);
  }

  function renderMemory() {
    const m = LL.memory.get();
    const suggestions = rubricSuggestions(m);
    const max = Math.max(1, ...Object.values(m.failures));
    const ruleSet = new Set(m.rules.map(r => r.checkId));
    const bars = Object.entries(m.failures).sort((a, b) => b[1] - a[1]);
    $('#memory-root').innerHTML = `
      <div class="page-head"><p class="eyebrow">Self-evolving</p><h2>Memory</h2>
        <p class="lead">Failures are counted across runs. When a check keeps failing, a rule is <b>promoted</b> into the generator prompt, so the next run starts from a better first draft. Stored in this browser.</p></div>
      <div class="mem-grid">
        <section class="card">
          <div class="card-h"><h3>Learned rules</h3><span class="badge ${m.rules.length ? 'pass' : 'neutral'}">${m.rules.length} active</span></div>
          <p class="card-sub">Added to every generator prompt (when “Use memory” is on).</p>
          ${m.rules.length ? m.rules.map(r => `<div class="rule"><span class="check-id">${esc(r.checkId)}</span><p>${esc(r.text)}<small>Promoted after ${r.afterFailures} failures · ${fmtDate(r.learnedAt)}</small></p><button class="x-btn" type="button" data-action="remove-rule" data-id="${esc(r.checkId)}" aria-label="Forget rule ${esc(r.checkId)}">×</button></div>`).join('')
            : `<div class="empty"><span class="em-ico">🌱</span><b>No rules yet</b><span>Run the pipeline ${m.threshold} times. Any check that fails ${m.threshold}× becomes a rule.</span></div>`}
        </section>

        <section class="card">
          <div class="card-h"><h3>Failure counts by check</h3></div>
          <p class="card-sub">Which checkpoints trip the generator most often.</p>
          ${bars.length ? `<div class="bars">${bars.map(([id, n]) => `<div class="bar-row"><span title="${esc((LL.checkById[id] || {}).title || id)}">${esc(id)}</span><div class="bar-track"><div class="bar-fill ${ruleSet.has(id) ? 'learned' : ''}" style="width:${(n / max) * 100}%"></div></div><b>${n}</b></div>`).join('')}</div>
            <div class="legend"><span><i></i>counting</span><span><i class="l"></i>promoted to a rule</span></div>`
            : `<div class="empty"><span class="em-ico">📊</span><b>No data yet</b><span>Counts appear after your first run.</span></div>`}
        </section>

        <section class="card wide">
          <div class="card-h"><h3>Rubric suggestions</h3><span class="badge neutral">you decide</span></div>
          <p class="card-sub">The system never edits its own rubric. It only points out checks that may need a human’s attention.</p>
          ${suggestions.length ? suggestions.map(s => `<div class="rule"><span class="check-id">${esc(s.id)}</span><p>${esc(s.text)}</p><span class="badge ${s.tone}">${s.tone === 'fail' ? 'Rule failing' : 'Maybe too easy'}</span></div>`).join('')
            : `<div class="empty" style="padding:18px"><span>No suggestions yet. They appear when a learned rule stops working, or after 5 runs for checks that never fail.</span></div>`}
        </section>

        <section class="card wide">
          <div class="card-h"><h3>Run history</h3><span class="muted" style="font-size:13px">${m.runs.length} run${m.runs.length === 1 ? '' : 's'}</span></div>
          ${m.runs.length ? `<div style="overflow-x:auto"><table class="table"><thead><tr><th>When</th><th>Topic</th><th>Result</th><th>Attempts</th><th>1st draft</th><th>Rules used</th></tr></thead><tbody>
            ${m.runs.slice(0, 12).map(x => `<tr><td>${fmtDate(x.ts)}</td><td>${esc(x.topic)}</td>
              <td>${x.status === 'shipped' ? '<span class="badge pass">Shipped</span>' : '<span class="badge warn">Held</span>'}</td>
              <td>${x.attempts}</td><td>${esc(x.firstAttemptScore)}</td><td>${x.rulesUsed ? `<span class="chip accent">${x.rulesUsed} rule${x.rulesUsed > 1 ? 's' : ''}</span>` : '<span class="muted">none</span>'}</td></tr>`).join('')}
            </tbody></table></div>` : `<div class="empty"><span class="em-ico">🕘</span><b>No runs yet</b></div>`}
        </section>

        <section class="card">
          <div class="card-h"><h3>Human feedback</h3></div>
          <p class="card-sub">Reviewer notes, added to the next generator prompt (👎 = fix this, 👍 = keep this).</p>
          <div class="feedback-form">
            <textarea class="input" data-fb-text placeholder="What should the next lesson do better?"></textarea>
            <div class="rate">
              <button class="btn ghost sm" type="button" data-action="rate" data-rating="up" aria-pressed="false">👍 Helpful</button>
              <button class="btn ghost sm" type="button" data-action="rate" data-rating="down" aria-pressed="false">👎 Needs work</button>
              <button class="btn primary sm" type="button" data-action="save-note" style="margin-left:auto">Save</button>
            </div>
          </div>
          <div style="margin-top:16px">${m.notes.length ? m.notes.map(n => `<div class="note"><span>${n.rating === 'down' ? '👎' : n.rating === 'up' ? '👍' : '📝'}</span><p>${esc(n.text)}<small>${fmtDate(n.ts)}</small></p><button class="x-btn" type="button" data-action="remove-note" data-ts="${n.ts}" aria-label="Delete note">×</button></div>`).join('') : '<p class="muted" style="font-size:13.5px">No feedback saved yet.</p>'}</div>
        </section>

        <section class="card">
          <div class="card-h"><h3>Controls</h3></div>
          <p class="card-sub">Tune how quickly the system learns, or reset it.</p>
          <div class="mem-tools">
            <div class="field"><span class="label" id="lbl-thr">Promote a rule after</span>
              <div class="seg" role="group" aria-labelledby="lbl-thr">${[1, 2, 3].map(n => `<button type="button" data-action="set-threshold" data-val="${n}" aria-pressed="${m.threshold === n}">${n} failure${n > 1 ? 's' : ''}</button>`).join('')}</div></div>
          </div>
          <div class="actions" style="margin-top:18px">
            <button class="btn ghost" type="button" data-action="export-memory">Export JSON</button>
            <button class="btn danger" type="button" data-action="clear-memory">Clear memory</button>
          </div>
        </section>
      </div>`;
  }

  /* ================= running state / controls ================= */
  function setRunning(on) {
    $('#run-btn').disabled = on;
    $('#run-btn-label').textContent = on ? 'Running…' : (state.run ? 'Run again' : 'Run pipeline');
    $('#stop-btn').hidden = !on;
    $('#reset-btn').hidden = on || !state.run;
    $('#topic').disabled = on; $('#use-memory').disabled = on;
    $$('#seg-retries button, #seg-speed button').forEach(b => { b.disabled = on; });
  }

  async function startRun() {
    if (state.abort) return;
    const topic = $('#topic').value.trim();
    if (!topic) { $('#topic').focus(); return; }
    if (state.settings.engine === 'demo' && !/\b(rag|retrieval)/i.test(topic)) {
      toast('Demo engine knows only RAG', 'Use “Introduction to RAG”, or connect a live backend for other topics.', 'bad');
      $('#topic').focus(); return;
    }
    if (state.view !== 'run') go('run');
    if (state.settings.engine === 'remote' && !state.settings.baseUrl) { toast('Backend URL missing', 'Open Engine settings and add your backend URL.', 'bad'); return; }

    state.abort = new AbortController();
    state.run = null; $('#attempts').innerHTML = ''; lastStepKey = ''; lastDraftKey = ''; lastActionsKey = '';
    setRunning(true);
    renderRunRegion();
    const mem = LL.memory.get();
    try {
      await LL.runPipeline({
        engine: state.settings.engine, baseUrl: state.settings.baseUrl, topic,
        maxRetries: state.retries, speed: state.speed, useMemory: $('#use-memory').checked, memory: mem,
      }, handleEvent, state.abort.signal);
      if (state.run && !['ended', 'error', 'stopped'].includes(state.run.phase)) { handleEvent({ type: 'error', message: 'The backend closed the stream before the run finished.' }); }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        if (state.run) { state.run.status = 'stopped'; state.run.phase = 'stopped'; state.run.endedAt = Date.now(); }
        toast('Run stopped');
      } else {
        const network = err instanceof TypeError && state.settings.engine === 'remote';
        const msg = network
          ? `Could not reach the backend at ${state.settings.baseUrl}. Is it running, and does it allow CORS?`
          : (err && err.message) || String(err);
        if (!state.run) reduce({ type: 'run_start', runId: 'err', topic, maxAttempts: 1 + state.retries });
        handleEvent({ type: 'error', message: msg });
        toast('Run failed', msg, 'bad');
      }
    } finally {
      state.abort = null;
      setRunning(false);
      renderRunRegion();
    }
  }

  function setSeg(groupId, val) {
    $$('#' + groupId + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === String(val))));
  }

  function refreshEnginePill() {
    const remote = state.settings.engine === 'remote';
    $('#engine-pill').dataset.engine = state.settings.engine;
    $('#engine-label').textContent = remote ? 'Live backend' : 'Demo engine';
    $('#topic-hint').textContent = remote ? '' : 'The demo engine has lesson content for “Introduction to RAG” only. Connect a live backend (top right) for other topics.';
  }

  /* ================= events ================= */
  document.addEventListener('click', async (ev) => {
    const nav = ev.target.closest('[data-nav]');
    if (nav) { ev.preventDefault(); go(nav.dataset.nav); return; }

    const sc = ev.target.closest('[data-scroll]');
    if (sc) { ev.preventDefault(); const t = document.getElementById(sc.dataset.scroll); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }

    const seg = ev.target.closest('#seg-retries button, #seg-speed button');
    if (seg && !seg.disabled) {
      const g = seg.parentElement.id;
      if (g === 'seg-retries') state.retries = +seg.dataset.val; else state.speed = seg.dataset.val;
      setSeg(g, seg.dataset.val); return;
    }

    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const mem = LL.memory;

    switch (act) {
      case 'toggle-attempt': {
        const n = +btn.dataset.n;
        const cur = state.open[n] !== undefined ? state.open[n] : n === state.run.attempts.length;
        state.open[n] = !cur; renderAttempts(); break;
      }
      case 'view-draft': state.draftAttempt = +btn.dataset.n; renderDraft(); $('#draft').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); break;
      case 'open-lesson': go('lesson'); break;
      case 'open-log': go('log'); break;
      case 'go-run': go('run'); break;
      case 'font-inc': case 'font-dec': {
        state.fontScale = Math.min(1.5, Math.max(0.85, +(state.fontScale + (act === 'font-inc' ? 0.1 : -0.1)).toFixed(2)));
        $('#lesson-root').style.setProperty('--reader-scale', state.fontScale); break;
      }
      case 'copy-rich': {
        const md = state.run.markdown;
        const html = '<meta charset="utf-8">' + LL.renderMarkdown(md, { plain: true }).html;
        let rich = false;
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([md], { type: 'text/plain' }),
            })]);
            rich = true;
          }
        } catch (e) { rich = false; }
        if (rich) { toast('Copied with formatting', 'Now paste into Google Docs or Notion.', 'ok'); break; }
        const ok = await copyText(md);
        toast(ok ? 'Copied as Markdown instead' : 'Copy failed',
          ok ? 'Formatted copy is blocked here. Notion accepts Markdown. In Google Docs, turn on Tools → Preferences → “Automatically detect Markdown”.' : '', ok ? '' : 'bad');
        break;
      }
      case 'copy-lesson': toast((await copyText(state.run.markdown)) ? 'Copied' : 'Copy failed', 'Lesson Markdown', 'ok'); break;
      case 'download-lesson': download(slug(state.run.topic) + '.md', state.run.markdown, 'text/markdown'); break;
      case 'print-lesson': window.print(); break;
      case 'export-log-md': download('rejection-log-' + slug(state.run.topic) + '.md', logAsMarkdown(), 'text/markdown'); break;
      case 'export-log-json': {
        const r = state.run;
        download('rejection-log-' + slug(r.topic) + '.json', JSON.stringify({
          topic: r.topic, status: r.status, attempts: r.attempts.map(a => ({ attempt: a.n, passed: a.passed, score: `${a.score}/${a.total}`, failed: a.failed })),
          rejections: LL.buildRejectionLog(r.attempts),
        }, null, 2), 'application/json'); break;
      }
      case 'lab-run': runLab(null); break;
      case 'locate': locateEvidence(btn.dataset.id); break;
      case 'remove-rule': mem.removeRule(btn.dataset.id); renderMemory(); updateBadges(); break;
      case 'remove-note': mem.removeNote(+btn.dataset.ts); renderMemory(); break;
      case 'set-threshold': mem.setThreshold(+btn.dataset.val); renderMemory(); toast('Saved', `Rules are promoted after ${btn.dataset.val} failure${btn.dataset.val > 1 ? 's' : ''}.`, 'ok'); break;
      case 'export-memory': download('lessonloop-memory.json', mem.exportJSON(), 'application/json'); break;
      case 'clear-memory':
        if (confirm('Clear all learned rules, failure counts, history and notes?')) { mem.clear(); renderMemory(); updateBadges(); toast('Memory cleared'); }
        break;
      case 'rate': {
        const wrap = btn.closest('.rate');
        $$('[data-action="rate"]', wrap).forEach(b => b.setAttribute('aria-pressed', String(b === btn && b.getAttribute('aria-pressed') !== 'true')));
        $$('[data-action="rate"]', wrap).forEach(b => { b.classList.toggle('primary', b.getAttribute('aria-pressed') === 'true'); b.classList.toggle('ghost', b.getAttribute('aria-pressed') !== 'true'); });
        break;
      }
      case 'save-note': {
        const form = btn.closest('.feedback-form');
        const ta = $('[data-fb-text]', form); const text = ta.value.trim();
        const pressed = $('[data-action="rate"][aria-pressed="true"]', form);
        if (!text) { ta.focus(); toast('Write a short note first'); break; }
        mem.addNote(text, pressed ? pressed.dataset.rating : null);
        ta.value = ''; toast('Feedback saved', 'It will be added to the next generator prompt.', 'ok');
        if (state.view === 'memory') renderMemory();
        break;
      }
    }
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'draft-select') { state.draftAttempt = +ev.target.value; lastDraftKey = ''; renderDraft(); }
  });
  document.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (d && d.matches && d.matches('details.prompt')) state.openPrompt[d.dataset.n] = d.open;
  }, true);

  $('#run-form').addEventListener('submit', (ev) => { ev.preventDefault(); startRun(); });
  $('#stop-btn').addEventListener('click', () => { if (state.abort) state.abort.abort(); });
  $('#reset-btn').addEventListener('click', () => {
    forgetLastRun();
    state.run = null; $('#attempts').innerHTML = ''; lastStepKey = ''; lastDraftKey = ''; lastActionsKey = '';
    renderRunRegion(); setRunning(false);
  });
  document.addEventListener('keydown', (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
      if (state.view === 'run') { ev.preventDefault(); startRun(); }
      else if (state.view === 'lab') { ev.preventDefault(); runLab(null); }
    }
  });

  /* lab */
  $('#inject-btn').addEventListener('click', () => {
    const inj = LL.INJECTIONS[+$('#inject-select').value];
    const ta = $('#lab-text');
    const before = ta.value;
    ta.value = inj.apply(before);
    runLab(inj);
    if (ta.value === before) toast('Nothing changed', 'That error is already present or could not be applied.');
  });
  $('#lab-reset').addEventListener('click', () => {
    $('#lab-text').value = LL.composeLesson('', {});
    state.lab.results = null; state.lab.injected = null; renderLab();
  });
  $('#lab-run').addEventListener('click', () => runLab(null));
  $('#lab-text').addEventListener('input', () => { updateLabMeta(); });

  /* theme */
  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('lessonloop.theme', next); } catch (e) { /* ignore */ }
  });

  /* settings dialog */
  const dlg = $('#settings');
  $('#engine-pill').addEventListener('click', () => {
    $$('input[name="engine"]', dlg).forEach(i => { i.checked = i.value === state.settings.engine; });
    $('#backend-url').value = state.settings.baseUrl;
    $('#backend-status').textContent = ''; $('#backend-status').className = 'hint';
    syncBackendField();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  });
  function syncBackendField() {
    const remote = $('input[name="engine"]:checked', dlg).value === 'remote';
    $('#backend-field').style.opacity = remote ? 1 : .5;
    $('#backend-url').disabled = !remote; $('#test-backend').disabled = !remote;
  }
  $$('input[name="engine"]', dlg).forEach(i => i.addEventListener('change', syncBackendField));
  $('#test-backend').addEventListener('click', async () => {
    const st = $('#backend-status'); st.className = 'hint'; st.textContent = 'Testing…';
    try { await LL.testBackend($('#backend-url').value); st.textContent = '✓ Backend reachable'; st.className = 'hint ok'; }
    catch (e) { st.textContent = '✕ Could not reach it (' + e.message + '). Check the URL and CORS.'; st.className = 'hint bad'; }
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'save') {
      state.settings.engine = $('input[name="engine"]:checked', dlg).value;
      state.settings.baseUrl = $('#backend-url').value.trim();
      saveSettings(); refreshEnginePill();
      toast('Engine saved', state.settings.engine === 'remote' ? 'Using your live backend.' : 'Using the in-browser demo engine.', 'ok');
    }
    dlg.returnValue = '';
  });

  /* ================= init ================= */
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (VIEWS.includes(h) && h !== state.view) go(h, { push: false });
  });

  function init() {
    initScoreboard();
    initLab();
    renderRubric();
    refreshEnginePill();
    setSeg('seg-retries', state.retries); setSeg('seg-speed', state.speed);
    const restored = restoreLastRun();
    setRunning(false);
    renderRunRegion();
    if (restored) setTimeout(() => toast('Last run restored', 'Loaded from this browser. Press “Clear run” to start fresh.'), 300);

    const q = new URLSearchParams(location.search);
    if (['slow', 'fast'].includes(q.get('speed'))) { state.speed = q.get('speed'); setSeg('seg-speed', state.speed); }
    if (q.get('retries')) { state.retries = q.get('retries') === '1' ? 1 : 2; setSeg('seg-retries', state.retries); }
    if (q.get('memory') === 'off') $('#use-memory').checked = false;

    const hash = location.hash.replace('#', '');
    go(VIEWS.includes(hash) ? hash : 'run', { push: false, scroll: false });

    if (q.get('inject')) {
      const i = LL.INJECTIONS.findIndex(x => x.id === q.get('inject'));
      if (i > -1) { go('lab', { scroll: false }); $('#inject-select').value = String(i); $('#inject-btn').click(); }
    }
    if (q.get('autorun')) setTimeout(() => startRun(), 150);
  }

  init();

})(window.LL);
