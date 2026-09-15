# E3 creator submissions

E3 opens the creator submission flow behind GitHub authentication. The page is
[`/submit`](https://publisher-asset-marketplace.shuu9599.workers.dev/submit), and the mutation is
`POST /api/submissions`.

## Request flow

1. The server-rendered page loads the authenticated creator profile from the D1-backed session.
2. It derives an HMAC CSRF token from the HttpOnly session token and `AUTH_SECRET`; no session token
   is exposed to the browser.
3. The client form sends structured JSON with an exact same-origin `Origin` header and the CSRF token.
4. The Worker streams at most 32 KiB before parsing JSON, validates every field again, and rejects
   unknown fields, unsafe URLs, missing previews, raw HTML, control characters, missing rights
   booleans, and missing attestation.
5. Accepted payloads receive a deterministic automated pre-screen checklist for host relationships,
   preview format, attribution language, and declared reuse rights.
6. D1 stores a `pending` submission only. The normalized canonical URL is unique across existing
   assets and submissions, and an atomic `INSERT ... SELECT` enforces the 10-submissions-per-creator
   rolling 24-hour limit.

The endpoint never fetches submitted URLs, accepts raw HTML, renders creator input as HTML, or
publishes an asset. Moderation and asset promotion are E4/E5.

## Verification

- Migration: `migrations/0007_submission_security.sql`
- Validation: `src/lib/submissions/validate.ts`
- API: `src/app/api/submissions/route.ts`
- UI: `src/components/submission-form.tsx`
- Security tests: `test/submissions.test.ts`

Run `npm run db:migrate:local` and `npm run check` before changing the contract. The normative
security cases remain in [submission-security-v1.json](../data/benchmarks/submission-security-v1.json).
