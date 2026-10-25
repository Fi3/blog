import './vendor/markdown-it.min.js';
import { homePage, isMarkdown, pageLabel, wikiGroups, wikiUrl } from './wiki-model.js';
import { githubSource } from './wiki-source.js';
import { wikiRenderer } from './wiki-content.js';
import { escapeHtml as escape } from './html.js';
import { rememberFolders, wikiNavigation } from './wiki-navigation.js';

const app = document.querySelector('#wiki-app');
const config = JSON.parse(document.querySelector('#wiki-config').textContent);
const source = githubSource(config.owner);
const renderMarkdown = wikiRenderer(window.markdownit);
const root = () => new URL(`${location.origin}${config.root}`);
const link = (repo, page, hash) => escape(wikiUrl(root(), repo, page, hash));
const external = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
let revision = 0;
const folderStates = new Map();

function repositoryRow(wiki) {
  const github = external(`https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(wiki.name)}`, 'GitHub');
  return `<li class="article-row wiki-row"><h3><a href="${link(wiki.name)}">${escape(wiki.title)}</a></h3><p class="wiki-row-source">${github}</p>${wiki.description ? `<p>${escape(wiki.description)}</p>` : ''}</li>`;
}

function catalog(repositories) {
  const sorted = [...repositories].sort((a, b) => a.title.localeCompare(b.title));
  return `<section class="writing site-width"><h1>Wikis</h1>${Object.entries(wikiGroups).map(([group, title]) => {
    const entries = sorted.filter((wiki) => wiki.group === group);
    return `<section class="wiki-group" aria-labelledby="${group}-heading"><h2 id="${group}-heading">${escape(title)}</h2>${entries.length ? `<ul class="wiki-list">${entries.map(repositoryRow).join('')}</ul>` : '<p class="empty-state">No wikis in this section yet.</p>'}</section>`;
  }).join('')}</section>`;
}

function wikiPage(wiki, page, document) {
  const github = external(wiki.githubUrl(page), 'View on GitHub');
  return `<div class="wiki-reader site-width"><div class="wiki-context"><a href="${link()}">All wikis</a><span>${escape(wikiGroups[wiki.group])}</span></div><div class="wiki-layout">${wikiNavigation(wiki, page, root(), folderStates.get(wiki.name))}<article class="article-story wiki-story"><header class="article-heading"><p class="wiki-name"><a href="${link(wiki.name)}">${escape(wiki.title)}</a></p><h1${document.titleId ? ` id="${escape(document.titleId)}"` : ''}>${escape(document.title || pageLabel(page))}</h1><p class="wiki-origin">${github}</p></header><div class="article-body"><div class="prose">${document.html}</div></div></article></div></div>`;
}

function finishNavigation(focus) {
  if (focus) {
    const heading = app.querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  if (location.hash) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    document.getElementById(id)?.scrollIntoView();
  }
}

async function navigate(focus = false) {
  const current = ++revision;
  rememberFolders(app.querySelector('.wiki-pages'), folderStates);
  const query = new URLSearchParams(location.search);
  const name = query.get('wiki');
  app.setAttribute('aria-busy', 'true');
  app.innerHTML = '<div class="writing site-width"><p role="status" class="empty-state">Loading wikis…</p></div>';
  try {
    let html;
    let title = 'Wikis';
    if (name) {
      const wiki = await source.loadWiki(name);
      const page = query.get('page') || homePage(wiki.files);
      if (!page.startsWith('wiki/') || !isMarkdown(page) || !wiki.files.includes(page)) throw new Error('The requested wiki page was not found.');
      const content = renderMarkdown(await wiki.read(page), { page, wiki, root: root() });
      html = wikiPage(wiki, page, content);
      title = `${content.title || pageLabel(page)} · ${wiki.title}`;
    } else {
      html = catalog(await source.repositories());
    }
    if (current !== revision) return;
    app.innerHTML = html;
    document.title = `${title} · ${config.title}`;
    finishNavigation(focus);
  } catch (error) {
    if (current !== revision) return;
    app.innerHTML = `<section class="writing site-width"><h1>Could not load this wiki.</h1><p role="alert">${escape(error.message)}</p><div class="wiki-actions"><button type="button" data-retry>Try again</button><a href="${link()}">All wikis</a></div></section>`;
  } finally {
    if (current === revision) app.setAttribute('aria-busy', 'false');
  }
}

app.addEventListener('click', (event) => {
  if (event.target.closest('[data-retry]')) { navigate(); return; }
  const anchor = event.target.closest('a[href]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || url.pathname !== config.root || url.search === location.search && url.hash) return;
  event.preventDefault();
  history.pushState(null, '', url);
  navigate(true);
});
window.addEventListener('popstate', () => navigate(true));
navigate();
