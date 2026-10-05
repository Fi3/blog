import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, projectRoot } from '../scripts/build.mjs';
import { loadArticles, normalizeBase } from '../scripts/content.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'fi3-blog-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'articles'));
  await cp(path.join(projectRoot, 'public'), path.join(root, 'public'), { recursive: true });
  await cp(path.join(projectRoot, 'site.config.json'), path.join(root, 'site.config.json'));
  return root;
}

test('build uses filename titles, escapes HTML, and works at a repository base path', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'articles', 'Hello & goodbye.md'), 'A paragraph.\n\n## A heading\n\n<script>alert(1)</script>\n\n[Other](Caf%C3%A9.md)\n\n![An image](/images/test.svg)\n');
  await writeFile(path.join(root, 'articles', 'Café.md'), 'A second article.');
  await mkdir(path.join(root, 'public', 'images'));
  await writeFile(path.join(root, 'public', 'images', 'test.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const { output } = await build({ root, basePath: '/blog/' });
  const page = await readFile(path.join(output, 'articles', 'hello-goodbye', 'index.html'), 'utf8');
  assert.match(page, /<h1>Hello &amp; goodbye<\/h1>/);
  assert.match(page, /href="\/blog\/styles.css"/);
  assert.match(page, /href="\/blog\/articles\/cafe\/"/);
  assert.match(page, /src="\/blog\/images\/test.svg"/);
  assert.match(page, /&lt;script&gt;/);
  assert.doesNotMatch(page, /<script>/);
  assert.match(page, /<dt>Created<\/dt>/);
  assert.match(page, /<dt>Last modified<\/dt>/);
  assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /Hello &amp; goodbye/);
  assert.ok(await readFile(path.join(output, 'images', 'test.svg')));
  assert.ok(await readFile(path.join(output, '404.html')));
  await assert.rejects(readFile(path.join(output, 'articles', 'Café.md')), { code: 'ENOENT' });
});

test('saved creation dates survive checkout timestamps; edits update only modification', async (t) => {
  const root = await fixture(t);
  const file = path.join(root, 'articles', 'A note.md');
  await writeFile(file, 'First version.');
  const [first] = await loadArticles(root);
  const newTimestamp = new Date(Date.now() + 60_000);
  await utimes(file, newTimestamp, newTimestamp);
  const [unchanged] = await loadArticles(root);
  assert.equal(unchanged.created, first.created);
  assert.equal(unchanged.modified, first.modified);
  await writeFile(file, 'A changed version.');
  await utimes(file, newTimestamp, newTimestamp);
  const [edited] = await loadArticles(root);
  assert.equal(edited.created, first.created);
  assert.equal(edited.modified, newTimestamp.toISOString());
  await cp(file, path.join(root, 'articles', 'Renamed note.md'));
  await rm(file);
  const [renamed] = await loadArticles(root);
  assert.equal(renamed.created, first.created);
  assert.equal(renamed.modified, edited.modified);
});

test('Git history supplies dates when filesystem timestamps were reset by checkout', async (t) => {
  const root = await fixture(t);
  const git = (args, date) => execFileSync('git', args, { cwd: root, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com', ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) } });
  git(['init']);
  const file = path.join(root, 'articles', 'History.md');
  await writeFile(file, 'First.');
  git(['add', 'articles']);
  git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'First'], '2025-01-01T12:00:00+00:00');
  await writeFile(file, 'Second.');
  git(['add', 'articles']);
  git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'Second'], '2025-02-01T12:00:00+00:00');
  const [article] = await loadArticles(root);
  assert.equal(new Date(article.created).toISOString(), '2025-01-01T12:00:00.000Z');
  assert.equal(new Date(article.modified).toISOString(), '2025-02-01T12:00:00.000Z');
});

test('duplicate URLs and broken Markdown article links produce useful errors', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'articles', 'Hello world.md'), 'One.');
  await writeFile(path.join(root, 'articles', 'Hello-world.md'), 'Two.');
  await assert.rejects(loadArticles(root), /Duplicate article URL/);
  await rm(path.join(root, 'articles', 'Hello-world.md'));
  await writeFile(path.join(root, 'articles', 'Hello world.md'), '[Missing](Missing.md)');
  await assert.rejects(loadArticles(root), /Broken article link/);
});

test('empty blog renders gracefully and base paths are normalized safely', async (t) => {
  const root = await fixture(t);
  const { output } = await build({ root });
  assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /No articles yet/);
  assert.equal(normalizeBase('/blog/'), '/blog');
  assert.equal(normalizeBase('/'), '');
  assert.throws(() => normalizeBase('/../outside'), /BASE_PATH/);
});
