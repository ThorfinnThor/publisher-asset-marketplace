# Creator submission E2E test

The `e2e:submission` script runs the complete creator workflow against a local Worker and local D1
database. It creates a test submission, verifies autonomous publication in the same request, then
verifies the published asset and creator dashboard.

`npm run e2e:embed-sandbox` is a separate non-mutating browser regression. It starts two temporary
local origins, frames the embed with exactly `sandbox="allow-scripts"`, operates an interactive
fixture, and confirms that an otherwise identical fixture with an unguarded `sessionStorage` access
fails. CI runs this test with the installed Chrome/Chromium browser.

`npm run e2e:url-scan-conversion` seeds two local scan rows and adversarially verifies owner
isolation, mandatory creator confirmations, canonical-swap rejection, `needs_changes` blocking,
single conversion, autonomous publication after creator confirmation and absence from the exception
queue. It refuses all remote base URLs.

The script refuses remote URLs unless `E2E_ALLOW_REMOTE=1` is explicitly set. The default test
sessions are local-only and must never be configured in production.

```bash
printf 'AUTH_SECRET=e2e-local-secret\n' > .dev.vars
npm run db:migrate:local
npm run dev -- --port 8788
# In another terminal:
npm run e2e:submission
npm run e2e:url-scan-conversion
```

The test uses a unique `example.com` URL for each run. Test rows can be removed from local D1 after
the run; no production database is touched by the default command.
