# Autonomous creator publishing

Status: accepted for production implementation
Decision date: 2026-09-16
Model allocation: SOL security and release review, LUNA copy and minor UI follow-up

## Decision

Creator submissions publish without a mandatory human review when every deterministic gate passes.
The creator's authenticated declarations are the authority for ownership and reuse permissions; the
marketplace does not claim that automated checks independently prove those declarations.

The publishing gate requires:

- authenticated GitHub creator session and same-origin CSRF protection;
- public HTTPS canonical, embed, preview and attribution/rights URLs;
- canonical, embed and attribution hosts that are related;
- a source-hosted direct preview or an authenticated marketplace image upload;
- neutral attribution text;
- explicit commercial-use and embedding permission declarations;
- the fixed `sandbox="allow-scripts"` creator test and confirmation;
- source identity, attribution, preview-display and submitter-authorization attestations;
- acknowledgement that the asset may be listed and promoted within a commercially operated
  marketplace without transferring ownership of the tool, source code or data;
- acceptance of the current versioned Creator Terms;
- canonical URL uniqueness; and
- the existing rolling limit of 10 submissions per creator per 24 hours.

Any failed gate returns `422 auto_publish_checks_failed` with the failed checks. The submission is
not inserted, so the creator can correct it and retry without an administrator. Passing submissions
are inserted, published and audited in one D1 batch transaction.

## Accountability model

The system reviewer is the reserved, non-login profile `system:auto-publisher`. Every autonomous
decision appends a `submission_reviews` row and stores:

- `rights_status = restricted` because publisher-visible attribution remains mandatory;
- `rights_reason_code = creator_attested_auto_publish`;
- the attribution/rights URL as creator-declared evidence;
- the exact declarations and attestation timestamp; and
- authorization contract version `4`, including the commercial-marketplace acknowledgement and
  accepted Creator Terms version; and
- the fixed sandbox profile and test timestamp.

False declarations can result in asset removal and account suspension. Complaint handling,
revocation monitoring and account enforcement remain operational controls; they are not claims that
the initial automated gate can establish legal truth.

## Legacy queue

The admin queue remains available for records created before autonomous publishing and exceptional
intervention. Its **Run automated checks** action revalidates the stored payload against the current
contract and publishes it through the same system-review transaction when all checks pass.

## Cloudflare implementation

The submission insert, asset upsert, submission approval and immutable review audit execute through
the bound D1 database using prepared statements. D1 batches are transactional, so a failing
statement rolls back the sequence. No Worker calls the Cloudflare REST API, no secrets are stored in
source, and no submission-time server fetch is added.
