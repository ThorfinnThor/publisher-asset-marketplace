"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AdminReviewActionsProps = {
  csrfToken: string;
  submissionId: string;
  initialTitle: string;
  initialDescription: string;
  initialAttributionName: string;
  initialAttributionTerms: string;
  initialRightsStatus: "safe" | "restricted" | "unknown" | "blocked";
  initialEvidenceUrl: string | null;
  embedUrl: string;
};

export function AdminReviewActions({
  csrfToken,
  submissionId,
  initialTitle,
  initialDescription,
  initialAttributionName,
  initialAttributionTerms,
  initialRightsStatus,
  initialEvidenceUrl,
  embedUrl,
}: AdminReviewActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxLoaded, setSandboxLoaded] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          csrf_token: csrfToken,
          decision: data.get("decision"),
          review_notes: data.get("review_notes"),
          rights_status: data.get("rights_status"),
          rights_reason_code: data.get("rights_reason_code"),
          rights_evidence_url: String(data.get("rights_evidence_url") ?? "").trim() || null,
          title: data.get("title"),
          description: data.get("description"),
          attribution_name: data.get("attribution_name"),
          attribution_terms: data.get("attribution_terms"),
          sandbox_tested: data.get("sandbox_tested") === "on",
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "The review could not be saved.");
        return;
      }
      router.refresh();
    } catch {
      setError("The review could not be reached. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="moderation-action-form" onSubmit={submit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor={`decision-${submissionId}`}>Decision</label>
          <select
            defaultValue="needs_changes"
            id={`decision-${submissionId}`}
            name="decision"
            required
          >
            <option value="needs_changes">Needs changes</option>
            <option value="approved">Approve for publishing</option>
            <option value="rejected">Reject</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`review-title-${submissionId}`}>Normalized title</label>
          <input
            defaultValue={initialTitle}
            id={`review-title-${submissionId}`}
            name="title"
            required
            type="text"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`review-attribution-name-${submissionId}`}>Normalized source name</label>
          <input
            defaultValue={initialAttributionName}
            id={`review-attribution-name-${submissionId}`}
            name="attribution_name"
            required
            type="text"
          />
          <p className="form-hint">Visible anchor text: source or brand only, never keywords.</p>
        </div>
        <div className="form-field form-field--wide">
          <label htmlFor={`review-description-${submissionId}`}>Normalized description</label>
          <textarea
            defaultValue={initialDescription}
            id={`review-description-${submissionId}`}
            minLength={20}
            name="description"
            required
          />
        </div>
        <div className="form-field form-field--wide">
          <label htmlFor={`review-attribution-terms-${submissionId}`}>
            Normalized attribution terms
          </label>
          <input
            defaultValue={initialAttributionTerms}
            id={`review-attribution-terms-${submissionId}`}
            name="attribution_terms"
            required
            type="text"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`rights-status-${submissionId}`}>Rights status</label>
          <select
            defaultValue={initialRightsStatus}
            id={`rights-status-${submissionId}`}
            name="rights_status"
            required
          >
            <option value="safe">Safe</option>
            <option value="restricted">Restricted</option>
            <option value="unknown">Unknown</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`rights-reason-${submissionId}`}>Rights reason code</label>
          <input
            defaultValue="manual_review"
            id={`rights-reason-${submissionId}`}
            name="rights_reason_code"
            required
            type="text"
          />
        </div>
        <div className="form-field">
          <label htmlFor={`rights-evidence-${submissionId}`}>Rights evidence URL</label>
          <input
            defaultValue={initialEvidenceUrl ?? ""}
            id={`rights-evidence-${submissionId}`}
            name="rights_evidence_url"
            placeholder="https://source.example/terms"
            type="url"
          />
        </div>
        <div className="form-field form-field--wide">
          <label htmlFor={`review-notes-${submissionId}`}>Review notes</label>
          <textarea
            id={`review-notes-${submissionId}`}
            minLength={10}
            name="review_notes"
            placeholder="Record the evidence checked and any changes required."
            required
          />
        </div>
        <div className="embed-test form-field--wide" aria-label="Admin sandbox verification">
          <div className="embed-test__heading">
            <div>
              <h3>Required embed verification</h3>
              <p>
                Open the submitted URL with exactly <code>allow-scripts</code>, then operate its
                primary controls before approving.
              </p>
            </div>
            <button
              className="button button--secondary"
              onClick={() => {
                setSandboxLoaded(false);
                setSandboxOpen(true);
              }}
              type="button"
            >
              Open sandbox test
            </button>
          </div>
          {sandboxOpen ? (
            <div className="embed-test__frame-wrap">
              <iframe
                className="embed-test__frame"
                loading="eager"
                onLoad={() => setSandboxLoaded(true)}
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts"
                src={embedUrl}
                title="Admin embed sandbox test"
              />
            </div>
          ) : null}
          <label className="attestation embed-test__attestation">
            <input disabled={!sandboxLoaded} name="sandbox_tested" type="checkbox" />
            <span>
              I interacted with this embed in the fixed marketplace sandbox and verified that it
              remains usable. This confirmation is mandatory for approval.
            </span>
          </label>
        </div>
      </div>
      {error ? (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      ) : null}
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "Saving…" : "Save review"}
      </button>
    </form>
  );
}
