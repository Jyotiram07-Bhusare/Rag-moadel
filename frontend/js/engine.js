/* ------------------------------------------------------------------
   engine.js — the generate → evaluate → regenerate loop.

   Two interchangeable engines emit the SAME event stream, so the UI
   never knows which one is running:

     demo    runs entirely in the browser (composer + rule-based judge)
     remote  POSTs to your backend and reads Server-Sent Events

   EVENT CONTRACT  (one JSON object per event)
     run_start    { runId, topic, maxAttempts, rules:[{checkId,text}], notes:[{text}] }
     attempt_start{ attempt, prompt }
     lesson       { attempt, markdown }
     check        { attempt, check:{ id, pass, reason, evidence } }
     attempt_end  { attempt, passed, score, total, failed:[ids] }
     feedback     { attempt, feedback:[{ id, reason, evidence }] }   // fed to next attempt
     run_end      { status:'shipped'|'needs_review', attempts, markdown }
     error        { message }
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const uid = () => 'run_' + Math.random().toString(36).slice(2, 8);

  LL.buildPrompt = function (topic, rules, notes, feedback) {
    const parts = [LL.BASE_PROMPT.replace('{topic}', () => topic)];
    if (rules && rules.length) {
      parts.push('\nLEARNED RULES (from past failures, always follow):');
      rules.forEach(r => parts.push(`- [${r.checkId}] ${r.text}`));
    }
    if (notes && notes.length) {
      parts.push('\nHUMAN NOTES (from reviewers):');
      notes.slice(0, 3).forEach(n => parts.push(`- ${n.rating === 'up' ? 'KEEP' : n.rating === 'down' ? 'FIX' : 'NOTE'}: ${n.text}`));
    }
    if (feedback && feedback.length) {
      parts.push('\nYOUR LAST DRAFT WAS REJECTED. FIX EXACTLY THESE, KEEP THE REST:');
      feedback.forEach(f => {
        parts.push(`✕ ${f.id}: ${f.reason}`);
        if (f.evidence) parts.push(`    quote: "${f.evidence.slice(0, 140)}"`);
      });
    }
    return parts.join('\n');
  };

  /* ---------------- DEMO ENGINE ---------------- */
  function makeSleep(signal, factor) {
    return (ms) => new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const t = setTimeout(resolve, ms * factor);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });
  }

  async function demoRun(opts, emit, signal) {
    const factor = { fast: 0.2, normal: 1, slow: 2 }[opts.speed] || 1;
    const sleep = makeSleep(signal, factor);
    const maxAttempts = 1 + opts.maxRetries;
    const rules = opts.useMemory ? opts.memory.rules : [];
    const notes = opts.useMemory ? opts.memory.notes : [];
    const learned = new Set(rules.map(r => r.checkId));

    emit({ type: 'run_start', runId: uid(), topic: opts.topic, maxAttempts, rules, notes });
    await sleep(300);

    let feedback = [];
    const done = [];

    for (let n = 1; n <= maxAttempts; n++) {
      const wave = (LL.DEMO_WAVES[n - 1] || []).filter(id => !learned.has(id));
      const defects = {};
      wave.forEach(id => { defects[LL.DEFECT_FOR_CHECK[id]] = true; });

      emit({ type: 'attempt_start', attempt: n, prompt: LL.buildPrompt(opts.topic, rules, notes, feedback) });
      await sleep(1300);

      const md = LL.composeLesson(opts.topic, defects);
      emit({ type: 'lesson', attempt: n, markdown: md });
      await sleep(600);

      const results = LL.evaluate(md);
      for (const r of results) {
        await sleep(130);
        emit({ type: 'check', attempt: n, check: r });
      }
      const failed = results.filter(r => !r.pass);
      const passed = failed.length === 0;
      emit({ type: 'attempt_end', attempt: n, passed, score: results.length - failed.length, total: results.length, failed: failed.map(f => f.id) });
      done.push({ n, md, score: results.length - failed.length, passed });
      await sleep(500);

      if (passed) {
        emit({ type: 'run_end', status: 'shipped', attempts: n, markdown: md });
        return;
      }
      if (n === maxAttempts) {
        const best = done.reduce((a, b) => (b.score >= a.score ? b : a));
        emit({ type: 'run_end', status: 'needs_review', attempts: n, markdown: best.md });
        return;
      }
      feedback = failed.map(f => ({ id: f.id, reason: f.reason, evidence: f.evidence }));
      emit({ type: 'feedback', attempt: n, feedback });
      await sleep(1100);
    }
  }

  /* ---------------- REMOTE ENGINE (Server-Sent Events over fetch) ---------------- */
  async function remoteRun(opts, emit, signal) {
    const base = (opts.baseUrl || '').replace(/\/$/, '');
    const res = await fetch(base + '/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        topic: opts.topic,
        max_retries: opts.maxRetries,
        use_memory: opts.useMemory,
        memory: opts.useMemory ? { rules: opts.memory.rules, notes: opts.memory.notes } : null,
      }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Backend replied ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, '\n'); // some SSE servers end lines with CRLF
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const data = chunk.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
        if (data) { try { emit(JSON.parse(data)); } catch (e) { /* ignore malformed frame */ } }
      }
    }
  }

  LL.testBackend = async function (baseUrl) {
    const res = await fetch(baseUrl.replace(/\/$/, '') + '/health', { method: 'GET' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return true;
  };

  LL.runPipeline = function (opts, emit, signal) {
    return (opts.engine === 'remote' ? remoteRun : demoRun)(opts, emit, signal);
  };

  /* ---------------- rejection log (derived from attempts) ---------------- */
  LL.buildRejectionLog = function (attempts) {
    const log = [];
    attempts.forEach((a, i) => {
      if (!a.results) return;
      const next = attempts[i + 1];
      a.results.filter(r => !r.pass).forEach(r => {
        let resolution = 'unresolved', change = 'Retry limit reached. Flagged for human review.';
        if (next && next.status === 'done') {
          const still = next.results.find(x => x.id === r.id && !x.pass);
          if (still) { resolution = 'still'; change = 'Regenerated, but this check still fails.'; }
          else { resolution = 'fixed'; change = LL.checkById[r.id] ? LL.checkById[r.id].fix : 'Fixed on retry.'; }
        } else if (next) { resolution = 'pending'; change = 'Retry in progress…'; }
        log.push({
          attempt: a.n, id: r.id, title: LL.checkById[r.id] ? LL.checkById[r.id].title : r.id,
          reason: r.reason, evidence: r.evidence, resolution, change,
        });
      });
    });
    return log;
  };

})(window.LL = window.LL || {});
