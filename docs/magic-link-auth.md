# Magic-link creator authentication

Magic-link sign-in uses a short-lived, single-use email link and the same 30-day opaque session as
GitHub and Google. The creator profile is durable: returning after two months only requires a new
magic link to the same normalized email address.

## Security behavior

- Tokens contain 256 bits of Web Crypto randomness and expire after 15 minutes.
- D1 stores only the SHA-256 token hash. Successful redemption atomically marks a token consumed.
- The token is placed in the URL fragment, not the query string. The fragment is removed before the
  browser sends the token to the verification endpoint, keeping it out of request logs and referrer
  headers and preventing ordinary link scanners from consuming it.
- Requests require the same browser origin and are atomically limited to five per email and 20 per
  source IP per UTC hour. Email and IP rate keys are HMAC-hashed before storage.
- Request responses do not reveal whether an email address already has an account.
- Email identities are not automatically merged with GitHub or Google identities that happen to use
  the same address. Account linking requires an authenticated confirmation flow.

## Activate after the domain is ready

Cloudflare Email Sending is currently available on a Workers Paid plan. Onboard the sender domain in
Cloudflare Email Service and create an API token with `Email Sending: Edit`. Then set these Worker
secrets:

```sh
npx wrangler secret put EMAIL_ACCOUNT_ID
npx wrangler secret put EMAIL_SENDING_API_TOKEN
npx wrangler secret put MAGIC_LINK_FROM_EMAIL
npx wrangler secret put MAGIC_LINK_APP_ORIGIN
```

`MAGIC_LINK_FROM_EMAIL` must be an address on the onboarded sender domain, for example
`login@example.com`. `MAGIC_LINK_APP_ORIGIN` is the bare canonical HTTPS origin, for example
`https://example.com`; using a fixed origin prevents Host-header manipulation of emailed links. The
email form remains hidden until all four values and `AUTH_SECRET` are available. No code change or
redeployment is required after the secrets are added.

The implementation uses Cloudflare's documented transactional-email endpoint:

- https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
- https://developers.cloudflare.com/email-service/get-started/send-emails/
