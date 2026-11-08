// Writes docs/RAG-RESOURCES.md from frontend/js/rag-kb.js, so the written list and the chat never disagree.
// Run it after editing the library:  node docs/make-rag-resources.js
const fs = require('fs');
const path = require('path');

global.window = {};
require(path.join(__dirname, '..', 'frontend', 'js', 'rag-kb.js'));
const { T, VIDEOS, SOURCES, CHECKED } = window.LL.ragKb.data;

const strip = s => s.replace(/\*/g, '');
const mins = (m, L) => (m >= 60 ? Math.floor(m / 60) + ' ' + L.hr + (m % 60 ? ' ' + (m % 60) + ' ' + L.min : '') : m + ' ' + L.min);
const md = [];

md.push('# RAG resources: info, examples and YouTube videos');
md.push('');
md.push('This is the written copy of the RAG library that the chat uses (`frontend/js/rag-kb.js`). In the chat, ask for');
md.push('"RAG in Marathi", "RAG in Hindi", "Best RAG examples", "RAG YouTube videos", "hindi videos" and so on.');
md.push('');
md.push('- Video details (title, channel, length and spoken language) were checked on ' + CHECKED + '.');
md.push('- Facts come from ' + SOURCES.map(s => '[' + s.name + '](' + s.url + ')').join(' and ') + '.');
md.push('- To add a video, add one line to `VIDEOS` in `frontend/js/rag-kb.js`, then run `node docs/make-rag-resources.js`.');
md.push('');

md.push('## YouTube videos');
[['en', 'English'], ['hi', 'Hindi (हिंदी)'], ['mr', 'Marathi (मराठी)']].forEach(([code, name]) => {
  md.push('', '### ' + name, '');
  VIDEOS.filter(v => v.lang === code).forEach(v => {
    md.push('- [' + v.title.replace(/[\[\]]/g, '') + '](https://www.youtube.com/watch?v=' + v.id + ') — ' + v.channel + ' · ' + mins(v.min, T.en) + ' · ' + T.en.kinds[v.kind]);
  });
});

['en', 'hi', 'mr'].forEach(code => {
  const L = T[code];
  md.push('', '---', '', '## ' + L.name + ': ' + L.infoTitle, '');
  md.push('**' + L.fullLabel + ':** RAG = Retrieval-Augmented Generation', '');
  md.push('**' + L.shortLabel + ':** ' + strip(L.shortText), '');
  md.push('**' + L.thinkLabel + ':** ' + L.thinkText, '');
  md.push('### ' + L.howTitle, '');
  L.how.forEach((s, i) => md.push((i + 1) + '. ' + s));
  md.push('', '### ' + L.advTitle, '');
  L.adv.forEach(s => md.push('- ' + s));
  md.push('', '### ' + L.noteTitle, '');
  L.note.forEach(s => md.push('- ' + s));
  md.push('', '> **' + L.funLabel + ':** ' + L.funText);
  md.push('', '### ' + L.exTitle, '');
  L.ex.forEach(e => md.push('- **' + e[0] + '**: ' + e[1]));
  md.push('', L.companies);
});
md.push('');

fs.writeFileSync(path.join(__dirname, 'RAG-RESOURCES.md'), md.join('\n'));
console.log('wrote docs/RAG-RESOURCES.md (' + md.length + ' lines)');
