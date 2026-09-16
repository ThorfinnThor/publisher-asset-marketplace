# G3 — URL-only onboarding and real scan previews

The creator submit page now starts with one public URL. The isolated scanner queues a job, inspects
the page and stores a short-lived PNG preview in the scanner's private R2 bucket. The marketplace
Worker exposes that image only through an owner-authenticated route and a Worker service binding;
the scanner has no public `workers.dev` endpoint.

## Creator flow

1. Enter a public HTTPS URL and select **Scan URL**.
2. Wait for the queued scan to finish. The page shows detected title, type, embed and source data,
   plus the real captured preview.
3. Select **Suggestions in submission form**.
4. Review and edit every field, add attribution terms and rights evidence, run the sandbox test,
   and submit. Passing submissions publish immediately; failed gates return corrections in the
   form.

The captured scanner PNG is a temporary review aid. The form intentionally leaves **Preview image
URL** empty because a submission must point to the creator's own direct public HTTPS image URL.

The scan alone never publishes. After the authenticated creator supplies the required declarations
and attestations, conversion publishes automatically only when every deterministic gate passes.
The marketplace records those declarations as creator claims; it does not claim to have
independently proven ownership or legal permission.

## Service boundary

`URL_SCANNER` is a Cloudflare Worker service binding from the marketplace Worker to the isolated
scanner. Preview keys are restricted to `unconfirmed/<uuid>.png`; previews are private, `no-store`
and expire after seven days. This avoids putting scanner R2 credentials or a public preview bucket
on the marketplace surface.
