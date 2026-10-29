# PromptWorld

A cinematic prompt library in the spirit of [getlayers.ai](https://www.getlayers.ai):
**1,360 copy-paste prompts** across fourteen categories, searchable in one place.

Copy a prompt, paste it into whatever AI writes your code or your copy, and get a
result that does not look AI-made. Every prompt carries real decisions — hex
values, easing curves, particle budgets, stated audiences, output formats and
explicit do-not lists — rather than an adjective and a hope.

## The library

Five design categories, in the getlayers tradition:

| Category | Count | What a prompt contains |
| --- | --- | --- |
| Templates | 150 | Full landing pages: tokens, type scale, hero technique, ordered sections, motion system, three responsive layouts, performance budget, a11y and SEO checklists |
| 3D Scenes | 170 | Real-time WebGL: technique, element budget, lighting, post-processing, camera behaviour, reduced-motion fallback, teardown |
| Sections | 170 | Drop-in blocks: scoped tokens, interaction, entry animation, keyboard support |
| Backgrounds | 130 | Animated backdrops in CSS/SVG/canvas: layer count, loop timing, legibility rules, cost budget |
| Gradients | 110 | Interactive gradients: stops, blend, driver, smoothing, pure-CSS equivalent |

Nine vault categories for the rest of the job:

Marketing & Copy (100) · Code & Engineering (100) · Image Generation (90) ·
Writing & Content (80) · Business & Strategy (60) · Agents & Automation (60) ·
SEO & Growth (50) · Data & Research (50) · Learning & Teaching (40)

## Running it

```sh
cd promptworld
npm install
npm run dev      # regenerates the dataset, then serves on 0.0.0.0:3000
```

`npm run build` produces a fully static site: 1,384 pre-rendered pages
(1,360 prompt pages, 14 category pages, plus the fixed routes).

## How the dataset works

This is the part worth understanding before changing anything.

The library is **generated, not listed**. `scripts/generate-prompts.mjs` draws
from curated vocabulary pools in `scripts/lib/` and writes two artefacts:

- `data/prompts.json` (~1.6 MB) — the full dataset including each prompt's
  parameter set. Read from disk by server components. Not in `public/`.
- `public/data/index.json` (~690 KB) — the same entries minus `params`. This is
  what the browser gets: enough to search, filter and draw a card.

`src/lib/prompt-text.ts` renders a parameter set into the final prompt text. It
runs on the server (for the static pages) and in the browser (for the copy
button), so it is dependency-free and pure.

Generation is deterministic — a seeded mulberry32 PRNG — so the same commit
always produces the same 1,360 prompts. `npm run generate -- --check` fails if
the committed dataset has drifted from the generator.

### Why generate instead of hand-write

Hand-writing 1,360 distinct, high-quality prompts is not realistic. Generating
them from structured parameters gives three things that hand-writing at that
scale would not:

1. **No duplicates.** Each category rejects a draw whose parameter signature has
   already been used, so no two prompts in a category share a palette, technique
   and mood. Verified in the audit below.
2. **Internal consistency.** The hex values in the design-token block are the
   same hexes the contrast rule, the scrim guidance and the swatch UI refer to.
   A hand-written prompt drifts; a rendered one cannot.
3. **Correctness by construction.** Details that are easy to get wrong are
   constrained in the pools rather than hoped for — a code prompt's stack is
   always drawn from that language's own list, and a template's sections are
   sampled for *which* appear but sorted into a canonical page order, so no
   prompt ever asks for a landing page that opens with a testimonial wall.

The trade-off is that the prose wrapping the parameters is shared within a
category. That is deliberate: the consistency is what makes the output usable.

### Invariants the generator enforces

Run `node scripts/generate-prompts.mjs` — it exits non-zero on any of:

- total ≤ 1000 prompts
- a duplicate `slug` or `id`

Additionally verified by audit on the current dataset:

- 1,360 unique titles (collisions get a ` (2)` variant marker, never a truncated
  or ellipsised title)
- 0 prompts with an identical parameter set to a sibling in the same category
- 0 language/stack mismatches in Code & Engineering
- every entry has a 3-colour swatch and a pattern id

## Card artwork

There are no images. Each card preview is drawn in CSS from that prompt's own
palette — three custom properties driving one of twelve patterns in
`globals.css` (`aurora`, `rings`, `mesh`, `grid`, `beams`, `orb`, `waves`,
`dots`, `shards`, `horizon`, `noise`, `column`). 1,360 cards cost zero image
bytes, and a prompt's preview is always an honest picture of its own colours.

## Routes

| Route | Notes |
| --- | --- |
| `/` | Home: hero, category showcases, how it works |
| `/library` | All 1,360, with search + facets. Accepts `?q=<term>` |
| `/c/[category]` | One category, statically generated |
| `/p/[slug]` | A prompt: rendered text, spec sheet, palette, related |
| `/vault` | The nine non-design categories |
| `/favourites` | Saved prompts, from `localStorage` only |
| `/how-it-works` | What a prompt contains and how to use one |
| `/api/prompts` | Index JSON. `?category=`, `?slug=`, `?full=1` |
| `/api/prompt/[slug]` | One prompt's rendered text (what Copy fetches) |
| `/sitemap.xml`, `/robots.txt` | Generated |

## Design notes

- **Search is client-side.** 1,360 entries score fast enough in the browser that
  a server round-trip would only add latency. Field-weighted substring matching
  with a position bonus; every term must match somewhere, so "dark hero" does not
  return every dark layer.
- **Prompt bodies are fetched on demand.** The copy button on a card calls
  `/api/prompt/[slug]` and caches the result in memory. The 1,360 rendered
  prompts (several MB) never ship in a page payload.
- **Favourites are localStorage only.** No account, no analytics, nothing
  uploaded. The store is defensive: a corrupted or unavailable store degrades to
  an empty list rather than breaking the page.
- **Motion is CSS-only and reduced-motion aware.** The grain overlay, the hero
  backdrop and all twelve card patterns are disabled under
  `prefers-reduced-motion: reduce`.

## Layout

```
promptworld/
├── scripts/
│   ├── generate-prompts.mjs     # dataset generator (deterministic)
│   └── lib/                     # vocabulary pools + seeded RNG
├── data/prompts.json            # full dataset (server-side, gitignored)
├── public/data/index.json       # compact index (browser, gitignored)
└── src/
    ├── app/                     # routes, sitemap, robots, API
    ├── components/              # header, palette, cards, browser, spec sheet
    └── lib/                     # data access, prompt renderer, search, favourites
```

`data/` and `public/data/` are generated artefacts and gitignored — run
`npm run generate` (or any of `dev`/`build`, which pre-run it) to recreate them.

## Deploying

A standard Next.js deploy. The prompt pages are static; the two API routes are
server-rendered. On Vercel, set the root directory to `promptworld`.
