# Step 35 — Protected-preview browser, accessibility, and link QA

**Role:** Sol  
**Date:** 2026-09-26  
**Decision:** Approved for Step 36 final release review  
**Publication effect:** None  
**Deployment:** Not performed

## Outcome

Both authenticated Eurostat article previews pass the required responsive browser, keyboard,
accessibility-tree, contrast, console, external-link, access-control, and security-header checks.
The review found and fixed three bounded presentation/accessibility defects in the preview renderer.
The articles remain private and blocked from release until Step 36.

## Amendments made during QA

- **S35-01 — root horizontal overflow:** at 390×844, the fixed-width chart and data table caused the
  root document to measure 521 px even though the figure was intended to own horizontal scrolling.
  The renderer now constrains the root/body inline size and uses inline-size containment on the
  figure. Both mobile documents now measure exactly 390 px at the root; the chart/table remain
  available within their own scroll region.
- **S35-02 — figure caption collision:** the bold title and explanatory subtitle rendered without a
  visible gap. `figcaption` now uses a compact grid with explicit spacing.
- **S35-03 — keyboard access to wide data:** the mobile figure was not in the tab order. Both
  figures now use `tabindex="0"`, receive the existing 3 px focus indicator, and scroll horizontally
  with arrow keys. The SVG description and equivalent semantic table remain available.

These changes affect only private generated previews and their hash allowlist. They do not change
article claims, source data, rights, production D1, public assets, sitemap entries, or deployment.

## Responsive and visual QA

Each preview was loaded through the protected Worker route at 390×844, 768×1024, 1280×800, and
1440×900. All eight combinations returned 200 to the temporary local admin session. All eight had
one H1, ordered H2 sections, no root overflow, no empty links, no non-HTTPS links, an accessible
SVG, a labelled equivalent table, and a focusable figure scroll region.

The renewable-energy preview contains 901 visible browser words and the HICP preview 1,007 by the
broad browser-text count. The separate substantive-draft check remains authoritative for the
500-word editorial minimum. Visual inspection covered the mobile renewable-energy page and the
large-desktop HICP page after the final fixes; titles, captions, chart labels, data values, table
headers, wrapping, and spacing are readable without overlap or clipping of the page itself.

## Accessibility and keyboard QA

The browser accessibility tree exposes the document title, one level-1 heading, the ordered
section headings, the figure label, SVG title and long description, named table, row and column
headers, and descriptive Eurostat source links. Keyboard traversal reaches the figure first on a
mobile page, displays a 3 px blue focus ring, scrolls the wide region with horizontal arrow keys,
and then proceeds through source links with the same visible focus treatment.

Measured contrast ratios are 16.37:1 for body text, 7.30:1 for the dek, 10.02:1 for the private
notice, and 7.41:1 for links on white. These exceed WCAG AA for normal text.

## Runtime, links, and private boundary

The browser reported no console errors or warnings. The documents execute no scripts and load no
iframes, images, or external stylesheets. All eight unique official Eurostat links were reachable
through a TLS-validating web fetch, including both Data Browser pages, metadata pages, two news
methodology pages, the reuse notice, and the HICP mapping PDF. Local `curl` was not used as evidence
for those external links because its CA store could not validate `ec.europa.eu`; certificate
verification was not disabled.

Wrangler hit the host file-watcher limit and disabled asset hot reload during local serving. The QA
did not rely on hot reload: each final browser run followed an explicit full build, Worker restart,
and route reload, so the warning does not weaken the recorded result.

Known preview routes return 200 only with the D1-backed admin session. Anonymous canonical paths,
percent-encoded private paths, and double-encoded private paths return the same plain 404. Success
and failure responses carry `private, no-store`, `noindex, nofollow, noarchive`, `no-referrer`,
`DENY`, and the strict no-script/no-connect/no-frame CSP. The route remains absent from public
navigation and the sitemap.

## Evidence and next gate

Machine-readable evidence is in
`data/editorial/private-eurostat-preview-browser-qa-step35.json`. Contract revision v2.4 records the
new preview hashes and inherits unchanged identity, rights, source-policy, freshness, and
fail-closed rules from hash-pinned v2.3.

The final local suite passed: targeted Vitest (3 files, 13 tests), full Vitest (67 files, 372
tests), the static preview checker, draft schema and 500-word depth checks, Wrangler type generation,
ESLint, TypeScript, the production build, scoped Prettier, JSON parsing, and `git diff --check`.

Step 36 (Sol) is the final release gate: independently review v2.4 and this evidence, rerun the full
test and editorial suites, deploy only if every gate remains green, and then verify the real
production preview/access/indexing behavior.
