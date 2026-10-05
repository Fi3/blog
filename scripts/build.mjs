import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles, normalizeBase } from './content.mjs';
import { templates } from './templates.mjs';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function build({ root = projectRoot, basePath = process.env.BASE_PATH ?? '' } = {}) {
  const base = normalizeBase(basePath);
  const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
  const articles = await loadArticles(root, base);
  const render = templates(config, base);
  const output = path.join(root, 'dist');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'public'), output, { recursive: true });
  await writeFile(path.join(output, 'index.html'), render.home(articles));
  await writeFile(path.join(output, '404.html'), render.notFound());
  await writeFile(path.join(output, '.nojekyll'), '');
  const assetOutput = path.join(output, 'articles');
  await mkdir(assetOutput, { recursive: true });
  for (const entry of await readdir(path.join(root, 'articles'), { withFileTypes: true })) {
    if (!/\.(md|markdown)$/i.test(entry.name) && !entry.name.startsWith('.')) {
      if (articles.some((article) => article.slug === entry.name)) throw new Error(`Article asset conflicts with article URL: ${entry.name}`);
      await cp(path.join(root, 'articles', entry.name), path.join(assetOutput, entry.name), { recursive: true, filter: (file) => !/\.(md|markdown)$/i.test(file) && !path.basename(file).startsWith('.') });
    }
  }
  for (const article of articles) {
    const directory = path.join(assetOutput, article.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), render.article(article, articles));
  }
  console.log(`Built ${articles.length} articles in dist/ (base path: ${base || '/'})`);
  return { output, base };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
