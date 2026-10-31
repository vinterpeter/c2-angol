/* C2 Angol — app.js (vanilla, offline) */
(function () {
'use strict';

const D = window.C2_DATA;
const NATO = D.NATO, CRISIS = D.CRISIS || [], WM = D.WORLD_MAP || null, MH = D.MILHU || {}, TOPICS = D.TOPICS || [];
// A szótár-tömbök az alapadatok + a felhasználó saját felvett elemei − a törölt elemek (lásd applyEdits).
const WORDS = [], PHRASES = [], VERBS = [], MIL = [], TVOC = [], LINK = [];
const STORES = ['words', 'phrases', 'verbs', 'linking', 'mil', 'topics'];
const ARR = { words: WORDS, phrases: PHRASES, verbs: VERBS, linking: LINK, mil: MIL, topics: TVOC };
const KEYF = { words: x => x.w, phrases: x => x.p, verbs: x => x.v, linking: x => x.t, mil: x => x.t, topics: x => x.t };
function topicVocab() {
  const seen = new Set(), out = [];
  TOPICS.forEach(tp => tp.questions.forEach(q => (q.vocab || []).forEach(v => {
    const k = v.en.toLowerCase(); if (seen.has(k)) return; seen.add(k);
    out.push({ t: v.en, hu: v.hu, ex: v.ex || '', ex_hu: '', en: '', topic: tp.id, topicHu: tp.hu });
  })));
  return out;
}
const BASE = { words: D.WORDS.slice(), phrases: D.PHRASES.slice(), verbs: (D.VERBS || []).slice(), linking: (D.LINKING || []).slice(), mil: D.MIL.slice(), topics: topicVocab() };
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
  words: {}, phrases: {}, mil: {}, verbs: {}, linking: {}, topics: {},
  custom: { words: [], phrases: [], verbs: [], linking: [], mil: [], topics: [] },   // saját felvett elemek
  hidden: { words: [], phrases: [], verbs: [], linking: [], mil: [], topics: [] },   // törölt alapelemek kulcsai
  quiz: { milq: [0, 0], nato: [0, 0] },
  log: {},          // 'YYYY-MM-DD' -> [reviews, correct]
  settings: { theme: 'auto', speak: true }
};
let S = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    const def = JSON.parse(JSON.stringify(DEFAULT));
    const s = Object.assign(def, obj);
    s.quiz = Object.assign({}, DEFAULT.quiz, obj.quiz || {});
    s.settings = Object.assign({}, DEFAULT.settings, obj.settings || {});
    s.custom = Object.assign(JSON.parse(JSON.stringify(DEFAULT.custom)), obj.custom || {});
    s.hidden = Object.assign(JSON.parse(JSON.stringify(DEFAULT.hidden)), obj.hidden || {});
    STORES.forEach(k => { s[k] = s[k] || {}; });
    s.log = obj.log || {};
    return s;
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* quota */ } }

// ---------- Saját lista: felvétel, törlés ----------
// A saját elem nyers alakja: { en, hu, def, ex, ex_hu, sec?, topic?, at }
function guessKey(term, ex) {
  if (!ex) return '';
  const toks = ex.match(/[A-Za-z'-]+/g) || [];
  for (const w of term.toLowerCase().split(/\s+/)) {
    const stem = w.replace(/^to$/, '').slice(0, Math.max(3, w.length - 2)); if (!stem) continue;
    const hit = toks.find(t => t.toLowerCase().startsWith(stem)); if (hit) return hit;
  }
  return '';
}
function normalizeOwn(store, c) {
  const base = { hu: c.hu || '', en: c.def || '', ex: c.ex || '', ex_hu: c.ex_hu || '', own: true };
  const syn = c.syn ? c.syn.split(',').map(x => x.trim()).filter(Boolean) : [];
  if (store === 'words') return Object.assign(base, { w: c.en, pos: c.pos || '', ipa: '', syn, ant: [], col: [], tag: 'saját' });
  if (store === 'phrases') return Object.assign(base, { p: c.en, type: 'phrasal', lvl: '', key: guessKey(c.en, c.ex), reg: 'neutral' });
  if (store === 'verbs') return Object.assign(base, { v: c.en.replace(/^to\s+/i, ''), forms: c.forms || '', syn, col: [], key: guessKey(c.en, c.ex) });
  if (store === 'linking') return Object.assign(base, { t: c.en, fn: 'own', fnHu: 'saját' });
  if (store === 'mil') return Object.assign(base, { t: c.en, cat: 'saját', sec: c.sec || 'szokincs', top: true });
  return Object.assign(base, { t: c.en, topic: c.topic || 'saját', topicHu: 'saját' });
}
function applyEdits(store) {
  const hid = new Set(S.hidden[store]), arr = ARR[store], kf = KEYF[store];
  arr.length = 0;
  BASE[store].forEach(x => { if (!hid.has(kf(x))) arr.push(x); });
  S.custom[store].forEach(c => arr.push(normalizeOwn(store, c)));
}
STORES.forEach(applyEdits);

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
let huVoice = null;
function pickHuVoice() { huVoice = speechSynthesis.getVoices().find(v => /^hu/i.test(v.lang)) || null; }
if ('speechSynthesis' in window) { pickVoice(); pickHuVoice(); speechSynthesis.onvoiceschanged = () => { pickVoice(); pickHuVoice(); }; }
// angol szöveg, utána (ha meg van adva) a magyar megfelelője magyar hanggal
function speak(text, hu) {
  if (!('speechSynthesis' in window) || !text) return;
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB'; if (voice) u.voice = voice; u.rate = 0.92;
  speechSynthesis.speak(u);
  if (hu) { const h = new SpeechSynthesisUtterance(hu); h.lang = 'hu-HU'; if (huVoice) h.voice = huVoice; h.rate = 0.95; speechSynthesis.speak(h); }
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
  S.settings.theme = dark ? 'light' : 'dark'; save(); applyTheme();
});
applyTheme();

// ---------- Fülek ----------
let activeTab = 'words';
$$('#tabs .tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  activeTab = name;
  $$('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  if (name === 'words') { renderWords(); }
  if (name === 'cards') updateCardsAvail();
  if (name === 'crisis') renderCrisis();
  if (name === 'topics') renderTopics();
  window.scrollTo(0, 0);
}

// ---------- Oldalsáv: számlálók, sorozat ----------
function streak() {
  let n = 0; const d = new Date();
  for (;;) { const k = d.toISOString().slice(0, 10); if (S.log[k] && S.log[k][0] > 0) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
function dueCount(store, items, keyOf) { return items.reduce((n, i) => n + (isDue(stat(store, keyOf(i))) ? 1 : 0), 0); }
function updateSidebar() {
  $('#nav-count-words').textContent = WORDS.length;
  $('#nav-count-phrases').textContent = PHRASES.filter(p => p.type === 'phrasal').length;
  $('#nav-count-mil').textContent = MIL.length;
  $('#nav-count-verbs').textContent = VERBS.length;
  $('#nav-count-topics').textContent = TOPICS.length || '';
  $('#nav-count-linking').textContent = LINK.length || '';
  const totalDue = STORES.reduce((n, st) => n + dueCount(st, ARR[st], KEYF[st]), 0);
  $('#nav-count-cards').textContent = totalDue ? totalDue : '';
  const days = streak();
  $('#streak-val').textContent = days + (days === 1 ? ' nap' : ' nap');
  const todayN = (S.log[today()] || [0, 0])[0];
  $('#streak-sub').textContent = todayN ? `Ma ${todayN} ismétlés` : (totalDue ? `${totalDue} esedékes vár` : 'Nincs esedékes ismétlés');
}

// ============================================================
// SZAVAK
// ============================================================
let wordTag = 'all';
function buildWordTags() {
  const tags = Array.from(new Set(WORDS.map(w => w.tag)));
  if (wordTag !== 'all' && !tags.includes(wordTag)) wordTag = 'all';
  $('#words-tags').innerHTML = ['all', ...tags].map(t => `<button class="chip${t === wordTag ? ' active' : ''}" data-tag="${esc(t)}">${t === 'all' ? 'mind' : esc(t)}</button>`).join('');
  const sel = $('#wd-tag-select'), cur = sel.value;
  sel.innerHTML = '<option value="all">Minden témakör</option>' + tags.map(t => `<option>${esc(t)}</option>`).join('');
  sel.value = tags.includes(cur) ? cur : 'all';
}
$('#words-tags').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  wordTag = b.dataset.tag; $$('.chip', $('#words-tags')).forEach(x => x.classList.toggle('active', x === b)); renderWords();
});
$('#wd-tag-select').addEventListener('change', () => wdUpdateCount());
buildWordTags();
$('#words-search').addEventListener('input', renderWords);
$('#words-status').addEventListener('change', renderWords);

function wordMatches(w, q) {
  if (!q) return true;
  return norm(w.w).includes(q) || norm(w.hu).includes(q) || norm(w.en).includes(q) ||
    (w.syn || []).some(s => norm(s).includes(q)) || (w.ant || []).some(s => norm(s).includes(q));
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
          ${w.syn && w.syn.length ? `<span class="lbl">Szinonimák</span>
          <div class="row">${w.syn.map(s => `<span class="tag syn" data-speak="${esc(s)}">${esc(s)}</span>`).join('')}</div>` : ''}
          ${w.ant && w.ant.length ? `<span class="lbl">Ellentét</span><div class="row">${w.ant.map(s => `<span class="tag ant">${esc(s)}</span>`).join('')}</div>` : ''}
          ${w.col && w.col.length ? `<span class="lbl">Kollokációk</span>
          <div class="row">${w.col.map(s => `<span class="tag col">${esc(s)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="entry-actions">
        <button class="danger" data-grade="0">Újra</button>
        <button class="ok" data-grade="1">Tudom</button>
        <span class="tag">${esc(w.tag)}</span>
        ${badgeFor(st)}
        ${delBtn()}
      </div>
    </div>
  </div>`;
}
$('#words-list').addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const g = e.target.closest('[data-grade]');
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (e.target.closest('[data-del]')) { deleteItem('words', entry.dataset.w); return; }
  if (g) { grade('words', entry.dataset.w, g.dataset.grade === '1'); toast(g.dataset.grade === '1' ? 'Feljebb léptetve' : 'Vissza az elejére'); renderWords(); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});

function boxDistribution(store, items, keyOf) {
  const counts = [0, 0, 0, 0, 0, 0];
  items.forEach(i => { const st = stat(store, keyOf(i)); counts[!st.seen || st.box === 0 ? 0 : Math.min(5, st.box)]++; });
  return counts;
}

// ============================================================
// SZAVAK — QUIZLET MÓD
// ============================================================
function wdBatchCards() {
  const tag = $('#wd-tag-select').value;
  const chip = $('#wd-batch-chips .chip.active') || $('#wd-batch-chips .chip');
  const n = chip.dataset.val;
  const base = tag === 'all' ? WORDS : WORDS.filter(w => w.tag === tag);
  return n === 'all' ? base : base.slice(0, parseInt(n));
}
function wdUpdateCount() { $('#wd-count').textContent = wdBatchCards().length; }
wdUpdateCount();

$('#wd-dir-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#wd-dir-chips .chip').forEach(x => x.classList.toggle('active', x === b));
});
$('#wd-batch-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#wd-batch-chips .chip').forEach(x => x.classList.toggle('active', x === b));
  wdUpdateCount();
});

const wd = { cards: [], i: 0, dir: 'en', flipped: false, round: 1, total: 0, learned: 0, missed: [] };

$('#wd-start').addEventListener('click', () => {
  const active = $('#wd-dir-chips .chip.active');
  wd.dir = active ? active.dataset.val : 'en';
  const batch = wdBatchCards();
  wd.cards = shuffle(batch); wd.i = 0; wd.round = 1; wd.total = batch.length; wd.learned = 0; wd.missed = [];
  $('#wd-setup').hidden = true; $('#wd-result').hidden = true; $('#wd-drill').hidden = false;
  wdShowCard();
});

$('#wd-card').addEventListener('click', wdFlip);
$('#wd-quit').addEventListener('click', wdEnd);
$('#wd-speak').addEventListener('click', () => { if (wd.cards[wd.i]) speak(wd.cards[wd.i].w); });
$('#wd-ok').addEventListener('click', () => wdGrade(true));
$('#wd-fail').addEventListener('click', () => wdGrade(false));

function wdShowCard() {
  const w = wd.cards[wd.i];
  wd.flipped = false;
  $('#wd-card').classList.remove('flipped');
  $('#wd-actions').hidden = true;
  $('#wd-progress').textContent = `${wd.learned} / ${wd.total} megtanult`;
  $('#wd-bar').style.width = (wd.learned / wd.total * 100) + '%';
  $('#wd-round').textContent = wd.round > 1 ? `${wd.round}. kör` : '';
  $$('.pv-flip-hint', $('#wd-drill')).forEach(el => el.textContent = `${wd.i + 1} / ${wd.cards.length} · kattints a megfordításhoz`);
  if (wd.dir === 'en') {
    $('#wd-front-word').textContent = w.w;
    $('#wd-front-ex').textContent = w.ex || '';
    $('#wd-back-main').textContent = w.hu;
    $('#wd-back-def').textContent = w.en;
    $('#wd-back-ex').textContent = w.ex || '';
    $('#wd-back-exhu').textContent = w.ex_hu || '';
    if (S.settings.speak) speak(w.w);
  } else {
    $('#wd-front-word').textContent = w.hu;
    $('#wd-front-ex').textContent = '';
    $('#wd-back-main').textContent = w.w;
    $('#wd-back-def').textContent = w.en;
    $('#wd-back-ex').textContent = w.ex || '';
    $('#wd-back-exhu').textContent = w.ex_hu || '';
  }
}

function wdFlip() {
  if (wd.flipped) return;
  wd.flipped = true;
  $('#wd-card').classList.add('flipped');
  $('#wd-actions').hidden = false;
  if (wd.dir === 'hu' && S.settings.speak) speak(wd.cards[wd.i].w);
}

function wdGrade(ok) {
  if (!wd.flipped) return;
  const w = wd.cards[wd.i];
  grade('words', w.w, ok);
  if (ok) wd.learned++; else wd.missed.push(w);
  wd.i++;
  if (wd.i >= wd.cards.length) wdRoundEnd(); else wdShowCard();
}

function wdRoundEnd() {
  if (wd.missed.length === 0) {
    wdFinalResult();
  } else {
    wd.round++; wd.cards = shuffle(wd.missed); wd.i = 0; wd.missed = [];
    wdShowCard();
  }
}

function wdFinalResult() {
  $('#wd-drill').hidden = true;
  if (!wd.total) { $('#wd-setup').hidden = false; return; }
  const roundText = wd.round === 1 ? 'Első körre megtanultad mind!' : `${wd.round} kör alatt megtanultad mind!`;
  $('#wd-result').innerHTML = `<div class="score">🎉</div><p><b>${roundText}</b></p><p class="hint">${wd.total} szó · ${wd.round} kör</p><div class="row"><button class="primary" id="wd-again">Új kör</button></div>`;
  $('#wd-result').hidden = false;
  $('#wd-again').addEventListener('click', () => { $('#wd-result').hidden = true; $('#wd-setup').hidden = false; wdUpdateCount(); });
}

function wdEnd() {
  $('#wd-drill').hidden = true;
  if (!wd.total) { $('#wd-setup').hidden = false; return; }
  const done = wd.learned, rem = wd.total - done;
  $('#wd-result').innerHTML = `<div class="score">${Math.round(done / wd.total * 100)}%</div><p>${done} megtanult · ${rem} maradt</p><div class="row"><button class="primary" id="wd-again">Újrakezd</button></div>`;
  $('#wd-result').hidden = false;
  $('#wd-again').addEventListener('click', () => { $('#wd-result').hidden = true; $('#wd-setup').hidden = false; wdUpdateCount(); });
}

// ============================================================
// FRÁZISOK — típus és regiszter szótár (Kártyákhoz is kell)
// ============================================================
const TYPE_HU = { idiom: 'idióma', collocation: 'kollokáció', expression: 'kifejezés', phrasal: 'phrasal verb', latin: 'latin / francia', proverb: 'közmondás' };
const REG_HU = { formal: 'formális', informal: 'informális', neutral: 'semleges' };

// ============================================================
// KATONAI — szekciók (felépítés, haderőnemek, fegyverek, szókincs, NATO)
// ============================================================
const MIL_SECS = { szerv: 'Felépítés, szervezetek', haderonem: 'Haderőnemek, fegyvernemek', fegyver: 'Gépkarabély, pisztoly', szokincs: 'Leggyakoribb kifejezések', szak: 'Szakszókincs témák szerint' };
// egy tétel több részben is szerepelhet (secs); a „Leggyakoribb” rész a top-jelölésű tételeket mutatja
function inSec(m, sec) { return sec === 'szokincs' ? !!(m.top || (m.own && m.sec === 'szokincs')) : (m.secs || [m.sec || 'szak']).includes(sec) || (m.own && m.sec === sec); }
let milSec = 'szerv', milCat = 'all';
function milSecItems() {
  return MIL.filter(m => inSec(m, milSec));
}
function buildMilCats() {
  const cats = Array.from(new Set(milSecItems().map(m => m.cat)));
  if (milCat !== 'all' && !cats.includes(milCat)) milCat = 'all';
  $('#mil-cats').innerHTML = cats.length > 1 ? ['all', ...cats].map(t => `<button class="chip${t === milCat ? ' active' : ''}" data-cat="${esc(t)}">${t === 'all' ? 'mind' : esc(t)}</button>`).join('') : '';
  const opts = '<option value="all">Minden kategória</option>' + cats.map(t => `<option>${esc(t)}</option>`).join('');
  $('#ml-cat-select').innerHTML = opts; $('#milq-cat').innerHTML = opts;
}
$('#mil-cats').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  milCat = b.dataset.cat; $$('.chip', $('#mil-cats')).forEach(x => x.classList.toggle('active', x === b)); renderMil();
});
$('#mil-sec-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setMilSec(b.dataset.sec); });
$('#ml-cat-select').addEventListener('change', () => mlUpdateCount());
function setMilSec(sec) {
  milSec = sec; milCat = 'all';
  $$('#mil-sec-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.sec === sec));
  $('#mil-nato').hidden = sec !== 'nato';
  $('#mil-learn').hidden = sec === 'nato';
  $('#mil-learn-title').textContent = sec === 'nato' ? '' : `Gyakorlás kártyákkal — ${MIL_SECS[sec]}`;
  renderMilOverview();
  if (sec !== 'nato') { buildMilCats(); renderMil(); mlUpdateCount(); }
}
function milRefresh() { if (milSec !== 'nato') { buildMilCats(); renderMil(); mlUpdateCount(); } }

// ---------- Áttekintő nézetek ----------
function renderMilOverview() {
  const box = $('#mil-overview');
  if (milSec === 'szerv') box.innerHTML = ovOrg();
  else if (milSec === 'haderonem') box.innerHTML = ovServices();
  else if (milSec === 'fegyver') box.innerHTML = ovWeapons();
  else if (milSec === 'szokincs') box.innerHTML = `<p class="hint">A szóbeli vizsgán leggyakrabban használt katonai szavak és kifejezések: szolgálat, kiképzés, műveletek, NATO-együttműködés, katasztrófavédelem, rádióforgalmazás. Mindegyikhez példamondat és fordítás tartozik.</p>`;
  else if (milSec === 'szak') box.innerHTML = `<p class="hint">A teljes katonai szakszókincs témakörök szerint: egység, művelet, harcászat, fegyver, híradás, logisztika, vezénylés, rövidítések, parancsformátum, kiképzés, egészségügy, navigáció és a többi. Válassz témakört a chipekkel.</p>`;
  else box.innerHTML = '';
}
function asOfNote() { return MH.asOf ? `<p class="ov-asof">Állapot: ${esc(MH.asOf)}. Az alakulatnevek és a vezetők változhatnak; vizsga előtt érdemes a honvedelem.hu oldalon ellenőrizni.</p>` : ''; }
function ovOrg() {
  if (!MH.structure) return '';
  const chain = MH.structure.map((n, i) => `<div class="chain-node"><div class="chain-hu">${esc(n.hu)}</div><div class="chain-en">${esc(n.en)} ${speakBtn(n.en)}</div><p>${esc(n.d_hu)}</p><p class="chain-den">${esc(n.d_en)}</p></div>${i < MH.structure.length - 1 ? '<div class="chain-arrow" aria-hidden="true">↓</div>' : ''}`).join('');
  const ech = `<table class="acc ov-table"><tr><th>Magyarul</th><th>Angolul</th><th>Létszám</th><th>Parancsnok</th></tr>${MH.echelons.map(e => `<tr><td><b>${esc(e.hu)}</b></td><td>${esc(e.t)} ${speakBtn(e.t)}</td><td>${esc(e.size)}</td><td>${esc(e.cmd_hu)}<br><small>${esc(e.cmd_en)}</small></td></tr>`).join('')}</table>`;
  const units = MH.unitGroups.map(g => `<h5 class="unit-grp">${esc(g.hu)} <small>${esc(g.en)}</small></h5><ul class="unit-list">${MH.units.filter(u => u.g === g.id).map(u => `<li><b>${esc(u.hu)}</b>${u.city ? ` <span class="unit-city">${esc(u.city)}</span>` : ''}<br><span class="unit-en">${esc(u.en)}</span>${u.note ? ` <span class="unit-note">· ${esc(u.note)}</span>` : ''}</li>`).join('')}</ul>`).join('');
  return `<p class="hint">Ki irányítja a honvédséget, és hogyan épül fel a vezetési lánc felülről lefelé.</p><div class="chain">${chain}</div>
    <h4 class="grp-title">Egységszintek <small>Echelons — from squad to corps</small></h4>${ech}
    <h4 class="grp-title">Fontosabb alakulatok <small>Main units — nevek 2026. szeptember 1-jétől</small></h4>${units}${asOfNote()}`;
}
function ovServices() {
  if (!MH.services) return '';
  return `<p class="hint">A haderőnem (service) a fegyveres erők nagy ága, a fegyvernem (arm / branch) ezen belül a szakterület. Magyarországnak nincs haditengerészete, a Dunán folyami flottilla működik.</p>
    <div class="svc-grid">${MH.services.map(v => `<div class="svc-card"><div class="svc-hu">${esc(v.hu)}</div><div class="svc-en">${esc(v.t)}${v.abbr ? ' (' + esc(v.abbr) + ')' : ''} ${speakBtn(v.t)}</div><p>${esc(v.d_hu)}</p><p class="chain-den">${esc(v.d_en)}</p></div>`).join('')}</div>
    <h4 class="grp-title">Fegyvernemek <small>Arms and branches</small></h4>
    <table class="acc ov-table"><tr><th>Magyarul</th><th>Angolul</th><th>Mivel foglalkozik?</th></tr>${MH.branches.map(b => `<tr><td><b>${esc(b.hu)}</b></td><td>${esc(b.t)} ${speakBtn(b.t)}</td><td>${esc(b.d_hu)}</td></tr>`).join('')}</table>`;
}
function ovWeapons() {
  const parts = cat => MIL.filter(m => inSec(m, 'fegyver') && m.cat === cat && m.part);
  const legend = cat => `<ol class="parts-legend">${parts(cat).map(m => `<li data-part="${esc(m.part)}" data-speak="${esc(m.t)}" data-hu="${esc(m.hu)}"><b>${esc(m.hu)}</b> — ${esc(m.t)}</li>`).join('')}</ol>`;
  const fig = (svg, title, sub, cat) => `<figure class="weapon-fig"><figcaption><b>${title}</b> <small>${sub}</small></figcaption><div class="weapon-svg" data-cat="${cat}">${svg || ''}</div>${legend(cat)}</figure>`;
  return `<p class="hint">A Magyar Honvédség jelenlegi egyéni fegyverei. Az ábrák sematikusak; mutass rá egy számra vagy részre, és kiemeli a párját; kattintásra kimondja az angol, majd a magyar nevét. A belső alkatrészek (zár, ütőszeg, helyretoló rugó stb.) a lenti kártyalistában vannak.</p>
    <div class="weapon-facts">
      <div><b>CZ BREN 2 gépkarabély</b> · 5,56×45 mm NATO · gázelvételes, rövid löketű gázdugattyú, forgózáras · alumínium felső tok, polimer alsó tok · állítható, oldalra csukható válltámasz · 30 töltényes tár · hazai gyártás Kiskunfélegyházán. Elődje az AMD-65 / AK-63 gépkarabély.</div>
      <div><b>CZ P-10 C pisztoly</b> · 9×19 mm · ütőszeges (striker-fired) · polimer markolatváz, cserélhető markolathát · 15 töltényes tár · elsütőbillentyű-biztosító. Elődje a FÉG P9R pisztoly.</div>
    </div>
    ${fig(MH.rifleSvg, 'CZ BREN 2', 'assault rifle · gépkarabély', 'gépkarabély')}
    ${fig(MH.pistolSvg, 'CZ P-10 C', 'pistol · pisztoly', 'pisztoly')}`;
}
$('#mil-overview').addEventListener('click', e => {
  const part = e.target.closest('[data-part]');
  if (part) {   // ábra vagy jelmagyarázat: angol, majd magyar név
    const fig = part.closest('.weapon-fig');
    const li = fig && [...fig.querySelectorAll('li[data-part]')].find(x => x.dataset.part === part.dataset.part);
    if (li) speak(li.dataset.speak, li.dataset.hu);
    highlightPart(fig, part.dataset.part);
    return;
  }
  const sp = e.target.closest('[data-speak]'); if (sp) speak(sp.dataset.speak);
});
$('#mil-overview').addEventListener('mouseover', e => {
  const part = e.target.closest('[data-part]'); if (part) highlightPart(part.closest('.weapon-fig'), part.dataset.part);
});
function highlightPart(fig, id) {
  if (!fig) return;
  $$('[data-part]', fig).forEach(el => el.classList.toggle('hl', el.dataset.part === id));
}

// ---------- Kártyalista ----------
$('#mil-search').addEventListener('input', renderMil);
function renderMil() {
  const q = norm($('#mil-search').value);
  const list = milSecItems().filter(m => (milCat === 'all' || m.cat === milCat) && (!q || norm(m.t).includes(q) || norm(m.hu).includes(q) || norm(m.en || '').includes(q) || norm(m.abbr || '').includes(q)));
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
        ${m.ex ? `<span class="lbl">Példa</span>
        <div class="ex">${esc(m.ex)} ${speakBtn(m.ex)}</div>` : ''}
        ${m.ex_hu ? `<div class="ex-hu">${esc(m.ex_hu)}</div>` : ''}
        <div class="entry-actions">
          <button class="danger" data-grade="0">Újra</button>
          <button class="ok" data-grade="1">Tudom</button>
          <span class="tag">${esc(m.cat)}</span>
          ${badgeFor(st)}
          ${delBtn()}
        </div>
      </div>
    </div>`;
  }).join('');
}
$('#mil-list').addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (e.target.closest('[data-del]')) { deleteItem('mil', entry.dataset.t); return; }
  const g = e.target.closest('[data-grade]');
  if (g) { grade('mil', entry.dataset.t, g.dataset.grade === '1'); renderMil(); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});
$('#nato-grid').innerHTML = NATO.map(([l, w]) => `<div class="nato-cell" data-speak="${w}"><b>${l}</b> ${w}</div>`).join('');
$('#nato-grid').addEventListener('click', e => { const c = e.target.closest('[data-speak]'); if (c) speak(c.dataset.speak); });

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
  if (source === 'words') return { key: item.w, store: 'words', front: item.w, meta: [item.pos, item.ipa].filter(Boolean).join(' · '), hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, syn: item.syn && item.syn.length ? item.syn : null, ant: item.ant, col: item.col && item.col.length ? item.col : null, speak: item.w };
  if (source === 'phrases') return { key: item.p, store: 'phrases', front: item.p, meta: [TYPE_HU[item.type], REG_HU[item.reg]].filter(Boolean).join(' · '), hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, speak: item.p };
  if (source === 'verbs') return { key: item.v, store: 'verbs', front: (item.pos === 'phrase' ? '' : 'to ') + item.v, meta: item.forms || 'ige', hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, syn: item.syn && item.syn.length ? item.syn : null, col: item.col && item.col.length ? item.col : null, speak: item.v };
  if (source === 'linking') return { key: item.t, store: 'linking', front: item.t, meta: item.fnHu || 'átvezető', hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, speak: item.t };
  if (source === 'topics') return { key: item.t, store: 'topics', front: item.t, meta: item.topicHu || 'szóbeli téma', hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, speak: item.t };
  return { key: item.t, store: 'mil', front: item.t, meta: item.cat + (item.abbr ? ' · ' + item.abbr : ''), hu: item.hu, en: item.en, ex: item.ex, ex_hu: item.ex_hu, speak: item.t };
}
function sourceItems(src) { return ARR[src] || MIL; }
function allCards(src) {
  if (src === 'all') return STORES.flatMap(s => sourceItems(s).map(i => toCard(s, i)));
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
const quizContainers = ['#milq-quiz', '#nato-quiz'].map(s => $(s));
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
  // szavak quizlet billentyűk
  if (activeTab === 'words' && !$('#wd-drill').hidden) {
    if (e.key === ' ') { e.preventDefault(); wdFlip(); }
    else if (e.key === 'j' || e.key === 'J') wdGrade(true);
    else if (e.key === 'f' || e.key === 'F') wdGrade(false);
    else if ((e.key === 'h' || e.key === 'H') && wd.cards[wd.i]) speak(wd.cards[wd.i].w);
  }
  // phrasal verb quizlet billentyűk
  if (activeTab === 'phrases' && !$('#pv-drill').hidden) {
    if (e.key === ' ') { e.preventDefault(); pvFlip(); }
    else if (e.key === 'j' || e.key === 'J') pvGrade(true);
    else if (e.key === 'f' || e.key === 'F') pvGrade(false);
    else if ((e.key === 'h' || e.key === 'H') && pv.cards[pv.i]) speak(pv.cards[pv.i].p);
  }
  // közös quizlet-motor (Igék, Átvezetők, Szóbeli témák)
  LEARNERS.forEach(l => {
    if (activeTab !== l.tab || !l.active()) return;
    if (e.key === ' ') { e.preventDefault(); l.flip(); }
    else if (e.key === 'j' || e.key === 'J') l.gradeCur(true);
    else if (e.key === 'f' || e.key === 'F') l.gradeCur(false);
    else if (e.key === 'h' || e.key === 'H') l.speakCur();
  });
  // katonai quizlet billentyűk
  if (activeTab === 'mil' && !$('#ml-drill').hidden) {
    if (e.key === ' ') { e.preventDefault(); mlFlip(); }
    else if (e.key === 'j' || e.key === 'J') mlGrade(true);
    else if (e.key === 'f' || e.key === 'F') mlGrade(false);
    else if ((e.key === 'h' || e.key === 'H') && ml.cards[ml.i]) speak(ml.cards[ml.i].t);
  }
});

// ============================================================
// PHRASAL VERB QUIZLET MÓD
// ============================================================
const PHRASAL = [];
function rebuildPhrasal() { PHRASAL.length = 0; PHRASES.forEach(p => { if (p.type === 'phrasal') PHRASAL.push(p); }); }
rebuildPhrasal();
function pvSource() {
  const src = chipGroupValue('pv-src-chips') || 'all';
  return src === 'jegyzet' ? PHRASAL.filter(p => p.src === 'jegyzet') : src === 'own' ? PHRASAL.filter(p => p.own) : PHRASAL;
}
// 10-es tömb-chipek a kiválasztott forrás hosszához igazítva
function buildBatchChips(id, n) {
  const box = $('#' + id), cur = box.querySelector('.chip.active');
  const curFrom = cur ? cur.dataset.from : '0', curTo = cur ? cur.dataset.to : '10';
  let h = '';
  for (let f = 0; f < n; f += 10) { const t = Math.min(n, f + 10); h += `<button class="chip" data-from="${f}" data-to="${t}">${f + 1}–${t}</button>`; }
  h += `<button class="chip" data-from="0" data-to="all">Összes</button>`;
  box.innerHTML = h;
  const keep = box.querySelector(`.chip[data-from="${curFrom}"][data-to="${curTo}"]`) || box.querySelector('.chip');
  if (keep) keep.classList.add('active');
}
function batchSlice(id, list) {
  const chip = $('#' + id + ' .chip.active') || $('#' + id + ' .chip');
  if (!chip) return list;
  const from = parseInt(chip.dataset.from) || 0;
  return chip.dataset.to === 'all' ? list : list.slice(from, parseInt(chip.dataset.to));
}
function pvBatchCards() { return batchSlice('pv-batch-chips', pvSource()); }
function pvUpdateCount() { $('#pv-count').textContent = pvBatchCards().length; }
function pvRefresh() { rebuildPhrasal(); buildBatchChips('pv-batch-chips', pvSource().length); pvUpdateCount(); renderPVList(); }
$('#pv-src-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  setChipGroup('pv-src-chips', b.dataset.val); buildBatchChips('pv-batch-chips', pvSource().length); pvUpdateCount(); renderPVList();
});
buildBatchChips('pv-batch-chips', pvSource().length);
pvUpdateCount();

$('#pv-dir-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#pv-dir-chips .chip').forEach(x => x.classList.toggle('active', x === b));
});
$('#pv-batch-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#pv-batch-chips .chip').forEach(x => x.classList.toggle('active', x === b));
  pvUpdateCount();
});

function pvSensesBody(p) {
  if (p.senses && p.senses.length > 1) {
    return p.senses.map((s, i) => `
      <div class="sense-row"><span class="sense-n">${i + 1}.</span><span>${esc(s.en)}</span></div>
      <div class="sense-hu">${esc(s.hu)}</div>
      <div class="ex">${esc(s.ex)} ${speakBtn(s.ex)}</div>
      ${s.ex_hu ? `<div class="ex-hu">${esc(s.ex_hu)}</div>` : ''}`).join('');
  }
  return `<div>${esc(p.en)}</div>
    <span class="lbl">Példa</span>
    <div class="ex">${esc(p.ex)} ${speakBtn(p.ex)}</div>
    ${p.ex_hu ? `<div class="ex-hu">${esc(p.ex_hu)}</div>` : ''}`;
}
function renderPVList() {
  const q = norm($('#pv-search').value);
  const srcList = pvSource();
  const list = q ? srcList.filter(p => norm(p.p).includes(q) || norm(p.hu).includes(q) || norm(p.en).includes(q)) : srcList;
  $('#pv-list-count').textContent = q ? `${list.length} találat` : `${srcList.length} phrasal verb`;
  $('#pv-list').innerHTML = list.map(p => `<div class="entry" data-p="${esc(p.p)}">
    <div class="entry-head">
      <span class="entry-word">${esc(p.p)}</span>
      ${speakBtn(p.p)}
      <span class="entry-hu">${esc(p.hu)}</span>
    </div>
    <div class="entry-body" hidden>${pvSensesBody(p)}
      <div class="entry-actions">${p.src === 'jegyzet' ? '<span class="tag">füzetemből</span>' : ''}${p.own ? '<span class="tag">saját</span>' : ''}${badgeFor(stat('phrases', p.p))}${delBtn()}</div>
    </div>
  </div>`).join('');
}
$('#pv-search').addEventListener('input', renderPVList);
$('#pv-list').addEventListener('click', e => {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (e.target.closest('[data-del]')) { deleteItem('phrases', entry.dataset.p); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});
renderPVList();

const pv = { cards: [], i: 0, dir: 'en', flipped: false, round: 1, total: 0, learned: 0, missed: [] };

$('#pv-start').addEventListener('click', () => {
  const active = $('#pv-dir-chips .chip.active');
  pv.dir = active ? active.dataset.val : 'en';
  const batch = pvBatchCards();
  pv.cards = shuffle(batch);
  pv.i = 0; pv.round = 1; pv.total = batch.length; pv.learned = 0; pv.missed = [];
  $('#pv-setup').hidden = true;
  $('#pv-result').hidden = true;
  $('#pv-drill').hidden = false;
  pvShowCard();
});

$('#pv-card').addEventListener('click', pvFlip);
$('#pv-quit').addEventListener('click', pvEnd);
$('#pv-speak').addEventListener('click', () => { if (pv.cards[pv.i]) speak(pv.cards[pv.i].p); });
$('#pv-ok').addEventListener('click', () => pvGrade(true));
$('#pv-fail').addEventListener('click', () => pvGrade(false));

function pvShowCard() {
  const p = pv.cards[pv.i];
  pv.flipped = false;
  $('#pv-card').classList.remove('flipped');
  const multi = p.senses && p.senses.length > 1;
  $('#pv-card').style.minHeight = multi ? '480px' : '300px';
  $('#pv-actions').hidden = true;
  // globális haladás: hány megtanult az összes tömb-kártyából
  const globalDone = pv.learned;
  $('#pv-progress').textContent = `${globalDone} / ${pv.total} megtanult`;
  $('#pv-bar').style.width = (globalDone / pv.total * 100) + '%';
  $('#pv-round').textContent = pv.round > 1 ? `${pv.round}. kör` : '';
  $$('.pv-flip-hint').forEach(el => el.textContent = `${pv.i + 1} / ${pv.cards.length} · kattints a megfordításhoz`);
  if (pv.dir === 'en') {
    $('#pv-front-word').textContent = p.p;
    const re = p.key ? new RegExp(p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    $('#pv-front-ex').textContent = re ? p.ex.replace(re, '______') : (p.ex || '');
    $('#pv-back-main').textContent = p.hu;
    if (multi) {
      $('#pv-back-def').innerHTML = p.senses.map((s, i) =>
        `<div class="sense-row"><span class="sense-n">${i + 1}.</span> <b>${esc(s.hu)}</b> — ${esc(s.en)}</div>
         <div class="pv-example sense-ex">${esc(s.ex)}</div>
         ${s.ex_hu ? `<div class="pv-example sense-ex-hu">${esc(s.ex_hu)}</div>` : ''}`
      ).join('');
      $('#pv-back-ex').textContent = '';
      $('#pv-back-exhu').textContent = '';
    } else {
      $('#pv-back-def').textContent = p.en;
      $('#pv-back-ex').textContent = p.ex;
      $('#pv-back-exhu').textContent = p.ex_hu || '';
    }
    if (S.settings.speak) speak(p.p);
  } else {
    $('#pv-front-word').textContent = p.hu;
    $('#pv-front-ex').textContent = '';
    $('#pv-back-main').textContent = p.p;
    if (multi) {
      $('#pv-back-def').innerHTML = p.senses.map((s, i) =>
        `<div class="sense-row"><span class="sense-n">${i + 1}.</span> ${esc(s.en)}</div>
         <div class="pv-example sense-ex">${esc(s.ex)}</div>
         ${s.ex_hu ? `<div class="pv-example sense-ex-hu">${esc(s.ex_hu)}</div>` : ''}`
      ).join('');
      $('#pv-back-ex').textContent = '';
      $('#pv-back-exhu').textContent = '';
    } else {
      $('#pv-back-def').textContent = p.en;
      $('#pv-back-ex').textContent = p.ex;
      $('#pv-back-exhu').textContent = p.ex_hu || '';
    }
  }
}

function pvFlip() {
  if (pv.flipped) return;
  pv.flipped = true;
  $('#pv-card').classList.add('flipped');
  $('#pv-actions').hidden = false;
  if (pv.dir === 'hu' && S.settings.speak) speak(pv.cards[pv.i].p);
}

function pvGrade(ok) {
  if (!pv.flipped) return;
  const p = pv.cards[pv.i];
  grade('phrases', p.p, ok);
  if (ok) pv.learned++; else pv.missed.push(p);
  pv.i++;
  if (pv.i >= pv.cards.length) pvRoundEnd(); else pvShowCard();
}

function pvRoundEnd() {
  if (pv.missed.length === 0) {
    // minden kártya megtanult → végleges eredmény
    pvFinalResult();
  } else {
    // következő kör a hibásokkal
    pv.round++;
    pv.cards = shuffle(pv.missed);
    pv.i = 0; pv.missed = [];
    $('#pv-drill').hidden = false;
    pvShowCard();
  }
}

function pvFinalResult() {
  $('#pv-drill').hidden = true;
  if (!pv.total) { $('#pv-setup').hidden = false; return; }
  const roundText = pv.round === 1 ? 'Első körre megtanultad mind!' : `${pv.round} kör alatt megtanultad mind!`;
  $('#pv-result').innerHTML = `
    <div class="score">🎉</div>
    <p><b>${roundText}</b></p>
    <p class="hint">${pv.total} phrasal verb · ${pv.round} kör</p>
    <div class="row"><button class="primary" id="pv-again">Új kör</button></div>`;
  $('#pv-result').hidden = false;
  $('#pv-again').addEventListener('click', () => { $('#pv-result').hidden = true; $('#pv-setup').hidden = false; });
}

function pvEnd() {
  // kilépés gomb: azonnali leállás
  $('#pv-drill').hidden = true;
  if (!pv.total) { $('#pv-setup').hidden = false; return; }
  const done = pv.learned, rem = pv.total - done;
  $('#pv-result').innerHTML = `
    <div class="score">${Math.round(done / pv.total * 100)}%</div>
    <p>${done} megtanult · ${rem} maradt</p>
    <div class="row"><button class="primary" id="pv-again">Újrakezd</button></div>`;
  $('#pv-result').hidden = false;
  $('#pv-again').addEventListener('click', () => { $('#pv-result').hidden = true; $('#pv-setup').hidden = false; });
}

// ============================================================

// ============================================================
// KATONAI — QUIZLET MÓD
// ============================================================
function mlBatchCards() {
  const cat = $('#ml-cat-select').value;
  const chip = $('#ml-batch-chips .chip.active') || $('#ml-batch-chips .chip');
  const n = chip.dataset.val;
  const sec = milSecItems();
  const base = cat === 'all' ? sec : sec.filter(m => m.cat === cat);
  return n === 'all' ? base : base.slice(0, parseInt(n));
}
function mlUpdateCount() { $('#ml-count').textContent = mlBatchCards().length; }
setMilSec('szerv');

$('#ml-dir-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#ml-dir-chips .chip').forEach(x => x.classList.toggle('active', x === b));
});
$('#ml-batch-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $$('#ml-batch-chips .chip').forEach(x => x.classList.toggle('active', x === b));
  mlUpdateCount();
});

const ml = { cards: [], i: 0, dir: 'en', flipped: false, round: 1, total: 0, learned: 0, missed: [] };

$('#ml-start').addEventListener('click', () => {
  const active = $('#ml-dir-chips .chip.active');
  ml.dir = active ? active.dataset.val : 'en';
  const batch = mlBatchCards();
  ml.cards = shuffle(batch); ml.i = 0; ml.round = 1; ml.total = batch.length; ml.learned = 0; ml.missed = [];
  $('#ml-setup').hidden = true; $('#ml-result').hidden = true; $('#ml-drill').hidden = false;
  mlShowCard();
});

$('#ml-card').addEventListener('click', mlFlip);
$('#ml-quit').addEventListener('click', mlEnd);
$('#ml-speak').addEventListener('click', () => { if (ml.cards[ml.i]) speak(ml.cards[ml.i].t); });
$('#ml-ok').addEventListener('click', () => mlGrade(true));
$('#ml-fail').addEventListener('click', () => mlGrade(false));

function mlShowCard() {
  const m = ml.cards[ml.i];
  ml.flipped = false;
  $('#ml-card').classList.remove('flipped');
  $('#ml-actions').hidden = true;
  $('#ml-progress').textContent = `${ml.learned} / ${ml.total} megtanult`;
  $('#ml-bar').style.width = (ml.learned / ml.total * 100) + '%';
  $('#ml-round').textContent = ml.round > 1 ? `${ml.round}. kör` : '';
  $$('.pv-flip-hint', $('#ml-drill')).forEach(el => el.textContent = `${ml.i + 1} / ${ml.cards.length} · kattints a megfordításhoz`);
  if (ml.dir === 'en') {
    $('#ml-front-word').textContent = m.t;
    $('#ml-front-ex').textContent = m.ex || '';
    $('#ml-back-main').textContent = m.hu;
    $('#ml-back-def').textContent = m.en;
    $('#ml-back-ex').textContent = m.ex || '';
    $('#ml-back-exhu').textContent = m.ex_hu || '';
    if (S.settings.speak) speak(m.t);
  } else {
    $('#ml-front-word').textContent = m.hu;
    $('#ml-front-ex').textContent = '';
    $('#ml-back-main').textContent = m.t;
    $('#ml-back-def').textContent = m.en;
    $('#ml-back-ex').textContent = m.ex || '';
    $('#ml-back-exhu').textContent = m.ex_hu || '';
  }
}

function mlFlip() {
  if (ml.flipped) return;
  ml.flipped = true;
  $('#ml-card').classList.add('flipped');
  $('#ml-actions').hidden = false;
  if (ml.dir === 'hu' && S.settings.speak) speak(ml.cards[ml.i].t);
}

function mlGrade(ok) {
  if (!ml.flipped) return;
  const m = ml.cards[ml.i];
  grade('mil', m.t, ok);
  if (ok) ml.learned++; else ml.missed.push(m);
  ml.i++;
  if (ml.i >= ml.cards.length) mlRoundEnd(); else mlShowCard();
}

function mlRoundEnd() {
  if (ml.missed.length === 0) {
    mlFinalResult();
  } else {
    ml.round++; ml.cards = shuffle(ml.missed); ml.i = 0; ml.missed = [];
    mlShowCard();
  }
}

function mlFinalResult() {
  $('#ml-drill').hidden = true;
  if (!ml.total) { $('#ml-setup').hidden = false; return; }
  const roundText = ml.round === 1 ? 'Első körre megtanultad mind!' : `${ml.round} kör alatt megtanultad mind!`;
  $('#ml-result').innerHTML = `<div class="score">🎉</div><p><b>${roundText}</b></p><p class="hint">${ml.total} kifejezés · ${ml.round} kör</p><div class="row"><button class="primary" id="ml-again">Új kör</button></div>`;
  $('#ml-result').hidden = false;
  $('#ml-again').addEventListener('click', () => { $('#ml-result').hidden = true; $('#ml-setup').hidden = false; mlUpdateCount(); });
}

function mlEnd() {
  $('#ml-drill').hidden = true;
  if (!ml.total) { $('#ml-setup').hidden = false; return; }
  const done = ml.learned, rem = ml.total - done;
  $('#ml-result').innerHTML = `<div class="score">${Math.round(done / ml.total * 100)}%</div><p>${done} megtanult · ${rem} maradt</p><div class="row"><button class="primary" id="ml-again">Újrakezd</button></div>`;
  $('#ml-result').hidden = false;
  $('#ml-again').addEventListener('click', () => { $('#ml-result').hidden = true; $('#ml-setup').hidden = false; mlUpdateCount(); });
}

// ============================================================
// KATONAI KVÍZ + NATO
// ============================================================
function milReview(m) { return `<b>${esc(m.t)}</b> — ${esc(m.hu)}`; }
function milFeedback(m) { return `<span class="lbl">${esc(m.t)}${m.abbr ? ' · ' + esc(m.abbr) : ''}</span>${esc(m.hu)} — ${esc(m.en)}<span class="lbl">Példa</span><i>${esc(m.ex)}</i>`; }
$('#milq-start').addEventListener('click', () => {
  const mode = $('#milq-mode').value, cat = $('#milq-cat').value;
  let pool = milSecItems().filter(m => cat === 'all' || m.cat === cat);
  if (mode === 'abbr') pool = MIL.filter(m => m.abbr && /^[A-Z]/.test(m.abbr));
  if (mode === 'def2en') pool = pool.filter(m => m.en);
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
  runQuiz($('#milq-quiz'), $('#milq-result'), qs, { onClose: () => {} });
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
// KÖZÖS QUIZLET-MOTOR (Igék, Átvezetők, Szóbeli témák szókártyái)
// ============================================================
// cfg: { pfx, store, key(item), speakOf(item), face(item, dir) -> {front, meta, frontEx, main, def, ex, exhu}, batch(), unit }
const LEARNERS = [];
function makeLearn(tab, cfg) {
  const st = { cards: [], i: 0, dir: 'en', flipped: false, round: 1, total: 0, learned: 0, missed: [] };
  const el = id => $('#' + cfg.pfx + '-' + id);
  const setTxt = (id, v) => { el(id).textContent = v || ''; };
  el('dir-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setChipGroup(cfg.pfx + '-dir-chips', b.dataset.val); });
  el('start').addEventListener('click', () => {
    const batch = cfg.batch();
    if (!batch.length) { toast('Nincs kártya ehhez a kiválasztáshoz'); return; }
    Object.assign(st, { dir: chipGroupValue(cfg.pfx + '-dir-chips') || 'en', cards: shuffle(batch), i: 0, round: 1, total: batch.length, learned: 0, missed: [] });
    el('setup').hidden = true; el('result').hidden = true; el('drill').hidden = false;
    show();
  });
  el('card').addEventListener('click', flip);
  el('quit').addEventListener('click', end);
  el('speak').addEventListener('click', speakCur);
  el('ok').addEventListener('click', () => gradeCur(true));
  el('fail').addEventListener('click', () => gradeCur(false));
  function show() {
    const it = st.cards[st.i], f = cfg.face(it, st.dir);
    st.flipped = false; el('card').classList.remove('flipped'); el('actions').hidden = true;
    setTxt('progress', `${st.learned} / ${st.total} megtanult`);
    el('bar').style.width = (st.learned / st.total * 100) + '%';
    setTxt('round', st.round > 1 ? `${st.round}. kör` : '');
    $$('.pv-flip-hint', el('drill')).forEach(x => x.textContent = `${st.i + 1} / ${st.cards.length} · kattints a megfordításhoz`);
    setTxt('front-word', f.front); setTxt('front-meta', f.meta); setTxt('front-ex', f.frontEx);
    setTxt('back-main', f.main); setTxt('back-def', f.def); setTxt('back-ex', f.ex); setTxt('back-exhu', f.exhu);
    if (st.dir === 'en' && S.settings.speak) speakCur();
  }
  function flip() {
    if (st.flipped) return;
    st.flipped = true; el('card').classList.add('flipped'); el('actions').hidden = false;
    if (st.dir === 'hu' && S.settings.speak) speakCur();
  }
  function gradeCur(ok) {
    if (!st.flipped) return;
    const it = st.cards[st.i];
    grade(cfg.store, cfg.key(it), ok);
    if (ok) st.learned++; else st.missed.push(it);
    st.i++;
    if (st.i < st.cards.length) { show(); return; }
    if (st.missed.length) { st.round++; st.cards = shuffle(st.missed); st.i = 0; st.missed = []; show(); return; }
    result(`<div class="score">🎉</div><p><b>${st.round === 1 ? 'Első körre megtanultad mind!' : `${st.round} kör alatt megtanultad mind!`}</b></p><p class="hint">${st.total} ${cfg.unit} · ${st.round} kör</p>`, 'Új kör');
  }
  function end() {
    if (!st.total) { el('drill').hidden = true; el('setup').hidden = false; return; }
    result(`<div class="score">${Math.round(st.learned / st.total * 100)}%</div><p>${st.learned} megtanult · ${st.total - st.learned} maradt</p>`, 'Újrakezd');
  }
  function result(html, btn) {
    el('drill').hidden = true;
    el('result').innerHTML = html + `<div class="row"><button class="primary" data-again>${btn}</button></div>`;
    el('result').hidden = false;
    $('[data-again]', el('result')).addEventListener('click', () => { el('result').hidden = true; el('setup').hidden = false; if (cfg.onBack) cfg.onBack(); });
  }
  function speakCur() { const it = st.cards[st.i]; if (it) speak(cfg.speakOf(it)); }
  const api = { tab, active: () => !el('drill').hidden, flip, gradeCur, speakCur };
  LEARNERS.push(api);
  return api;
}

// ============================================================
// IGÉK
// ============================================================
function vbSource() {
  const f = $('#vb-filter').value;
  return f === 'irr' ? VERBS.filter(v => v.irr) : f === 'own' ? VERBS.filter(v => v.own) : VERBS;
}
function vbBatch() { return batchSlice('vb-batch-chips', vbSource()); }
function vbUpdateCount() { $('#vb-count').textContent = vbBatch().length; }
function vbRefresh() { buildBatchChips('vb-batch-chips', vbSource().length); vbUpdateCount(); renderVerbs(); }
$('#vb-batch-chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; $$('#vb-batch-chips .chip').forEach(x => x.classList.toggle('active', x === b)); vbUpdateCount(); });
$('#vb-filter').addEventListener('change', vbRefresh);
$('#vb-search').addEventListener('input', renderVerbs);
function renderVerbs() {
  const q = norm($('#vb-search').value), src = vbSource();
  const list = q ? src.filter(v => norm(v.v).includes(q) || norm(v.hu).includes(q) || norm(v.en || '').includes(q)) : src;
  $('#vb-list-count').textContent = q ? `${list.length} találat` : `${src.length} ige`;
  $('#vb-list').innerHTML = list.map(v => `<div class="entry" data-k="${esc(v.v)}">
    <div class="entry-head">
      <span class="entry-word">${v.pos === 'phrase' ? '' : 'to '}${esc(v.v)}</span>
      ${v.forms ? `<span class="entry-pos">${esc(v.forms)}</span>` : ''}
      ${v.ipa ? `<span class="entry-ipa">${esc(v.ipa)}</span>` : ''}
      ${speakBtn(v.v)}
      <span class="entry-hu">${esc(v.hu)}</span>
    </div>
    <div class="entry-body" hidden>
      <div class="entry-body-grid">
        <div>
          ${v.en ? `<div>${esc(v.en)}</div>` : ''}
          ${v.ex ? `<span class="lbl">Példa</span><div class="ex">${esc(v.ex)} ${speakBtn(v.ex)}</div>` : ''}
          ${v.ex_hu ? `<div class="ex-hu">${esc(v.ex_hu)}</div>` : ''}
        </div>
        <div>
          ${v.syn && v.syn.length ? `<span class="lbl">Szinonimák</span><div class="row">${v.syn.map(x => `<span class="tag syn" data-speak="${esc(x)}">${esc(x)}</span>`).join('')}</div>` : ''}
          ${v.col && v.col.length ? `<span class="lbl">Kollokációk</span><div class="row">${v.col.map(x => `<span class="tag col">${esc(x)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      ${v.preps && v.preps.length ? `<span class="lbl">Elöljárók</span><div class="preps">${v.preps.map(p => `<div class="prep">
        <div class="prep-head"><span class="prep-p">${esc(p.p)}</span><span class="prep-pat">${esc(p.pat)}</span><span class="prep-hu">${esc(p.hu)}</span></div>
        <div class="ex">${esc(p.ex)} ${speakBtn(p.ex)}</div>
        <div class="ex-hu">${esc(p.ex_hu)}</div>
      </div>`).join('')}</div>` : ''}
      <div class="entry-actions">
        <button class="danger" data-grade="0">Újra</button>
        <button class="ok" data-grade="1">Tudom</button>
        ${v.irr ? '<span class="tag">rendhagyó</span>' : ''}${v.page ? `<span class="tag">füzet ${v.page}. oldal</span>` : ''}${v.own ? '<span class="tag">saját</span>' : ''}
        ${badgeFor(stat('verbs', v.v))}
        ${delBtn()}
      </div>
    </div>
  </div>`).join('');
}
$('#vb-list').addEventListener('click', e => entryClick(e, 'verbs', renderVerbs));
makeLearn('verbs', {
  pfx: 'vb', store: 'verbs', unit: 'ige', key: v => v.v, speakOf: v => v.v, batch: vbBatch, onBack: vbUpdateCount,
  face: (v, dir) => dir === 'en'
    ? { front: (v.pos === 'phrase' ? '' : 'to ') + v.v, meta: v.forms, frontEx: v.ex && v.key ? v.ex.replace(v.key, '______') : '', main: v.hu, def: v.en, ex: v.ex, exhu: v.ex_hu }
    : { front: v.hu, meta: '', frontEx: '', main: (v.pos === 'phrase' ? '' : 'to ') + v.v + (v.forms ? '  (' + v.forms + ')' : ''), def: v.en, ex: v.ex, exhu: v.ex_hu }
});
vbRefresh();

// ============================================================
// ÁTVEZETŐ KIFEJEZÉSEK
// ============================================================
let lkFn = 'all';
function lkGroups() {
  const m = new Map(); LINK.forEach(l => { if (!m.has(l.fn)) m.set(l.fn, l.fnHu || l.fn); }); return m;
}
function lkBuild() {
  const g = lkGroups();
  if (lkFn !== 'all' && !g.has(lkFn)) lkFn = 'all';
  $('#lk-fns').innerHTML = [['all', 'mind'], ...g].map(([k, v]) => `<button class="chip${k === lkFn ? ' active' : ''}" data-fn="${esc(k)}">${esc(v)}</button>`).join('');
  const sel = $('#lk-fn-select'), cur = sel.value;
  sel.innerHTML = '<option value="all">Minden csoport</option>' + [...g].map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
  sel.value = g.has(cur) ? cur : 'all';
}
function lkBatch() { const f = $('#lk-fn-select').value; return f === 'all' ? LINK : LINK.filter(l => l.fn === f); }
function lkUpdateCount() { $('#lk-count').textContent = lkBatch().length; }
function lkRefresh() { lkBuild(); lkUpdateCount(); renderLinking(); }
$('#lk-fns').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; lkFn = b.dataset.fn; $$('#lk-fns .chip').forEach(x => x.classList.toggle('active', x === b)); renderLinking(); });
$('#lk-fn-select').addEventListener('change', lkUpdateCount);
$('#lk-search').addEventListener('input', renderLinking);
function renderLinking() {
  const q = norm($('#lk-search').value);
  const list = LINK.filter(l => (lkFn === 'all' || l.fn === lkFn) && (!q || norm(l.t).includes(q) || norm(l.hu).includes(q)));
  $('#lk-list-count').textContent = `${list.length} kifejezés`;
  $('#lk-list').innerHTML = list.map(l => `<div class="entry" data-k="${esc(l.t)}">
    <div class="entry-head">
      <span class="entry-word">${esc(l.t)}</span>
      ${speakBtn(l.t)}
      <span class="entry-hu">${esc(l.hu)}</span>
    </div>
    <div class="entry-body" hidden>
      ${l.en ? `<div>${esc(l.en)}</div>` : ''}
      ${l.ex ? `<span class="lbl">Példa</span><div class="ex">${esc(l.ex)} ${speakBtn(l.ex)}</div>` : ''}
      ${l.ex_hu ? `<div class="ex-hu">${esc(l.ex_hu)}</div>` : ''}
      <div class="entry-actions">
        <button class="danger" data-grade="0">Újra</button>
        <button class="ok" data-grade="1">Tudom</button>
        <span class="tag">${esc(l.fnHu || l.fn)}</span>${l.src === 'jegyzet' ? '<span class="tag">füzetemből</span>' : ''}${l.own ? '<span class="tag">saját</span>' : ''}
        ${badgeFor(stat('linking', l.t))}
        ${delBtn()}
      </div>
    </div>
  </div>`).join('');
}
$('#lk-list').addEventListener('click', e => entryClick(e, 'linking', renderLinking));
makeLearn('linking', {
  pfx: 'lk', store: 'linking', unit: 'kifejezés', key: l => l.t, speakOf: l => l.t, batch: lkBatch, onBack: lkUpdateCount,
  face: (l, dir) => dir === 'en'
    ? { front: l.t, meta: l.fnHu, frontEx: '', main: l.hu, def: l.en, ex: l.ex, exhu: l.ex_hu }
    : { front: l.hu, meta: l.fnHu, frontEx: '', main: l.t, def: l.en, ex: l.ex, exhu: l.ex_hu }
});
lkRefresh();

// ============================================================
// SZÓBELI TÉMÁK
// ============================================================
let tpMode = 'study', tpTopic = 'all';
$('#tp-mode').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  tpMode = b.dataset.mode; $$('#tp-mode .chip').forEach(x => x.classList.toggle('active', x === b)); renderTopics();
});
(function initTopics() {
  $('#tp-tags').innerHTML = [['all', 'mind'], ...TOPICS.map(t => [t.id, t.hu])].map(([k, v]) => `<button class="chip${k === 'all' ? ' active' : ''}" data-id="${esc(k)}">${esc(v)}</button>`).join('');
  $('#tp-tags').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    tpTopic = b.dataset.id; $$('#tp-tags .chip').forEach(x => x.classList.toggle('active', x === b)); renderTopics();
  });
})();
function tpBuildSelect() {
  const sel = $('#tp-topic-select'), cur = sel.value;
  const ids = Array.from(new Set(TVOC.map(v => v.topic)));
  const name = id => (TOPICS.find(t => t.id === id) || { hu: id }).hu;
  sel.innerHTML = '<option value="all">Minden témakör</option>' + ids.map(id => `<option value="${esc(id)}">${esc(name(id))}</option>`).join('');
  sel.value = ids.includes(cur) ? cur : 'all';
}
function tpBatch() { const f = $('#tp-topic-select').value; const l = f === 'all' ? TVOC : TVOC.filter(v => v.topic === f); return l; }
function tpUpdateCount() { $('#tp-count').textContent = tpBatch().length; }
function tpRefresh() { tpBuildSelect(); tpUpdateCount(); }
$('#tp-topic-select').addEventListener('change', tpUpdateCount);
function renderTopics() {
  if (!TOPICS.length) { $('#tp-list').innerHTML = '<p class="hint">Ez a modul még készül.</p>'; return; }
  const open = new Set($$('.crisis-entry', $('#tp-list')).filter(el => !$('.entry-body', el).hidden).map(el => el.dataset.id));
  const list = TOPICS.filter(t => tpTopic === 'all' || t.id === tpTopic);
  $('#tp-list').innerHTML = list.map(t => {
    const qs = t.questions.filter(q => tpMode !== 'hash' || q.hash);
    if (!qs.length) return '';
    return `<div class="entry crisis-entry" data-id="${esc(t.id)}">
    <div class="entry-head crisis-head">
      <span class="crisis-title">${esc(t.en)}</span>
      ${speakBtn(t.en)}
      <span class="entry-hu">${esc(t.hu)} · ${qs.length} kérdés</span>
    </div>
    <div class="entry-body"${open.has(t.id) || tpTopic !== 'all' ? '' : ' hidden'}>
      <div class="crisis-qa">${qs.map(q => `
        <div class="crisis-q">${q.hash ? '<span class="hash-mark" title="A lapon #-tel jelölt kérdés">#</span> ' : ''}${esc(q.q)} ${speakBtn(q.q)}</div>
        <div class="tp-qhu">${esc(q.q_hu)}</div>
        <div class="crisis-a${tpMode === 'practice' ? ' hidden-answer' : ''}">${esc(q.a)} ${speakBtn(q.a)}</div>
        <div class="crisis-a-hu">${esc(q.a_hu)}</div>
        ${q.vocab && q.vocab.length ? `<div class="row tp-vocab">${q.vocab.map(v => `<span class="tag syn" data-speak="${esc(v.en)}" title="${esc(v.hu)}">${esc(v.en)} <small>· ${esc(v.hu)}</small></span>`).join('')}</div>` : ''}
      `).join('')}</div>
    </div>
  </div>`;
  }).join('');
}
$('#tp-list').addEventListener('click', e => {
  const hiddenA = e.target.closest('.crisis-a.hidden-answer'); if (hiddenA) { hiddenA.classList.remove('hidden-answer'); return; }
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (e.target.closest('.crisis-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
});
makeLearn('topics', {
  pfx: 'tp', store: 'topics', unit: 'kifejezés', key: v => v.t, speakOf: v => v.t, batch: tpBatch, onBack: tpUpdateCount,
  face: (v, dir) => dir === 'en'
    ? { front: v.t, meta: v.topicHu, frontEx: '', main: v.hu, def: '', ex: v.ex, exhu: v.ex_hu }
    : { front: v.hu, meta: v.topicHu, frontEx: '', main: v.t, def: '', ex: v.ex, exhu: v.ex_hu }
});
tpRefresh();

// ============================================================
// LISTÁK SZERKESZTÉSE — felvétel, törlés, visszaállítás (localStorage)
// ============================================================
function delBtn() { return '<button class="del-btn" data-del title="Törlés a listából">Törlés</button>'; }
// közös kattintáskezelő a listákhoz (kiejtés, értékelés, törlés, lenyitás)
function entryClick(e, store, rerender) {
  const sp = e.target.closest('[data-speak]'); if (sp) { speak(sp.dataset.speak); return; }
  const entry = e.target.closest('.entry'); if (!entry) return;
  if (e.target.closest('[data-del]')) { deleteItem(store, entry.dataset.k); return; }
  const g = e.target.closest('[data-grade]');
  if (g) { grade(store, entry.dataset.k, g.dataset.grade === '1'); rerender(); return; }
  if (e.target.closest('.entry-head')) { const b = $('.entry-body', entry); b.hidden = !b.hidden; }
}
const STORE_LABEL = { words: 'szó', phrases: 'phrasal verb', verbs: 'ige', linking: 'átvezető kifejezés', mil: 'katonai kifejezés', topics: 'szókártya' };
function ownKeyOf(store, c) { return KEYF[store](normalizeOwn(store, c)); }
function deleteItem(store, key) {
  const label = STORE_LABEL[store];
  const ci = S.custom[store].findIndex(c => ownKeyOf(store, c) === key);
  if (ci >= 0) {
    if (!confirm(`Törlöd a saját felvett elemet: „${key}”?`)) return;
    S.custom[store].splice(ci, 1);
  } else {
    if (!confirm(`Törlöd a listából: „${key}”? (A Lista szerkesztése alatt később visszaállíthatod.)`)) return;
    if (!S.hidden[store].includes(key)) S.hidden[store].push(key);
  }
  save(); refreshStore(store); toast(`Törölve: ${label}`);
}
function refreshStore(store) {
  applyEdits(store);
  if (store === 'words') { buildWordTags(); renderWords(); wdUpdateCount(); }
  if (store === 'phrases') pvRefresh();
  if (store === 'verbs') vbRefresh();
  if (store === 'linking') lkRefresh();
  if (store === 'mil') milRefresh();
  if (store === 'topics') tpRefresh();
  renderEditor(store); updateSidebar(); updateCardsAvail();
}
function renderEditor(store) {
  const det = document.querySelector(`.editor[data-store="${store}"]`); if (!det) return;
  const body = $('.editor-body', det);
  const own = S.custom[store], hid = S.hidden[store];
  const secOpts = store === 'mil' ? `<label>Melyik részbe?<select data-f="sec">${Object.entries(MIL_SECS).map(([k, v]) => `<option value="${k}"${k === milSec ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>` : '';
  const topicOpts = store === 'topics' ? `<label>Témakör<select data-f="topic">${TOPICS.map(t => `<option value="${esc(t.id)}">${esc(t.hu)}</option>`).join('')}</select></label>` : '';
  body.innerHTML = `
    <div class="autofill">
      <label class="wide">Gyors felvétel — írj be egy angol <i>vagy</i> magyar kifejezést, a többit kitölti a rendszer
        <span class="autofill-row"><input data-auto placeholder="pl. call off · lefújni · deploy · bevetni"><button type="button" class="primary" data-autofill>Kitöltés</button></span>
      </label>
      <p class="autofill-status" data-auto-status></p>
    </div>
    <form class="editor-form" autocomplete="off">
      <label>Angolul *<input data-f="en" required placeholder="${store === 'verbs' ? 'pl. to deploy' : 'angol kifejezés'}"></label>
      <label>Magyarul *<input data-f="hu" required placeholder="magyar jelentés"></label>
      <label class="wide">Angol magyarázat<input data-f="def" placeholder="rövid angol definíció (nem kötelező)"></label>
      <label class="wide">Angol példamondat<input data-f="ex" placeholder="példamondat (nem kötelező)"></label>
      <label class="wide">Magyar fordítás<input data-f="ex_hu" placeholder="a példamondat fordítása (nem kötelező)"></label>
      <input type="hidden" data-f="syn">
      ${secOpts}${topicOpts}
      <div class="wide"><button class="primary" type="submit">Hozzáadás</button></div>
    </form>
    <div class="editor-lists">
      <div><span class="lbl">Saját felvett elemek (${own.length})</span>
        ${own.length ? `<ul class="editor-ul">${own.map((c, i) => `<li><b>${esc(c.en)}</b> — ${esc(c.hu)} <button class="del-btn" data-own="${i}">Törlés</button></li>`).join('')}</ul>` : '<p class="hint">Még nincs saját elem.</p>'}
      </div>
      <div><span class="lbl">Törölt elemek (${hid.length})</span>
        ${hid.length ? `<ul class="editor-ul">${hid.map((k, i) => `<li>${esc(k)} <button data-restore="${i}">Visszaállítás</button></li>`).join('')}</ul><button data-restore-all>Mind visszaállítása</button>` : '<p class="hint">Nincs törölt elem. Egy elemet a lenyitott sorában a „Törlés” gombbal távolíthatsz el.</p>'}
      </div>
    </div>`;
}

// ---------- Automatikus kitöltés (angol vagy magyar kifejezésből) ----------
// 1) saját adatbázis  2) MyMemory fordítás  3) Wiktionary definíció + példa  4) Datamuse szinonimák
const HU_CHARS = /[áéíóöőúüű]/i;
// minden találatból összerakja a mezőket (az első nem üres érték nyer); store: melyik listában van már
function localLookup(term) {
  const q = norm(term).replace(/^to /, '');
  let r = null;
  for (const st of STORES) for (const x of ARR[st]) {
    const en = norm(KEYF[st](x)).replace(/^to /, '');
    const hus = norm(x.hu || '').split(/[;,]\s*/).map(h => h.replace(/\s*\(.*?\)\s*/g, '').trim());
    if (en !== q && !hus.includes(q)) continue;
    const c = { en: (st === 'verbs' && x.pos !== 'phrase' ? 'to ' : '') + KEYF[st](x), hu: x.hu, def: x.en || '', ex: x.ex || '', ex_hu: x.ex_hu || '', syn: (x.syn || []).join(', '), forms: x.forms || '' };
    if (!r) r = Object.assign(c, { stores: [st] });
    else { r.stores.push(st); for (const k in c) if (!r[k] && c[k]) r[k] = c[k]; }
  }
  return r;
}
async function getJSON(url, ms = 8000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function mmTranslate(text, pair) {
  const d = await getJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`);
  const main = (d.responseData && d.responseData.translatedText || '').trim();
  const srcWords = norm(text).split(/\s+/);
  const alts = (d.matches || []).map(m => (m.translation || '').trim())
    .filter(x => x && x.length < 60 && x !== x.toUpperCase() && !srcWords.includes(norm(x)));
  const uniq = []; [main, ...alts].forEach(x => { const k = norm(x).replace(/[.!]$/, ''); if (x && !uniq.some(u => norm(u).replace(/[.!]$/, '') === k)) uniq.push(x.replace(/[.]$/, '')); });
  return uniq;
}
// csak a legfelső szintű szöveg: az aljelentések (ol/ul), stílus- és sablon-elemek nélkül
const stripHtml = h => { const d = new DOMParser().parseFromString(String(h), 'text/html').body; d.querySelectorAll('ol, ul, dl, style, link, .usage-label-sense, sup').forEach(x => x.remove()); return d.textContent.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim(); };
async function wiktionary(term) {
  const d = await getJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term.replace(/^to /i, ''))}`);
  const en = d.en || [];
  for (const m of en) for (const df of m.definitions || []) {
    const def = stripHtml(df.definition || '');
    if (!def || /^\(?(obsolete|archaic|rare|dialect)/i.test(def)) continue;
    const exs = (df.examples || []).map(stripHtml).filter(x => x.split(' ').length >= 5 && x.split(' ').length <= 25);
    return { pos: (m.partOfSpeech || '').toLowerCase(), def, ex: exs[0] || '' };
  }
  return null;
}
// Tatoeba: valódi, ember által fordított angol–magyar mondatpár
async function tatoeba(term, exact = true) {
  const d = await getJSON(`https://api.tatoeba.org/unstable/sentences?lang=eng&q=${encodeURIComponent(exact ? '"' + term + '"' : term)}&trans:lang=hun&sort=relevance&limit=20`, 7000);
  const ok = (d.data || []).filter(x => !x.is_unapproved && x.translations && x.translations.some(t => t.lang === 'hun'))
    .map(x => ({ ex: x.text, ex_hu: x.translations.find(t => t.lang === 'hun').text, n: x.text.split(' ').length }))
    .filter(x => x.n >= 5 && x.n <= 20 && !/\b(Tom|Mary|Ziri|Sami|Layla|Rima|Skura|Yanni)\b/.test(x.ex))
    .filter(x => term.toLowerCase().split(/\s+/).every(w => x.ex.toLowerCase().includes(w.slice(0, Math.max(3, w.length - 2)))));
  ok.sort((a, b) => Math.abs(a.n - 11) - Math.abs(b.n - 11));
  if (!ok[0] && exact && term.includes(' ')) return tatoeba(term, false);
  return ok[0] || null;
}
async function datamuse(term) {
  const d = await getJSON(`https://api.datamuse.com/words?ml=${encodeURIComponent(term)}&max=6`, 5000);
  return d.filter(x => (x.tags || []).includes('syn')).slice(0, 4).map(x => x.word);
}
async function autofill(det) {
  const store = det.dataset.store, inp = $('[data-auto]', det), status = $('[data-auto-status]', det);
  const term = inp.value.trim(); if (!term) { inp.focus(); return; }
  const set = (f, v) => { const el = $(`[data-f="${f}"]`, det); if (el && v != null) el.value = v; };
  ['en', 'hu', 'def', 'ex', 'ex_hu', 'syn'].forEach(f => set(f, ''));
  const loc = localLookup(term);
  if (loc) {
    Object.entries(loc).forEach(([k, v]) => { if (k !== 'stores') set(k, v); });
    status.textContent = loc.stores.includes(store)
      ? 'Ez a kifejezés már szerepel ebben a listában — nem kell újra felvenni.'
      : `Kitöltve a saját adatbázisból (megvan itt: ${loc.stores.map(st => STORE_LABEL[st]).join(', ')}). Ellenőrizd, aztán „Hozzáadás”.`;
    return;
  }
  status.textContent = 'Keresés… (fordítás, definíció, példamondat)';
  try {
    let en = term, hu = '';
    let isHu = HU_CHARS.test(term);
    if (!isHu) {
      const tr = await mmTranslate(term, 'en|hu');
      // ha az angol→magyar fordítás változatlanul adja vissza, valószínűleg magyar szó volt
      if (tr[0] && norm(tr[0]) === norm(term)) isHu = true; else hu = tr.slice(0, 3).join(', ');
    }
    if (isHu) {
      const tr = await mmTranslate(term, 'hu|en');
      // a csupa nagybetűs vagy mondatkezdő nagybetűs fordítást kisbetűsítjük (tulajdonnév ritka egy szótárban)
      const pick = tr.find(x => x !== x.toUpperCase()) || tr[0] || term;
      en = pick.replace(/[.!]$/, ''); if (en === en.toUpperCase() || /^[A-Z][a-z]/.test(en)) en = en.toLowerCase(); hu = term;
    }
    if (store === 'verbs' && !/^to /i.test(en) && en.split(' ').length <= 3) en = 'to ' + en.replace(/^to /i, '');
    set('en', en); set('hu', hu);
    const bare = en.replace(/^to /i, '');
    const [wk, tt, syn] = await Promise.all([
      wiktionary(bare).catch(() => null),
      tatoeba(bare).catch(() => null),
      store === 'words' || store === 'verbs' ? datamuse(bare).catch(() => []) : Promise.resolve([])]);
    const src = ['fordítás: MyMemory'];
    if (wk) { set('def', wk.def); if (wk.pos) det.dataset.pos = wk.pos; src.push('definíció: Wiktionary'); }
    if (tt) { set('ex', tt.ex); set('ex_hu', tt.ex_hu); src.push('példamondat és fordítása: Tatoeba'); }
    else if (wk && wk.ex) { set('ex', wk.ex); const t = await mmTranslate(wk.ex, 'en|hu').catch(() => []); set('ex_hu', t[0] || ''); src.push('példamondat: Wiktionary'); }
    if (syn && syn.length) { set('syn', syn.join(', ')); src.push('szinonimák: Datamuse'); }
    const miss = [!wk && 'angol magyarázat', !tt && !(wk && wk.ex) && 'példamondat'].filter(Boolean);
    status.textContent = `Kitöltve (${src.join(', ')}). ${miss.length ? `Nem találtam: ${miss.join(', ')} — ezt írd be kézzel, ha szeretnéd. ` : ''}Gépi kitöltés — nézd át, javíts, ha kell, aztán „Hozzáadás”.`;
  } catch (e) {
    status.textContent = 'Az automatikus kitöltéshez internet kell (vagy a szolgáltatás most nem elérhető). A mezőket kézzel is kitöltheted.';
    set('en', HU_CHARS.test(term) ? '' : term); set('hu', HU_CHARS.test(term) ? term : '');
  }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-autofill]'); if (b) autofill(b.closest('.editor')); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-auto]')) { e.preventDefault(); autofill(e.target.closest('.editor')); } });
document.addEventListener('submit', e => {
  const det = e.target.closest('.editor'); if (!det) return;
  e.preventDefault();
  const store = det.dataset.store, f = {};
  $$('[data-f]', e.target).forEach(i => { f[i.dataset.f] = i.value.trim(); });
  if (!f.en || !f.hu) { toast('Az angol és a magyar mező kötelező'); return; }
  const key = ownKeyOf(store, f);
  if (ARR[store].some(x => KEYF[store](x).toLowerCase() === key.toLowerCase())) { toast('Ez már szerepel a listában'); return; }
  if (det.dataset.pos) { f.pos = det.dataset.pos; delete det.dataset.pos; }
  f.at = Date.now();
  S.custom[store].push(f); save(); refreshStore(store); toast('Hozzáadva — a kártyák közé is bekerült');
  const first = $('.editor-form [data-f="en"]', det); if (first) first.focus();
});
document.addEventListener('click', e => {
  const det = e.target.closest('.editor'); if (!det) return;
  const store = det.dataset.store;
  const o = e.target.closest('[data-own]');
  if (o) { const c = S.custom[store][+o.dataset.own]; if (c && confirm(`Törlöd: „${c.en}”?`)) { S.custom[store].splice(+o.dataset.own, 1); save(); refreshStore(store); } return; }
  const r = e.target.closest('[data-restore]');
  if (r) { S.hidden[store].splice(+r.dataset.restore, 1); save(); refreshStore(store); toast('Visszaállítva'); return; }
  if (e.target.closest('[data-restore-all]')) { S.hidden[store] = []; save(); refreshStore(store); toast('Minden visszaállítva'); }
});
STORES.forEach(renderEditor);

// ============================================================
// STATISZTIKA
// ============================================================
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
    try { const obj = JSON.parse(r.result); if (!obj.words) throw 0; localStorage.setItem(KEY, JSON.stringify(obj)); S = load(); toast('Import kész'); location.reload(); }
    catch (err) { toast('Hibás fájl'); }
  };
  r.readAsText(f); e.target.value = '';
});
$('#btn-wipe').addEventListener('click', () => {
  if (!confirm('Biztosan törlöd az összes haladást?')) return;
  localStorage.removeItem(KEY); location.reload();
});

// ---------- Offline letöltés ----------
if (location.protocol !== 'file:') {
  const btn = $('#btn-download');
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      const files = ['index.html', 'style.css', 'app.js', 'data.js', 'crisis.js', 'worldmap.js', 'mil-hu.js', 'topics.js', 'extra.js'];
      const [html, css, js, dataJs, crisisJs, worldJs, milJs, topicsJs, extraJs] = await Promise.all(files.map(f => fetch(f, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(f); return r.text(); })));
      const bundled = html
        .replace(/<script[^>]*src="mil-hu\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${milJs}\n<\/script>`)
        .replace(/<script[^>]*src="topics\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${topicsJs}\n<\/script>`)
        .replace(/<script[^>]*src="extra\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${extraJs}\n<\/script>`)
        .replace(/<link[^>]*href="style\.css[^"]*"[^>]*>/, () => `<style>\n${css}\n</style>`)
        .replace(/<script[^>]*src="data\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${dataJs}\n<\/script>`)
        .replace(/<script[^>]*src="crisis\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${crisisJs}\n<\/script>`)
        .replace(/<script[^>]*src="worldmap\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${worldJs}\n<\/script>`)
        .replace(/<script[^>]*src="app\.js[^"]*"[^>]*><\/script>/, () => `<script>\n${js}\n<\/script>`);
      const blob = new Blob([bundled], { type: 'text/html' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'c2-angol-offline.html'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Letöltve — nyisd meg bárhol, internet nélkül is működik');
    } catch (e) { toast('A letöltés nem sikerült'); }
  });
}

// ---------- Indulás ----------
renderWords();
updateSidebar();
updateCardsAvail();
})();
