import type { Metadata } from "next";
import { headers } from "next/headers";

import { SubmissionForm, SubmissionRequirements } from "@/components/submission-form";
import { AuthOptions } from "@/components/auth-options";
import { UrlScanForm } from "@/components/url-scan-form";
import { csrfTokenForRequest, getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { publicUrlScanJob, type UrlScanJobRow } from "@/lib/submissions/url-scan-jobs";
import { normalizeDemandQuery } from "@/lib/search/normalize-demand-query";

export const metadata: Metadata = {
  title: "Submit an asset",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SubmitPageProps = {
  searchParams: Promise<{ topic?: string; scan?: string }>;
};

export default async function SubmitPage({ searchParams }: SubmitPageProps) {
  const params = await searchParams;
  const auth = await loadAuth();
  const opportunityTopic = parseOpportunityTopic(params.topic);
  const scanPrefill =
    auth.profile && isUuid(params.scan)
      ? await loadScanPrefill(params.scan, auth.profile.id)
      : null;

  return (
    <main className="page-shell submission-page">
      <header className="submission-page__header">
        <p className="eyebrow">For creators</p>
        <h1 className="page-title">Publish an asset.</h1>
        <p className="page-intro">
          Submit a useful chart, calculator, benchmark or dataset. Assets that pass every automated
          check are published immediately.
        </p>
      </header>

      <div className="submission-requirements--standalone">
        <SubmissionRequirements />
      </div>

      {!auth.profile ? (
        <section className="creator-auth-card" aria-labelledby="submit-sign-in-heading">
          <p className="eyebrow">Creator access</p>
          <h2 id="submit-sign-in-heading">Sign in to submit</h2>
          <p>Publishers can browse without an account.</p>
          <AuthOptions context="submit an asset" />
        </section>
      ) : auth.csrfToken ? (
        <>
          <UrlScanForm csrfToken={auth.csrfToken} />
          {scanPrefill ? (
            <div className="notice scan-prefill-notice" role="status">
              <strong>Scan suggestions loaded.</strong> Check every field, add a direct public
              preview URL and rights evidence, then run the sandbox test. Passing submissions are
              published automatically.
            </div>
          ) : null}
          <div className="submission-layout">
            <SubmissionForm
              csrfToken={auth.csrfToken}
              opportunityTopic={opportunityTopic}
              initialValues={scanPrefill ?? undefined}
              scanId={scanPrefill?.scan_id}
            />
            <aside className="submission-aside">
              <div className="notice">
                <strong>Autonomous publishing.</strong> Publication happens immediately only when
                every deterministic check and creator declaration passes.
              </div>
              <div className="submission-aside__section">
                <h2>What happens next</h2>
                <ol>
                  <li>URLs, hosts, preview format and attribution are validated.</li>
                  <li>Your reuse declarations and sandbox confirmation are checked.</li>
                  <li>Passing assets join publisher search immediately.</li>
                </ol>
              </div>
              <div className="submission-aside__section">
                <h2>Not accepted in V1</h2>
                <p>
                  Arbitrary scripts, uploaded JavaScript, raw HTML and server-side URL fetching.
                </p>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <div className="notice" role="alert">
          Submission security is not configured yet.
        </div>
      )}
    </main>
  );
}

type ScanPrefill = {
  scan_id: string;
  canonical_url: string;
  asset_type?: "chart" | "calculator" | "table" | "dataset" | "benchmark" | "widget";
  title: string;
  description: string;
  embed_url: string;
  preview_url: string;
  attribution_name: string;
  attribution_url: string;
};

async function loadScanPrefill(id: string, creatorId: string): Promise<ScanPrefill | null> {
  const row = await getDatabase()
    .prepare(
      `
          SELECT id, requested_url, status, attempt_count, result_json, error_code,
                 created_at, started_at, completed_at, expires_at, updated_at
          FROM url_scan_jobs
          WHERE id = ? AND creator_id = ?
          LIMIT 1
        `,
    )
    .bind(id, creatorId)
    .first<UrlScanJobRow>();
  if (!row || row.status !== "needs_confirmation") {
    return null;
  }
  const job = publicUrlScanJob(row);
  const result = isRecord(job.result) ? job.result : null;
  if (!result) return null;
  const embed = isRecord(result.embed) ? result.embed : null;
  const preview = isRecord(result.preview) ? result.preview : null;
  const type = result.asset_type_candidate;
  if (!embed || !preview) {
    return null;
  }
  const canonicalUrl = stringCandidate(result.canonical_url_candidate) ?? row.requested_url;
  return {
    scan_id: id,
    canonical_url: canonicalUrl,
    asset_type: isAssetType(type) ? type : undefined,
    title: stringCandidate(result.title_candidate) ?? "",
    description: stringCandidate(result.description_candidate) ?? "",
    embed_url: stringCandidate(embed.candidate_url) ?? canonicalUrl,
    // The scanner preview is temporary and private; submissions must use the creator's direct
    // public HTTPS image URL instead.
    preview_url: "",
    attribution_name: stringCandidate(result.attribution_name_candidate) ?? "",
    attribution_url: stringCandidate(result.attribution_url_candidate) ?? canonicalUrl,
  };
}

function isAssetType(value: unknown): value is ScanPrefill["asset_type"] {
  return (
    value === "chart" ||
    value === "calculator" ||
    value === "table" ||
    value === "dataset" ||
    value === "benchmark" ||
    value === "widget"
  );
}

function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringCandidate(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseOpportunityTopic(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeDemandQuery(value);
  return normalized.aggregation_eligible ? normalized.display_query : null;
}

async function loadAuth() {
  const requestHeaders = await headers();
  const request = new Request("https://internal.invalid/submit", { headers: requestHeaders });
  const profile = await getAuthenticatedProfile(request, getDatabase());
  return { profile, csrfToken: profile ? await csrfTokenForRequest(request) : null };
}
