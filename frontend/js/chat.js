/* ------------------------------------------------------------------
   chat.js — the chat front page (ChatGPT-style).

   The learner types a topic. Behind the scenes the same generate →
   evaluate → regenerate loop from engine.js runs. The chat shows it as
   one collapsible "thinking" row (the rejection log lives inside it) and
   then streams in only the lesson that passed all 14 checks.

   Rendering is split by region: the sidebar, the thread, and the chrome
   (header, composer, suggestions). During a run only the one message that
   is changing is redrawn.
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const { $, $$, ico, toast, openMenu, closeMenu, confirmDialog, copyText, copyRich, download, autosize } = LL.ui;
  const store = LL.chatStore;
  const esc = LL.esc;
  const TOTAL = LL.CHECKS.length;
  const DEFAULT_TOPIC = 'Introduction to RAG';
  const THEME_KEY = 'lessonloop.theme';
  const SPEED = { fast: 0.25, normal: 1, slow: 2 };
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const MOBILE = window.matchMedia('(max-width: 900px)');
  const PHONE = window.matchMedia('(max-width: 520px)');

  /* ================= state ================= */
  const state = {
    chats: store.loadChats(),
    activeId: null,              // null = the empty "new chat" screen
    prefs: store.loadPrefs(),
    engine: store.loadEngine(),
    run: null,                   // { chatId, msgId, abort, typing } while a lesson is being written
    ui: { think: {}, prompts: {}, feedback: null, renaming: null, search: { q: '', idx: 0 } },
    pinned: true,                // keep the view glued to the newest text
    settingsTab: 'general',
  };

  /* ================= helpers ================= */
  const uid = () => Math.random().toString(36).slice(2, 10);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const shorten = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const fmtDate = ts => new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const fmtSecs = ms => { const s = Math.max(1, Math.round(ms / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; };
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
  const activeChat = () => state.chats.find(c => c.id === state.activeId) || null;
  const announce = text => { $('#sr-status').textContent = text; };

  /* Values set from the URL (?speed= ?retries= ?memory=) apply to this visit only.
     They are never written to storage unless the user changes that setting themselves. */
  const savedPrefs = Object.assign({}, state.prefs);
  const urlPrefs = new Set();
  function savePrefs() {
    const p = Object.assign({}, state.prefs);
    urlPrefs.forEach(k => { p[k] = savedPrefs[k]; });
    store.savePrefs(p);
  }
  function setPref(key, value) {
    state.prefs[key] = value;
    urlPrefs.delete(key);
    savePrefs();
  }

  function findMsg(id) {
    for (const chat of state.chats) {
      const msg = chat.messages.find(m => m.id === id);
      if (msg) return { chat, msg };
    }
    return null;
  }

  let persistTimer = 0;
  function persist(immediately) {
    clearTimeout(persistTimer);
    if (immediately) store.saveChats(state.chats);
    else persistTimer = setTimeout(() => store.saveChats(state.chats), 400);
  }

  function dayLabel(ts) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    if (ts >= start.getTime()) return 'Today';
    if (ts >= start.getTime() - 86400000) return 'Yesterday';
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function groupChats(chats) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const t0 = start.getTime(), day = 86400000;
    const groups = [['Today', []], ['Yesterday', []], ['Previous 7 days', []], ['Previous 30 days', []], ['Older', []]];
    chats.slice().sort((a, b) => b.updatedAt - a.updatedAt).forEach(c => {
      const t = c.updatedAt;
      groups[t >= t0 ? 0 : t >= t0 - day ? 1 : t >= t0 - 7 * day ? 2 : t >= t0 - 30 * day ? 3 : 4][1].push(c);
    });
    return groups.filter(g => g[1].length);
  }

  /* ================= theme ================= */
  function themePref() {
    try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'system'; }
    catch (e) { return 'system'; }
  }
  function applyTheme(pref, skipSave) {
    const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (skipSave) return;
    try { if (pref === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, pref); }
    catch (e) { /* storage blocked */ }
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref() === 'system') applyTheme('system', true);
  });

  /* ================= sidebar open / close ================= */
  function setSidebar(open, remember) {
    $('#app').setAttribute('data-sidebar', open ? 'open' : 'closed');
    const sb = $('#sidebar');
    if (open) sb.removeAttribute('inert'); else sb.setAttribute('inert', '');
    $('#sb-backdrop').hidden = !(open && MOBILE.matches);
    if (remember && !MOBILE.matches) setPref('sidebar', open);
  }
  const sidebarWanted = () => !MOBILE.matches && state.prefs.sidebar !== false;
  MOBILE.addEventListener('change', () => setSidebar(sidebarWanted(), false));

  /* ================= routing: #/c/<chat id> ================= */
  const chatIdFromHash = () => { const m = /^#\/c\/([a-z0-9]+)$/i.exec(location.hash); return m ? m[1] : null; };

  function navHash(hash) {
    if (location.hash === hash || (!hash && !location.hash)) return;
    if (!hash) { try { history.pushState(null, '', location.pathname + location.search); return; } catch (e) { /* file:// */ } }
    location.hash = hash;
  }

  function openChat(id, fromRoute) {
    state.activeId = id && state.chats.some(c => c.id === id) ? id : null;
    state.ui.feedback = null;
    if (!fromRoute) navHash(state.activeId ? '#/c/' + state.activeId : '');
    renderSidebar(); renderThread(); renderChrome();
    scrollToBottom(false);
    if (MOBILE.matches) setSidebar(false, false);
    else $('#composer-input').focus();
  }

  function route() {
    const id = chatIdFromHash();
    const target = id && state.chats.some(c => c.id === id) ? id : null;
    if (target !== state.activeId) openChat(target, true);
  }

  /* ================= sidebar ================= */
  function renderSidebar() {
    const list = $('#chat-list');
    if (!state.chats.length) { list.innerHTML = '<p class="sb-empty">Your lessons will show up here.</p>'; return; }
    list.innerHTML = groupChats(state.chats).map(([label, items]) =>
      `<div class="sb-group"><h3 class="sb-group-title">${label}</h3>${items.map(chatItem).join('')}</div>`).join('');
    const input = $('.chat-rename', list);
    if (input) { input.focus(); input.select(); }
  }

  function chatItem(c) {
    if (state.ui.renaming === c.id) {
      return `<div class="chat-item"><input class="chat-rename" data-id="${c.id}" value="${esc(c.title)}" maxlength="80" aria-label="Chat name"></div>`;
    }
    const active = c.id === state.activeId;
    const busy = state.run && state.run.chatId === c.id;
    return `<div class="chat-item${active ? ' active' : ''}">
      <a class="chat-link" href="#/c/${c.id}" data-id="${c.id}" title="${esc(c.title)}"${active ? ' aria-current="page"' : ''}>${esc(c.title)}</a>
      ${busy ? '<span class="chat-busy" title="Writing a lesson…"></span>' : ''}
      <button type="button" class="chat-more" data-action="chat-menu" data-id="${c.id}" aria-label="Options for ${esc(c.title)}" aria-haspopup="menu" aria-expanded="false">${ico('more')}</button>
    </div>`;
  }

  function commitRename(input, save) {
    const id = state.ui.renaming;
    if (!id) return;
    state.ui.renaming = null;
    const c = state.chats.find(x => x.id === id);
    const v = input.value.trim();
    if (save && c && v) { c.title = shorten(v, 80); persist(); }
    renderSidebar(); renderChrome();
  }

  async function deleteChat(id) {
    const c = state.chats.find(x => x.id === id);
    if (!c) return;
    const ok = await confirmDialog({ title: 'Delete chat?', text: `This will delete “${shorten(c.title, 60)}”.`, ok: 'Delete', danger: true });
    if (!ok) return;
    if (state.run && state.run.chatId === id) stopRun();
    state.chats = state.chats.filter(x => x.id !== id);
    persist(true);
    if (state.activeId === id) openChat(null); else renderSidebar();
    toast('Chat deleted');
  }

  async function deleteAllChats() {
    const ok = await confirmDialog({ title: 'Delete all chats?', text: 'This removes every chat from this browser. Your memory (learned rules and notes) is kept.', ok: 'Delete all', danger: true });
    if (!ok) return;
    if (state.run) stopRun();
    state.chats = [];
    persist(true);
    openChat(null);
    if ($('#settings').open) renderSettings();
    toast('All chats deleted');
  }

  /* ================= chrome: header, composer, suggestions ================= */
  function suggestions() {
    if (state.engine.engine === 'remote') {
      return [DEFAULT_TOPIC, 'How does the internet work?', 'What is an API?', 'Explain machine learning'];
    }
    return [DEFAULT_TOPIC];
  }

  function renderChrome() {
    const chat = activeChat();
    const empty = !chat || !chat.messages.length;
    $('#main').dataset.empty = String(empty);
    $('#profile-sub').textContent = state.engine.engine === 'remote' ? 'Live backend' : 'Demo mode';
    $('#chips').innerHTML = empty
      ? suggestions().map(t => `<button type="button" class="chip-btn" data-action="suggest" data-text="${esc(t)}">${ico('book')}${esc(t)}</button>`).join('')
      : '';
    $('#foot-note').textContent = state.engine.engine === 'remote'
      ? 'LessonLoop checks every lesson against 14 rules before showing it. It can still make mistakes, so check important facts.'
      : `Demo mode: only “${DEFAULT_TOPIC}” is available. The drafts are pre-written, but every check runs live.`;
    document.title = chat ? shorten(chat.title, 60) + ' · LessonLoop' : 'LessonLoop';
    $('#composer-input').placeholder = PHONE.matches ? 'Type a topic…' : 'Type a topic, e.g. Introduction to RAG'; // a long placeholder would wrap on a phone
    renderComposerState();
  }
  PHONE.addEventListener('change', renderChrome);

  function renderComposerState() {
    const ta = $('#composer-input');
    const send = $('#send-btn');
    const running = !!state.run;
    const here = running && state.run.chatId === state.activeId;
    send.dataset.mode = here ? 'stop' : 'send';
    send.type = here ? 'button' : 'submit';
    if (here) send.setAttribute('data-action', 'stop'); else send.removeAttribute('data-action');
    send.setAttribute('aria-label', here ? 'Stop generating' : 'Send message');
    send.title = here ? 'Stop' : (running ? 'Another lesson is still being written' : 'Send');
    send.innerHTML = ico(here ? 'stop' : 'arrow-up');
    send.disabled = here ? false : (running || !ta.value.trim());
  }

  /* ================= scrolling ================= */
  function scrollToBottom(smooth) {
    const s = $('#scroller');
    s.scrollTo({ top: s.scrollHeight, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
    state.pinned = true;
    $('#to-bottom').hidden = true;
  }
  function refreshToBottom() {
    const s = $('#scroller');
    const dist = s.scrollHeight - s.scrollTop - s.clientHeight;
    $('#to-bottom').hidden = dist < 240 || $('#main').dataset.empty === 'true';
    return dist;
  }
  function stickIfPinned() {
    if (state.pinned) { const s = $('#scroller'); s.scrollTop = s.scrollHeight; }
    else refreshToBottom();
  }

  /* ================= thread ================= */
  function renderThread() {
    const list = activeChat() ? activeChat().messages : [];
    $('#thread').innerHTML = list.map((m, i) => safeMsgHTML(m, i === list.length - 1, false)).join('');
    $('#main').dataset.empty = String(!list.length);
    refreshToBottom();
  }

  /* One message that cannot be drawn must never take the whole thread down with it. */
  function safeMsgHTML(m, isLast, animate) {
    try { return msgHTML(m, isLast, animate); }
    catch (e) {
      console.error(e);
      return `<article class="msg assistant" id="m-${m.id}" data-id="${m.id}" data-last="${isLast}"><div class="notice err">${ico('alert')}<div>This message could not be shown.</div></div></article>`;
    }
  }

  /* Redraws one message in place (used for every pipeline event). */
  function renderMessage(m, animate) {
    const f = findMsg(m.id);
    if (!f || f.chat.id !== state.activeId) return;
    const list = f.chat.messages;
    const host = document.createElement('div');
    host.innerHTML = safeMsgHTML(m, list[list.length - 1] === m, !!animate);
    const fresh = host.firstElementChild;
    const old = document.getElementById('m-' + m.id);
    if (old) old.replaceWith(fresh); else $('#thread').appendChild(fresh);
    const i = list.indexOf(m);
    if (i > 0) { // the message before this one is no longer the last
      const prev = document.getElementById('m-' + list[i - 1].id);
      if (prev && prev.dataset.last === 'true') prev.dataset.last = 'false';
    }
    $('#main').dataset.empty = 'false';
  }

  function msgHTML(m, isLast, animate) {
    const enter = animate ? ' enter' : '';
    if (m.role === 'user') {
      return `<article class="msg user${enter}" id="m-${m.id}" data-id="${m.id}">
        <div class="bubble">${esc(m.text)}</div>
        <div class="msg-tools"><button type="button" class="act" data-action="copy-user" data-id="${m.id}" aria-label="Copy message" title="Copy">${ico('copy')}</button></div>
      </article>`;
    }
    return `<article class="msg assistant${enter}" id="m-${m.id}" data-id="${m.id}" data-last="${isLast}" aria-label="LessonLoop">${assistantHTML(m)}</article>`;
  }

  const isWorking = m => !!(state.run && state.run.msgId === m.id && !state.run.typing && m.run && m.run.status === 'running');
  const isTyping = m => !!(state.run && state.run.msgId === m.id && state.run.typing);

  function assistantHTML(m) {
    if (m.kind === 'info') {
      return `<div class="prose">${LL.renderMarkdown(m.text, { plain: true }).html}</div>${suggestHTML(m)}`;
    }
    const r = m.run;
    if (!r) return '';
    let h = thinkHTML(m);
    if (r.status === 'shipped' || r.status === 'needs_review') {
      if (r.status === 'needs_review') h += reviewNotice(r);
      h += `<div class="prose lesson" data-prose>${proseHTML(m)}</div>`;
    } else if (r.status === 'error') {
      h += `<div class="notice err">${ico('alert')}<div><b>That didn’t work.</b> ${esc(r.error || 'Something went wrong.')}</div></div>`;
    } else if (r.status === 'stopped') {
      h += `<p class="stopped-note">${r.interrupted ? 'This lesson was interrupted when the page closed.' : 'You stopped this lesson.'}</p>`;
    }
    if (!isWorking(m) && !isTyping(m)) h += actionsHTML(m) + feedbackHTML(m) + memoryPill(m);
    return h;
  }

  function suggestHTML(m) {
    const items = (m.suggest || []).map(t => `<button type="button" class="chip-btn" data-action="suggest" data-text="${esc(t)}">${ico('book')}${esc(t)}</button>`);
    (m.buttons || []).forEach(b => items.push(`<button type="button" class="chip-btn" data-action="${esc(b.action)}" data-tab="${esc(b.tab || '')}">${ico('settings')}${esc(b.label)}</button>`));
    return items.length ? `<div class="suggest">${items.join('')}</div>` : '';
  }

  /* ---- the "thinking" row: live status while working, a one-line summary after ---- */
  function liveStatus(r) {
    const a = r.attempts[r.attempts.length - 1];
    if (!a) return 'Getting started…';
    switch (r.phase) {
      case 'generating': return a.n > 1 ? `Rewriting the lesson · draft ${a.n} of ${r.maxAttempts}` : 'Writing the lesson…';
      case 'evaluating': return `Checking draft ${a.n} · rule ${Math.min(a.results.length + 1, TOTAL)} of ${TOTAL}`;
      case 'decided': case 'retrying': return `Draft ${a.n} needs work · sending the reasons back`;
      case 'passed': return `Draft ${a.n} passed all ${TOTAL} checks`;
      default: return 'Getting started…';
    }
  }

  function finalInfo(r) {
    const n = r.attempts.length;
    const secs = r.endedAt ? fmtSecs(r.endedAt - r.startedAt) : '';
    const done = r.attempts.filter(a => a.status === 'done');
    const best = done.length ? Math.max(...done.map(a => a.score)) : 0;
    switch (r.status) {
      case 'shipped': return { tone: 'ok', icon: ico('check-circle'), label: `Passed all ${TOTAL} checks`, meta: `${plural(n, 'draft')} · ${secs}` };
      case 'needs_review': return { tone: 'warn', icon: ico('alert'), label: 'Held for human review', meta: `best draft ${best}/${TOTAL} · ${plural(n, 'draft')}` };
      case 'error': return { tone: 'bad', icon: ico('alert'), label: 'Something went wrong', meta: '' };
      default: return { tone: 'idle', icon: ico('stop'), label: r.interrupted ? 'Interrupted' : 'Stopped', meta: '' };
    }
  }

  function thinkHTML(m) {
    const r = m.run;
    const working = isWorking(m);
    const info = working ? { tone: 'run', icon: '<span class="spin"></span>', label: liveStatus(r), meta: '' } : finalInfo(r);
    const hasPanel = r.attempts.length > 0 || (r.rules && r.rules.length > 0);
    const open = hasPanel && !!state.ui.think[m.id];
    return `<div class="think" data-open="${open}" data-tone="${info.tone}">
      <button type="button" class="think-btn" data-action="toggle-think" data-id="${m.id}" aria-expanded="${open}"${hasPanel ? ` aria-controls="tp-${m.id}"` : ' disabled'}>
        <span class="think-ico">${info.icon}</span>
        <span class="think-label${working ? ' shimmer' : ''}">${esc(info.label)}</span>
        ${info.meta ? `<span class="think-meta">${esc(info.meta)}</span>` : ''}
        ${hasPanel ? ico('chevron-right', 'chev') : ''}
      </button>
      ${open ? `<div class="think-panel" id="tp-${m.id}">${panelHTML(m)}</div>` : ''}
    </div>`;
  }

  /* The panel is the rejection log: per draft, what failed, why, and what changed on retry. */
  const RESOLUTION = { fixed: ['ok', 'Fixed on retry'], still: ['warn', 'Still failing'], pending: ['', 'Retrying…'], unresolved: ['bad', 'Not fixed'] };

  function panelHTML(m) {
    const r = m.run;
    const log = LL.buildRejectionLog(r.attempts);
    let h = '';
    if (r.rules && r.rules.length) {
      h += `<div class="tl-item"><span class="tl-dot mem"></span><p class="tl-title">Using ${plural(r.rules.length, 'learned rule')} from memory</p><p class="tl-sub">${r.rules.map(x => esc(x.checkId)).join(' · ')}</p></div>`;
    }
    r.attempts.forEach((a, i) => { h += attemptHTML(m, a, r.attempts[i - 1], log); });
    const last = r.attempts[r.attempts.length - 1];
    if (r.status === 'shipped' && last) h += `<div class="tl-item"><span class="tl-dot ok"></span><p class="tl-title">Released. Draft ${last.n} passed every check.</p></div>`;
    else if (r.status === 'needs_review') h += `<div class="tl-item"><span class="tl-dot warn"></span><p class="tl-title">Not released. The retry limit was reached, so a person has to review it.</p></div>`;
    if (log.length && (r.status === 'shipped' || r.status === 'needs_review')) {
      h += `<div class="tl-export">
        <button type="button" class="btn ghost sm" data-action="log-md" data-id="${m.id}">${ico('download')}Rejection log (.md)</button>
        <button type="button" class="btn ghost sm" data-action="log-json" data-id="${m.id}">${ico('download')}Rejection log (.json)</button>
      </div>`;
    }
    return h;
  }

  function attemptHTML(m, a, prev, log) {
    let title, tone;
    if (a.status === 'generating') { title = a.n > 1 ? `Draft ${a.n}: rewriting with the reasons…` : 'Draft 1: writing…'; tone = 'run'; }
    else if (a.status === 'evaluating') { title = `Draft ${a.n}: checking rule ${Math.min(a.results.length + 1, TOTAL)} of ${TOTAL}…`; tone = 'run'; }
    else if (a.passed) { title = `Draft ${a.n}: passed all ${a.total} checks`; tone = 'ok'; }
    else { title = `Draft ${a.n}: rejected, ${a.score} of ${a.total} checks passed`; tone = 'bad'; }

    const items = log.filter(l => l.attempt === a.n);
    let body = '';
    if (items.length) body += `<ul class="fails">${items.map(failHTML).join('')}</ul>`;
    if (a.status === 'done' && prev && prev.status === 'done') body += changesHTML(a, prev);
    if (a.prompt) {
      const key = m.id + ':' + a.n;
      const open = !!state.ui.prompts[key];
      body += `<div class="prompt"><button type="button" class="link-btn" data-action="toggle-prompt" data-key="${key}" aria-expanded="${open}">${ico('chevron-right', 'chev')}Instructions sent to the writer</button>${open ? `<pre>${esc(a.prompt)}</pre>` : ''}</div>`;
    }
    return `<div class="tl-item"><span class="tl-dot ${tone}"></span><p class="tl-title">${esc(title)}</p>${body}</div>`;
  }

  function failHTML(l) {
    const [tone, label] = RESOLUTION[l.resolution] || RESOLUTION.unresolved;
    return `<li class="fail">
      <div class="fail-top"><span class="cid">${esc(l.id)}</span><span class="fail-title">${esc(l.title)}</span><span class="tag ${tone}">${label}</span></div>
      <p class="fail-why">${esc(l.reason)}</p>
      ${l.evidence ? `<blockquote class="fail-quote">“${esc(l.evidence)}”</blockquote>` : ''}
      <p class="fail-change"><b>On retry:</b> ${esc(l.change)}</p>
    </li>`;
  }

  function changesHTML(a, prev) {
    const fixed = prev.failed.filter(id => !a.failed.includes(id));
    const still = prev.failed.filter(id => a.failed.includes(id));
    const added = a.failed.filter(id => !prev.failed.includes(id));
    const chips = (ids, cls) => ids.length ? ids.map(id => `<span class="cid ${cls}">${esc(id)}</span>`).join('') : '<span class="none">none</span>';
    return `<div class="changes">
      <p><b>Fixed</b>${chips(fixed, 'ok')}</p>
      <p><b>Still failing</b>${chips(still, 'warn')}</p>
      <p><b>New regressions</b>${chips(added, 'bad')}</p>
    </div>`;
  }

  function reviewNotice(r) {
    const done = r.attempts.filter(a => a.status === 'done');
    const best = done.reduce((a, b) => (b.score >= a.score ? b : a), done[0]);
    const failing = best ? best.failed : [];
    return `<div class="notice warn">${ico('alert')}<div><b>Not released as final.</b> After ${plural(r.attempts.length - 1, 'rewrite')}, this draft still fails ${failing.length} of ${TOTAL} checks (${failing.map(id => esc(id)).join(', ')}). A person needs to review it. This is the best draft so far.</div></div>`;
  }

  /* ---- the lesson text, streamed in after it passes ---- */
  function heal(s) { // close any unfinished **bold**, *italic* or `code` so partial text never shows stray marks
    let out = s;
    if ((out.match(/\*\*/g) || []).length % 2) out += '**';
    if ((out.replace(/\*\*/g, '').match(/\*/g) || []).length % 2) out += '*';
    if ((out.match(/`/g) || []).length % 2) out += '`';
    return out;
  }
  function withCaret(html) { // put the pulsing dot at the end of the last text block
    const caret = '<span class="caret" aria-hidden="true"></span>';
    const last = /<\/(p|li|h[1-6]|blockquote)>(?![\s\S]*<\/(?:p|li|h[1-6]|blockquote)>)/;
    return last.test(html) ? html.replace(last, caret + '</$1>') : html + `<p>${caret}</p>`;
  }
  function proseHTML(m) {
    const md = m.run.markdown || '';
    if (!isTyping(m)) return LL.renderMarkdown(md, { plain: true }).html;
    const t = state.run.typing;
    const html = LL.renderMarkdown(heal(md.slice(0, t.shown)), { plain: true }).html;
    return t.shown < md.length ? withCaret(html) : html;
  }
  function paintProse(m) {
    const el = document.querySelector(`#m-${m.id} [data-prose]`);
    if (el) el.innerHTML = proseHTML(m);
  }

  function typeOut(m) {
    const full = m.run.markdown || '';
    const t = state.run.typing = { shown: 0, skip: false };
    const duration = REDUCED ? 0 : Math.min(8000, Math.max(700, full.length * 0.4 * (SPEED[state.prefs.speed] || 1)));
    renderMessage(m);
    stickIfPinned();
    return new Promise(resolve => {
      if (!duration) { t.shown = full.length; resolve(); return; }
      const t0 = performance.now();
      const frame = now => {
        if (t.skip || !state.run || state.run.typing !== t) { t.shown = full.length; resolve(); return; }
        const p = Math.min(1, (now - t0) / duration);
        let n = Math.floor(full.length * p);
        while (n < full.length && !/\s/.test(full[n])) n++; // stop on a word boundary
        t.shown = n;
        paintProse(m);
        stickIfPinned();
        if (p >= 1) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  /* ---- action row, feedback, memory pill ---- */
  function actionsHTML(m) {
    const r = m.run;
    const released = r.status === 'shipped' || r.status === 'needs_review';
    const id = m.id;
    const btn = (action, icon, label, extra) =>
      `<button type="button" class="act" data-action="${action}" data-id="${id}" aria-label="${label}" title="${label}"${extra || ''}>${ico(icon)}</button>`;
    let h = '<div class="actions">';
    if (released) {
      h += btn('copy', 'copy', 'Copy lesson');
      h += btn('rate', 'thumb-up', 'Good lesson', ` data-rating="up" aria-pressed="${m.rating === 'up'}"`);
      h += btn('rate', 'thumb-down', 'Needs work', ` data-rating="down" aria-pressed="${m.rating === 'down'}"`);
    }
    h += btn('regenerate', 'refresh', released ? 'Write it again' : 'Try again');
    if (released) {
      h += btn('msg-menu', 'more', 'More actions', ' aria-haspopup="menu" aria-expanded="false"');
      const n = LL.buildRejectionLog(r.attempts).length;
      if (n) h += `<button type="button" class="act-text" data-action="open-log" data-id="${id}" aria-expanded="${!!state.ui.think[id]}">${ico('list')}<span class="lbl">Rejection log</span><span class="tag bad">${n}</span></button>`;
    }
    return h + '</div>';
  }

  const FEEDBACK = {
    up: { title: 'What worked well?', chips: [['Clear analogy', 'Keep the everyday analogy.'], ['Good example', 'Keep the worked example style.'], ['Simple language', 'Keep the simple words and short sentences.'], ['Right length', 'Keep the same length.']] },
    down: { title: 'What went wrong?', chips: [['Language too hard', 'Use simpler words and shorter sentences.'], ['Too long', 'Make the lesson shorter. Cut what is not needed.'], ['Not accurate', 'Double-check every fact. Never over-claim.'], ['Example unclear', 'Use a simpler, clearer worked example.']] },
  };

  function feedbackHTML(m) {
    const f = state.ui.feedback;
    if (!f || f.msgId !== m.id) return '';
    const cfg = FEEDBACK[f.rating];
    return `<div class="fb" data-id="${m.id}">
      <h4>${cfg.title}</h4>
      <div class="fb-chips">${cfg.chips.map((c, i) => `<button type="button" class="fchip" data-action="fb-chip" data-i="${i}" aria-pressed="false">${esc(c[0])}</button>`).join('')}</div>
      <textarea data-fb-text rows="3" placeholder="Tell us more (optional). It is saved to memory and shapes the next lesson."></textarea>
      <div class="fb-actions"><button type="button" class="btn ghost sm" data-action="fb-cancel">Cancel</button><button type="button" class="btn primary sm" data-action="fb-submit">Submit</button></div>
    </div>`;
  }

  function memoryPill(m) {
    if (!m.memory || !m.memory.promoted.length) return '';
    return `<div><button type="button" class="pill" data-action="open-settings" data-tab="memory">${ico('sparkle')}Memory updated · learned ${plural(m.memory.promoted.length, 'rule')}</button></div>`;
  }

  /* ================= running a lesson ================= */
  function newRun(topic) {
    return { id: null, topic, maxAttempts: 1 + state.prefs.retries, status: 'running', phase: 'start', attempts: [], rules: [], startedAt: Date.now(), endedAt: null, markdown: null };
  }

  function reduceRun(r, e) {
    const a = r.attempts.find(x => x.n === e.attempt);
    switch (e.type) {
      case 'run_start':
        r.id = e.runId; r.maxAttempts = e.maxAttempts; r.rules = e.rules || []; r.phase = 'start';
        break;
      case 'attempt_start':
        r.attempts.push({ n: e.attempt, prompt: e.prompt || '', results: [], status: 'generating', passed: false, failed: [], score: 0, total: TOTAL });
        r.phase = 'generating';
        break;
      case 'lesson':
        if (a) a.status = 'evaluating';
        r.phase = 'evaluating';
        break;
      case 'check':
        if (a) a.results.push(e.check);
        break;
      case 'attempt_end':
        if (a) {
          a.status = 'done'; a.passed = !!e.passed;
          a.failed = e.failed || a.results.filter(x => !x.pass).map(x => x.id);
          a.score = e.score; a.total = e.total || TOTAL;
        }
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
  function recordMemory(m) {
    const r = m.run;
    const promoted = LL.memory.recordRun({ id: r.id || m.id, topic: r.topic, status: r.status, attempts: r.attempts, rulesUsed: r.rules.length });
    m.memory = promoted.length ? { promoted: promoted.map(p => p.checkId) } : null;
  }

  function onEvent(m, e) {
    const r = m.run;
    reduceRun(r, e);
    if (e.type === 'run_end' && (r.status === 'shipped' || r.status === 'needs_review')) recordMemory(m);
    renderMessage(m);
    stickIfPinned();
    if (e.type === 'attempt_end') announce(e.passed ? `Draft ${e.attempt} passed all ${TOTAL} checks.` : `Draft ${e.attempt} failed ${plural((e.failed || []).length, 'check')}.`);
  }

  async function runLesson(chat, topic) {
    const m = { id: uid(), role: 'assistant', ts: Date.now(), topic, run: newRun(topic) };
    chat.messages.push(m);
    const abort = new AbortController();
    state.run = { chatId: chat.id, msgId: m.id, abort, typing: null };
    renderMessage(m, true);
    renderSidebar(); renderComposerState();
    scrollToBottom(false);
    announce('Writing your lesson.');

    const r = m.run;
    try {
      await LL.runPipeline({
        engine: state.engine.engine, baseUrl: state.engine.baseUrl, topic,
        maxRetries: state.prefs.retries, speed: state.prefs.speed,
        useMemory: state.prefs.useMemory, memory: LL.memory.get(),
      }, e => onEvent(m, e), abort.signal);
      if (r.phase !== 'ended' && r.phase !== 'error') onEvent(m, { type: 'error', message: 'The backend closed the stream before the run finished.' });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        r.status = 'stopped'; r.phase = 'stopped'; r.endedAt = Date.now();
      } else {
        const network = err instanceof TypeError && state.engine.engine === 'remote';
        r.status = 'error'; r.phase = 'error'; r.endedAt = Date.now();
        r.error = network
          ? `Could not reach the backend at ${state.engine.baseUrl}. Is it running, and does it allow CORS?`
          : (err && err.message) || String(err);
      }
    }

    try {
      if (r.status === 'shipped' || r.status === 'needs_review') await typeOut(m);
    } catch (err) { /* the lesson is already complete: never leave the composer locked */ }
    finishRun(chat, m);
  }

  function finishRun(chat, m) {
    state.run = null;
    chat.updatedAt = Date.now();
    persist(true);
    renderMessage(m);
    renderSidebar();
    renderComposerState();
    stickIfPinned();
    const r = m.run;
    if (r.status === 'shipped') announce(`Your lesson is ready. It passed all ${TOTAL} checks on draft ${r.attempts.length}.`);
    else if (r.status === 'needs_review') announce('The lesson did not pass every check and is held for review.');
    else if (r.status === 'error') announce('Something went wrong while writing the lesson.');
    if (m.memory) setTimeout(() => toast(`Memory updated: learned ${plural(m.memory.promoted.length, 'rule')}`), 500);
  }

  function stopRun() {
    const run = state.run;
    if (!run) return;
    if (run.typing) run.typing.skip = true; // the lesson already passed: show it in full instead of cutting it off
    else run.abort.abort();
  }

  /* ================= sending messages ================= */
  const GREETING = /^(hi+|hello+|hey+|hola|namaste|yo|help|thanks|thank you|thx|who are you\??|what can you do\??|what is this\??)[\s!.?]*$/i;

  function quickReply(text) {
    const demo = state.engine.engine === 'demo';
    if (GREETING.test(text)) {
      return {
        text: [
          'Hi! I’m **LessonLoop**. Tell me a topic and I’ll write a short beginner lesson for a 12th-pass student.',
          'Before you see it, I check every draft against **14 pass or fail rules**: facts, simple words, examples, jargon, coverage and flow. If a draft fails, I rewrite it with the reasons until it passes.',
          demo ? `This demo only has content for **${DEFAULT_TOPIC}**. Connect a live backend in Settings to learn anything.` : 'What would you like to learn?',
        ].join('\n\n'),
        suggest: suggestions().slice(0, demo ? 1 : 3),
      };
    }
    if (demo && !/\b(rag|retrieval)/i.test(text)) {
      return {
        text: `The built-in demo only has lesson content for **${DEFAULT_TOPIC}**, so I can’t write about “${shorten(text, 80)}” yet.\n\nConnect a live backend in Settings to learn any topic. Or try the RAG lesson to watch the full write, check and rewrite loop.`,
        suggest: [DEFAULT_TOPIC],
        buttons: [{ label: 'Open settings', action: 'open-settings', tab: 'general' }],
      };
    }
    return null;
  }

  function sendMessage(text) {
    text = text.trim();
    if (!text || state.run) return;
    let chat = activeChat();
    if (!chat) {
      chat = { id: uid(), title: shorten(text, 48), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      state.chats.unshift(chat);
      state.activeId = chat.id;
      navHash('#/c/' + chat.id);
    }
    const um = { id: uid(), role: 'user', text, ts: Date.now() };
    chat.messages.push(um);
    chat.updatedAt = Date.now();
    renderMessage(um, true);
    renderSidebar(); renderChrome();
    scrollToBottom(false);

    const quick = quickReply(text);
    if (quick) {
      const am = { id: uid(), role: 'assistant', kind: 'info', ts: Date.now(), text: quick.text, suggest: quick.suggest, buttons: quick.buttons };
      chat.messages.push(am);
      renderMessage(am, true);
      stickIfPinned();
      persist(true);
      return;
    }
    persist();
    runLesson(chat, text);
  }

  function submitComposer() {
    const ta = $('#composer-input');
    const text = ta.value.trim();
    if (!text) return;
    if (state.run) { toast('Please wait until the current lesson is finished.'); return; }
    ta.value = ''; autosize(ta); renderComposerState();
    sendMessage(text);
  }

  function regenerate(id) {
    if (state.run) { toast('Please wait until the current lesson is finished.'); return; }
    const f = findMsg(id);
    if (!f || !f.msg.run) return;
    const { chat, msg } = f;
    const i = chat.messages.indexOf(msg);
    const asked = chat.messages.slice(0, i).reverse().find(x => x.role === 'user');
    chat.messages.splice(i, 1);
    if (state.ui.feedback && state.ui.feedback.msgId === id) state.ui.feedback = null;
    renderThread();
    runLesson(chat, asked ? asked.text : msg.run.topic);
  }

  /* ================= rejection log + export ================= */
  function logMarkdown(r) {
    const log = LL.buildRejectionLog(r.attempts);
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

  function exportLog(id, kind) {
    const f = findMsg(id);
    if (!f || !f.msg.run) return;
    const r = f.msg.run;
    if (kind === 'md') {
      download('rejection-log-' + slug(r.topic) + '.md', logMarkdown(r), 'text/markdown');
    } else {
      download('rejection-log-' + slug(r.topic) + '.json', JSON.stringify({
        topic: r.topic, status: r.status,
        attempts: r.attempts.map(a => ({ attempt: a.n, passed: a.passed, score: `${a.score}/${a.total}`, failed: a.failed })),
        rejections: LL.buildRejectionLog(r.attempts),
      }, null, 2), 'application/json');
    }
  }

  function printLesson(id) {
    const el = document.getElementById('m-' + id);
    if (!el) return;
    el.classList.add('print-target');
    document.body.classList.add('printing');
    window.print();
  }
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    $$('.print-target').forEach(e => e.classList.remove('print-target'));
  });

  function flash(btn) { // swap an icon for a check mark for a moment
    const html = btn.innerHTML;
    btn.innerHTML = ico('check');
    btn.classList.add('ok');
    setTimeout(() => { if (btn.isConnected) { btn.innerHTML = html; btn.classList.remove('ok'); } }, 1600);
  }

  /* ================= menus ================= */
  function setRetries(n) { setPref('retries', n); renderChrome(); refreshSettings(); }
  function setUseMemory(on) { setPref('useMemory', !!on); refreshSettings(); }
  const refreshSettings = () => { if ($('#settings').open) renderSettings(); };

  function openModelMenu(anchor) {
    const careful = state.prefs.retries !== 1;
    openMenu(anchor, [
      { header: 'Lesson mode' },
      { label: 'Careful', desc: 'Up to 2 rewrites until all 14 checks pass', checked: careful, radio: true, onSelect: () => setRetries(2) },
      { label: 'Quick', desc: 'One rewrite. Faster, but may be held for review', checked: !careful, radio: true, onSelect: () => setRetries(1) },
    ], { align: 'start', width: 330 });
  }

  function openPlusMenu(anchor) {
    const careful = state.prefs.retries !== 1;
    openMenu(anchor, [
      { label: 'Upload PDF or image', desc: 'Get a simple RAG explanation from your file', icon: 'upload', onSelect: () => $('#file-input').click() },
      { sep: true },
      { header: 'LessonLoop mode' },
      { label: 'Careful', desc: 'Up to 2 rewrites until all 14 checks pass', checked: careful, radio: true, onSelect: () => setRetries(2) },
      { label: 'Quick', desc: 'One rewrite. Faster, but may be held for review', checked: !careful, radio: true, onSelect: () => setRetries(1) },
    ], { align: 'start', placement: 'top', width: 330 });
  }

  function openProfileMenu(anchor) {
    openMenu(anchor, [
      { label: 'Settings', icon: 'settings', onSelect: () => openSettings() },
      { label: 'Memory', icon: 'sparkle', onSelect: () => openSettings('memory') },
      { sep: true },
      { label: 'Delete all chats', icon: 'trash', danger: true, disabled: !state.chats.length, onSelect: deleteAllChats },
    ], { align: 'start', placement: 'top', width: 250 });
  }

  function openMsgMenu(anchor, id) {
    const f = findMsg(id);
    if (!f || !f.msg.run) return;
    const r = f.msg.run;
    openMenu(anchor, [
      { label: 'Copy as Markdown', icon: 'copy', onSelect: async () => toast((await copyText(r.markdown)) ? 'Markdown copied' : 'Copy failed') },
      { label: 'Download .md', icon: 'download', onSelect: () => download(slug(r.topic) + '.md', r.markdown, 'text/markdown') },
      { label: 'Print or save as PDF', icon: 'printer', onSelect: () => printLesson(id) },
      { sep: true },
      { label: 'Rejection log (.md)', icon: 'list', onSelect: () => exportLog(id, 'md') },
      { label: 'Rejection log (.json)', icon: 'list', onSelect: () => exportLog(id, 'json') },
    ], { align: 'start', width: 270 });
  }

  /* ================= search ================= */
  function searchItems() {
    const q = state.ui.search.q.trim().toLowerCase();
    const hits = state.chats
      .filter(c => !q || c.title.toLowerCase().includes(q) ||
        c.messages.some(m => (((m.text || '') + ' ' + ((m.run && m.run.markdown) || '')).toLowerCase().includes(q))))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return [{ id: null, title: 'New chat' }].concat(hits.map(c => ({ id: c.id, title: c.title, date: c.updatedAt })));
  }

  function renderSearch() {
    const items = searchItems();
    state.ui.search.idx = Math.min(state.ui.search.idx, items.length - 1);
    const idx = state.ui.search.idx;
    $('#search-results').innerHTML = items.map((it, i) =>
      `<button type="button" class="sr-item" role="option" aria-selected="${i === idx}" data-action="search-pick" data-i="${i}">${ico(it.id ? 'book' : 'new')}<span>${esc(it.title)}</span>${it.date ? `<small>${dayLabel(it.date)}</small>` : ''}</button>`).join('')
      + (items.length === 1 && state.ui.search.q.trim() ? '<p class="sr-empty">No chats match your search.</p>' : '');
    const sel = $('.sr-item[aria-selected="true"]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    const dlg = $('#search');
    state.ui.search = { q: '', idx: 0 };
    $('#search-input').value = '';
    renderSearch();
    if (!dlg.open) dlg.showModal();
    $('#search-input').focus();
  }

  function pickSearch(i) {
    const it = searchItems()[i];
    if (!it) return;
    $('#search').close();
    openChat(it.id);
  }

  /* ================= settings ================= */
  const TABS = [ // `short` is the label used on a phone, where the tabs sit in one row
    { id: 'general', label: 'General', short: 'General', icon: 'sliders' },
    { id: 'memory', label: 'Memory', short: 'Memory', icon: 'sparkle' },
    { id: 'checks', label: 'Quality checks', short: 'Checks', icon: 'shield' },
    { id: 'data', label: 'Data & developer', short: 'Data', icon: 'database' },
  ];

  const row = (title, desc, control) =>
    `<div class="row"><div class="row-main"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</div><div class="row-ctl">${control}</div></div>`;
  const seg = (key, options, current) =>
    `<div class="seg" role="group">${options.map(([v, label]) => `<button type="button" data-action="set-pref" data-key="${key}" data-val="${v}" aria-pressed="${String(v) === String(current)}">${label}</button>`).join('')}</div>`;
  const sw = (action, on, label) =>
    `<button type="button" class="switch" role="switch" aria-checked="${!!on}" aria-label="${label}" data-action="${action}"><span></span></button>`;
  const emptyNote = text => `<p class="empty-note">${text}</p>`;

  function openSettings(tab) {
    if (tab && TABS.some(t => t.id === tab)) state.settingsTab = tab;
    renderSettings(true);
    const dlg = $('#settings');
    if (!dlg.open) dlg.showModal();
  }

  function renderSettings(resetScroll) {
    const pane = $('#settings-pane');
    const top = pane.scrollTop;
    $('#settings-nav').innerHTML = TABS.map(t =>
      `<button type="button" class="nav-item" data-action="set-tab" data-tab="${t.id}" aria-current="${t.id === state.settingsTab}">${ico(t.icon)}<span class="lbl-long">${t.label}</span><span class="lbl-short">${t.short}</span></button>`).join('');
    pane.innerHTML = { general: tabGeneral, memory: tabMemory, checks: tabChecks, data: tabData }[state.settingsTab]();
    pane.scrollTop = resetScroll ? 0 : top;
  }

  function tabGeneral() {
    const remote = state.engine.engine === 'remote';
    return `
      <h3 class="pane-title">General</h3>
      ${row('Appearance', 'Light, dark, or follow your device.', seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], themePref()))}
      ${row('Lesson mode', 'How many times a failed lesson may be rewritten before it is held for review.', seg('retries', [[2, 'Careful · 2 rewrites'], [1, 'Quick · 1 rewrite']], state.prefs.retries))}
      ${row('Use memory', 'Add learned rules and reviewer notes to every new lesson.', sw('toggle-memory', state.prefs.useMemory, 'Use memory'))}
      <h3 class="pane-title">Engine</h3>
      ${row('Where lessons are written', 'Demo runs in this browser with pre-written drafts, and the checks are real. Live backend sends your topic to your own service.', seg('engine', [['demo', 'Demo'], ['remote', 'Live backend']], state.engine.engine))}
      ${remote
        ? `<div class="row stack">
            <div class="row-main"><b>Backend URL</b><small>The page posts to <code>/api/run</code> and reads Server-Sent Events. The event contract is in the README.</small></div>
            <div class="row-ctl"><div class="input-row"><input class="input" id="backend-url" type="url" value="${esc(state.engine.baseUrl)}" placeholder="http://localhost:8000" aria-label="Backend URL"><button type="button" class="btn ghost" data-action="test-backend">Test</button></div></div>
            <p class="status-line" id="backend-status" role="status"></p>
          </div>`
        : row('Demo speed', 'How fast the demo plays. Slow is easier to narrate in a video.', seg('speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], state.prefs.speed))}`;
  }

  /* Suggestions only: the system never rewrites its own rubric. A human decides. */
  function rubricSuggestions(m) {
    const out = [];
    m.rules.forEach(r => {
      const n = m.failures[r.checkId] || 0;
      if (n > r.afterFailures) {
        const title = (LL.checkById[r.checkId] || {}).title || r.checkId;
        out.push({ tone: 'bad', id: r.checkId, tag: 'Rule failing', text: `The learned rule is not working: “${title}” kept failing after the rule was added (${n} failures, ${r.afterFailures} when it was learned). Rewrite the rule, add a good and bad example to the prompt, or make the check clearer.` });
      }
    });
    if (m.runs.length >= 5) {
      LL.CHECKS.filter(c => !(m.failures[c.id] || 0)).forEach(c => {
        out.push({ tone: 'warn', id: c.id, tag: 'Maybe too easy', text: `“${c.title}” has never failed in ${m.runs.length} runs. It may be too easy. Consider tightening it so it still catches weak drafts.` });
      });
    }
    return out.slice(0, 6);
  }

  function tabMemory() {
    const m = LL.memory.get();
    const max = Math.max(1, ...Object.values(m.failures));
    const learned = new Set(m.rules.map(r => r.checkId));
    const bars = Object.entries(m.failures).sort((a, b) => b[1] - a[1]);
    const suggestions = rubricSuggestions(m);
    return `
      <h3 class="pane-title">Memory</h3>
      <p class="pane-lead">Failures are counted across lessons. When a check keeps failing, a rule is promoted into the writer’s instructions, so the next lesson starts from a better first draft.</p>
      ${row('Use memory', 'Add learned rules and reviewer notes to every new lesson.', sw('toggle-memory', state.prefs.useMemory, 'Use memory'))}
      ${row('Promote a rule after', 'How many times a check must fail before it becomes a rule.', seg('threshold', [[1, '1 failure'], [2, '2 failures'], [3, '3 failures']], m.threshold))}

      <h4 class="sub">Learned rules <span class="count">${m.rules.length}</span></h4>
      ${m.rules.length ? m.rules.map(r => `<div class="item"><span class="cid">${esc(r.checkId)}</span><p>${esc(r.text)}<small>Promoted after ${r.afterFailures} failures · ${fmtDate(r.learnedAt)}</small></p><button type="button" class="x-btn" data-action="remove-rule" data-id="${esc(r.checkId)}" aria-label="Forget rule ${esc(r.checkId)}">${ico('x')}</button></div>`).join('')
        : emptyNote(`No rules yet. Write ${m.threshold} lessons: any check that fails ${m.threshold}× becomes a rule.`)}

      <h4 class="sub">Failure counts</h4>
      ${bars.length ? `<div class="bars">${bars.map(([id, n]) => `<div class="bar-row"><span title="${esc((LL.checkById[id] || {}).title || id)}">${esc(id)}</span><div class="bar-track"><div class="bar-fill ${learned.has(id) ? 'learned' : ''}" style="width:${(n / max) * 100}%"></div></div><b>${n}</b></div>`).join('')}</div>`
        : emptyNote('Counts appear after your first lesson.')}

      <h4 class="sub">Rubric suggestions <span class="count">you decide</span></h4>
      ${suggestions.length ? suggestions.map(s => `<div class="item"><span class="cid">${esc(s.id)}</span><p>${esc(s.text)}</p><span class="tag ${s.tone}">${s.tag}</span></div>`).join('')
        : emptyNote('None yet. They appear when a learned rule stops working, or after 5 lessons for checks that never fail.')}

      <h4 class="sub">Run history <span class="count">${m.runs.length}</span></h4>
      ${m.runs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Result</th><th>Drafts</th><th>1st draft</th><th>Rules used</th></tr></thead><tbody>
        ${m.runs.slice(0, 8).map(x => `<tr><td>${fmtDate(x.ts)}</td><td>${x.status === 'shipped' ? '<span class="tag ok">Shipped</span>' : '<span class="tag warn">Held</span>'}</td><td>${x.attempts}</td><td>${esc(x.firstAttemptScore)}</td><td>${x.rulesUsed || 0}</td></tr>`).join('')}
        </tbody></table></div>` : emptyNote('No lessons yet.')}

      <h4 class="sub">Reviewer notes <span class="count">${m.notes.length}</span></h4>
      ${m.notes.length ? m.notes.map(n => `<div class="item">${ico(n.rating === 'down' ? 'thumb-down' : n.rating === 'up' ? 'thumb-up' : 'pencil', 'note-ico')}<p>${esc(n.text)}<small>${fmtDate(n.ts)}</small></p><button type="button" class="x-btn" data-action="remove-note" data-ts="${n.ts}" aria-label="Delete note">${ico('x')}</button></div>`).join('')
        : emptyNote('No notes yet. Use the thumbs under a lesson to add one.')}

      <div class="btn-row">
        <button type="button" class="btn ghost" data-action="export-memory">${ico('download')}Export JSON</button>
        <button type="button" class="btn ghost bad" data-action="clear-memory">Clear memory</button>
      </div>`;
  }

  function tabChecks() {
    return `
      <h3 class="pane-title">Quality checks</h3>
      <p class="pane-lead">Every lesson is judged on ${TOTAL} hard checks. Each is pass or fail, with no partial credit. A lesson is shown as final only when <b>all ${TOTAL}</b> pass. If a check fails, the reason is sent back to the writer. After the retry limit, the lesson is held for a person.</p>
      ${LL.DIMENSIONS.map(d => `<section class="dim">
        <h4><span aria-hidden="true">${d.icon}</span>${esc(d.name)}</h4>
        <p class="why">${esc(d.why)}</p>
        ${LL.CHECKS.filter(c => c.dim === d.id).map(c => `<div class="rc"><div class="rc-top"><span class="cid">${c.id}</span><b>${esc(c.title)}</b><span class="rc-method">${esc(c.method)}</span></div><p><b>Pass when:</b> ${esc(c.pass)}</p></div>`).join('')}
      </section>`).join('')}`;
  }

  function tabData() {
    const open = (href, label) => `<a class="btn ghost sm" href="${href}" target="_blank" rel="noopener">${label}${ico('external')}</a>`;
    return `
      <h3 class="pane-title">Data controls</h3>
      ${row('Export chats', 'Download every chat, lesson and rejection log as JSON.', `<button type="button" class="btn ghost sm" data-action="export-chats">${ico('download')}Export</button>`)}
      ${row('Delete all chats', 'Removes every chat from this browser. Memory is kept.', `<button type="button" class="btn ghost sm bad" data-action="delete-all-chats" ${state.chats.length ? '' : 'disabled'}>Delete all</button>`)}
      <h3 class="pane-title">Developer</h3>
      <p class="pane-lead">Extra views for reviewing how the system works. They are not part of the chat.</p>
      ${row('Evaluator lab', 'Inject a deliberate error into a passing lesson and watch the evaluator reject it.', open('dashboard.html#lab', 'Open'))}
      ${row('How it works', 'Architecture, design decisions and the backend event contract.', open('dashboard.html#design', 'Open'))}
      ${row('Full dashboard', 'Rubric, rejection log, memory and the step-by-step run view.', open('dashboard.html', 'Open'))}`;
  }

  /* ================= events ================= */
  document.addEventListener('click', async ev => {
    // A click on the dim area around a dialog closes it.
    const dlgEl = ev.target;
    if (dlgEl instanceof HTMLDialogElement && dlgEl.open) {
      const r = dlgEl.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dlgEl.close();
      return;
    }

    const link = ev.target.closest('.chat-link');
    if (link) {
      if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey) return; // let "open in new tab" work
      ev.preventDefault(); openChat(link.dataset.id); return;
    }

    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const id = btn.dataset.id;

    switch (act) {
      /* navigation */
      case 'new-chat': openChat(null); break;
      case 'toggle-sidebar': setSidebar($('#app').getAttribute('data-sidebar') !== 'open', true); break;
      case 'open-search': openSearch(); break;
      case 'search-pick': pickSearch(+btn.dataset.i); break;
      case 'close-dialog': btn.closest('dialog').close(); break;
      case 'scroll-bottom': scrollToBottom(true); break;
      case 'theme-toggle': applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); refreshSettings(); break;

      /* menus */
      case 'model-menu': openModelMenu(btn); break;
      case 'plus-menu': openPlusMenu(btn); break;
      case 'profile-menu': openProfileMenu(btn); break;
      case 'msg-menu': openMsgMenu(btn, id); break;
      case 'chat-menu':
        openMenu(btn, [
          { label: 'Rename', icon: 'pencil', onSelect: () => { state.ui.renaming = id; renderSidebar(); } },
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => deleteChat(id) },
        ], { align: 'start', width: 200 });
        break;

      /* composer */
      case 'suggest': if (state.run) toast('Please wait until the current lesson is finished.'); else sendMessage(btn.dataset.text); break;
      case 'stop': stopRun(); break;

      /* a message */
      case 'toggle-think': {
        state.ui.think[id] = !state.ui.think[id];
        const f = findMsg(id); if (f) renderMessage(f.msg);
        break;
      }
      case 'open-log': {
        state.ui.think[id] = !state.ui.think[id];
        const f = findMsg(id); if (f) renderMessage(f.msg);
        const panel = document.getElementById('tp-' + id);
        if (panel) panel.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
        break;
      }
      case 'toggle-prompt': {
        const key = btn.dataset.key;
        state.ui.prompts[key] = !state.ui.prompts[key];
        const f = findMsg(key.split(':')[0]); if (f) renderMessage(f.msg);
        break;
      }
      case 'copy': {
        const f = findMsg(id);
        if (!f || !f.msg.run || !f.msg.run.markdown) break;
        const how = await copyRich(f.msg.run.markdown);
        if (how === 'fail') { toast('Copy failed'); break; }
        flash(btn);
        toast(how === 'rich' ? 'Copied. Paste it into Google Docs or Notion.' : 'Copied as Markdown');
        break;
      }
      case 'copy-user': {
        const f = findMsg(id);
        if (f && await copyText(f.msg.text)) { flash(btn); toast('Copied'); }
        break;
      }
      case 'regenerate': regenerate(id); break;
      case 'log-md': exportLog(id, 'md'); break;
      case 'log-json': exportLog(id, 'json'); break;
      case 'rate': {
        const f = findMsg(id); if (!f) break;
        const rating = btn.dataset.rating;
        if (f.msg.rating === rating) { f.msg.rating = null; state.ui.feedback = null; }
        else { f.msg.rating = rating; state.ui.feedback = { msgId: id, rating }; }
        persist();
        renderMessage(f.msg);
        const ta = document.querySelector(`#m-${id} [data-fb-text]`);
        if (ta) ta.focus({ preventScroll: true });
        break;
      }
      case 'fb-chip': btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true')); break;
      case 'fb-cancel': {
        const f = findMsg(btn.closest('.fb').dataset.id);
        state.ui.feedback = null;
        if (f) renderMessage(f.msg);
        break;
      }
      case 'fb-submit': {
        const panel = btn.closest('.fb');
        const f = findMsg(panel.dataset.id);
        const fb = state.ui.feedback;
        if (!f || !fb) break;
        const picked = $$('.fchip[aria-pressed="true"]', panel).map(b => FEEDBACK[fb.rating].chips[+b.dataset.i][1]);
        const note = [...picked, $('[data-fb-text]', panel).value.trim()].filter(Boolean).join(' ');
        if (!note) { toast('Pick a reason or write a short note.'); break; }
        LL.memory.addNote(note, fb.rating);
        state.ui.feedback = null;
        renderMessage(f.msg);
        refreshSettings();
        toast('Thanks. Saved to memory for the next lesson.');
        break;
      }

      /* settings */
      case 'open-settings': openSettings(btn.dataset.tab || undefined); break;
      case 'set-tab': state.settingsTab = btn.dataset.tab; renderSettings(true); break;
      case 'set-pref': {
        const key = btn.dataset.key, val = btn.dataset.val;
        if (key === 'theme') applyTheme(val);
        else if (key === 'retries') { setRetries(+val); break; }
        else if (key === 'speed') setPref('speed', val);
        else if (key === 'engine') { state.engine.engine = val; store.saveEngine(state.engine); renderChrome(); }
        else if (key === 'threshold') LL.memory.setThreshold(+val);
        renderSettings();
        break;
      }
      case 'toggle-memory': setUseMemory(!state.prefs.useMemory); break;
      case 'test-backend': {
        const st = $('#backend-status');
        const url = ($('#backend-url').value || '').trim();
        st.className = 'status-line';
        if (!url) { st.textContent = 'Enter the backend URL first.'; break; }
        st.textContent = 'Testing…';
        try { await LL.testBackend(url); st.textContent = '✓ Backend reachable'; st.className = 'status-line ok'; }
        catch (e) { st.textContent = `✕ Could not reach it (${e.message}). Check the URL and CORS.`; st.className = 'status-line bad'; }
        break;
      }
      case 'remove-rule': LL.memory.removeRule(id); renderSettings(); break;
      case 'remove-note': LL.memory.removeNote(+btn.dataset.ts); renderSettings(); break;
      case 'export-memory': download('lessonloop-memory.json', LL.memory.exportJSON(), 'application/json'); break;
      case 'clear-memory':
        if (await confirmDialog({ title: 'Clear memory?', text: 'This forgets all learned rules, failure counts, history and notes.', ok: 'Clear memory', danger: true })) {
          LL.memory.clear(); renderSettings(); toast('Memory cleared');
        }
        break;
      case 'export-chats':
        download('lessonloop-chats.json', JSON.stringify({ exportedAt: new Date().toISOString(), chats: state.chats }, (k, v) => (k.charAt(0) === '_' ? undefined : v), 2), 'application/json');
        break;
      case 'delete-all-chats': deleteAllChats(); break;
    }
  });

  /* ================= upload a PDF or image (needs the Java backend) ================= */
  async function handleUpload(file) {
    if (!file) return;
    if (state.run) { toast('Please wait until the current lesson is finished.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('That file is too big. Maximum 10 MB.'); return; }
    let chat = activeChat();
    if (!chat) {
      chat = { id: uid(), title: shorten(file.name, 48), createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
      state.chats.unshift(chat);
      state.activeId = chat.id;
      navHash('#/c/' + chat.id);
    }
    const um = { id: uid(), role: 'user', text: '📎 ' + file.name, ts: Date.now() };
    const am = { id: uid(), role: 'assistant', kind: 'info', ts: Date.now(), text: `Reading **${file.name}** and finding the important parts…` };
    chat.messages.push(um, am);
    chat.updatedAt = Date.now();
    renderMessage(um, true); renderMessage(am, true);
    renderSidebar(); renderChrome();
    scrollToBottom(false);
    const base = (state.engine.baseUrl || '').replace(/\/$/, '');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(base + '/api/documents', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The backend replied ' + res.status);
      am.text = data.markdown;
    } catch (err) {
      am.text = 'I could not read that file.\n\n' + (err instanceof TypeError
        ? `The backend at ${base} is not reachable. Start the Java backend (backend folder, port 8000), or set its address in Settings → General → Live backend.`
        : err.message);
    }
    renderMessage(am);
    stickIfPinned();
    persist(true);
  }
  $('#file-input').addEventListener('change', ev => { const f = ev.target.files[0]; ev.target.value = ''; handleUpload(f); });

  /* composer */
  const input = $('#composer-input');
  input.addEventListener('input', () => { autosize(input); renderComposerState(); });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); submitComposer(); }
  });
  $('#composer').addEventListener('submit', ev => { ev.preventDefault(); submitComposer(); });
  $('#composer').addEventListener('click', ev => { if (ev.target === ev.currentTarget) input.focus(); });

  /* sidebar rename */
  document.addEventListener('keydown', ev => {
    if (!ev.target.classList || !ev.target.classList.contains('chat-rename')) return;
    if (ev.key === 'Enter') { ev.preventDefault(); commitRename(ev.target, true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); commitRename(ev.target, false); }
  });
  document.addEventListener('focusout', ev => {
    if (ev.target.classList && ev.target.classList.contains('chat-rename') && state.ui.renaming) commitRename(ev.target, true);
  });

  /* search dialog */
  $('#search-results').setAttribute('role', 'listbox');
  $('#search-input').addEventListener('input', ev => { state.ui.search = { q: ev.target.value, idx: 0 }; renderSearch(); });
  $('#search-input').addEventListener('keydown', ev => {
    const n = searchItems().length;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); state.ui.search.idx = Math.min(n - 1, state.ui.search.idx + 1); renderSearch(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); state.ui.search.idx = Math.max(0, state.ui.search.idx - 1); renderSearch(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); pickSearch(state.ui.search.idx); }
  });

  /* settings: backend URL is saved as soon as it changes */
  document.addEventListener('change', ev => {
    if (ev.target.id === 'backend-url') { state.engine.baseUrl = ev.target.value.trim(); store.saveEngine(state.engine); }
  });

  /* scroller */
  $('#scroller').addEventListener('scroll', () => { state.pinned = refreshToBottom() < 80; }, { passive: true });

  /* keyboard shortcuts (same ones ChatGPT uses) */
  document.addEventListener('keydown', ev => {
    const mod = ev.ctrlKey || ev.metaKey;
    const key = (ev.key || '').toLowerCase();
    if (mod && ev.shiftKey && key === 'o') { ev.preventDefault(); openChat(null); }
    else if (mod && !ev.shiftKey && key === 'k') { ev.preventDefault(); openSearch(); }
    else if (mod && ev.shiftKey && key === 's') { ev.preventDefault(); setSidebar($('#app').getAttribute('data-sidebar') !== 'open', true); }
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  window.addEventListener('pagehide', () => store.saveChats(state.chats));

  /* ================= init ================= */
  function init() {
    applyTheme(themePref(), true);

    // URL switches for testing and recording: ?speed=fast|slow  ?retries=1  ?memory=off  ?autorun=1  ?q=topic
    const q = new URLSearchParams(location.search);
    if (['slow', 'normal', 'fast'].includes(q.get('speed'))) { state.prefs.speed = q.get('speed'); urlPrefs.add('speed'); }
    if (q.get('retries')) { state.prefs.retries = q.get('retries') === '1' ? 1 : 2; urlPrefs.add('retries'); }
    if (q.get('memory') === 'off') { state.prefs.useMemory = false; urlPrefs.add('useMemory'); }

    setSidebar(sidebarWanted(), false);
    const id = chatIdFromHash();
    state.activeId = id && state.chats.some(c => c.id === id) ? id : null;
    renderSidebar(); renderThread(); renderChrome();
    const s = $('#scroller'); s.scrollTop = s.scrollHeight;
    if (!MOBILE.matches) input.focus();

    const auto = q.get('q') || (q.get('autorun') ? DEFAULT_TOPIC : '');
    if (auto && !state.activeId) setTimeout(() => sendMessage(auto), 150);
  }

  init();

})(window.LL);
