import { encodePath, wikiRepository } from './wiki-model.js';

async function request(url, fetcher, json = true) {
  let response;
  try { response = await fetcher(url, { signal: AbortSignal.timeout(15000) }); }
  catch (error) {
    if (error.name === 'TimeoutError') throw new Error('The request timed out. Try again.');
    throw new Error('Could not load wiki data. Check the connection and try again.');
  }
  if (!response.ok) {
    if ([403, 429].includes(response.status)) {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      const when = reset ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString()}.` : ' Try again later.';
      throw new Error(`GitHub has limited requests from this connection.${when}`);
    }
    if (response.status === 404) throw new Error('The requested repository or file was not found.');
    throw new Error(`Could not load wiki data (HTTP ${response.status}).`);
  }
  return json ? response.json() : response.text();
}

function cached(loader) {
  const entries = new Map();
  return (key) => {
    if (!entries.has(key)) entries.set(key, loader(key).catch((error) => { entries.delete(key); throw error; }));
    return entries.get(key);
  };
}

export function githubSource(owner, fetcher = fetch) {
  const api = 'https://api.github.com';
  const repositoryApi = (name) => `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const get = (url) => request(url, fetcher);
  const repository = cached((name) => get(repositoryApi(name)));

  async function repositories() {
    const all = [];
    for (let page = 1; ; page += 1) {
      const batch = await get(`${api}/users/${encodeURIComponent(owner)}/repos?per_page=100&page=${page}`);
      all.push(...batch);
      if (batch.length < 100) return all.map(wikiRepository).filter(Boolean);
    }
  }

  async function tree(name, sha, prefix = '') {
    const url = `${repositoryApi(name)}/git/trees/${encodeURIComponent(sha)}`;
    const result = await get(`${url}?recursive=1`);
    if (!result.truncated) return result.tree.filter((entry) => entry.type === 'blob').map((entry) => prefix + entry.path);
    const level = await get(url);
    if (level.truncated) throw new Error('GitHub returned an incomplete directory. Try a smaller wiki directory.');
    const files = await Promise.all(level.tree.map((entry) => entry.type === 'tree'
      ? tree(name, entry.sha, `${prefix}${entry.path}/`)
      : entry.type === 'blob' ? [`${prefix}${entry.path}`] : []));
    return files.flat();
  }

  const loadWiki = cached(async (name) => {
    const repo = wikiRepository(await repository(name));
    if (!repo) throw new Error('This repository name does not match a wiki category.');
    const root = await get(`${repositoryApi(name)}/git/trees/${encodeURIComponent(repo.default_branch)}`);
    const directory = root.tree.find((entry) => entry.path === 'wiki' && entry.type === 'tree');
    if (!directory) throw new Error('This repository has no wiki directory.');
    const files = await tree(name, directory.sha, 'wiki/');
    const rawUrl = (file) => `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${root.sha}/${encodePath(file)}`;
    const githubUrl = (file) => `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/blob/${encodeURIComponent(repo.default_branch)}/${encodePath(file)}`;
    return { ...repo, files, rawUrl, githubUrl, read: cached((file) => request(rawUrl(file), fetcher, false)) };
  });

  return { repositories, loadWiki };
}
