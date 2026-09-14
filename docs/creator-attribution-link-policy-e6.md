# E6 creator attribution and link policy

Status: accepted for creator assets and launch review  
Owner model: SOL  
Applies to: submissions, moderation, asset pages, citations, copied embed markup, creator analytics,
and product language

## Product promise

The marketplace promises discovery, publisher-ready embeds and citations, and referral exposure. It
does not promise backlinks, dofollow links, rankings, traffic volume, or editorial placement.
`embed_copy`, `citation_copy`, and `source_click` are intent signals only. They must never be renamed
or presented as confirmed publication outcomes.

## Visible attribution rule

Every public creator asset has one admin-reviewed source or brand name and one normalized public
HTTPS attribution URL. The source or brand name is the only link text the marketplace may generate.
The asset title, search query, category, description, keywords, marketing slogan, or requested anchor
text must never become attribution link text.

For creator-owned assets, copied embed markup contains:

1. the reviewed, source-hosted iframe;
2. a visible `figcaption` immediately after it;
3. the literal label `Source:`; and
4. one ordinary link whose text is the reviewed source or brand name and whose destination is the
   reviewed attribution URL.

The marketplace adds no hidden element, off-screen link, transparent text, tracking pixel, injected
keyword, affiliate parameter, `target`, or `rel` promise. The caption has no marketplace-provided CSS,
so its visibility does not depend on a stylesheet. Source connectors may retain their official embed
markup when the source itself supplies attribution; they must not receive a second invented link.

If creator attribution is missing, malformed, no longer matches the reviewed record, or
`attribution_required` is not explicitly `true`, embed copying fails closed. The public asset page
continues to show the reviewed attribution terms next to the exact generated markup.

## Moderation rule

Approve `attribution_name` only when it is a recognizable source, organization, product, or creator
brand. Reject or normalize values that are primarily:

- keyword phrases such as “best SaaS churn calculator”;
- calls to action such as “click here” or “buy now”;
- URLs, domain stuffing, promotional claims, discount language, or rankings;
- instructions to require dofollow links, suppress disclosure, hide attribution, or alter publisher
  content; or
- a title/topic copied solely to influence anchor text.

The reviewed attribution URL must identify the source or its canonical asset page. Query parameters
are retained only when functionally required by the canonical destination; the marketplace never
adds campaign or affiliate parameters.

Creator-declared attribution terms remain visible as legal/reuse context. They do not override the
marketplace's HTML safety rules, iframe sandbox, rights status, reviewed embed origin, or publisher
control over their own page.

## Publisher transparency

- The exact snippet shown on the asset page is the snippet copied.
- Source/brand, attribution URL, terms, rights status, and evidence remain inspectable before copy.
- Publishers may decline an asset whose terms do not fit their use case.
- A copy action is not evidence that a publisher used the snippet.
- The marketplace does not silently append its own backlink to creator or source embeds.

## Required enforcement

- Build markup only from structured reviewed fields; never accept creator HTML.
- Escape iframe attributes, link attributes, and visible text independently.
- Require published status, safe/restricted rights, `embed_allowed = true`, reviewed creator
  attribution, and an exact reviewed embed-origin match.
- Keep unknown, blocked, draft, review, and hidden assets out of embed actions.
- Render all stored creator text through React text nodes; do not use `dangerouslySetInnerHTML`.
- Preserve `embed_copy`, `citation_copy`, `source_click`, and future confirmed outcomes as separate
  analytics definitions.

## Launch review checks

R1 must verify the generated markup, public security headers/CSP, reviewed origins, escaping, and
admin-only moderation. R3 must verify that rights and attribution language does not imply a source
partnership or guaranteed SEO outcome.
