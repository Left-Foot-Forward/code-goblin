// A believable fake org, shaped exactly like GitHub API responses, so --demo and the tests
// exercise the real parsing, earning and spending code without any network.
const NAMES = ['ada', 'linus', 'grace', 'ken', 'margaret', 'dennis', 'barbara', 'guido', 'radia', 'tim'];
const user = n => ({ __typename: 'User', login: n, id: `U_${n}`, avatarUrl: null });
const bot = { __typename: 'Bot', login: 'dependabot[bot]', id: 'B_dep', avatarUrl: null };
const REPOS = [
  { name: 'api', isPrivate: false }, { name: 'web', isPrivate: false }, { name: 'infra', isPrivate: false },
  { name: 'docs', isPrivate: false }, { name: 'secret-vault', isPrivate: true }
];
const TITLES = ['Fix flaky auth test', 'Remove dead feature flags', 'Add retry to webhook sender', 'Rewrite onboarding copy',
  'Delete legacy billing module', 'Speed up CI cache', 'Dark mode for settings', 'Handle empty search results', 'Split giant utils file',
  'Docs: explain rate limits', 'Migrate cron to queues', 'Kill the old admin panel', 'Typo in README', 'Add tracing to checkout'];
export const SECRET_TITLE = 'SECRET roadmap pricing change';

export function demoItems(now, org = 'demo-org') {
  let s = 7; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = a => a[Math.floor(r() * a.length)];
  const ago = d => new Date(Date.parse(now) - d * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  const repo = x => ({ name: x.name, nameWithOwner: `${org}/${x.name}`, isPrivate: x.isPrivate, isFork: false });
  const items = [];
  for (let i = 0; i < 70; i++) {
    const rp = REPOS[i % 5], author = i % 17 === 0 ? bot : user(NAMES[Math.floor(Math.pow(r(), 1.3) * NAMES.length)]);
    const merged = ago(r() * 27 + 0.1), adds = Math.floor(Math.pow(r(), 2) * 600) + 2, dels = Math.floor(Math.pow(r(), 1.5) * (i % 6 === 0 ? 1500 : 200));
    const reviewers = [user(NAMES[(i + 3) % NAMES.length]), user(NAMES[(i + 5) % NAMES.length])];
    items.push({
      __typename: 'PullRequest', id: `PR_${i}`, number: 100 + i, title: rp.isPrivate ? SECRET_TITLE : TITLES[i % TITLES.length], url: `https://github.com/${org}/${rp.name}/pull/${100 + i}`,
      createdAt: ago(28), merged: true, mergedAt: merged, additions: adds, deletions: dels, repository: repo(rp), author,
      reviews: { nodes: reviewers.map((u, k) => ({ id: `RV_${i}_${k}`, state: k ? 'COMMENTED' : 'APPROVED', submittedAt: merged, author: u })) },
      comments: { nodes: Array.from({ length: i % 4 }, (_, k) => ({ id: `C_${i}_${k}`, createdAt: merged, author: user(pick(NAMES)) })) }
    });
  }
  for (let i = 0; i < 22; i++) {
    const rp = REPOS[i % 5], closed = ago(r() * 25 + 0.1), solver = user(pick(NAMES));
    items.push({
      __typename: 'Issue', id: `I_${i}`, number: 400 + i, title: rp.isPrivate ? SECRET_TITLE : `Bug: ${TITLES[(i + 4) % TITLES.length].toLowerCase()}`,
      url: `https://github.com/${org}/${rp.name}/issues/${400 + i}`, createdAt: ago(i % 3 === 0 ? 60 : 30), closedAt: closed, state: 'CLOSED',
      stateReason: i % 7 === 0 ? 'NOT_PLANNED' : 'COMPLETED', repository: repo(rp), author: user(pick(NAMES)), assignees: { nodes: [] },
      comments: { nodes: [{ id: `IC_${i}`, createdAt: closed, author: user(pick(NAMES)) }] },
      timelineItems: { nodes: [{ createdAt: closed, closer: i % 4 === 0 ? null : { __typename: 'PullRequest', merged: true, author: solver } }] }
    });
  }
  const repos = [{ id: 'R_new', name: 'goblin-lab', createdAt: ago(3), isPrivate: false, isFork: false }, { id: 'R_priv', name: 'secret-vault-2', createdAt: ago(2), isPrivate: true, isFork: false }];
  return { items, repos };
}

// Issues filed through the forms, as the spend queue would see them.
export function demoIssues(now) {
  const form = (fields) => Object.entries(fields).map(([k, v]) => `### ${k}\n\n${v}`).join('\n\n');
  const iss = (n, title, author, body) => ({ id: `ISS_${n}`, number: n, title, body, createdAt: now, lastEditedAt: null, authorAssociation: 'MEMBER', author: { ...user(author), avatar: null } });
  return [
    iss(1, 'goblin: fund', 'ada', form({ Room: 'Library', Scrolls: '10', Gold: '40' })),
    iss(2, 'goblin: thanks', 'linus', form({ Teammate: '@grace', Gold: '6', 'What for?': 'Unblocking the release on a Friday. Hero.' })),
    iss(3, 'goblin: thanks', 'grace', form({ Teammate: 'grace', Gold: '5', 'What for?': 'Me, myself and I' })),
    iss(4, 'goblin: bounty', 'margaret', form({ Repository: 'web', 'Issue number': '512', Gold: '20', Note: 'This one has haunted us for months' })),
    iss(5, 'goblin: bounty', 'ken', form({ Repository: 'api', 'Issue number': '777', Gold: '9', Note: 'Done already' })),
    iss(6, 'goblin: thanks', 'dennis', form({ Teammate: 'ada', Gold: '99999', 'What for?': 'too much' })),
    iss(7, 'goblin: cheer', 'barbara', ''),
    iss(8, 'goblin: fund', 'linus', form({ Room: 'Tavern', Scrolls: '3', Gold: '12' }))
  ];
}

// Fake issue lookups for bounties: #512 is open (later closed by a merged PR), #777 is a closed issue.
export function demoLookups(now, org = 'demo-org') {
  return {
    lookupIssue: async (repo, n) => n === 512 ? { id: 'I_512', state: 'OPEN', title: 'Search returns stale results', url: `https://github.com/${repo}/issues/512`, private: false }
      : n === 777 ? { id: 'I_777', state: 'CLOSED', title: 'Old thing', url: '', private: false } : null,
    lookupNodes: async ids => Object.fromEntries(ids.map(id => [id, id === 'I_512'
      ? { id, state: 'CLOSED', stateReason: 'COMPLETED', assignees: { nodes: [] }, timelineItems: { nodes: [{ closer: { __typename: 'PullRequest', merged: true, author: user('radia') } }] } }
      : { id, state: 'OPEN' }]))
  };
}
