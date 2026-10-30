// Minimal GitHub API helpers. Node 20+ (global fetch), no dependencies.

const API = 'https://api.github.com';
const token = () => process.env.GOBLIN_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

export async function graphql(query, variables = {}) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { authorization: `bearer ${token()}`, 'content-type': 'application/json', 'user-agent': 'code-goblin' },
    body: JSON.stringify({ query, variables })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) throw new Error(`GitHub GraphQL ${res.status}: ${JSON.stringify(body.errors || body).slice(0, 400)}`);
  return body.data;
}

export async function rest(method, path, data) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `bearer ${token()}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'code-goblin' },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!res.ok) throw new Error(`GitHub REST ${method} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

// Small avatar as a data URI so the README card is self-contained (GitHub's image proxy blocks external fetches inside SVG).
export async function avatarDataURI(url, size = 64) {
  try {
    const u = new URL(url);
    u.searchParams.set('s', String(size));
    const res = await fetch(u, { headers: { 'user-agent': 'code-goblin' } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/png';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch { return null; }
}
