// Stamp a version on every local CSS and JS link in the site's HTML pages, e.g.
// css/bank.css -> css/bank.css?v=20261031-1830, so browsers fetch the new files after
// a deploy instead of reusing old cached copies. Run before committing a release:
//   node tools/bump-version.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());

function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['.git', 'papers', 'tools', 'data', 'node_modules'].includes(e.name) ? [] : pages(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

// Relative links into css/ or js/ (any depth of ../), with or without an old version.
const LINK = /\b(src|href)="((?:\.\.\/)*(?:css|js)\/[^"?#]+\.(?:css|js))(?:\?v=[^"]*)?"/g;
let files = 0, links = 0;
for (const file of pages(root)) {
  const text = fs.readFileSync(file, 'utf8');
  let n = 0;
  const out = text.replace(LINK, (all, attr, url) => { n++; return attr + '="' + url + '?v=' + version + '"'; });
  if (n) { fs.writeFileSync(file, out); files++; links += n; }
}
console.log('version ' + version + ': ' + links + ' links in ' + files + ' pages');
