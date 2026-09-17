import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { SubmissionForm, type SubmissionInitialValues } from "@/components/submission-form";
import { csrfTokenForRequest, getAuthenticatedProfile } from "@/lib/auth/github";
import { getDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit asset",
  robots: { index: false, follow: false },
};

type EditAssetPageProps = {
  params: Promise<{ slug: string }>;
};

type EditableAssetRow = {
  slug: string;
  canonical_url: string;
  asset_type: SubmissionInitialValues["asset_type"];
  title: string;
  description: string;
  embed_url: string;
  preview_url: string;
  attribution_name: string;
  attribution_url: string;
  attribution_terms: string;
  rights_json: string;
};

export default async function EditAssetPage({ params }: EditAssetPageProps) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9_-]{0,255}$/u.test(slug)) notFound();

  const auth = await loadAuth();
  if (!auth.profile) {
    return (
      <main className="page-shell submission-page">
        <header className="submission-page__header">
          <p className="eyebrow">Creator workspace</p>
          <h1 className="page-title">Edit your asset.</h1>
          <p className="page-intro">Sign in with GitHub to manage your published assets.</p>
        </header>
        <section className="creator-auth-card" aria-labelledby="edit-sign-in-heading">
          <p className="eyebrow">Creator access</p>
          <h2 id="edit-sign-in-heading">Sign in to continue</h2>
          <a className="button button--primary" href="/api/auth/github">
            Continue with GitHub
          </a>
        </section>
      </main>
    );
  }
  if (!auth.csrfToken) {
    return (
      <main className="page-shell submission-page">
        <div className="notice" role="alert">
          Asset editing security is not configured yet.
        </div>
      </main>
    );
  }

  const asset = await loadEditableAsset(slug, auth.profile.id);
  if (!asset) notFound();
  const initialValues = editableInitialValues(asset);

  return (
    <main className="page-shell submission-page">
      <header className="submission-page__header">
        <p className="eyebrow">Creator workspace</p>
        <h1 className="page-title">Edit your asset.</h1>
        <p className="page-intro">
          Update the listing, preview or embed. Every change is checked again before it goes live.
        </p>
      </header>

      <div className="notice dashboard-notice" role="status">
        <strong>The public URL stays the same.</strong> Re-test the embed and reconfirm the rights
        below. Changes become visible immediately after all checks pass.
      </div>

      <div className="submission-layout">
        <SubmissionForm
          assetSlug={asset.slug}
          csrfToken={auth.csrfToken}
          initialValues={initialValues}
          mode="edit"
        />
        <aside className="submission-aside">
          <div className="notice">
            <strong>Safe updates.</strong> Only you can change this asset. Failed checks leave the
            currently published version untouched.
          </div>
          <div className="submission-aside__section">
            <h2>What is checked again</h2>
            <ol>
              <li>Canonical, embed, preview and attribution URLs.</li>
              <li>Commercial reuse and embedding declarations.</li>
              <li>Sandbox compatibility and creator authorization.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

async function loadAuth() {
  try {
    const requestHeaders = await headers();
    const request = new Request("https://internal.invalid/creator/assets/edit", {
      headers: requestHeaders,
    });
    const [profile, csrfToken] = await Promise.all([
      getAuthenticatedProfile(request, getDatabase()),
      csrfTokenForRequest(request),
    ]);
    return { profile, csrfToken };
  } catch {
    return { profile: null, csrfToken: null };
  }
}

async function loadEditableAsset(
  slug: string,
  creatorId: string,
): Promise<EditableAssetRow | null> {
  try {
    return await getDatabase()
      .prepare(
        `
          SELECT slug, canonical_url, asset_type, title, description, embed_url, preview_url,
                 attribution_name, attribution_url, attribution_terms, rights_json
          FROM assets
          WHERE slug = ? AND creator_id = ? AND status = 'published'
          LIMIT 1
        `,
      )
      .bind(slug, creatorId)
      .first<EditableAssetRow>();
  } catch {
    return null;
  }
}

function editableInitialValues(asset: EditableAssetRow): SubmissionInitialValues {
  const rights = parseRights(asset.rights_json);
  return {
    canonical_url: asset.canonical_url,
    asset_type: asset.asset_type,
    title: asset.title,
    description: asset.description,
    embed_url: asset.embed_url,
    preview_url: asset.preview_url,
    attribution_name: asset.attribution_name,
    attribution_url: asset.attribution_url,
    attribution_terms: asset.attribution_terms,
    commercial_use: rights.commercial_use,
    embed_allowed: rights.embed_allowed,
    modification_allowed: rights.modification_allowed,
    citation_required: rights.citation_required,
  };
}

function parseRights(value: string): {
  commercial_use: boolean;
  embed_allowed: boolean;
  modification_allowed: boolean;
  citation_required: boolean;
} {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    const rights = parsed as Record<string, unknown>;
    return {
      commercial_use: rights.commercial_use === true,
      embed_allowed: rights.embed_allowed === true,
      modification_allowed: rights.modification_allowed === true,
      citation_required: rights.citation_required === true,
    };
  } catch {
    return {
      commercial_use: false,
      embed_allowed: false,
      modification_allowed: false,
      citation_required: false,
    };
  }
}
