/* ------------------------------------------------------------------
   markdown.js — tiny, safe markdown → HTML renderer for lessons.
   Supports: # / ## / ###, > quotes, - lists, 1. lists, **bold**, *italic*, `code`.
   Everything is HTML-escaped first, so lesson text can never inject markup.
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  LL.esc = esc;

  /* opts.plain = true → clean semantic HTML for the clipboard (no section wrappers,
     no number badges, no classes), so it pastes into Google Docs / Notion without
     carrying this app's colours. */
  LL.renderMarkdown = function (md, opts) {
    const plain = !!(opts && opts.plain);
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    const html = [];
    const headings = [];
    let i = 0;
    let sectionOpen = false;

    const closeSection = () => { if (sectionOpen) { html.push('</section>'); sectionOpen = false; } };

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      let m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
        const level = m[1].length;
        let text = m[2].trim();
        if (level === 1) {
          html.push(`<h1>${inline(text)}</h1>`);
        } else if (level === 2 && plain) {
          html.push(`<h2>${inline(text)}</h2>`);
        } else if (level === 2) {
          closeSection();
          const id = slug(text);
          headings.push({ id, text: text.replace(/^\d+\.\s*/, '') });
          const num = /^(\d+)\.\s+(.*)$/.exec(text);
          html.push(`<section class="sec" id="${id}">`);
          sectionOpen = true;
          html.push(num
            ? `<h2><span class="sec-num">${num[1]}</span><span>${inline(num[2])}</span></h2>`
            : `<h2>${inline(text)}</h2>`);
        } else {
          html.push(`<h3>${inline(text)}</h3>`);
        }
        i++; continue;
      }

      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
        html.push(`<blockquote>${buf.map(inline).join('<br>')}</blockquote>`);
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
        html.push('<ul>' + items.map(t => `<li>${inline(t)}</li>`).join('') + '</ul>');
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
        html.push('<ol>' + items.map(t => `<li>${inline(t)}</li>`).join('') + '</ol>');
        continue;
      }

      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) { buf.push(lines[i]); i++; }
      html.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    closeSection();
    return { html: html.join('\n'), headings };
  };

})(window.LL = window.LL || {});
