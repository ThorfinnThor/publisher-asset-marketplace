# R2 release regression suite

Status: implemented and deployed  
Model allocation: LUNA implementation

`npm run release:smoke` runs non-mutating HTTP checks against the configured
`RELEASE_BASE_URL` (default: the production Worker). It covers the public critical path:

```text
home -> search -> asset detail -> citation/embed copy UI
opportunity page -> topic-tagged submission page
creator dashboard -> anonymous sign-in state
```

It also checks negative API boundaries for missing anonymous-session, submission-origin and
sign-out-origin headers, plus the production `X-Frame-Options` header. The smoke script does not
create analytics events, submissions or moderation changes.

The post-import checks additionally require a published OWID result in live search, open one
`safe` and one `restricted` asset detail page, and confirm that an `unknown` draft asset returns
404 publicly. The Cloudflare deployment workflow runs this smoke automatically after each
successful production deploy.

The protected state-changing journey is covered by the existing deterministic suites:

- `test/submissions.test.ts`: creator payload validation, rights declarations and opportunity-topic
  privacy handling.
- `test/moderation.test.ts` and `test/publish-asset.test.ts`: moderation decisions and approved
  creator asset promotion.
- `test/analytics-events.test.ts`, `test/demand-aggregation.test.ts` and
  `test/creator-dashboard.test.ts`: event persistence contracts, aggregation and creator ownership
  isolation.

Run the live smoke after every production deploy:

```text
npm run release:smoke
```

The suite intentionally avoids pretending that a public HTTP smoke can safely approve a real
creator submission or mutate production analytics.
