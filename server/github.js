// GitHub is the audit log / version history. MongoDB is the source of truth.
// Every write to Mongo queues a snapshot commit here. Commits run one at a time
// so file SHAs never go stale, and a GitHub failure never breaks the app.

const cfg = () => ({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || 'main',
});

export const enabled = () => {
  const { token, owner, repo } = cfg();
  return Boolean(token && owner && repo);
};
export const repoName = () => (enabled() ? `${cfg().owner}/${cfg().repo}` : null);

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

async function gh(path, { allow404, ...opts } = {}) {
  const { token, owner, repo } = cfg();
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function currentSha(path) {
  const file = await gh(`/contents/${enc(path)}?ref=${cfg().branch}`, { allow404: true });
  return file?.sha;
}

let chain = Promise.resolve();
function enqueue(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

export function snapshot(path, data, message) {
  if (!enabled()) return Promise.resolve();
  return enqueue(async () => {
    const sha = await currentSha(path);
    await gh(`/contents/${enc(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        branch: cfg().branch,
        content: Buffer.from(JSON.stringify(data, null, 2) + '\n').toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    });
    console.log('[github] commit:', message);
  }).catch((err) => console.error('[github] failed:', message, '-', err.message));
}

export function remove(path, message) {
  if (!enabled()) return Promise.resolve();
  return enqueue(async () => {
    const sha = await currentSha(path);
    if (!sha) return;
    await gh(`/contents/${enc(path)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: cfg().branch }),
    });
    console.log('[github] commit:', message);
  }).catch((err) => console.error('[github] failed:', message, '-', err.message));
}

export async function history(path) {
  if (!enabled()) return [];
  const commits = await gh(`/commits?path=${encodeURIComponent(path)}&sha=${cfg().branch}&per_page=30`);
  return commits.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name,
    date: c.commit.author?.date,
    url: c.html_url,
  }));
}

export async function getVersion(path, sha) {
  if (!enabled()) throw new Error('GitHub is not configured on the server.');
  const file = await gh(`/contents/${enc(path)}?ref=${encodeURIComponent(sha)}`, { allow404: true });
  if (!file) throw new Error('That commit has no copy of this file (it may be the delete commit).');
  return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
}
