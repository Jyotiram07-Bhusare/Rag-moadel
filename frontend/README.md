# LessonLoop: frontend

The UI for the **Self-Evaluating Lesson Content Generator** take-home.

Open it and you get a chat, like ChatGPT. Type a topic. LessonLoop writes a beginner lesson,
judges it against **14 hard pass/fail checks**, rewrites it with the reasons until it passes
(max 1–2 retries), and shows you **only the lesson that passed**, plus a rejection log.
Memory carries what it learned into the next lesson.

Plain HTML, CSS and JavaScript. No framework, no build step, no dependencies.

## Run it

```bash
# option 1: just open the file
open index.html

# option 2: any static server (recommended if you connect a backend)
python3 -m http.server 5173      # then open http://localhost:5173
```

Type **Introduction to RAG** and press Enter, or click the suggestion under the message box.
Speed controls the animation pace of a full 3-draft run (measured):
**Fast** ≈ 3 s, **Normal** ≈ 15 s, **Slow** ≈ 30 s. Change it in **Settings → General → Demo speed**.

## What you see

| Where | What it shows |
|---|---|
| **Chat** (`index.html`) | A ChatGPT-style page: chat history in the sidebar, a message box, light and dark themes, works on phones. Each answer starts with one **thinking row** (see below) and then streams in the lesson that passed. |
| **Thinking row** | While it works: a live status ("Writing the lesson…", "Checking draft 1 · rule 7 of 14", "Rewriting the lesson · draft 2 of 3"). Afterwards: "Passed all 14 checks · 3 drafts · 3s". Click it to open the **rejection log**: per draft, which checks failed, why, the offending quote, what changed on retry, and the exact instructions sent to the writer. |
| **Under the lesson** | Copy (formatted, pastes cleanly into Google Docs or Notion), 👍 / 👎 reviewer feedback (saved to memory), write it again, and a **⋯** menu: copy Markdown, download `.md`, print / PDF, export the rejection log as `.md` or `.json`. |
| **Held for human review** | If the retry cap is hit, the best draft is shown with a warning that it was **not released as final**. It is never shipped by default. |
| **＋ in the message box** | **Upload PDF or image** (a simple RAG explanation of your file; needs the Java backend) and the **LessonLoop mode**: **Careful** (up to 2 rewrites) or **Quick** (1 rewrite). Quick is the easy way to see the "held for human review" path. |
| **Sidebar** | New chat, Search chats, **Memory** and **Settings**. |
| **Settings** | **General**: theme, lesson mode, memory, engine (demo / live backend), demo speed. **Memory**: learned rules, failure counts, rubric suggestions, run history, reviewer notes, promotion threshold, export, clear. **Quality checks**: the 14 checks in 6 dimensions with their pass conditions. **Data & developer**: export or delete chats, and links to the developer dashboard. |
| **Developer dashboard** (`dashboard.html`) | The original step-by-step view: animated pipeline, **Evaluator lab** (inject a deliberate error and watch the evaluator reject it), rubric, memory, and the **How it works** architecture page. It is not linked from the chat page, only from Settings → Data & developer. |

Keyboard: **Enter** sends, **Shift+Enter** adds a new line, **Ctrl/⌘+K** searches chats,
**Ctrl/⌘+Shift+O** starts a new chat, **Ctrl/⌘+Shift+S** shows or hides the sidebar.

## Two engines, one UI

| Engine | What it does | When to use |
|---|---|---|
| **Demo engine** (default) | Runs in the browser. Drafts are pre-written, some with planted flaws. The **evaluator really reads the text** (rule-based). | Working on the UI, recording the demo, no API key needed. |
| **Live backend** | `POST /api/run` to your Python / LangGraph / n8n service and reads Server-Sent Events. | The real submission. Set the URL in **Settings → General → Engine**. |

> **Honest limits of the demo engine:** it has no LLM and writes only the lesson
> "Introduction to RAG". Anything that is not about RAG gets one line: "Please ask me about only RAG model."
> The prompt shown for each draft is what a real LLM *would* receive; in demo mode nothing
> consumes it. Learned rules make the demo's first draft cleaner, imitating what a real model would do.

## The RAG library (info, examples and YouTube videos)

In the demo chat you can also ask for ready-made RAG material in English, Hindi or Marathi. It is stored in `js/rag-kb.js`, so it works without a backend.

| Ask | You get |
|---|---|
| `RAG in Marathi`, `RAG in Hindi`, `RAG in English` | A simple explanation: full form, short info, how it works step by step, advantages, an important note |
| `Best RAG examples`, `RAG examples in Hindi` | 10 real-life examples: support bots, HR helpdesk, medical and finance assistants, chat with your own files and more |
| `RAG YouTube videos`, `hindi videos`, `english videos`, `marathi videos` | Checked YouTube links with channel, length and level (6 English, 10 Hindi, 2 Marathi) |
| A short follow-up such as `hindi` or `examples` | The same kind of answer in the other language |

The video details were checked on 2026-11-08. [`../docs/RAG-RESOURCES.md`](../docs/RAG-RESOURCES.md) has the same material as a written list.
To add a video, add one line to `VIDEOS` in `js/rag-kb.js`, then run `node docs/make-rag-resources.js` from the repo root.

## Suggested Loom walkthrough (15–20 min)

1. **Dashboard → How it works** (`dashboard.html#design`): explain the loop, the hard cap on retries, and the two-layer judge (face on camera).
2. **Chat**, speed **Slow** (`?speed=slow`): send *Introduction to RAG*. Show the live status, then open the thinking row: draft 1 rejected (6 failures), draft 2 rejected (2 new regressions), draft 3 passed. Show a quote and "what changed on retry".
3. **Evaluator lab** (Settings → Data & developer → Evaluator lab): pick *False claim: "RAG retrains the model"* → **Inject error** → REJECTED, caught by `ACC-2` → **Locate in text**.
4. **Rejection log**: from the **⋯** menu under the lesson, export it as Markdown or JSON.
5. **Memory**: start a new chat and send the topic twice more. After lesson 2 a **Memory updated** note appears and the failing checks become learned rules; lesson 3 passes on the first draft. Open Settings → Memory to show the rules, failure counts and run history.
6. Switch the header to **Quick** to show the loop terminating with "held for human review". Turn **memory off** (＋ menu) or clear it first. Otherwise the learned rules make the first draft pass.
7. **Copy** under the lesson, then paste it into your Google Doc / Notion page (headings, lists and bold come through; use **Copy as Markdown** from the **⋯** menu if you prefer raw text).

## Connect a backend

Your service needs two endpoints (CORS enabled):

```
GET  /health   -> 200
POST /api/run  body: { "topic", "max_retries", "use_memory", "memory": { "rules", "notes" } }
               response: text/event-stream, one JSON object per `data:` line
```

Events, in order (full contract is also in the dashboard's **How it works** page and in `js/engine.js`):

```
run_start     { runId, topic, maxAttempts, rules:[{checkId,text}], notes:[{text,rating}] }
attempt_start { attempt, prompt }
lesson        { attempt, markdown }
check         { attempt, check:{ id, pass, reason, evidence } }     // one per rubric check
attempt_end   { attempt, passed, score, total, failed:[ids] }
feedback      { attempt, feedback:[{ id, reason, evidence }] }      // sent to the next attempt
run_end       { status:"shipped" | "needs_review", attempts, markdown }
error         { message }
```

Check IDs must match `js/rubric.js` (`ACC-1` … `FLOW-2`). To change the rubric, edit that file
and keep the backend's check IDs in sync. In the chat, only `run_end.markdown` is shown as the answer;
the rest of the events feed the thinking row and the rejection log.

## Project layout

```
index.html          the chat page (this is what users see first)
dashboard.html      developer dashboard: pipeline view, evaluator lab, rubric, memory, architecture
css/chat.css        chat page: design tokens, light/dark theme, sidebar, thread, composer, menus, dialogs, print
css/styles.css      dashboard styles
js/rubric.js        the 14 checks, 6 dimensions, base generator prompt
js/lesson.js        demo lesson composer + the 8 deliberate-error injectors
js/evaluator.js     rule-based pass/fail judge (browser version)
js/markdown.js      small, HTML-escaping markdown renderer
js/memory.js        localStorage memory: failure counts, learned rules, history, notes
js/engine.js        demo engine + remote (SSE) engine, prompt builder, rejection log
js/chat-store.js    chat history and chat preferences (localStorage)
js/chat-ui.js       chat helpers: icons, toasts, popover menus, confirm dialog, clipboard
js/chat.js          chat page: state, run pipeline, streaming, thinking row, settings, search
js/rag-kb.js        the RAG library: info, examples and YouTube videos in English, Hindi and Marathi
js/app.js           dashboard: state, event reducer, rendering, interactions
```

## Handy URL parameters (for testing and recording)

Chat page: `?speed=slow` · `?speed=fast` · `?retries=1` · `?memory=off` · `?autorun=1` (sends *Introduction to RAG*) · `?q=your topic` (sends that topic).
These apply to that visit only and are not saved. A chat has its own link, `#/c/<id>`.

Dashboard: `dashboard.html?speed=slow` · `?retries=1` · `?memory=off` · `?autorun=1` · `?inject=falseClaim` (opens the lab with that error injected; ids: `falseClaim`, `overclaim`, `jargon`, `idioms`, `wall`, `noExample`, `noRecap`, `noSource`) · `#lab`, `#memory`, … (open a tab directly)

## Notes

- Chats, memory and settings live in this browser (`localStorage`). Use **Settings → Memory → Clear memory** to reset the self-evolving state before recording, and **Settings → Data & developer → Delete all chats** to clear the history. The chat page and the dashboard share the same memory, engine choice and theme.
- Only **finished** lessons (shipped or held for review) are counted in memory. Stopped or failed runs never are.
- "Copy" uses the async Clipboard API with formatted HTML. If a browser blocks it, the button falls back to copying Markdown and says so.
- Light and dark themes follow your system setting by default; change it in Settings → General or with the moon / sun button in the header.
- Works offline. No external fonts, scripts or network calls (except to your own backend if you enable it).
