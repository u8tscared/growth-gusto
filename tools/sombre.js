// Mode sombre : prépare les feuilles de style pour la nuit, sans toucher aux sources du dépôt.
// Pour chaque règle qui écrit une couleur claire en dur (#fff, crème…), une règle jumelle limitée à :where(html[data-theme=dark])
// est écrite juste après elle, avec la couleur traduite (js/sombre-map.js). Même spécificité, juste après : la cascade ne change pas.
// Les écrans ajoutés plus tard par n'importe quel module ont donc leur mode sombre sans rien faire.
//
// Usage :
//   node tools/sombre.js --write   réécrit css/*.css sur place (lancé par .github/workflows/deploy.yml juste avant la mise en ligne)
//   node tools/sombre.js           affiche, par fichier, le nombre de règles jumelles (rien n'est écrit)
// tools/run.js applique la même préparation à la volée, pour que les tests voient exactement ce qui est mis en ligne.
const fs = require('fs'); const path = require('path');
const M = require('../js/sombre-map.js');
const MARK = '/* th-built */';
const SKIP_FILES = new Set(['sombre.css']);
/* tells js/theme.js the sheets are ready (no work left in the browser) */
const BUILT = ':root{--th-built:1}';

/* a small CSS walker: comments and strings are copied as they are, @media/@supports/@layer/@container are entered,
   @keyframes, @font-face, @page, @property, print and prefers-color-scheme blocks are copied untouched */
function transform(src) {
  if (src.startsWith(MARK)) return { css: src, n: 0 };
  let n = 0;
  function skipWsComments(s, i) { for (;;) { while (i < s.length && /\s/.test(s[i])) i++; if (s.startsWith('/*', i)) { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; } else return i; } }
  /* index of the matching } for the { at position i */
  function matchBrace(s, i) {
    let d = 0, q = null;
    for (let k = i; k < s.length; k++) {
      const c = s[k];
      if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '/' && s[k + 1] === '*') { const e = s.indexOf('*/', k + 2); k = e < 0 ? s.length : e + 1; continue; }
      if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return k; }
    }
    return s.length - 1;
  }
  /* end of a prelude: the next top-level { or ; */
  function preludeEnd(s, i) {
    let q = null, p = 0;
    for (let k = i; k < s.length; k++) {
      const c = s[k];
      if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '/' && s[k + 1] === '*') { const e = s.indexOf('*/', k + 2); k = e < 0 ? s.length : e + 1; continue; }
      if (c === '(' || c === '[') p++; else if (c === ')' || c === ']') p--;
      else if (p === 0 && (c === '{' || c === ';' || c === '}')) return k;
    }
    return s.length;
  }
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  function block(s) {
    let out = '', i = 0;
    while (i < s.length) {
      const j = skipWsComments(s, i); out += s.slice(i, j); i = j; if (i >= s.length) break;
      const e = preludeEnd(s, i);
      if (e >= s.length) { out += s.slice(i); break; }
      if (s[e] === ';' || s[e] === '}') { out += s.slice(i, e + 1); i = e + 1; continue; }
      const prelude = s.slice(i, e); const close = matchBrace(s, e); const body = s.slice(e + 1, close);
      const pre = stripComments(prelude).trim();
      if (pre[0] === '@') {
        const name = (/^@([\w-]+)/.exec(pre) || [])[1] || '';
        if (/^(media|supports|layer|container|document)$/.test(name) && !/print|prefers-color-scheme/i.test(pre)) out += prelude + '{' + block(body) + '}';
        else out += s.slice(i, close + 1);
      } else {
        out += s.slice(i, close + 1);
        if (!body.includes('{')) { const t = M.twin(pre.replace(/\s+/g, ' '), stripComments(body)); if (t) { out += t; n++; } }
      }
      i = close + 1;
    }
    return out;
  }
  return { css: MARK + block(src), n };
}
module.exports = { transform, MARK, SKIP_FILES, BUILT };

if (require.main === module) {
  const ROOT = path.resolve(__dirname, '..'); const dir = path.join(ROOT, 'css'); const write = process.argv.includes('--write');
  let tot = 0;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.css') && !SKIP_FILES.has(f)).sort()) {
    const p = path.join(dir, f); const src = fs.readFileSync(p, 'utf8'); const r = transform(src); tot += r.n;
    if (write && r.n) fs.writeFileSync(p, r.css);
    if (!write) console.log(f.padEnd(18), r.n);
  }
  if (write) { const sp = path.join(dir, 'sombre.css'); const t = fs.readFileSync(sp, 'utf8'); if (!t.includes(BUILT)) fs.writeFileSync(sp, t + '\n' + BUILT + '\n'); }
  console.log((write ? 'Mode sombre préparé : ' : 'Règles jumelles : ') + tot);
}
