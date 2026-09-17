"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";

import { AssetPreview } from "@/components/asset-preview";
import { currentCreatorTermsVersion } from "@/lib/submissions/creator-terms";

type SubmissionInitialValues = {
  canonical_url?: string;
  asset_type?: "chart" | "calculator" | "table" | "dataset" | "benchmark" | "widget";
  title?: string;
  description?: string;
  embed_url?: string;
  preview_url?: string;
  attribution_name?: string;
  attribution_url?: string;
};

type SubmissionFormProps = {
  csrfToken: string;
  opportunityTopic?: string | null;
  initialValues?: SubmissionInitialValues;
  scanId?: string;
};

type SubmissionResponse = {
  error?: string;
  auto_publish?: boolean;
  asset_slug?: string;
  pre_screen?: {
    status: "pass" | "review";
    checks?: Array<{ status: "pass" | "review"; message: string }>;
  };
};

type PublishedAsset = {
  assetType: string;
  previewUrl: string;
  slug: string;
  title: string;
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
          <p>
            Prepare these details before submitting.{" "}
            <Link href="/creator/guide">Read the creator guide</Link> for copy-ready embed and
            rights examples.
          </p>
        </div>
      </div>
      <ul className="requirements-list">
        <li>Public canonical HTTPS URL.</li>
        <li>Type: chart, calculator, table, dataset, benchmark, or widget.</li>
        <li>Title: 3–160 characters.</li>
        <li>Description: 20–2,000 characters.</li>
        <li>Public HTTPS embed URL—the URL inside an iframe, not raw iframe HTML.</li>
        <li>
          The embed must remain interactive with <code>sandbox=&quot;allow-scripts&quot;</code>{" "}
          only, without cookies, browser storage, forms, popups, downloads, or same-origin access.
        </li>
        <li>
          Preview image: upload a PNG/JPG/WebP here, or provide a direct public HTTPS image URL.
        </li>
        <li>Real source or brand name—not SEO keywords.</li>
        <li>
          Public HTTPS attribution URL and clear terms, such as Credit Example Source — CC BY 4.0.
        </li>
        <li>
          Commercial use and embedding must be allowed for publication. Modification and citation
          requirements must be declared accurately.
        </li>
        <li>Confirmation that you are authorized to submit the asset.</li>
        <li>
          Acknowledgement that the marketplace is commercially operated and may list and promote the
          asset without taking ownership of the tool, source code, or data.
        </li>
        <li>Acceptance of the current versioned Creator Terms.</li>
        <li>Maximum 10 submissions per GitHub account within 24 hours.</li>
        <li>The canonical URL must not already exist in the marketplace or another submission.</li>
      </ul>
      <p className="requirements-exclusion">
        Not accepted: raw HTML, uploaded JavaScript, arbitrary scripts, private/internal URLs, or
        URLs containing credentials.
      </p>
      <p className="requirements-exclusion">
        Submissions that pass every automated check are published immediately. Failed checks must be
        corrected before the asset can be submitted.
      </p>
    </section>
  );
}

export function SubmissionForm({
  csrfToken,
  opportunityTopic = null,
  initialValues,
  scanId,
}: SubmissionFormProps) {
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(initialValues?.preview_url ?? "");
  const [embedTest, setEmbedTest] = useState<{ url: string; loaded: boolean } | null>(null);
  const [publishedAsset, setPublishedAsset] = useState<PublishedAsset | null>(null);

  function testEmbed(event: MouseEvent<HTMLButtonElement>) {
    const field = event.currentTarget.form?.elements.namedItem("embed_url");
    const value = field instanceof HTMLInputElement ? field.value.trim() : "";
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        !url.hostname ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        url.port.length > 0
      ) {
        throw new Error("invalid embed URL");
      }
      setStatus(null);
      setEmbedTest({ url: value, loaded: false });
    } catch {
      setEmbedTest(null);
      setStatus({ tone: "error", text: "Enter a public HTTPS embed URL before testing it." });
    }
  }

  async function uploadPreview(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingPreview(true);
    setStatus(null);
    const body = new FormData();
    body.set("csrf_token", csrfToken);
    body.set("file", file);
    try {
      const response = await fetch("/api/submission-previews/upload", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      const result = (await response.json().catch(() => null)) as {
        preview_url?: string;
        error?: string;
      } | null;
      if (!response.ok || !result?.preview_url) {
        setStatus({
          tone: "error",
          text: result?.error ?? "The preview image could not be uploaded.",
        });
        return;
      }
      setPreviewUrl(result.preview_url);
      setStatus({ tone: "success", text: "Preview uploaded and attached to this submission." });
    } catch {
      setStatus({ tone: "error", text: "The preview image could not be uploaded." });
    } finally {
      setUploadingPreview(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const embedUrl = String(data.get("embed_url") ?? "").trim();
    if (!embedTest?.loaded || embedTest.url !== embedUrl) {
      setSubmitting(false);
      setStatus({
        tone: "error",
        text: "Run the sandbox test again for the current embed URL before submitting.",
      });
      return;
    }
    try {
      const response = await fetch(
        scanId ? `/api/url-scans/${encodeURIComponent(scanId)}/convert` : "/api/submissions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            csrf_token: csrfToken,
            canonical_url: data.get("canonical_url"),
            asset_type: data.get("asset_type"),
            title: data.get("title"),
            description: data.get("description"),
            embed_url: embedUrl,
            preview_url: String(data.get("preview_url") ?? "").trim() || null,
            attribution_name: data.get("attribution_name"),
            attribution_url: data.get("attribution_url"),
            attribution_terms: data.get("attribution_terms"),
            commercial_use: data.get("commercial_use") === "on",
            embed_allowed: data.get("embed_allowed") === "on",
            modification_allowed: data.get("modification_allowed") === "on",
            citation_required: data.get("citation_required") === "on",
            sandbox_compatible: data.get("sandbox_compatible") === "on",
            source_identity_confirmed: data.get("source_identity_confirmed") === "on",
            attribution_confirmed: data.get("attribution_confirmed") === "on",
            preview_display_authorized: data.get("preview_display_authorized") === "on",
            authorized_to_submit: data.get("authorized_to_submit") === "on",
            commercial_marketplace_acknowledged:
              data.get("commercial_marketplace_acknowledged") === "on",
            creator_terms_accepted: data.get("creator_terms_accepted") === "on",
            opportunity_topic: String(data.get("opportunity_topic") ?? "").trim() || null,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as SubmissionResponse | null;
      if (!response.ok) {
        const failedChecks = result?.pre_screen?.checks
          ?.filter((check) => check.status === "review")
          .map((check) => check.message);
        setStatus({
          tone: "error",
          text:
            failedChecks && failedChecks.length > 0
              ? `Automatic publication blocked: ${failedChecks.join(" ")}`
              : (result?.error ?? "The submission could not be saved."),
        });
        return;
      }
      const submittedTitle = String(data.get("title") ?? "Published asset").trim();
      const submittedAssetType = String(data.get("asset_type") ?? "widget");
      const submittedPreviewUrl = String(data.get("preview_url") ?? "").trim();
      form.reset();
      setPreviewUrl("");
      setEmbedTest(null);
      if (result?.auto_publish && result.asset_slug) {
        setPublishedAsset({
          assetType: submittedAssetType,
          previewUrl: submittedPreviewUrl,
          slug: result.asset_slug,
          title: submittedTitle,
        });
        setStatus(null);
      } else {
        setStatus({
          tone: "success",
          text: "The submission was saved but could not be published automatically.",
        });
      }
    } catch {
      setStatus({ tone: "error", text: "The submission could not be reached. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (publishedAsset) {
    return (
      <section className="submission-success" aria-labelledby="submission-success-heading">
        <div className="submission-success__preview">
          <AssetPreview
            previewUrl={publishedAsset.previewUrl}
            title={publishedAsset.title}
            variant={previewVariant(publishedAsset.assetType)}
          />
        </div>
        <div className="submission-success__body">
          <span className="submission-success__mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">Published successfully</p>
          <h2 id="submission-success-heading">Your asset is live.</h2>
          <p>
            All automated checks passed. Publishers can now find, preview and reuse{" "}
            <strong>{publishedAsset.title}</strong>.
          </p>
          <div className="submission-success__actions">
            <Link className="button button--primary" href={`/asset/${publishedAsset.slug}`}>
              View published asset
            </Link>
            <Link className="button button--secondary" href="/creator/dashboard">
              Open creator dashboard
            </Link>
            <button
              className="button button--text"
              onClick={() => setPublishedAsset(null)}
              type="button"
            >
              Publish another asset
            </button>
          </div>
        </div>
      </section>
    );
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
              defaultValue={initialValues?.canonical_url}
              required
              type="url"
            />
            <p className="form-hint">Public HTTPS only. The marketplace does not fetch this URL.</p>
          </div>
          <div className="form-field">
            <label htmlFor="asset-type">Asset type</label>
            <select
              defaultValue={initialValues?.asset_type ?? ""}
              id="asset-type"
              name="asset_type"
              required
            >
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
              defaultValue={initialValues?.title ?? opportunityTopic ?? undefined}
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
                initialValues?.description ??
                (opportunityTopic
                  ? `A useful asset for publishers searching for “${opportunityTopic}”.`
                  : undefined)
              }
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="embed-url">Embed URL</label>
            <input
              id="embed-url"
              name="embed_url"
              onChange={() => setEmbedTest(null)}
              placeholder="https://…"
              defaultValue={initialValues?.embed_url}
              required
              type="url"
            />
            <p className="form-hint">Paste only the iframe source URL, never iframe HTML.</p>
          </div>
          <div className="form-field">
            <label htmlFor="preview-file">Preview image</label>
            <input
              id="preview-file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadPreview}
              type="file"
            />
            <p className="form-hint">
              Upload a PNG, JPG or WebP (max 2 MB). It is stored securely and attached
              automatically.
            </p>
            <label htmlFor="preview-url">Or use a public image URL</label>
            <input
              id="preview-url"
              name="preview_url"
              onChange={(event) => setPreviewUrl(event.target.value)}
              placeholder="https://…/preview.png"
              value={previewUrl}
              required
              type="url"
            />
            <p className="form-hint">The image must show real data and be publicly reachable.</p>
          </div>
        </div>

        <div className="embed-test" aria-labelledby="embed-test-heading">
          <div className="embed-test__heading">
            <div>
              <h3 id="embed-test-heading">Sandbox compatibility test</h3>
              <p>
                Load the embed with the exact marketplace restrictions, then use its primary
                controls and confirm that calculation or interaction still works.
              </p>
            </div>
            <button className="button button--secondary" onClick={testEmbed} type="button">
              Test embed
            </button>
          </div>
          {embedTest ? (
            <div className="embed-test__frame-wrap">
              <iframe
                key={embedTest.url}
                className="embed-test__frame"
                loading="eager"
                onLoad={() =>
                  setEmbedTest((current) =>
                    current?.url === embedTest.url ? { ...current, loaded: true } : current,
                  )
                }
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts"
                src={embedTest.url}
                title="Submitted embed sandbox test"
              />
            </div>
          ) : (
            <p className="embed-test__empty">Enter the embed URL and select Test embed.</p>
          )}
          <label className="attestation embed-test__attestation">
            <input
              disabled={!embedTest?.loaded}
              name="sandbox_compatible"
              required
              type="checkbox"
            />
            <span>
              I tested the current embed above. It remains usable with scripts only and does not
              require cookies, localStorage, sessionStorage, IndexedDB, forms, popups, downloads,
              authentication, or same-origin access.
            </span>
          </label>
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
              defaultValue={initialValues?.attribution_name}
              required
              type="text"
            />
            <p className="form-hint">
              Used as visible link text. Enter a real source or brand, not SEO keywords.
            </p>
          </div>
          <div className="form-field">
            <label htmlFor="attribution-url">Attribution and rights URL</label>
            <input
              id="attribution-url"
              name="attribution_url"
              placeholder="https://…"
              defaultValue={initialValues?.attribution_url}
              required
              type="url"
            />
            <p className="form-hint">
              Public page identifying the source and supporting the declared reuse terms.
            </p>
          </div>
          <div className="form-field form-field--wide">
            <label htmlFor="attribution-terms">Attribution terms</label>
            <input
              aria-describedby="attribution-terms-hint attribution-terms-meaning"
              id="attribution-terms"
              name="attribution_terms"
              placeholder="Credit PassendPlanen — commercial use and embedding permitted with attribution"
              minLength={2}
              maxLength={1000}
              required
              type="text"
            />
            <p className="form-hint" id="attribution-terms-hint">
              Suggestion:{" "}
              <code>
                Credit Your Brand — commercial use and embedding permitted with attribution
              </code>
            </p>
            <p className="form-hint" id="attribution-terms-meaning">
              This is the exact credit line publishers will see and copy. Replace “Your Brand” and
              only claim permissions that your public attribution page actually grants. This line
              explains the credit requirement; it does not create a licence by itself.
            </p>
          </div>
        </div>
      </section>

      <section className="form-section" aria-labelledby="rights-declaration-heading">
        <div className="form-section__heading">
          <span>03</span>
          <div>
            <h2 id="rights-declaration-heading">Usage rights</h2>
            <p>
              Commercial use and embedding are required for this publisher marketplace. Modification
              and citation remain your choice.
            </p>
          </div>
        </div>
        <fieldset className="rights-declaration">
          <legend className="sr-only">Declared usage rights</legend>
          <label>
            <input name="commercial_use" required type="checkbox" />
            <span>
              Commercial use allowed <small>Required</small>
            </span>
          </label>
          <label>
            <input name="embed_allowed" required type="checkbox" />
            <span>
              Embedding allowed <small>Required</small>
            </span>
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
          <input name="source_identity_confirmed" required type="checkbox" />
          <span>I confirm that the source or brand identity above is accurate.</span>
        </label>
        <label className="attestation">
          <input name="attribution_confirmed" required type="checkbox" />
          <span>I confirm that the attribution URL and terms apply to this exact asset.</span>
        </label>
        <label className="attestation">
          <input name="preview_display_authorized" required type="checkbox" />
          <span>I authorize the marketplace to display the submitted preview image.</span>
        </label>
        <label className="attestation">
          <input name="authorized_to_submit" required type="checkbox" />
          <span>
            I am authorized to submit this asset and have described its usage terms accurately. I
            understand that these declarations are used for automatic publication and that false
            declarations may result in removal and account suspension.
          </span>
        </label>
        <label className="attestation">
          <input name="commercial_marketplace_acknowledged" required type="checkbox" />
          <span>
            I understand that Publisher Asset Marketplace is a commercial service that may earn
            revenue, including through fees, subscriptions, advertising, or similar business models.
            I agree that this asset may be listed, described, and promoted within that commercial
            marketplace. I retain ownership of my tool, source code, and data; this acknowledgement
            grants no rights beyond those needed for the submitted listing, preview, attribution,
            and embed availability.
          </span>
        </label>
        <label className="attestation">
          <input name="creator_terms_accepted" required type="checkbox" />
          <span>
            I have read and accept the{" "}
            <Link href="/creator/terms" rel="noreferrer" target="_blank">
              Creator Terms, version {currentCreatorTermsVersion}
            </Link>
            .
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
        <button
          className="button button--primary"
          disabled={submitting || uploadingPreview}
          type="submit"
        >
          {submitting
            ? "Submitting…"
            : uploadingPreview
              ? "Uploading preview…"
              : "Run checks and publish"}
        </button>
      </div>
    </form>
  );
}

function previewVariant(assetType: string): "line" | "bars" | "steps" {
  if (assetType === "calculator" || assetType === "benchmark") return "steps";
  if (assetType === "dataset" || assetType === "table") return "bars";
  return "line";
}
