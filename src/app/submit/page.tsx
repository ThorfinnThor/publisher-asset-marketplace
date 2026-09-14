import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit an asset",
  robots: { index: false, follow: false },
};

export default function SubmitPage() {
  return (
    <main className="page-shell submission-page">
      <header className="submission-page__header">
        <p className="eyebrow">For creators</p>
        <h1 className="page-title">Publish an asset.</h1>
        <p className="page-intro">
          Submit a useful chart, calculator, benchmark or dataset for review. Every asset is checked
          before it can appear in publisher search.
        </p>
      </header>

      <div className="submission-layout">
        <form className="submission-form">
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
                <label htmlFor="asset-url">Asset URL</label>
                <input id="asset-url" placeholder="https://example.com/data-tool" type="url" />
                <p className="form-hint">Use the canonical public page for this asset.</p>
              </div>
              <div className="form-field">
                <label htmlFor="asset-type">Asset type</label>
                <select defaultValue="" id="asset-type">
                  <option disabled value="">
                    Select type
                  </option>
                  <option>Chart</option>
                  <option>Calculator</option>
                  <option>Table</option>
                  <option>Dataset</option>
                  <option>Benchmark</option>
                </select>
              </div>
              <div className="form-field form-field--wide">
                <label htmlFor="asset-title">Title</label>
                <input id="asset-title" placeholder="A clear, specific title" type="text" />
              </div>
              <div className="form-field form-field--wide">
                <label htmlFor="asset-description">Description</label>
                <textarea
                  id="asset-description"
                  placeholder="What does this asset show or calculate?"
                />
              </div>
              <div className="form-field">
                <label htmlFor="embed-url">Embed URL</label>
                <input id="embed-url" placeholder="https://…" type="url" />
              </div>
              <div className="form-field">
                <label htmlFor="preview-url">Preview URL</label>
                <input id="preview-url" placeholder="https://…" type="url" />
              </div>
            </div>
          </section>

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
                <input id="source-name" type="text" />
              </div>
              <div className="form-field">
                <label htmlFor="attribution-url">Attribution URL</label>
                <input id="attribution-url" placeholder="https://…" type="url" />
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
              {[
                "Commercial use allowed",
                "Embedding allowed",
                "Modification allowed",
                "Citation required",
              ].map((right) => (
                <label key={right}>
                  <input type="checkbox" />
                  <span>{right}</span>
                </label>
              ))}
            </fieldset>
          </section>

          <div className="submission-form__footer">
            <label className="attestation">
              <input type="checkbox" />
              <span>
                I am authorized to submit this asset and have described its usage terms accurately.
              </span>
            </label>
            <button className="button" disabled type="button">
              Submissions opening later
            </button>
          </div>
        </form>

        <aside className="submission-aside">
          <div className="notice">
            <strong>Design preview.</strong> Submission processing opens after publisher search and
            moderation are implemented.
          </div>
          <div className="submission-aside__section">
            <h2>What happens next</h2>
            <ol>
              <li>Your source and metadata are reviewed.</li>
              <li>Reuse claims are checked against evidence.</li>
              <li>Approved assets join the same publisher search index.</li>
            </ol>
          </div>
          <div className="submission-aside__section">
            <h2>Not accepted in V1</h2>
            <p>Arbitrary scripts, uploaded JavaScript and unreviewed third-party embeds.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
