# BabaBench

The standalone BabaBench blog and interactive results site.

[Read the blog](https://shriram-svg.github.io/bababench/).

The source repository is private. The deployed blog is public.

## Local use

Use Node.js 22 and pnpm 10.17.1.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm post` to open the local article editor at `http://localhost:5180/__edit/`.
Save changes before you close the editor.

## Content

- `src/content/post.md` contains the article and its page metadata.
- `src/content/data/results.json` contains the reported results for 14 models and 47 simulated cases.
- `src/components/Results.tsx` renders the table and charts from that data.
- `src/components/TranslatorFigure.tsx` recreates the paper's Luna translator figure.
- `src/content/data/worlds.json` contains the public case index.
- `src/styles/editorial.css` sets the article layout and the table of contents.

The case data contains public briefs and contacts. This repository does not contain benchmark scoring rules or private run artifacts.
The local editor is available only through the development server.

## Build and publish

```sh
SITE_URL=https://shriram-svg.github.io/bababench/ pnpm build
pnpm preview
```

The build creates a static site in `dist/`. The article remains readable without JavaScript.
GitHub Actions builds and deploys the site to GitHub Pages after each push to `main`.

The result data records the source PDF hash and table numbers.
To compare all values with the source PDF, install Poppler and run:

```sh
python3 scripts/verify_results.py '/path/to/main (27).pdf'
```
