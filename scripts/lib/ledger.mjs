// The ledger is an append-only log (docs/data/ledger/YYYY-MM.jsonl), one transaction per line,
// each with a unique txid. Every other data file is rebuilt from it by apply(), so a lost
// derived file can never lose money and a replayed transaction is ignored.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOMS, roomCost } from './rooms.mjs';

export const monthOf = iso => iso.slice(0, 7);
export const dayOf = iso => iso.slice(0, 10);
// ISO week key, e.g. 2026-W44 (weeks start Monday).
export function weekOf(iso) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear(), start = Date.UTC(y, 0, 1);
  return `${y}-W${String(Math.ceil(((d - start) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}

export function readLedger(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort()
    .flatMap(f => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
}
export function appendLedger(dir, entries) {
  mkdirSync(dir, { recursive: true });
  for (const e of entries) appendFileSync(join(dir, `${monthOf(e.at)}.jsonl`), JSON.stringify(e) + '\n');
}

const blankCounts = () => ({ merges: 0, reviews: 0, comments: 0, issues: 0 });
export function emptyState(config) {
  return {
    config,
    txids: new Set(),
    people: {},
    treasury: { gold: 0, scrolls: 0 },
    scrollsAll: 0,
    rooms: Object.fromEntries(ROOMS.map(r => [r.id, { scrolls: 0, gold: 0, builtAt: null }])),
    bounties: {},
    thanks: [],
    feed: [],
    moves: { total: 0, people: {}, kinds: {} },
    weeks: {},
    months: {},
    quests: {},
    plaques: [],
    retros: {}
  };
}

export function person(state, who) {
  if (!who?.id) throw new Error('ledger entry without a person id');
  const p = state.people[who.id] ||= { id: who.id, login: who.login, avatar: who.avatar || null, gold: 0, scrolls: 0,
    earned: { gold: 0, scrolls: 0 }, counts: blankCounts(), months: {}, thanksIn: 0, thanksOut: 0, lastMoveAt: null };
  if (who.login) p.login = who.login;
  if (who.avatar) p.avatar = who.avatar;
  return p;
}
const monthStats = (p, m) => p.months[m] ||= { gold: 0, scrolls: 0, ...blankCounts(), thanksIn: 0, thanksOut: 0, private: 0 };
const pushFeed = (state, item) => { state.feed.push(item); if (state.feed.length > 300) state.feed.splice(0, state.feed.length - 300); };
const roomBuilt = (state, id) => !!state.rooms[id]?.builtAt;
export const built = roomBuilt;

// Applies one ledger entry. Pure bookkeeping: no network, no clock.
export function apply(state, e) {
  if (state.txids.has(e.txid)) return state;
  state.txids.add(e.txid);
  const m = monthOf(e.at);
  switch (e.type) {
    case 'earn': {
      const p = person(state, e.who), ms = monthStats(p, m);
      p.gold += e.gold; p.scrolls += e.scrolls; p.earned.gold += e.gold; p.earned.scrolls += e.scrolls;
      ms.gold += e.gold; ms.scrolls += e.scrolls;
      if (e.private) ms.private += e.gold;
      for (const k of Object.keys(blankCounts())) { p.counts[k] += e.counts?.[k] || 0; ms[k] += e.counts?.[k] || 0; }
      state.scrollsAll += e.scrolls;
      break;
    }
    case 'treasury':
      state.treasury.gold += e.gold || 0; state.treasury.scrolls += e.scrolls || 0; state.scrollsAll += e.scrolls || 0;
      break;
    case 'activity': {
      const w = state.weeks[e.week] ||= { merges: 0, reviews: 0, comments: 0, issues: 0, oldIssues: 0, netNegative: 0, newRepos: 0, repos: {}, teams: {}, people: {} };
      const mo = state.months[m] ||= { merges: 0, reviews: 0, comments: 0, issues: 0, newRepos: 0 };
      for (const k of ['merges', 'reviews', 'comments', 'issues', 'oldIssues', 'netNegative', 'newRepos']) w[k] += e.counts?.[k] || 0;
      for (const k of ['merges', 'reviews', 'comments', 'issues', 'newRepos']) mo[k] += e.counts?.[k] || 0;
      for (const [r, c] of Object.entries(e.repos || {})) { const t = w.repos[r] ||= blankCounts(); for (const k in c) t[k] = (t[k] || 0) + c[k]; }
      for (const [r, n] of Object.entries(e.teams || {})) w.teams[r] = (w.teams[r] || 0) + n;
      for (const [k, ids] of Object.entries(e.people || {})) w.people[k] = [...new Set([...(w.people[k] || []), ...ids])];
      for (const it of e.items || []) pushFeed(state, it);
      break;
    }
    case 'thanks': {
      const from = person(state, e.from), to = person(state, e.to);
      from.gold -= e.gold; to.gold += e.gold; from.thanksOut += e.gold; to.thanksIn += e.gold;
      monthStats(from, m).thanksOut += e.gold; monthStats(to, m).thanksIn += e.gold;
      state.thanks.push({ at: e.at, from: e.from.login, to: e.to.login, gold: e.gold, note: e.note, match: 0, issue: e.issue });
      pushFeed(state, { at: e.at, kind: 'thanks', who: e.from.login, to: e.to.login, gold: e.gold, note: e.note });
      break;
    }
    case 'match': {
      const to = person(state, e.to);
      state.treasury.gold -= e.gold; to.gold += e.gold; to.thanksIn += e.gold; monthStats(to, m).thanksIn += e.gold;
      const t = [...state.thanks].reverse().find(x => x.issue === e.issue);
      if (t) t.match = e.gold;
      break;
    }
    case 'bounty-open': {
      const from = person(state, e.from);
      from.gold -= e.gold;
      state.bounties[e.txid] = { id: e.txid, from: e.from.login, fromId: e.from.id, gold: e.gold, target: e.target, note: e.note || '', at: e.at, status: 'open', expires: e.expires };
      pushFeed(state, { at: e.at, kind: 'bounty', who: e.from.login, gold: e.gold, target: e.target.private ? null : e.target });
      break;
    }
    case 'bounty-payout': {
      const b = state.bounties[e.bounty], to = person(state, e.to);
      to.gold += e.gold; b.status = 'paid'; b.to = e.to.login; b.settledAt = e.at; b.via = e.via;
      pushFeed(state, { at: e.at, kind: 'bounty-paid', who: e.to.login, gold: e.gold, target: b.target.private ? null : b.target });
      break;
    }
    case 'bounty-refund': {
      const b = state.bounties[e.bounty], to = person(state, e.to);
      to.gold += e.gold; b.status = 'refunded'; b.settledAt = e.at; b.reason = e.reason;
      break;
    }
    case 'fund': {
      const p = person(state, e.from), r = state.rooms[e.room];
      p.gold -= e.gold; p.scrolls -= e.scrolls;
      state.treasury.gold -= e.match?.gold || 0; state.treasury.scrolls -= e.match?.scrolls || 0;
      r.scrolls += e.scrolls + (e.match?.scrolls || 0); r.gold += e.gold + (e.match?.gold || 0);
      pushFeed(state, { at: e.at, kind: 'fund', who: e.from.login, room: e.room, gold: e.gold, scrolls: e.scrolls, match: e.match });
      const cost = roomCost(ROOMS.find(x => x.id === e.room), state.config);
      if (!r.builtAt && r.scrolls >= cost.scrolls && r.gold >= cost.gold) { r.builtAt = e.at; pushFeed(state, { at: e.at, kind: 'room', room: e.room }); }
      break;
    }
    case 'quest-reward':
      state.quests[`${e.week}:${e.quest}`] = { at: e.at, title: e.title, people: e.people.length };
      state.treasury.gold += e.treasury || 0;
      for (const x of e.people) { const p = person(state, x); p.gold += x.gold; p.earned.gold += x.gold; monthStats(p, m).gold += x.gold; }
      pushFeed(state, { at: e.at, kind: 'quest', title: e.title, people: e.people.length, week: e.week });
      break;
    case 'move':
      person(state, e.who).lastMoveAt = e.at;
      state.moves.total++; state.moves.people[e.who.id] = (state.moves.people[e.who.id] || 0) + 1; state.moves.kinds[e.what] = (state.moves.kinds[e.what] || 0) + 1;
      pushFeed(state, { at: e.at, kind: 'move', who: e.who.login, what: e.what });
      break;
    case 'plaque':
      state.plaques.push({ month: e.month, entries: e.entries });
      break;
    case 'retro':
      state.retros[e.month] = e.issue || true;
      break;
    default:
      throw new Error(`Unknown ledger entry type ${e.type}`);
  }
  return state;
}

export const rebuild = (entries, config) => entries.reduce(apply, emptyState(config));

// Sanity check after every run: nobody can be overdrawn.
export function assertSolvent(state) {
  for (const p of Object.values(state.people)) if (p.gold < 0 || p.scrolls < 0) throw new Error(`Ledger would overdraw @${p.login}`);
  if (state.treasury.gold < 0 || state.treasury.scrolls < 0) throw new Error('Ledger would overdraw the treasury');
}

export function writeJSON(path, data) { writeFileSync(path, JSON.stringify(data, null, 1) + '\n'); }
