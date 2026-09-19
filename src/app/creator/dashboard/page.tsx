import type { Metadata } from "next";
import { headers } from "next/headers";

import { AssetPreview } from "@/components/asset-preview";
import { AuthOptions } from "@/components/auth-options";
import { DeleteCreatorAssetButton } from "@/components/delete-creator-asset-button";
import { MagicLinkForm } from "@/components/magic-link-form";
import {
  getCreatorDashboard,
  type CreatorAssetAnalytics,
  type CreatorDashboardData,
} from "@/lib/analytics/creator-dashboard";
import { csrfTokenForRequest, getAuthenticatedProfile } from "@/lib/auth/github";
import { googleAuthIsConfigured } from "@/lib/auth/google";
import { magicLinkAuthIsConfigured } from "@/lib/auth/magic-link";
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
  const { profile, csrfToken } = await loadAuthContext();

  if (!profile) {
    return (
      <main className="page-shell dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">For creators</p>
            <h1 className="page-title">Publish useful assets.</h1>
            <p className="page-intro">
              Sign in to create your creator profile and publish assets after automated checks.
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
          <AuthOptions context="create and manage assets" />
        </section>
      </main>
    );
  }

  const analytics = await loadCreatorDashboard(profile.id);

  return (
    <main className="page-shell dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Creator workspace</p>
          <h1 className="page-title">Welcome, {profile.display_name}.</h1>
          <p className="page-intro">
            Your profile is ready. Submit a useful asset for automated checks and publication.
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
      {params.auth === "linked" ? (
        <div className="notice dashboard-notice" role="status">
          <strong>Sign-in method linked.</strong> You can now use it for this creator profile.
        </div>
      ) : null}
      {params.auth === "link_error" ? (
        <div className="notice notice--error dashboard-notice" role="alert">
          <strong>Sign-in method could not be linked.</strong> It may already belong to another
          creator profile.
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

      <CreatorAuthMethods profileId={profile.id} />

      <CreatorAnalyticsSection csrfToken={csrfToken ?? ""} data={analytics} />

      <section className="dashboard-table" aria-labelledby="creator-next-heading">
        <div className="dashboard-table__heading">
          <div>
            <h2 id="creator-next-heading">Next steps</h2>
            <p>Creator submissions publish immediately after every automated check passes.</p>
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
            <strong>Run checks and publish</strong>
            <span>
              Failed checks are returned for correction; passing assets publish immediately.
            </span>
            <a className="text-link" href="/submit">
              Open submission form
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

async function CreatorAuthMethods({ profileId }: { profileId: string }) {
  const identities = await loadAuthIdentities(profileId);
  const providers = new Set(identities.map((identity) => identity.provider));
  return (
    <section className="creator-auth-methods" aria-labelledby="creator-auth-methods-heading">
      <div>
        <p className="eyebrow">Account security</p>
        <h2 id="creator-auth-methods-heading">Sign-in methods</h2>
        <p>
          Link another method to this profile. Existing profiles are never merged automatically.
        </p>
      </div>
      <ul className="creator-auth-methods__list">
        {(["github", "google", "email"] as const).map((provider) => (
          <li key={provider}>
            <div>
              <strong>{providerLabel(provider)}</strong>
              <span>{providers.has(provider) ? "Linked to this profile" : "Not linked"}</span>
            </div>
            {provider === "google" && !providers.has("google") && googleAuthIsConfigured() ? (
              <a
                className="button button--secondary button--small"
                href="/api/auth/google?mode=link"
              >
                Link Google
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {magicLinkAuthIsConfigured() && !providers.has("email") ? (
        <MagicLinkForm mode="link" />
      ) : null}
    </section>
  );
}

async function loadAuthIdentities(profileId: string): Promise<ProviderIdentityRow[]> {
  try {
    return await getDatabase()
      .prepare(
        `
          SELECT provider, email_normalized, email_verified
          FROM auth_identities
          WHERE profile_id = ?
          ORDER BY provider
        `,
      )
      .bind(profileId)
      .all<ProviderIdentityRow>()
      .then((result) => result.results);
  } catch {
    return [];
  }
}

type ProviderIdentityRow = {
  provider: "github" | "google" | "email";
  email_normalized: string | null;
  email_verified: number;
};

function providerLabel(provider: ProviderIdentityRow["provider"]): string {
  if (provider === "github") return "GitHub";
  if (provider === "google") return "Google";
  return "Email magic link";
}

function CreatorAnalyticsSection({
  csrfToken,
  data,
}: {
  csrfToken: string;
  data: CreatorDashboardData | null;
}) {
  if (!data) {
    return (
      <div className="notice dashboard-notice" role="status">
        <strong>Creator analytics temporarily unavailable.</strong> Your published assets remain
        available; try again after the next Worker request.
      </div>
    );
  }

  return (
    <section className="creator-analytics" aria-labelledby="creator-analytics-heading">
      <div className="creator-analytics__heading">
        <div>
          <p className="eyebrow">Publisher signals</p>
          <h2 id="creator-analytics-heading">Published assets</h2>
          <p>
            Activity from the latest complete 28-day window ({data.window.start} to{" "}
            {data.window.end}) for assets published under your creator profile.
          </p>
        </div>
      </div>
      {data.assets.length === 0 ? (
        <div className="empty-state">
          <strong>No published assets yet.</strong>
          <span>Publish an asset through the automated checks to see publisher signals here.</span>
          <a className="text-link" href="/submit">
            Open submission form
          </a>
        </div>
      ) : (
        <div className="creator-assets-list">
          {data.assets.map((asset) => (
            <CreatorAssetCard key={asset.id} asset={asset} csrfToken={csrfToken} />
          ))}
        </div>
      )}
    </section>
  );
}

function CreatorAssetCard({
  asset,
  csrfToken,
}: {
  asset: CreatorAssetAnalytics;
  csrfToken: string;
}) {
  return (
    <article className="creator-asset-card">
      <header className="creator-asset-card__header">
        <div className="creator-asset-card__summary">
          <a
            aria-label={`Preview ${asset.title}`}
            className="creator-asset-card__preview"
            href={`/asset/${asset.slug}`}
          >
            <AssetPreview
              compact
              previewUrl={asset.preview_url}
              title={asset.title}
              variant={previewVariant(asset.asset_type)}
            />
          </a>
          <div>
            <p className="eyebrow">
              {asset.asset_type} · {asset.status}
            </p>
            <h3>
              <a href={`/asset/${asset.slug}`}>{asset.title}</a>
            </h3>
            <p>/{asset.slug}</p>
          </div>
        </div>
        <div className="creator-asset-card__actions">
          <a className="text-link" href={`/creator/assets/${asset.slug}/edit`}>
            Edit asset
          </a>
          <a className="text-link" href={`/asset/${asset.slug}`}>
            View asset
          </a>
          <DeleteCreatorAssetButton csrfToken={csrfToken} slug={asset.slug} title={asset.title} />
        </div>
      </header>
      <div className="creator-asset-card__metrics" aria-label={`${asset.title} activity metrics`}>
        <Metric label="Search impressions" value={asset.impressions} />
        <Metric label="Detail views" value={asset.detail_views} />
        <Metric label="Embed copies (intent)" value={asset.embed_copies} />
        <Metric label="Embed loads (actual)" value={asset.embed_loads} />
        <Metric label="Publisher sites" value={asset.publisher_sites} />
        <Metric label="Citation copies" value={asset.citation_copies} />
        <Metric label="Source clicks" value={asset.source_clicks} />
      </div>
      <div className="creator-asset-card__discovery">
        <div>
          <strong>Top discovery queries</strong>
          <span>Normalized search wording linked to this asset&apos;s impressions.</span>
        </div>
        {asset.top_discovery_queries.length === 0 ? (
          <p>No discovery query is available in this window.</p>
        ) : (
          <ul>
            {asset.top_discovery_queries.map((query) => (
              <li key={query.query}>
                <span>{query.query}</span>
                <b>{formatInteger(query.impressions)}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="creator-asset-card__note">
        Embed loads count approved iframe requests. Publisher sites count distinct referring
        origins; suppressed referrers still count as loads but not as sites. Copies and source
        clicks remain intent signals, not citations or backlinks.
      </p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{formatInteger(value)}</strong>
    </div>
  );
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

async function loadAuthContext() {
  try {
    const requestHeaders = await headers();
    const request = new Request("http://internal.invalid/", { headers: requestHeaders });
    const [profile, csrfToken] = await Promise.all([
      getAuthenticatedProfile(request, getDatabase()),
      csrfTokenForRequest(request),
    ]);
    return { profile, csrfToken };
  } catch {
    return { profile: null, csrfToken: null };
  }
}

async function loadCreatorDashboard(creatorId: string): Promise<CreatorDashboardData | null> {
  try {
    return await getCreatorDashboard(getDatabase(), creatorId);
  } catch {
    return null;
  }
}

function previewVariant(assetType: string): "line" | "bars" | "steps" {
  if (assetType === "calculator" || assetType === "benchmark") return "steps";
  if (assetType === "dataset" || assetType === "table") return "bars";
  return "line";
}
