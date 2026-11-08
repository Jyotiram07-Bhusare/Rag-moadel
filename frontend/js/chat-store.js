/* ------------------------------------------------------------------
   chat-store.js — chat history and chat preferences (localStorage).

     chats    the conversations shown in the sidebar. An assistant message
              that ran the pipeline carries its whole run (attempts, checks,
              final lesson), so the rejection log survives a reload.
     prefs    rewrites allowed, demo speed, memory on/off, sidebar state.
     engine   demo / live backend + URL. Same key as dashboard.html, so both
              pages always agree on which engine is in use.

   Fields that start with "_" are transient and never written to storage.
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const CHATS_KEY = 'lessonloop.chats.v1';
  const PREFS_KEY = 'lessonloop.chat.prefs.v1';
  const ENGINE_KEY = 'lessonloop.settings.v1';
  const MAX_CHATS = 40;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value, (k, v) => (k.charAt(0) === '_' ? undefined : v)));
      return true;
    } catch (e) { return false; }
  }

  /* Stored data is checked on load, so one bad entry can never stop the page from rendering. */
  const ID = /^[a-z0-9]{1,32}$/i;
  const validId = id => typeof id === 'string' && ID.test(id);
  const validMessage = m => m && validId(m.id) && (m.role === 'user' || m.role === 'assistant');
  const validChat = c => c && validId(c.id) && typeof c.title === 'string' && Array.isArray(c.messages);

  function tidyRun(r) {
    if (!r || typeof r !== 'object') return null;
    r.attempts = Array.isArray(r.attempts)
      ? r.attempts.filter(a => a && typeof a.n === 'number' && Array.isArray(a.results) && Array.isArray(a.failed))
      : [];
    r.rules = Array.isArray(r.rules) ? r.rules : [];
    if (typeof r.topic !== 'string') r.topic = 'lesson';
    // A run that was still going when the page closed can never finish.
    if (r.status === 'running') { r.status = 'stopped'; r.phase = 'stopped'; r.interrupted = true; }
    return r;
  }

  function tidyMessage(m) {
    if (m.role === 'user' || m.kind === 'info') return typeof m.text === 'string' ? m : null;
    m.run = tidyRun(m.run);
    return m.run ? m : null;
  }

  /* Locally the Java backend runs on :8000. On Render the site is lessonloop-frontend.onrender.com and the
     backend is lessonloop-backend.onrender.com. Settings → General can override this. */
  function defaultBackend() {
    const h = location.hostname || '';
    return h.endsWith('.onrender.com') && h.includes('frontend')
      ? 'https://' + h.replace('frontend', 'backend')
      : 'http://localhost:8000';
  }

  LL.chatStore = {
    loadChats() {
      const raw = read(CHATS_KEY, []);
      if (!Array.isArray(raw)) return [];
      return raw.filter(validChat).map(c => {
        c.messages = c.messages.filter(validMessage).map(tidyMessage).filter(Boolean);
        c.createdAt = c.createdAt || Date.now();
        c.updatedAt = c.updatedAt || c.createdAt;
        return c;
      });
    },

    /* Newest chats first. If storage is full, keep the newest half and try again. */
    saveChats(chats) {
      let list = chats.slice(0, MAX_CHATS);
      for (;;) {
        if (write(CHATS_KEY, list)) return true;
        if (list.length <= 1) return false;
        list = list.slice(0, Math.floor(list.length / 2));
      }
    },

    loadPrefs() {
      const p = Object.assign({ retries: 2, speed: 'normal', useMemory: true, sidebar: null }, read(PREFS_KEY, {}));
      if (p.retries !== 1 && p.retries !== 2) p.retries = 2;
      if (!['slow', 'normal', 'fast'].includes(p.speed)) p.speed = 'normal';
      p.useMemory = p.useMemory !== false;
      return p;
    },
    savePrefs(p) { write(PREFS_KEY, p); },

    loadEngine() {
      const e = Object.assign({ engine: 'demo', baseUrl: defaultBackend() }, read(ENGINE_KEY, {}));
      if (e.engine !== 'demo' && e.engine !== 'remote') e.engine = 'demo';
      return e;
    },
    saveEngine(e) {
      write(ENGINE_KEY, Object.assign(read(ENGINE_KEY, {}), { engine: e.engine, baseUrl: e.baseUrl }));
    },
  };

})(window.LL = window.LL || {});
