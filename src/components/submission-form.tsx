"use client";

import { useState, type FormEvent } from "react";

type SubmissionFormProps = { csrfToken: string; opportunityTopic?: string | null };

type SubmissionResponse = {
  error?: string;
  pre_screen?: { status: "pass" | "review" };
};

export function SubmissionRequirements() {
  return (
    <section
      className="form-section submission-requirements"
      aria-labelledby="requirements-heading"
    >
      <div className="form-section__heading">
        <span>00</span>
        <div>
          <h2 id="requirements-heading">Submission requirements</h2>
          <p>Prepare these details before submitting. Automated checks run before admin review.</p>
        </div>
      </div>
      <ul className="requirements-list">
        <li>Public canonical HTTPS URL.</li>
        <li>Type: chart, calculator, table, dataset, benchmark, or widget.</li>
        <li>Title: 3–160 characters.</li>
        <li>Description: 20–2,000 characters.</li>
        <li>Public HTTPS embed URL—the URL inside an iframe, not raw iframe HTML.</li>
        <li>Direct HTTPS preview image URL, preferably PNG or JPG, so real data is visible.</li>
        <li>Real source or brand name—not SEO keywords.</li>
        <li>
          Public HTTPS attribution URL and clear terms, such as Credit Example Source — CC BY 4.0.
        </li>
        <li>Accurate declarations for commercial use, embedding, modification, and citation.</li>
        <li>Confirmation that you are authorized to submit the asset.</li>
        <li>Maximum 10 submissions per GitHub account within 24 hours.</li>
        <li>The canonical URL must not already exist in the marketplace or another submission.</li>
      </ul>
      <p className="requirements-exclusion">
        Not accepted: raw HTML, uploaded JavaScript, arbitrary scripts, private/internal URLs, or
        URLs containing credentials.
      </p>
    </section>
  );
}

export function SubmissionForm({ csrfToken, opportunityTopic = null }: SubmissionFormProps) {
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          csrf_token: csrfToken,
          canonical_url: data.get("canonical_url"),
          asset_type: data.get("asset_type"),
          title: data.get("title"),
          description: data.get("description"),
          embed_url: data.get("embed_url"),
          preview_url: String(data.get("preview_url") ?? "").trim() || null,
          attribution_name: data.get("attribution_name"),
          attribution_url: data.get("attribution_url"),
          attribution_terms: data.get("attribution_terms"),
          commercial_use: data.get("commercial_use") === "on",
          embed_allowed: data.get("embed_allowed") === "on",
          modification_allowed: data.get("modification_allowed") === "on",
          citation_required: data.get("citation_required") === "on",
          authorized_to_submit: data.get("authorized_to_submit") === "on",
          opportunity_topic: String(data.get("opportunity_topic") ?? "").trim() || null,
        }),
      });
      const result = (await response.json().catch(() => null)) as SubmissionResponse | null;
      if (!response.ok) {
        setStatus({ tone: "error", text: result?.error ?? "The submission could not be saved." });
        return;
      }
      form.reset();
      setStatus({
        tone: "success",
        text:
          result?.pre_screen?.status === "pass"
            ? "Automated pre-screen passed. Submitted for final admin rights review."
            : "Submitted for review. Automated checks identified items for the admin to verify.",
      });
    } catch {
      setStatus({ tone: "error", text: "The submission could not be reached. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="submission-form" onSubmit={submit}>
      <section className="form-section" aria-labelledby="asset-details-heading">
        <div className="form-section__heading">
          <span>01</span>
          <div>
            <h2 id="asset-details-heading">Asset details</h2>
            <p>Give publishers enough context to understand the utility.</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-field form-field--wide">
            <label htmlFor="canonical-url">Canonical URL</label>
            <input
              id="canonical-url"
              name="canonical_url"
              placeholder="https://example.com/data-tool"
              required
              type="url"
            />
            <p className="form-hint">Public HTTPS only. The marketplace does not fetch this URL.</p>
          </div>
          <div className="form-field">
            <label htmlFor="asset-type">Asset type</label>
            <select defaultValue="" id="asset-type" name="asset_type" required>
              <option disabled value="">
                Select type
              </option>
              <option value="chart">Chart</option>
              <option value="calculator">Calculator</option>
              <option value="table">Table</option>
              <option value="dataset">Dataset</option>
              <option value="benchmark">Benchmark</option>
              <option value="widget">Widget</option>
            </select>
          </div>
          <div className="form-field form-field--wide">
            <label htmlFor="asset-title">Title</label>
            <input
              id="asset-title"
              name="title"
              placeholder="A clear, specific title"
              defaultValue={opportunityTopic ?? undefined}
              minLength={3}
              maxLength={160}
              required
              type="text"
            />
          </div>
          <div className="form-field form-field--wide">
            <label htmlFor="asset-description">Short description</label>
            <textarea
              id="asset-description"
              name="description"
              minLength={20}
              maxLength={2000}
              placeholder="What does this asset show or calculate?"
              defaultValue={
                opportunityTopic
                  ? `A useful asset for publishers searching for “${opportunityTopic}”.`
                  : undefined
              }
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="embed-url">Embed URL</label>
            <input id="embed-url" name="embed_url" placeholder="https://…" required type="url" />
            <p className="form-hint">Paste only the iframe source URL, never iframe HTML.</p>
          </div>
          <div className="form-field">
            <label htmlFor="preview-url">Preview image URL</label>
            <input
              id="preview-url"
              name="preview_url"
              placeholder="https://…/preview.png"
              required
              type="url"
            />
            <p className="form-hint">Direct public HTTPS image shown on the asset page.</p>
          </div>
        </div>
      </section>

      {opportunityTopic ? (
        <div className="notice submission-topic-notice">
          <strong>Demand topic:</strong> {opportunityTopic}. This is a publisher signal to consider;
          review and edit the title, description and rights before submitting.
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="source-details-heading">
        <div className="form-section__heading">
          <span>02</span>
          <div>
            <h2 id="source-details-heading">Source and attribution</h2>
            <p>These details remain visible to publishers.</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="source-name">Source or brand name</label>
            <input
              id="source-name"
              maxLength={120}
              minLength={2}
              name="attribution_name"
              required
              type="text"
            />
            <p className="form-hint">
              Used as visible link text. Enter a real source or brand, not SEO keywords.
            </p>
          </div>
          <div className="form-field">
            <label htmlFor="attribution-url">Attribution URL</label>
            <input
              id="attribution-url"
              name="attribution_url"
              placeholder="https://…"
              required
              type="url"
            />
          </div>
          <div className="form-field form-field--wide">
            <label htmlFor="attribution-terms">Attribution terms</label>
            <input
              id="attribution-terms"
              name="attribution_terms"
              placeholder="Credit Example Source — CC BY 4.0"
              minLength={2}
              maxLength={1000}
              required
              type="text"
            />
            <p className="form-hint">Shown to publishers exactly as reviewed.</p>
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="rights-declaration-heading">
        <div className="form-section__heading">
          <span>03</span>
          <div>
            <h2 id="rights-declaration-heading">Usage rights</h2>
            <p>Declare each condition separately. Evidence will be reviewed.</p>
          </div>
        </div>
        <fieldset className="rights-declaration">
          <legend className="sr-only">Declared usage rights</legend>
          <label>
            <input name="commercial_use" type="checkbox" />
            <span>Commercial use allowed</span>
          </label>
          <label>
            <input name="embed_allowed" type="checkbox" />
            <span>Embedding allowed</span>
          </label>
          <label>
            <input name="modification_allowed" type="checkbox" />
            <span>Modification allowed</span>
          </label>
          <label>
            <input name="citation_required" type="checkbox" />
            <span>Citation required</span>
          </label>
        </fieldset>
      </section>

      <input name="opportunity_topic" type="hidden" value={opportunityTopic ?? ""} />

      <div className="submission-form__footer">
        <label className="attestation">
          <input name="authorized_to_submit" required type="checkbox" />
          <span>
            I am authorized to submit this asset and have described its usage terms accurately.
          </span>
        </label>
        {status ? (
          <div
            className={`notice${status.tone === "error" ? " notice--error" : ""}`}
            role={status.tone === "error" ? "alert" : "status"}
          >
            {status.text}
          </div>
        ) : null}
        <button className="button button--primary" disabled={submitting} type="submit">
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
