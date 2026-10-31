// Derives docs/data/realm.json (everything the site and card show) from the rebuilt ledger state.
import { ROOMS, roomCost } from './rooms.mjs';
import { weekOf, monthOf } from './ledger.mjs';
import { questsFor, progressOf, monthLabel } from './quests.mjs';

export function deriveRealm(state, { owner, kind, config, now, repo, demo, teamNames }) {
  const people = Object.values(state.people);
  const month = monthOf(now), week = weekOf(now);
  const level = Math.floor(Math.sqrt(state.scrollsAll)) + 1;
  const rooms = ROOMS.map(r => {
    const s = state.rooms[r.id], cost = roomCost(r, config);
    return { id: r.id, name: r.name, unlock: r.unlock, cost, funded: { scrolls: Math.min(s.scrolls, cost.scrolls), gold: Math.min(s.gold, cost.gold) }, builtAt: s.builtAt };
  });
  const current = rooms.find(r => !r.builtAt) || null;

  // The last 13 weeks of activity, oldest first.
  const weeks = [];
  for (let i = 12; i >= 0; i--) {
    const k = weekOf(new Date(Date.parse(now) - i * 7 * 864e5).toISOString()), w = state.weeks[k] || {};
    weeks.push({ week: k, merges: w.merges || 0, reviews: w.reviews || 0, comments: w.comments || 0, issues: w.issues || 0 });
  }
  const recentWeeks = weeks.map(w => state.weeks[w.week]).filter(Boolean);
  const districts = {};
  for (const w of recentWeeks) for (const [r, c] of Object.entries(w.repos || {})) {
    const d = districts[r] ||= { repo: r, merges: 0, reviews: 0, comments: 0, issues: 0 };
    for (const k in c) d[k] = (d[k] || 0) + c[k];
  }
  const teams = {};
  for (const w of recentWeeks) for (const [t, n] of Object.entries(w.teams || {})) teams[t] = (teams[t] || 0) + n;
  const thisWeekTeams = state.weeks[week]?.teams || {};

  const wk = state.weeks[week];
  const quests = state.rooms.library.builtAt ? questsFor(week, { owner, config, teamCount: teamNames.length }).map(q => ({
    ...q, progress: Math.min(q.target, progressOf(q, wk, teamNames)), done: !!state.quests[`${week}:${q.id}`]
  })) : [];

  const mo = state.months[month] || {};
  const monthPeople = people.filter(p => p.months[month]);
  const best = key => { const b = monthPeople.map(p => [p, p.months[month][key] || 0]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0]; return b ? { login: b[0].login, avatar: b[0].avatar, n: b[1] } : null; };
  const openBounties = Object.values(state.bounties).filter(b => b.status === 'open');

  return {
    owner, kind, name: config.name, repo: repo || null, demo: !!demo, generatedAt: now,
    level, levelProgress: Math.sqrt(state.scrollsAll) % 1, scrollsAll: state.scrollsAll,
    mood: openBounties.length && !mo.merges ? 'shock' : (wk?.merges || 0) > 0 ? 'happy' : 'idle',
    treasury: state.treasury,
    rooms, current: current?.id || null,
    quests, week,
    month: { key: month, label: monthLabel(month).split(' ')[0], merges: mo.merges || 0, reviews: mo.reviews || 0, comments: mo.comments || 0, issues: mo.issues || 0, newRepos: mo.newRepos || 0 },
    thisWeek: { merges: wk?.merges || 0, reviews: wk?.reviews || 0, issues: wk?.issues || 0, comments: wk?.comments || 0, people: new Set(Object.values(wk?.people || {}).flat()).size },
    shoutouts: { merger: best('merges'), reviewer: best('reviews'), thanked: best('thanksIn'), resolver: best('issues') },
    weeks,
    teams: Object.entries(teams).sort((a, b) => b[1] - a[1]).map(([name, merges]) => ({ name, merges, week: thisWeekTeams[name] || 0 })),
    districts: Object.values(districts).sort((a, b) => (b.merges + b.issues) - (a.merges + a.issues)).slice(0, 24),
    people: people.filter(p => p.earned.gold || p.thanksIn || p.gold).sort((a, b) => b.earned.gold - a.earned.gold).map(p => ({
      login: p.login, avatar: p.avatar, gold: p.gold, scrolls: p.scrolls, earned: p.earned, counts: p.counts,
      month: p.months[month] || null, thanksIn: p.thanksIn, thanksOut: p.thanksOut
    })),
    bounties: {
      open: openBounties.sort((a, b) => b.gold - a.gold).map(b => ({ gold: b.gold, from: b.from, target: b.target.private ? { private: true } : b.target, at: b.at, expires: b.expires, note: b.note })),
      settled: Object.values(state.bounties).filter(b => b.status !== 'open').sort((a, b) => (b.settledAt || '').localeCompare(a.settledAt || '')).slice(0, 12)
        .map(b => ({ gold: b.gold, from: b.from, to: b.to || null, status: b.status, reason: b.reason || null, via: b.via || null, target: b.target.private ? { private: true } : b.target, at: b.settledAt }))
    },
    thanks: state.thanks.slice(-30).reverse(),
    feed: state.feed.slice(-100).reverse(),
    moves: { total: state.moves.total, people: Object.keys(state.moves.people).length },
    plaques: state.plaques.slice(-12).reverse(),
    config: {
      spenders: config.spenders, maxTransfer: config.maxTransfer, thanksPerDay: config.thanksPerDay, bountyExpiryDays: config.bountyExpiryDays,
      creditPrivateWork: config.creditPrivateWork, rewards: config.rewards
    }
  };
}
