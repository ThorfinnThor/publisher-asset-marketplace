# E1 creator authentication and profile

E1 adds GitHub OAuth for creator accounts while publishers remain anonymous. On a successful
callback the Worker creates or refreshes a `profiles` row with a stable `github:<id>` identifier,
then issues an opaque, hashed D1 session token for the creator dashboard.

## Required Cloudflare secrets

Configure these Worker secrets before enabling sign-in:

```sh
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put AUTH_SECRET
```

The GitHub OAuth application callback must be
`https://publisher-asset-marketplace.shuu9599.workers.dev/api/auth/github/callback` (and the
equivalent callback for any custom production domain).

The session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, and contains no profile data. The
database stores only a SHA-256 hash of the opaque token. Submission validation, iframe policy,
CSRF rules for creator mutations, and admin authorization are deliberately reserved for E2's SOL
security design and the later moderation milestones.
