export const wikiGroups = { curated: 'Kinda curated', sloppy: 'Sloppy' };
export const isMarkdown = (path) => /\.(md|markdown)$/i.test(path);
export const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
export const pageLabel = (path) => path.replace(/^wiki\//, '').replace(/\.(md|markdown)$/i, '').replace(/[-_]+/g, ' ');

export function wikiRepository(repository) {
  const match = /^wiki-(curated|sloppy)-(.+)$/.exec(repository.name ?? '');
  if (!match || repository.private) return null;
  return { ...repository, group: match[1], title: match[2].replace(/[-_]+/g, ' ') };
}

export function wikiUrl(root, repository, page, hash = '') {
  const query = new URLSearchParams(root.search);
  query.delete('wiki');
  query.delete('page');
  if (repository) query.set('wiki', repository);
  if (page) query.set('page', page);
  return `${root.pathname}${query.size ? `?${query}` : ''}${hash}`;
}

export function homePage(files) {
  const pages = files.filter(isMarkdown).sort();
  const home = pages.find((file) => /^wiki\/index\.(md|markdown)$/i.test(file))
    ?? pages.find((file) => /^wiki\/readme\.(md|markdown)$/i.test(file))
    ?? pages[0];
  if (!home) throw new Error('This repository has no Markdown pages in its wiki directory.');
  return home;
}

export function resolveWikiPath(value, current) {
  const origin = 'https://wiki.invalid';
  const url = new URL(value, `${origin}/${encodePath(current)}`);
  if (url.origin !== origin) return null;
  return { path: decodeURIComponent(url.pathname).slice(1), suffix: `${url.search}${url.hash}` };
}
