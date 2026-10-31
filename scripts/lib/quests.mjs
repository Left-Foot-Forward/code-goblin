// Weekly quests (unlocked by the Library) and monthly rituals (Hall of Fame plaques,
// Observatory retrospectives). Quests are chosen deterministically from the ISO week.
import { createHash } from 'node:crypto';
import { built, weekOf, monthOf } from './ledger.mjs';

const POOL = [
  { id: 'reviews', title: n => `Review ${n} pull requests`, metric: 'reviews', base: 10 },
  { id: 'merges', title: n => `Merge ${n} pull requests`, metric: 'merges', base: 12 },
  { id: 'issues', title: n => `Resolve ${n} issues`, metric: 'issues', base: 6 },
  { id: 'old', title: n => `Close ${n} issues older than 30 days`, metric: 'oldIssues', base: 3 },
  { id: 'tidy', title: () => 'Merge a pull request that deletes more than it adds', metric: 'netNegative', base: 1, fixed: true },
  { id: 'talk', title: n => `Leave ${n} comments helping each other`, metric: 'comments', base: 30 },
  { id: 'teams', title: () => 'Every team merges something', metric: 'teams', base: 1, fixed: true, needsTeams: true }
];

export function questsFor(week, { owner, config, teamCount }) {
  const scale = config.quests?.scale || 1;
  const pool = POOL.filter(q => !q.needsTeams || teamCount >= 2);
  const h = createHash('sha256').update(`${owner}:${week}`).digest();
  const picked = [];
  for (let i = 0; picked.length < 3 && i < 32; i++) { const q = pool[h[i] % pool.length]; if (!picked.includes(q)) picked.push(q); }
  return picked.map(q => { const target = q.fixed ? q.base : Math.max(1, Math.round(q.base * scale)); return { id: q.id, metric: q.metric, target, title: q.title(target) }; });
}

export function progressOf(q, w, teamNames) {
  if (!w) return 0;
  if (q.metric === 'teams') return teamNames.filter(t => (w.teams?.[t] || 0) > 0).length >= teamNames.length ? 1 : 0;
  return w[q.metric] || 0;
}

const REWARD = { treasury: 30, each: 5 };

// Rewards quests finished this week or last week that haven't been paid yet.
export function questEntries(state, { now, owner, config, teamNames }) {
  if (!built(state, 'library')) return [];
  const entries = [];
  const weeks = [weekOf(now), weekOf(new Date(Date.parse(now) - 7 * 864e5).toISOString())];
  for (const wk of weeks) {
    const w = state.weeks[wk];
    for (const q of questsFor(wk, { owner, config, teamCount: teamNames.length })) {
      if (state.quests[`${wk}:${q.id}`] || progressOf(q, w, teamNames) < q.target) continue;
      const ids = q.metric === 'teams' ? Object.values(w.people || {}).flat() : (w.people?.[q.metric] || []);
      const people = [...new Set(ids)].map(id => state.people[id]).filter(Boolean).map(p => ({ id: p.id, login: p.login, avatar: p.avatar, gold: REWARD.each }));
      entries.push({ txid: `quest:${wk}:${q.id}`, type: 'quest-reward', at: now, week: wk, quest: q.id, title: q.title, treasury: REWARD.treasury, people });
    }
  }
  return entries;
}

const prevMonth = now => { const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return monthOf(d.toISOString()); };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = m => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;

// Hall of Fame: plaques for last month's top merger, reviewer and most thanked (public work only).
export function plaqueEntries(state, { now }) {
  const m = prevMonth(now);
  if (!built(state, 'hall') || state.plaques.some(p => p.month === m)) return [];
  const top = (key, title) => {
    const best = Object.values(state.people).map(p => ({ p, n: p.months[m]?.[key] || 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)[0];
    return best ? { title, login: best.p.login, avatar: best.p.avatar, n: best.n } : null;
  };
  const entries = [top('merges', 'Most merges'), top('reviews', 'Most reviews'), top('thanksIn', 'Most thanked')].filter(Boolean);
  return entries.length ? [{ txid: `plaque:${m}`, type: 'plaque', at: now, month: m, entries }] : [];
}

// Observatory: a retrospective issue about last month.
export function retroFor(state, { now, owner }) {
  const m = prevMonth(now);
  if (!built(state, 'observatory') || state.retros[m]) return null;
  const mo = state.months[m] || {};
  const people = Object.values(state.people);
  const thanks = state.thanks.filter(t => monthOf(t.at) === m);
  const paid = Object.values(state.bounties).filter(b => b.status === 'paid' && b.settledAt && monthOf(b.settledAt) === m);
  const top = (k, n = 3) => people.map(p => [p, p.months[m]?.[k] || 0]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([p, v]) => `${p.login} (${v})`).join(', ') || 'nobody yet';
  const body = `The goblin looked back at ${monthLabel(m)} in ${owner}.

| | |
| --- | --- |
| Pull requests merged | ${mo.merges || 0} |
| Reviews | ${mo.reviews || 0} |
| Issues resolved | ${mo.issues || 0} |
| Helpful comments | ${mo.comments || 0} |
| New repos | ${mo.newRepos || 0} |
| Thanks sent | ${thanks.length} (${thanks.reduce((a, t) => a + t.gold, 0)} gold) |
| Bounties paid | ${paid.length} (${paid.reduce((a, b) => a + b.gold, 0)} gold) |

**Most merges:** ${top('merges')}
**Most reviews:** ${top('reviews')}
**Most thanked:** ${top('thanksIn')}

What went well, and what should the team try next month? Reply below.`;
  return { month: m, title: `The goblin's retrospective: ${monthLabel(m)}`, body, entry: { txid: `retro:${m}`, type: 'retro', at: now, month: m } };
}
