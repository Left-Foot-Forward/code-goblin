// Spending happens through GitHub Issue Forms. This parses a submitted issue, validates it
// against the ledger, and returns ledger entries plus the goblin's reply. Issue text is
// untrusted: it is only ever parsed, never executed or interpolated into a shell.
import { ROOMS, roomCost, findRoom } from './rooms.mjs';
import { dayOf, weekOf, built } from './ledger.mjs';

export const LABELS = {
  thanks: { to: 'Teammate', gold: 'Gold', note: 'What for?' },
  bounty: { repo: 'Repository', number: 'Issue number', gold: 'Gold', note: 'Note' },
  fund: { room: 'Room', scrolls: 'Scrolls', gold: 'Gold' }
};

// Issue Forms render as "### Label\n\nvalue" sections. Empty fields read "_No response_".
export function parseForm(body) {
  const out = {};
  const parts = String(body || '').replace(/\r\n/g, '\n').split(/^### (.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const v = parts[i + 1].trim();
    out[parts[i].trim()] = v === '_No response_' ? '' : v;
  }
  return out;
}

export function kindOf(title) {
  const m = /^goblin:\s*(thanks|thank|bounty|fund|cheer|pet|feed)\b/i.exec(String(title || '').trim());
  if (!m) return null;
  const k = m[1].toLowerCase();
  return k === 'thank' ? 'thanks' : k;
}

const amount = (s, { min = 1, max }) => {
  const t = String(s || '').trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  const n = +t;
  return n >= min && n <= max ? n : null;
};
const login = s => String(s || '').trim().replace(/^@/, '').replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const findByLogin = (state, l) => Object.values(state.people).find(p => p.login.toLowerCase() === l.toLowerCase()) || null;

const COOLDOWN = 10 * 60 * 1000;
const MOVE_REPLIES = {
  feed: ['*CHOMP.* Tastes like a well-scoped pull request.', 'Mmm. Crunchy, like a freshly deleted config file.'],
  pet: ['The goblin purrs like a CI runner on a green build.', '*leans into it.* Fine. You may stay.'],
  cheer: ['GOBLIN. GOBLIN. GOBLIN. The whole org can hear it.', 'The goblin does a small, dignified jig on the hoard.']
};

// issue: {id, number, title, body, createdAt, lastEditedAt, author:{id, login, avatar}, authorAssociation}
// ctx: {config, now, owner, isSpender(issue) async, lookupIssue(repo, number) async}
export async function processSpend(issue, state, ctx) {
  const { config, now } = ctx;
  const kind = kindOf(issue.title);
  const txid = `spend:${issue.id}`;
  const reject = reason => ({ entries: [], reply: `The goblin can't do that: ${reason}`, ok: false });
  if (!kind) return null;
  if (state.txids.has(txid) || state.txids.has(`${txid}:0`)) return { entries: [], reply: null, ok: true, already: true };
  if (!issue.author?.id) return reject('this request has no GitHub user behind it.');
  const me = issue.author;

  if (kind === 'cheer' || kind === 'pet' || kind === 'feed') {
    const p = state.people[me.id];
    if (p?.lastMoveAt && Date.parse(now) - Date.parse(p.lastMoveAt) < COOLDOWN) return reject(`it is still digesting your last visit. Try again in a few minutes.`);
    return { ok: true, entries: [{ txid, type: 'move', at: now, who: me, what: kind }], reply: MOVE_REPLIES[kind][issue.number % 2] };
  }

  if (issue.lastEditedAt) return reject('the request was edited after it was filed. Please file a fresh one.');
  if (!(await ctx.isSpender(issue))) return reject(`only members of ${ctx.owner} can spend here.`);
  const f = parseForm(issue.body), mine = state.people[me.id];

  if (kind === 'thanks') {
    const L = LABELS.thanks;
    const to = findByLogin(state, login(f[L.to]));
    const gold = amount(f[L.gold], { max: config.maxTransfer });
    const note = clean(f[L.note], 280);
    if (!to) return reject(`there is no purse for "${clean(f[L.to], 40)}" yet. They need to have earned something first.`);
    if (to.id === me.id) return reject('you cannot thank yourself, however deserved.');
    if (!gold) return reject(`gold must be a whole number from 1 to ${config.maxTransfer}.`);
    if (!mine || mine.gold < gold) return reject(`you have ${mine?.gold || 0} gold, which isn't enough to give ${gold}.`);
    const today = state.thanks.filter(t => t.from === mine.login && dayOf(t.at) === dayOf(now)).length;
    if (today >= config.thanksPerDay) return reject(`you have already sent ${config.thanksPerDay} thanks today. Save some for tomorrow.`);
    const toWho = { id: to.id, login: to.login, avatar: to.avatar };
    const entries = [{ txid, type: 'thanks', at: now, from: me, to: toWho, gold, note, issue: issue.number }];
    let extra = '';
    if (built(state, 'tavern')) {
      const pairThisWeek = state.thanks.some(t => t.match > 0 && t.from === mine.login && t.to === to.login && weekOf(t.at) === weekOf(now));
      const m = Math.min(5, Math.ceil(gold / 2), state.treasury.gold);
      if (!pairThisWeek && m > 0) { entries.push({ txid: `${txid}:match`, type: 'match', at: now, to: toWho, gold: m, issue: issue.number }); extra = ` The Tavern added ${m} more from the treasury.`; }
    }
    return { ok: true, entries, mention: to.login, reply: `@${to.login} has been thanked with ${gold} gold.${extra} The note is on the thanks wall.` };
  }

  if (kind === 'bounty') {
    const L = LABELS.bounty;
    const gold = amount(f[L.gold], { max: config.maxTransfer * 5 });
    const number = amount(String(f[L.number] || '').replace(/^#/, ''), { max: 999999 });
    let repo = clean(f[L.repo], 140).replace(/^https:\/\/github\.com\//, '');
    const urlMatch = /^([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/.exec(repo);
    let n = number;
    if (urlMatch) { repo = `${urlMatch[1]}/${urlMatch[2]}`; n = n || +urlMatch[3]; }
    if (!repo.includes('/')) repo = `${ctx.owner}/${repo}`;
    if (repo.split('/')[0].toLowerCase() !== ctx.owner.toLowerCase()) return reject(`bounties can only go on issues in ${ctx.owner}.`);
    if (!n) return reject('the issue number is missing.');
    if (!gold) return reject(`gold must be a whole number from 1 to ${config.maxTransfer * 5}.`);
    if (!mine || mine.gold < gold) return reject(`you have ${mine?.gold || 0} gold, which isn't enough to post ${gold}.`);
    const target = await ctx.lookupIssue(repo, n);
    if (!target) return reject(`${repo}#${n} isn't an issue the goblin can see. Pull requests can't take bounties.`);
    if (target.state !== 'OPEN') return reject(`${repo}#${n} is already closed.`);
    if (target.private && !config.allowPrivateBounties) return reject('bounties on private repos are switched off for this org.');
    const expires = new Date(Date.parse(now) + config.bountyExpiryDays * 864e5).toISOString();
    const t = { repo: repo.split('/')[1], number: n, nodeId: target.id, private: !!target.private, title: target.private ? null : clean(target.title, 120), url: target.private ? null : target.url };
    return { ok: true, entries: [{ txid, type: 'bounty-open', at: now, from: me, gold, target: t, note: clean(f[L.note], 200), expires }],
      reply: `A bounty of ${gold} gold now sits on ${target.private ? 'a private issue' : `${repo}#${n}`}. It goes to whoever's merged pull request closes it, and comes back to you if it's closed as not planned or still open on ${dayOf(expires)}.` };
  }

  if (kind === 'fund') {
    const L = LABELS.fund;
    const room = findRoom(f[L.room]);
    if (!room) return reject(`there's no room called "${clean(f[L.room], 40)}". Choose one of: ${ROOMS.map(r => r.name).join(', ')}.`);
    const r = state.rooms[room.id], cost = roomCost(room, config);
    if (r.builtAt) return reject(`the ${room.name} is already built.`);
    const needS = Math.max(0, cost.scrolls - r.scrolls), needG = Math.max(0, cost.gold - r.gold);
    let scrolls = f[L.scrolls] ? amount(f[L.scrolls], { min: 0, max: 100000 }) : 0;
    let gold = f[L.gold] ? amount(f[L.gold], { min: 0, max: 100000 }) : 0;
    if (scrolls === null || gold === null) return reject('scrolls and gold must be whole numbers.');
    // Never take more than the room still needs (the treasury match counts toward it too).
    scrolls = Math.min(scrolls, needS); gold = Math.min(gold, needG);
    if (!scrolls && !gold) return reject(`the ${room.name} doesn't need that. It still needs ${needS} scrolls and ${needG} gold.`);
    if (!mine || mine.scrolls < scrolls || mine.gold < gold) return reject(`you have ${mine?.scrolls || 0} scrolls and ${mine?.gold || 0} gold.`);
    const match = { scrolls: Math.min(scrolls, state.treasury.scrolls, needS - scrolls), gold: Math.min(gold, state.treasury.gold, needG - gold) };
    const done = r.scrolls + scrolls + match.scrolls >= cost.scrolls && r.gold + gold + match.gold >= cost.gold;
    return { ok: true, entries: [{ txid, type: 'fund', at: now, from: me, room: room.id, scrolls, gold, match }],
      reply: `You put ${scrolls} scrolls and ${gold} gold into the ${room.name}${match.scrolls || match.gold ? `, and the treasury matched ${match.scrolls} scrolls and ${match.gold} gold` : ''}.`
        + (done ? ` The ${room.name} is built! ${room.unlock}` : ` It now has ${r.scrolls + scrolls + match.scrolls}/${cost.scrolls} scrolls and ${r.gold + gold + match.gold}/${cost.gold} gold.`) };
  }
  return null;
}
