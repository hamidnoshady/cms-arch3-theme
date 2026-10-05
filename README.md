# Architecture portfolio theme — Eshobe CMS theme (`contractVersion = 1`)

A complete, bilingual (Persian-first RTL / English LTR) portfolio theme for an architecture
studio, built against the Eshobe CMS theme contract. White surfaces, black type and
linework, photography in colour, square corners, restrained motion, and a structural line
system that carries the layout instead of boxes.

- The design brief this theme implements is transcribed in [`docs/SPEC.md`](./docs/SPEC.md).
- Tokens, both line systems, layout primitives, breakpoints and the component inventory are
  in [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md); font loading and weights are in
  [`docs/TYPOGRAPHY.md`](./docs/TYPOGRAPHY.md).
- Everything not verified, and every deliberate deviation, is in
  [`docs/LIMITATIONS.md`](./docs/LIMITATIONS.md).
- What was tested, how to reproduce it, and the browser evidence is in
  [`docs/QA.md`](./docs/QA.md).
- The CMS contract this theme is built against is [`docs/THEME_API.md`](./docs/THEME_API.md).

The manifest declares a `registry_image` deployment to the immutable public GHCR repository
`ghcr.io/hamidnoshady/cms-arch3-theme`. Deploying an artifact remains an explicit CMS
operator action; a GitHub push publishes and registers an image but never promotes a site.

---

## Naming

`key`, `name` and `nameFa` in `eshobe.theme.json` are **neutral placeholders**
(`arch2-neutral`). The theme carries no studio identity: the name, logo, contact details,
people and projects all come from the CMS at runtime. Replace the three identifiers when the
product name is chosen — `tests/manifest.test.ts` asserts the key is neutral only to keep an
accidental brand name from shipping.

## Requirements

- Node 22+ (developed on 22.22)
- npm (one package manager, one lockfile — `package-lock.json` is committed)
- A reachable Eshobe CMS instance for anything other than fixture/QA work

`@eshobe/site-runtime` is **not published to npm**; it is vendored under
`vendor/site-runtime/` and compiled locally by `npm run vendor:build`, which `typecheck`,
`lint`, `test` and `build` all run first. See `vendor/site-runtime/PROVENANCE.md`.

## Install and run

```bash
npm ci
npm run dev            # http://localhost:3000
```

For a production build:

```bash
npm run build
npm run start:standalone     # prepare:standalone + node .next/standalone/server.js
```

`next start` alone is **not** enough with `output: 'standalone'`: `public/` and
`.next/static` are not copied into the standalone directory, so the page loads without CSS
or hydration. `npm run prepare:standalone` copies both, and `start:standalone` runs it first.
This is why the manifest's `startCommand` is `npm run start:standalone`.

### Verification

```bash
npm run verify        # vendor:build → typecheck → lint → test → build
```

`verify` includes lint — it is not skipped. Current state: typecheck clean, 0 lint errors,
120 tests passing, production build succeeding. See `docs/QA.md` §2.

## Configuration

Everything the theme reads is injected by the platform at runtime. **Nothing is baked into
the bundle**, and every secret stays server-side: no key, token or CMS URL is available to
client code (`src/lib/cms/client.ts` is the only place that reads them, and it is
`server-only`).

| Variable | Purpose |
| --- | --- |
| `ESHOBE_CMS_URL` (or `ESHOBE_API_URL`) | CMS base URL. Runtime, server-only. |
| `ESHOBE_API_KEY` (or `ESHOBE_SITE_API_KEY`) | Site credential. Server-only; never logged, never bundled. |
| `ESHOBE_PUBLIC_ORIGIN` | Where this deployment is reachable — used for `metadataBase` and the preview host. |
| `ESHOBE_SITE_DOMAIN` | The customer's canonical domain, for canonical URLs and the sitemap. |
| `ESHOBE_DEFAULT_LOCALE` / `ESHOBE_LOCALES` | Served locales. Persian is the default and unprefixed. |
| `ESHOBE_REVALIDATE_SECRET` | HMAC secret for `POST /api/revalidate` (raw-body signature). |
| `ESHOBE_PREVIEW_SECRET` | Enables preview mode. Unset ⇒ preview is off. |
| `ESHOBE_ALLOW_HOST_TENANT` | `true` resolves the tenant from the `Host` header via a raw HTTP request. Never combined with a site key. |
| `ESHOBE_DEV_FIXTURES` | `1` serves synthetic fixture content — **development only** (`NODE_ENV !== 'production'`). |

The CMS is resolved per request from the trusted `Host` header or the server-side site
credential — never from a visitor query parameter or body. Unknown hosts fail closed.

## Fonts

- **Persian:** Vazirmatn Variable (OFL) ships in `public/fonts/`. The licensed
  **Shazde Pro** weights 300–900 are installed in `public/fonts/shazde/` (the family
  contains no 100/200 cuts); drop a different licensed set in with the documented filenames
  and the theme switches automatically. Missing weights are reported at boot and fall back
  to the nearest licensed weight, never a synthesised one. See
  `public/fonts/shazde/README.md` and [`docs/TYPOGRAPHY.md`](./docs/TYPOGRAPHY.md).
- **English:** Inter Variable (OFL).
- `npm run fonts` re-fetches the open fonts (needs network access to the font CDN).

## CMS attachment

1. **Register the theme** in the CMS from this repository. The CMS parses
   `eshobe.theme.json` with `parseThemeManifest` and rejects anything it does not recognise,
   so only documented keys are present.
2. **Bind the content slots.** The theme declares seven (`home`, `about`, `contact`,
   `projectsCategory`, `educationCategory`, `blogCategory`, `contactForm`). A bound
   document wins; when a slot is unbound the theme falls back to the documented slug hint
   (`about`, `projects`, `education`, …) *only* as a first-run convenience. It never falls
   back to an unrelated document that happens to share a slug, and a binding that is missing
   or untranslated renders an empty state rather than guessing.
3. **Confirm the capabilities** you actually want: `blog`, `contactForm`, `education`,
   `projects`, `search`. The theme claims no others (no store, no payments).
4. **Media** is read from `site.media.origin`; URLs are validated against it before render.

### Content conventions

Projects, education entries and blog posts are all **categorised posts**, per the contract —
there are no invented `/api/projects` or `/api/team` endpoints. Titles, facts, dates,
categories and contact details come from the CMS; the theme fabricates nothing, including
location, area, year or awards. A `contact` block renders only the fields the CMS has
(`address`, `email`, `phones[]`, `hours`, `mapUrl`) and says so in the console when they are
all empty.

## Preview and revalidation

- `POST /api/preview` sets the preview cookie after verifying a signed token. Preview
  bypasses shared caches, is `noindex`, and may show drafts.
- `POST /api/revalidate` verifies an HMAC over the **exact raw request bytes**. It returns
  `202` before purging the named paths, tags and resources, including the cached site descriptor.
- Public rendering never includes drafts. CMS reads are partitioned by tenant, locale, query,
  and public-vs-preview, held in this process for three minutes, and served stale while an
  unavailable CMS is retried in the background.
- `GET /api/health` is a process-only, unredirected `200` endpoint. It never contacts the CMS
  or waits for cache warming, so Coolify can probe it immediately after startup.

## Continuous integration and the release image

Two workflows split the jobs by responsibility:

| Workflow | Runs on | Does |
| --- | --- | --- |
| `.github/workflows/ci.yml` | pull requests, manual, called by the publisher | validate manifest → install → lint → typecheck → tests → production build, browser audits against the mock topology (`:3200` + slow `:3300`), and (PRs only) a **no-push** linux/amd64 image build |
| `.github/workflows/publish-image.yml` | push to `main`, `v*` tags, manual dispatch | `ci.yml` as a gate, then Buildx linux/amd64 build + GHCR push, digest verification, and **CMS artifact registration** |

Registration is what makes an image deployable: the CMS only deploys a `theme-artifacts`
row for the exact commit. Add these **repository secrets**: `ESHOBE_CMS_URL` (the CMS admin
origin, never a customer domain), `ESHOBE_THEME_PACKAGE_ID` (the theme-packages row UUID),
and `ESHOBE_THEME_ARTIFACT_SECRET` (the CMS callback HMAC secret). Without them the image
is pushed but the run **fails** at the registration step.

The publisher is deliberately a separate workflow: a check run can never publish an image,
and an image is never built from a tag that fails the checks. It tags the image
`X.Y.Z` and `X.Y` from the release tag plus `sha-<commit>`; a manual dispatch adds `edge`.

To build the image locally the same way CI does:

```bash
docker build -t cms-arch3-theme .
docker run --rm -p 3000:3000 \
  -e ESHOBE_CMS_URL=http://host.docker.internal:3001 \
  -e ESHOBE_PUBLIC_ORIGIN=http://127.0.0.1:3000 \
  cms-arch3-theme
```

The image serves on `:3000`, ships a `HEALTHCHECK` on `/api/health`, runs as a non-root
user, and never includes `public/qa` fixtures.

## Release and rollback

A push to `main` builds `ghcr.io/hamidnoshady/cms-arch3-theme` and registers its exact
`sha256:` digest with Eshobe. The CMS/Coolify deployment must pull that digest rather than a
mutable tag. A release tag adds semantic version tags for people, but production identity
remains the digest. **Roll back by selecting a previously registered artifact digest** — never
by editing a tag in place.

## Security notes

- Site credentials are server-only and runtime-only; rotating one is a CMS operation and
  needs no rebuild.
- A public form submission is forwarded **without the site key** and without cookies, so a
  visitor's enquiry can never borrow the theme's privileges.
- Unknown hosts fail closed; a `suspended` or `archived` site renders a `noindex` holding
  page with no portfolio content.
- Diverting scheduled jobs: if you expose `/api/revalidate`, give it the CMS's secret — the
  route answers `503` while `ESHOBE_REVALIDATE_SECRET` is unset.

## Project layout

```
src/
  app/            routes: Persian tree, full /en mirror, api/*, robots, sitemap
  components/     ui · design · layout · home · projects · education · blog · media · forms · blocks · states
  lib/            cms · routing · theme · seo · utils · runtime (the only importer of site-runtime)
  styles/         tokens · base · typography · lines · structure · components (one entry: app/globals.css)
  views/          one view per route, plus its metadata builder
  proxy.ts        real status codes (404 / 307), locale enforcement, tenant host checks
scripts/          build + QA tooling (mock CMS, scenario servers, screenshots)
tests/            vitest suites
docs/             SPEC.md · QA.md · LIMITATIONS.md · screenshots/
vendor/           vendored @eshobe/site-runtime (see PROVENANCE.md)
```

## QA tooling

`scripts/` contains tools that are **never imported by the theme at runtime**:

- `mock-cms.mjs` — serves the documented REST shapes from the same fixture encoder the
  development provider uses, with composable modes
  (`ok`, `empty`, `holding`, `nologo`, `longlabels`) and transport switches (`slow`, `fail`).
- `qa-servers.sh` — brings up the whole scenario topology (ports 3300–3800) with a port
  preflight, so a half-bound run cannot quietly measure the wrong thing.
- `npm run audit` — the two browser audits below, back to back
- `a11y-audit.mjs` — `npm run a11y`: structural checks over 17 routes (one `h1`, a `<main>`,
  heading order, image `alt`, duplicate ids, WCAG 2.2 target sizes, text contrast)
- `interaction-audit.mjs` — keyboard/pointer behaviour: entrance, drawer focus trap and
  Escape, scroll-lock cleanup, single-submit, value preservation on failure
- `screenshots.mjs` — the browser harness: 40 named shots, overflow and console-error
  assertions, per-shot expectations, network throttling for skeleton captures.
- `make-qa-media.sh` — regenerates the synthetic colour placeholders in `public/qa/media/`.
