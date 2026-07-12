
# Data Falcon — data-falcon.com



Static marketing site for Data Falcon, an independent data advisory and
implementation practice. No build step, no framework, no backend — plain
HTML/CSS/JS deployable to any static host (Netlify, Vercel, S3+CloudFront,
GitHub Pages, etc.).

## Structure

```
index.html              single-page site (nav, hero, approach, technology,
                         about (services copy + founders), contact, footer)
assets/css/style.css     all styling, single dark theme (see below)
assets/js/main.js        mobile nav toggle, scroll-reveal, contact form
                         mailto handler, footer year
assets/img/favicon.svg   brand mark (also inlined in index.html header/footer)
```

## Design system

- **Theme:** deliberately single-theme dark. The dusk-navy ground is the
  brand, not a mode — there is no light variant to maintain.
- **Palette:** dusk navy (`--bg`), falcon-eye amber (`--accent`) as the only
  bold accent, slate-blue (`--structural`) for line work only. All tokens
  are CSS custom properties at the top of `style.css` — change the brand by
  editing those, not by hunting for hex codes in components.
- **Type:** three font roles by system stack (no webfonts, no CDN
  dependency): `--font-display` for headings, `--font-body` for running
  text, `--font-mono` reserved for eyebrows/labels/instrument-style data
  only (e.g. stat strip, footer meta, stage codes).
- **Motif:** the brand idea is a peregrine's stoop (diving flight path) —
  used literally in the hero's diagonal vector line and in the "Approach"
  section's flight-path timeline connecting the four (genuinely sequential)
  engagement stages. Only use numbered/ordered treatments for content that's
  actually a sequence, like those stages.

## Content notes

- Contact form has no backend. `main.js` intercepts submit and opens a
  pre-filled `mailto:` to `hello@data-falcon.com`. If a real backend
  (Formspree, a serverless function, etc.) is added later, replace that
  handler and update `.form-note` copy in `index.html`.
- Footer social links (`LinkedIn`, `X`) are placeholder `href="#"` — fill in
  real URLs before launch.
- Placeholder email throughout is `hello@data-falcon.com` — update in both
  `index.html` (mailto link + visible text) and `main.js` if it changes.
- Technology section (`.tech-grid`/`.tech-tile`) is a logo wall of full-color
  wordmark images (icon + product name baked into one image), each
  displayed at `height: 2cm` with proportional width (`.tech-tile img`). No
  card/border chrome — the images carry their own color and text, so they
  sit directly on the section background.
  - Assets live at `assets/img/tech/*.png` — transparent, high-res
    (rasterized at 600 DPI via `sharp`/librsvg, then trimmed to their
    content bounds). No runtime CDN dependency.
  - Hadoop, Spark, ClickHouse(icon only, see below), Java, Python, GCP, AWS,
    BigQuery, MySQL are official multi-color logos (sourced from
    vectorlogo.zone / Simple Icons); a few had text originally colored for
    *light* backgrounds (dark grey/black) and were re-tinted to `#ECEFF4`
    so they read on this dark theme — see the `fill="#ECEFF4"` overrides
    if regenerating. Kafka is officially single-tone (no distinct brand
    color) and shipped as dark charcoal for light backgrounds, so the
    whole mark was recolored to `#ECEFF4` rather than just its text.
  - ClickHouse, dbt, Redshift, and HBase have no official horizontal
    wordmark asset available from those sources, so those four are custom
    composites: the brand's monochrome icon (ClickHouse `#FFCC01`, dbt
    `#FF694B`, Redshift `#2E73B8`, HBase `#BE160C` — Redshift and dbt are
    close approximations, not verified official hex) set beside an
    `#ECEFF4` text label in the same layout style as the sourced logos.
  - Apache Iceberg has no available icon at all, so its tile is a
    text-only "Iceberg" wordmark (no graphic mark) for visual consistency
    with the rest of the row.
  - These marks remain trademarks of their respective owners (Apache
    Software Foundation, Oracle, Amazon, Google, ClickHouse Inc., dbt
    Labs); used here only to indicate tools we work with, not any
    affiliation or endorsement.

## Working on this site

- Everything is hand-authored; there's no bundler. Edit the three files
  directly and open `index.html` in a browser (or `python3 -m http.server`
  from this directory) to preview.
- Keep the single-accent discipline: amber is the only "pop" color. New
  sections should reuse existing tokens rather than introducing new colors.
- Respect `prefers-reduced-motion` for any new animation (existing rules are
  in the "Scroll reveal" and hero animation blocks of `style.css`).
- Avoid interrupting work with clarifying questions. If something is ambiguous, proceed with your best judgment and list any assumptions/open questions at the   end of your response instead of blocking on them.


