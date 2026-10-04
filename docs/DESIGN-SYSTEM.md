# Design system

The theme's visual grammar in one place: tokens, geometry, both line systems, layout
primitives, breakpoints and the component inventory. Raw values live in
[`src/styles/tokens.css`](../src/styles/tokens.css); the semantic layer is
[`src/styles/typography.css`](../src/styles/typography.css),
[`src/styles/lines.css`](../src/styles/lines.css),
[`src/styles/structure.css`](../src/styles/structure.css) and
[`src/styles/components.css`](../src/styles/components.css), all imported through the single
entry [`src/app/globals.css`](../src/app/globals.css). Tailwind v4 reads a mapped subset via
`@theme inline`, so utilities and semantic classes share one source.

## Tokens

| Group | Values |
| --- | --- |
| Surface / ink | `--surface: #ffffff`; `--ink: #000000`; `--ink-secondary: rgba(0,0,0,.64)` (6.4:1, the only body-secondary tone); `--ink-faint: .45` and `--ink-disabled: .35` are **non-text only** |
| Geometry | `--radius: 0px` at every level; `--content-max: 1440px`; `--frame-inset: 5px`; gutters 16→20→24→32→40px at 30/48/64/90rem; grid gap 12→16→20px |
| Lines | `--line-w: 1px` on 1x displays, `0.5px` at `min-resolution: 2dppx`; structural `rgba(0,0,0,.3)`, decorative `rgba(0,0,0,.2)`, emphasis `#000`, skeleton `rgba(0,0,0,.05)` |
| Typography | see [`docs/TYPOGRAPHY.md`](./TYPOGRAPHY.md) |
| Motion | `--motion-fast: 140ms`, `--motion-base: 240ms`, `--motion-slow: 420ms`, `--motion-reveal: 560ms`; two easing curves |
| Focus | `--focus-width: 2px`, `--focus-offset: 2px` — an outline, never only a line colour |

The subpixel-line tolerance is deliberate: a 0.5px border rounds to a full pixel on 1x
displays, so **opacity** carries the delicacy rather than a heavier colour. Both 1x and 2x
are checked in the browser audits.

## Line systems

Two systems, one thickness scale (`src/styles/lines.css`):

**Structural — continuous, organizing.** `rule-h` / `rule-v` (hairlines), `rule-h--major`
for section boundaries, `rule-h--decor` / `rule-v--decor` for short baselines,
`rule-h--emphasis` / `rule-v--emphasis` (1px solid black, reserved for
active/interactive meaning), `frame` for the 5px-inset rectangle that sits **on** a
photograph (not white padding), `frame--fragmented` for a shared corner-and-edge variant,
`card-rule`, `caption-rule` and `active-underline`.

**Decorative — small drafting fragments.** `DecorativeMark`
(`src/components/design/DecorativeMark.tsx`) renders one server-side inline SVG with six
deterministic variants: `corner`, `crosshair`, `dash`, `offset-l`, `pair`, `tick`.
Typical lengths follow the brief (dashes 12–24px, corner arms 10–18px, ticks 8–16px).
Marks are `aria-hidden`, `pointer-events: none`, absolutely positioned by their wrapper
(never part of layout sizing), `hidden md:block` where density must drop on mobile, and
never the sole indicator of a control. They appear on the home stage, headers and footers,
cards, gallery frames, article/project/about/contact compositions and the empty/error
states.

Structural and decorative never swap roles: a decorative fragment never becomes a
boundary, and a structural rule is never random ornament.

## Layout primitives

- `NavbarShell` — full viewport width with its own edge gutters (approximately 32–40px on
  desktop, smaller on mobile); its content does not align with the 1440px container.
- `ContentContainer` — fluid, centered, `max-width: 1440px`, safe gutters.
- Both use padding, never `100vw`, so a scrollbar cannot create overflow. Breadcrumbs,
  headings, filters, archives and the footer all sit in the same container.

The home page is the one exception: a full-viewport entrance stage with no interior header
before the menu reveals.

## Breakpoints, grids and profiles

Tailwind-style rem breakpoints: `30rem` (480), `48rem` (768), `64rem` (1024), `80rem`
(1280), `90rem` (1440).

- **Projects**: 2 columns on mobile **and tablet**, 3 at `64rem`, 4 at `80rem`
  (`.grid-projects`), mixed 3:2 / 3:4 / 1:1 frames from real media dimensions.
- **Media/gallery grids**: 2 columns, 3 at `48rem` (`.grid-media`).
- **Blog and Contact**: one column, split into two at `64rem` with a real `rule-v`
  divider.
- Skeletons reuse the same grid classes, so loading geometry matches the settled layout.

## Component inventory

`src/components/ui/` — shadcn/ui components, each restyled through the tokens above
(radius zero, white/black, hairline edges, no shadows, visible focus):
`accordion`, `breadcrumb`, `button`, `dialog`, `input` (Input + Textarea), `label`,
`pagination`, `sheet`, `skeleton`.

- **Select is intentionally not installed.** The archives filter with links
  (`.filter-chip`, works without JS) and the CMS form's `select` field stays a native
  control for platform semantics; there is no actual dropdown filter to justify it.
- Breadcrumb and Pagination are the shadcn component shape with route-aware wrappers in
  `src/components/design/`; gallery lightboxes use `ui/dialog`.

`src/components/design/` — theme primitives: `Container` (the two shells), `Rule`,
`DecorativeMark`, `Type` (the semantic text roles), `SectionHeader`, `Breadcrumbs`,
`Pagination`. Everything else (cards, entrance, blocks, states) composes these.

## States, motion and accessibility

- Skeletons use the 5% black surface, sharp corners and one 1.6s opacity pulse per
  region — static under `prefers-reduced-motion`.
- Motion is restrained and single-engine: Motion for React only in the home entrance;
  CSS transitions for drawers, hovers and reveals. No per-line animation, no parallax,
  no scroll theatre. Reduced-motion renders final states (or a short fade).
- Focus is a visible 2px outline; active navigation keeps both a solid 1px underline and
  `aria-current`; structural lines remain decorative (`aria-hidden`) and text contrast
  never relies on them.
- WCAG 2.2 target-size floor: 24×24 for navigational targets, 40px for pagination and
  44px for primary controls; labels count as part of their control.

## Verification

- `node scripts/a11y-audit.mjs` — one `h1`, a `<main>`, heading order, image alt text,
  duplicate ids, 24px targets and body-text contrast (`docs/screenshots/a11y-report.json`).
- `node scripts/screenshots.mjs` — 40 named shots at 320–1920px, 200% zoom, reduced
  motion and no-JS; per-shot overflow and console-error assertions.
- Hairlines are checked at 1x and 2x; hiding the decorative marks must leave the layout
  coherent, and hiding the structural rules must leave logical order and accessibility
  intact (see `docs/QA.md`).
