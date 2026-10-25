import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import MarkdownIt from 'markdown-it';
import { homePage, isMarkdown, wikiGroups, wikiUrl } from '../public/wiki-model.js';
import { githubSource } from '../public/wiki-source.js';
import { wikiRenderer } from '../public/wiki-content.js';

function checkLinks(wiki, documents, root) {
  const home = homePage(wiki.files);
  for (const [page, document] of documents) {
    const current = new URL(wikiUrl(root, wiki.name, page), root);
    for (const [, href] of document.html.matchAll(/href="([^"]*)"/g)) {
      const url = new URL(href.replaceAll('&amp;', '&'), current);
      if (url.origin !== root.origin || url.pathname !== root.pathname || url.searchParams.get('wiki') !== wiki.name) continue;
      const target = url.searchParams.get('page') || home;
      assert.ok(documents.has(target), `Broken wiki link in ${wiki.name}/${page}: ${target}`);
      if (!url.hash) continue;
      const linked = documents.get(target);
      const ids = new Set([linked.titleId, ...Array.from(linked.html.matchAll(/id="([^"]*)"/g), (match) => match[1])]);
      assert.ok(ids.has(decodeURIComponent(url.hash.slice(1))), `Missing heading in ${wiki.name}/${target}: ${url.hash}`);
    }
  }
}

async function checkWiki(source, repository, root, render) {
  const wiki = await source.loadWiki(repository.name);
  const pages = wiki.files.filter(isMarkdown);
  const documents = new Map();
  homePage(wiki.files);
  for (let index = 0; index < pages.length; index += 6) {
    const batch = await Promise.all(pages.slice(index, index + 6).map(async (page) => [page, render(await wiki.read(page), { page, wiki, root })]));
    for (const [page, document] of batch) documents.set(page, document);
  }
  checkLinks(wiki, documents, root);
  console.log(`Checked ${wiki.name}: ${pages.length} pages and their internal links.`);
}

async function main() {
  const config = JSON.parse(await readFile(new URL('../site.config.json', import.meta.url), 'utf8'));
  const source = githubSource(config.githubOwner);
  const repositories = await source.repositories();
  const root = new URL('/', config.wikisOrigin);
  const render = wikiRenderer(MarkdownIt);
  for (const [group, label] of Object.entries(wikiGroups)) console.log(`${label}: ${repositories.filter((wiki) => wiki.group === group).length} wikis.`);
  for (const repository of repositories) await checkWiki(source, repository, root, render);
  console.log(`GitHub check passed for ${config.githubOwner}.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
