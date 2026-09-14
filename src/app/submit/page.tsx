import type { Metadata } from "next";
import { headers } from "next/headers";

import { SubmissionForm } from "@/components/submission-form";
import { csrfTokenForRequest, getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";
import { normalizeDemandQuery } from "@/lib/search/normalize-demand-query";

export const metadata: Metadata = {
  title: "Submit an asset",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SubmitPageProps = {
  searchParams: Promise<{ topic?: string }>;
};

export default async function SubmitPage({ searchParams }: SubmitPageProps) {
  const params = await searchParams;
  const auth = await loadAuth();
  const opportunityTopic = parseOpportunityTopic(params.topic);

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

      {!auth.profile ? (
        <section className="creator-auth-card" aria-labelledby="submit-sign-in-heading">
          <p className="eyebrow">Creator access</p>
          <h2 id="submit-sign-in-heading">Sign in to submit</h2>
          <p>Sign in with GitHub first. Publishers can browse without an account.</p>
          <a className="button button--primary" href="/api/auth/github">
            Continue with GitHub
          </a>
        </section>
      ) : auth.csrfToken ? (
        <div className="submission-layout">
          <SubmissionForm csrfToken={auth.csrfToken} opportunityTopic={opportunityTopic} />
          <aside className="submission-aside">
            <div className="notice">
              <strong>Manual review.</strong> Submissions stay pending until the source, embed and
              declared rights are checked.
            </div>
            <div className="submission-aside__section">
              <h2>What happens next</h2>
              <ol>
                <li>Your source and metadata are reviewed.</li>
                <li>Reuse claims are checked against evidence.</li>
                <li>Approved assets join the publisher search index.</li>
              </ol>
            </div>
            <div className="submission-aside__section">
              <h2>Not accepted in V1</h2>
              <p>Arbitrary scripts, uploaded JavaScript, raw HTML and server-side URL fetching.</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="notice" role="alert">
          Submission security is not configured yet.
        </div>
      )}
    </main>
  );
}

function parseOpportunityTopic(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeDemandQuery(value);
  return normalized.aggregation_eligible ? normalized.display_query : null;
}

async function loadAuth() {
  try {
    const requestHeaders = await headers();
    const request = new Request("https://internal.invalid/submit", { headers: requestHeaders });
    const profile = await getAuthenticatedProfile(request, getDatabase());
    return { profile, csrfToken: profile ? await csrfTokenForRequest(request) : null };
  } catch {
    return { profile: null, csrfToken: null };
  }
}
