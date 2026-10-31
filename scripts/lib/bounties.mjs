// Settles open bounties. Paid to whoever resolved the issue (merged PR author, closing commit
// author, or assignee); refunded if it was closed as not planned or duplicate, has nobody to
// pay, vanished, or expired while still open.
import { resolverOf } from './ingest.mjs';

export const BOUNTY_FIELDS = `... on Issue {
  id state stateReason
  assignees(first: 1) { nodes { __typename login ... on User { id avatarUrl } } }
  timelineItems(itemTypes: [CLOSED_EVENT], last: 1) { nodes { ... on ClosedEvent {
    closer { __typename ... on PullRequest { merged author { __typename login ... on User { id avatarUrl } } } ... on Commit { author { user { id login avatarUrl } } } }
  } } }
}`;

export async function lookupNodes(gh, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const d = await gh.graphql(`query($ids:[ID!]!){ nodes(ids:$ids){ ${BOUNTY_FIELDS} } }`, { ids: ids.slice(i, i + 50) }).catch(() => ({ nodes: [] }));
    for (const n of d.nodes || []) if (n?.id) out[n.id] = n;
  }
  return out;
}

export async function settleBounties(state, { now, lookup }) {
  const open = Object.values(state.bounties).filter(b => b.status === 'open');
  if (!open.length) return [];
  const nodes = await lookup([...new Set(open.map(b => b.target.nodeId))]);
  const entries = [];
  const refund = (b, reason) => entries.push({ txid: `${b.id}:refund`, type: 'bounty-refund', at: now, bounty: b.id, to: { id: b.fromId, login: b.from }, gold: b.gold, reason });
  for (const b of open) {
    const n = nodes[b.target.nodeId];
    if (!n) { refund(b, 'issue no longer visible'); continue; }
    if (n.state === 'OPEN') { if (now > b.expires) refund(b, 'expired'); continue; }
    if (n.stateReason !== 'COMPLETED') { refund(b, n.stateReason === 'DUPLICATE' ? 'closed as duplicate' : 'closed as not planned'); continue; }
    const res = resolverOf(n);
    if (!res) { refund(b, 'closed without a pull request, commit or assignee'); continue; }
    entries.push({ txid: `${b.id}:payout`, type: 'bounty-payout', at: now, bounty: b.id, to: res.person, gold: b.gold, via: res.via });
  }
  return entries;
}
