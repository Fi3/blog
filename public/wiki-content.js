import { homePage, isMarkdown, resolveWikiPath, wikiUrl } from './wiki-model.js';

function headingId(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
}

function rewriteUrl(value, page, wiki, root, image) {
  if (!value || value.startsWith('#')) return value;
  const prefix = [wiki.githubUrl?.(''), wiki.rawUrl('')].filter(Boolean).find((prefix) => value.startsWith(prefix));
  if (prefix) value = `/${value.slice(prefix.length)}`;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value;
  let target;
  try { target = resolveWikiPath(value, page); } catch { return value; }
  if (!target) return value;
  const files = new Set(wiki.files);
  let filename = target.path;
  if (filename === 'wiki' || filename.startsWith('wiki/') && filename.endsWith('/')) {
    const directory = filename.replace(/\/$/, '');
    filename = ['index.md', 'README.md', 'index.markdown', 'README.markdown'].map((name) => `${directory}/${name}`).find((name) => files.has(name)) ?? filename;
  }
  if (!image && !files.has(filename) && !/\.[^/]+$/.test(filename)) {
    filename = [`${filename}.md`, `${filename}.markdown`].find((name) => files.has(name)) ?? filename;
  }
  if (!image && filename.startsWith('wiki/') && isMarkdown(filename)) {
    const hash = target.suffix.includes('#') ? target.suffix.slice(target.suffix.indexOf('#')) : '';
    return wikiUrl(root, wiki.name, filename === homePage(wiki.files) ? null : filename, hash);
  }
  if (image || !isMarkdown(filename)) return wiki.rawUrl(filename) + target.suffix;
  return wiki.githubUrl ? wiki.githubUrl(filename) + target.suffix : wiki.rawUrl(filename) + target.suffix;
}

export function wikiRenderer(markdownit) {
  const markdown = markdownit({ html: false, linkify: true, typographer: true });
  return (source, { page, wiki, root }) => {
    const body = source.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
    const tokens = markdown.parse(body, {});
    const ids = new Set();
    let title;
    let titleId;
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type !== 'heading_open') continue;
      const text = (tokens[index + 1].children ?? []).map((child) => child.content).join('');
      const slug = headingId(text);
      let id = slug;
      let count = 0;
      while (ids.has(id)) id = `${slug}-${++count}`;
      ids.add(id);
      token.attrSet('id', id);
      if (!title && token.tag === 'h1') {
        title = text;
        titleId = id;
        tokens.splice(index, 3);
        index -= 1;
      }
    }
    function rewrite(items) {
      for (const token of items) {
        const attribute = token.type === 'image' ? 'src' : 'href';
        const value = token.attrGet(attribute);
        if (value) token.attrSet(attribute, rewriteUrl(value, page, wiki, root, token.type === 'image'));
        if (token.children) rewrite(token.children);
      }
    }
    rewrite(tokens);
    return { title, titleId, html: markdown.renderer.render(tokens, markdown.options, {}) };
  };
}
