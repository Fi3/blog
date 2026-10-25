# fi3 blog

A small static blog inspired by the spacious article layout.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:4321/**. Editing articles, images, styles, or `site.config.json` rebuilds the site and reloads your browser. Stop with Ctrl+C. Set `PORT` and `HOST` to change the server address. Restart after editing the generator in `scripts/`.

## Write articles

Create Markdown files directly inside `articles/`:

```text
articles/
  introducing ab-lab.md
  My next article.md
```

The filename, minus `.md` or `.markdown`, is the title exactly as written. Spaces, punctuation, and Unicode are supported. No front matter is required. Start the file with the article body; the page already displays its title. Markdown supports headings, links, lists, quotes, tables, images, and fenced code blocks. Raw HTML is escaped.

The homepage lists all articles under “Articles,” ordered by creation date, newest first, using the first paragraph as each excerpt. Select an article title to read it in full.

Place images in `articles/images/` and use `![Description](images/photo.jpg)`, or put them in `public/images/` and use `![Description](/images/photo.jpg)`. Link between articles with `[Another article](My%20next%20article.md)`. The build converts those links to the published article URLs. Two filenames that produce the same URL cause a clear build error; rename one.

## Article dates

The first local build records the filesystem's creation time (falling back to modification time if birth time is unavailable) and modification time in **`.article-dates.json`**. Later builds update the modification date when the content changes. Hover over a displayed date to see its full timestamp. The display timezone defaults to Europe/Rome.

**Commit `.article-dates.json` along with your articles.** This preserves the original dates when GitHub checks out fresh files. Git does not preserve filesystem birth or modification times. When a file has no saved creation date, the generator uses its earliest Git commit if history is available. For committed content changes without an updated manifest, it uses the latest Git commit for the modification date. Files created directly on GitHub therefore use commit dates. The workflow fetches the complete history.

Renaming a file without changing its contents retains its saved dates. If you rename and edit it simultaneously, preserve its entry by renaming the corresponding key in `.article-dates.json`. You can also correct the ISO timestamps there yourself. Touching an unchanged file does not change the displayed modification date.

## Customize

The shared footer links to the old website. Set its address with `oldSiteUrl` in `site.config.json`. An empty value hides the footer.

Edit `site.config.json` to set the blog title, description, language, and display timezone. The header uses the configured blog title. Edit `public/styles.css` to change the typography, layout, or colors. Files in `public/` are copied into the published site.

When renaming an article, preserve its old URL with an `articleRedirects` entry in `site.config.json`, mapping its old slug to its new slug (for example, `"introducing-ab-test": "introducing-ab-lab"`). The build creates a redirect page at the old URL with an automatic redirect and a clickable fallback link. Targets must be existing articles.

## GitHub Pages

1. Push this repository, including the lockfile and `.article-dates.json`, to GitHub.
2. Open **Settings → Pages → Build and deployment** and choose **GitHub Actions** as the source.
3. Push to `main` or `master`, or run the “Deploy blog to GitHub Pages” workflow manually.

The included workflow builds and publishes `dist/` using [GitHub's Pages actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). It gets the base path from GitHub so links and assets work both at `username.github.io` and `username.github.io/repository/`, including custom domains.

To check a production build locally:

```sh
npm run build
npm run preview
```

To simulate hosting under `/blog/`:

```sh
BASE_PATH=/blog npm run preview
```

Then open **http://127.0.0.1:4321/blog/**. `npm run preview` rebuilds once and serves without live reload. `npm test` verifies content rendering, dates, and deployment paths.

## Old website

The old site is published from `Fi3/vecchio-sito`. Its current Pages address is <https://fi3.github.io/vecchio-sito/>. The shared footer uses <https://old.filippomerli.com/>.
