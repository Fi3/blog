import { escapeHtml as e } from './content.mjs';

export function templates(config, base) {
  const date = (value) => new Intl.DateTimeFormat(config.language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: config.timezone }).format(new Date(value));
  const time = (value) => `<time datetime="${e(value)}" title="${e(new Intl.DateTimeFormat(config.language, { dateStyle: 'long', timeStyle: 'long', timeZone: config.timezone }).format(new Date(value)))}">${e(date(value))}</time>`;
  const metadata = (article) => `<dl class="article-meta"><div><dt>Created</dt><dd>${time(article.created)}</dd></div><div><dt>Last modified</dt><dd>${time(article.modified)}</dd></div></dl>`;
  function layout(title, description, body) {
    return `<!doctype html>
<html lang="${e(config.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)}</title>
  <meta name="description" content="${e(description)}">
  <meta name="theme-color" content="#dcecf5">
  <meta name="color-scheme" content="light">
  <link rel="icon" type="image/svg+xml" href="${base}/favicon.svg">
  <link rel="stylesheet" href="${base}/fonts.css">
  <link rel="stylesheet" href="${base}/styles.css">
  <script src="${base}/site.js" defer></script>
</head>
<body>
  <div class="atmosphere" aria-hidden="true"></div>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" inert aria-hidden="true"><div class="header-inner"><a class="wordmark" href="${base}/">${e(config.title)}</a></div></header>
  <div class="page-masthead site-width"><a class="wordmark" href="${base}/">${e(config.title)}</a></div>
  <main id="main">${body}</main>
</body>
</html>`;
  }
  const articleContent = (article) => `<article class="article-story page-width"><header class="article-heading"><h1>${e(article.title)}</h1>${metadata(article)}</header><div class="article-body"><div class="prose">${article.html}</div></div></article>`;
  function home(articles) {
    return layout(config.title, config.description, `<section class="writing site-width" aria-labelledby="articles-heading"><h1 id="articles-heading">Articles</h1>${articles.length ? articles.map((article) => `<article class="article-row"><h2><a href="${article.url}">${e(article.title)}</a></h2>${metadata(article)}<p>${e(article.excerpt)}</p></article>`).join('\n') : '<p class="empty-state">No articles yet.</p>'}</section>`);
  }
  function article(article) {
    return layout(`${article.title} · ${config.title}`, article.excerpt, articleContent(article));
  }
  return { home, article, notFound: () => layout(`Page not found · ${config.title}`, 'This page could not be found.', `<section class="not-found page-width"><h1>Page not found.</h1><p><a href="${base}/">Return to the blog</a></p></section>`) };
}
