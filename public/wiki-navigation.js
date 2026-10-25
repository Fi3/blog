import { escapeHtml as escape } from './html.js';
import { homePage, isMarkdown, pageLabel, wikiUrl } from './wiki-model.js';

function pageTree(files) {
  const root = { path: 'wiki', children: new Map() };
  for (const path of files.filter((path) => path.startsWith('wiki/') && isMarkdown(path))) {
    const parts = path.slice('wiki/'.length).split('/');
    const filename = parts.pop();
    let parent = root;
    for (const name of parts) {
      if (!parent.children.has(name)) parent.children.set(name, { name, path: `${parent.path}/${name}`, children: new Map() });
      parent = parent.children.get(name);
    }
    parent.children.set(filename, { name: filename, path });
  }
  return root;
}

export function wikiNavigation(wiki, page, root, folderState = new Map()) {
  const home = homePage(wiki.files);
  function compare(a, b) {
    if (a.path === home) return -1;
    if (b.path === home) return 1;
    return Number(Boolean(b.children)) - Number(Boolean(a.children)) || a.name.localeCompare(b.name);
  }
  function render(node) {
    if (node.children) {
      const open = page.startsWith(`${node.path}/`) || folderState.get(node.path);
      return `<li><details data-folder="${escape(node.path)}"${open ? ' open' : ''}><summary>${escape(node.name)}</summary>${list(node)}</details></li>`;
    }
    const url = wikiUrl(root, wiki.name, node.path === home ? null : node.path);
    return `<li><a href="${escape(url)}"${node.path === page ? ' aria-current="page"' : ''}>${escape(node.path === home ? 'Index' : pageLabel(node.name))}</a></li>`;
  }
  function list(node) {
    return `<ul>${[...node.children.values()].sort(compare).map(render).join('')}</ul>`;
  }
  return `<nav class="wiki-pages" aria-label="Wiki pages" data-repository="${escape(wiki.name)}"><h2>Pages</h2>${list(pageTree(wiki.files))}</nav>`;
}

export function rememberFolders(navigation, states) {
  if (!navigation) return;
  states.set(navigation.dataset.repository, new Map(Array.from(navigation.querySelectorAll('details[data-folder]'), (folder) => [folder.dataset.folder, folder.open])));
}
