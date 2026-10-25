import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { build, projectRoot } from '../scripts/build.mjs';
import { homePage, wikiRepository, wikiUrl } from '../public/wiki-model.js';
import { githubSource } from '../public/wiki-source.js';
import { wikiRenderer } from '../public/wiki-content.js';

const repository = (name, extra = {}) => ({ name, default_branch: 'notes/main', ...extra });
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

test('wiki names select categories and preserve the title words', () => {
  assert.equal(wikiRepository(repository('wiki-sloppy-some_notes')).title, 'some notes');
  assert.equal(wikiRepository(repository('wiki-curated-research')).group, 'curated');
  for (const name of ['other-wiki', 'wiki-curated-', 'wiki-sloppy', 'wiki-other-notes']) assert.equal(wikiRepository(repository(name)), null);
  assert.equal(wikiRepository(repository('wiki-curated-private', { private: true })), null);
});

test('wiki home pages have a stable fallback and direct URLs retain the base path', () => {
  const files = ['wiki/z.md', 'wiki/README.md', 'wiki/index.md', 'wiki/concepts/a.md'];
  assert.equal(homePage(files), 'wiki/index.md');
  assert.equal(homePage(files.slice(0, 2)), 'wiki/README.md');
  assert.equal(homePage(['wiki/z.md', 'wiki/a.markdown']), 'wiki/a.markdown');
  assert.throws(() => homePage(['wiki/image.png']), /no Markdown pages/);
  const root = new URL('https://example.com/personal/wikis/?wiki=old&page=old.md');
  const result = new URL(wikiUrl(root, 'wiki-sloppy-notes', 'wiki/a b.md', '#scope'), root);
  assert.equal(result.pathname, '/personal/wikis/');
  assert.equal(result.searchParams.get('page'), 'wiki/a b.md');
  assert.equal(result.hash, '#scope');
  assert.equal(wikiUrl(root), '/personal/wikis/');
});

test('GitHub discovery checks every page and does not require a fixed repository name', async () => {
  const requests = [];
  const source = githubSource('an-owner', async (url) => {
    requests.push(url);
    return json(url.endsWith('page=1') ? Array.from({ length: 100 }, (_, index) => repository(`other-${index}`)) : [repository('wiki-sloppy-late-result'), repository('wiki-curated-reviewed')]);
  });
  const repos = await source.repositories();
  assert.deepEqual(repos.map(({ group }) => group), ['sloppy', 'curated']);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((url) => url.startsWith('https://api.github.com/users/an-owner/repos?')));
});

test('GitHub pages use the default branch, load only the wiki tree, and reuse reads', async () => {
  const requests = [];
  const source = githubSource('an-owner', async (url) => {
    requests.push(url);
    if (url.endsWith('/wiki-sloppy-new-notes')) return json(repository('wiki-sloppy-new-notes'));
    if (url.endsWith('/git/trees/notes%2Fmain')) return json({ sha: 'commit-sha', tree: [{ path: 'wiki', type: 'tree', sha: 'wiki-tree' }, { path: 'raw', type: 'tree', sha: 'raw-tree' }] });
    if (url.endsWith('/git/trees/wiki-tree?recursive=1')) return json({ tree: [{ path: 'index.md', type: 'blob' }, { path: 'concepts', type: 'tree' }, { path: 'concepts/a b.md', type: 'blob' }, { path: 'image.png', type: 'blob' }] });
    if (url.endsWith('/commit-sha/wiki/concepts/a%20b.md')) return new Response('# A page');
    throw new Error(`Unexpected request: ${url}`);
  });
  const wiki = await source.loadWiki('wiki-sloppy-new-notes');
  assert.deepEqual(wiki.files, ['wiki/index.md', 'wiki/concepts/a b.md', 'wiki/image.png']);
  assert.equal(await wiki.read('wiki/concepts/a b.md'), '# A page');
  assert.equal(await wiki.read('wiki/concepts/a b.md'), '# A page');
  assert.equal(await source.loadWiki(wiki.name), wiki);
  assert.equal(requests.length, 4);
  assert.match(wiki.githubUrl('wiki/concepts/a b.md'), /\/blob\/notes%2Fmain\/wiki\/concepts\/a%20b.md$/);
  assert.ok(!requests.some((url) => url.includes('raw-tree')));
});

test('a truncated recursive wiki tree is completed through directory requests', async () => {
  const source = githubSource('an-owner', async (url) => {
    if (url.endsWith('/wiki-curated-large')) return json(repository('wiki-curated-large', { default_branch: 'main' }));
    if (url.endsWith('/git/trees/main')) return json({ sha: 'commit', tree: [{ path: 'wiki', type: 'tree', sha: 'root' }] });
    if (url.endsWith('/git/trees/root?recursive=1')) return json({ truncated: true, tree: [] });
    if (url.endsWith('/git/trees/root')) return json({ tree: [{ path: 'index.md', type: 'blob' }, { path: 'nested', type: 'tree', sha: 'nested' }] });
    if (url.endsWith('/git/trees/nested?recursive=1')) return json({ tree: [{ path: 'page.md', type: 'blob' }] });
    throw new Error(`Unexpected request: ${url}`);
  });
  assert.deepEqual((await source.loadWiki('wiki-curated-large')).files, ['wiki/index.md', 'wiki/nested/page.md']);
});

test('GitHub errors permit a retry and missing wiki directories produce a clear error', async () => {
  let attempt = 0;
  const source = githubSource('an-owner', async (url) => {
    if (attempt++ === 0) return json({}, 403, { 'x-ratelimit-reset': '1800000000' });
    if (url.endsWith('/wiki-curated-notes')) return json(repository('wiki-curated-notes', { default_branch: 'main' }));
    return json({ tree: [] });
  });
  await assert.rejects(source.loadWiki('wiki-curated-notes'), /limited requests.*Try again after/);
  await assert.rejects(source.loadWiki('wiki-curated-notes'), /no wiki directory/);
  await assert.rejects(githubSource('an-owner', async () => json({}, 404)).repositories(), /not found/);
  await assert.rejects(githubSource('an-owner', async () => { throw new TypeError('Failed to fetch'); }).repositories(), /Check the connection/);
  await assert.rejects(githubSource('an-owner', async () => { throw new DOMException('Timed out', 'TimeoutError'); }).repositories(), /timed out/);
});

test('wiki Markdown keeps nested page links on the site and resolves source assets', () => {
  const render = wikiRenderer(MarkdownIt);
  const wiki = {
    name: 'wiki-curated-notes',
    files: ['wiki/index.md', 'wiki/concepts/page.md', 'wiki/checks/a b.md', 'wiki/image.png'],
    rawUrl: (file) => `https://raw.example/${file}`,
    githubUrl: (file) => `https://github.example/${file}`
  };
  const root = new URL('https://example.com/personal/wikis/');
  const result = render('---\ntitle: Hidden metadata\n---\n# A page\n\n[Home](../index.md) [Check](../checks/a%20b.md#scope) [Short](../checks/a%20b) [Local](#scope) [Source](../../raw/source.md) [Web](https://example.org)\n\n![Image](../image.png)\n\n## Scope\n\n## Scope\n\n<script>alert(1)</script>\n\n| Name | Value |\n| --- | --- |\n| A | B |', { page: 'wiki/concepts/page.md', wiki, root });
  assert.equal(result.title, 'A page');
  assert.equal(result.titleId, 'a-page');
  assert.doesNotMatch(result.html, /Hidden metadata|<h1|<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /page=wiki%2Fchecks%2Fa\+b.md#scope/);
  assert.match(result.html, /href="\/personal\/wikis\/\?wiki=wiki-curated-notes"/);
  assert.match(result.html, /href="#scope"/);
  assert.match(result.html, /href="https:\/\/github.example\/raw\/source.md"/);
  assert.match(result.html, /href="https:\/\/example.org"/);
  assert.match(result.html, /src="https:\/\/raw.example\/wiki\/image.png"/);
  assert.match(result.html, /id="scope"/);
  assert.match(result.html, /id="scope-1"/);
  assert.match(result.html, /<table>/);
  assert.doesNotMatch(render('[Bad](javascript:alert(1))', { page: 'wiki/index.md', wiki, root }).html, /href="javascript:/);
  const absolute = render('[GitHub page](https://github.example/wiki/checks/a%20b.md) [Raw page](https://raw.example/wiki/index.md) [Directory](/wiki)', { page: 'wiki/index.md', wiki, root }).html;
  assert.doesNotMatch(absolute, /href="https:\/\/(?:github|raw).example/);
  assert.match(absolute, /page=wiki%2Fchecks%2Fa\+b.md/);
  const headings = render('## Scope\n\n## Scope\n\n## Scope-1', { page: 'wiki/index.md', wiki, root }).html;
  assert.match(headings, /id="scope-1-1"/);
});

test('both builds include navigation and the wiki runtime without stored wiki content', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'fi3-site-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'articles'));
  await cp(path.join(projectRoot, 'public'), path.join(root, 'public'), { recursive: true });
  await cp(path.join(projectRoot, 'site.config.json'), path.join(root, 'site.config.json'));
  const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
  delete config.articleRedirects;
  await writeFile(path.join(root, 'site.config.json'), JSON.stringify(config));
  for (const section of ['articles', 'wikis']) {
    const { output } = await build({ root, basePath: '/personal', section });
    const wikiFile = section === 'articles' ? 'wikis/index.html' : 'index.html';
    const wiki = await readFile(path.join(output, wikiFile), 'utf8');
    assert.match(wiki, /Kinda curated/);
    assert.match(wiki, /Sloppy/);
    assert.match(wiki, /href="https:\/\/blog.filippomerli.com\/"/);
    assert.match(wiki, /href="https:\/\/wikis.filippomerli.com\/"/);
    assert.match(wiki, /src="\/personal\/wikis.js"/);
    assert.ok(wiki.includes(`"root":"/personal/${section === 'articles' ? 'wikis/' : ''}"`));
    assert.equal((await readFile(path.join(output, 'CNAME'), 'utf8')).trim(), `${section === 'articles' ? 'blog' : 'wikis'}.filippomerli.com`);
    assert.ok(await readFile(path.join(output, 'vendor/markdown-it.min.js')));
    assert.doesNotMatch(wiki, /wiki-source|wiki-(?:curated|sloppy)-/);
  }
  await assert.rejects(build({ root, section: 'invalid' }), /SITE_SECTION/);
});
