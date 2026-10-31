// Reads real collaboration from GitHub and turns it into earnings.
// fetchEvents() talks to the API; earn() is pure, so it can be tested and replayed.
import { createHmac } from 'node:crypto';
import { weekOf, dayOf } from './ledger.mjs';

const USER = `__typename login ... on User { id avatarUrl }`;
const ITEM = `
  __typename
  ... on PullRequest {
    id number title url createdAt merged mergedAt additions deletions
    repository { name nameWithOwner isPrivate isFork }
    author { ${USER} }
    reviews(last: 30) { nodes { id state submittedAt author { ${USER} } } }
    comments(last: 30) { nodes { id createdAt author { ${USER} } } }
  }
  ... on Issue {
    id number title url createdAt closedAt state stateReason
    repository { name nameWithOwner isPrivate isFork }
    author { ${USER} }
    assignees(first: 1) { nodes { ${USER} } }
    comments(last: 30) { nodes { id createdAt author { ${USER} } } }
    timelineItems(itemTypes: [CLOSED_EVENT], last: 1) { nodes { ... on ClosedEvent {
      createdAt
      closer { __typename ... on PullRequest { merged author { ${USER} } } ... on Commit { author { user { id login avatarUrl } } } }
    } } }
  }`;

// People only: bots and AI reviewers still count toward the org's totals elsewhere but never earn.
export const isHuman = a => !!a && a.__typename === 'User' && !!a.id && !/\[bot\]$|-bot$|^copilot/i.test(a.login || '');
export const who = a => ({ id: a.id, login: a.login, avatar: a.avatarUrl || a.avatar || null });

// Who resolved an issue: the merged PR's author, the closing commit's author, or the assignee.
// A manual close by anyone else earns nothing, so opening and closing issues can't be farmed.
export function resolverOf(issue) {
  const ev = issue.timelineItems?.nodes?.[0];
  const c = ev?.closer;
  if (c?.__typename === 'PullRequest' && c.merged && isHuman(c.author)) return { person: who(c.author), via: 'pull request' };
  if (c?.__typename === 'Commit' && c.author?.user?.id) return { person: who({ ...c.author.user, __typename: 'User' }), via: 'commit' };
  const a = issue.assignees?.nodes?.[0];
  if (isHuman(a)) return { person: who(a), via: 'assignee' };
  return null;
}

async function searchAll(gh, query, since, until, out = []) {
  const q = `${query} updated:${since}..${until}`;
  const first = await gh.graphql('query($q:String!){ search(query:$q, type:ISSUE, first:1){ issueCount } }', { q });
  if (first.search.issueCount > 1000) {
    // Search stops at 1,000 results, so split the window in half until each part fits.
    const mid = new Date((Date.parse(since) + Date.parse(until)) / 2).toISOString().replace(/\.\d+Z$/, 'Z');
    await searchAll(gh, query, since, mid, out);
    return searchAll(gh, query, mid, until, out);
  }
  let after = null;
  for (let page = 0; page < 20; page++) {
    const d = await gh.graphql(`query($q:String!, $after:String){ search(query:$q, type:ISSUE, first:50, after:$after){ pageInfo{ hasNextPage endCursor } nodes{ ${ITEM} } } }`, { q, after });
    out.push(...d.search.nodes.filter(Boolean));
    if (!d.search.pageInfo.hasNextPage) break;
    after = d.search.pageInfo.endCursor;
  }
  return out;
}

export async function fetchEvents(gh, { owner, kind, since, until, gameRepo, config }) {
  const scope = kind === 'Organization' ? `org:${owner}` : `user:${owner}`;
  const items = await searchAll(gh, scope, since, until);
  const repos = kind === 'Organization'
    ? (await gh.graphql(`query($o:String!){ organization(login:$o){ repositories(first:30, orderBy:{field:CREATED_AT, direction:DESC}){ nodes{ id name createdAt isPrivate isFork } } } }`, { o: owner })).organization.repositories.nodes
    : (await gh.graphql(`query($o:String!){ user(login:$o){ repositories(first:30, ownerAffiliations:OWNER, orderBy:{field:CREATED_AT, direction:DESC}){ nodes{ id name createdAt isPrivate isFork } } } }`, { o: owner })).user.repositories.nodes;
  return normalise(items, repos, { since, gameRepo, config });
}

// Flattens API items into simple events, each with a stable key.
export function normalise(items, repos, { since, gameRepo }) {
  const ev = [], after = t => t && t >= since;
  for (const it of items) {
    const repo = it.repository?.nameWithOwner, priv = !!it.repository?.isPrivate, short = it.repository?.name;
    if (it.__typename === 'PullRequest') {
      if (it.merged && after(it.mergedAt) && isHuman(it.author)) {
        ev.push({ key: `m:${it.id}`, kind: 'merge', at: it.mergedAt, who: who(it.author), repo, short, private: priv,
          title: it.title, number: it.number, url: it.url, additions: it.additions, deletions: it.deletions });
      }
      const byReviewer = new Map();
      for (const r of it.reviews?.nodes || []) {
        if (!isHuman(r.author) || r.author.id === it.author?.id || !after(r.submittedAt) || r.state === 'PENDING' || r.state === 'DISMISSED') continue;
        const prev = byReviewer.get(r.author.id);
        const decisive = r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED';
        if (!prev || (decisive && !prev.decisive)) byReviewer.set(r.author.id, { key: `r:${it.id}:${r.author.id}`, kind: 'review', at: r.submittedAt, who: who(r.author), repo, short, private: priv, decisive });
      }
      ev.push(...byReviewer.values());
    }
    if (it.__typename === 'Issue' && it.state === 'CLOSED' && after(it.closedAt) && it.stateReason === 'COMPLETED') {
      const res = resolverOf(it);
      if (res) ev.push({ key: `i:${it.id}`, kind: 'issue', at: it.closedAt, who: res.person, via: res.via, repo, short, private: priv,
        title: it.title, number: it.number, url: it.url, old: Date.parse(it.closedAt) - Date.parse(it.createdAt) > 30 * 864e5 });
    }
    // Comments in the game repo are mostly people spending, so they don't earn.
    if (repo !== gameRepo) for (const c of it.comments?.nodes || []) {
      if (isHuman(c.author) && after(c.createdAt)) ev.push({ key: `c:${c.id}`, kind: 'comment', at: c.createdAt, who: who(c.author), repo, short, private: priv, thread: it.id });
    }
  }
  for (const r of repos || []) if (after(r.createdAt) && !r.isFork) ev.push({ key: `repo:${r.id}`, kind: 'repo', at: r.createdAt, repo: r.name, private: r.isPrivate });
  return ev.sort((a, b) => a.at.localeCompare(b.at));
}

export const hashKey = (key, salt) => createHmac('sha256', salt || 'hoard').update(key).digest('hex').slice(0, 16);
const log2 = n => Math.log2(Math.max(1, n));

// Turns new events into ledger entries. Pure: same events and state in, same entries out.
export function earn(events, { state, config, runId, now, salt, teamOf }) {
  const R = config.rewards, seen = state.seen || {}, caps = state.caps || {};
  const fresh = [];
  for (const e of events) {
    const h = hashKey(e.key, salt);
    if (seen[h]) continue;
    seen[h] = e.at; fresh.push(e);
  }
  const people = new Map(), priv = new Map(), treasury = { gold: 0, scrolls: 0 };
  const weeks = new Map();
  const bucket = (map, p) => { if (!map.has(p.id)) map.set(p.id, { who: p, gold: 0, scrolls: 0, counts: { merges: 0, reviews: 0, comments: 0, issues: 0 } }); return map.get(p.id); };
  const week = at => { const k = weekOf(at); if (!weeks.has(k)) weeks.set(k, { at, counts: {}, repos: {}, teams: {}, people: {}, items: [] }); const w = weeks.get(k); w.at = at; return w; };
  const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const addPerson = (w, metric, id) => { (w.people[metric] ||= []); if (!w.people[metric].includes(id)) w.people[metric].push(id); };

  for (const e of fresh) {
    let gold = 0, scrolls = 0, count = null;
    if (e.kind === 'merge') {
      gold = R.merge.gold + Math.min(R.merge.sizeGoldMax, Math.floor(log2(e.additions + e.deletions + 1) / 2)) + Math.min(R.merge.deleteGoldMax, Math.floor(log2(e.deletions + 1) / 1.5));
      scrolls = R.merge.scrolls; count = 'merges';
    } else if (e.kind === 'review') {
      gold = e.decisive ? R.review.decisive : R.review.comment; count = 'reviews';
    } else if (e.kind === 'issue') {
      gold = R.issueClosed.gold; scrolls = R.issueClosed.scrolls; count = 'issues';
    } else if (e.kind === 'comment') {
      const day = dayOf(e.at), c = caps[day] ||= {};
      const pk = e.who.id, tk = `${e.who.id}|${e.thread}`;
      if ((c[pk] || 0) >= R.comment.perDay || (c[tk] || 0) >= R.comment.perThread) continue;
      c[pk] = (c[pk] || 0) + 1; c[tk] = (c[tk] || 0) + 1;
      gold = R.comment.gold; count = 'comments';
    } else if (e.kind === 'repo') {
      treasury.gold += R.newRepo.treasury;
      const w = week(e.at); bump(w.counts, 'newRepos');
      if (!e.private) w.items.push({ at: e.at, kind: 'repo', repo: e.repo });
      continue;
    }
    // Who gets paid: public work always credits the person. Private work credits them only if the org opts in.
    if (e.private && !config.creditPrivateWork) { treasury.gold += gold; treasury.scrolls += scrolls; }
    else if (e.private) { const b = bucket(priv, e.who); b.gold += gold; b.scrolls += scrolls; }
    else { const b = bucket(people, e.who); b.gold += gold; b.scrolls += scrolls; b.counts[count]++; }

    // Activity for charts, teams and quests. Private items add to totals only, never names, repos or titles.
    const w = week(e.at);
    bump(w.counts, count);
    if (e.kind === 'issue' && e.old) bump(w.counts, 'oldIssues');
    if (e.kind === 'merge' && e.deletions > e.additions) bump(w.counts, 'netNegative');
    if (!e.private) {
      const t = teamOf(e.short, e.repo);
      (w.repos[e.short] ||= {}); bump(w.repos[e.short], count);
      if (e.kind === 'merge') bump(w.teams, t);
      addPerson(w, count, e.who.id);
      if (e.kind === 'issue' && e.old) addPerson(w, 'oldIssues', e.who.id);
      if (e.kind === 'merge' && e.deletions > e.additions) addPerson(w, 'netNegative', e.who.id);
      if (e.kind === 'merge') w.items.push({ at: e.at, kind: 'merge', who: e.who.login, title: e.title, repo: e.short, number: e.number, url: e.url, add: e.additions, del: e.deletions });
      if (e.kind === 'issue') w.items.push({ at: e.at, kind: 'issue', who: e.who.login, title: e.title, repo: e.short, number: e.number, url: e.url, via: e.via });
    } else if (e.kind === 'merge') bump(w.teams, 'Private repos');
  }

  const entries = [];
  const day = dayOf(now);
  for (const b of people.values()) entries.push({ txid: `earn:${runId}:${b.who.id}`, type: 'earn', at: now, who: b.who, gold: b.gold, scrolls: b.scrolls, counts: b.counts });
  // Private earnings: one line per person with amounts only, dated to the day, no kinds or repos.
  for (const b of priv.values()) entries.push({ txid: `earnp:${runId}:${hashKey(b.who.id, salt)}`, type: 'earn', private: true, at: `${day}T00:00:00Z`, who: b.who, gold: b.gold, scrolls: b.scrolls });
  if (treasury.gold || treasury.scrolls) entries.push({ txid: `treasury:${runId}`, type: 'treasury', at: now, gold: treasury.gold, scrolls: treasury.scrolls, reason: 'work' });
  for (const [k, w] of weeks) entries.push({ txid: `activity:${runId}:${k}`, type: 'activity', at: w.at, week: k, counts: w.counts, repos: w.repos, teams: w.teams, people: w.people, items: w.items.slice(-60) });

  // Forget keys and caps older than 30 days so state stays small.
  const cutoff = new Date(Date.parse(now) - 30 * 864e5).toISOString();
  for (const [h, at] of Object.entries(seen)) if (at < cutoff) delete seen[h];
  for (const d of Object.keys(caps)) if (d < dayOf(cutoff)) delete caps[d];
  return { entries, seen, caps, fresh: fresh.length };
}
