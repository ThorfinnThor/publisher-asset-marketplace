import type { Metadata } from "next";
import { headers } from "next/headers";

import { AdminReviewActions } from "@/components/admin-review-actions";
import { csrfTokenForRequest, getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { parseStoredSubmissionPreScreen } from "@/lib/submissions/pre-screen";

export const metadata: Metadata = {
  title: "Submission moderation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  creator_id: string;
  creator_name: string;
  canonical_url: string;
  embed_url: string;
  preview_url: string | null;
  asset_type: string;
  title: string;
  description: string;
  attribution_name: string;
  attribution_url: string;
  attribution_terms: string;
  opportunity_topic: string | null;
  declared_rights_json: string;
  pre_screen_status: "pass" | "review";
  pre_screen_json: string;
  review_status: "pending" | "approved" | "rejected" | "needs_changes";
  review_notes: string | null;
  rights_status: "safe" | "restricted" | "unknown" | "blocked";
  rights_reason_code: string | null;
  rights_evidence_url: string | null;
  authorization_version: number;
  source_scan_id: string | null;
  scan_requested_url: string | null;
  created_at: string;
};

type AdminQueue =
  | { isAdmin: false; csrfToken: null; submissions: [] }
  | { isAdmin: true; csrfToken: string; submissions: SubmissionRow[] };

export default async function AdminSubmissionsPage() {
  const data = await loadAdminQueue();

  if (!data.isAdmin || !data.csrfToken) {
    return (
      <main className="page-shell dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="page-title">Submission exceptions</h1>
            <p className="page-intro">Legacy and manually escalated submissions appear here.</p>
          </div>
        </header>
        <div className="notice dashboard-notice" role="alert">
          <strong>Admin access required.</strong> This queue is restricted to approved marketplace
          administrators.
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="page-title">Submission exceptions</h1>
          <p className="page-intro">
            Passing submissions publish automatically. This queue is retained for legacy records and
            manual intervention.
          </p>
        </div>
        <span className="profile-role">{data.submissions.length} open</span>
      </header>

      <div className="notice dashboard-notice">
        <strong>Manual approval remains an exception tool.</strong> Only use it for a legacy record
        after verifying its evidence and embed behavior.
      </div>

      {data.submissions.length === 0 ? (
        <section className="dashboard-table" aria-labelledby="moderation-table-heading">
          <div className="dashboard-table__heading">
            <div>
              <h2 id="moderation-table-heading">Pending submissions</h2>
              <p>All exception work is clear.</p>
            </div>
            <span className="result-count">0 open</span>
          </div>
          <div className="empty-state empty-state--standalone">
            <strong>No submissions to review</strong>
            <span>Passing new submissions publish automatically and do not enter this queue.</span>
          </div>
        </section>
      ) : (
        <div className="moderation-grid">
          {data.submissions.map((submission) => (
            <SubmissionReviewCard
              key={submission.id}
              csrfToken={data.csrfToken}
              submission={submission}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function SubmissionReviewCard({
  csrfToken,
  submission,
}: {
  csrfToken: string;
  submission: SubmissionRow;
}) {
  const declaredRights = parseRights(submission.declared_rights_json);
  const preScreen = parseStoredSubmissionPreScreen(submission.pre_screen_json);
  return (
    <article className="moderation-card">
      <header className="moderation-card__header">
        <div>
          <p className="eyebrow">
            {submission.asset_type} · {submission.creator_name}
          </p>
          <h2>{submission.title}</h2>
          <p>Submitted {formatDate(submission.created_at)}</p>
        </div>
        <span className="status-badge">{submission.review_status.replace("_", " ")}</span>
      </header>

      <div className="moderation-card__body">
        <p className="moderation-card__description">{submission.description}</p>
        <section
          className={`submission-prescreen submission-prescreen--${submission.pre_screen_status}`}
          aria-label="Automated pre-screen"
        >
          <strong>
            Automated pre-screen:{" "}
            {submission.pre_screen_status === "pass" ? "passed" : "review needed"}
          </strong>
          {preScreen.checks.length > 0 ? (
            <ul>
              {preScreen.checks.map((check) => (
                <li key={check.code}>
                  <span className={`pre-screen-state pre-screen-state--${check.status}`}>
                    {check.status === "pass" ? "Pass" : "Review"}
                  </span>
                  {check.message}
                </li>
              ))}
            </ul>
          ) : (
            <p>Legacy submission: complete every check manually.</p>
          )}
        </section>
        {submission.source_scan_id && submission.scan_requested_url ? (
          <section
            className="submission-prescreen submission-prescreen--review"
            aria-label="URL scan provenance"
          >
            <strong>URL scan assisted — rights still require manual evidence.</strong>
            <p>
              Scanned source:{" "}
              <SafeExternalLink href={submission.scan_requested_url}>
                {submission.scan_requested_url}
              </SafeExternalLink>
            </p>
          </section>
        ) : null}
        {submission.opportunity_topic ? (
          <p className="detail-supporting-text">
            Demand topic: <strong>{submission.opportunity_topic}</strong>
          </p>
        ) : null}
        <dl className="rights-table">
          <div>
            <dt>Canonical URL</dt>
            <dd>
              <SafeExternalLink href={submission.canonical_url}>
                {submission.canonical_url}
              </SafeExternalLink>
            </dd>
          </div>
          <div>
            <dt>Embed URL</dt>
            <dd>
              <SafeExternalLink href={submission.embed_url}>
                {submission.embed_url}
              </SafeExternalLink>
            </dd>
          </div>
          <div>
            <dt>Attribution</dt>
            <dd>
              <SafeExternalLink href={submission.attribution_url}>
                {submission.attribution_name}
              </SafeExternalLink>
            </dd>
          </div>
          <div>
            <dt>Declared terms</dt>
            <dd>{submission.attribution_terms}</dd>
          </div>
          <div>
            <dt>Declared rights</dt>
            <dd>{formatDeclaredRights(declaredRights)}</dd>
          </div>
          <div>
            <dt>Creator confirmations</dt>
            <dd>{formatCreatorConfirmations(declaredRights, submission.authorization_version)}</dd>
          </div>
          <div>
            <dt>Reviewed rights</dt>
            <dd>
              {submission.rights_status}{" "}
              {submission.rights_reason_code ? `· ${submission.rights_reason_code}` : ""}
            </dd>
          </div>
        </dl>
        {submission.preview_url ? (
          <p className="detail-supporting-text">
            Preview:{" "}
            <SafeExternalLink href={submission.preview_url}>
              {submission.preview_url}
            </SafeExternalLink>
          </p>
        ) : null}
      </div>

      <div className="moderation-card__actions">
        <AdminReviewActions
          csrfToken={csrfToken}
          embedUrl={submission.embed_url}
          initialEvidenceUrl={submission.rights_evidence_url}
          initialAttributionName={submission.attribution_name}
          initialAttributionTerms={submission.attribution_terms}
          initialDescription={submission.description}
          initialRightsStatus={submission.rights_status}
          initialTitle={submission.title}
          submissionId={submission.id}
        />
      </div>
    </article>
  );
}

function SafeExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} rel="noreferrer noopener" target="_blank">
      {children}
    </a>
  );
}

async function loadAdminQueue(): Promise<AdminQueue> {
  try {
    const requestHeaders = await headers();
    const request = new Request("https://internal.invalid/admin/submissions", {
      headers: requestHeaders,
    });
    const profile = await getAuthenticatedProfile(request, getDatabase());
    if (!profile || profile.role !== "admin")
      return { isAdmin: false, csrfToken: null, submissions: [] };

    const result = await getDatabase()
      .prepare(
        `
          SELECT
            s.id, s.creator_id, p.display_name AS creator_name,
            s.canonical_url, s.embed_url, s.preview_url, s.asset_type,
            s.title, s.description, s.attribution_name, s.attribution_url,
            s.attribution_terms, s.opportunity_topic, s.declared_rights_json,
            s.pre_screen_status, s.pre_screen_json, s.review_status,
            s.review_notes, s.rights_status, s.rights_reason_code,
            s.rights_evidence_url, s.authorization_version, scan.id AS source_scan_id,
            scan.requested_url AS scan_requested_url, s.created_at
          FROM submissions s
          JOIN profiles p ON p.id = s.creator_id
          LEFT JOIN url_scan_jobs scan ON scan.submission_id = s.id
          WHERE s.review_status IN ('pending', 'needs_changes')
          ORDER BY s.created_at ASC
          LIMIT 100
        `,
      )
      .all<SubmissionRow>();
    const csrfToken = await csrfTokenForRequest(request);
    if (!csrfToken) return { isAdmin: false, csrfToken: null, submissions: [] };
    return { isAdmin: true, csrfToken, submissions: result.results };
  } catch {
    return { isAdmin: false, csrfToken: null, submissions: [] };
  }
}

function parseRights(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function formatDeclaredRights(rights: Record<string, unknown>): string {
  const labels: Array<[string, string]> = [
    ["commercial_use", "commercial"],
    ["embed_allowed", "embed"],
    ["modification_allowed", "modify"],
    ["citation_required", "citation"],
  ];
  const declared = labels.filter(([key]) => rights[key] === true).map(([, label]) => label);
  return declared.length > 0 ? declared.join(", ") : "none declared";
}

function formatCreatorConfirmations(
  rights: Record<string, unknown>,
  authorizationVersion: number,
): string {
  if (authorizationVersion < 2) return "legacy workflow — verify manually";
  const fields: Array<[string, string]> = [
    ["source_identity_confirmed", "source identity"],
    ["attribution_confirmed", "attribution"],
    ["preview_display_authorized", "preview display"],
    ["submitter_authorized", "submitter authorization"],
  ];
  if (authorizationVersion >= 3) {
    fields.push(["commercial_marketplace_acknowledged", "commercial marketplace"]);
  }
  if (authorizationVersion >= 4) {
    fields.push(["creator_terms_accepted", "creator terms"]);
  }
  const confirmed = fields.filter(([key]) => rights[key] === true).map(([, label]) => label);
  return confirmed.length === fields.length ? confirmed.join(", ") : "incomplete — do not approve";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString("en", { dateStyle: "medium" });
}
