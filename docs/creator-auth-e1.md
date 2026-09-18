# Creator authentication and profiles

Creators can sign in with GitHub and, once configured, Google. Publishers remain anonymous. A
successful callback resolves a provider identity to one marketplace profile, then issues an opaque,
hashed D1 session token for the creator dashboard. Provider tokens are never stored.

## Required Cloudflare secrets

Configure these Worker secrets before enabling sign-in:

```sh
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put AUTH_SECRET
```

The GitHub OAuth application callback must be
`https://publisher-asset-marketplace.shuu9599.workers.dev/api/auth/github/callback` (and the
equivalent callback for any custom production domain).

The Google OAuth web application callback must be
`https://publisher-asset-marketplace.shuu9599.workers.dev/api/auth/google/callback` (and the
equivalent callback for any custom production domain). Register each complete callback URL as an
authorized redirect URI in Google Cloud. The Google button remains hidden until both Google secrets
are configured.

Google uses OpenID Connect authorization-code flow with a signed state cookie, signed nonce cookie,
RS256 signature verification against Google's published keys, and issuer, audience, expiry, issue
time, subject, nonce, and verified-email checks.

## Identity behavior

`auth_identities` maps a stable provider subject to a marketplace profile. Existing `github:<id>`
profiles are backfilled by migration `0019_auth_identities.sql`, so current accounts and sessions
continue to work. A Google identity creates its own profile; matching email addresses are
deliberately not merged automatically. Explicit, authenticated account linking will be added before
multiple providers can control one creator profile.

The session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, and contains no profile data. The
database stores only a SHA-256 hash of the opaque token. Existing CSRF protection remains shared
across all login providers.
