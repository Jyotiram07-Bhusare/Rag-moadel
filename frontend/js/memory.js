/* ------------------------------------------------------------------
   memory.js — persistent memory (localStorage). Survives page reloads
   and runs. This is the SELF-EVOLVING + MEMORY layer of the pipeline:

     failures   how many times each rubric check has failed, across all runs
     rules      "learned rules": once a check fails `threshold` times, a rule
                is promoted and injected into every future generator prompt
     runs       history of past runs
     notes      human feedback on shipped lessons (also fed to the generator)
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const KEY = 'lessonloop.memory.v1';
  let mem = null;
  let volatile = null; // fallback if localStorage is blocked

  const blank = () => ({ v: 1, threshold: 2, failures: {}, rules: [], runs: [], notes: [] });

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
    } catch (e) { return volatile || blank(); }
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { volatile = mem; }
  }

  const M = LL.memory = {
    get() { if (!mem) mem = read(); return mem; },

    setThreshold(n) { M.get().threshold = Math.min(3, Math.max(1, +n || 2)); write(); },

    /* Called once at the end of every run. Returns the rules promoted by this run. */
    recordRun(run) {
      const m = M.get();
      let failedChecks = 0, rejections = 0;
      run.attempts.forEach(a => {
        if (a.failed.length) rejections++;
        a.failed.forEach(id => { m.failures[id] = (m.failures[id] || 0) + 1; failedChecks++; });
      });
      m.runs.unshift({
        id: run.id, ts: Date.now(), topic: run.topic, status: run.status,
        attempts: run.attempts.length, rejections, failedChecks,
        firstAttemptScore: run.attempts[0] ? `${run.attempts[0].score}/${run.attempts[0].total}` : '—',
        rulesUsed: run.rulesUsed || 0,
      });
      m.runs = m.runs.slice(0, 50);

      const promoted = [];
      Object.entries(m.failures).forEach(([id, count]) => {
        if (count >= m.threshold && !m.rules.some(r => r.checkId === id) && LL.checkById[id]) {
          const rule = { checkId: id, text: LL.checkById[id].rule, learnedAt: Date.now(), afterFailures: count };
          m.rules.push(rule);
          promoted.push(rule);
        }
      });
      write();
      return promoted;
    },

    removeRule(checkId) { const m = M.get(); m.rules = m.rules.filter(r => r.checkId !== checkId); write(); },

    addNote(text, rating) {
      const m = M.get();
      m.notes.unshift({ ts: Date.now(), text: text.trim(), rating });
      m.notes = m.notes.slice(0, 30);
      write();
    },
    removeNote(ts) { const m = M.get(); m.notes = m.notes.filter(n => n.ts !== ts); write(); },

    clear() { mem = blank(); write(); },
    exportJSON() { return JSON.stringify(M.get(), null, 2); },
  };

})(window.LL = window.LL || {});
