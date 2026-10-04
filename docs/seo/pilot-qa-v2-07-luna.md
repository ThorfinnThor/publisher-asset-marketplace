# V2-07 pilot QA — Luna first pass

Date: 2026-10-04  
Scope: V2-05 editorial context overlays, V2-06 source/right assertions, and the
surrounding public SEO and publishing surfaces. This is a QA record only;
no commit or deployment was made.

## Result

The code and current production baseline pass the available automated checks.
The pilot overlay itself is not yet live because this V2-07 pass does not
deploy changes. A final Sol review is still required before release.

## Checks passed

- `npm run typecheck`
- `npm run lint`
- `npm test` — 74 files / 414 tests
- Targeted SEO, sitemap, `llms.txt`, security-header, overlay, and source-
  assertion suite — 6 files / 40 tests
- `npm run build` — build complete. Wrangler emitted an environment-only
  `EPERM` warning while trying to write its local log under
  `/Users/schayan/Library/Preferences/.wrangler/logs`; the build itself
  completed successfully.
- `git diff --check`
- `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run release:smoke` against the deployed
  Worker — 22/22 checks passed.
- The same smoke suite against `https://citesupply.com` — 22/22 checks passed.
- `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run audit:production` — passed with 519
  pages, 510 sitemap URLs, and 26 internal links.

The TLS override was used only because this managed QA environment does not
trust the local certificate issuer. It is not an application or deployment
configuration change.

## Browser and accessibility observations

- The local production build rendered the landing page without clipping or
  horizontal overflow at the available desktop viewport.
- The accessible tree exposed one page H1, labelled navigation links, a
  labelled search field, the three publisher steps, and the expected logo
  assets.
- Keyboard focus advanced through the primary navigation as expected.
- The local pilot asset URLs returned a safe temporary-unavailable state because
  the local D1 runtime has no seeded `assets` table/data. This prevented a
  meaningful local visual check of the three reviewed overlays. No production
  data was changed to work around that limitation.
- The local `/sitemap.xml` had the same empty-D1 limitation; the live production
  audit above is the authoritative sitemap/link result for this pass.
- A separate agent-browser CLI is not installed in this environment and the
  available CUA surface does not provide a viewport override. Mobile and tablet
  viewport automation therefore remains an explicit Sol follow-up rather than
  being claimed as passed.

## QA tooling correction

The audit script still assumed the old 3–502 sitemap range. The live site now
has 16 public hub/editorial URLs plus the 500-asset ceiling, so the bound is
computed from `TOPICS`, `PUBLIC_EDITORIAL_ARTICLES`, and that asset ceiling.
This removed a false QA failure at 510 URLs without changing sitemap output or
indexing behavior.

Sol review also identified that the first overlay resolver did not enforce the
V2-06 evidence contract at runtime. The resolver now fails closed unless the
overlay's expected timestamp and every reviewed source-file hash match the
bundled V2-06 assertion fixture for that asset. This prevents an overlay from
being paired with the wrong reviewed evidence. The fixture is deliberately
hash-only for non-redistributable OWID data and contains no raw source payload.

This is not a live source re-fetch. The current D1 asset detail exposes the
source update marker, but not source-file hashes. A source changing bytes while
keeping the same update marker cannot be detected by this runtime alone; the
scheduled source refresh/review process must therefore update the marker or
retire the assertion before a new editorial approval is used.

## Release gate

Do not deploy from this Luna pass. Before release, Sol must:

1. review this record and the V2-05/V2-06 implementation;
2. run a browser check against a seeded/preview D1 instance for each pilot
   asset (OWID, Eurostat, and the second OWID fixture);
3. complete mobile, tablet, small-desktop, and large-desktop visual checks;
4. confirm no metadata, canonical, robots, sitemap, JSON-LD, rights, or D1
   write behavior changed unintentionally; and
5. only then request an explicit deployment approval.
