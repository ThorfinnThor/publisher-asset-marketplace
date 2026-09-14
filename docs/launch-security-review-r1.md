# R1 launch security review

Status: reviewed and deployed  
Model allocation: SOL review, LUNA implementation fixes

## Scope

The review covered GitHub OAuth/session cookies, creator submission mutations, admin moderation,
public analytics ingestion, generated embed/citation markup, topic-tagged submissions and the
Cloudflare Worker response boundary.

## Findings and resolutions

- Creator and admin mutations require same-origin requests, an HttpOnly `SameSite=Lax; Secure`
  cookie-backed session, and an HMAC CSRF token bound to the session token.
- Admin moderation derives the role from the server-side profile and uses prepared D1 statements;
  submission IDs are constrained before lookup and missing/foreign submissions do not enumerate.
- Creator submissions accept structured HTTPS URLs and plain-text metadata only. No route fetches
  creator URLs, accepts HTML/JavaScript or treats declared rights as reviewed rights.
- Public embed/citation/source actions require a valid anonymous session identifier and a published,
  rights-reviewed asset. Creator embed markup is generated from reviewed structured fields.
- The Worker now applies CSP, frame, referrer, transport, content-type, permissions and cross-origin
  isolation headers to every response.
- Sign-out now rejects cross-origin POSTs; it remains a same-site form action.

The CSP permits the current server-rendered RSC inline bootstrap (`unsafe-inline`) and HTTPS
source-hosted frames. A nonce-based CSP can be tightened when the framework removes inline RSC
bootstrapping; it is not required for the current release gate.

## Residual operational controls

Cloudflare DDoS/WAF/rate-limit configuration and dependency advisories remain operational checks for
R2/R3. This review does not claim that publisher intent events are proof of publication, embeds,
citations or backlinks.
