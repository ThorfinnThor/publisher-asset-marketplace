# E4 submission moderation

E4 adds the private moderation queue at `/admin/submissions` and the review mutation
`POST /api/admin/submissions/:id/review`.

Only a profile whose D1 role is `admin` can read the queue or mutate a review. The request still
requires the same-origin check and the HMAC CSRF token bound to the HttpOnly creator session.
Creator IDs, roles and reviewer IDs are always derived server-side.

## Review states

`pending` and `needs_changes` can be reviewed. A review can set `approved`, `rejected`, or
`needs_changes`; `approved` and `rejected` are immutable in E4. Approval does not publish or index an
asset. E5 owns the separate promotion transaction.

Every decision requires:

- plain-text review notes;
- a rights status (`safe`, `restricted`, `unknown`, or `blocked`);
- a rights reason code; and
- HTTPS rights evidence for approval.

The reviewer may also normalize title, description, source name and attribution terms in the same
mutation. These remain plain text and are never interpreted as HTML.

The current decision is stored on `submissions`. Each successful change also appends an immutable
`submission_reviews` row with reviewer, decision, evidence and timestamp. D1 batch execution keeps
the current-state update and audit insert together.

Submitted URLs are displayed as escaped text/links only. The queue never fetches a creator URL or
renders submitted HTML/iframe markup.

Implementation:

- Migration: `migrations/0008_submission_moderation.sql`
- Contract: `src/lib/admin/moderation.ts`
- Queue: `src/app/admin/submissions/page.tsx`
- Mutation: `src/app/api/admin/submissions/[id]/review/route.ts`
- UI actions: `src/components/admin-review-actions.tsx`
- Tests: `test/moderation.test.ts`
