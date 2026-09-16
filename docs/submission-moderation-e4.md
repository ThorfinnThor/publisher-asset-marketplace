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
- HTTPS rights evidence for approval; and
- an admin-confirmed interactive test in the fixed `sandbox="allow-scripts"` profile for approval.

The reviewer may also normalize title, description, source name and attribution terms in the same
mutation. These remain plain text and are never interpreted as HTML.

The current decision is stored on `submissions`. Each successful change also appends an immutable
`submission_reviews` row with reviewer, decision, evidence and timestamp. D1 batch execution keeps
the current-state update and audit insert together.

An approved decision promotes the submission in the same batch to a published creator asset; the
submission stores the resulting `asset_id` and the asset receives reviewed attribution terms plus
a reviewed embed-origin snapshot.

Submitted URLs are displayed as escaped text/links only. The admin can explicitly open the embed
URL in marketplace-generated iframe markup with the fixed sandbox; creator-supplied HTML is never
rendered. The Worker does not fetch the URL. The verification result is stored both on the
submission and in the immutable review record.

Implementation:

- Migrations: `migrations/0008_submission_moderation.sql` and
  `migrations/0015_embed_sandbox_verification.sql`
- Contract: `src/lib/admin/moderation.ts`
- Queue: `src/app/admin/submissions/page.tsx`
- Mutation and promotion: `src/app/api/admin/submissions/[id]/review/route.ts`
- UI actions: `src/components/admin-review-actions.tsx`
- Tests: `test/moderation.test.ts`
