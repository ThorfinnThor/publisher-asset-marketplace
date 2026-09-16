"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

type UrlScanFormProps = { csrfToken: string };

type ScanResult = {
  canonical_url_candidate: string | null;
  asset_type_candidate: string | null;
  title_candidate: string | null;
  description_candidate: string | null;
  attribution_name_candidate: string | null;
  attribution_url_candidate: string | null;
  embed?: { candidate_url: string | null; status: "pass" | "blocked" | "unknown" };
  preview?: { r2_key: string | null; content_type: string | null };
  issues?: Array<{ code: string; field: string | null }>;
};

type ScanJob = {
  id: string;
  requested_url: string;
  status:
    | "queued"
    | "running"
    | "needs_confirmation"
    | "needs_changes"
    | "failed"
    | "expired"
    | "converted";
  attempt_count: number;
  result: ScanResult | null;
  error_code: string | null;
};

const issueLabels: Record<string, string> = {
  rights_evidence_missing: "Rechtsnachweis ergänzen",
  ownership_unconfirmed: "Autorisierung bestätigen",
  frame_blocked: "Embed wird im Sandbox-Test blockiert",
  sandbox_not_interactive: "Interaktivität im Embed prüfen",
  preview_failed: "Preview konnte nicht erstellt werden",
  unsupported_content_type: "URL liefert kein HTML-Dokument",
};

export function UrlScanForm({ csrfToken }: UrlScanFormProps) {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<ScanJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    },
    [],
  );

  async function startScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rescanOf = job?.status === "needs_changes" ? job.id : null;
    setError(null);
    setJob(null);
    setWorking(true);
    try {
      const response = await fetch("/api/url-scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          csrf_token: csrfToken,
          url: url.trim(),
          ...(rescanOf ? { rescan_of: rescanOf } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        job_id?: string;
        job?: ScanJob;
        error?: string;
      } | null;
      if (!response.ok) {
        if (payload?.job) {
          setJob(payload.job);
          poll(payload.job.id);
          return;
        }
        throw new Error(payload?.error ?? "URL konnte nicht gescannt werden.");
      }
      if (!payload?.job_id) throw new Error("Scan-ID fehlt in der Antwort.");
      poll(payload.job_id);
    } catch (scanError) {
      setWorking(false);
      setError(
        scanError instanceof Error ? scanError.message : "URL konnte nicht gescannt werden.",
      );
    }
  }

  function poll(id: string, attempts = 0) {
    if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    void (async () => {
      try {
        const response = await fetch(`/api/url-scans/${id}`, { credentials: "same-origin" });
        const payload = (await response.json().catch(() => null)) as {
          job?: ScanJob;
          error?: string;
        } | null;
        if (!response.ok || !payload?.job)
          throw new Error(payload?.error ?? "Scanstatus konnte nicht geladen werden.");
        setJob(payload.job);
        const done = [
          "needs_confirmation",
          "needs_changes",
          "failed",
          "expired",
          "converted",
        ].includes(payload.job.status);
        if (done || attempts >= 59) {
          setWorking(false);
          if (!done)
            setError(
              "Der Scan dauert ungewöhnlich lange. Du kannst den Status später erneut öffnen.",
            );
          return;
        }
        pollRef.current = window.setTimeout(() => poll(id, attempts + 1), 2_000);
      } catch (pollError) {
        setWorking(false);
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Scanstatus konnte nicht geladen werden.",
        );
      }
    })();
  }

  const issues = (job?.result?.issues ?? []).map((issue) => issueLabels[issue.code] ?? issue.code);
  const result = job?.result;

  return (
    <section className="url-scan-card" aria-labelledby="url-scan-heading">
      <div className="form-section__heading">
        <span>01</span>
        <div>
          <h2 id="url-scan-heading">Start with one public URL</h2>
          <p>
            We inspect the page, suggest metadata and capture a real-data preview. Nothing is
            published automatically; rights and the sandbox test remain your responsibility.
          </p>
        </div>
      </div>
      <form className="url-scan-card__form" onSubmit={startScan}>
        <label className="form-field form-field--wide" htmlFor="url-scan-input">
          Tool, chart or dataset URL
          <input
            id="url-scan-input"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/my-calculator"
            required
            type="url"
            value={url}
          />
        </label>
        <button className="button button--primary" disabled={working || !url.trim()} type="submit">
          {working ? "Scanning…" : job?.status === "needs_changes" ? "Rescan URL" : "Scan URL"}
        </button>
      </form>
      {error ? (
        <p className="url-scan-card__error" role="alert">
          {error}
        </p>
      ) : null}
      {job ? (
        <div className="url-scan-result" aria-live="polite">
          <div className="url-scan-result__status">
            <strong>{statusLabel(job.status)}</strong>
            <span>Attempt {job.attempt_count}/3</span>
          </div>
          {job.status === "queued" || job.status === "running" ? (
            <p className="form-hint">
              The isolated scanner is checking HTTPS, redirects, requests and sandbox compatibility.
            </p>
          ) : null}
          {job.status === "failed" || job.status === "expired" ? (
            <p className="url-scan-card__error">
              {job.error_code ? (issueLabels[job.error_code] ?? job.error_code) : "Scan failed."}
            </p>
          ) : null}
          {result ? (
            <div className="url-scan-result__grid">
              {result.preview?.r2_key ? (
                <img
                  className="url-scan-result__preview"
                  src={`/api/url-scans/${job.id}/preview`}
                  alt="Captured preview of the submitted asset"
                />
              ) : null}
              <div>
                <dl className="url-scan-result__facts">
                  <div>
                    <dt>Title</dt>
                    <dd>{result.title_candidate ?? "Not detected"}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{result.asset_type_candidate ?? "Choose during review"}</dd>
                  </div>
                  <div>
                    <dt>Embed</dt>
                    <dd>{result.embed?.candidate_url ?? "Not detected"}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{result.attribution_name_candidate ?? "Add a real brand/source"}</dd>
                  </div>
                </dl>
                {issues.length ? (
                  <p className="url-scan-result__issues">
                    <strong>Before submitting:</strong> {issues.join(" · ")}
                  </p>
                ) : null}
                {job.status === "needs_confirmation" ? (
                  <Link
                    className="button button--secondary"
                    href={`/submit?scan=${encodeURIComponent(job.id)}`}
                  >
                    Confirm suggestions in submission form
                  </Link>
                ) : (
                  <p className="form-hint">
                    Correct the URL or source page above, then select Rescan URL. A blocked scan
                    cannot be converted into a submission.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function statusLabel(status: ScanJob["status"]): string {
  return {
    queued: "Queued",
    running: "Scanning",
    needs_confirmation: "Ready for your confirmation",
    needs_changes: "Changes needed",
    failed: "Scan failed",
    expired: "Scan expired",
    converted: "Already submitted",
  }[status];
}
