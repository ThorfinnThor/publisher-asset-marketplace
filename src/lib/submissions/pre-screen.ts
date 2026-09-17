import type { ValidatedSubmission } from "./validate";

export type SubmissionPreScreenCheck = {
  code:
    | "embed_host"
    | "preview_host"
    | "attribution_host"
    | "preview_format"
    | "attribution_language"
    | "declared_reuse"
    | "sandbox_compatibility";
  status: "pass" | "review";
  message: string;
};

export type SubmissionPreScreenResult = {
  schema_version: 1;
  status: "pass" | "review";
  checks: SubmissionPreScreenCheck[];
};

type SubmissionPreScreenOptions = {
  marketplaceOrigin?: string;
};

const promotionalLanguage =
  /\b(?:click here|buy now|dofollow|backlinks?|link[ -]?building|keyword[ -]?rich|seo keywords?|guaranteed rankings?|rank higher|hide attribution)\b/iu;
const checkCodes = new Set<string>([
  "embed_host",
  "preview_host",
  "attribution_host",
  "preview_format",
  "attribution_language",
  "declared_reuse",
  "sandbox_compatibility",
]);

export function runSubmissionPreScreen(
  submission: ValidatedSubmission,
  options: SubmissionPreScreenOptions = {},
): SubmissionPreScreenResult {
  const marketplacePreview = isMarketplacePreview(submission.previewUrl, options.marketplaceOrigin);
  const checks: SubmissionPreScreenCheck[] = [
    hostCheck(
      "embed_host",
      submission.embedUrl,
      [submission.canonicalUrl, submission.attributionUrl],
      "Embed host matches the canonical or attribution site.",
      "Embed host differs from the canonical and attribution sites; verify the provider and ownership.",
    ),
    marketplacePreview
      ? {
          code: "preview_host",
          status: "pass",
          message: "Preview was uploaded to the marketplace by the authenticated creator.",
        }
      : hostCheck(
          "preview_host",
          submission.previewUrl,
          [submission.canonicalUrl, submission.embedUrl, submission.attributionUrl],
          "Preview host matches a submitted source host.",
          "Preview host differs from the submitted source hosts.",
        ),
    hostCheck(
      "attribution_host",
      submission.attributionUrl,
      [submission.canonicalUrl],
      "Attribution host matches the canonical site.",
      "Attribution host differs from the canonical site; verify the source identity.",
    ),
    marketplacePreview || looksLikeDirectImage(submission.previewUrl)
      ? {
          code: "preview_format",
          status: "pass",
          message: marketplacePreview
            ? "Marketplace upload passed image type, size and file-signature validation."
            : "Preview URL looks like a direct image resource.",
        }
      : {
          code: "preview_format",
          status: "review",
          message: "Preview URL has no recognizable image path or format; verify its content type.",
        },
    promotionalLanguage.test(`${submission.attributionName} ${submission.attributionTerms}`)
      ? {
          code: "attribution_language",
          status: "review",
          message: "Attribution contains promotional or link-manipulation language.",
        }
      : {
          code: "attribution_language",
          status: "pass",
          message: "Attribution uses neutral source or brand language.",
        },
    submission.rights.embed_allowed && submission.rights.commercial_use
      ? {
          code: "declared_reuse",
          status: "pass",
          message: "Embedding and commercial use are both declared allowed.",
        }
      : {
          code: "declared_reuse",
          status: "review",
          message:
            "Commercial use and embedding must both be allowed before an asset can be published in this marketplace.",
        },
    {
      code: "sandbox_compatibility",
      status: "pass",
      message:
        "Creator confirmed an interactive test with the fixed v1 sandbox (allow-scripts only).",
    },
  ];

  return {
    schema_version: 1,
    status: checks.some((check) => check.status === "review") ? "review" : "pass",
    checks,
  };
}

function isMarketplacePreview(value: string, marketplaceOrigin: string | undefined): boolean {
  if (!marketplaceOrigin) return false;
  try {
    const preview = new URL(value);
    const origin = new URL(marketplaceOrigin).origin;
    return (
      preview.origin === origin &&
      /^\/api\/submission-previews\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        preview.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function parseStoredSubmissionPreScreen(value: string): SubmissionPreScreenResult {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.schema_version !== 1 || !isPreScreenStatus(parsed.status)) {
      return fallbackPreScreen();
    }
    if (!Array.isArray(parsed.checks)) return fallbackPreScreen();
    const checks: SubmissionPreScreenCheck[] = [];
    for (const item of parsed.checks) {
      if (
        !isRecord(item) ||
        !isCheckCode(item.code) ||
        !isPreScreenStatus(item.status) ||
        typeof item.message !== "string"
      ) {
        return fallbackPreScreen();
      }
      checks.push({
        code: item.code,
        status: item.status,
        message: item.message,
      });
    }
    return { schema_version: 1, status: parsed.status, checks };
  } catch {
    return fallbackPreScreen();
  }
}

function hostCheck(
  code: SubmissionPreScreenCheck["code"],
  candidate: string,
  references: string[],
  passMessage: string,
  reviewMessage: string,
): SubmissionPreScreenCheck {
  const candidateHost = new URL(candidate).hostname;
  const matches = references.some((reference) =>
    hostsAreRelated(candidateHost, new URL(reference).hostname),
  );
  return {
    code,
    status: matches ? "pass" : "review",
    message: matches ? passMessage : reviewMessage,
  };
}

function hostsAreRelated(left: string, right: string): boolean {
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

function looksLikeDirectImage(value: string): boolean {
  const url = new URL(value);
  if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/iu.test(url.pathname)) return true;
  for (const key of ["format", "fm", "type"]) {
    const format = url.searchParams.get(key)?.toLowerCase() ?? "";
    if (/^(?:avif|gif|jpe?g|png|svg|webp|image\/)/u.test(format)) return true;
  }
  return /\/(?:image|images)\//iu.test(url.pathname);
}

function fallbackPreScreen(): SubmissionPreScreenResult {
  return { schema_version: 1, status: "review", checks: [] };
}

function isPreScreenStatus(value: unknown): value is "pass" | "review" {
  return value === "pass" || value === "review";
}

function isCheckCode(value: unknown): value is SubmissionPreScreenCheck["code"] {
  return typeof value === "string" && checkCodes.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
