// The Den: a read-only view of the org's ledger. Nothing here changes state; every action
// opens a pre-filled GitHub issue form, so spending is always done on GitHub, as you.
import { goblin, den, defs, goblinCSS, esc } from './goblin.js';

const $ = s => document.querySelector(s);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : Number(n || 0).toLocaleString('en-US');
const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const ago = iso => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  return s < 3600 ? `${Math.max(1, Math.floor(s / 60))}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};
const duo = (p, pinkish) => `<span class="duo${pinkish ? ' pk' : ''}">${p?.avatar ? `<img alt="" src="${esc(p.avatar)}${p.avatar.includes('?') ? '&' : '?'}s=96" loading="lazy">` : ''}</span>`;
const KEY = 'hoard-den';
let R = null, prefs = { me: '', spend: 'thanks', board: 'feed' };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };

function repoSlug() {
  if (R?.repo) return R.repo;
  const h = location.hostname;
  return h.endsWith('.github.io') ? `${h.split('.')[0]}/${location.pathname.split('/')[1] || ''}` : null;
}
function formURL(template, fields = {}) {
  const slug = repoSlug();
  if (!slug) return '#';
  const q = new URLSearchParams({ template: `${template}.yml` });
  for (const [k, v] of Object.entries(fields)) if (v !== '' && v != null) q.set(k, v);
  return `https://github.com/${slug}/issues/new?${q}`;
}

/* ---------- the stage ---------- */
let drawn = '';
function drawStage() {
  const theme = dark() ? 'dark' : 'light', built = R.rooms.filter(r => r.builtAt).map(r => r.id), key = theme + R.level + built.join();
  if (key === drawn) return;
  drawn = key;
  $('#gob').innerHTML = `<svg viewBox="0 -14 240 258" aria-hidden="true" focusable="false"><style>${goblinCSS('#gob')}</style>${defs('st', theme)}${den({ p: 'st', theme, built })}${goblin({ p: 'st', theme, level: R.level, mood: R.mood, seed: R.level * 7 + 3 })}</svg>`;
  $('#gob').setAttribute('aria-label', `${R.name} the goblin, level ${R.level}, in a Den with ${plural(built.length, 'room')} built: ${built.length ? R.rooms.filter(r => r.builtAt).map(r => r.name).join(', ') : 'none yet'}.`);
}
$('#gob').addEventListener('pointermove', e => {
  const svg = $('#gob svg'), pupils = $('#gob .g-pupils');
  if (!svg || !pupils) return;
  const r = svg.getBoundingClientRect(), cl = (v, a, b) => Math.min(b, Math.max(a, v));
  pupils.setAttribute('transform', `translate(${(cl((e.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1) * 3.2).toFixed(2)} ${(cl((e.clientY - r.top - r.height * 0.37) / (r.height / 2), -1, 1) * 2.6).toFixed(2)})`);
});
const bar = (have, need, label, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${have}"><i style="width:${Math.min(100, have / Math.max(1, need) * 100).toFixed(1)}%"></i></div>`;

function renderStage() {
  drawStage();
  $('#treasury').textContent = `${fmt(R.treasury.gold)} gold`;
  $('#treasuryScrolls').textContent = fmt(R.treasury.scrolls);
  $('#lvl').textContent = `LEVEL ${R.level}`;
  $('#scrollsAll').textContent = fmt(R.scrollsAll);
  const room = R.rooms.find(r => r.id === R.current);
  $('#building').innerHTML = room ? `
    <div class="row"><b>Building the ${esc(room.name)}</b><a class="btn solid" href="${formURL('fund', { room: room.name })}" target="_blank" rel="noopener">Fund it<span class="sr"> (opens GitHub)</span></a></div>
    <p class="note" style="padding:0">${esc(room.unlock)}</p>
    <div class="need"><span>Scrolls ${room.funded.scrolls} of ${room.cost.scrolls}</span>${bar(room.funded.scrolls, room.cost.scrolls, `${room.name} scrolls`, 'green')}</div>
    <div class="need"><span>Gold ${room.funded.gold} of ${room.cost.gold}</span>${bar(room.funded.gold, room.cost.gold, `${room.name} gold`)}</div>
    <p class="note" style="padding:0">The treasury matches whatever you put in, while it has funds.</p>`
    : `<div class="row"><b>The Den is complete.</b></div><p class="note" style="padding:0">Every room is built. Legendary teamwork.</p>`;
}

/* ---------- spend: small forms that open GitHub's issue form, pre-filled ---------- */
function renderSpend() {
  document.querySelectorAll('#spendTabs [role=tab]').forEach(b => { const on = b.dataset.tab === prefs.spend; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  $('#spendPanel').setAttribute('aria-labelledby', `st-${prefs.spend}`);
  const people = [...R.people].sort((a, b) => a.login.localeCompare(b.login)).filter(p => p.login !== prefs.me);
  const max = R.config.maxTransfer;
  const forms = {
    thanks: `<p class="note">Send gold to someone who helped, with a public note for the thanks wall.${R.rooms.find(r => r.id === 'tavern')?.builtAt ? ' The Tavern tops it up by half, up to 5 gold.' : ''}</p>
      <form class="mini" data-template="thanks">
        <label>Teammate<select name="to" required><option value="">choose…</option>${people.map(p => `<option>${esc(p.login)}</option>`).join('')}</select></label>
        <label>Gold<input name="gold" type="number" min="1" max="${max}" value="5" required></label>
        <label class="full">What for?<input name="note" maxlength="280" placeholder="Unblocking the release"></label>
        <button class="btn solid full">Continue on GitHub<span class="sr"> (opens GitHub)</span></button></form>`,
    bounty: `<p class="note">Put gold on an issue. It goes to whoever's merged pull request closes it, or back to you if it's closed as not planned or still open after ${R.config.bountyExpiryDays} days.</p>
      <form class="mini" data-template="bounty">
        <label>Repository<input name="repo" required placeholder="web" list="repoList"></label>
        <datalist id="repoList">${R.districts.map(d => `<option>${esc(d.repo)}</option>`).join('')}</datalist>
        <label>Issue number<input name="number" type="number" min="1" required placeholder="512"></label>
        <label>Gold<input name="gold" type="number" min="1" max="${max * 5}" value="20" required></label>
        <label class="full">Note<input name="note" maxlength="200" placeholder="Why it matters"></label>
        <button class="btn solid full">Continue on GitHub<span class="sr"> (opens GitHub)</span></button></form>`,
    fund: `<p class="note">Put scrolls and gold toward a room. The treasury matches what you give, while it has funds.</p>
      <form class="mini" data-template="fund">
        <label class="full">Room<select name="room">${R.rooms.filter(r => !r.builtAt).map(r => `<option ${r.id === R.current ? 'selected' : ''}>${esc(r.name)}</option>`).join('') || '<option>All rooms are built</option>'}</select></label>
        <label>Scrolls<input name="scrolls" type="number" min="0" value="2"></label>
        <label>Gold<input name="gold" type="number" min="0" value="10"></label>
        <button class="btn solid full">Continue on GitHub<span class="sr"> (opens GitHub)</span></button></form>`
  };
  $('#spendPanel').innerHTML = forms[prefs.spend] + `<p class="note" style="padding-top:0">GitHub opens with the form filled in. Submit it there and the goblin handles it in a few minutes.</p>`;
  $('#spendPanel form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, data = Object.fromEntries(new FormData(f));
    window.open(formURL(f.dataset.template, data), '_blank', 'noopener');
  });
}

/* ---------- this week ---------- */
function renderWeek() {
  const w = R.thisWeek;
  const quests = R.quests.length ? `<ul class="quests">${R.quests.map(q => `<li class="${q.done || q.progress >= q.target ? 'done' : ''}">
      <span>${esc(q.title)}</span>${bar(q.progress, q.target, q.title, 'green')}<small>${q.done ? 'Done, rewards paid' : `${q.progress} of ${q.target}`}</small></li>`).join('')}</ul>
      <p class="note">Finish a quest and the treasury gets 30 gold, plus 5 gold for everyone who helped.</p>`
    : `<p class="note">Weekly quests start once the team builds the <b>Library</b>.</p>`;
  $('#week').innerHTML = `<p class="stats-line"><b>${w.merges}</b> merged · <b>${w.reviews}</b> reviews · <b>${w.issues}</b> issues solved · <b>${w.comments}</b> comments${w.people ? ` · from ${plural(w.people, 'person', 'people')}` : ''}</p>${quests}`;
}

/* ---------- your purse ---------- */
function renderPurse() {
  const sel = $('#whoami');
  sel.innerHTML = `<option value="">pick your GitHub name…</option>` + [...R.people].sort((a, b) => a.login.localeCompare(b.login)).map(p => `<option ${p.login === prefs.me ? 'selected' : ''}>${esc(p.login)}</option>`).join('');
  const p = R.people.find(x => x.login === prefs.me);
  if (!p) { $('#purse').innerHTML = `<p class="note">Not listed? You'll appear after your first merged pull request, review, comment or resolved issue${R.config.creditPrivateWork ? '' : ' in a public repo'}.</p>`; return; }
  const m = p.month || { gold: 0, scrolls: 0, merges: 0, reviews: 0, comments: 0, issues: 0, thanksIn: 0, thanksOut: 0, private: 0 };
  const myBounties = [...R.bounties.open.filter(b => b.from === p.login), ...R.bounties.settled.filter(b => b.from === p.login || b.to === p.login)];
  const thanksIn = R.thanks.filter(t => t.to === p.login).slice(0, 4);
  $('#purse').innerHTML = `<div class="you">
    <div class="who">${duo(p)}<span><b>@${esc(p.login)}</b><small>has ${fmt(p.gold)} gold and ${plural(p.scrolls, 'scroll')} to spend</small></span></div>
    <div class="stats">
      <div><b>${m.merges}</b><small>merged this month</small></div>
      <div><b>${m.reviews}</b><small>${m.reviews === 1 ? 'review' : 'reviews'}</small></div>
      <div><b>${m.issues}</b><small>issues solved</small></div>
      <div><b>${m.comments}</b><small>comments</small></div>
    </div>
    <p class="share">This month you earned <b>${m.gold} gold</b> and <b>${plural(m.scrolls, 'scroll')}</b>${m.private ? ` (${m.private} gold of it from private work)` : ''}. You've given ${m.thanksOut} gold in thanks and received ${m.thanksIn}.</p>
    ${thanksIn.length ? `<div><span class="kicker">Recent thanks to you</span><ul class="wall compact">${thanksIn.map(t => `<li><b>@${esc(t.from)}</b> · ${t.gold} gold${t.match ? ` (+${t.match} Tavern)` : ''}${t.note ? `<q>${esc(t.note)}</q>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${myBounties.length ? `<div><span class="kicker">Your bounties</span><ul class="wall compact">${myBounties.map(b => `<li>${b.gold} gold on ${target(b.target)} · ${b.status ? (b.status === 'paid' ? (b.to === p.login ? 'you claimed it' : `paid to @${esc(b.to)}`) : `refunded, ${esc(b.reason || '')}`) : 'open'}</li>`).join('')}</ul></div>` : ''}
    <div class="row"><a class="btn" target="_blank" rel="noopener" href="${formURL('thanks')}">Thank someone<span class="sr"> (opens GitHub)</span></a><a class="btn" target="_blank" rel="noopener" href="${formURL('fund', { room: R.rooms.find(r => r.id === R.current)?.name || '' })}">Fund a room<span class="sr"> (opens GitHub)</span></a></div>
  </div>`;
}
const target = t => t?.private ? 'a private issue' : t?.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.repo)}#${t.number}</a>${t.title ? ` · ${esc(t.title)}` : ''}` : `${esc(t?.repo || '')}#${t?.number || ''}`;

/* ---------- how to earn ---------- */
function renderEarn() {
  const r = R.config.rewards;
  const rows = [
    ['Get a pull request merged', `${plural(r.merge.scrolls, 'scroll')} and ${r.merge.gold} gold, plus up to ${r.merge.sizeGoldMax} for size and ${r.merge.deleteGoldMax} for deleting code`],
    ['Approve or request changes on someone else\'s pull request', `${r.review.decisive} gold (${r.review.comment} for a comment-only review)`],
    ['Comment on an issue or pull request', `${r.comment.gold} gold, up to ${r.comment.perDay} a day`],
    ['Resolve an issue (your merged PR or commit closes it, or you\'re assigned)', `${plural(r.issueClosed.scrolls, 'scroll')} and ${r.issueClosed.gold} gold`],
    ['Start a new repo', `${r.newRepo.treasury} gold for the shared treasury`]
  ];
  $('#earn').innerHTML = `<table class="earn"><thead><tr><th scope="col">What you do on GitHub</th><th scope="col">What you earn</th></tr></thead><tbody>
    ${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>
    <p class="note">${R.config.creditPrivateWork ? 'Work in private repos earns too, shown only as amounts.' : 'Work in private repos fills the shared treasury instead, anonymously.'} Bots never earn, and self-reviews don't count.
    ${R.config.spenders === 'members' ? `Only members of ${esc(R.owner)} can spend.` : 'Anyone who has earned can spend.'}</p>`;
}

/* ---------- boards ---------- */
const FEED = {
  merge: f => `<b>@${esc(f.who)}</b> merged ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.title)}</a>` : esc(f.title)} in ${esc(f.repo)} <span class="diff">+${fmt(f.add)} <span class="del">−${fmt(f.del)}</span></span>`,
  issue: f => `<b>@${esc(f.who)}</b> resolved ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.title)}</a>` : esc(f.title)} in ${esc(f.repo)}`,
  repo: f => `A new repo appeared: <b>${esc(f.repo)}</b>. The treasury grows.`,
  thanks: f => `<b>@${esc(f.who)}</b> thanked <b>@${esc(f.to)}</b> with ${f.gold} gold${f.note ? `<q>${esc(f.note)}</q>` : ''}`,
  bounty: f => `<b>@${esc(f.who)}</b> put a ${f.gold} gold bounty on ${f.target ? target(f.target) : 'a private issue'}`,
  'bounty-paid': f => `<b>@${esc(f.who)}</b> claimed a ${f.gold} gold bounty on ${f.target ? target(f.target) : 'a private issue'}`,
  fund: f => `<b>@${esc(f.who)}</b> put ${f.scrolls} scrolls and ${f.gold} gold into the ${esc(roomName(f.room))}${f.match && (f.match.gold || f.match.scrolls) ? `, matched by the treasury` : ''}`,
  room: f => `The <b>${esc(roomName(f.room))}</b> is built! ${esc(R.rooms.find(r => r.id === f.room)?.unlock || '')}`,
  quest: f => `Quest complete${f.week ? ` for week ${+f.week.slice(-2)}` : ''}: <b>${esc(f.title)}</b>. ${plural(f.people, 'helper')} rewarded.`,
  move: f => `<b>@${esc(f.who)}</b> ${f.what === 'pet' ? 'petted' : f.what === 'feed' ? 'fed' : 'cheered'} the goblin`
};
const roomName = id => R.rooms.find(r => r.id === id)?.name || id;

function renderBoard() {
  document.querySelectorAll('#boardTabs [role=tab]').forEach(b => { const on = b.dataset.tab === prefs.board; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  $('#board').setAttribute('aria-labelledby', `bt-${prefs.board}`);
  const B = {
    feed: () => R.feed.length ? `<ul class="feed">${R.feed.slice(0, 60).map(f => `<li class="k-${f.kind}"><span>${(FEED[f.kind] || (() => esc(f.kind)))(f)}</span><time datetime="${f.at}">${ago(f.at)}</time></li>`).join('')}</ul>`
      : `<p class="empty">Nothing yet. Merge, review or comment and it shows up here.</p>`,
    people: () => `<p class="note">Ordered by gold earned all-time. Balances are what each person has left to spend.</p><div class="people">${R.people.map(p => `<div class="person">${duo(p, p.login === prefs.me)}<span>@${esc(p.login)}${p.login === prefs.me ? ' (you)' : ''}<small>${fmt(p.gold)} gold · ${plural(p.scrolls, 'scroll')} · ${p.counts.merges} merged · ${plural(p.counts.reviews, 'review')}</small></span></div>`).join('') || '<p class="empty">Nobody has earned yet.</p>'}</div>`,
    thanks: () => R.thanks.length ? `<ul class="wall">${R.thanks.map(t => `<li><b>@${esc(t.from)}</b> → <b>@${esc(t.to)}</b> · ${t.gold} gold${t.match ? ` <span class="tag">+${t.match} Tavern</span>` : ''}${t.note ? `<q>${esc(t.note)}</q>` : ''}<time datetime="${t.at}">${ago(t.at)}</time></li>`).join('')}</ul>`
      : `<p class="empty">No thanks yet. <a href="${formURL('thanks')}" target="_blank" rel="noopener">Be the first.</a></p>`,
    bounties: () => `<div class="sec">Open</div>${R.bounties.open.length ? `<ul class="wall">${R.bounties.open.map(b => `<li><b>${b.gold} gold</b> on ${target(b.target)} · from @${esc(b.from)}${b.note ? `<q>${esc(b.note)}</q>` : ''}<time datetime="${b.expires}">expires ${b.expires.slice(0, 10)}</time></li>`).join('')}</ul>` : `<p class="note">No open bounties. <a href="${formURL('bounty')}" target="_blank" rel="noopener">Post one.</a></p>`}
      <div class="sec">Settled</div>${R.bounties.settled.length ? `<ul class="wall">${R.bounties.settled.map(b => `<li><b>${b.gold} gold</b> on ${target(b.target)} · ${b.status === 'paid' ? `claimed by @${esc(b.to)} via ${esc(b.via)}` : `refunded to @${esc(b.from)}, ${esc(b.reason)}`}</li>`).join('')}</ul>` : '<p class="note">None settled yet.</p>'}`,
    rooms: () => `<ul class="rooms">${R.rooms.map(r => `<li class="${r.builtAt ? 'built' : r.id === R.current ? 'now' : ''}">
        <b>${esc(r.name)}</b><span>${esc(r.unlock)}</span>
        ${r.builtAt ? `<small>Built ${r.builtAt.slice(0, 10)}</small>` : `<div class="need"><span>${r.funded.scrolls}/${r.cost.scrolls} scrolls</span>${bar(r.funded.scrolls, r.cost.scrolls, `${r.name} scrolls`, 'green')}</div><div class="need"><span>${r.funded.gold}/${r.cost.gold} gold</span>${bar(r.funded.gold, r.cost.gold, `${r.name} gold`)}</div>
          <a class="btn" href="${formURL('fund', { room: r.name })}" target="_blank" rel="noopener">Fund the ${esc(r.name)}<span class="sr"> (opens GitHub)</span></a>`}</li>`).join('')}</ul>
      ${R.plaques.length ? `<div class="sec">Hall of Fame</div><ul class="wall">${R.plaques.map(p => `<li><b>${esc(p.month)}</b> · ${p.entries.map(e => `${esc(e.title)}: @${esc(e.login)} (${e.n})`).join(' · ')}</li>`).join('')}</ul>` : ''}`,
    teams: () => {
      const max = Math.max(1, ...R.teams.map(t => t.merges));
      return `<div class="sec">Teams · merges in the last 13 weeks</div><div class="teams">${R.teams.map(t => `<div class="team"><span>${esc(t.name)}</span>${bar(t.merges, max, `${t.name} merges`)}<em>${t.merges}</em></div>`).join('') || '<p class="note">No merges yet.</p>'}</div>
        <div class="sec">Districts · public repos</div><div class="people">${R.districts.map(d => `<div class="person"><span><b>${esc(d.repo)}</b><small>${d.merges || 0} merged · ${d.issues || 0} solved · ${d.reviews || 0} reviews</small></span></div>`).join('') || '<p class="note">No public repo activity yet.</p>'}</div>
        <div class="sec">Merged pull requests per week</div>
        <div class="weeks" role="img" aria-label="Merged pull requests per week for the last 13 weeks: ${R.weeks.map(w => w.merges).join(', ')}.">${R.weeks.map(w => { const mx = Math.max(1, ...R.weeks.map(x => x.merges)); return `<div style="height:${(w.merges / mx * 100).toFixed(1)}%" title="${w.week}: ${w.merges} merged"></div>`; }).join('')}</div>
        <div class="wl"><span>${R.weeks[0].week}</span><span>this week</span></div>`;
    }
  };
  $('#board').innerHTML = B[prefs.board]();
}

/* ---------- tabs (shared keyboard behaviour) ---------- */
function tabs(list, key, render) {
  const btns = [...document.querySelectorAll(`${list} [role=tab]`)];
  btns.forEach((b, i) => {
    b.addEventListener('click', () => { prefs[key] = b.dataset.tab; savePrefs(); render(); });
    b.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: btns.length - 1 - i }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      const next = btns[(i + k + btns.length) % btns.length];
      prefs[key] = next.dataset.tab; savePrefs(); render(); next.focus();
    });
  });
}

/* ---------- boot ---------- */
(async () => {
  R = await fetch(`data/realm.json?t=${Math.floor(Date.now() / 6e4)}`).then(r => r.ok ? r.json() : null).catch(() => null);
  const slug = repoSlug();
  $('#srcLink').href = slug ? `https://github.com/${slug}` : '#';
  $('#ledgerLink').href = slug ? `https://github.com/${slug}/tree/main/docs/data/ledger` : '#';
  if (!R) { $('#empty').hidden = false; document.querySelectorAll('main, .card.wide').forEach(e => e.hidden = true); return; }
  $('#demo').hidden = !R.demo;
  $('#dek').innerHTML = `Meet <em>${esc(R.name)}</em>, the code goblin of <b>${esc(R.owner)}</b>. Everything here was earned by real teamwork on GitHub, and is spent there too.`;
  $('#how1').textContent = `Merge, review, comment and resolve issues in ${R.owner}. The goblin pays whoever did it, every couple of hours.`;
  $('#issue').textContent = `Updated ${ago(R.generatedAt)}`;
  document.title = `Hoard · ${R.name}'s Den · ${R.owner}`;
  if (!R.people.some(p => p.login === prefs.me)) prefs.me = prefs.me || '';
  renderStage(); renderSpend(); renderWeek(); renderPurse(); renderEarn(); renderBoard();
  tabs('#spendTabs', 'spend', renderSpend);
  tabs('#boardTabs', 'board', renderBoard);
  $('#whoami').addEventListener('change', e => { prefs.me = e.target.value; savePrefs(); renderPurse(); renderSpend(); if (prefs.board === 'people') renderBoard(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { drawn = ''; drawStage(); });
})();
