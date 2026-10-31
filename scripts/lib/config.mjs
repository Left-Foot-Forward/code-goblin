// goblin.config.json with defaults filled in. Every number in the economy lives here.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = {
  org: '',
  name: 'Grub',
  // "members": only org members (or repo collaborators for a personal account) can spend. "anyone": anyone with a balance.
  spenders: 'members',
  // false: private-repo work pools anonymously into the treasury. true: people earn from it (amounts only, never details).
  creditPrivateWork: false,
  allowPrivateBounties: false,
  maxTransfer: 100,
  thanksPerDay: 5,
  bountyExpiryDays: 60,
  backfillDays: 30,
  teams: {},
  rewards: {
    merge: { scrolls: 1, gold: 5, sizeGoldMax: 5, deleteGoldMax: 8 },
    review: { decisive: 3, comment: 1 },
    comment: { gold: 1, perDay: 10, perThread: 3 },
    issueClosed: { scrolls: 1, gold: 4 },
    newRepo: { treasury: 20 }
  },
  quests: { scale: 1 },
  roomCostScale: 1
};

const merge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v;
  return out;
};

export function loadConfig(root) {
  const path = join(root, 'goblin.config.json');
  const user = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  return merge(DEFAULTS, user);
}
