import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function normalizeBase(value = '') {
  const base = value.replace(/^\/+|\/+$/g, '');
  if (base && !base.split('/').every((part) => /^[\w.-]+$/.test(part) && !['.', '..'].includes(part))) {
    throw new Error('BASE_PATH must be a URL path, such as /blog.');
  }
  return base ? `/${base}` : '';
}

function gitDates(root, filename) {
  try {
    const history = execFileSync('git', ['log', '--follow', '--format=%aI', '--', `articles/${filename}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean);
    const dirty = execFileSync('git', ['status', '--porcelain', '--', `articles/${filename}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { created: history.at(-1), modified: history[0], dirty: Boolean(dirty) };
  } catch {
    return { dirty: true };
  }
}

export async function loadArticles(root, base = '') {
  const folder = path.join(root, 'articles');
  const filenames = (await readdir(folder)).filter((name) => /\.(md|markdown)$/i.test(name)).sort();
  const dateFile = path.join(root, '.article-dates.json');
  let saved = {};
  try { saved = JSON.parse(await readFile(dateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`Could not read .article-dates.json: ${error.message}`); }
  const records = new Map();
  const slugs = new Set();
  const articles = [];
  for (const filename of filenames) {
    const source = await readFile(path.join(folder, filename), 'utf8');
    const info = await stat(path.join(folder, filename));
    const title = filename.replace(/\.(md|markdown)$/i, '');
    const hash = createHash('sha256').update(source).digest('hex');
    const slug = title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || hash.slice(0, 12);
    if (slugs.has(slug)) throw new Error(`Duplicate article URL: ${filename}. Rename one of the articles.`);
    slugs.add(slug);
    const previous = Object.hasOwn(saved, filename) ? saved[filename] : Object.entries(saved).find(([name, data]) => !filenames.includes(name) && data.hash === hash)?.[1];
    const git = gitDates(root, filename);
    const created = previous?.created ?? git.created ?? (info.birthtimeMs > 0 ? info.birthtime : info.mtime).toISOString();
    const modified = previous?.hash === hash ? previous.modified : (!git.dirty && git.modified ? git.modified : info.mtime.toISOString());
    if (![created, modified].every((date) => typeof date === 'string' && Number.isFinite(Date.parse(date)))) throw new Error(`Invalid dates for ${filename} in .article-dates.json.`);
    records.set(filename, { created, modified, hash });
    articles.push({ title, filename, source, slug, created, modified, url: `${base}/articles/${encodeURIComponent(slug)}/` });
  }

  const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });
  const links = new Map(articles.map((article) => [article.filename, article.url]));
  function rewriteUrl(value, article) {
    if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return value;
    const [, pathname, suffix] = value.match(/^([^?#]*)(.*)$/s);
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return value; }
    if (/\.(md|markdown)$/i.test(decoded)) {
      const target = path.posix.normalize(decoded.startsWith('/') ? decoded : `/articles/${decoded}`);
      const filename = target.replace(/^\/articles\//, '');
      if (links.has(filename)) return links.get(filename) + suffix;
      throw new Error(`Broken article link in ${article.filename}: ${value}`);
    }
    return value.startsWith('/') ? `${base}${value}` : `${base}/articles/${value}`;
  }
  for (const article of articles) {
    const tokens = markdown.parse(article.source, {});
    function rewrite(tokens) {
      for (const token of tokens) {
        for (const attribute of ['href', 'src']) {
          const value = token.attrGet(attribute);
          if (value) token.attrSet(attribute, rewriteUrl(value, article));
        }
        if (token.children) rewrite(token.children);
      }
    }
    rewrite(tokens);
    article.html = markdown.renderer.render(tokens, markdown.options, {});
    const firstParagraph = tokens.findIndex((token) => token.type === 'paragraph_open');
    const plain = (tokens[firstParagraph + 1]?.children ?? []).map((token) => token.type === 'text' || token.type === 'code_inline' ? token.content : token.type === 'softbreak' ? ' ' : '').join('');
    article.excerpt = plain.length > 190 ? `${plain.slice(0, 187).replace(/\s+\S*$/, '')}…` : plain;
    article.minutes = Math.max(1, Math.ceil(article.source.trim().split(/\s+/u).length / 220));
  }
  const manifest = `${JSON.stringify(Object.fromEntries(records), null, 2)}\n`;
  let existing;
  try { existing = await readFile(dateFile, 'utf8'); } catch {}
  if (existing !== manifest) await writeFile(dateFile, manifest);
  return articles.sort((a, b) => Date.parse(b.created) - Date.parse(a.created) || a.title.localeCompare(b.title));
}
