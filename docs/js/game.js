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
CREW.forEach((c, i) => TIERS.forEach(([n, m], t) => UPS.push({
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
  ['cleanup', 'Marie Kondo', 'Feed scrolls with 1,000 deleted lines in total.', s => s.deletedFed >= 1000],
  ['lines1m', 'Prolific', 'Hoard 1M lines in total.', s => s.total >= 1e6],
  ['lines1b', 'Ten-x', 'Hoard 1B lines in total.', s => s.total >= 1e9],
  ['build10', 'Green streak', 'Pass 10 builds.', s => s.builds >= 10],
  ['flaky', 'It works on my machine', 'Survive a flaky test.', s => s.flaky >= 1],
  ['conflict1', 'Resolved', 'Resolve a merge conflict.', s => s.conflicts >= 1],
  ['crit', 'Critical path', 'Land 50 critical taps.', s => s.crits >= 50],
  ['relic', 'Antiquarian', 'Own a relic.', s => Object.values(s.relics).some(n => n > 0)],
  ['squash', 'Squash and merge', 'Squash your hoard for the first time.', s => s.squashes >= 1],
  ['guild', 'One of us', 'Visit the guild.', s => s.sawGuild],
  ['goal', 'Team effort', 'Be here in a month your org smashes its goal.', s => s.goalSmashed]
].map(([id, name, desc, cond]) => ({ id, name, desc, cond }));

const CONFLICTS = [
  ['const goblin = "hungry";', 'const goblin = "very hungry";'],
  ['timeout: 30', 'timeout: 3000'],
  ['return early;', 'return eventually;'],
  ['// TODO: fix later', '// FIXME: fix now'],
  ['retries = 3', 'retries = Infinity'],
  ['color: "green"', 'color: "pink"']
];

/* ---------- state ---------- */
let H = null, M = { total: 0, people: {}, log: [] };
const fresh = () => ({ lines: 0, total: 0, gold: 0, taps: 0, crits: 0, crew: {}, ups: {}, relics: {}, fed: {}, feasts: 0, deletedFed: 0,
  builds: 0, flaky: 0, conflicts: 0, squash: 0, squashes: 0, badges: {}, sawGuild: false, goalSmashed: false, buyAmt: 1, tab: 'crew', sound: false, last: Date.now() });
let S = fresh(), KEY = 'code-goblin';
const save = () => { S.last = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
function load() { try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch {} }

/* ---------- derived numbers ---------- */
const D = {};
function orgBonus() {
  if (!H) return 1;
  const g = H.month.merged / Math.max(1, H.month.goal);
  return (1 + 0.08 * (H.level - 1)) * (1 + 0.5 * clamp(g, 0, 1.5));
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
  D.org = orgBonus();
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

/* ---------- audio: a soft typewriter ---------- */
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
  gobEl.innerHTML = `<svg viewBox="0 -14 240 258" aria-hidden="true"><style>${goblinCSS('#gob')}</style>${defs('st', theme)}${goblin({ p: 'st', theme, level: lvl, mood, seed: lvl * 7 + 3 })}</svg>`;
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
  el.className = 'pop ' + cls; el.textContent = text;
  const r = $('.stage').getBoundingClientRect();
  el.style.left = (x - r.left) + 'px'; el.style.top = (y - r.top - 10) + 'px';
  $('.stage').appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function tap(x, y) {
  S.taps++;
  let v = tapValue();
  const crit = Math.random() < D.crit;
  if (crit) { v *= 10; S.crits++; }
  gain(v);
  advanceBuild(3.5 * D.build);
  gobEl.classList.add('squish'); setTimeout(() => gobEl.classList.remove('squish'), 80);
  if (crit) { popText(x, y, `+${fmt(v)}`, 'big'); setMood('happy', 0.6); clack(0.6, 0.4); }
  else { popText(x + rand(-18, 18), y, `+${fmt(v, true)}`); clack(rand(0.9, 1.3)); }
  if (navigator.vibrate) try { navigator.vibrate(crit ? 20 : 5); } catch {}
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

/* ---------- merge conflicts ---------- */
let conflictT = rand(45, 90), conflictLeft = 0;
function openConflict() {
  const [a, b] = pick(CONFLICTS);
  $('#conflictCode').innerHTML = `&lt;&lt;&lt;&lt;&lt;&lt;&lt; ours\n<span class="o">${esc(a)}</span>\n=======\n<span class="t">${esc(b)}</span>\n&gt;&gt;&gt;&gt;&gt;&gt;&gt; theirs`;
  $('#conflict').hidden = false; conflictLeft = 12; setMood('shock', 1);
  chime([64, 63]);
}
function resolveConflict(which) {
  $('#conflict').hidden = true; S.conflicts++;
  if (which === 'ours') { addBuff({ id: 'hotfix', name: 'Hotfix rush ×7 lines/s', lps: 7, t: 30 }); }
  else if (which === 'theirs') { addBuff({ id: 'coffee', name: 'Caffeinated ×25 taps', tap: 25, t: 12 }); }
  else { const v = lps() * 120 + tapValue() * 50; gain(v); S.gold += 3; toast('Both, obviously', `+${fmt(v)} lines and 3 gold.`); }
  setMood('happy', 1); chime([67, 71, 74, 79]);
  conflictT = rand(70, 150) * D.conflict;
}
document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => resolveConflict(b.dataset.pick)));
function addBuff(b) { buffs = buffs.filter(x => x.id !== b.id); buffs.push(b); renderBuffs(); }
function renderBuffs() { $('#buffs').innerHTML = buffs.map(b => `<span class="buff">${esc(b.name)} · ${Math.ceil(b.t)}s</span>`).join(''); }

/* ---------- feasting on real pull requests ---------- */
const unfed = () => (H?.feast || []).filter(p => !S.fed[p.id]);
function feastReward(p) {
  const size = p.additions + 2 * p.deletions + 20;
  return {
    lines: Math.max(size * 10 * D.all, lps() * 60 * (1 + Math.log10(size))),
    gold: Math.ceil((Math.ceil(p.deletions / 25) + 1) * (1 + 0.5 * (S.relics.tome || 0)))
  };
}
function feed(p, fromEl) {
  if (S.fed[p.id]) return;
  S.fed[p.id] = 1; S.feasts++; S.deletedFed += p.deletions;
  const r = feastReward(p);
  // Fly the scroll into the goblin's mouth, then chomp.
  const g = gobEl.getBoundingClientRect(), mouth = { x: g.left + g.width * 0.5, y: g.top + g.height * 0.45 };
  if (fromEl) {
    const s = fromEl.getBoundingClientRect(), fly = document.createElement('span');
    fly.className = 'scroll flyer'; fly.innerHTML = '<i></i>';
    fly.style.left = s.left + 'px'; fly.style.top = s.top + 'px';
    document.body.appendChild(fly);
    fly.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${mouth.x - s.left}px,${mouth.y - s.top}px) rotate(540deg) scale(.3)` }],
      { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' }).onfinish = () => fly.remove();
  }
  setTimeout(() => {
    gain(r.lines); S.gold += r.gold;
    setMood('chomp', 0.5); clack(0.5, 0.5);
    popText(mouth.x, mouth.y - 20, `+${fmt(r.lines)}`, 'big');
    popText(mouth.x + 60, mouth.y + 10, `+${r.gold} gold`, 'pink');
    toast(p.sealed ? 'A sealed scroll' : `@${p.author} · ${p.repo || ''}`, p.sealed ? 'Private work, devoured with respect.' : `“${p.title}” devoured.`);
    renderTray(); if (S.tab === 'feast') renderPanel();
  }, fromEl ? 520 : 0);
}
function renderTray() {
  const list = unfed().slice(0, 3);
  $('#tray').innerHTML = list.length ? list.map(p => `<button class="scroll" data-id="${esc(p.id)}" title="Feed this to the goblin"><i></i><span>${p.sealed ? 'sealed scroll' : esc(p.title)}</span></button>`).join('')
    : `<span class="kicker" style="color:var(--muted)">No fresh scrolls. New merges arrive every few hours.</span>`;
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
  el?.animate([{ background: 'color-mix(in srgb, var(--green) 30%, transparent)' }, { background: 'transparent' }], 400);
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
  if (n < 1 || !confirm(`Squash your hoard for ${n} squash token${n > 1 ? 's' : ''}? Lines, crew and upgrades reset. Gold, relics, badges and fed scrolls stay. Each token adds 10% to everything.`)) return;
  Object.assign(S, { lines: 0, crew: {}, ups: {}, squash: S.squash + n, squashes: S.squashes + 1 });
  recalc(); chime([60, 64, 67, 72, 76, 79, 84]); setMood('happy', 1.5); renderPanel();
}

/* ---------- panel ---------- */
const content = $('#content');
let rows = [], panelKey = '';
const ic = (g, pink) => `<span class="ic${pink ? ' pk' : ''}">${esc(g)}</span>`;
function renderPanel() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#buybar').hidden = S.tab !== 'crew';
  document.querySelectorAll('#buybar button').forEach(b => b.classList.toggle('on', String(S.buyAmt) === b.dataset.amt));
  rows = [];
  if (S.tab === 'crew') {
    const shown = CREW.filter((c, i) => i === 0 || (S.crew[CREW[i - 1].id] || 0) > 0 || S.total >= c.cost * 0.5);
    content.innerHTML = shown.map(c => `<button class="item" data-c="${c.id}">${ic(c.glyph)}<span class="tx"><span class="nm">${c.name}</span><span class="ds">${c.desc}</span><span class="mt"></span></span><span class="rt"><span class="own"></span><span class="cost"></span></span></button>`).join('')
      + (shown.length < CREW.length ? `<p class="note">Someone else is out there. Keep hoarding.</p>` : '');
    content.querySelectorAll('[data-c]').forEach(el => { const c = CREW.find(x => x.id === el.dataset.c); el.addEventListener('click', () => hire(c, el)); rows.push({ el, c }); });
  } else if (S.tab === 'upgrades') {
    const av = availUps();
    panelKey = av.map(u => u.id).join();
    content.innerHTML = av.length ? av.map(u => `<button class="item" data-u="${u.id}">${ic(u.glyph, true)}<span class="tx"><span class="nm">${esc(u.name)}</span><span class="ds">${esc(u.desc)}</span></span><span class="rt"><span class="cost">${fmt(u.cost)} lines</span></span></button>`).join('')
      : `<p class="empty">Nothing to upgrade yet. Tap, hire, feast.</p>`;
    content.querySelectorAll('[data-u]').forEach(el => { const u = UPS.find(x => x.id === el.dataset.u); el.addEventListener('click', () => buyUp(u)); rows.push({ el, u }); });
  } else if (S.tab === 'feast') {
    const list = H?.feast || [];
    content.innerHTML = `<p class="note">Every scroll is a pull request your org merged. Feed each one once for lines, and gold for every line it deleted. Deleting code is the goblin's favourite flavour.</p>`
      + (list.length ? list.map(p => {
        const fed = S.fed[p.id], r = feastReward(p);
        return `<button class="item${fed ? ' no' : ''}" data-f="${esc(p.id)}">
          ${p.avatar ? `<span class="duo"><img alt="" src="${esc(p.avatar)}&s=80" loading="lazy"></span>` : ic('§', true)}
          <span class="tx"><span class="nm">${p.sealed ? 'A sealed scroll' : esc(p.title)}</span>
          <span class="ds">${p.sealed ? 'from a private repo' : `@${esc(p.author)} · ${esc(p.repo)} #${p.number}`} · ${ago(p.mergedAt)}</span>
          <span class="mt">+${fmt(p.additions)} <span style="color:var(--pink)">−${fmt(p.deletions)}</span></span></span>
          <span class="rt"><span class="cost">${fed ? 'eaten' : `+${fmt(r.lines)}<br>+${r.gold} gold`}</span></span></button>`;
      }).join('') : `<p class="empty">The hoard is empty. Merge something tasty.</p>`);
    content.querySelectorAll('[data-f]').forEach(el => el.addEventListener('click', () => feed(H.feast.find(p => p.id === el.dataset.f), el)));
  } else if (S.tab === 'guild') {
    S.sawGuild = true;
    content.innerHTML = guildHTML();
  } else if (S.tab === 'vault') {
    const n = squashGain(), next = (S.squash + n + 1) ** 3 * 1e9;
    content.innerHTML = `<div class="sec">Relics · bought with gold</div>`
      + RELICS.map(r => { const lv = S.relics[r.id] || 0, maxed = r.max && lv >= r.max; return `<button class="item" data-r="${r.id}">${ic('✦', true)}<span class="tx"><span class="nm">${r.name} <span style="font-family:var(--mono);font-size:12px">lv ${lv}</span></span><span class="ds">${r.desc}</span></span><span class="rt"><span class="cost">${maxed ? 'max' : relicCost(r) + ' gold'}</span></span></button>`; }).join('')
      + `<div class="sec">Squash and merge</div><p class="note">Squash your whole history into tokens. You have <b>${S.squash}</b> (+${S.squash * 10}% to everything). Next token at ${fmt(next)} lifetime lines.</p>
        <div style="padding:0 14px 14px"><button class="btn solid" id="squashBtn" ${n < 1 ? 'disabled' : ''}>${n < 1 ? 'Not enough history yet' : `Squash for ${n} token${n > 1 ? 's' : ''}`}</button></div>
        <div class="sec">Your stats</div><dl class="kv">${[
          ['Lines hoarded, ever', fmt(S.total)], ['Taps', S.taps.toLocaleString('en-US')], ['Critical taps', S.crits], ['Pull requests eaten', S.feasts],
          ['Deleted lines eaten', fmt(S.deletedFed)], ['Builds passed', S.builds], ['Merge conflicts resolved', S.conflicts]
        ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p class="note">Progress saves in this browser. The org's hoard lives in the repo and updates every few hours.</p>`;
    content.querySelectorAll('[data-r]').forEach(el => { const r = RELICS.find(x => x.id === el.dataset.r); el.addEventListener('click', () => buyRelic(r)); rows.push({ el, r }); });
    $('#squashBtn')?.addEventListener('click', squash);
  } else if (S.tab === 'badges') {
    const got = BADGES.filter(b => S.badges[b.id]).length;
    content.innerHTML = `<p class="note">${got} of ${BADGES.length} badges. ${ACCESSORIES.filter(a => H && H.level >= a.level).length} of ${ACCESSORIES.length} goblin accessories unlocked by your org's level.</p>
      <div class="badges">${BADGES.map(b => `<div class="badge${S.badges[b.id] ? ' got' : ''}"><b>${b.name}</b><small>${b.desc}</small></div>`).join('')}</div>
      <div class="sec">Goblin wardrobe · unlocked by the whole org</div>
      <div class="badges">${ACCESSORIES.map(a => `<div class="badge${H && H.level >= a.level ? ' got' : ''}"><b>${a.name}</b><small>Org level ${a.level}</small></div>`).join('')}</div>`;
  }
  updatePanel();
}
function updatePanel() {
  for (const r of rows) {
    if (r.c) {
      const n = amtFor(r.c), cost = crewCost(r.c, n), each = r.c.lps * D.crew[r.c.id] * D.all, own = S.crew[r.c.id] || 0;
      r.el.classList.toggle('no', S.lines < cost);
      r.el.querySelector('.own').textContent = own || '';
      r.el.querySelector('.cost').textContent = `${fmt(cost)}${n > 1 ? ` ×${n}` : ''}`;
      r.el.querySelector('.mt').textContent = `+${fmt(each, true)}/s each${own ? ` · ${fmt(each * own, true)}/s total` : ''}`;
    } else if (r.u) r.el.classList.toggle('no', S.lines < r.u.cost);
    else if (r.r) r.el.classList.toggle('no', S.gold < relicCost(r.r) || (r.r.max && (S.relics[r.r.id] || 0) >= r.r.max));
  }
  if (S.tab === 'upgrades' && availUps().map(u => u.id).join() !== panelKey) renderPanel();
  const dot = (t, on) => $(`#tabs [data-tab=${t}] .dot`).classList.toggle('on', on);
  dot('upgrades', availUps().some(u => u.cost <= S.lines));
  dot('feast', unfed().length > 0);
  dot('vault', squashGain() >= 1 || RELICS.some(r => S.gold >= relicCost(r) && !(r.max && (S.relics[r.id] || 0) >= r.max)));
}
function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}

/* ---------- guild: the community view ---------- */
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
  if (!p) return `<div><small>UP FOR GRABS</small><b>Nobody yet</b></div>`;
  return `<span class="duo${pinkish ? ' pk' : ''}">${p.avatar ? `<img alt="" src="${esc(p.avatar)}&s=80" loading="lazy">` : ''}</span><b>@${esc(p.login)}</b>`;
}
function guildHTML() {
  if (!H) return `<p class="empty">The guild is still gathering.</p>`;
  const so = H.shoutouts, maxW = Math.max(1, ...H.weeks.map(w => w.merged));
  return `<div class="sec">${esc(H.month.label)} shout-outs</div>
    <div class="shout">
      <div><small>TOP FEEDER</small>${person(so.feeder)}${so.feeder ? `<small>${so.feeder.n} merged</small>` : ''}</div>
      <div><small>CLEANUP HERO</small>${person(so.cleanup, true)}${so.cleanup ? `<small>−${fmt(so.cleanup.n)} lines</small>` : ''}</div>
      <div><small>REVIEW SAGE</small>${person(so.sage)}${so.sage ? `<small>${so.sage.n} reviews</small>` : ''}</div>
    </div>
    ${so.fresh?.length ? `<div class="sec">Fresh faces this month</div><div class="people">${so.fresh.map(p => `<div class="person"><span class="duo pk">${p.avatar ? `<img alt="" src="${esc(p.avatar)}&s=80" loading="lazy">` : ''}</span><span>@${esc(p.login)}<small>first merge here. welcome!</small></span></div>`).join('')}</div>` : ''}
    <div class="sec">Merged pull requests per week</div>
    <div class="weeks">${H.weeks.map(w => `<div style="height:${(w.merged / maxW * 100).toFixed(1)}%" title="Week of ${w.start}: ${w.merged} merged, +${w.additions} −${w.deletions}"></div>`).join('')}</div>
    <div class="wl"><span>${H.weeks[0].start}</span><span>this week</span></div>
    <div class="sec">The guild · ${H.members.length} feeders</div>
    <div class="people">${H.members.map(m => `<div class="person"><span class="duo">${m.avatar ? `<img alt="" src="${esc(m.avatar)}&s=80" loading="lazy">` : ''}</span><span>@${esc(m.login)}<small>${m.merged} merged · ${m.reviews} reviews</small></span></div>`).join('')}</div>
    <div class="sec">Cheer the goblin on GitHub</div>
    <div class="cheer"><a class="btn" target="_blank" rel="noopener" href="${issueLink('feed')}">Feed</a><a class="btn" target="_blank" rel="noopener" href="${issueLink('pet')}">Pet</a><a class="btn solid" target="_blank" rel="noopener" href="${issueLink('cheer')}">Cheer</a></div>
    <div class="log">${M.total ? `<span>${M.total} moves from ${Object.keys(M.people).length} people</span>` + M.log.slice(0, 6).map(l => `<span>@${esc(l.who)} ${esc(l.what === 'pet' ? 'petted' : l.what === 'feed' ? 'fed' : 'cheered')} the goblin · ${ago(l.at)}</span>`).join('') : '<span>No cheers yet. Be the first.</span>'}</div>`;
}

/* ---------- toasts, badges ---------- */
function toast(title, body) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = `<b>${esc(title)}</b>${esc(body)}`;
  $('#toasts').appendChild(t);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => t.remove(), 3400);
}
function checkBadges() {
  if (H && H.month.merged >= H.month.goal) S.goalSmashed = true;
  for (const b of BADGES) if (!S.badges[b.id] && b.cond(S)) { S.badges[b.id] = 1; toast('Badge', b.name); chime([76, 79, 84]); }
}

/* ---------- org header ---------- */
function renderOrg() {
  if (!H) return;
  const pct = H.month.merged / Math.max(1, H.month.goal);
  $('#dek').innerHTML = `Meet <em>${esc(H.name)}</em>, the code goblin of <b>${esc(H.owner)}</b>. Every pull request your org merges is a meal, and the whole team feeds it.`;
  $('#issue').textContent = `Issue no. ${H.level} · ${new Date(H.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  $('#orgLvl').textContent = `LEVEL ${H.level}`;
  $('#goalTxt').textContent = `${H.month.label} feast: ${H.month.merged} of ${H.month.goal} merged PRs${pct >= 1 ? '. Goal smashed, everyone eats.' : ''}`;
  $('#goalBar i').style.width = Math.min(100, pct * 100) + '%';
  $('#goalBar').setAttribute('aria-valuenow', Math.round(pct * 100));
  $('#bonusN').textContent = '×' + D.org.toFixed(1);
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
  if ($('#conflict').hidden) { conflictT -= dt; if (conflictT <= 0 && !document.hidden) openConflict(); }
  else { conflictLeft -= dt; $('#conflictTick').style.transform = `scaleX(${Math.max(0, conflictLeft / 12)})`; if (conflictLeft <= 0) { $('#conflict').hidden = true; toast('Too slow', 'Someone else resolved it. Next time.'); conflictT = rand(70, 150) * D.conflict; } }
  uiAcc += raw; slowAcc += raw; saveAcc += raw;
  if (uiAcc > 0.08) {
    uiAcc = 0;
    $('#lines').textContent = `${big(S.lines)} lines`;
    $('#lps').textContent = fmt(lps(), true); $('#perTap').textContent = fmt(tapValue(), true); $('#gold').textContent = S.gold.toLocaleString('en-US');
    $('#buildBar').style.width = buildP + '%'; $('#buildName').textContent = `BUILD #${S.builds + 1}`;
    if (buildP > 0 && !/flaky/.test($('#buildState').textContent)) $('#buildState').textContent = 'compiling…';
    if (buildP < 1) $('#buildState').textContent = 'waiting for your taps';
  }
  if (slowAcc > 0.4) { slowAcc = 0; updatePanel(); checkBadges(); document.title = `${fmt(S.lines)} lines · Hoard`; }
  if (saveAcc > 8) { saveAcc = 0; save(); }
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
async function loadData() {
  const get = f => fetch(`data/${f}?t=${Math.floor(Date.now() / 6e4)}`).then(r => r.ok ? r.json() : null).catch(() => null);
  [H, M] = await Promise.all([get('hoard.json'), get('moves.json')]);
  M = M || { total: 0, people: {}, log: [] };
}
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.tab; content.scrollTop = 0; renderPanel(); }));
document.querySelectorAll('#buybar button').forEach(b => b.addEventListener('click', () => { S.buyAmt = b.dataset.amt === 'max' ? 'max' : +b.dataset.amt; renderPanel(); }));
$('#sound').addEventListener('click', () => { S.sound = !S.sound; $('#sound').textContent = S.sound ? 'Sound on' : 'Sound off'; if (S.sound) chime([72, 76]); });
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
  mood = H?.mood === 'happy' ? 'happy' : 'idle';
  drawGoblin(); renderOrg(); renderTray(); renderBuffs(); renderPanel();
  $('#sound').textContent = S.sound ? 'Sound on' : 'Sound off';
  const fresh = unfed().length;
  if (fresh) setTimeout(() => toast('Fresh scrolls', `${fresh} merged pull request${fresh > 1 ? 's are' : ' is'} waiting to be eaten.`), 1200);
  requestAnimationFrame(frame);
})();
