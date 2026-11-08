/* ------------------------------------------------------------------
   lesson.js — demo lesson composer + deliberate-error injectors.

   The DEMO engine has no LLM. To still show a *real* loop, the generator
   composes the lesson from sections and, for each "defect", swaps in a
   flawed variant (like a weak first draft would have). The evaluator then
   judges the actual text, so a pass/fail is never faked.

   defect keys → the check each one should break:
     falseClaim → ACC-2     noSource  → ACC-3     longSentences → LANG-1
     idioms     → LANG-2    noExample → EX-2      noDefine      → JAR-1
     noAcronym  → JAR-2     noRecap   → FLOW-2    noAnalogy     → EX-1
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  LL.DEFECT_FOR_CHECK = {
    'ACC-2': 'falseClaim', 'ACC-3': 'noSource', 'LANG-1': 'longSentences',
    'LANG-2': 'idioms', 'EX-1': 'noAnalogy', 'EX-2': 'noExample',
    'JAR-1': 'noDefine', 'JAR-2': 'noAcronym', 'FLOW-2': 'noRecap',
  };

  /* Each "wave" is the set of problems a draft has at attempt N (demo only). */
  LL.DEMO_WAVES = [
    ['ACC-2', 'JAR-1', 'JAR-2', 'LANG-1', 'EX-2', 'FLOW-2'],   // attempt 1: weak first draft
    ['LANG-2', 'ACC-3'],                                         // attempt 2: fixed most, new regressions
    [],                                                          // attempt 3: clean
  ];

  LL.composeLesson = function (topic, d) {
    d = d || {};
    const out = [];
    const push = (s) => out.push(s);

    push('# Introduction to RAG');
    push('');
    if (d.noAcronym) {
      push('> **What you will learn:** what RAG is, why people use it, and how it works. No background needed. Reading time: about 8 minutes.');
    } else {
      push('> **What you will learn:** what **Retrieval-Augmented Generation (RAG)** is, why people use it, and how it works. No background needed. Reading time: about 8 minutes.');
    }
    push('');

    /* 1 — story / analogy */
    if (!d.noAnalogy) {
      push('## 1. Start with a story');
      push('');
      push('Imagine you have an exam tomorrow. In one exam, you must answer from memory. The other one is an **open-book exam**. You can look inside your textbook while you write.');
      push('');
      push('Which exam is easier when the question is very new? The open-book exam. You do not need to remember everything. You only need to find the right page and then write a clear answer.');
      push('');
      push(d.idioms
        ? 'Do not worry. After this lesson, RAG will be a piece of cake for you. Keep this picture in mind.'
        : 'Keep this picture in mind. RAG works in the same way.');
      push('');
    } else {
      push('## 1. Start here');
      push('');
      push('Many chatbots can answer questions today. Some of them use a method called RAG to give better answers.');
      push('');
    }

    /* 2 — what */
    push('## 2. What is RAG?');
    push('');
    if (d.noAcronym) {
      push('**RAG** stands for **Retrieval-Augmented Generation**. It sounds big, but each word is simple:');
    } else {
      push('**RAG** stands for **Retrieval-Augmented Generation**. It sounds big, but each word is simple:');
    }
    push('');
    push('- **Retrieval** means finding information.');
    push('- **Augmented** means made stronger by adding something extra.');
    push('- **Generation** means writing a new answer.');
    push('');
    if (d.noAcronym) {
      push('So RAG is a method where an AI system first finds useful information, adds it to your question, and then writes the answer.');
      push('');
      push('An LLM is a computer program that has read a huge amount of text and can write sentences like a human. ChatGPT and Gemini are examples.');
    } else {
      push('So RAG is a method where an **Artificial Intelligence (AI)** system first finds useful information, adds it to your question, and then writes the answer.');
      push('');
      push('The writer inside is a **Large Language Model (LLM)**. An LLM is a computer program that has read a huge amount of text and can write sentences like a human. ChatGPT and Gemini are examples.');
    }
    push('');

    /* 3 — why */
    push('## 3. Why does RAG matter?');
    push('');
    push('An LLM is smart, but it has three weak points.');
    push('');
    if (d.noDefine) {
      push('1. **It can make things up.** The LLM may hallucinate and write wrong facts with full confidence.');
    } else {
      push('1. **It can make things up.** When the LLM does not know an answer, it may still write something that sounds right. This mistake is called a **hallucination**.');
    }
    push('2. **Its knowledge gets old.** An LLM learns from text collected up to a fixed date. It does not know news from after that date.');
    push('3. **It does not know your private files.** It has never seen your college notes, your company rules, or your school fee list.');
    push('');
    if (d.longSentences) {
      push('RAG helps with all three of these weak points because the AI gets real, fresh and private information first and then writes the final answer only from that information, which means that there are fewer made-up answers and more correct answers that a student can trust and check later on.');
    } else {
      push('RAG helps with all three. The AI gets real, fresh and private information first. Then it writes the answer from that information. This means fewer made-up answers and more correct ones.');
    }
    push('');
    if (d.falseClaim) {
      push('RAG removes all hallucinations, so the answers are always correct.');
    } else {
      push('RAG does not remove every mistake. But it reduces them, and you can check the source.');
    }
    push('');

    /* 4 — how */
    push('## 4. How does RAG work?');
    push('');
    push(d.idioms
      ? 'Under the hood, RAG has two parts that work as a team: a **retriever** and a **generator**. The retriever finds. The generator writes. It is a real game-changer.'
      : 'RAG has two parts that work as a team: a **retriever** and a **generator**. The retriever finds. The generator writes.');
    push('');
    if (d.noDefine) {
      push('The knowledge base is split into chunks, and each chunk is converted into an embedding that is stored in a vector database. At question time, the question embedding is compared with the stored vectors, the top chunks are picked, and the prompt is built from them before the LLM writes the answer.');
    } else {
      push('First, someone prepares a **knowledge base**. A knowledge base is a collection of documents, such as PDFs, web pages, or notes. The system cuts every document into small pieces called **chunks**. A chunk is just a few lines of text.');
      push('');
      push('Next, the computer must understand the meaning of each chunk. It turns every chunk into a list of numbers called an **embedding**. Chunks with similar meaning get similar numbers. These numbers are saved in a **vector database**. A vector database is a special store that can find similar numbers very fast.');
    }
    push('');
    push('Now a user asks a question. These are the steps:');
    push('');
    push('1. **Retrieve.** The system turns the question into numbers too. It searches the database and finds the chunks closest in meaning.');
    if (d.noDefine) {
      push('2. **Augment.** The system adds those chunks to the question to make the final input.');
    } else {
      push('2. **Augment.** The system adds those chunks to the question. This bigger text is called the **prompt**. A prompt is the instruction we give to the AI.');
    }
    push('3. **Generate.** The LLM reads the prompt and writes the answer using the chunks.');
    push('');
    push(d.falseClaim
      ? 'Each time you ask a question, the system retrains the model on the new documents, so the AI permanently learns them.'
      : 'The model itself is not changed. It is not retrained. It only gets extra reading material for each question.');
    push('');

    /* 5 — worked example */
    if (d.noExample) {
      push('## 5. Example');
      push('');
      push('Imagine a chatbot that answers questions using RAG. It finds information and writes a good answer for the user.');
      push('');
    } else {
      push('## 5. A worked example: the college helpdesk');
      push('');
      push('Meet Riya. She studies at a college in Pune. The college has built a chatbot for student questions. The chatbot uses RAG. (The dates below are made up for this example.)');
      push('');
      push('The knowledge base holds the college rules, the fee list, and the exam timetable.');
      push('');
      push('Riya types: **"What is the last date to pay the exam fee?"**');
      push('');
      push('1. **Step 1: Retrieve.** The system finds two chunks. One is from the fee list. One is from the exam notice.');
      push('2. **Step 2: Augment.** It builds a prompt: "Use only the text below. Text: The last date for exam fee is 15 March. Question: What is the last date to pay the exam fee?"');
      push('3. **Step 3: Generate.** The LLM reads the prompt and replies: "The last date is 15 March."');
      push('4. **Step 4: Show the source.** The chatbot also shows the notice name, so Riya can check it herself.');
      push('');
      push('Without RAG, the LLM has never seen this college\'s fee notice. It would guess. With RAG, it reads the real notice first.');
      push('');
    }

    /* 6/7 — recap + self-check */
    if (!d.noRecap) {
      push('## 6. Recap');
      push('');
      push('- RAG means **Retrieval-Augmented Generation**: find first, then write.');
      push('- It helps with three problems: made-up answers, old knowledge, and no access to private files.');
      push('- It works in three steps: retrieve, augment, generate.');
      push('- The model is not retrained. It only gets extra context.');
      push('');
      push('## 7. Check yourself');
      push('');
      push('1. What is the difference between an open-book exam and a closed-book exam? How does this match RAG?');
      push('2. Name the three steps of RAG in the right order.');
      push('3. Why does a college chatbot need RAG to answer about this year\'s fee date?');
      push('');
    }

    if (!d.noSource) {
      push('## Sources');
      push('');
      push('- Lewis, P. et al. (2020). *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.* NeurIPS 2020.');
      push('');
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };

  /* ---------- deliberate-error injectors (used by the Evaluator Lab) ---------- */
  function insertAfterHeading(md, headingRe, text) {
    const lines = md.split('\n');
    const i = lines.findIndex(l => /^##\s/.test(l) && headingRe.test(l));
    if (i === -1) return md + '\n\n' + text + '\n';
    lines.splice(i + 1, 0, '', text);
    return lines.join('\n');
  }
  function removeSection(md, headingRe) {
    const parts = md.split(/\n(?=## )/);
    return parts.filter(p => !(/^##\s/.test(p) && headingRe.test(p.split('\n')[0]))).join('\n');
  }

  LL.INJECTIONS = [
    {
      id: 'falseClaim', label: 'False claim: "RAG retrains the model"', expects: 'ACC-2',
      apply: md => insertAfterHeading(md, /how does/i, 'In simple words, RAG retrains the AI model again every time you ask a new question.'),
    },
    {
      id: 'overclaim', label: 'Over-claim: "never makes mistakes"', expects: 'ACC-2',
      apply: md => insertAfterHeading(md, /why does/i, 'With RAG the AI never makes mistakes, and its answers are always correct.'),
    },
    {
      id: 'jargon', label: 'Jargon dump: undefined terms', expects: 'JAR-1',
      apply: md => insertAfterHeading(md, /start with|start here/i, 'First, a chunker splits files and an embedding model stores them in a vector database.'),
    },
    {
      id: 'idioms', label: 'Idioms: "piece of cake", "game-changer"', expects: 'LANG-2',
      apply: md => insertAfterHeading(md, /what is/i, 'Honestly, using RAG is a piece of cake and a real game-changer.'),
    },
    {
      id: 'wall', label: 'Wall of text: one 50-word sentence', expects: 'LANG-1',
      apply: md => insertAfterHeading(md, /why does/i, 'When a student asks a question to a chatbot that uses this method then the system first looks for the most useful pieces of information in its stored files and then it adds all of them to the question and after that the model writes the final answer for the student in one go.'),
    },
    {
      id: 'noExample', label: 'Delete the worked example', expects: 'EX-2',
      apply: md => removeSection(md, /example/i),
    },
    {
      id: 'noRecap', label: 'Delete recap + self-check', expects: 'FLOW-2',
      apply: md => removeSection(removeSection(md, /recap/i), /check yourself/i),
    },
    {
      id: 'noSource', label: 'Delete the sources', expects: 'ACC-3',
      apply: md => removeSection(md, /sources?/i),
    },
  ];

})(window.LL = window.LL || {});
