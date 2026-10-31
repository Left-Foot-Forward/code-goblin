#!/usr/bin/env node
// Tests for the ledger and the game's rules. No dependencies: node scripts/test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DEFAULTS } from './lib/config.mjs';
import { rebuild, apply, assertSolvent, emptyState } from './lib/ledger.mjs';
import { normalise, earn } from './lib/ingest.mjs';
import { parseForm, processSpend } from './lib/forms.mjs';
import { settleBounties } from './lib/bounties.mjs';
import { demoItems, SECRET_TITLE } from './lib/demo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'expected'} ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };

const config = structuredClone(DEFAULTS);
const NOW = '2026-10-31T12:00:00Z';
const U = n => ({ id: `U_${n}`, login: n, avatar: null });
const earnLine = (n, gold, scrolls = 0, i = 0) => ({ txid: `earn:t${i}:${n}`, type: 'earn', at: NOW, who: U(n), gold, scrolls, counts: { merges: scrolls, reviews: 0, comments: 0, issues: 0 } });
const form = f => Object.entries(f).map(([k, v]) => `### ${k}\n\n${v}`).join('\n\n');
const issue = (n, title, author, body, extra = {}) => ({ id: `ISS_${n}`, number: n, title, body, createdAt: NOW, lastEditedAt: null, authorAssociation: 'MEMBER', author: U(author), ...extra });
const ctx = (over = {}) => ({ config, now: NOW, owner: 'acme', isSpender: async () => true, lookupIssue: async () => null, ...over });

console.log('ledger');
await test('rebuilds balances from the log', () => {
  const s = rebuild([earnLine('ada', 50, 3), earnLine('bob', 20, 1), { txid: 'spend:1', type: 'thanks', at: NOW, from: U('ada'), to: U('bob'), gold: 10, note: 'hi', issue: 1 }], config);
  eq([s.people.U_ada.gold, s.people.U_bob.gold, s.scrollsAll, s.people.U_bob.thanksIn], [40, 30, 4, 10]);
});
await test('ignores a replayed transaction', () => {
  const s = rebuild([earnLine('ada', 50), earnLine('ada', 50)], config);
  eq(s.people.U_ada.gold, 50);
});
await test('refuses to let anyone go overdrawn', () => {
  const s = rebuild([earnLine('ada', 5)], config);
  apply(s, { txid: 'spend:x', type: 'thanks', at: NOW, from: U('ada'), to: U('ada2'), gold: 9, note: '', issue: 9 });
  let threw = false; try { assertSolvent(s); } catch { threw = true; }
  ok(threw, 'assertSolvent should throw');
});

console.log('earning');
const { items, repos } = demoItems(NOW);
const events = normalise(items, repos, { since: '2026-09-01T00:00:00Z', gameRepo: 'demo-org/code-goblin' });
await test('never pays twice for the same work', () => {
  const s = emptyState(config); s.seen = {}; s.caps = {};
  const tf = s => s;
  const a = earn(events, { state: s, config, runId: 'r1', now: NOW, salt: 'x', teamOf: tf });
  a.entries.forEach(e => apply(s, e));
  const b = earn(events, { state: s, config, runId: 'r2', now: NOW, salt: 'x', teamOf: tf });
  ok(a.fresh > 100, 'first run should see events');
  eq(b.fresh, 0, 'second run fresh events');
  eq(b.entries.filter(e => e.type === 'earn').length, 0, 'second run earn lines');
});
await test('bots never earn and self-reviews never count', () => {
  ok(!events.some(e => e.who?.login?.includes('[bot]')), 'a bot earned');
  ok(!events.some(e => e.kind === 'review' && items.find(i => i.id === e.key.split(':')[1])?.author?.id === e.who.id), 'a self-review counted');
});
await test('comments are capped per person per day', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ key: `c:${i}`, kind: 'comment', at: NOW, who: U('chatty'), repo: 'acme/web', short: 'web', private: false, thread: `T${i}` }));
  const s = emptyState(config); s.seen = {}; s.caps = {};
  const r = earn(many, { state: s, config, runId: 'r', now: NOW, salt: '', teamOf: x => x });
  eq(r.entries.find(e => e.type === 'earn').gold, config.rewards.comment.perDay);
});
await test('private work pools into the treasury by default', () => {
  const s = emptyState(config); s.seen = {}; s.caps = {};
  const r = earn([{ key: 'm:p', kind: 'merge', at: NOW, who: U('ada'), repo: 'acme/secret', short: 'secret', private: true, title: SECRET_TITLE, number: 1, additions: 10, deletions: 0 }],
    { state: s, config, runId: 'r', now: NOW, salt: '', teamOf: x => x });
  ok(!r.entries.some(e => e.type === 'earn'), 'nobody should be credited');
  ok(r.entries.some(e => e.type === 'treasury' && e.gold > 0), 'treasury should be credited');
  ok(!JSON.stringify(r.entries).includes(SECRET_TITLE) && !JSON.stringify(r.entries).includes('secret'), 'private details leaked');
});
await test('creditPrivateWork credits people with amounts only', () => {
  const c = { ...config, creditPrivateWork: true };
  const s = emptyState(c); s.seen = {}; s.caps = {};
  const r = earn([{ key: 'm:p', kind: 'merge', at: NOW, who: U('ada'), repo: 'acme/secret', short: 'secret', private: true, title: SECRET_TITLE, number: 1, additions: 10, deletions: 0 }],
    { state: s, config: c, runId: 'r', now: NOW, salt: 'pepper', teamOf: x => x });
  const line = r.entries.find(e => e.type === 'earn');
  ok(line?.private && line.gold > 0 && !line.counts, 'expected a private amount-only line');
  ok(!JSON.stringify(r.entries).includes(SECRET_TITLE) && !JSON.stringify(r.entries).includes('secret'), 'private details leaked');
});

console.log('spending');
const funded = () => rebuild([earnLine('ada', 100, 10), earnLine('bob', 5, 0)], config);
const spend = (st, iss, over) => processSpend(iss, st, ctx(over));
await test('reads issue forms, including empty fields', () => {
  eq(parseForm('### Teammate\n\n@bob\n\n### What for?\n\n_No response_'), { Teammate: '@bob', 'What for?': '' });
});
await test('a valid thanks moves gold', async () => {
  const s = funded();
  const r = await spend(s, issue(1, 'goblin: thanks', 'ada', form({ Teammate: '@bob', Gold: '10', 'What for?': 'great review' })));
  ok(r.ok, r.reply); r.entries.forEach(e => apply(s, e));
  eq([s.people.U_ada.gold, s.people.U_bob.gold], [90, 15]);
});
for (const [name, iss, over] of [
  ['rejects thanking yourself', issue(2, 'goblin: thanks', 'ada', form({ Teammate: 'ada', Gold: '5' }))],
  ['rejects too little gold', issue(3, 'goblin: thanks', 'bob', form({ Teammate: 'ada', Gold: '50' }))],
  ['rejects a bad amount', issue(4, 'goblin: thanks', 'ada', form({ Teammate: 'bob', Gold: '-3' }))],
  ['rejects more than the maximum', issue(5, 'goblin: thanks', 'ada', form({ Teammate: 'bob', Gold: '9999' }))],
  ['rejects an edited request', issue(6, 'goblin: thanks', 'ada', form({ Teammate: 'bob', Gold: '5' }), { lastEditedAt: NOW })],
  ['rejects a non-member', issue(7, 'goblin: thanks', 'ada', form({ Teammate: 'bob', Gold: '5' })), { isSpender: async () => false }],
  ['rejects an unknown teammate', issue(8, 'goblin: thanks', 'ada', form({ Teammate: 'nobody', Gold: '5' }))],
  ['rejects a bounty on a closed issue', issue(9, 'goblin: bounty', 'ada', form({ Repository: 'web', 'Issue number': '4', Gold: '5' })), { lookupIssue: async () => ({ id: 'I4', state: 'CLOSED', title: 'x', url: '', private: false }) }],
  ['rejects a bounty outside the org', issue(10, 'goblin: bounty', 'ada', form({ Repository: 'evil/web', 'Issue number': '4', Gold: '5' }))],
  ['rejects a bounty on a private repo by default', issue(11, 'goblin: bounty', 'ada', form({ Repository: 'web', 'Issue number': '4', Gold: '5' })), { lookupIssue: async () => ({ id: 'I4', state: 'OPEN', title: 'x', url: '', private: true }) }],
  ['rejects funding a room that does not exist', issue(12, 'goblin: fund', 'ada', form({ Room: 'Moon base', Scrolls: '1' }))]
]) await test(name, async () => { const r = await spend(funded(), iss, over); ok(r && !r.ok && !r.entries.length, `expected a rejection, got ${JSON.stringify(r)}`); });
await test('never processes the same request twice', async () => {
  const s = funded(), iss = issue(13, 'goblin: thanks', 'ada', form({ Teammate: 'bob', Gold: '5' }));
  (await spend(s, iss)).entries.forEach(e => apply(s, e));
  const again = await spend(s, iss);
  ok(again.already && !again.entries.length, 'second pass should be a no-op');
  eq(s.people.U_ada.gold, 95);
});
await test('funding is matched by the treasury and builds the room', async () => {
  const s = rebuild([earnLine('ada', 100, 20), { txid: 'tr', type: 'treasury', at: NOW, gold: 100, scrolls: 20 }], config);
  const r = await spend(s, issue(14, 'goblin: fund', 'ada', form({ Room: 'Library', Scrolls: '10', Gold: '30' })));
  r.entries.forEach(e => apply(s, e));
  ok(s.rooms.library.builtAt, 'library should be built');
  eq([s.people.U_ada.scrolls, s.people.U_ada.gold, s.treasury.scrolls, s.treasury.gold], [10, 70, 10, 70]);
});

console.log('bounties');
const withBounty = () => {
  const s = funded();
  apply(s, { txid: 'spend:B', type: 'bounty-open', at: NOW, from: U('ada'), gold: 20, target: { repo: 'web', number: 4, nodeId: 'I4', private: false, title: 't', url: 'u' }, expires: '2026-12-30T00:00:00Z' });
  return s;
};
const closer = (stateReason, cl, assignee) => async () => ({ I4: { id: 'I4', state: 'CLOSED', stateReason, assignees: { nodes: assignee ? [{ __typename: 'User', ...assignee, avatarUrl: null }] : [] }, timelineItems: { nodes: [{ closer: cl }] } } });
await test('pays the author of the closing pull request', async () => {
  const s = withBounty();
  const es = await settleBounties(s, { now: NOW, lookup: closer('COMPLETED', { __typename: 'PullRequest', merged: true, author: { __typename: 'User', id: 'U_bob', login: 'bob' } }) });
  es.forEach(e => apply(s, e));
  eq([es[0].type, s.people.U_bob.gold, s.people.U_ada.gold], ['bounty-payout', 25, 80]);
});
await test('refunds when closed as not planned', async () => {
  const s = withBounty();
  const es = await settleBounties(s, { now: NOW, lookup: closer('NOT_PLANNED', null) });
  es.forEach(e => apply(s, e)); eq([es[0].type, s.people.U_ada.gold], ['bounty-refund', 100]);
});
await test('refunds a manual close with nobody to pay', async () => {
  const es = await settleBounties(withBounty(), { now: NOW, lookup: closer('COMPLETED', null) });
  eq(es[0].type, 'bounty-refund');
});
await test('pays the assignee on a manual close', async () => {
  const es = await settleBounties(withBounty(), { now: NOW, lookup: closer('COMPLETED', null, { id: 'U_cat', login: 'cat' }) });
  eq([es[0].type, es[0].to.login], ['bounty-payout', 'cat']);
});
await test('refunds an expired bounty', async () => {
  const es = await settleBounties(withBounty(), { now: '2027-01-05T00:00:00Z', lookup: async () => ({ I4: { id: 'I4', state: 'OPEN' } }) });
  eq([es[0].type, es[0].reason], ['bounty-refund', 'expired']);
});

console.log('privacy');
await test('no private title or repo name reaches any published file', () => {
  execFileSync('node', [join(ROOT, 'scripts/goblin.mjs'), '--demo'], { cwd: ROOT, stdio: 'pipe' });
  const files = ['docs/data/realm.json', 'docs/data/state.json', 'docs/card.svg', 'docs/card-dark.svg',
    ...readdirSync(join(ROOT, 'docs/data/ledger')).map(f => `docs/data/ledger/${f}`)];
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    ok(!text.includes(SECRET_TITLE) && !text.includes('secret-vault'), `${f} leaked private details`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
