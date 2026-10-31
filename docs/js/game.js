// Hoard: a clicker fed by an organisation's real merged pull requests.
// Personal progress lives in this browser; the org's shared hoard comes from docs/data (written by Actions).
import { goblin, defs, goblinCSS, esc, ACCESSORIES } from './goblin.js';

const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
function fmt(n, dec) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return dec && n < 100 && n % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString('en-US');
  const e = Math.min(SUF.length - 1, Math.floor(Math.log10(n) / 3)), v = n / 1000 ** e;
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + SUF[e];
}
const big = n => n < 1e7 ? Math.floor(n).toLocaleString('en-US') : fmt(n);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;

/* ---------- content ---------- */
const CREW = [
  { id: 'linter', name: 'Linter imp', desc: 'Nitpicks your whitespace. Lovingly.', cost: 15, lps: 0.1, glyph: ';' },
  { id: 'duck', name: 'Rubber duck', desc: 'Listens. Never judges. Occasionally quacks.', cost: 100, lps: 1, glyph: 'Q' },
  { id: 'intern', name: 'Intern', desc: 'Enthusiastic. Has push access, somehow.', cost: 1100, lps: 8, glyph: 'i' },
  { id: 'auto', name: 'Autocomplete sprite', desc: 'Finishes your sentences. Sometimes correctly.', cost: 12000, lps: 47, glyph: '⇥' },
  { id: 'ci', name: 'CI runner', desc: 'Green checks, all day long.', cost: 130000, lps: 260, glyph: '✓' },
  { id: 'oracle', name: 'Stack oracle', desc: 'Has seen your exact error before. In 2011.', cost: 1.4e6, lps: 1400, glyph: '?' },
  { id: 'swarm', name: 'Microservice swarm', desc: 'Forty tiny services. One big feeling.', cost: 2e7, lps: 7800, glyph: '⁂' },
  { id: 'dragon', name: 'Legacy dragon', desc: 'Sleeps on a hoard of COBOL. Do not wake.', cost: 3.3e8, lps: 44000, glyph: '§' },
  { id: 'mono', name: 'The Monorepo', desc: 'Everything, everywhere, in one repo.', cost: 5.1e9, lps: 260000, glyph: '∞' }
];
const TIERS = [[1, 10], [25, 200], [75, 5000]];
const TIER_NAMES = {
  linter: ['Strict mode', 'Zero warnings', 'Linter becomes sentient'],
  duck: ['Squeaky clean', 'Duck council', 'Quantum quack'],
  intern: ['Free snacks', 'Mentorship', 'Intern gets promoted'],
  auto: ['Tab tab tab', 'Reads your mind', 'Writes your mind'],
  ci: ['Parallel jobs', 'Warm caches', 'No flaky tests (legend)'],
  oracle: ['Accepted answer', 'Duplicate of #1', 'Closed as perfect'],
  swarm: ['Service mesh', 'Event-driven', 'Eventually consistent joy'],
  dragon: ['COBOL whisperer', 'Mainframe hum', 'The dragon refactors'],
  mono: ['Sparse checkout', 'Build graph', 'One repo to rule them']
};
const UPS = [];
CREW.forEach(c => TIERS.forEach(([n, m], t) => UPS.push({
  id: `${c.id}${t}`, name: TIER_NAMES[c.id][t], desc: `Doubles ${c.name} output.`, cost: c.cost * m, glyph: c.glyph,
  unlock: s => s.crew[c.id] >= n, fx: { crew: c.id }
})));
[
  ['keeb', 'Mechanical keyboard', 'Taps are twice as strong.', 100, s => s.taps >= 15, { tap: 2 }, '⌨'],
  ['vim', 'Vim motions', 'Taps are twice as strong. Exiting remains optional.', 700, s => s.taps >= 80, { tap: 2 }, ':q'],
  ['darkmode', 'Dark mode', 'Taps are twice as strong. Eyes rejoice.', 12000, s => s.taps >= 300, { tap: 2 }, '◐'],
  ['pair', 'Pair programming', 'Taps also earn 1% of your lines per second.', 60000, s => s.taps >= 500, { pct: 0.01 }, '⚇'],
  ['mob', 'Mob programming', 'Taps earn another 1% of your lines per second.', 6e6, s => s.taps >= 1500, { pct: 0.01 }, '⚉'],
  ['cache', 'Remote build cache', 'Builds finish twice as fast.', 40000, s => s.builds >= 3, { build: 2 }, '⟳'],
  ['retry', 'Retry flaky tests', 'Flaky builds never happen again.', 400000, s => s.flaky >= 1, { noflaky: 1 }, '↻'],
  ['gitblame', 'git blame', 'Merge conflicts appear twice as often.', 250000, s => s.conflicts >= 2, { conflict: 0.5 }, '⑂']
].forEach(([id, name, desc, cost, un, fx, glyph]) => UPS.push({ id, name, desc, cost, unlock: un, fx, glyph }));

const RELICS = [
  { id: 'semicolon', name: 'Golden semicolon', desc: '+15% to everything, per level.', base: 5 },
  { id: 'regex', name: 'Ancient regex', desc: '+2% chance of a critical tap, per level.', base: 8 },
  { id: 'cursed', name: 'Cursed linter', desc: 'Crew cost 5% less, per level (max 6).', base: 12, max: 6 },
  { id: 'tome', name: 'Tome of deletions', desc: '+50% gold from feasts, per level.', base: 10 }
];

const BADGES = [
  ['tap1', 'Hello, world', 'Tap the goblin.', s => s.taps >= 1],
  ['tap1k', 'Ten-finger typist', 'Tap 1,000 times.', s => s.taps >= 1000],
  ['crew1', 'Hiring!', 'Hire your first crew member.', s => Object.values(s.crew).some(n => n > 0)],
  ['crewall', 'Full stack', 'Hire every kind of crew.', s => CREW.every(c => s.crew[c.id] > 0)],
  ['feast1', 'First course', 'Feed the goblin a real pull request.', s => s.feasts >= 1],
  ['feast25', 'Glutton', 'Feed 25 pull requests.', s => s.feasts >= 25],
  ['chef', "Chef's special", 'Feed the goblin one of your own pull requests.', s => s.chef >= 1],
  ['cleanup', 'Marie Kondo', 'Feed scrolls with 1,000 deleted lines in total.', s => s.deletedFed >= 1000],
  ['lines1m', 'Prolific', 'Hoard 1M lines in total.', s => s.total >= 1e6],
  ['lines1b', 'Ten-x', 'Hoard 1B lines in total.', s => s.total >= 1e9],
  ['build10', 'Green streak', 'Pass 10 builds.', s => s.builds >= 10],
  ['flaky', 'It works on my machine', 'Survive a flaky test.', s => s.flaky >= 1],
  ['conflict1', 'Resolved', 'Resolve a merge conflict.', s => s.conflicts >= 1],
  ['crit', 'Critical path', 'Land 50 critical taps.', s => s.crits >= 50],
  ['relic', 'Antiquarian', 'Own a relic.', s => Object.values(s.relics).some(n => n > 0)],
  ['squash', 'Squash and merge', 'Squash your hoard for the first time.', s => s.squashes >= 1],
  ['guild', 'One of us', 'Find yourself in the guild.', s => !!s.me],
  ['goal', 'Team effort', 'Be here in a month your org smashes its goal.', s => s.goalSmashed]
].map(([id, name, desc, cond]) => ({ id, name, desc, cond }));

// Badges earned by real work on GitHub, read from the org's hoard. [id, name, desc, value(m,h), target]
const REAL = [
  ['r-first', 'On the menu', 'Have a pull request merged in the last 90 days.', m => m.merged, 1],
  ['r-month', 'Feeding the feast', 'Merge 3 pull requests this month.', m => m.monthMerged, 3],
  ['r-5', 'Regular', 'Merge 5 pull requests in 90 days.', m => m.merged, 5],
  ['r-25', 'Staple diet', 'Merge 25 pull requests in 90 days.', m => m.merged, 25],
  ['r-clean', 'Tidy-upper', 'Delete 1,000 lines in 90 days.', m => m.deletions, 1000],
  ['r-review', 'Second pair of eyes', 'Review 10 pull requests in 90 days.', m => m.reviews, 10],
  ['r-streak', 'Steady cook', 'Merge something 4 weeks running.', m => m.streak, 4],
  ['r-team', 'Team of the month', 'Be on the team that fed the goblin most this month.', (m, h) => +(!!h.teamOfMonth && m.team === h.teamOfMonth), 1]
].map(([id, name, desc, value, target]) => ({ id, name, desc, value, target }));

const CONFLICTS = [
  ['const goblin = "hungry";', 'const goblin = "very hungry";'],
  ['timeout: 30', 'timeout: 3000'],
  ['return early;', 'return eventually;'],
  ['// TODO: fix later', '// FIXME: fix now'],
  ['retries = 3', 'retries = Infinity'],
  ['color: "green"', 'color: "pink"']
];
const TAB_INTRO = {
  crew: 'Hire helpers who write code for you, even while you are away.',
  upgrades: 'Spend lines to make taps, crew and builds stronger.',
  feast: 'Each scroll is a pull request your org merged. Feed each one once: lines for every change, <b>gold for every deleted line</b>.',
  guild: 'The people and teams feeding the goblin. Find yourself to see your own contribution.',
  vault: 'Gold buys relics that last forever. Squash and merge to start over stronger.',
  badges: 'Game badges, badges for your real work on GitHub, and the goblin\'s wardrobe.'
};

/* ---------- state ---------- */
let H = null, M = { total: 0, people: {}, log: [] };
const fresh = () => ({ lines: 0, total: 0, gold: 0, taps: 0, crits: 0, crew: {}, ups: {}, relics: {}, fed: {}, feasts: 0, chef: 0, deletedFed: 0,
  builds: 0, flaky: 0, conflicts: 0, squash: 0, squashes: 0, badges: {}, real: {}, me: null, relaxed: false, seenHowto: false,
  goalSmashed: false, buyAmt: 1, tab: 'crew', sound: false, last: Date.now() });
let S = fresh(), KEY = 'code-goblin';
const save = () => { S.last = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
function load() { try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch {} }
const me = () => (S.me && H?.members?.find(m => m.login === S.me)) || null;

/* ---------- derived numbers ---------- */
const D = {};
function orgParts() {
  if (!H) return { level: 1, goal: 1, pct: 0 };
  const pct = H.month.merged / Math.max(1, H.month.goal);
  return { level: 1 + 0.08 * (H.level - 1), goal: 1 + 0.5 * clamp(pct, 0, 1.5), pct };
}
function recalc() {
  D.crew = {}; D.tap = 1; D.pct = 0; D.build = 1; D.noflaky = false; D.conflict = 1;
  CREW.forEach(c => D.crew[c.id] = 1);
  for (const u of UPS) if (S.ups[u.id]) {
    const f = u.fx;
    if (f.crew) D.crew[f.crew] *= 2;
    if (f.tap) D.tap *= f.tap;
    if (f.pct) D.pct += f.pct;
    if (f.build) D.build *= f.build;
    if (f.noflaky) D.noflaky = true;
    if (f.conflict) D.conflict *= f.conflict;
  }
  const o = orgParts();
  D.org = o.level * o.goal;
  D.all = D.org * (1 + 0.15 * (S.relics.semicolon || 0)) * (1 + 0.1 * S.squash);
  D.lps = CREW.reduce((a, c) => a + (S.crew[c.id] || 0) * c.lps * D.crew[c.id], 0) * D.all;
  D.crit = 0.03 + 0.02 * (S.relics.regex || 0);
  D.discount = 1 - 0.05 * Math.min(6, S.relics.cursed || 0);
}
let buffs = [];
const buffMult = k => buffs.reduce((m, b) => m * (b[k] || 1), 1);
const lps = () => D.lps * buffMult('lps');
const tapValue = () => (D.tap + D.lps * D.pct) * D.all * buffMult('tap');
function gain(v) { S.lines += v; S.total += v; }

/* ---------- audio: a soft typewriter, off by default ---------- */
let actx = null;
function clack(pitch = 1, vol = 0.25) {
  if (!S.sound) return;
  try {
    actx = actx || new AudioContext();
    const len = 0.03, buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 2200 * pitch; f.Q.value = 1.2; g.gain.value = vol;
    src.connect(f).connect(g).connect(actx.destination); src.start();
  } catch {}
}
function chime(notes) {
  if (!S.sound) return;
  try {
    actx = actx || new AudioContext();
    notes.forEach((n, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.07;
      o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((n - 69) / 12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.32);
    });
  } catch {}
}

/* ---------- goblin on stage ---------- */
const gobEl = $('#gob');
let mood = 'idle', moodT = 0, drawnKey = '';
function drawGoblin() {
  const theme = dark() ? 'dark' : 'light', lvl = H ? H.level : 1, key = theme + lvl + mood;
  if (key === drawnKey) return;
  drawnKey = key;
  gobEl.innerHTML = `<svg viewBox="0 -14 240 258" aria-hidden="true" focusable="false"><style>${goblinCSS('#gob')}</style>${defs('st', theme)}${goblin({ p: 'st', theme, level: lvl, mood, seed: lvl * 7 + 3 })}</svg>`;
}
function setMood(m, t = 0.35) { mood = m; moodT = t; drawGoblin(); }
gobEl.addEventListener('pointermove', e => {
  const svg = gobEl.querySelector('svg'), pupils = gobEl.querySelector('.g-pupils');
  if (!svg || !pupils) return;
  const r = svg.getBoundingClientRect();
  const x = clamp((e.clientX - (r.left + r.width * 0.5)) / (r.width * 0.5), -1, 1), y = clamp((e.clientY - (r.top + r.height * 0.37)) / (r.height * 0.5), -1, 1);
  pupils.setAttribute('transform', `translate(${(x * 3.2).toFixed(2)} ${(y * 2.6).toFixed(2)})`);
});

function popText(x, y, text, cls = '') {
  const el = document.createElement('span');
  el.className = 'pop ' + cls; el.textContent = text; el.setAttribute('aria-hidden', 'true');
  const r = $('.stage').getBoundingClientRect();
  el.style.left = (x - r.left) + 'px'; el.style.top = (y - r.top - 10) + 'px';
  $('.stage').appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function tap(x, y) {
  S.taps++;
  if (S.taps === 1) $('#hint').hidden = true;
  let v = tapValue();
  const crit = Math.random() < D.crit;
  if (crit) { v *= 10; S.crits++; }
  gain(v);
  advanceBuild(3.5 * D.build);
  gobEl.classList.add('squish'); setTimeout(() => gobEl.classList.remove('squish'), 80);
  if (crit) { popText(x, y, `+${fmt(v)}`, 'big'); setMood('happy', 0.6); clack(0.6, 0.4); }
  else { popText(x + rand(-18, 18), y, `+${fmt(v, true)}`); clack(rand(0.9, 1.3)); }
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) try { navigator.vibrate(crit ? 20 : 5); } catch {}
}
gobEl.addEventListener('pointerdown', e => { e.preventDefault(); tap(e.clientX, e.clientY); });
gobEl.addEventListener('keydown', e => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
    e.preventDefault();
    const r = gobEl.getBoundingClientRect(); tap(r.left + r.width / 2 + rand(-40, 40), r.top + r.height * 0.45);
  }
});

/* ---------- builds ---------- */
let buildP = 0;
function advanceBuild(p) {
  buildP += p;
  if (buildP < 100) return;
  if (!D.noflaky && Math.random() < 0.12) {
    buildP = 55; S.flaky++;
    $('#buildState').textContent = 'flaky test… retrying';
    toast('Build flaked', 'A test failed for no reason at all. Retrying.');
    return;
  }
  buildP = 0; S.builds++;
  const v = Math.max(lps() * 20, tapValue() * 25);
  gain(v); setMood('happy', 0.8); chime([72, 76, 79]);
  const r = gobEl.getBoundingClientRect();
  popText(r.left + r.width / 2, r.top + 40, `build #${S.builds} passed +${fmt(v)}`, 'big');
}

/* ---------- merge conflicts: timed, but the timer pauses while you're on it, and can be switched off ---------- */
let conflictT = rand(45, 90), conflictLeft = 0;
const conflictEl = $('#conflict');
function openConflict() {
  const [a, b] = pick(CONFLICTS);
  $('#conflictCode').innerHTML = `&lt;&lt;&lt;&lt;&lt;&lt;&lt; ours\n<span class="o">${esc(a)}</span>\n=======\n<span class="t">${esc(b)}</span>\n&gt;&gt;&gt;&gt;&gt;&gt;&gt; theirs`;
  conflictEl.hidden = false; conflictLeft = 12; setMood('shock', 1);
  $('#conflictTick').hidden = S.relaxed;
  toast('Merge conflict', 'Pick a side on the stage for a reward.');
  chime([64, 63]);
}
function closeConflict() { conflictEl.hidden = true; conflictT = rand(70, 150) * D.conflict; }
function resolveConflict(which) {
  closeConflict(); S.conflicts++;
  if (which === 'ours') addBuff({ id: 'hotfix', name: 'Hotfix rush ×7 lines/s', lps: 7, t: 30 });
  else if (which === 'theirs') addBuff({ id: 'coffee', name: 'Caffeinated ×25 taps', tap: 25, t: 12 });
  else { const v = lps() * 120 + tapValue() * 50; gain(v); S.gold += 3; toast('Both, obviously', `+${fmt(v)} lines and 3 gold.`); }
  setMood('happy', 1); chime([67, 71, 74, 79]);
}
document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => resolveConflict(b.dataset.pick)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !conflictEl.hidden) closeConflict(); });
const conflictPaused = () => S.relaxed || conflictEl.matches(':hover, :focus-within');
function addBuff(b) { buffs = buffs.filter(x => x.id !== b.id); buffs.push(b); renderBuffs(); }
function renderBuffs() { $('#buffs').innerHTML = buffs.map(b => `<span class="buff">${esc(b.name)} · ${Math.ceil(b.t)}s</span>`).join(''); }

/* ---------- feasting on real pull requests ---------- */
const unfed = () => (H?.feast || []).filter(p => !S.fed[p.id]);
const isMine = p => !!S.me && !p.sealed && p.author === S.me;
function feastReward(p) {
  const size = p.additions + 2 * p.deletions + 20, chef = isMine(p) ? 3 : 1;
  return {
    lines: Math.max(size * 10 * D.all, lps() * 60 * (1 + Math.log10(size))) * chef,
    gold: Math.ceil((Math.ceil(p.deletions / 25) + 1) * (1 + 0.5 * (S.relics.tome || 0))) * chef,
    chef: chef > 1
  };
}
function feed(p, fromEl) {
  if (!p || S.fed[p.id]) return;
  S.fed[p.id] = 1; S.feasts++; S.deletedFed += p.deletions;
  const r = feastReward(p);
  if (r.chef) S.chef++;
  const g = gobEl.getBoundingClientRect(), mouth = { x: g.left + g.width * 0.5, y: g.top + g.height * 0.45 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fromEl && !reduce) {
    const s = fromEl.getBoundingClientRect(), fly = document.createElement('span');
    fly.className = 'scroll flyer'; fly.innerHTML = '<i></i>'; fly.setAttribute('aria-hidden', 'true');
    fly.style.left = s.left + 'px'; fly.style.top = s.top + 'px';
    document.body.appendChild(fly);
    fly.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${mouth.x - s.left}px,${mouth.y - s.top}px) rotate(540deg) scale(.3)` }],
      { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' }).onfinish = () => fly.remove();
  }
  setTimeout(() => {
    gain(r.lines); S.gold += r.gold;
    setMood(r.chef ? 'happy' : 'chomp', 0.6); clack(0.5, 0.5);
    popText(mouth.x, mouth.y - 20, `+${fmt(r.lines)}`, 'big');
    popText(mouth.x + 60, mouth.y + 10, `+${r.gold} gold`, 'pink');
    if (r.chef) toast("Chef's special ×3", `Your own pull request, “${p.title}”. The goblin's favourite.`);
    else toast(p.sealed ? 'A sealed scroll' : `@${p.author} · ${p.repo || ''}`, p.sealed ? 'Private work, devoured with respect.' : `“${p.title}” devoured. +${fmt(r.lines)} lines, +${r.gold} gold.`);
    renderTray(); if (S.tab === 'feast') renderPanel();
  }, fromEl && !reduce ? 520 : 0);
}
function renderTray() {
  const all = unfed(), mine = all.filter(isMine), list = [...mine, ...all.filter(p => !isMine(p))].slice(0, 3);
  $('#tray').innerHTML = list.length
    ? `<span class="lead">${plural(all.length, 'fresh scroll')} from your org${mine.length ? `, ${mine.length} of them yours` : ''}. Feed one:</span>`
      + list.map(p => `<button class="scroll${isMine(p) ? ' mine' : ''}" data-id="${esc(p.id)}">${isMine(p) ? '<span class="tag">YOURS ×3</span>' : '<i aria-hidden="true"></i>'}<span>${p.sealed ? 'Sealed scroll' : esc(p.title)}</span><span class="sr">, feed to the goblin</span></button>`).join('')
    : `<span class="lead">No fresh scrolls. When ${esc(H?.owner || 'your org')} merges a pull request, it shows up here within a few hours.</span>`;
  $('#tray').querySelectorAll('.scroll').forEach(b => b.addEventListener('click', () => feed(H.feast.find(p => p.id === b.dataset.id), b)));
}

/* ---------- shop ---------- */
const crewCost = (c, n = 1) => { const base = c.cost * D.discount * 1.15 ** (S.crew[c.id] || 0); return Math.ceil(base * (1.15 ** n - 1) / 0.15); };
const maxAfford = c => { let n = Math.floor(Math.log(S.lines * 0.15 / (c.cost * D.discount * 1.15 ** (S.crew[c.id] || 0)) + 1) / Math.log(1.15)); while (n > 0 && crewCost(c, n) > S.lines) n--; return Math.max(0, n); };
const amtFor = c => S.buyAmt === 'max' ? Math.max(1, maxAfford(c)) : S.buyAmt;
function hire(c, el) {
  const n = amtFor(c), cost = crewCost(c, n);
  if (S.lines < cost) return;
  S.lines -= cost; S.crew[c.id] = (S.crew[c.id] || 0) + n;
  recalc(); clack(0.8, 0.35); setMood('happy', 0.4);
  el?.animate([{ background: 'color-mix(in srgb, var(--green-mark) 30%, transparent)' }, { background: 'transparent' }], 400);
  updatePanel();
}
const availUps = () => UPS.filter(u => !S.ups[u.id] && u.unlock(S)).sort((a, b) => a.cost - b.cost);
function buyUp(u) {
  if (S.lines < u.cost || S.ups[u.id]) return;
  S.lines -= u.cost; S.ups[u.id] = 1; recalc(); chime([72, 79]); toast('Upgrade', u.name); renderPanel();
}
const relicCost = r => Math.ceil(r.base * 2 ** (S.relics[r.id] || 0));
function buyRelic(r) {
  if (r.max && (S.relics[r.id] || 0) >= r.max) return;
  const c = relicCost(r);
  if (S.gold < c) return;
  S.gold -= c; S.relics[r.id] = (S.relics[r.id] || 0) + 1; recalc(); chime([60, 67, 72, 76]); toast('Relic', `${r.name} is now level ${S.relics[r.id]}.`); renderPanel();
}
const squashGain = () => Math.max(0, Math.floor(Math.cbrt(S.total / 1e9)) - S.squash);
function squash() {
  const n = squashGain();
  if (n < 1 || !confirm(`Squash your hoard for ${plural(n, 'squash token')}? Lines, crew and upgrades reset. Gold, relics, badges and fed scrolls stay. Each token adds 10% to everything.`)) return;
  Object.assign(S, { lines: 0, crew: {}, ups: {}, squash: S.squash + n, squashes: S.squashes + 1 });
  recalc(); chime([60, 64, 67, 72, 76, 79, 84]); setMood('happy', 1.5); renderPanel();
}

/* ---------- panel ---------- */
const content = $('#content');
let rows = [], panelKey = '';
const ic = (g, pink) => `<span class="ic${pink ? ' pk' : ''}" aria-hidden="true">${esc(g)}</span>`;
const duo = (p, pinkish) => `<span class="duo${pinkish ? ' pk' : ''}">${p?.avatar ? `<img alt="" src="${esc(p.avatar)}&s=96" loading="lazy">` : ''}</span>`;
function selectTab(tab, focus) {
  S.tab = tab; content.scrollTop = 0; renderPanel();
  if (focus) $(`#tab-${tab}`).focus();
}
function renderPanel() {
  document.querySelectorAll('#tabs [role=tab]').forEach(b => {
    const on = b.dataset.tab === S.tab;
    b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
  });
  content.setAttribute('aria-labelledby', `tab-${S.tab}`);
  $('#buybar').hidden = S.tab !== 'crew';
  document.querySelectorAll('#buybar button').forEach(b => b.setAttribute('aria-pressed', String(S.buyAmt) === b.dataset.amt));
  rows = [];
  const intro = `<p class="intro">${TAB_INTRO[S.tab]}</p>`;
  if (S.tab === 'crew') {
    const shown = CREW.filter((c, i) => i === 0 || (S.crew[CREW[i - 1].id] || 0) > 0 || S.total >= c.cost * 0.5);
    content.innerHTML = intro + shown.map(c => `<button class="item" data-c="${c.id}">${ic(c.glyph)}<span class="tx"><span class="nm">${c.name}</span><span class="ds">${c.desc}</span><span class="mt"></span></span><span class="rt"><span class="own"></span><span class="cost"></span></span></button>`).join('')
      + (shown.length < CREW.length ? `<p class="note">More crew appear as your hoard grows.</p>` : '');
    content.querySelectorAll('[data-c]').forEach(el => { const c = CREW.find(x => x.id === el.dataset.c); el.addEventListener('click', () => hire(c, el)); rows.push({ el, c }); });
  } else if (S.tab === 'upgrades') {
    const av = availUps();
    panelKey = av.map(u => u.id).join();
    content.innerHTML = intro + (av.length ? av.map(u => `<button class="item" data-u="${u.id}">${ic(u.glyph, true)}<span class="tx"><span class="nm">${esc(u.name)}</span><span class="ds">${esc(u.desc)}</span></span><span class="rt"><span class="cost">${fmt(u.cost)} lines</span></span></button>`).join('')
      : `<p class="empty">Nothing to upgrade yet. Tap, hire, feast.</p>`);
    content.querySelectorAll('[data-u]').forEach(el => { const u = UPS.find(x => x.id === el.dataset.u); el.addEventListener('click', () => buyUp(u)); rows.push({ el, u }); });
  } else if (S.tab === 'feast') {
    const list = H?.feast || [];
    const sorted = [...list.filter(p => isMine(p) && !S.fed[p.id]), ...list.filter(p => !(isMine(p) && !S.fed[p.id]))];
    content.innerHTML = intro + (S.me ? '' : `<p class="note">Tip: find yourself in the <b>Guild</b> tab and your own pull requests are worth ×3 here.</p>`)
      + (sorted.length ? sorted.map(p => {
        const fed = S.fed[p.id], r = feastReward(p), mine = isMine(p);
        return `<button class="item" data-f="${esc(p.id)}" ${fed ? 'aria-disabled="true"' : ''}>
          ${p.avatar ? duo(p, true) : ic('§', true)}
          <span class="tx"><span class="nm">${p.sealed ? 'A sealed scroll' : esc(p.title)}${mine ? '<span class="yours">YOURS ×3</span>' : ''}</span>
          <span class="ds">${p.sealed ? 'from a private repo' : `@${esc(p.author)} · ${esc(p.repo)} #${p.number}`} · ${ago(p.mergedAt)}</span>
          <span class="mt">+${fmt(p.additions)} added <span class="del">−${fmt(p.deletions)} deleted</span></span></span>
          <span class="rt"><span class="cost">${fed ? 'eaten' : `+${fmt(r.lines)} lines<br>+${r.gold} gold`}</span></span></button>`;
      }).join('') : `<p class="empty">The hoard is empty. Merge something tasty.</p>`);
    content.querySelectorAll('[data-f]').forEach(el => el.addEventListener('click', () => feed(H.feast.find(p => p.id === el.dataset.f), el)));
  } else if (S.tab === 'guild') {
    content.innerHTML = intro + guildHTML();
    $('#whoami')?.addEventListener('change', e => setMe(e.target.value || null));
  } else if (S.tab === 'vault') {
    const n = squashGain(), next = (S.squash + n + 1) ** 3 * 1e9;
    content.innerHTML = intro + `<div class="sec">Relics · bought with gold</div>`
      + RELICS.map(r => { const lv = S.relics[r.id] || 0, maxed = r.max && lv >= r.max; return `<button class="item" data-r="${r.id}">${ic('✦', true)}<span class="tx"><span class="nm">${r.name} <span style="font-family:var(--mono);font-size:12px">level ${lv}</span></span><span class="ds">${r.desc}</span></span><span class="rt"><span class="cost">${maxed ? 'max' : relicCost(r) + ' gold'}</span></span></button>`; }).join('')
      + `<div class="sec">Squash and merge</div><p class="note">Squash your whole history into tokens. You have <b>${S.squash}</b> (+${S.squash * 10}% to everything). Next token at ${fmt(next)} lifetime lines.</p>
        <div style="padding:0 14px 14px"><button class="btn solid" id="squashBtn" ${n < 1 ? 'disabled' : ''}>${n < 1 ? 'Not enough history yet' : `Squash for ${plural(n, 'token')}`}</button></div>
        <div class="sec">Settings</div>
        <label class="setting"><input type="checkbox" id="relaxed" ${S.relaxed ? 'checked' : ''}><span><b>Relaxed timers.</b> Merge conflicts wait for you instead of timing out.</span></label>
        <div class="sec">Your stats</div><dl class="kv">${[
          ['Lines hoarded, ever', fmt(S.total)], ['Taps', S.taps.toLocaleString('en-US')], ['Critical taps', S.crits], ['Pull requests eaten', S.feasts],
          ["Chef's specials", S.chef], ['Deleted lines eaten', fmt(S.deletedFed)], ['Builds passed', S.builds], ['Merge conflicts resolved', S.conflicts]
        ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p class="note">Progress saves in this browser. The org's hoard lives in the repo and updates every few hours.</p>`;
    content.querySelectorAll('[data-r]').forEach(el => { const r = RELICS.find(x => x.id === el.dataset.r); el.addEventListener('click', () => buyRelic(r)); rows.push({ el, r }); });
    $('#squashBtn')?.addEventListener('click', squash);
    $('#relaxed').addEventListener('change', e => { S.relaxed = e.target.checked; $('#conflictTick').hidden = S.relaxed; });
  } else if (S.tab === 'badges') {
    const got = BADGES.filter(b => S.badges[b.id]).length, m = me();
    content.innerHTML = intro + `<div class="sec">Your real work · from GitHub</div>`
      + (m ? `<div class="badges">${REAL.map(b => { const v = Math.min(b.value(m, H), b.target), ok = v >= b.target;
          return `<div class="badge${ok ? ' got' : ''}"><b>${b.name}</b><small>${b.desc}</small><span class="st">${ok ? 'Earned' : `${fmt(v)} of ${fmt(b.target)}`}</span></div>`; }).join('')}</div>`
        : `<p class="note">Find yourself in the <b>Guild</b> tab to see badges for your real pull requests and reviews.</p>`)
      + `<div class="sec">In the game · ${got} of ${BADGES.length}</div>
      <div class="badges">${BADGES.map(b => `<div class="badge${S.badges[b.id] ? ' got' : ''}"><b>${b.name}</b><small>${b.desc}</small><span class="st">${S.badges[b.id] ? 'Earned' : 'Not yet'}</span></div>`).join('')}</div>
      <div class="sec">Goblin wardrobe · unlocked by the whole org</div>
      <div class="badges">${ACCESSORIES.map(a => `<div class="badge${H && H.level >= a.level ? ' got' : ''}"><b>${a.name}</b><small>Org level ${a.level}</small><span class="st">${H && H.level >= a.level ? 'Wearing it' : 'Locked'}</span></div>`).join('')}</div>`;
  }
  updatePanel();
}
function updatePanel() {
  for (const r of rows) {
    let off = false;
    if (r.c) {
      const n = amtFor(r.c), cost = crewCost(r.c, n), each = r.c.lps * D.crew[r.c.id] * D.all, own = S.crew[r.c.id] || 0;
      off = S.lines < cost;
      r.el.querySelector('.own').textContent = own || '';
      r.el.querySelector('.cost').textContent = `${fmt(cost)} lines${n > 1 ? ` for ${n}` : ''}`;
      r.el.querySelector('.mt').textContent = `+${fmt(each, true)} lines/s each${own ? ` · ${fmt(each * own, true)}/s from your ${own}` : ''}`;
    } else if (r.u) off = S.lines < r.u.cost;
    else if (r.r) off = S.gold < relicCost(r.r) || !!(r.r.max && (S.relics[r.r.id] || 0) >= r.r.max);
    if (off) r.el.setAttribute('aria-disabled', 'true'); else r.el.removeAttribute('aria-disabled');
  }
  if (S.tab === 'upgrades' && availUps().map(u => u.id).join() !== panelKey) renderPanel();
  const dot = (t, on) => $(`#tabs [data-tab=${t}] .dot`).classList.toggle('on', on);
  dot('upgrades', availUps().some(u => u.cost <= S.lines));
  dot('feast', unfed().length > 0);
  dot('guild', !S.me && !!H?.members?.length);
  dot('vault', squashGain() >= 1 || RELICS.some(r => S.gold >= relicCost(r) && !(r.max && (S.relics[r.id] || 0) >= r.max)));
}
function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}

/* ---------- you, your team, the guild ---------- */
function setMe(login) {
  S.me = login;
  if (login) { const m = me(); toast(`Hi, @${login}`, m ? `You've merged ${plural(m.merged, 'pull request')} in ${H.windowDays} days. Your own scrolls are now worth ×3.` : 'Welcome to the guild.'); chime([72, 76, 79, 84]); }
  renderMe(); renderTray(); renderPanel(); checkReal(true);
}
function renderMe() {
  const m = me(), pill = $('#mePill');
  pill.hidden = !m;
  if (m) pill.innerHTML = `${duo(m)}<span>@${esc(m.login)} · ${plural(m.monthMerged, 'PR')} this month</span>`;
}
function nextReal(m) {
  const left = REAL.filter(b => b.value(m, H) < b.target && b.id !== 'r-team').map(b => ({ b, v: b.value(m, H), frac: b.value(m, H) / b.target }));
  return left.sort((a, b) => b.frac - a.frac)[0];
}
function youHTML(m) {
  const monthTotal = H.members.reduce((a, x) => a + (x.monthMerged || 0), 0);
  const share = monthTotal ? Math.round(m.monthMerged / monthTotal * 100) : 0;
  const tm = H.teams?.find(t => t.name === m.team);
  const nx = nextReal(m);
  return `<div class="you" aria-label="Your contribution">
    <div class="who">${duo(m)}<span><b>@${esc(m.login)}</b><small>${m.team ? `mostly feeds the goblin through ${esc(m.team)}` : 'part of the guild'}</small></span></div>
    <div class="stats">
      <div><b>${m.monthMerged}</b><small>merged this month</small></div>
      <div><b>−${fmt(m.monthDeletions)}</b><small>lines deleted</small></div>
      <div><b>${m.monthReviews}</b><small>${m.monthReviews === 1 ? 'review' : 'reviews'} given</small></div>
      <div><b>${m.streak}</b><small>${m.streak === 1 ? 'week' : 'weeks'} in a row</small></div>
    </div>
    <p class="share">${m.monthMerged ? `You cooked <b>${share}%</b> of this month's public meals. Thank you, chef.` : 'No merges from you yet this month. Your next one feeds everyone.'}
      ${tm ? ` Your team <b>${esc(tm.name)}</b> served ${plural(tm.month, 'meal')} this month${H.teamOfMonth === tm.name ? ', the most of any team' : ''}.` : ''}</p>
    ${nx ? `<div class="next"><span>Next real-work badge: <b>${nx.b.name}</b>, ${fmt(nx.v)} of ${fmt(nx.b.target)}</span><div class="bar green" role="progressbar" aria-label="${esc(nx.b.name)} progress" aria-valuenow="${Math.round(nx.frac * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(nx.frac * 100).toFixed(1)}%"></i></div></div>` : '<p class="share">Every real-work badge earned. Legendary.</p>'}
  </div>`;
}
function repoSlug() {
  if (H?.repo) return H.repo;
  const host = location.hostname;
  if (host.endsWith('.github.io')) return `${host.split('.')[0]}/${location.pathname.split('/')[1] || ''}`;
  return null;
}
function issueLink(what) {
  const slug = repoSlug();
  return slug ? `https://github.com/${slug}/issues/new?title=${encodeURIComponent('goblin: ' + what)}&body=${encodeURIComponent('Submitting this issue tells the goblin. A bot will reply and close it.')}` : '#';
}
function person(p, pinkish) {
  if (!p) return `<b>Up for grabs</b>`;
  return `${duo(p, pinkish)}<b>@${esc(p.login)}</b>`;
}
function guildHTML() {
  if (!H) return `<p class="empty">The guild is still gathering.</p>`;
  const so = H.shoutouts, maxW = Math.max(1, ...H.weeks.map(w => w.merged)), m = me();
  const logins = [...H.members].map(x => x.login).sort((a, b) => a.localeCompare(b));
  const teams = (H.teams || []).filter(t => t.month > 0 || t.merged > 0);
  const maxT = Math.max(1, ...teams.map(t => t.month));
  return `<div class="sec">You</div>
    <div class="pickme"><label for="whoami">I am</label>
      <select id="whoami"><option value="">pick your GitHub name…</option>${logins.map(l => `<option ${l === S.me ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <p class="note" style="padding-top:0">On the honour system and saved only in this browser. Not listed? Merge a pull request in a public repo and you'll appear after the next feast.</p>
    ${m ? youHTML(m) : ''}
    <div class="sec">This week</div>
    <p class="note" style="padding-top:0">${plural(H.thisWeek?.merged || 0, 'pull request')} merged${H.thisWeek?.people ? ` by ${plural(H.thisWeek.people, 'person', 'people')} you can see` : ''}. ${H.month.merged >= H.month.goal ? `The ${esc(H.month.label)} goal is smashed, and everyone's bonus is bigger for it.` : `${H.month.goal - H.month.merged} more this month hits the ${esc(H.month.label)} goal and lifts everyone's bonus.`}</p>
    <div class="sec">${esc(H.month.label)} shout-outs</div>
    <div class="shout">
      <div><small>TOP FEEDER</small>${person(so.feeder)}${so.feeder ? `<small>${plural(so.feeder.n, 'merge')}</small>` : ''}</div>
      <div><small>CLEANUP HERO</small>${person(so.cleanup, true)}${so.cleanup ? `<small>−${fmt(so.cleanup.n)} lines</small>` : ''}</div>
      <div><small>REVIEW SAGE</small>${person(so.sage)}${so.sage ? `<small>${plural(so.sage.n, 'review')}</small>` : ''}</div>
    </div>
    ${so.fresh?.length ? `<div class="sec">Fresh faces this month</div><div class="people">${so.fresh.map(p => `<div class="person">${duo(p, true)}<span>@${esc(p.login)}<small>first merge here. Welcome!</small></span></div>`).join('')}</div>` : ''}
    ${teams.length > 1 ? `<div class="sec">Teams this month</div>
      <div class="teams">${teams.map(t => `<div class="team${t.name === H.teamOfMonth ? ' top' : ''}"><span>${esc(t.name)}${t.name === H.teamOfMonth ? ' · team of the month' : ''}${m && t.name === m.team ? ' · yours' : ''}</span>
        <div class="bar" role="img" aria-label="${esc(t.name)}: ${plural(t.month, 'merge')} this month"><i style="width:${(t.month / maxT * 100).toFixed(1)}%"></i></div><em>${t.month}</em></div>`).join('')}</div>
      <p class="note" style="padding-top:4px">${H.teams.some(t => t.name === 'Private repos') ? 'Private repos are pooled so nothing private is named. ' : ''}Teams come from goblin.config.json, or each public repo counts as one.</p>` : ''}
    <div class="sec">Merged pull requests per week</div>
    <div class="weeks" role="img" aria-label="Merged pull requests per week for the last 13 weeks: ${H.weeks.map(w => w.merged).join(', ')}. This week ${H.weeks[12].merged}.">${H.weeks.map(w => `<div style="height:${(w.merged / maxW * 100).toFixed(1)}%" title="Week of ${w.start}: ${w.merged} merged, +${w.additions} −${w.deletions}"></div>`).join('')}</div>
    <div class="wl"><span>${H.weeks[0].start}</span><span>this week</span></div>
    <div class="sec">The guild · ${plural(H.members.length, 'feeder')}</div>
    <div class="people">${H.members.map(x => `<div class="person">${duo(x, x.login === S.me)}<span>@${esc(x.login)}${x.login === S.me ? ' (you)' : ''}<small>${x.merged} merged · ${plural(x.reviews, 'review')}</small></span></div>`).join('')}</div>
    <div class="sec">Cheer the goblin on GitHub</div>
    <div class="cheer"><a class="btn" target="_blank" rel="noopener" href="${issueLink('feed')}">Feed<span class="sr"> (opens GitHub)</span></a><a class="btn" target="_blank" rel="noopener" href="${issueLink('pet')}">Pet<span class="sr"> (opens GitHub)</span></a><a class="btn solid" target="_blank" rel="noopener" href="${issueLink('cheer')}">Cheer<span class="sr"> (opens GitHub)</span></a></div>
    <div class="log">${M.total ? `<span>${plural(M.total, 'move')} from ${plural(Object.keys(M.people).length, 'person', 'people')}</span>` + M.log.slice(0, 6).map(l => `<span>@${esc(l.who)} ${esc(l.what === 'pet' ? 'petted' : l.what === 'feed' ? 'fed' : 'cheered')} the goblin · ${ago(l.at)}</span>`).join('') : '<span>No cheers yet. Be the first.</span>'}</div>`;
}

/* ---------- toasts, badges ---------- */
function toast(title, body) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = `<b>${esc(title)}</b>${esc(body)}`;
  $('#toasts').appendChild(t);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => t.remove(), 4200);
}
function checkBadges() {
  if (H && H.month.merged >= H.month.goal) S.goalSmashed = true;
  for (const b of BADGES) if (!S.badges[b.id] && b.cond(S)) { S.badges[b.id] = 1; toast('Badge', b.name); chime([76, 79, 84]); }
}
// Real-work badges update when the feast data does; announce any newly earned since last visit.
function checkReal(announce) {
  const m = me();
  if (!m) return;
  for (const b of REAL) if (!S.real[b.id] && b.value(m, H) >= b.target) {
    S.real[b.id] = 1;
    if (announce) { toast('Real-work badge', `${b.name}: ${b.desc}`); chime([72, 79, 84, 88]); }
  }
}

/* ---------- org header ---------- */
function renderOrg() {
  if (!H) return;
  const o = orgParts();
  $('#dek').innerHTML = `Meet <em>${esc(H.name)}</em>, the code goblin of <b>${esc(H.owner)}</b>. Every pull request your org merges is a meal, and the whole team feeds it.`;
  $('#how1').textContent = `Every pull request ${H.owner} merges turns into a scroll here, a few hours later.`;
  $('#issue').textContent = `Issue no. ${H.level} · ${new Date(H.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  $('#orgLvl').textContent = `LEVEL ${H.level}`;
  $('#goalTxt').textContent = `${H.month.label} feast: ${H.month.merged} of ${H.month.goal} merged pull requests${o.pct >= 1 ? '. Goal smashed!' : ''}`;
  $('#goalBar i').style.width = Math.min(100, o.pct * 100) + '%';
  $('#goalBar').setAttribute('aria-valuenow', Math.round(Math.min(1, o.pct) * 100));
  $('#bonusN').textContent = '×' + D.org.toFixed(1);
  $('#bonusWhy').textContent = `level ${H.level} ×${o.level.toFixed(2)} · goal ${Math.round(o.pct * 100)}% ×${o.goal.toFixed(2)}`;
  $('#demo').hidden = !H.demo;
  const slug = repoSlug();
  $('#cheerTop').href = issueLink('cheer');
  $('#srcLink').href = slug ? `https://github.com/${slug}` : '#';
  document.title = `Hoard · ${H.name} of ${H.owner}`;
}

/* ---------- loop ---------- */
let lastT = performance.now(), uiAcc = 0, slowAcc = 0, saveAcc = 0;
function frame(now) {
  const raw = (now - lastT) / 1000, dt = Math.min(raw, 0.25);
  lastT = now;
  gain(lps() * Math.min(raw, 3600));
  if (buffs.length) { buffs.forEach(b => b.t -= dt); const n = buffs.length; buffs = buffs.filter(b => b.t > 0); if (n !== buffs.length || Math.random() < dt * 4) renderBuffs(); }
  if (moodT > 0) { moodT -= dt; if (moodT <= 0) setMood(H && H.mood === 'happy' ? 'happy' : 'idle'); }
  if (conflictEl.hidden) { conflictT -= dt; if (conflictT <= 0 && !document.hidden) openConflict(); }
  else if (!conflictPaused()) {
    conflictLeft -= dt;
    $('#conflictTick').style.transform = `scaleX(${Math.max(0, conflictLeft / 12)})`;
    if (conflictLeft <= 0) { closeConflict(); toast('Too slow', 'Someone else resolved it. Next time.'); }
  }
  uiAcc += raw; slowAcc += raw; saveAcc += raw;
  if (uiAcc > 0.08) {
    uiAcc = 0;
    $('#lines').textContent = `${big(S.lines)} lines`;
    $('#lps').textContent = fmt(lps(), true); $('#perTap').textContent = fmt(tapValue(), true); $('#gold').textContent = S.gold.toLocaleString('en-US');
    $('#buildBar').style.width = buildP + '%'; $('#buildName').textContent = `BUILD #${S.builds + 1}`;
    if (buildP > 0 && !/flaky/.test($('#buildState').textContent)) $('#buildState').textContent = 'compiling…';
    if (buildP < 1) $('#buildState').textContent = 'waiting for your taps';
  }
  if (slowAcc > 0.4) {
    slowAcc = 0; updatePanel(); checkBadges();
    $('#buildBarWrap').setAttribute('aria-valuenow', Math.round(buildP));
    document.title = `${fmt(S.lines)} lines · Hoard`;
  }
  if (saveAcc > 8) { saveAcc = 0; save(); }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
async function loadData() {
  const get = f => fetch(`data/${f}?t=${Math.floor(Date.now() / 6e4)}`).then(r => r.ok ? r.json() : null).catch(() => null);
  [H, M] = await Promise.all([get('hoard.json'), get('moves.json')]);
  M = M || { total: 0, people: {}, log: [] };
}
const tabs = [...document.querySelectorAll('#tabs [role=tab]')];
tabs.forEach((b, i) => {
  b.addEventListener('click', () => selectTab(b.dataset.tab));
  b.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    selectTab(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, true);
  });
});
document.querySelectorAll('#buybar button').forEach(b => b.addEventListener('click', () => { S.buyAmt = b.dataset.amt === 'max' ? 'max' : +b.dataset.amt; renderPanel(); }));
$('#sound').addEventListener('click', () => { S.sound = !S.sound; $('#sound').setAttribute('aria-pressed', S.sound); if (S.sound) chime([72, 76]); });
$('#howtoClose').addEventListener('click', () => { S.seenHowto = true; $('#howto').hidden = true; save(); $('#gob').focus(); });
$('#howtoOpen').addEventListener('click', () => { $('#howto').hidden = false; $('#howto').scrollIntoView({ behavior: 'smooth' }); $('#howtoClose').focus(); });
$('#mePill').addEventListener('click', () => selectTab('guild', true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawnKey = ''; drawGoblin(); });

(async () => {
  await loadData();
  KEY = `code-goblin:${H?.owner || 'local'}`;
  load();
  recalc();
  const away = (Date.now() - S.last) / 1000;
  if (away > 60 && D.lps > 0) {
    const v = D.lps * Math.min(away, 8 * 3600) * 0.5;
    gain(v);
    setTimeout(() => toast('While you were away', `Your crew hoarded ${fmt(v)} lines.`), 600);
  }
  $('#howto').hidden = S.seenHowto;
  $('#hint').hidden = S.taps > 0;
  $('#sound').setAttribute('aria-pressed', S.sound);
  mood = H?.mood === 'happy' ? 'happy' : 'idle';
  drawGoblin(); renderOrg(); renderMe(); renderTray(); renderBuffs(); renderPanel();
  checkReal(true);
  const fresh = unfed().length;
  if (fresh) setTimeout(() => toast('Fresh scrolls', `${plural(fresh, 'merged pull request')} waiting to be eaten.`), 1200);
  requestAnimationFrame(frame);
})();
