# Creator submission E2E test

The `e2e:submission` script runs the complete creator workflow against a local Worker and local D1
database. It creates a test submission, verifies the automated pre-screen and admin queue, approves
the submission, then verifies the published asset and creator dashboard.

`npm run e2e:embed-sandbox` is a separate non-mutating browser regression. It starts two temporary
local origins, frames the embed with exactly `sandbox="allow-scripts"`, operates an interactive
fixture, and confirms that an otherwise identical fixture with an unguarded `sessionStorage` access
fails. CI runs this test with the installed Chrome/Chromium browser.

The script refuses remote URLs unless `E2E_ALLOW_REMOTE=1` is explicitly set. The default test
sessions are local-only and must never be configured in production.

```bash
printf 'AUTH_SECRET=e2e-local-secret\n' > .dev.vars
npm run db:migrate:local
npx wrangler d1 execute DB --local --command "INSERT OR REPLACE INTO profiles (id, role, display_name, website_url, created_at) VALUES ('github:e2e-creator','creator','E2E Creator','https://example.com','2026-09-15T00:00:00.000Z'),('github:e2e-admin','admin','E2E Admin','https://example.com','2026-09-15T00:00:00.000Z'); INSERT OR REPLACE INTO auth_sessions (id, profile_id, token_hash, expires_at, created_at) VALUES ('e2e-session-creator','github:e2e-creator','HfEDUB8gEEINJOmgv7_Enc9wEy0bTj9LrayzcKFoOYo','2099-01-01T00:00:00.000Z','2026-09-15T00:00:00.000Z'),('e2e-session-admin','github:e2e-admin','gY06RqmqQUjUxIsr30aYBzBNPeaLio3Tstt-lq5jZsA','2099-01-01T00:00:00.000Z','2026-09-15T00:00:00.000Z')"
npm run dev -- --port 8788
# In another terminal:
npm run e2e:submission
```

The test uses a unique `example.com` URL for each run. Test rows can be removed from local D1 after
the run; no production database is touched by the default command.
