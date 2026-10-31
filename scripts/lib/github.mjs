// Minimal GitHub API client. Node 20+ (global fetch), no dependencies.
// Two clients are used: one that can read the whole org (GOBLIN_TOKEN or an App token)
// and one for the game repo itself (the workflow's GITHUB_TOKEN).

const API = 'https://api.github.com';

export function client(token) {
  const headers = extra => ({ authorization: `bearer ${token}`, 'user-agent': 'code-goblin', ...extra });

  async function graphql(query, variables = {}) {
    const res = await fetch(`${API}/graphql`, {
      method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ query, variables })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.errors) throw new Error(`GitHub GraphQL ${res.status}: ${JSON.stringify(body.errors || body).slice(0, 400)}`);
    return body.data;
  }

  // Returns {status, data} without throwing, for calls where a 404 is an answer (membership checks).
  async function request(method, path, data) {
    const res = await fetch(`${API}${path}`, {
      method, redirect: 'manual',
      headers: headers({ accept: 'application/vnd.github+json', 'content-type': 'application/json' }),
      body: data ? JSON.stringify(data) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: res.status, data: json };
  }

  async function rest(method, path, data) {
    const r = await request(method, path, data);
    if (r.status >= 400) throw new Error(`GitHub REST ${method} ${path}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data;
  }

  return { graphql, request, rest, token };
}

// Small avatar as a data URI so the README card is self-contained (GitHub's image proxy blocks external fetches inside SVG).
export async function avatarDataURI(url, size = 64) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.set('s', String(size));
    const res = await fetch(u, { headers: { 'user-agent': 'code-goblin' } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/png';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch { return null; }
}
