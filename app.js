/* C2 Angol — app.js (vanilla, offline) */
(function () {
'use strict';

const D = window.C2_DATA;
const WORDS = D.WORDS, PHRASES = D.PHRASES, MIL = D.MIL, NATO = D.NATO, CRISIS = D.CRISIS || [], WM = D.WORLD_MAP || null;
const KEY = 'c2angol.v1';
const DAY = 86400000;
const INTERVALS = [0, 1, 3, 7, 14, 30]; // nap, doboz szerint
const MAX_BOX = 5;

// ---------- Segédek ----------
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n, excl) => shuffle(a.filter(x => !excl || !excl.has(x))).slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const SPEAK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"></path><path d="M16 9a4 4 0 0 1 0 6"></path><path d="M18.5 6.5a8 8 0 0 1 0 11"></path></svg>';
const speakBtn = (text, extraClass) => `<button class="speak${extraClass ? ' ' + extraClass : ''}" data-speak="${esc(text)}" title="Kiejt\u00e9s">${SPEAK_SVG}</button>`;
const CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>';
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }

// ---------- Állapot ----------
const DEFAULT = {
  words: {}, phrases: {}, mil: {},
  quiz: { cloze: [0, 0], meaning: [0, 0], milq: [0, 0], nato: [0, 0] },
  log: {},          // 'YYYY-MM-DD' -> [reviews, correct]
  settings: { theme: 'auto', speak: true }
};
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    const s = Object.assign({}, DEFAULT, obj);
    s.quiz = Object.assign({}, DEFAULT.quiz, obj.quiz || {});
    s.settings = Object.assign({}, DEFAULT.settings, obj.settings || {});
    s.log = obj.log || {};
    return s;
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* quota */ } }

function stat(store, key) { return S[store][key] || { box: 0, due: 0, seen: 0, ok: 0, fail: 0 }; }
function status(st) {
  if (!st.seen) return 'new';
  if (st.box >= 4) return 'known';
  return 'learning';
}
function isDue(st) { return st.seen > 0 && st.due <= Date.now(); }
function grade(store, key, ok) {
  const st = Object.assign({}, stat(store, key));
  st.seen++;
  if (ok) { st.ok++; st.box = Math.min(MAX_BOX, st.box + 1); }
  else { st.fail++; st.box = 0; }
  st.due = Date.now() + INTERVALS[st.box] * DAY;
  S[store][key] = st;
  const d = today(); const l = S.log[d] || [0, 0]; l[0]++; if (ok) l[1]++; S.log[d] = l;
  save();
  updateSidebar();
}
function recordQuiz(name, ok) { const q = S.quiz[name]; q[0]++; if (ok) q[1]++; save(); }

// ---------- Beszéd ----------
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /en[-_]GB/i.test(v.lang) && /Daniel|Kate|Serena|Google UK/i.test(v.name))
       || vs.find(v => /en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB'; if (voice) u.voice = voice; u.rate = 0.92;
  speechSynthesis.speak(u);
}

// ---------- Téma ----------
const SUN_SVG = '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>';
const MOON_SVG = '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"></path>';
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-icon').innerHTML = dark ? SUN_SVG : MOON_SVG;
  $('#theme-label').textContent = dark ? 'Világos téma' : 'Sötét téma';
  updateWorldMapTheme();
}
$('#btn-theme').addEventListener('click', () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (S.settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  S.settings.theme = dark ? 'light' : 'dark'; save(); applyTheme(); drawChart();
});
applyTheme();

// ---------- Fülek ----------
let activeTab = 'words';
$$('#tabs .tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  activeTab = name;
  $$('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'words') { renderWords(); renderWordsAside(); }
  if (name === 'cards') updateCardsAvail();
  if (name === 'crisis') renderCrisis();
  if (name === 'stats') renderStats();
  window.scrollTo(0, 0);
}

// ---------- Oldalsáv: számlálók, sorozat ----------
function dueCount(store, items, keyOf) { return items.reduce((n, i) => n + (isDue(stat(store, keyOf(i))) ? 1 : 0), 0); }
function updateSidebar() {
  $('#nav-count-words').textContent = WORDS.length;
  $('#nav-count-phrases').textContent = PHRASES.length;
  $('#nav-count-mil').textContent = MIL.length;
  const dueW = dueCount('words', WORDS, w => w.w), dueP = dueCount('phrases', PHRASES, p => p.p), dueM = dueCount('mil', MIL, m => m.t);
  const totalDue = dueW + dueP + dueM;
  $('#nav-count-cards').textContent = totalDue ? totalDue : '';
  const days = streak();
  $('#streak-val').textContent = days + (days === 1 ? ' nap' : ' nap');
  const todayN = (S.log[today()] || [0, 0])[0];
  $('#streak-sub').textContent = todayN ? `Ma ${todayN} ismétlés` : (totalDue ? `${totalDue} esedékes vár` : 'Nincs esedékes ismétlés');
}
$$('.subtabs').forEach(bar => {
  const panel = bar.parentElement;
  const prefix = panel.id === 'panel-phrases' ? 'phr-' : 'mil-';
  $$('.subtab', bar).forEach(b => b.addEventListener('click', () => {
    $$('.subtab', bar).forEach(x => x.classList.toggle('active', x === b));
    $$('.sub-panel', panel).forEach(p => p.classList.toggle('active', p.id === prefix + b.dataset.sub));
  }));
});

// ============================================================
// SZAVAK
// ============================================================
const TAGS = Array.from(new Set(WORDS.map(w => w.tag)));
let wordTag = 'all';
(function initWordTags() {
  const c = $('#words-tags');
  c.innerHTML = ['all', ...TAGS].map(t => `<button class="chip${t === 'all' ? ' active' : ''}" data-tag="${t}">${t === 'all' ? 'mind' : esc(t)}</button>`).join('');
  c.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    wordTag = b.dataset.tag; $$('.chip', c).forEach(x => x.classList.toggle('active', x === b)); renderWords();
  });
})();
$('#words-search').addEventListener('input', renderWords);
$('#words-status').addEventListener('change', renderWords);

function wordMatches(w, q) {
  if (!q) return true;
  return norm(w.w).includes(q) || norm(w.hu).includes(q) || norm(w.en).includes(q) ||
    w.syn.some(s => norm(s).includes(q)) || (w.ant || []).some(s => norm(s).includes(q));
}
function renderWords() {
  const q = norm($('#words-search').value);
  const fs = $('#words-status').value;
  const list = WORDS.filter(w => (wordTag === 'all' || w.tag === wordTag) && wordMatches(w, q)).filter(w => {
    const st = stat('words', w.w);
    if (fs === 'all') return true;
    if (fs === 'due') return isDue(st);
    return status(st) === fs;
  });
  $('#words-count').textContent = `${list.length} szó`;
  $('#words-list').innerHTML = list.map(w => wordEntry(w)).join('');
}
function badgeFor(st) {
  if (isDue(st)) return '<span class="badge due">esedékes</span>';
  const s = status(st);
  return `<span class="badge ${s}">${s === 'new' ? 'új' : s === 'known' ? 'tudom' : 'tanulás · ' + st.box + '. doboz'}</span>`;
}
function wordEntry(w) {
  const st = stat('words', w.w);
  return `<div class="entry" data-w="${esc(w.w)}">
    <div class="entry-head">
      <span class="entry-word">${esc(w.w)}</span>
      <span class="entry-pos">${esc(w.pos)}</span>
      <span class="entry-ipa">${esc(w.ipa)}</span>
      ${speakBtn(w.w)}
      <span class="entry-hu">${esc(w.hu)}</span>
    </div>
    <div class="entry-body" hidden>
      <div class="entry-body-grid">
        <div>
          <div>${esc(w.en)}</div>
          <span class="lbl">Példa</span>
          <div class="ex">${esc(w.ex)} ${speakBtn(w.ex)}</div>
          ${w.ex_hu ? `<div class="ex-hu">${esc(w.ex_hu)}</div>` : ''}
        </div>
        <div>
          <span class="lbl">Szinonimák</span>
          <div class="row">${w.syn.map(s => `<span class="tag syn" data-speak="${esc(s)}">${esc(s)}</span>`).join('')}</div>
          ${w.ant && w.ant.length ? `<span class="lbl">Ellentét</span><div class="row">${w.ant.map(s => `<span class="tag ant">${esc(s)}</span>`).join('')}</div>` : ''}
          <span class="lbl">Kollokációk</span>
          <div class="row">${w.col.map(s => `<span class="tag col">${esc(s)}</span>`).join('')}</div>
        </div>
      </div>
      <div class="entry-actions">
        <button class="danger" data-grade="0">Újra</button>
        <button class="ok" data-grade="1">Tudom</button>
        <span class="tag">${esc(w.tag)}</span>
        ${badgeFor(st)}
      </div>
    </div>
  </div>`;
}
$('#words-list').addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const g = e.target.closest('[data-grade]');
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (g) { grade('words', entry.dataset.w, g.dataset.grade === '1'); toast(g.dataset.grade === '1' ? 'Feljebb léptetve' : 'Vissza az elejére'); renderWords(); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});

// ---------- Szavak jobb oldali panel ----------
function boxDistribution(store, items, keyOf) {
  const counts = [0, 0, 0, 0, 0, 0]; // 0: új/visszaesett, 1..5: doboz
  items.forEach(i => { const st = stat(store, keyOf(i)); counts[!st.seen || st.box === 0 ? 0 : Math.min(5, st.box)]++; });
  return counts;
}
function renderWordsAside() {
  const dueW = dueCount('words', WORDS, w => w.w), dueP = dueCount('phrases', PHRASES, p => p.p), dueM = dueCount('mil', MIL, m => m.t);
  const total = dueW + dueP + dueM;
  $('#due-total').textContent = total;
  const parts = [];
  if (dueW) parts.push(`${dueW} szó`); if (dueP) parts.push(`${dueP} frázis`); if (dueM) parts.push(`${dueM} katonai kifejezés`);
  $('#due-breakdown').textContent = parts.length ? parts.join(' · ') : 'nincs esedékes — gyakorolj újakat';
  $('#due-start').textContent = total ? 'Ismétlés indítása' : 'Új szavak gyakorlása';

  const counts = boxDistribution('words', WORDS, w => w.w);
  const max = Math.max(1, ...counts);
  const labels = ['új', '1', '2', '3', '4', '5'];
  const colors = ['var(--border-strong)', 'var(--warn)', 'var(--warn)', 'var(--warn)', 'var(--accent)', 'var(--accent)'];
  $('#box-chart').innerHTML = counts.map((c, i) => `<div class="box-col"><div class="bar" style="height:${Math.max(4, c / max * 56)}px;background:${colors[i]}"></div><span>${labels[i]}</span></div>`).join('');
  const known = counts[4] + counts[5], learning = counts[1] + counts[2] + counts[3];
  $('#box-legend').innerHTML = `<span>${counts[0]} új</span><span>${learning} tanulás</span><span style="color:var(--accent);font-weight:600">${known} tudom</span>`;
}
$('#due-start').addEventListener('click', () => {
  showTab('cards');
  setChipGroup('cards-source-chips', 'all'); $('#cards-pick').value = 'due';
  updateCardsAvail(); $('#cards-start').click();
});
$$('.quick-row').forEach(b => b.addEventListener('click', () => {
  const q = b.dataset.quick;
  if (q === 'cloze') { showTab('phrases'); $('#panel-phrases .subtab[data-sub="cloze"]').click(); $('#cloze-start').click(); }
  if (q === 'nato') { showTab('mil'); $('#panel-mil .subtab[data-sub="nato"]').click(); $('#nato-spell').click(); }
}));

// ============================================================
// FRÁZISOK — böngészés
// ============================================================
const TYPE_HU = { idiom: 'idióma', collocation: 'kollokáció', expression: 'kifejezés', phrasal: 'phrasal verb', latin: 'latin / francia', proverb: 'közmondás' };
const REG_HU = { formal: 'formális', informal: 'informális', neutral: 'semleges' };
$('#phr-search').addEventListener('input', renderPhrases);
$('#phr-type').addEventListener('change', renderPhrases);
function renderPhrases() {
  const q = norm($('#phr-search').value), t = $('#phr-type').value;
  const list = PHRASES.filter(p => (t === 'all' || p.type === t) && (!q || norm(p.p).includes(q) || norm(p.hu).includes(q) || norm(p.en).includes(q)));
  $('#phr-count').textContent = `${list.length} frázis`;
  $('#phr-list').innerHTML = list.map(p => {
    const st = stat('phrases', p.p);
    return `<div class="entry" data-p="${esc(p.p)}">
      <div class="entry-head">
        <span class="entry-word">${esc(p.p)}</span>
        ${speakBtn(p.p)}
        <span class="entry-hu">${esc(p.hu)}</span>
      </div>
      <div class="entry-body" hidden>
        <div>${esc(p.en)}</div>
        <span class="lbl">Példa</span>
        <div class="ex">${esc(p.ex)} ${speakBtn(p.ex)}</div>
        ${p.ex_hu ? `<div class="ex-hu">${esc(p.ex_hu)}</div>` : ''}
        <div class="entry-actions">
          <button class="danger" data-grade="0">Újra</button>
          <button class="ok" data-grade="1">Tudom</button>
          <span class="tag">${TYPE_HU[p.type]}</span><span class="tag">${REG_HU[p.reg]}</span>
          ${badgeFor(st)}
        </div>
      </div>
    </div>`;
  }).join('');
}
$('#phr-list').addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  const g = e.target.closest('[data-grade]');
  if (g) { grade('phrases', entry.dataset.p, g.dataset.grade === '1'); renderPhrases(); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});
renderPhrases();

// ============================================================
// KATONAI — szószedet
// ============================================================
const CATS = Array.from(new Set(MIL.map(m => m.cat)));
let milCat = 'all';
(function initMil() {
  const c = $('#mil-cats');
  c.innerHTML = ['all', ...CATS].map(t => `<button class="chip${t === 'all' ? ' active' : ''}" data-cat="${t}">${t === 'all' ? 'mind' : esc(t)}</button>`).join('');
  c.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    milCat = b.dataset.cat; $$('.chip', c).forEach(x => x.classList.toggle('active', x === b)); renderMil();
  });
  const sel = $('#milq-cat');
  CATS.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); });
  $('#nato-grid').innerHTML = NATO.map(([l, w]) => `<div class="nato-cell" data-speak="${w}"><b>${l}</b> ${w}</div>`).join('');
  $('#nato-grid').addEventListener('click', e => { const c = e.target.closest('[data-speak]'); if (c) speak(c.dataset.speak); });
})();
$('#mil-search').addEventListener('input', renderMil);
function renderMil() {
  const q = norm($('#mil-search').value);
  const list = MIL.filter(m => (milCat === 'all' || m.cat === milCat) && (!q || norm(m.t).includes(q) || norm(m.hu).includes(q) || norm(m.en).includes(q) || norm(m.abbr).includes(q)));
  $('#mil-count').textContent = `${list.length} kifejezés`;
  $('#mil-list').innerHTML = list.map(m => {
    const st = stat('mil', m.t);
    return `<div class="entry" data-t="${esc(m.t)}">
      <div class="entry-head">
        <span class="entry-word">${esc(m.t)}</span>
        ${m.abbr ? `<span class="entry-pos">${esc(m.abbr)}</span>` : ''}
        ${speakBtn(m.t)}
        <span class="entry-hu">${esc(m.hu)}</span>
      </div>
      <div class="entry-body" hidden>
        <div>${esc(m.en)}</div>
        <span class="lbl">Példa</span>
        <div class="ex">${esc(m.ex)} ${speakBtn(m.ex)}</div>
        ${m.ex_hu ? `<div class="ex-hu">${esc(m.ex_hu)}</div>` : ''}
        <div class="entry-actions">
          <button class="danger" data-grade="0">Újra</button>
          <button class="ok" data-grade="1">Tudom</button>
          <span class="tag">${esc(m.cat)}</span>
          ${badgeFor(st)}
        </div>
      </div>
    </div>`;
  }).join('');
}
$('#mil-list').addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  const g = e.target.closest('[data-grade]');
  if (g) { grade('mil', entry.dataset.t, g.dataset.grade === '1'); renderMil(); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});
renderMil();

// ============================================================
// VÁLSÁGÖVEZETEK — szóbeli vizsga 3. feladata
// ============================================================
let crisisMode = 'study';
$('#crisis-mode').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  crisisMode = b.dataset.mode; $$('.chip', $('#crisis-mode')).forEach(x => x.classList.toggle('active', x === b)); renderCrisis();
});

// ---------- Térkép (megosztott alap-SVG, országonkénti kivágás) ----------
// A forrás-útvonalaknak nincs saját fill/stroke attribútumuk, és a <use> által
// klónozott tartalomba a class-alapú CSS nem ér el megbízhatóan minden böngészőben —
// ezért a színt közvetlenül a #worldmap-base csoport attribútumaként állítjuk be.
let worldMapReady = false;
function initWorldMapDefs() {
  if (worldMapReady || !WM) return;
  worldMapReady = true;
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('id', 'worldmap-defs');
  holder.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = `<defs><g id="worldmap-base" stroke-linejoin="round">${WM.svg}</g></defs>`;
  document.body.appendChild(holder);
  updateWorldMapTheme();
}
function updateWorldMapTheme() {
  const base = document.getElementById('worldmap-base'); if (!base) return;
  const cs = getComputedStyle(document.documentElement);
  base.setAttribute('fill', (cs.getPropertyValue('--border-strong') || '#d9d0c2').trim());
  base.setAttribute('stroke', (cs.getPropertyValue('--panel') || '#fffdf9').trim());
  base.setAttribute('stroke-width', '0.6');
}
function cropViewBox(box) {
  const size = Math.max(box.width, box.height);
  const total = Math.max(size / 0.35, 70);
  const half = total / 2;
  return [box.cx - half, box.cy - half, total, total];
}
function crisisMiniMap(c) {
  if (!WM) return '';
  const box = WM.countries[c.mapKey]; if (!box) return '';
  const [x, y, w, h] = cropViewBox(box);
  const hl = WM.highlights[c.mapKey];
  const overlay = hl ? (hl.tag === 'g' ? `<g class="crisis-map-hl">${hl.d}</g>` : `<path class="crisis-map-hl" d="${hl.d}"></path>`)
    : (box.manual ? `<circle class="crisis-map-pin" cx="${box.cx}" cy="${box.cy}" r="3.4"></circle>` : '');
  return `<svg class="crisis-mini-map" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid meet"><use href="#worldmap-base"></use>${overlay}</svg>`;
}
function renderCrisisWorldMap() {
  const svg = $('#crisis-world-map');
  if (!WM || svg.dataset.built) return;
  svg.dataset.built = '1';
  const markers = CRISIS.map(c => {
    const box = WM.countries[c.mapKey]; if (!box) return '';
    return `<circle class="crisis-world-pin" data-id="${esc(c.id)}" cx="${box.cx}" cy="${box.cy}" r="5.5"><title>${esc(c.en)}</title></circle>`;
  }).join('');
  svg.innerHTML = `<use href="#worldmap-base"></use>${markers}`;
}
$('#crisis-world-map').addEventListener('click', e => {
  const pin = e.target.closest('.crisis-world-pin'); if (!pin) return;
  const entry = document.querySelector(`.crisis-entry[data-id="${pin.dataset.id}"]`); if (!entry) return;
  $('.entry-body', entry).hidden = false;
  entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function renderCrisis() {
  initWorldMapDefs();
  if (!CRISIS.length) { $('#crisis-list').innerHTML = '<p class="hint">Ez a modul még készül.</p>'; return; }
  const open = new Set($$('.crisis-entry', $('#crisis-list')).filter(el => !$('.entry-body', el).hidden).map(el => el.dataset.id));
  $('#crisis-list').innerHTML = CRISIS.map(c => `<div class="entry crisis-entry" data-id="${esc(c.id)}">
    <div class="entry-head crisis-head">
      ${crisisMiniMap(c)}
      <span class="crisis-title">${esc(c.en)}</span>
      ${speakBtn(c.en)}
      <span class="entry-hu">${esc(c.hu)}</span>
    </div>
    <div class="entry-body"${open.has(c.id) ? '' : ' hidden'}>
      <div class="crisis-asof">Állapot: ${esc(c.asOf)}</div>
      <div class="crisis-qa">${c.qa.map(qa => `
        <div class="crisis-q">${esc(qa.q)}</div>
        <div class="crisis-a${crisisMode === 'practice' ? ' hidden-answer' : ''}">${esc(qa.en)} ${speakBtn(qa.en)}</div>
        <div class="crisis-a-hu">${esc(qa.hu)}</div>
      `).join('')}</div>
      <div class="crisis-vocab">
        <span class="lbl">Kulcsszavak</span>
        <div class="row">${c.vocab.map(v => `<span class="tag syn" data-speak="${esc(v.en)}" title="${esc(v.hu)}">${esc(v.en)}</span>`).join('')}</div>
      </div>
      ${c.sources && c.sources.length ? `<div class="crisis-sources">Források: ${c.sources.map(esc).join(', ')}</div>` : ''}
    </div>
  </div>`).join('');
  renderCrisisWorldMap();
}
$('#crisis-list').addEventListener('click', e => {
  const hiddenA = e.target.closest('.crisis-a.hidden-answer'); if (hiddenA) { hiddenA.classList.remove('hidden-answer'); hiddenA.nextElementSibling.style.display = 'block'; return; }
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (e.target.closest('.crisis-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});

// ============================================================
// KÁRTYÁK (Leitner)
// ============================================================
function chipGroupValue(id) { const active = $(`#${id} .chip.active`); return active ? active.dataset.val : null; }
function setChipGroup(id, val) { $$(`#${id} .chip`).forEach(c => c.classList.toggle('active', c.dataset.val === val)); }
$('#cards-source-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; setChipGroup('cards-source-chips', b.dataset.val); updateCardsAvail(); });
$('#cards-dir-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; setChipGroup('cards-dir-chips', b.dataset.val); });

// Egységes kártya-nézet a három forrásra
function toCard(source, item) {
  if (source === 'words') return { key: item.w, store: 'words', front: item.w, meta: `${item.pos} · ${item.ipa}`, hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, syn: item.syn, ant: item.ant, col: item.col, speak: item.w };
  if (source === 'phrases') return { key: item.p, store: 'phrases', front: item.p, meta: TYPE_HU[item.type] + ' · ' + REG_HU[item.reg], hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, speak: item.p };
  return { key: item.t, store: 'mil', front: item.t, meta: item.cat + (item.abbr ? ' · ' + item.abbr : ''), hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, speak: item.t };
}
function sourceItems(src) { return src === 'words' ? WORDS : src === 'phrases' ? PHRASES : MIL; }
function allCards(src) {
  if (src === 'all') return ['words', 'phrases', 'mil'].flatMap(s => sourceItems(s).map(i => toCard(s, i)));
  return sourceItems(src).map(i => toCard(src, i));
}
function pickCards(src, pick) {
  const all = allCards(src);
  const withSt = all.map(c => ({ c, st: stat(c.store, c.key) }));
  let sel;
  if (pick === 'new') sel = withSt.filter(x => !x.st.seen);
  else if (pick === 'weak') sel = withSt.filter(x => x.st.seen && x.st.box <= 1);
  else if (pick === 'all') sel = withSt;
  else { // due + new: esedékesek elöl, aztán újak
    const due = shuffle(withSt.filter(x => isDue(x.st)));
    const nw = shuffle(withSt.filter(x => !x.st.seen));
    return due.concat(nw).map(x => x.c);
  }
  return shuffle(sel).map(x => x.c);
}
function updateCardsAvail() {
  const src = chipGroupValue('cards-source-chips'), pick = $('#cards-pick').value;
  const n = pickCards(src, pick).length;
  $('#cards-avail').textContent = `Elérhető kártyák: ${n}`;
}
$('#cards-pick').addEventListener('change', updateCardsAvail);

const drill = { cards: [], i: 0, dir: 'en', revealed: false, ok: 0, missed: [] };
$('#cards-start').addEventListener('click', () => {
  const src = chipGroupValue('cards-source-chips'), pick = $('#cards-pick').value, n = +$('#cards-n').value;
  const cards = pickCards(src, pick).slice(0, n);
  if (!cards.length) { toast('Nincs kártya ehhez a kiválasztáshoz'); return; }
  Object.assign(drill, { cards, i: 0, dir: chipGroupValue('cards-dir-chips'), revealed: false, ok: 0, missed: [] });
  $('#cards-setup').hidden = true; $('#cards-result').hidden = true; $('#cards-drill').hidden = false;
  showCard();
});
$('#cards-quit').addEventListener('click', endDrill);
$('#card-reveal').addEventListener('click', reveal);
$('#card-speak').addEventListener('click', () => speak(drill.cards[drill.i].speak));
$('#card-ok').addEventListener('click', () => answer(true));
$('#card-fail').addEventListener('click', () => answer(false));

function showCard() {
  const c = drill.cards[drill.i];
  const st = stat(c.store, c.key);
  $('#cards-progress').textContent = `${drill.i + 1} / ${drill.cards.length}`;
  $('#cards-bar').style.width = (drill.i / drill.cards.length * 100) + '%';
  $('#card-box').innerHTML = badgeFor(st);
  if (drill.dir === 'en') { $('#card-word').textContent = c.front; $('#card-meta').textContent = c.meta; }
  else { $('#card-word').textContent = c.hu; $('#card-meta').textContent = c.meta.split(' · ')[0]; }
  $('#card-back').hidden = true; $('#card-grade').hidden = true; $('#card-reveal').hidden = false;
  drill.revealed = false;
  if (drill.dir === 'en' && S.settings.speak) speak(c.speak);
}
function reveal() {
  if (drill.revealed) return;
  const c = drill.cards[drill.i];
  let h = drill.dir === 'en' ? `<div class="big-hu">${esc(c.hu)}</div>` : `<div class="big-hu">${esc(c.front)} <small style="color:var(--muted);font-weight:400">${esc(c.meta)}</small></div>`;
  h += `<div>${esc(c.en)}</div>`;
  if (c.syn) h += `<span class="lbl">Szinonimák</span><div class="row">${c.syn.map(s => `<span class="tag syn">${esc(s)}</span>`).join('')}</div>`;
  if (c.ant && c.ant.length) h += `<span class="lbl">Ellentét</span><div class="row">${c.ant.map(s => `<span class="tag ant">${esc(s)}</span>`).join('')}</div>`;
  h += `<span class="lbl">Példa</span><div class="ex">${esc(c.ex)}</div>${c.ex_hu ? `<div class="ex-hu">${esc(c.ex_hu)}</div>` : ''}`;
  if (c.col) h += `<span class="lbl">Kollokációk</span><div class="row">${c.col.map(s => `<span class="tag col">${esc(s)}</span>`).join('')}</div>`;
  $('#card-back').innerHTML = h; $('#card-back').hidden = false;
  $('#card-reveal').hidden = true; $('#card-grade').hidden = false;
  drill.revealed = true;
  if (drill.dir === 'hu' && S.settings.speak) speak(c.speak);
}
function answer(ok) {
  if (!drill.revealed) return;
  const c = drill.cards[drill.i];
  grade(c.store, c.key, ok);
  if (ok) drill.ok++; else drill.missed.push(c);
  drill.i++;
  if (drill.i >= drill.cards.length) endDrill(); else showCard();
}
function endDrill() {
  $('#cards-drill').hidden = true;
  const n = drill.i;
  if (!n) { $('#cards-setup').hidden = false; updateCardsAvail(); return; }
  const pct = Math.round(drill.ok / n * 100);
  $('#cards-result').innerHTML = `<div class="score">${pct}%</div><p>${drill.ok} / ${n} kártya ment elsőre.</p>
    ${drill.missed.length ? `<h3>Hibázott</h3><ul>${drill.missed.map(c => `<li><b>${esc(c.front)}</b> — ${esc(c.hu)}</li>`).join('')}</ul>` : '<p>Hibátlan! 🎉</p>'}
    <div class="row"><button class="primary" id="cards-again">Új kör</button>${drill.missed.length ? '<button id="cards-retry">Csak a hibásak</button>' : ''}</div>`;
  $('#cards-result').hidden = false;
  $('#cards-again').addEventListener('click', () => { $('#cards-result').hidden = true; $('#cards-setup').hidden = false; updateCardsAvail(); });
  const r = $('#cards-retry'); if (r) r.addEventListener('click', () => {
    Object.assign(drill, { cards: shuffle(drill.missed), i: 0, revealed: false, ok: 0, missed: [] });
    $('#cards-result').hidden = true; $('#cards-drill').hidden = false; showCard();
  });
}

// ============================================================
// Általános kvíz-motor (4 opciós vagy beírós)
// ============================================================
// q: { prompt(html), sub(html), options:[str], correct:idx, type?:'type', accept:[str], feedback(html), key, store, quizName }
function runQuiz(container, resultEl, questions, opts) {
  const state = { i: 0, ok: 0, missed: [], answered: false };
  container.hidden = false; resultEl.hidden = true;
  function render() {
    const q = questions[state.i];
    state.answered = false;
    let body;
    if (q.type === 'type') {
      body = `<div class="q-type"><input type="text" id="q-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Írd be angolul…"><button class="primary" id="q-check">Ellenőrzés</button></div>`;
    } else {
      body = `<div class="q-opts">${q.options.map((o, i) => `<button class="q-opt" data-i="${i}"><span class="n">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    }
    container.innerHTML = `<div class="q-head"><span>${state.i + 1} / ${questions.length}</span><div class="bar"><div class="bar-fill" style="width:${state.i / questions.length * 100}%"></div></div><span>Helyes: ${state.ok}</span><button class="icon-btn" id="q-quit" title="Kilépés">${CLOSE_SVG}</button></div>
      <div class="q-prompt">${q.prompt}${q.sub ? `<small>${q.sub}</small>` : ''}</div>${body}<div id="q-fb"></div>`;
    $('#q-quit', container).addEventListener('click', finish);
    if (q.type === 'type') {
      const inp = $('#q-input', container); inp.focus();
      $('#q-check', container).addEventListener('click', () => check(inp.value));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (state.answered) next(); else check(inp.value); } });
    } else {
      $$('.q-opt', container).forEach(b => b.addEventListener('click', () => check(+b.dataset.i)));
    }
    if (q.speak && S.settings.speak) speak(q.speak);
  }
  function check(val) {
    if (state.answered) return;
    const q = questions[state.i];
    let ok;
    if (q.type === 'type') {
      ok = q.accept.some(a => norm(a) === norm(val));
    } else {
      ok = val === q.correct;
      $$('.q-opt', container).forEach((b, i) => { b.disabled = true; if (i === q.correct) b.classList.add('correct'); else if (i === val) b.classList.add('wrong'); });
    }
    state.answered = true;
    if (ok) state.ok++; else state.missed.push(q);
    if (q.store && q.key) grade(q.store, q.key, ok);
    if (q.quizName) recordQuiz(q.quizName, ok);
    $('#q-fb', container).innerHTML = `<div class="q-feedback ${ok ? 'good' : 'bad'}"><b>${ok ? 'Helyes!' : 'Nem talált.'}</b> ${q.feedback || ''}</div><div class="q-next"><button class="primary" id="q-next">Tovább (Enter)</button></div>`;
    $('#q-next', container).addEventListener('click', next);
    $('#q-next', container).focus();
  }
  function next() { state.i++; if (state.i >= questions.length) finish(); else render(); }
  function finish() {
    container.hidden = true; container.innerHTML = ''; container._keys = null;
    const done = state.answered ? state.i + 1 : state.i;
    if (!done) { opts.onClose(); return; }
    resultEl.innerHTML = `<div class="score">${Math.round(state.ok / done * 100)}%</div><p>${state.ok} / ${done} helyes.</p>
      ${state.missed.length ? `<h3>Ezeket nézd át</h3><ul>${state.missed.map(q => `<li>${q.review}</li>`).join('')}</ul>` : '<p>Hibátlan! 🎉</p>'}
      <div class="row"><button class="primary" id="q-again">Új kör</button></div>`;
    resultEl.hidden = false;
    $('#q-again', resultEl).addEventListener('click', () => { resultEl.hidden = true; resultEl.innerHTML = ''; opts.onClose(); });
  }
  // billentyűk
  container._keys = e => {
    if (container.hidden) return;
    const q = questions[state.i];
    if (!q) return;
    if (q.type !== 'type' && !state.answered && /^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (i < q.options.length) check(i); }
    else if (e.key === 'Enter' && state.answered) { e.preventDefault(); next(); }
  };
  render();
}
// egyetlen globális key handler kvízekhez
const quizContainers = ['#cloze-quiz', '#meaning-quiz', '#milq-quiz', '#nato-quiz'].map(s => $(s));
document.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return; // a beírós kvíz inputja saját Enter-kezelővel bír
  quizContainers.forEach(c => { if (!c.hidden && c._keys) c._keys(e); });
  // kártya-drill billentyűk
  if (activeTab === 'cards' && !$('#cards-drill').hidden) {
    if (e.key === ' ') { e.preventDefault(); reveal(); }
    else if (e.key === 'j' || e.key === 'J') answer(true);
    else if (e.key === 'f' || e.key === 'F') answer(false);
    else if (e.key === 'h' || e.key === 'H') speak(drill.cards[drill.i].speak);
  }
});

// ============================================================
// FRÁZIS KVÍZEK
// ============================================================
function phraseReview(p) { return `<b>${esc(p.p)}</b> — ${esc(p.hu)}`; }
function phraseFeedback(p) { return `<span class="lbl">${esc(p.p)}</span>${esc(p.hu)} — ${esc(p.en)}<span class="lbl">Példa</span><i>${esc(p.ex)}</i>`; }
function clozeSentence(p) {
  const re = new RegExp('(' + p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
  const m = p.ex.match(re);
  if (!m) return null;
  return esc(p.ex.slice(0, m.index)) + '<span class="blank">_____</span>' + esc(p.ex.slice(m.index + m[0].length));
}
$('#cloze-start').addEventListener('click', () => {
  const allKeys = Array.from(new Set(PHRASES.map(p => p.key)));
  const qs = shuffle(PHRASES).slice(0, 15).map(p => {
    const sent = clozeSentence(p);
    const opts = shuffle([p.key, ...sample(allKeys, 3, new Set([p.key]))]);
    return { key: p.p, store: 'phrases', quizName: 'cloze', prompt: sent || esc(p.ex), sub: `${esc(p.hu)}`, options: opts, correct: opts.indexOf(p.key), feedback: phraseFeedback(p), review: phraseReview(p) };
  });
  $('#cloze-setup').hidden = true;
  runQuiz($('#cloze-quiz'), $('#cloze-result'), qs, { onClose: () => { $('#cloze-setup').hidden = false; } });
});
$('#meaning-start').addEventListener('click', () => {
  const qs = shuffle(PHRASES).slice(0, 15).map(p => {
    const others = sample(PHRASES.filter(x => x !== p), 3).map(x => x.en);
    const opts = shuffle([p.en, ...others]);
    return { key: p.p, store: 'phrases', quizName: 'meaning', prompt: esc(p.p), sub: TYPE_HU[p.type] + ' · mit jelent?', options: opts, correct: opts.indexOf(p.en), feedback: phraseFeedback(p), review: phraseReview(p), speak: p.p };
  });
  $('#meaning-setup').hidden = true;
  runQuiz($('#meaning-quiz'), $('#meaning-result'), qs, { onClose: () => { $('#meaning-setup').hidden = false; } });
});

// ============================================================
// KATONAI KVÍZ + NATO
// ============================================================
function milReview(m) { return `<b>${esc(m.t)}</b> — ${esc(m.hu)}`; }
function milFeedback(m) { return `<span class="lbl">${esc(m.t)}${m.abbr ? ' · ' + esc(m.abbr) : ''}</span>${esc(m.hu)} — ${esc(m.en)}<span class="lbl">Példa</span><i>${esc(m.ex)}</i>`; }
$('#milq-start').addEventListener('click', () => {
  const mode = $('#milq-mode').value, cat = $('#milq-cat').value;
  let pool = MIL.filter(m => cat === 'all' || m.cat === cat);
  if (mode === 'abbr') pool = MIL.filter(m => m.abbr);
  if (pool.length < 4) { toast('Túl kevés kifejezés ebben a kategóriában'); return; }
  const qs = shuffle(pool).slice(0, 15).map(m => {
    const base = { key: m.t, store: 'mil', quizName: 'milq', feedback: milFeedback(m), review: milReview(m) };
    const sameCat = pool.filter(x => x !== m && x.cat === m.cat);
    const distractPool = sameCat.length >= 3 ? sameCat : pool.filter(x => x !== m);
    if (mode === 'en2hu') {
      const opts = shuffle([m.hu, ...sample(distractPool, 3).map(x => x.hu)]);
      return Object.assign(base, { prompt: esc(m.t), sub: esc(m.cat) + ' · mit jelent?', options: opts, correct: opts.indexOf(m.hu), speak: m.t });
    }
    if (mode === 'hu2en') {
      const opts = shuffle([m.t, ...sample(distractPool, 3).map(x => x.t)]);
      return Object.assign(base, { prompt: esc(m.hu), sub: esc(m.cat) + ' · angolul?', options: opts, correct: opts.indexOf(m.t) });
    }
    if (mode === 'abbr') {
      const opts = shuffle([m.hu, ...sample(distractPool, 3).map(x => x.hu)]);
      return Object.assign(base, { prompt: esc(m.abbr.split(' / ')[0]), sub: 'rövidítés · mit jelent?', options: opts, correct: opts.indexOf(m.hu) });
    }
    const opts = shuffle([m.t, ...sample(distractPool, 3).map(x => x.t)]);
    return Object.assign(base, { prompt: esc(m.en), sub: esc(m.cat) + ' · melyik kifejezés?', options: opts, correct: opts.indexOf(m.t) });
  });
  $('#milq-setup').hidden = true;
  runQuiz($('#milq-quiz'), $('#milq-result'), qs, { onClose: () => { $('#milq-setup').hidden = false; } });
});

const NATO_WORDS = ['HUNGARY', 'BRIDGE', 'CONVOY', 'RADIO', 'TARGET', 'SECTOR', 'MEDIC', 'PATROL', 'SUPPLY', 'NORTH', 'ZULU', 'ECHO', 'DELTA', 'WHISKY', 'BUDAPEST', 'FLANK', 'GRID', 'MORTAR', 'RECON', 'OSCAR'];
const natoMap = Object.fromEntries(NATO);
$('#nato-spell').addEventListener('click', () => {
  const c = $('#nato-quiz'); c.hidden = false;
  const w = NATO_WORDS[Math.floor(Math.random() * NATO_WORDS.length)];
  const spelled = w.split('').map(l => natoMap[l]).join(' ');
  c.innerHTML = `<p class="hint">Betűzd ki hangosan, aztán fedd fel:</p><div class="nato-spell">${w}</div>
    <div class="nato-answer" id="nato-ans" hidden>${spelled} ${speakBtn(spelled, 'icon-btn')}</div>
    <div class="q-next" style="justify-content:center;gap:.5rem">
      <button class="primary" id="nato-reveal">Felfedés</button>
      <span id="nato-grade" hidden><button class="danger" data-ok="0">Hibáztam</button> <button class="ok" data-ok="1">Ment</button></span>
    </div>`;
  $('#nato-reveal', c).addEventListener('click', () => { $('#nato-ans', c).hidden = false; $('#nato-grade', c).hidden = false; $('#nato-reveal', c).hidden = true; speak(spelled); });
  c.onclick = e => {
    const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
    const g = e.target.closest('[data-ok]'); if (g) { recordQuiz('nato', g.dataset.ok === '1'); $('#nato-spell').click(); }
  };
  c._keys = null;
});
$('#nato-letter').addEventListener('click', () => {
  const c = $('#nato-quiz'); c.onclick = null;
  const qs = shuffle(NATO).slice(0, 10).map(([l, w]) => {
    const opts = shuffle([w, ...sample(NATO.map(x => x[1]), 3, new Set([w]))]);
    return { quizName: 'nato', prompt: l, sub: 'melyik a kódszó?', options: opts, correct: opts.indexOf(w), feedback: `<b>${l}</b> = ${w}`, review: `<b>${l}</b> — ${w}` };
  });
  // a NATO-kvíznek nincs külön result-doboza: a setup-ot használjuk
  const res = document.createElement('div'); res.className = 'result'; res.hidden = true;
  c.parentElement.appendChild(res);
  runQuiz(c, res, qs, { onClose: () => { res.remove(); } });
});

// ============================================================
// STATISZTIKA
// ============================================================
function counts(store, items, keyOf) {
  const c = { new: 0, learning: 0, known: 0, due: 0 };
  items.forEach(i => { const st = stat(store, keyOf(i)); c[status(st)]++; if (isDue(st)) c.due++; });
  return c;
}
function streak() {
  let n = 0; const d = new Date();
  for (;;) { const k = d.toISOString().slice(0, 10); if (S.log[k] && S.log[k][0] > 0) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
function tile(title, c, total) {
  const pct = k => (c[k] / total * 100) + '%';
  return `<div class="tile"><div class="t-title">${title}</div><div class="t-val">${c.known} <small style="font-size:.9rem;color:var(--muted)">/ ${total} tudom</small></div>
    <div class="t-sub">${c.learning} tanulás alatt · ${c.new} új · <b style="color:var(--danger)">${c.due} esedékes</b></div>
    <div class="mini"><span style="width:${pct('known')};background:var(--ok)"></span><span style="width:${pct('learning')};background:var(--warn)"></span></div></div>`;
}
function renderStats() {
  const cw = counts('words', WORDS, w => w.w), cp = counts('phrases', PHRASES, p => p.p), cm = counts('mil', MIL, m => m.t);
  const totalRev = Object.values(S.log).reduce((a, l) => a + l[0], 0);
  $('#stat-tiles').innerHTML = tile('C2 szavak', cw, WORDS.length) + tile('Frázisok', cp, PHRASES.length) + tile('Katonai', cm, MIL.length) +
    `<div class="tile"><div class="t-title">Sorozat</div><div class="t-val">${streak()} nap</div><div class="t-sub">${totalRev} ismétlés összesen</div></div>`;
  const names = { cloze: 'Hiányos mondat', meaning: 'Frázis jelentés', milq: 'Katonai kvíz', nato: 'NATO-ábécé' };
  $('#stat-quiz').innerHTML = `<table class="acc"><tr><th>Kvíz</th><th>Kérdés</th><th>Helyes</th><th>Pontosság</th></tr>` +
    Object.keys(names).map(k => { const q = S.quiz[k]; return `<tr><td>${names[k]}</td><td>${q[0]}</td><td>${q[1]}</td><td>${q[0] ? Math.round(q[1] / q[0] * 100) + '%' : '—'}</td></tr>`; }).join('') + '</table>';
  drawChart();
}
function drawChart() {
  const cv = $('#stat-chart'); if (!cv || activeTab !== 'stats') return;
  const cs = getComputedStyle(document.documentElement);
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 800, H = 160;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const days = []; const d = new Date();
  for (let i = 20; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); days.push(x.toISOString().slice(0, 10)); }
  const vals = days.map(k => S.log[k] || [0, 0]);
  const max = Math.max(5, ...vals.map(v => v[0]));
  const pad = 28, bw = (W - pad * 2) / days.length;
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  days.forEach((k, i) => {
    const [n, ok] = vals[i];
    const x = pad + i * bw + bw * .15, w = bw * .7;
    const h = (H - 30) * n / max, hOk = (H - 30) * ok / max;
    ctx.fillStyle = cs.getPropertyValue('--panel-2').trim(); ctx.fillRect(x, H - 20 - h, w, h);
    ctx.fillStyle = cs.getPropertyValue('--accent').trim(); ctx.fillRect(x, H - 20 - hOk, w, hOk);
    ctx.fillStyle = cs.getPropertyValue('--muted').trim();
    if (i % 5 === 0 || i === days.length - 1) ctx.fillText(k.slice(5), x + w / 2, H - 6);
    if (n) ctx.fillText(n, x + w / 2, H - 24 - h);
  });
}

// ---------- Export / import / wipe ----------
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `c2angol-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#btn-import').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const obj = JSON.parse(r.result); if (!obj.words) throw 0; localStorage.setItem(KEY, JSON.stringify(obj)); S = load(); toast('Import kész'); renderStats(); renderWords(); renderWordsAside(); updateSidebar(); }
    catch (err) { toast('Hibás fájl'); }
  };
  r.readAsText(f); e.target.value = '';
});
$('#btn-wipe').addEventListener('click', () => {
  if (!confirm('Biztosan törlöd az összes haladást?')) return;
  localStorage.removeItem(KEY); S = load(); applyTheme(); toast('Törölve'); renderStats(); renderWords(); renderWordsAside(); updateSidebar();
});

// ---------- Offline letöltés ----------
if (location.protocol !== 'file:') {
  const btn = $('#btn-download');
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      const [html, css, js, dataJs, crisisJs, worldJs] = await Promise.all(['index.html', 'style.css', 'app.js', 'data.js', 'crisis.js', 'worldmap.js'].map(f => fetch(f, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(f); return r.text(); })));
      const bundled = html
        .replace(/<link[^>]*href="style\.css"[^>]*>/, () => `<style>\n${css}\n</style>`)
        .replace(/<script[^>]*src="data\.js"[^>]*><\/script>/, () => `<script>\n${dataJs}\n<\/script>`)
        .replace(/<script[^>]*src="crisis\.js"[^>]*><\/script>/, () => `<script>\n${crisisJs}\n<\/script>`)
        .replace(/<script[^>]*src="worldmap\.js"[^>]*><\/script>/, () => `<script>\n${worldJs}\n<\/script>`)
        .replace(/<script[^>]*src="app\.js"[^>]*><\/script>/, () => `<script>\n${js}\n<\/script>`);
      const blob = new Blob([bundled], { type: 'text/html' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'c2-angol-offline.html'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Letöltve — nyisd meg bárhol, internet nélkül is működik');
    } catch (e) { toast('A letöltés nem sikerült'); }
  });
}

// ---------- Indulás ----------
renderWords();
renderWordsAside();
updateSidebar();
updateCardsAvail();
})();
