#!/usr/bin/env node
// One run of the goblin: ingest real work, process spends, settle bounties, reward quests,
// rebuild everything from the ledger, commit, then reply on GitHub.
//   node scripts/goblin.mjs                  in GitHub Actions (commits and replies)
//   node scripts/goblin.mjs --demo           fake org, no network, writes docs/data locally
//   node scripts/goblin.mjs --org X --dry-run  read real data, print a summary, write nothing
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadConfig } from './lib/config.mjs';
import { client, avatarDataURI } from './lib/github.mjs';
import { readLedger, appendLedger, rebuild, apply, assertSolvent, writeJSON } from './lib/ledger.mjs';
import { fetchEvents, normalise, earn } from './lib/ingest.mjs';
import { processSpend, kindOf } from './lib/forms.mjs';
import { settleBounties, lookupNodes } from './lib/bounties.mjs';
import { questEntries, plaqueEntries, retroFor } from './lib/quests.mjs';
import { deriveRealm } from './lib/realm.mjs';
import { writeCards } from './card.mjs';
import { writeReadme } from './readme.mjs';
import { demoItems, demoIssues, demoLookups } from './lib/demo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'docs', 'data'), LEDGER = join(DATA, 'ledger'), STATE = join(DATA, 'state.json');
const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const arg = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const DEMO = flag('demo'), DRY = flag('dry-run'), IN_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const iso = t => new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'pipe' }).toString().trim();

const orgGH = client(process.env.GOBLIN_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '');
const repoGH = client(process.env.GITHUB_TOKEN || process.env.GOBLIN_TOKEN || process.env.GH_TOKEN || '');
const gameRepo = process.env.GITHUB_REPOSITORY || (DEMO ? 'demo-org/code-goblin' : null);

async function resolveOwner(config) {
  if (DEMO) return { owner: 'demo-org', kind: 'Organization' };
  const owner = arg('org') || config.org || process.env.GITHUB_REPOSITORY_OWNER;
  if (!owner) throw new Error('Set "org" in goblin.config.json, pass --org, or run inside GitHub Actions.');
  const d = await orgGH.graphql('query($l:String!){ repositoryOwner(login:$l){ __typename login } }', { l: owner });
  if (!d.repositoryOwner) throw new Error(`No GitHub user or org called ${owner}.`);
  return { owner: d.repositoryOwner.login, kind: d.repositoryOwner.__typename };
}

async function openGoblinIssues() {
  const [o, n] = gameRepo.split('/');
  const d = await repoGH.graphql(`query($o:String!,$n:String!){ repository(owner:$o, name:$n){ issues(states:OPEN, first:50, orderBy:{field:CREATED_AT, direction:ASC}){ nodes{
    id number title body createdAt lastEditedAt authorAssociation author{ __typename login ... on User{ id avatarUrl } } } } } }`, { o, n });
  return d.repository.issues.nodes.filter(i => kindOf(i.title)).map(i => ({
    ...i, author: i.author?.__typename === 'User' ? { id: i.author.id, login: i.author.login, avatar: i.author.avatarUrl } : null
  }));
}

async function lookupIssue(repo, number) {
  const [o, n] = repo.split('/');
  const d = await orgGH.graphql(`query($o:String!,$n:String!,$num:Int!){ repository(owner:$o, name:$n){ isPrivate issue(number:$num){ id state title url } } }`, { o, n, num: number }).catch(() => null);
  const i = d?.repository?.issue;
  return i ? { ...i, private: d.repository.isPrivate } : null;
}

function spenderCheck(owner, kind, config) {
  return async issue => {
    if (config.spenders === 'anyone') return true;
    if (DEMO) return true;
    const l = issue.author.login;
    if (kind === 'Organization') {
      const r = await orgGH.request('GET', `/orgs/${owner}/members/${l}`);
      if (r.status === 204) return true;
      // Without the members permission GitHub only reveals public members; fall back to GitHub's own label.
      return ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(issue.authorAssociation);
    }
    if (l.toLowerCase() === owner.toLowerCase()) return true;
    return (await repoGH.request('GET', `/repos/${gameRepo}/collaborators/${l}`)).status === 204;
  };
}

async function run() {
  const config = loadConfig(ROOT);
  const now = iso(Date.now());
  const runId = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}.${process.env.GITHUB_RUN_ATTEMPT || 1}` : now;
  if (DEMO && !DRY) { rmSync(LEDGER, { recursive: true, force: true }); rmSync(STATE, { force: true }); }
  const ledger = DEMO ? [] : readLedger(LEDGER);
  const state = rebuild(ledger, config);
  const persisted = !DEMO && existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  state.seen = persisted.seen || {}; state.caps = persisted.caps || {};
  const { owner, kind } = await resolveOwner(config);
  const salt = process.env.GOBLIN_SALT || '';
  const teamNames = Object.keys(config.teams || {});
  const teamOf = short => { for (const [t, list] of Object.entries(config.teams || {})) if (list.includes(short)) return t; return teamNames.length ? 'Everyone else' : short; };
  const added = [];
  const add = es => { for (const e of es) { apply(state, e); added.push(e); } };

  // 1. Real work becomes gold and scrolls.
  const since = iso(persisted.cursor ? Date.parse(persisted.cursor) - 6 * 3600e3 : Date.parse(now) - config.backfillDays * 864e5);
  let events;
  if (DEMO) { const d = demoItems(now); events = normalise(d.items, d.repos, { since, gameRepo }); }
  else events = await fetchEvents(orgGH, { owner, kind, since, until: now, gameRepo, config });
  const earned = earn(events, { state, config, runId, now, salt, teamOf });
  add(earned.entries);

  // 2. Spends filed through issue forms, oldest first. Each one sees the balances left by the one before.
  const demoL = DEMO ? demoLookups(now) : null;
  const ctx = { config, now, owner, isSpender: spenderCheck(owner, kind, config), lookupIssue: DEMO ? demoL.lookupIssue : lookupIssue };
  const replies = [];
  const issues = DEMO ? demoIssues(now) : gameRepo ? await openGoblinIssues() : [];
  for (const issue of issues) {
    const res = await processSpend(issue, state, ctx);
    if (!res) continue;
    add(res.entries);
    replies.push({ number: issue.number, reply: res.already ? 'Done. The goblin had already handled this one.' : res.reply });
  }

  // 3. Bounties, 4. quests and monthly rituals.
  add(await settleBounties(state, { now, lookup: DEMO ? demoL.lookupNodes : ids => lookupNodes(orgGH, ids) }));
  add(questEntries(state, { now, owner, config, teamNames }));
  add(plaqueEntries(state, { now }));
  const retro = retroFor(state, { now, owner });
  if (retro) add([retro.entry]);

  assertSolvent(state);
  const realm = deriveRealm(state, { owner, kind, config, now, repo: gameRepo, demo: DEMO, teamNames });
  const summary = { owner, since, events: events.length, fresh: earned.fresh, newEntries: added.length, spends: replies.length, treasury: state.treasury, level: realm.level, people: realm.people.length };
  if (DRY) { console.log(JSON.stringify(summary, null, 1)); return { done: true }; }

  // 5. Write: the log first, then everything derived from it.
  appendLedger(LEDGER, added);
  mkdirSync(DATA, { recursive: true });
  writeJSON(STATE, { cursor: iso(Date.parse(now) - 10 * 60e3), seen: state.seen, caps: state.caps });
  writeJSON(join(DATA, 'realm.json'), realm);
  const avatars = {};
  if (!DEMO) for (const p of Object.values(realm.shoutouts).filter(Boolean)) if (!avatars[p.login]) avatars[p.login] = await avatarDataURI(p.avatar);
  writeCards(realm, avatars);
  writeReadme(realm);
  console.log(JSON.stringify(summary));

  // 6. Commit. Runs never overlap, so a rejected push means a person pushed; start over from their commit.
  if (IN_ACTIONS) {
    git('add', 'docs', 'README.md');
    if (git('status', '--porcelain')) {
      git('-c', 'user.name=code-goblin[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', `goblin: run ${now}`);
      try { git('push', 'origin', 'HEAD:main'); }
      catch { git('fetch', 'origin', 'main'); git('reset', '--hard', 'origin/main'); return { done: false }; }
    }
    // 7. Only now, with the ledger safely pushed, reply on GitHub.
    for (const r of replies) {
      await repoGH.rest('POST', `/repos/${gameRepo}/issues/${r.number}/comments`, { body: r.reply }).catch(e => console.error(e.message));
      await repoGH.rest('PATCH', `/repos/${gameRepo}/issues/${r.number}`, { state: 'closed', state_reason: 'completed' }).catch(e => console.error(e.message));
    }
    if (retro) await repoGH.rest('POST', `/repos/${gameRepo}/issues`, { title: retro.title, body: retro.body }).catch(e => console.error(e.message));
  }
  return { done: true };
}

(async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await run();
    if (r.done) return;
    console.log(`Push was rejected, retrying from the latest commit (attempt ${attempt + 1}).`);
  }
  throw new Error('Could not push after 3 attempts.');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
