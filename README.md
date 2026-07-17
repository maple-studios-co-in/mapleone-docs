# MapleOne — architecture docs

The MapleOne engineering bible as a standalone Next.js app. Markdown in `content/`
is the source of truth; each page renders live (marked + Mermaid with zoom/pan) in
the browser. Extracted from `maple-suite/docs/architecture`.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000  (prepares assets first)
```

## Build (static export)

```bash
npm run build          # -> ./out  (fully static, no server runtime)
```

`next.config.mjs` sets `output: "export"`, so the build is plain static HTML/JS —
hostable anywhere. `scripts/prepare.mjs` runs before dev/build to copy the diagram
SVGs into `public/` and regenerate `public/search-index.json` from the markdown.

## Add or edit a page

1. Edit or add a `content/<slug>.md` file.
2. Register it in `lib/site.mjs` (the `NAV` array) so it appears in the sidebar and
   gets a static route. Per-page tool logos go in `LOGOS`; full-canvas zoomable
   diagrams go in `DIAGRAMS` (with a matching `content/<slug>.svg`).
3. Commit and push — Vercel redeploys.

## Deploy to Vercel

Import this repo in the Vercel dashboard. Framework: **Next.js** (auto-detected),
build command `npm run build`, output `out`. Because the docs contain unreleased
security findings and the investor brief, turn on **Settings → Deployment
Protection → Password** (or Vercel Authentication) before sharing the URL.

## Structure

```
content/            *.md source + the 4 zoomable *.svg diagrams
lib/site.mjs        NAV / DIAGRAMS / LOGOS — the one place routing is declared
scripts/prepare.mjs copies SVGs to public/, builds search-index.json
app/                Next App Router
  layout.jsx        shell: header, sidebar, footer, theme
  page.jsx          home / index
  [slug]/page.jsx   one doc page (static-generated per markdown file)
  view/[slug]/…     full-canvas diagram viewers
  DocRenderer.jsx   client: markdown -> HTML + Mermaid + pan/zoom + TOC
  Sidebar.jsx       client: search + nav
  ThemeToggle.jsx   client: light / dark / auto
```
