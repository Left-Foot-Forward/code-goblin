#!/usr/bin/env node
// Gathers the org's merged pull requests and writes the shared hoard the game and card read.
//   node scripts/feast.mjs            uses goblin.config.json, or the repo owner in Actions
//   node scripts/feast.mjs --org acme overrides the org
//   node scripts/feast.mjs --demo     writes believable sample data, no network
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphql, avatarDataURI } from './lib/github.mjs';
import { writeCards } from './card.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'docs', 'data');
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const config = JSON.parse(readFileSync(join(ROOT, 'goblin.config.json'), 'utf8'));
const DAY = 864e5;
const isoDay = t => new Date(t).toISOString().slice(0, 10);
const monthKey = t => new Date(t).toISOString().slice(0, 7);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PR_FIELDS = `... on PullRequest {
  id number title url additions deletions mergedAt
  author { __typename login avatarUrl }
  repository { nameWithOwner isPrivate }
  reviews(first: 30) { nodes { state author { __typename login avatarUrl } } }
}`;

async function count(q) {
  const d = await graphql('query($q:String!){ search(query:$q, type:ISSUE, first:1){ issueCount } }', { q });
  return d.search.issueCount;
}

async function fetchMerged(scope, since) {
  const out = [];
  let after = null;
  // GitHub search returns at most 1,000 results; that is plenty for a 90-day window in most orgs.
  for (let page = 0; page < 10; page++) {
    const d = await graphql(`query($q:String!, $after:String){
      search(query:$q, type:ISSUE, first:100, after:$after){ pageInfo{ hasNextPage endCursor } nodes{ ${PR_FIELDS} } } }`,
    { q: `${scope} is:pr is:merged merged:>=${isoDay(since)} sort:updated-desc`, after });
    out.push(...d.search.nodes.filter(n => n && n.mergedAt));
    if (!d.search.pageInfo.hasNextPage) break;
    after = d.search.pageInfo.endCursor;
  }
  return out;
}

function summarise({ owner, kind, prs, mergedAllTime, monthNow, monthPrev, now }) {
  const window = config.windowDays || 90;
  const isPublic = pr => !pr.repository?.isPrivate;
  const showTitle = pr => isPublic(pr) || config.showPrivateTitles;
  const members = new Map();
  const member = a => {
    if (!members.has(a.login)) members.set(a.login, { login: a.login, avatar: a.avatarUrl, merged: 0, additions: 0, deletions: 0, reviews: 0, monthMerged: 0, monthDeletions: 0, monthReviews: 0, first: Infinity });
    return members.get(a.login);
  };
  // Only people get shout-outs; bots and AI reviewers still count toward the org's totals.
  const human = a => a && (a.__typename === undefined || a.__typename === 'User') && !/\[bot\]$|-bot$|^copilot/i.test(a.login);
  const mk = monthKey(now);
  let additions = 0, deletions = 0, reviews = 0;
  const repos = new Set();
  const weeks = Array.from({ length: 13 }, (_, i) => ({ start: isoDay(now - (12 - i) * 7 * DAY - 6 * DAY), merged: 0, additions: 0, deletions: 0 }));

  for (const pr of prs) {
    const t = Date.parse(pr.mergedAt);
    additions += pr.additions; deletions += pr.deletions;
    if (pr.repository) repos.add(pr.repository.nameWithOwner);
    const w = 12 - Math.floor((now - t) / (7 * DAY));
    if (w >= 0 && w < 13) { weeks[w].merged++; weeks[w].additions += pr.additions; weeks[w].deletions += pr.deletions; }
    const byLogin = new Map();
    for (const r of pr.reviews?.nodes || []) if (r.author && r.author.login !== pr.author?.login && r.state !== 'PENDING') byLogin.set(r.author.login, r.author);
    const reviewers = [...byLogin.values()];
    reviews += reviewers.length;
    // Private work counts toward the org's totals but is never attributed publicly.
    if (!isPublic(pr)) continue;
    if (human(pr.author)) {
      const m = member(pr.author);
      m.merged++; m.additions += pr.additions; m.deletions += pr.deletions; m.first = Math.min(m.first, t);
      if (monthKey(t) === mk) { m.monthMerged++; m.monthDeletions += pr.deletions; }
    }
    for (const a of reviewers.filter(human)) { const r = member(a); r.reviews++; if (monthKey(t) === mk) r.monthReviews++; }
  }

  const list = [...members.values()];
  const best = (key, min = 1) => {
    const top = list.filter(m => m[key] >= min).sort((a, b) => b[key] - a[key])[0];
    return top ? { login: top.login, avatar: top.avatar, n: top[key] } : null;
  };
  const monthStart = Date.parse(`${mk}-01T00:00:00Z`);
  const fresh = window >= 45 ? list.filter(m => m.merged > 0 && m.first >= monthStart).map(m => ({ login: m.login, avatar: m.avatar })) : [];

  const level = Math.floor(Math.sqrt(mergedAllTime)) + 1;
  const goal = Math.max(10, Math.ceil((monthPrev * 1.1) / 5) * 5);
  const lastMerge = prs.reduce((a, pr) => Math.max(a, Date.parse(pr.mergedAt)), 0);

  return {
    owner, kind, name: config.name || 'Grub', generatedAt: new Date(now).toISOString(), windowDays: window, demo: false,
    level, levelProgress: Math.sqrt(mergedAllTime) % 1,
    mood: monthNow >= goal ? 'happy' : now - lastMerge > 3 * DAY ? 'shock' : 'idle',
    totals: { mergedAllTime, merged: prs.length, additions, deletions, reviews, contributors: list.filter(m => m.merged > 0).length, repos: repos.size, lastMergeAt: lastMerge ? new Date(lastMerge).toISOString() : null },
    month: { key: mk, label: MONTHS[new Date(now).getUTCMonth()], merged: monthNow, goal, previous: monthPrev },
    weeks,
    shoutouts: { feeder: best('monthMerged'), cleanup: best('monthDeletions', 10), sage: best('monthReviews'), fresh: fresh.slice(0, 8) },
    members: list.filter(m => m.merged > 0 || m.reviews > 0).sort((a, b) => b.merged - a.merged || b.reviews - a.reviews).slice(0, 48)
      .map(({ login, avatar, merged, additions, deletions, reviews }) => ({ login, avatar, merged, additions, deletions, reviews })),
    feast: prs.slice().sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt)).slice(0, 40).map(pr => showTitle(pr)
      ? { id: pr.id, title: pr.title, url: pr.url, repo: pr.repository?.nameWithOwner, number: pr.number, author: pr.author?.login || 'ghost', avatar: pr.author?.avatarUrl || null, additions: pr.additions, deletions: pr.deletions, mergedAt: pr.mergedAt }
      : { id: pr.id, sealed: true, additions: pr.additions, deletions: pr.deletions, mergedAt: pr.mergedAt })
  };
}

function demo(now) {
  const people = ['ada', 'linus', 'grace', 'ken', 'margaret', 'dennis', 'barbara', 'guido', 'yukihiro', 'anders', 'radia', 'tim'];
  const titles = ['Fix flaky auth test', 'Remove dead feature flags', 'Add retry to webhook sender', 'Bump deps', 'Rewrite onboarding copy',
    'Delete legacy billing module', 'Speed up CI cache', 'Dark mode for settings', 'Handle empty search results', 'Split giant utils file',
    'Docs: explain rate limits', 'Migrate cron to queues', 'Kill the old admin panel', 'Typo in README', 'Add tracing to checkout'];
  let s = 42; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const prs = Array.from({ length: 138 }, (_, i) => {
    const who = people[Math.floor(Math.pow(r(), 1.4) * people.length)];
    const priv = r() < 0.3;
    return {
      id: `demo-${i}`, number: 1000 + i, title: titles[i % titles.length], url: 'https://github.com/', additions: Math.floor(Math.pow(r(), 2) * 900) + 3,
      deletions: Math.floor(Math.pow(r(), 1.6) * (i % 7 === 0 ? 2400 : 400)), mergedAt: new Date(now - Math.pow(r(), 1.2) * 89 * DAY).toISOString(),
      author: { login: who, avatarUrl: null }, repository: { nameWithOwner: `demo-org/${['api', 'web', 'infra', 'docs'][i % 4]}`, isPrivate: priv },
      reviews: { nodes: [{ state: 'APPROVED', author: { login: people[(i + 3) % people.length], avatarUrl: null } }] }
    };
  });
  const mk = monthKey(now);
  const h = summarise({ owner: 'demo-org', kind: 'Organization', prs, mergedAllTime: 612, monthNow: prs.filter(p => monthKey(Date.parse(p.mergedAt)) === mk).length, monthPrev: 41, now });
  h.demo = true;
  return h;
}

// Points the README's play and cheer links at whichever repo runs this, so template copies work untouched.
function writeReadmeLinks(slug) {
  const path = join(ROOT, 'README.md');
  if (!existsSync(path)) return;
  const [o, r] = slug.split('/');
  const play = `https://${o.toLowerCase()}.github.io/${r}/`;
  const issue = what => `https://github.com/${slug}/issues/new?title=${encodeURIComponent('goblin: ' + what)}&body=${encodeURIComponent('Submitting this issue tells the goblin. A bot will reply and close it.')}`;
  const block = `<!-- goblin:links -->\n**[▶ Play the game](${play})** · [Feed](${issue('feed')}) · [Pet](${issue('pet')}) · [Cheer](${issue('cheer')})\n<!-- /goblin:links -->`;
  const md = readFileSync(path, 'utf8');
  const next = md.replace(/<!-- goblin:links -->[\s\S]*?<!-- \/goblin:links -->/, block);
  if (next !== md) writeFileSync(path, next);
}

async function main() {
  const now = Date.now();
  let hoard;
  if (args.includes('--demo')) {
    hoard = demo(now);
  } else {
    const owner = arg('org') || config.org || process.env.GITHUB_REPOSITORY_OWNER;
    if (!owner) throw new Error('Set "org" in goblin.config.json, pass --org, or run inside GitHub Actions.');
    const who = await graphql('query($l:String!){ repositoryOwner(login:$l){ __typename login } }', { l: owner });
    if (!who.repositoryOwner) throw new Error(`No GitHub user or org called ${owner}.`);
    const kind = who.repositoryOwner.__typename;
    const scope = config.repos?.length ? config.repos.map(r => `repo:${owner}/${r}`).join(' ') : kind === 'Organization' ? `org:${owner}` : `author:${owner}`;
    const window = config.windowDays || 90;
    const d = new Date(now), y = d.getUTCFullYear(), m = d.getUTCMonth();
    const range = (a, b) => `${isoDay(a)}..${isoDay(b)}`;
    const [prs, mergedAllTime, monthNow, monthPrev] = await Promise.all([
      fetchMerged(scope, now - window * DAY),
      count(`${scope} is:pr is:merged`),
      count(`${scope} is:pr is:merged merged:${range(Date.UTC(y, m, 1), now)}`),
      count(`${scope} is:pr is:merged merged:${range(Date.UTC(y, m - 1, 1), Date.UTC(y, m, 0))}`)
    ]);
    hoard = summarise({ owner: who.repositoryOwner.login, kind, prs, mergedAllTime, monthNow, monthPrev, now });
  }

  hoard.repo = process.env.GITHUB_REPOSITORY || null;
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, 'hoard.json'), JSON.stringify(hoard, null, 1) + '\n');

  // Shout-out avatars are embedded in the card, so fetch them once here.
  const avatars = {};
  const s = hoard.shoutouts;
  for (const p of [s.feeder, s.cleanup, s.sage].filter(Boolean)) if (p.avatar && !avatars[p.login]) avatars[p.login] = await avatarDataURI(p.avatar);
  writeFileSync(join(DATA, 'avatars.json'), JSON.stringify(avatars) + '\n');

  const movesPath = join(DATA, 'moves.json');
  const moves = existsSync(movesPath) ? JSON.parse(readFileSync(movesPath, 'utf8')) : { total: 0, people: {}, log: [] };
  if (!existsSync(movesPath)) writeFileSync(movesPath, JSON.stringify(moves, null, 1) + '\n');
  writeCards(hoard, moves, avatars, process.env.GITHUB_REPOSITORY);
  if (process.env.GITHUB_REPOSITORY) writeReadmeLinks(process.env.GITHUB_REPOSITORY);
  console.log(`Fed ${hoard.name} for ${hoard.owner}: level ${hoard.level}, ${hoard.totals.merged} merged PRs in ${hoard.windowDays} days, ${hoard.month.merged}/${hoard.month.goal} this month.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
