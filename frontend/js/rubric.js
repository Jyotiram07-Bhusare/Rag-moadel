/* ------------------------------------------------------------------
   rubric.js — the rubric: 6 dimensions, 14 hard pass/fail checkpoints.
   No partial credit. Every check is either PASS or FAIL.
   `rule` = the one-line learned-rule text that gets promoted into the
   generator prompt when this check fails repeatedly (self-evolving).
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  LL.DIMENSIONS = [
    {
      id: 'acc', name: 'Accurate & grounded', icon: '🎯',
      why: 'A wrong fact taught to a beginner is worse than no lesson. They have no way to catch it.',
    },
    {
      id: 'lang', name: 'Beginner-friendly language', icon: '🗣️',
      why: 'The learner is a 12th-pass student from a non-English-medium background. Short sentences and simple words are a must.',
    },
    {
      id: 'ex', name: 'Teaches by example', icon: '💡',
      why: 'Abstract ideas stick only when tied to something the learner already knows.',
    },
    {
      id: 'jar', name: 'No unexplained jargon', icon: '🔤',
      why: 'One undefined word can make the learner stop reading. Every new term must be explained where it first appears.',
    },
    {
      id: 'cov', name: 'Covers the key points', icon: '🧩',
      why: 'The brief is explicit: what it is, why it matters, how it works.',
    },
    {
      id: 'flow', name: 'Coherent teaching flow', icon: '🧭',
      why: 'Order matters. Learners should never need to jump ahead to understand the current section.',
    },
  ];

  LL.CHECKS = [
    {
      id: 'ACC-1', dim: 'acc', method: 'Rule + LLM judge',
      title: 'Core definition is correct',
      pass: 'States that RAG = retrieve outside information, then generate an answer with it.',
      rule: 'Define RAG as: find useful information first, add it to the question, then write the answer.',
      fix: 'Rewrote the definition so it names both halves: retrieval and generation.',
    },
    {
      id: 'ACC-2', dim: 'acc', method: 'Rule + LLM judge',
      title: 'No false or over-claimed statements',
      pass: 'No claim that RAG retrains the model, removes all errors, or guarantees correct answers; no wrong dates.',
      rule: 'Never say RAG retrains or changes the model. Say the model stays the same and only gets extra context. Never promise zero mistakes.',
      fix: 'Removed the false "retraining" / "no more mistakes" claims and replaced them with accurate wording.',
    },
    {
      id: 'ACC-3', dim: 'acc', method: 'Rule',
      title: 'Grounded: cites a real source',
      pass: 'Has a "Sources" section with at least one real, dated reference.',
      rule: 'Always end with a "Sources" section citing Lewis et al. (2020), the original RAG paper.',
      fix: 'Added a Sources section that cites the original 2020 RAG paper.',
    },
    {
      id: 'LANG-1', dim: 'lang', method: 'Rule',
      title: 'Short sentences',
      pass: 'Average sentence length is 16 words or fewer, and no sentence is longer than 30 words.',
      rule: 'Keep sentences under 16 words on average. One idea per sentence. Never write a sentence over 30 words.',
      fix: 'Split the very long sentences into short ones with one idea each.',
    },
    {
      id: 'LANG-2', dim: 'lang', method: 'Rule',
      title: 'Plain words, no idioms',
      pass: 'No idioms or fancy words (e.g. "piece of cake", "game-changer", "leverage", "seamlessly").',
      rule: 'Avoid idioms and fancy words such as "piece of cake", "under the hood", "game-changer". Use words a school student already knows.',
      fix: 'Replaced the idioms and fancy words with plain, literal wording.',
    },
    {
      id: 'EX-1', dim: 'ex', method: 'Rule + LLM judge',
      title: 'Everyday analogy',
      pass: 'Uses a familiar analogy from the learner\'s own world (e.g. an open-book exam).',
      rule: 'Open with an everyday analogy from student life, such as an open-book exam.',
      fix: 'Added the open-book exam analogy near the start.',
    },
    {
      id: 'EX-2', dim: 'ex', method: 'Rule + LLM judge',
      title: 'Worked end-to-end example',
      pass: 'Has an example section with a real question and at least 3 numbered steps.',
      rule: 'Include a worked example: one real question followed by numbered steps (Step 1, 2, 3...).',
      fix: 'Replaced the vague example with a real question and four numbered steps.',
    },
    {
      id: 'JAR-1', dim: 'jar', method: 'Rule + LLM judge',
      title: 'Every technical term defined at first use',
      pass: 'LLM, hallucination, knowledge base, chunk, embedding, vector, prompt: each is bold or defined where it first appears.',
      rule: 'Bold every new technical word the first time it appears and explain it in one short sentence right there.',
      fix: 'Bolded each new term at first use and added a one-line plain definition.',
    },
    {
      id: 'JAR-2', dim: 'jar', method: 'Rule',
      title: 'Acronyms expanded on first use',
      pass: 'RAG, LLM and AI are written in full next to the acronym the first time they appear.',
      rule: 'Write full forms on first use: Retrieval-Augmented Generation (RAG), Large Language Model (LLM), Artificial Intelligence (AI).',
      fix: 'Wrote the full form beside each acronym at its first use.',
    },
    {
      id: 'COV-1', dim: 'cov', method: 'Rule',
      title: 'Covers: what it is',
      pass: 'Has a "What is…" section of at least 30 words that defines the topic.',
      rule: 'Include a "What is RAG?" section that defines the term word by word.',
      fix: 'Added a "What is RAG?" section.',
    },
    {
      id: 'COV-2', dim: 'cov', method: 'Rule',
      title: 'Covers: why it matters',
      pass: 'Has a "Why…" section naming at least 2 of: made-up answers, old knowledge, no private data.',
      rule: 'Include a "Why does RAG matter?" section with at least two real problems it solves.',
      fix: 'Added a "Why does RAG matter?" section.',
    },
    {
      id: 'COV-3', dim: 'cov', method: 'Rule',
      title: 'Covers: how it works',
      pass: 'Has a "How…" section that shows retrieve → augment → generate.',
      rule: 'Include a "How does RAG work?" section with the three steps: retrieve, augment, generate.',
      fix: 'Added a "How does RAG work?" section with three steps.',
    },
    {
      id: 'FLOW-1', dim: 'flow', method: 'Rule',
      title: 'Logical order',
      pass: 'What → Why → How → Example, in that order. A recap, if present, comes last.',
      rule: 'Keep the order: story, what, why, how, example, recap.',
      fix: 'Re-ordered the sections into the standard teaching order.',
    },
    {
      id: 'FLOW-2', dim: 'flow', method: 'Rule',
      title: 'Recap + self-check',
      pass: 'Ends with a Recap and a "Check yourself" list of at least 2 questions.',
      rule: 'End with a Recap and 3 "Check yourself" questions so the learner can test themselves.',
      fix: 'Added a Recap and three "Check yourself" questions.',
    },
  ];

  LL.checkById = Object.fromEntries(LL.CHECKS.map(c => [c.id, c]));
  LL.dimById = Object.fromEntries(LL.DIMENSIONS.map(d => [d.id, d]));

  /* The prompt the generator receives. Learned rules + human notes are appended. */
  LL.BASE_PROMPT = [
    'ROLE: You are a teacher who writes for a 12th-pass student in India.',
    'The learner has NO background in AI and limited English vocabulary.',
    'TASK: Write a standalone beginner lesson on: "{topic}".',
    'MUST COVER: what it is, why it matters, how it works.',
    'STYLE: short sentences, simple words, one analogy, one worked example.',
  ].join('\n');

})(window.LL = window.LL || {});
