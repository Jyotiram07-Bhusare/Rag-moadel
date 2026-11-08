/* ------------------------------------------------------------------
   chat-ui.js — small UI helpers for the chat page: icons, toasts,
   popover menus, confirm dialog, clipboard, downloads, textarea sizing.
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = LL.esc;

  /* Every icon lives in one SVG sprite at the top of index.html. */
  const ico = (name, cls) =>
    `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

  /* ---------- toast (top centre, like ChatGPT) ---------- */
  function toast(text, tone) {
    const host = $('#toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast' + (tone ? ' ' + tone : '');
    el.textContent = text;
    host.appendChild(el);
    // A popover lives in the top layer, so toasts stay visible above open dialogs.
    try { if (!host.matches(':popover-open')) host.showPopover(); } catch (e) { /* no popover support */ }
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        if (!host.children.length) { try { host.hidePopover(); } catch (e) { /* ignore */ } }
      }, 240);
    }, 2600);
  }

  /* ---------- popover menu ---------- */
  let current = null;

  function closeMenu(restoreFocus) {
    if (!current) return;
    const { el, anchor, off } = current;
    current = null;
    off();
    el.remove();
    if (anchor) {
      anchor.setAttribute('aria-expanded', 'false');
      if (restoreFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
    }
  }

  function place(el, anchor, opts) {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const m = 8, gap = 6;
    let left = opts.align === 'end' ? r.right - w : r.left;
    left = Math.max(m, Math.min(left, window.innerWidth - w - m));
    let top;
    if (opts.placement === 'top') {
      top = r.top - h - gap;
      if (top < m) top = r.bottom + gap;
    } else {
      top = r.bottom + gap;
      if (top + h > window.innerHeight - m && r.top - h - gap > m) top = r.top - h - gap;
    }
    top = Math.max(m, Math.min(top, window.innerHeight - h - m));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  /* items: { label, desc, icon, checked, radio, danger, disabled, onSelect } | { sep: true } | { header: 'text' }
     opts:  { align: 'start' | 'end', placement: 'bottom' | 'top', width } */
  function openMenu(anchor, items, opts) {
    opts = opts || {};
    const toggledOff = current && current.anchor === anchor;
    closeMenu(false);
    if (toggledOff) return; // clicking the trigger again closes the menu

    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    if (opts.width) el.style.width = opts.width + 'px';
    el.innerHTML = items.map((it, i) => {
      if (it.sep) return '<div class="menu-sep" role="separator"></div>';
      if (it.header) return `<div class="menu-head" role="presentation">${esc(it.header)}</div>`;
      const role = it.checked === undefined ? 'menuitem' : (it.radio ? 'menuitemradio' : 'menuitemcheckbox');
      return `<button type="button" class="menu-item${it.danger ? ' danger' : ''}" role="${role}"${it.checked === undefined ? '' : ` aria-checked="${!!it.checked}"`}${it.disabled ? ' disabled' : ''} data-i="${i}">
        ${it.icon ? ico(it.icon, 'mi-ico') : ''}
        <span class="mi-text"><span class="mi-label">${esc(it.label)}</span>${it.desc ? `<span class="mi-desc">${esc(it.desc)}</span>` : ''}</span>
        ${it.checked ? ico('check', 'mi-check') : ''}
      </button>`;
    }).join('');
    document.body.appendChild(el);
    place(el, anchor, opts);
    anchor.setAttribute('aria-expanded', 'true');

    const enabled = () => $$('.menu-item:not([disabled])', el);
    const onDown = ev => {
      if (!el.contains(ev.target) && !anchor.contains(ev.target)) closeMenu(false);
    };
    const onKey = ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMenu(true); return; }
      if (ev.key === 'Tab') { closeMenu(false); return; }
      const list = enabled();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (ev.key === 'Home') { ev.preventDefault(); list[0].focus(); }
      else if (ev.key === 'End') { ev.preventDefault(); list[list.length - 1].focus(); }
    };
    const onResize = () => closeMenu(false);
    el.addEventListener('click', ev => {
      const b = ev.target.closest('.menu-item');
      if (!b || b.disabled) return;
      const it = items[+b.dataset.i];
      closeMenu(true);
      if (it && it.onSelect) it.onSelect();
    });
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    current = {
      el, anchor,
      off() {
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', onResize);
      },
    };
    const first = enabled()[0];
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- confirm dialog ---------- */
  function confirmDialog(o) {
    const dlg = $('#confirm');
    $('#confirm-title').textContent = o.title;
    $('#confirm-text').textContent = o.text || '';
    const ok = $('#confirm-ok');
    ok.textContent = o.ok || 'Confirm';
    ok.className = 'btn ' + (o.danger ? 'danger' : 'primary');
    return new Promise(resolve => {
      const done = () => { dlg.removeEventListener('close', done); resolve(dlg.returnValue === 'ok'); };
      dlg.returnValue = '';
      dlg.addEventListener('close', done);
      dlg.showModal();
      $('#confirm-cancel').focus();
    });
  }

  /* ---------- clipboard + files ---------- */
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  /* Copies a lesson with formatting (headings, lists, bold) so it pastes cleanly
     into Google Docs or Notion. Falls back to plain Markdown.
     Returns 'rich' | 'text' | 'fail'. */
  async function copyRich(markdown) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const html = '<meta charset="utf-8">' + LL.renderMarkdown(markdown, { plain: true }).html;
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([markdown], { type: 'text/plain' }),
        })]);
        return 'rich';
      }
    } catch (e) { /* fall through to plain text */ }
    return (await copyText(markdown)) ? 'text' : 'fail';
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  LL.ui = { $, $$, ico, toast, openMenu, closeMenu, confirmDialog, copyText, copyRich, download, autosize };

})(window.LL = window.LL || {});
