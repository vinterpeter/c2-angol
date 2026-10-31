// Az index.html helyi fájlhivatkozásai mögé friss verziószámot ír (?v=…), hogy élesítés után
// a böngészők (főleg a Safari) ne a gyorsítótárból töltsék a régi JS/CSS fájlokat.
// Futtatás élesítés előtt, a projekt gyökeréből: node tools/verzio.mjs
import fs from 'fs';
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const html = fs.readFileSync('index.html', 'utf8')
  .replace(/(<script src="|<link rel="stylesheet" href=")([\w-]+\.(?:js|css))(?:\?v=\d+)?"/g, `$1$2?v=${v}"`);
fs.writeFileSync('index.html', html);
console.log('verzió:', v);
