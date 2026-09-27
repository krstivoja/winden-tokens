# Promo site redesign (windentokens.com)

Source: `docs/` (Jekyll on GitHub Pages, Tailwind via CDN).
Local preview: `.claude/launch.json` → `promo-site` (Jekyll, Ruby 3.3), served at `http://localhost:4000/winden-tokens/` (dev baseurl).
Pages touched: `docs/index.html`, `docs/_layouts/default.html`, `docs/_layouts/post.html`, `docs/_includes/header.html`, `docs/_includes/footer.html`, `docs/blog.html`, `docs/blog/*.html`.
Blog post content (`_posts/`) is untouched, only restyled through the layouts.

## Why

Home page lists 6 features from early 2026 (table, shades, steps, graph, contrast, bulk edit).
Since then shipped, not on site:

- JSON tab: CodeMirror editor, folding, nested token tree
- Relationships graph: collection cards, nested containers, Arrange Grid by tier, row path highlight, drag perf
- Cmd+K quick search that jumps the viewport
- Collection/mode tag picker, cross-collection moves keeping references and bindings
- Browser bridge + `winden-tokens` CLI (plugin UI in a browser tab)
- MCP server: Claude manages tokens

## Design direction (Figma.com + Mobbin)

Reference captures (figma.com, mobbin.com, 2026-09-26) showed:

- Figma: white page, black neo-grotesk headlines at regular/medium weight, two-tone headlines (first sentence ink, second sentence gray, same size), product UI on big pastel panels (lime, cyan), multiplayer cursors with colored name tags, black CTA buttons, huge black "Get started" bar.
- Mobbin: floating centered pill nav, centered hero with tight semibold headline and small gray subline, black pill + outline pill CTAs, big light-gray rounded panels holding product UI, big-number stats with floating icons, horizontal strip of screens with captions above.

Applied here:

- Light only, white page, near-black ink, gray panels, pastel tints used sparingly for section panels.
- Hero = product itself: plugin window on a dotted Figma-canvas panel, with a blue Figma selection box and multiplayer cursors ("You", "Claude").
- Two-tone headlines everywhere.
- Bento grid of features with real UI crops.
- Mobbin-style horizontal screens strip.
- Dedicated sections: Graph, Browser + CLI, Claude (MCP).
- Colors as CSS tokens on `:root`, mapped into the Tailwind CDN config; no hex values in markup.
- Fonts: Geist + Geist Mono (Google Fonts) replace Bricolage Grotesque + Inter.
- Icons: plugin's own SVG set (`src/ui/components/icons/svg/`) where one fits, otherwise Heroicons v2 (already used on the site). No new icon library.

## Section order (home)

1. Floating pill nav: logo, Features, Graph, Claude, Blog, GitHub, CTA "Get the plugin"
2. Hero: "New" chip → headline, subline, 2 CTAs, plugin window on canvas panel with cursors and selection box; floating token objects in both gutters around the headline (color chip, brand-blue ramp, contrast chip, reference chip, number chip, mini graph edge, Claude tool-call chip, ⌘K keycap, mode toggle), real values, soft float, reduced-motion static, fewer per breakpoint
3. Real-file numbers (681 variables, 513 references, 6 collections, one graph) with floating token chips
4. Feature bento
5. Screens strip
6. Relationships graph deep-dive
7. Browser tab + CLI ("New")
8. Claude / MCP ("New")
9. Comparison vs native Figma (refreshed rows)
10. Tutorials (videos) + What's new (releases), Liquid loops kept
11. Final black CTA block + footer

## Live visitor cursor

- [x] Mouse users (hover + fine pointer, not forced-colors) get a Figma multiplayer cursor instead of the native one, site-wide (`_layouts/default.html`)
- [x] Same arrow + name-tag style as the Claude cursor; light green `#6EE7A7` or light blue `#7DC8FF` with a darker edge stroke, ink text; random funny name (animal list), new on every reload (never the same as the previous load; only the last name is kept in sessionStorage), color re-rolled per load too
- [x] Exact hotspot, rAF, no lag; hidden until first move, on window leave, over iframes and form fields (native cursor there)
- [x] Static hero "You" floater removed; panel "You" hidden when the live cursor is active
- [x] Touch devices unchanged

## Screenshots

Captured by Claude from the live plugin (real open Figma file), light theme, 2x, WebP, in `docs/assets/screens/`.
Sizes are CSS px (files are 2x).
Gray placeholders at the exact sizes exist until the real captures replace them.

- `table.webp` 1440×900: Table view, whole plugin window
- `graph.webp` 1600×1000: Relationships graph with sidebar
- `graph-path.webp` 1200×800: zoomed graph, row path highlight
- `quick-search.webp` 1200×800: Cmd+K palette over the graph
- `json.webp` 1200×800: JSON tab
- `shades.webp` 1200×800: Shades generator
- `scale.webp` 1200×800: Steps (scale) generator
- `contrast.webp` 1200×800: Contrast checker
- `modes.webp` 800×600: collection/mode tag picker
- `og.png` 1200×630: social image

Capture method: headless Chrome (Playwright, scratchpad) on the vite dev server, bridge relay to the plugin open in Figma.
Table/JSON tabs are hidden in a browser tab, so an iframe harness posing as the Figma host is used; it forwards only read messages to the relay, so nothing can write to the Figma file.

## Tasks

- [x] Capture screenshots (Claude) — real file, light theme, installed in `docs/assets/screens/`; detail images are transparent WebP with baked rounded corners + shadow; minimap hidden in graph shots; hero table without contrast (group-header swatch glitch, flagged as separate task)
- [x] Shared head in `_layouts/default.html`: fonts, tokens, Tailwind config; index moves to `layout: default` (sub-agent)
- [x] Header + footer (sub-agent)
- [x] Rewrite `index.html` sections (sub-agent)
- [x] Restyle `blog.html`, `blog/*.html`, `_layouts/post.html` (sub-agent)
- [x] OG image + meta
- [x] Verify locally desktop + mobile (375) with screenshots, no console errors, no horizontal scroll; prod build (empty baseurl) clean
- [x] `npm run build` (into scratch dir, keeps the bridge-enabled `dist/`) + tests: main checkout 350/350; `npm test` red only from `.claude/worktrees` (separate task)

## Decisions

- Screenshots: captured by Claude via browser bridge (plugin UI in browser tab)
- Theme: light only
- Straight to code, review in local preview
- Tailwind stays on CDN (no build step)
- Browser bridge, CLI and MCP presented as available, badge "New" (site ships with the plugin release that includes the bridge)
- Grays are cool, blue-tinted (no neutral gray); page stays pure white: panel #F2F5F9, panel-strong #E6EBF2, line #E2E7EE, dot #CBD3DE, ink #0A0D14, ink-muted #5E6A7D, ink-faint #949EAF; shadows are blueish: dedicated `--shadow` token 23 37 84 (#172554) at low opacity, never black (baked screenshot shadows + og.png too)
- No gray text on tinted panels: muted text/lines take the panel's hue — peach `#905C37`/`#EDD3C1`, sky `#2E707A`/`#B5E3EA`, lilac `#744FBC`/`#D6C9EF`, lime `#54742C`/`#D2E9B5` (all ≥4.8:1); primary text stays ink
