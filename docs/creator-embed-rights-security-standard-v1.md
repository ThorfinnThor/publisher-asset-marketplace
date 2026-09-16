# Creator embed, preview, rights, and security standard v1

Status: accepted specification for implementation  
Owner model: SOL  
Reviewed: 2026-09-16  
Applies to: creator-hosted calculators, charts, tables, datasets, benchmarks, and widgets

## Decision

The marketplace accepts a creator asset only when the creator provides four separate public HTTPS
resources:

1. a human-facing canonical page;
2. a dedicated source-hosted embed page;
3. a direct preview image; and
4. public rights evidence that covers the asset and its preview.

Each asset is reviewed separately. A domain-level statement does not automatically authorize every
asset on that domain. Creator declarations remain unverified until an admin records the evidence and
publishes the asset.

The marketplace never accepts iframe HTML, uploaded JavaScript, arbitrary scripts, private URLs, or
credentials. It stores structured URLs and generates the iframe itself. It does not fetch creator
URLs from the Worker during submission or automated pre-screening.

This standard extends the existing
[submission security contract](submission-security-e2.md) and
[creator attribution policy](creator-attribution-link-policy-e6.md). If the documents conflict, use
the stricter fail-closed rule and return the decision to SOL.

## Resource contract

| Resource        | Example                                           | Required behavior                                                                     |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Canonical page  | `https://creator.example/tools/calculator`        | Human-facing explanation, stable public HTTPS URL                                     |
| Embed page      | `https://creator.example/embed/calculator`        | Calculator-only page that works inside the marketplace sandbox                        |
| Preview image   | `https://creator.example/previews/calculator.png` | Direct image response representing the real asset                                     |
| Rights evidence | `https://creator.example/reuse-terms`             | Public, versioned permission covering embed, commercial use, preview, and attribution |

The canonical, embed, and attribution hosts should be the same registrable site. A different host is
allowed only when an admin verifies that it is an official creator-controlled delivery domain. CDN
preview hosts require the same ownership check.

## Canonical page

The canonical page is the asset's permanent human-readable source page. It must:

- return a public HTTPS document without login, credentials, or a private network dependency;
- explain what the calculator or asset does and its important limitations;
- identify the real source or brand;
- link to the current rights or reuse terms; and
- remain distinct from the stripped-down embed page.

The canonical page may retain normal navigation, analytics, and product links. It must not be used as
the iframe URL unless it independently satisfies every embed-page requirement below.

## Embed page

### URL and response

Each asset has one stable, dedicated URL such as `/embed/gartenhaus-planer`. The URL must:

- use HTTPS and return `200 text/html` without authentication;
- work in a fresh private browser window with cookies and storage unavailable;
- render without a consent wall that prevents calculation;
- avoid temporary, signed, expiring, preview, session, or credential-bearing URLs;
- avoid redirects where possible and never redirect to login or the canonical marketing page;
- contain only the asset, essential instructions, limitations, and optional visible source branding;
- avoid unrelated navigation, affiliate grids, advertisements, popups, downloads, or top-level
  redirects; and
- remain usable at 320, 768, and 1,280 CSS pixels without horizontal scrolling.

The route should carry `robots` `noindex,follow` and identify the human-facing page with a canonical
link. Search engines should index the canonical page, not duplicate the stripped-down embed page.

### Marketplace sandbox compatibility

Marketplace-generated creator markup uses this fixed v1 capability profile:

```html
<iframe
  src="https://creator.example/embed/calculator"
  title="Calculator title"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  sandbox="allow-scripts"
  style="width:100%;height:720px;border:0;display:block"
></iframe>
```

The embedded application must work with scripts enabled but without `allow-same-origin`,
`allow-forms`, `allow-popups`, `allow-downloads`, or any top-navigation permission. Therefore it
must not require:

- cookies, `localStorage`, `sessionStorage`, IndexedDB, or an authenticated session;
- HTML form submission or cross-origin credentialed requests;
- access to `window.parent`, the parent DOM, or the publisher's URL;
- popup windows, file downloads, clipboard permission, or top-level navigation; or
- camera, microphone, geolocation, payment, USB, or other powerful browser permissions.

Inputs and calculation state should remain in memory for the lifetime of the iframe. If an asset
cannot operate under this profile, it is not v1-compatible. A broader sandbox profile requires a
new SOL security review and an origin-specific capability record; admins cannot grant exceptions by
editing raw iframe HTML.

The HTML standard defines each sandbox keyword as a capability re-enable. It also warns that
combining `allow-scripts` and `allow-same-origin` on same-origin content can let the embedded page
remove the sandbox. See:
<https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox>.

### Provider response headers

The normal website and the embed route need different framing policies:

- Normal pages should keep `Content-Security-Policy: frame-ancestors 'none'` and/or
  `X-Frame-Options: DENY`.
- The dedicated public embed route should send
  `Content-Security-Policy: frame-ancestors https:` when any HTTPS publisher may embed it.
- The public embed route must not send `X-Frame-Options: DENY` or `SAMEORIGIN`.
- `frame-ancestors` must be an HTTP response header, not a `<meta>` element.

The CSP specification defines `frame-ancestors` as the directive that controls which parents may
embed a resource. It does not inherit from `default-src`, and browsers ignore it when supplied only
through a meta element. See: <https://www.w3.org/TR/CSP3/#directive-frame-ancestors>.

The embed response should also use a restrictive page policy. The exact `script-src`, `style-src`,
`img-src`, and `connect-src` values depend on the creator's implementation, but the minimum is:

```text
Content-Security-Policy:
  default-src 'self';
  base-uri 'none';
  object-src 'none';
  form-action 'none';
  frame-src 'none';
  frame-ancestors https:
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

Do not copy that example blindly if the calculator loads documented assets from a CDN. Add only the
specific origins actually required. Inline scripts, wildcard script origins, user-supplied script
URLs, and `unsafe-eval` are not accepted.

### Data and messaging

Calculations should run locally in the iframe whenever possible. Do not place personal, financial,
health, or precise-location data in query strings, analytics events, referrers, or `postMessage`
payloads.

Dynamic iframe resizing is not part of v1. The marketplace generates a constant 100% width and
720-pixel height; the creator page must work within that viewport and may scroll internally when
needed. The style is generated by the marketplace and is never creator input. A future resize
protocol must use a versioned message, contain no sensitive data, and require the parent to verify
`event.origin` against the reviewed embed origin before changing dimensions.

## Preview image

The preview is a direct, public representation of the real asset. It must:

- use a stable HTTPS URL and return `200`;
- return an image MIME type such as `image/png`, `image/jpeg`, `image/webp`, or `image/avif`;
- not return HTML, a login page, a consent page, a signed URL, or an expiring redirect;
- load cross-origin in an ordinary `<img>` element without cookies, authorization, or hotlink
  exceptions;
- show the actual calculator interface or a genuine example result, not a generic line-chart
  placeholder;
- contain no third-party image, logo, or personal data unless the creator can license that material;
  and
- remain legible at a 16:9 presentation size; 1,200 × 675 pixels is the recommended source size.

The creator may update the bytes at the stable URL when the interface changes. A materially
different asset needs a new submission rather than silently reusing the old review.

## Rights evidence

### Required grant

The rights evidence must be a stable public HTTPS page controlled by the asset owner or an
authorized representative. It must identify the owner and asset or covered asset class and state,
in plain language:

- whether iframe embedding is permitted;
- whether commercial editorial sites may embed the asset;
- whether the preview image may be displayed by the marketplace and publishers;
- whether modification is permitted, prohibited, or limited;
- whether attribution is required and the exact source/brand wording;
- the required attribution destination URL;
- any excluded third-party data, images, brands, or results;
- the effective date or version; and
- how future withdrawal or material terms changes will be communicated.

The permission may be a recognized license or a custom non-exclusive permission. A general website
copyright notice, public accessibility, an iframe that happens to work, or an affiliate disclosure
does not prove reuse rights.

### Recommended creator wording

This example is a product requirement, not legal advice:

```text
[Owner] permits the unmodified [asset name] hosted at [embed URL] to be embedded by commercial and
non-commercial editorial websites. The marketplace and publishers may display the preview image at
[preview URL]. Visible attribution must read “Source: [brand]” and link to [attribution URL]. This
permission does not grant redistribution of underlying raw data or third-party materials. Terms
version: [date/version].
```

Do not state `CC BY 4.0` unless the owner intentionally applies that license and has the authority to
license every covered component. Custom embed permission is preferable to a false standard-license
claim.

### Review classification

| Evidence state                                                                                               | Marketplace result                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Explicit embed, commercial, preview, and attribution permission; no conflict                                 | Eligible for `safe` review              |
| Embed allowed with clear limitations such as attribution or no modification                                  | Eligible for `restricted` review        |
| Missing, vague, draft, owner unknown, or preview permission absent                                           | `unknown`; do not publish or copy embed |
| Explicit prohibition, conflicting owner evidence, deceptive attribution, or unauthorized third-party content | `blocked`                               |

Embedding permission is separate from raw-data redistribution. The marketplace may list and embed a
calculator while keeping `raw_data_redistribution` unknown or false.

## Attribution contract

The source name must be a real brand, organization, or creator identity. It cannot be an SEO keyword
phrase. The marketplace generates visible attribution outside the iframe:

```html
<figure>
  <!-- reviewed iframe -->
  <figcaption>
    Source: <a href="https://creator.example/tools/calculator">Creator Brand</a>
  </figcaption>
</figure>
```

Terms cannot demand dofollow links, keyword-rich anchors, hidden links, tracking parameters,
publisher endorsements, rankings, or guaranteed placement. The embed page may show matching visible
branding, but it must not conceal or replace the marketplace-generated attribution.

## Moderation evidence packet

An admin may approve only after recording:

- the exact canonical, embed, preview, attribution, and rights-evidence URLs;
- the normalized embed origin;
- the evidence version/check date and reviewer;
- the reviewed booleans for embedding, commercial use, modification, and citation;
- preview-display permission;
- the exact source/brand name and attribution terms;
- the sandbox capability profile (`v1: allow-scripts`); and
- any restriction or third-party exclusion.

Manual verification happens in a browser. The Worker must not fetch a submitted URL merely to make
moderation convenient; a future automated fetcher must satisfy the separate SSRF controls in the
submission security contract.

## Acceptance matrix

| Check                | Pass condition                                                         | Failure result    |
| -------------------- | ---------------------------------------------------------------------- | ----------------- |
| Canonical URL        | Public HTTPS human-facing asset page                                   | Reject submission |
| Embed URL            | Public HTTPS, stable, source-controlled, no auth                       | Reject submission |
| Sandbox              | Fully usable with exactly `allow-scripts`                              | Needs changes     |
| Frame policy         | `frame-ancestors` allows intended HTTPS publishers; no conflicting XFO | Needs changes     |
| Navigation           | No popups, downloads, form submission, or top navigation               | Block             |
| Storage              | Works without cookies or browser storage                               | Needs changes     |
| Responsive layout    | Works at 320/768/1,280 px without horizontal scrolling                 | Needs changes     |
| Preview              | Direct real image with image MIME type and stable URL                  | Reject submission |
| Rights evidence      | Owner-controlled, explicit, versioned, asset-applicable                | Unknown/block     |
| Commercial embedding | Explicitly permitted                                                   | Unknown/block     |
| Attribution          | Real brand plus public HTTPS destination                               | Needs changes     |
| Third-party material | Covered or explicitly excluded                                         | Unknown/block     |

## PassendPlanen pilot

Implement and review one calculator before adapting all planners:

| Field            | Pilot value                                                   |
| ---------------- | ------------------------------------------------------------- |
| Asset            | Gartenhaus-Planer                                             |
| Canonical        | `https://www.passendplanen.de/garten/gartenhaus-planer/`      |
| Embed            | `https://www.passendplanen.de/embed/gartenhaus-planer/`       |
| Preview          | `https://www.passendplanen.de/previews/gartenhaus-planer.png` |
| Source name      | `PassendPlanen`                                               |
| Attribution URL  | `https://www.passendplanen.de/garten/gartenhaus-planer/`      |
| Rights evidence  | `https://www.passendplanen.de/garten/gartenhaus-planer/nutzungsrechte/` |
| Sandbox profile  | `v1: allow-scripts`                                           |

The pilot URLs and rights page were deployed on 2026-09-16 and returned `200` during the LUNA
verification pass. The acceptance matrix still applies: an admin must record the evidence before
publishing the asset. The public calculator page alone does not grant third-party commercial
embedding rights.

## Resolved implementation gap

The marketplace-generated iframe now includes the constant
`style="width:100%;height:720px;border:0;display:block"`, and the creator tutorial explains the
same sizing contract.
The marketplace must not accept creator-supplied inline styles or arbitrary iframe attributes to
solve sizing.

## Definition of done

This SOL step is complete when:

- the four-resource contract is accepted;
- the fixed v1 sandbox capability profile is accepted;
- provider framing headers and preview requirements are explicit;
- the rights-evidence wording and review classification are explicit;
- the PassendPlanen pilot has live embed, preview, and rights-evidence URLs; and
- LUNA can implement the creator tutorial and sizing changes without making new security or rights
  decisions.
