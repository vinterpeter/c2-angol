// Összefésüli a /tmp/c2work alatt készült tartalmat a projekt adatfájljaiba.
// Futtatás: node tools/merge.mjs   (a projekt gyökeréből)
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const W = '/tmp/c2work/';
const rd = f => JSON.parse(fs.readFileSync(W + f, 'utf8'));
const has = f => fs.existsSync(W + f);

// --- eredeti adatok (az első futáskor mentett példányból, hogy a szkript ismételhető legyen)
const ORIG = 'tools/.data-orig.js';
if (!fs.existsSync(ORIG)) fs.copyFileSync('data.js', ORIG);
globalThis.window = {};
new Function('window', fs.readFileSync(ORIG, 'utf8'))(globalThis.window);
const D = globalThis.window.C2_DATA;

// --- FRÁZISOK
const phrases = D.PHRASES.map(p => ({ ...p }));
if (has('phrases-patch.json')) for (const pt of rd('phrases-patch.json')) {
  const p = phrases.find(x => x.p === pt.p); if (!p) { console.warn('patch: nincs', pt.p); continue; }
  p.src = 'jegyzet';
  if (pt.addSenses && pt.addSenses.length) {
    if (!p.senses) p.senses = pt.baseSense ? [pt.baseSense] : [{ en: p.en, hu: p.hu, ex: p.ex, ex_hu: p.ex_hu }];
    p.senses.push(...pt.addSenses);
    p.hu = p.senses.map(s => s.hu).join('; ');
  }
}
if (has('phrases-new.json')) for (const n of rd('phrases-new.json')) {
  if (phrases.some(x => x.p.toLowerCase() === n.p.toLowerCase())) { console.warn('dupla frázis', n.p); continue; }
  phrases.push(n);
}

// --- KATONAI
const H = require(W + 'milhu-src.js');
const mil = [];
const byT = new Map();
function addMil(it, sec, opts = {}) {
  const k = it.t.toLowerCase();
  const ex = byT.get(k);
  if (ex) {                       // már létező tétel: új rész + (ha kérik) a magyar kontextusú mezők
    if (!ex.secs.includes(sec)) ex.secs.push(sec);
    if (opts.override) for (const f of ['hu', 'en', 'ex', 'ex_hu']) if (it[f]) ex[f] = it[f];
    if (!ex.abbr && it.abbr) ex.abbr = it.abbr;
    if (opts.top) ex.top = true;
    return;
  }
  const o = { t: it.t, cat: it.cat, hu: it.hu, en: it.en || '', ex: it.ex || '', ex_hu: it.ex_hu || '', lvl: it.lvl || 'B2', secs: [sec] };
  if (it.abbr) o.abbr = it.abbr;
  if (it.part) o.part = it.part;
  if (opts.top) o.top = true;
  mil.push(o); byT.set(k, o);
}
// 1) a teljes régi szakszókincs (minden régi kategória megmarad)
const picks = new Set(has('top-picks.json') ? rd('top-picks.json') : []);
for (const m of D.MIL) addMil(m, 'szak', { top: picks.has(m.t) });
// 2) leggyakoribb — új tételek (a szakszókincsben is megjelennek)
if (has('top-new.json')) for (const m of rd('top-new.json')) { addMil(m, 'szak', { top: true }); }
// 3) rendfokozatok
for (const r of H.ranks) addMil({ t: r.t, cat: 'rendfokozat', hu: r.hu, en: r.en, ex: r.ex, ex_hu: r.ex_hu, abbr: r.code + (r.abbr ? ' · ' + r.abbr : '') }, 'rang', { override: true });
for (const r of H.rankTerms) addMil({ ...r, cat: 'rendfokozat-fogalmak' }, 'rang', { override: true });
// 4) felépítés
for (const e of H.echelons) addMil({ t: e.t, cat: 'egységszint', hu: e.hu, en: `${e.size}; commander: ${e.cmd_en}`, ex: e.ex, ex_hu: e.ex_hu }, 'szerv', { override: true });
for (const o of H.orgTerms) addMil({ ...o, cat: 'szervezet' }, 'szerv', { override: true });
// 5) haderőnemek, fegyvernemek
for (const v of H.services) addMil({ t: v.t, cat: 'haderőnem', hu: v.hu, en: v.d_en, ex: v.ex, ex_hu: v.ex_hu, abbr: v.abbr }, 'haderonem', { override: true });
for (const b of H.branches) addMil({ t: b.t, cat: 'fegyvernem', hu: b.hu, en: b.d_hu, ex: b.ex, ex_hu: b.ex_hu, abbr: b.abbr }, 'haderonem', { override: true });
for (const t of H.serviceTerms) addMil({ ...t, cat: 'haderőnem-fogalmak' }, 'haderonem', { override: true });
// 6) fegyverek
if (has('weapons.json')) for (const w of rd('weapons.json')) addMil({ ...w, abbr: w.abbr || undefined }, 'fegyver');
// fegyvernemeknél az en mező magyar leírás — legyen angol, ha van ilyen a tételben
for (const b of H.branches) { const m = byT.get(b.t.toLowerCase()); if (m && m.en === b.d_hu) m.en = ''; }

// --- írás: data.js
const out = `/* STANAG 2222 Angol — adatok. A tools/merge.mjs generálja; kézzel is bővíthető. */
window.C2_DATA = window.C2_DATA || {};
Object.assign(window.C2_DATA, ${JSON.stringify({ WORDS: D.WORDS, PHRASES: phrases, MIL: mil, NATO: D.NATO })});
`;
fs.writeFileSync('data.js', out);

// --- mil-hu.js (jelvények base64-ként, ábrák)
const insignia = {};
const dir = '/tmp/c2img/rank/sm/';
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.webp'))) insignia[f.replace('.webp', '')] = 'data:image/webp;base64,' + fs.readFileSync(dir + f).toString('base64');
const svg = f => has(f) ? fs.readFileSync(W + f, 'utf8').replace(/<\?xml[^>]*>/, '').trim() : '';
const MILHU = { asOf: H.asOf, sources: H.sources, rankGroups: H.rankGroups, ranks: H.ranks.map(({ grp, hu, t, code, ins, abbr }) => ({ grp, hu, t, code, ins, abbr })),
  structure: H.structure, echelons: H.echelons, unitGroups: H.unitGroups, units: H.units, services: H.services, branches: H.branches,
  insignia, rifleSvg: svg('rifle.svg'), pistolSvg: svg('pistol.svg') };
fs.writeFileSync('mil-hu.js', `/* Magyar Honvédség: rendfokozatok, felépítés, haderőnemek, fegyverábrák. Generálja: tools/merge.mjs */
window.C2_DATA = window.C2_DATA || {};
window.C2_DATA.MILHU = ${JSON.stringify(MILHU)};
`);

// --- extra.js (igék, átvezetők)
const verbs = has('verbs.json') ? rd('verbs.json') : [];
const linking = has('linking.json') ? rd('linking.json') : [];
fs.writeFileSync('extra.js', `/* Igék és átvezető kifejezések (a füzetből). Generálja: tools/merge.mjs */
window.C2_DATA = window.C2_DATA || {};
window.C2_DATA.VERBS = ${JSON.stringify(verbs)};
window.C2_DATA.LINKING = ${JSON.stringify(linking)};
`);

// --- topics.js
const topics = [...(has('topics-1.json') ? rd('topics-1.json') : []), ...(has('topics-2.json') ? rd('topics-2.json') : [])];
fs.writeFileSync('topics.js', `/* STANAG 2 Topics — General English: kérdések, középfokú mintaválaszok, kulcsszavak. Generálja: tools/merge.mjs */
window.C2_DATA = window.C2_DATA || {};
window.C2_DATA.TOPICS = ${JSON.stringify(topics)};
`);

// --- összesítés
const cnt = {}; mil.forEach(m => m.secs.forEach(s => cnt[s] = (cnt[s] || 0) + 1));
console.log('PHRASES', phrases.length, 'phrasal', phrases.filter(p => p.type === 'phrasal').length, 'jegyzet', phrases.filter(p => p.src === 'jegyzet').length);
console.log('MIL', mil.length, 'top', mil.filter(m => m.top).length, cnt);
console.log('VERBS', verbs.length, 'LINKING', linking.length, 'TOPICS', topics.length, 'q', topics.reduce((n, t) => n + t.questions.length, 0));
console.log('insignia', Object.keys(insignia).length, 'svg', !!MILHU.rifleSvg, !!MILHU.pistolSvg);
