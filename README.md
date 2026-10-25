# Filippo Merli's personal site

The site has two sections:

- **Articles** at `blog.filippomerli.com`.
- **Wikis** at `wikis.filippomerli.com`.

A wiki is a set of connected Markdown pages. The Wikis section has two lists: **Kinda curated** and **Sloppy**. Both sections use the same page style and main navigation.

Articles are built from this repository. The browser loads wiki repositories and pages from GitHub when a visitor opens the Wikis section. A new wiki or a changed wiki page does not require a site build.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4321/> for Articles. Select **Wikis** in the header, or open <http://127.0.0.1:4321/wikis/>.

The frontend queries the public GitHub repositories of `fi3` and renders their wiki pages. Local preview uses the same data and code as the hosted site. A category with no matching repositories stays empty.

To preview the Wikis section at the root URL, use:

```sh
npm run dev:wikis
```

Then open <http://127.0.0.1:4321/>. Articles remain available through the header. Run one preview server at a time. Both preview commands use `dist/`.

The development server rebuilds and reloads the browser after changes to articles, public assets, or site settings. Restart it after changes to `scripts/`. Stop it with Ctrl+C. Use `PORT` and `HOST` to change the server address.

## Add a wiki

Create a public GitHub repository in the account set by `githubOwner` in `site.config.json`. Use one of these name formats:

| Repository name | List |
| --- | --- |
| `wiki-curated-<title>` | Kinda curated |
| `wiki-sloppy-<title>` | Sloppy |

The title comes from the text after the category. Hyphens and underscores become spaces. The browser checks all repository list pages. It does not use a fixed repository list.

Put the wiki pages in a directory named `wiki`:

```text
wiki/
  index.md
  overview.md
  concepts/
    first-concept.md
  images/
    diagram.png
```

The site opens `wiki/index.md` first. If this file is absent, it uses `wiki/README.md`. If both are absent, it uses the first Markdown page in path order. The file extension can be `.md` or `.markdown`.

The site reads the default branch of each repository. It does not read the separate GitHub Wiki feature. A matching repository must contain a `wiki/` directory.

Use relative Markdown links:

```md
[Overview](overview.md)
[Concept](concepts/first-concept.md)
[Return to the index](../index.md)
[Section](overview.md#scope)
![Diagram](images/diagram.png)
```

Wiki page links open inside the site. The page list, browser Back and Forward buttons, and direct page URLs all work. The URL uses `wiki` and `page` query parameters. Thus, a direct page URL works on a static host without a server routing rule.

The sidebar follows the wiki directory structure. Select a folder name to open or close it. Folders that contain the current page open automatically. Other folders keep their state during page navigation. Folder controls also work with the keyboard.

Each live wiki has a **GitHub** link. Each live page has a **View on GitHub** link. Links to source files outside `wiki/` can open GitHub or a raw file. Images load from the source repository.

Markdown supports headings, lists, links, tables, quotes, images, and code blocks. The site hides an initial YAML metadata block between `---` lines. It uses the first level-one heading as the page title. Raw HTML is displayed as text.

GitHub access uses public requests from the visitor's browser. No access token is stored in the site. GitHub request limits and network failures produce an error message with a retry button. Pages and directory data are reused during navigation. Reload the page to fetch a new version.

## Write articles

Create a Markdown file directly in `articles/`. Its filename, without the extension, is its title. Start with the article body. The page already shows the title.

The Articles list uses creation dates, newest first. The first paragraph supplies the excerpt.

Put article images in `articles/images/`, or shared images in `public/images/`:

```md
![Article image](images/photo.jpg)
![Shared image](/images/photo.jpg)
[Another article](My%20next%20article.md)
```

The build converts article links to published URLs. A broken article link or two titles with the same URL cause a build error.

Commit `.article-dates.json` with article changes. This file preserves dates when a new checkout changes filesystem timestamps. The build uses Git history when saved dates are absent. It keeps the creation date after an edit and changes the modification date only when the content changes.

A rename without a content change keeps the saved dates. For a rename with a content change, rename the entry in `.article-dates.json` too.

To keep an old article URL, add an entry to `articleRedirects` in `site.config.json`. The key is the old URL name. The value is the current URL name. The target article must exist.

## Site settings

Edit `site.config.json` to set the site title, description, language, timezone, GitHub account, and section origins. An origin is the protocol and host of a section, such as `https://wikis.filippomerli.com`.

The header uses the configured section origins on a hosted site. On `localhost`, `127.0.0.1`, or `::1`, it uses local section paths. The frontend queries GitHub on all hosts. Repository names and page lists come from these requests.

The shared footer links to the old website. Set its address with `oldSiteUrl` in `site.config.json`. An empty value hides the footer.

Edit `public/styles.css` for page styles. Fonts and other shared assets are in `public/`. The build also copies the installed `markdown-it` browser library into `dist/vendor/`. No external script service is required.

## Build and check

```sh
npm test
npm run test:github
npm run build
npm run preview
```

For a Wikis build and production preview:

```sh
npm run build:wikis
npm run preview:wikis
```

`npm run preview` and `npm run preview:wikis` rebuild once. They then serve the result without automatic reload.

`SITE_SECTION=articles` is the default build. `SITE_SECTION=wikis` puts Wikis at the root URL. Each build writes its configured domain to `dist/CNAME`. The tracked `CNAME` records the Articles domain.

To test a repository URL path:

```sh
BASE_PATH=/personal npm run preview
```

Open <http://127.0.0.1:4321/personal/>. The same base path applies to assets and wiki navigation.

`npm test` checks article dates and links, both build layouts, repository discovery, wiki paths, Markdown rendering, and GitHub failures without network requests.

`npm run test:github` checks the current public repositories of the configured GitHub account. It loads and renders every wiki page. It checks internal page links and heading links. It reports each category count from the current GitHub response. This command requires a network connection.

A build does not fetch wiki content. The local server only serves the site assets. The frontend makes the GitHub requests.

## Old website

The old site is published from `Fi3/vecchio-sito`. Its current Pages address is <https://fi3.github.io/vecchio-sito/>. The shared footer uses <https://old.filippomerli.com/>.
