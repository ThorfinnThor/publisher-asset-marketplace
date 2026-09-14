import type { Metadata } from "next";
import { headers } from "next/headers";

import { getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creator dashboard",
  robots: { index: false, follow: false },
};

type CreatorDashboardProps = {
  searchParams: Promise<{ auth?: string }>;
};

export default async function CreatorDashboardPage({ searchParams }: CreatorDashboardProps) {
  const params = await searchParams;
  const profile = await loadProfile();

  if (!profile) {
    return (
      <main className="page-shell dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">For creators</p>
            <h1 className="page-title">Publish useful assets.</h1>
            <p className="page-intro">
              Sign in with GitHub to create your creator profile and prepare assets for review.
            </p>
          </div>
        </header>
        {params.auth === "auth_error" ? (
          <div className="notice dashboard-notice" role="alert">
            <strong>Sign-in did not complete.</strong> Please try again or check the OAuth setup.
          </div>
        ) : null}
        <section className="creator-auth-card" aria-labelledby="creator-sign-in-heading">
          <p className="eyebrow">Creator access</p>
          <h2 id="creator-sign-in-heading">Sign in to continue</h2>
          <p>Your publisher-facing browsing experience remains available without an account.</p>
          <a className="button button--primary" href="/api/auth/github">
            Continue with GitHub
          </a>
          <small>We use your GitHub profile only to identify your creator account.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Creator workspace</p>
          <h1 className="page-title">Welcome, {profile.display_name}.</h1>
          <p className="page-intro">
            Your profile is ready. Submission review and creator analytics open in the next
            marketplace milestones.
          </p>
        </div>
        <form action="/api/auth/sign-out" method="post">
          <button className="button button--secondary" type="submit">
            Sign out
          </button>
        </form>
      </header>

      {params.auth === "signed_in" ? (
        <div className="notice dashboard-notice" role="status">
          <strong>Signed in.</strong> Your creator profile has been created or refreshed.
        </div>
      ) : null}

      <section className="creator-profile-card" aria-labelledby="creator-profile-heading">
        <div>
          <p className="eyebrow">Creator profile</p>
          <h2 id="creator-profile-heading">{profile.display_name}</h2>
          <p>{profile.website_url ?? "No website added yet."}</p>
        </div>
        <span className="profile-role">{profile.role}</span>
      </section>

      <section className="dashboard-table" aria-labelledby="creator-next-heading">
        <div className="dashboard-table__heading">
          <div>
            <h2 id="creator-next-heading">Next steps</h2>
            <p>Creator submissions remain manually reviewed before publication.</p>
          </div>
        </div>
        <div className="creator-next-steps">
          <div>
            <strong>Prepare your asset</strong>
            <span>
              Have a canonical HTTPS URL, approved embed URL and attribution details ready.
            </span>
          </div>
          <div>
            <strong>Submit for review</strong>
            <span>The submission form opens after the security and validation milestone.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

async function loadProfile() {
  try {
    const requestHeaders = await headers();
    return await getAuthenticatedProfile(
      new Request("http://internal.invalid/", { headers: requestHeaders }),
      getDatabase(),
    );
  } catch {
    return null;
  }
}
