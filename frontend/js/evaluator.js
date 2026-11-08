/* ------------------------------------------------------------------
   evaluator.js — hard pass/fail judge (browser version).

   Each check returns { id, pass, reason, evidence }.
   No scores, no partial credit. `evidence` is an exact quote from the
   lesson (or null) so the UI can point at the problem.

   This is the deterministic "layer 1" judge. In production, the checks
   tagged "Rule + LLM judge" in the rubric also call an LLM judge (a
   *different* model than the generator, temperature 0, JSON output).
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const NEGATION = /\b(not|no|cannot|without)\b|n't/i;

  /* ---------- text helpers ---------- */
  function stripTitle(md) {
    return md.split('\n').filter(l => !/^#\s/.test(l)).join('\n');
  }
  function plain(md) {
    return stripTitle(md)
      .replace(/^#{2,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1');
  }
  function sentencesOf(md) {
    const body = stripTitle(md).split('\n')
      .filter(l => !/^#{2,6}\s/.test(l))
      .map(l => l.replace(/^>\s?/, '').replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
                 .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').trim())
      .filter(Boolean);
    const out = [];
    body.forEach(line => line.split(/(?<=[.!?])\s+(?=[A-Z"“(])/).forEach(s => { if (s.trim()) out.push(s.trim()); }));
    return out;
  }
  const wc = s => (s.match(/[A-Za-z0-9’'-]+/g) || []).length;

  function sections(md) {
    const parts = md.split(/\n(?=## )/).filter(p => /^##\s/.test(p));
    return parts.map(p => {
      const [head, ...rest] = p.split('\n');
      return { heading: head.replace(/^##\s+/, '').trim(), body: rest.join('\n').trim() };
    });
  }
  const findSection = (secs, re) => secs.findIndex(s => re.test(s.heading));
  const snippet = (s, n = 90) => s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

  /* ---------- the 14 checks ---------- */
  const IMPL = {};

  IMPL['ACC-1'] = (md) => {
    const t = md.toLowerCase();
    const hasName = /retrieval[- ]augmented generation/.test(t);
    const hasRetrieve = /(find|finds|fetch|look(s)? up|retriev|search)/.test(t);
    const hasGenerate = /(writes?|generat)/.test(t);
    const hasExternal = /(documents|notes|files|sources|knowledge base|extra|outside|private)/.test(t);
    const missing = [];
    if (!hasName) missing.push('the full name "Retrieval-Augmented Generation"');
    if (!hasRetrieve) missing.push('the idea of finding / retrieving information');
    if (!hasGenerate) missing.push('the idea of generating / writing the answer');
    if (!hasExternal) missing.push('where the extra information comes from');
    return missing.length
      ? { pass: false, reason: 'The definition of RAG is incomplete. Missing: ' + missing.join('; ') + '.', evidence: null }
      : { pass: true, reason: 'Definition names both retrieval and generation.', evidence: null };
  };

  IMPL['ACC-2'] = (md) => {
    const sents = sentencesOf(md);
    const bad = [
      /\bre-?train\w*/i,
      /\bfine-?tun\w*/i,
      /(always|100%|completely|perfectly)\s+(correct|accurate|right|true)/i,
      /never\s+(wrong|makes?\s+(a\s+)?mistakes?|hallucinat\w*)/i,
      /(removes?|eliminates?|stops?|ends?)\s+(all|every|any)\s+(hallucinations?|mistakes?|errors?|wrong answers?)/i,
      /guarantee/i,
    ];
    for (const s of sents) {
      if (bad.some(re => re.test(s)) && !NEGATION.test(s)) {
        return { pass: false, reason: 'False or over-claimed statement: RAG does not retrain the model and does not make answers 100% correct.', evidence: s };
      }
    }
    for (const s of sents) {
      if (/(invent|introduc|creat|first (described|proposed))/i.test(s)) {
        const years = (s.match(/\b(19|20)\d\d\b/g) || []).filter(y => y !== '2020');
        if (years.length) return { pass: false, reason: 'Wrong date for when RAG was introduced (it was a 2020 paper).', evidence: s };
      }
    }
    return { pass: true, reason: 'No false or over-claimed statements found.', evidence: null };
  };

  IMPL['ACC-3'] = (md) => {
    const secs = sections(md);
    const i = findSection(secs, /^sources?$/i);
    if (i === -1) return { pass: false, reason: 'No "Sources" section. The lesson is not grounded in any reference.', evidence: null };
    const ok = /\b(19|20)\d\d\b/.test(secs[i].body) && /^\s*[-*]\s+\S/m.test(secs[i].body);
    return ok
      ? { pass: true, reason: 'Sources section cites a dated reference.', evidence: null }
      : { pass: false, reason: 'The Sources section has no dated reference.', evidence: null };
  };

  IMPL['LANG-1'] = (md) => {
    const sents = sentencesOf(md);
    const lens = sents.map(wc);
    const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length);
    let maxI = 0; lens.forEach((n, i) => { if (n > lens[maxI]) maxI = i; });
    const max = lens[maxI] || 0;
    if (avg > 16 || max > 30) {
      return {
        pass: false,
        reason: `Sentences are too long: average ${avg.toFixed(1)} words (limit 16), longest ${max} words (limit 30).`,
        evidence: sents[maxI] || null,
      };
    }
    return { pass: true, reason: `Average ${avg.toFixed(1)} words per sentence; longest ${max}.`, evidence: null };
  };

  const FANCY = [
    'piece of cake', 'under the hood', 'game-changer', 'game changer', 'out of the box', 'state-of-the-art',
    'cutting-edge', 'leverage', 'utilize', 'plethora', 'seamless', 'delve', 'paradigm', 'robust',
    'revolutioniz', 'in a nutshell', 'at the end of the day', 'ballpark', 'tip of the iceberg',
    'needle in a haystack', 'rule of thumb', 'a no-brainer', 'bells and whistles', 'hit the ground running',
  ];
  IMPL['LANG-2'] = (md) => {
    const t = plain(md);
    const lower = t.toLowerCase();
    const found = FANCY.filter(w => lower.includes(w));
    if (!found.length) return { pass: true, reason: 'No idioms or fancy words found.', evidence: null };
    const sent = sentencesOf(md).find(s => s.toLowerCase().includes(found[0]));
    return { pass: false, reason: 'Idioms / fancy words a beginner may not know: ' + found.map(f => `"${f}"`).join(', ') + '.', evidence: sent || null };
  };

  IMPL['EX-1'] = (md) => {
    const t = plain(md).toLowerCase();
    const cue = /(imagine|think of|just like|it is like|it's like|is like a|same way)/.test(t);
    const world = /(exam|library|teacher|notes|textbook|school|college|canteen|tuition|classroom)/.test(t);
    return cue && world
      ? { pass: true, reason: 'Uses an everyday analogy from student life.', evidence: null }
      : { pass: false, reason: 'No everyday analogy found. Abstract ideas need a picture from the learner\'s own world (for example an open-book exam).', evidence: null };
  };

  IMPL['EX-2'] = (md) => {
    const secs = sections(md);
    const i = findSection(secs, /example|walk-?through/i);
    if (i === -1) return { pass: false, reason: 'There is no example section.', evidence: null };
    const body = secs[i].body;
    const steps = (body.match(/^\s*(\d+\.|step\s*\d)/gim) || []).length;
    const hasQ = /\?/.test(body);
    if (steps >= 3 && hasQ) return { pass: true, reason: `Worked example has a real question and ${steps} numbered steps.`, evidence: null };
    const why = [];
    if (!hasQ) why.push('no real question is asked');
    if (steps < 3) why.push(`only ${steps} numbered step${steps === 1 ? '' : 's'} (need 3 or more)`);
    return { pass: false, reason: 'The example is too vague: ' + why.join(' and ') + '.', evidence: snippet(body.split('\n').find(Boolean) || '', 120) };
  };

  const TERMS = [
    ['LLM', /\b(LLMs?|large language models?)\b/i],
    ['hallucination', /\bhallucinat\w*/i],
    ['knowledge base', /\bknowledge bases?\b/i],
    ['chunk', /\bchunk\w*/i],
    ['embedding', /\bembedding\w*/i],
    ['vector', /\bvector\w*/i],
    ['prompt', /\bprompt\w*/i],
  ];
  const DEF_CUE = /\b(means|is a|is an|is the|are called|is called|called|stands for|refers to|known as)\b|—|\(/i;

  IMPL['JAR-1'] = (md) => {
    const raw = stripTitle(md);
    const boldSpans = [];
    raw.replace(/\*\*(.+?)\*\*/g, (m, _g, off) => { boldSpans.push([off, off + m.length]); return m; });
    const undefinedTerms = [];
    let evidence = null;
    for (const [name, re] of TERMS) {
      const m = re.exec(raw);
      if (!m) continue;
      const idx = m.index;
      const inBold = boldSpans.some(([a, b]) => idx >= a && idx < b);
      if (inBold) continue;
      const sentence = sentencesOf(raw).find(s => re.test(s)) || '';
      if (DEF_CUE.test(sentence)) continue;
      undefinedTerms.push(name);
      if (!evidence) evidence = sentence;
    }
    return undefinedTerms.length
      ? { pass: false, reason: 'Technical terms used without a definition at first use: ' + undefinedTerms.join(', ') + '.', evidence }
      : { pass: true, reason: 'Every technical term is bold or defined where it first appears.', evidence: null };
  };

  const ACRONYMS = [
    ['RAG', /retrieval[- ]augmented generation/i],
    ['LLM', /large language model/i],
    ['AI', /artificial intelligence/i],
  ];
  IMPL['JAR-2'] = (md) => {
    const t = plain(md);
    const bad = [];
    let evidence = null;
    for (const [ac, expRe] of ACRONYMS) {
      const m = new RegExp('\\b' + ac + '\\b').exec(t);
      if (!m) continue;
      const e = expRe.exec(t);
      const ok = e && e.index <= m.index + 60;
      if (!ok) {
        bad.push(ac);
        if (!evidence) evidence = sentencesOf(md).find(s => new RegExp('\\b' + ac + '\\b').test(s)) || null;
      }
    }
    return bad.length
      ? { pass: false, reason: 'Acronym used before its full form is given: ' + bad.join(', ') + '.', evidence }
      : { pass: true, reason: 'All acronyms are expanded at first use.', evidence: null };
  };

  IMPL['COV-1'] = (md) => {
    const secs = sections(md);
    const i = findSection(secs, /\bwhat is\b/i);
    if (i === -1) return { pass: false, reason: 'No "What is…" section: the learner never gets a clear definition.', evidence: null };
    const ok = wc(secs[i].body) >= 30 && /(stands for|means|is a|is an)/i.test(secs[i].body);
    return ok ? { pass: true, reason: 'Has a clear "What is…" section.', evidence: null }
              : { pass: false, reason: 'The "What is…" section is too short or has no definition.', evidence: null };
  };

  IMPL['COV-2'] = (md) => {
    const secs = sections(md);
    const i = findSection(secs, /\bwhy\b/i);
    if (i === -1) return { pass: false, reason: 'No "Why…" section: the learner never learns why this matters.', evidence: null };
    const b = secs[i].body.toLowerCase();
    const hits = [
      /(hallucinat|make things up|made-up|made up)/.test(b),
      /(old|outdated|up to date|fixed date)/.test(b),
      /(private|your own|your college|company|school)/.test(b),
    ].filter(Boolean).length;
    return hits >= 2 ? { pass: true, reason: `"Why" section names ${hits} real problems.`, evidence: null }
                     : { pass: false, reason: `"Why" section names only ${hits} problem(s). Need at least 2.`, evidence: null };
  };

  IMPL['COV-3'] = (md) => {
    const secs = sections(md);
    const i = findSection(secs, /\bhow (does|do|it)\b/i);
    if (i === -1) return { pass: false, reason: 'No "How does it work?" section.', evidence: null };
    const b = secs[i].body.toLowerCase();
    const miss = [];
    if (!/(retriev|search|find)/.test(b)) miss.push('retrieve');
    if (!/(add|augment|combine|attach|paste)/.test(b)) miss.push('augment');
    if (!/(generat|write|answer)/.test(b)) miss.push('generate');
    return miss.length ? { pass: false, reason: 'The "How" section is missing the step(s): ' + miss.join(', ') + '.', evidence: null }
                       : { pass: true, reason: 'Shows retrieve → augment → generate.', evidence: null };
  };

  IMPL['FLOW-1'] = (md) => {
    const secs = sections(md);
    const iWhat = findSection(secs, /\bwhat is\b/i);
    const iWhy = findSection(secs, /\bwhy\b/i);
    const iHow = findSection(secs, /\bhow (does|do|it)\b/i);
    const iEx = findSection(secs, /example|walk-?through/i);
    const iRecap = findSection(secs, /recap|summary|takeaway/i);
    const problems = [];
    if (iWhat === -1 || iWhy === -1 || iHow === -1) problems.push('one of What / Why / How is missing');
    else if (!(iWhat < iWhy && iWhy < iHow)) problems.push('the order must be What → Why → How');
    if (iEx !== -1 && iHow !== -1 && iEx < iHow) problems.push('the example comes before "How"');
    if (iRecap !== -1 && iHow !== -1 && iRecap < iHow) problems.push('the recap comes before "How"');
    return problems.length ? { pass: false, reason: 'Teaching order is broken: ' + problems.join('; ') + '.', evidence: null }
                           : { pass: true, reason: 'Sections follow What → Why → How → Example → Recap.', evidence: null };
  };

  IMPL['FLOW-2'] = (md) => {
    const secs = sections(md);
    const iRecap = findSection(secs, /recap|summary|takeaway/i);
    const iCheck = findSection(secs, /check yourself|quiz|test yourself/i);
    const qs = iCheck === -1 ? 0 : (secs[iCheck].body.match(/\?/g) || []).length;
    const miss = [];
    if (iRecap === -1) miss.push('a Recap');
    if (iCheck === -1) miss.push('a "Check yourself" section');
    else if (qs < 2) miss.push('at least 2 questions in "Check yourself"');
    return miss.length ? { pass: false, reason: 'The lesson ends without ' + miss.join(' and ') + '. The learner cannot test themselves.', evidence: null }
                       : { pass: true, reason: `Has a recap and ${qs} self-check questions.`, evidence: null };
  };

  /* ---------- public API ---------- */
  LL.evaluate = function (md) {
    return LL.CHECKS.map(c => {
      let r;
      try { r = IMPL[c.id](md); } catch (e) { r = { pass: false, reason: 'Evaluator error: ' + e.message, evidence: null }; }
      return { id: c.id, pass: !!r.pass, reason: r.reason, evidence: r.evidence || null };
    });
  };
  LL.evaluateOne = function (md, id) {
    const r = IMPL[id](md);
    return { id, pass: !!r.pass, reason: r.reason, evidence: r.evidence || null };
  };

  LL.lessonStats = function (md) {
    const sents = sentencesOf(md);
    const lens = sents.map(wc);
    const words = lens.reduce((a, b) => a + b, 0);
    return {
      words,
      sentences: sents.length,
      avgSentence: words / Math.max(1, sents.length),
      longest: Math.max(0, ...lens),
      minutes: Math.max(1, Math.round(words / 110)), // slow reading pace for a second-language reader
    };
  };

})(window.LL = window.LL || {});
