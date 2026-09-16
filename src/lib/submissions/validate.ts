import { normalizeDemandQuery } from "../search/normalize-demand-query";

const submissionKeys = new Set([
  "canonical_url",
  "asset_type",
  "title",
  "description",
  "embed_url",
  "preview_url",
  "attribution_name",
  "attribution_url",
  "attribution_terms",
  "commercial_use",
  "embed_allowed",
  "modification_allowed",
  "citation_required",
  "sandbox_compatible",
  "source_identity_confirmed",
  "attribution_confirmed",
  "preview_display_authorized",
  "authorized_to_submit",
  "opportunity_topic",
]);

const assetTypes = new Set(["chart", "calculator", "table", "dataset", "benchmark", "widget"]);

export type ValidatedSubmission = {
  canonicalUrl: string;
  embedUrl: string;
  previewUrl: string;
  assetType: "chart" | "calculator" | "table" | "dataset" | "benchmark" | "widget";
  title: string;
  description: string;
  attributionName: string;
  attributionUrl: string;
  attributionTerms: string;
  rights: {
    schema_version: 1;
    embed_allowed: boolean;
    commercial_use: boolean;
    modification_allowed: boolean;
    citation_required: boolean;
    sandbox_compatible: true;
    sandbox_profile: "v1:allow-scripts";
    attribution_required: true;
    attribution_terms: string;
    source_identity_confirmed: true;
    attribution_confirmed: true;
    preview_display_authorized: true;
    submitter_authorized: true;
  };
  opportunityTopic: string | null;
};

export type SubmissionValidationResult =
  { ok: true; value: ValidatedSubmission } | { ok: false; code: string; field?: string };

export function validateSubmissionPayload(input: unknown): SubmissionValidationResult {
  if (!isRecord(input)) return { ok: false, code: "invalid_payload" };
  for (const key of Object.keys(input)) {
    if (!submissionKeys.has(key)) return { ok: false, code: "unknown_field", field: key };
  }

  const canonicalUrl = normalizePublicHttpsUrl(input.canonical_url);
  if (!canonicalUrl.ok) return { ...canonicalUrl, field: "canonical_url" };
  const embedUrl = normalizePublicHttpsUrl(input.embed_url);
  if (!embedUrl.ok) return { ...embedUrl, field: "embed_url" };
  if (input.preview_url === null || input.preview_url === undefined || input.preview_url === "") {
    return { ok: false, code: "preview_required", field: "preview_url" };
  }
  const previewUrl = normalizePublicHttpsUrl(input.preview_url);
  if (!previewUrl.ok) return { ...previewUrl, field: "preview_url" };

  if (typeof input.asset_type !== "string" || !assetTypes.has(input.asset_type)) {
    return { ok: false, code: "invalid_asset_type", field: "asset_type" };
  }

  const title = normalizeText(input.title, 3, 160);
  if (!title.ok) return { ...title, field: "title" };
  const description = normalizeText(input.description, 20, 2_000);
  if (!description.ok) return { ...description, field: "description" };
  const attributionName = normalizeText(input.attribution_name, 2, 120);
  if (!attributionName.ok) return { ...attributionName, field: "attribution_name" };
  const attributionTerms = normalizeText(input.attribution_terms, 2, 1_000);
  if (!attributionTerms.ok) return { ...attributionTerms, field: "attribution_terms" };

  const textFields = [
    ["title", title.value],
    ["description", description.value],
    ["attribution_name", attributionName.value],
    ["attribution_terms", attributionTerms.value],
  ] as const;
  const markupField = textFields.find(([, value]) => containsHtmlMarkup(value));
  if (markupField) return { ok: false, code: "raw_html_not_allowed", field: markupField[0] };

  const attributionUrl = normalizePublicHttpsUrl(input.attribution_url);
  if (!attributionUrl.ok) return { ...attributionUrl, field: "attribution_url" };

  let opportunityTopic: string | null = null;
  if (input.opportunity_topic !== null && input.opportunity_topic !== undefined) {
    if (typeof input.opportunity_topic !== "string") {
      return { ok: false, code: "invalid_opportunity_topic", field: "opportunity_topic" };
    }
    const normalizedTopic = normalizeDemandQuery(input.opportunity_topic);
    if (!normalizedTopic.aggregation_eligible || !normalizedTopic.display_query) {
      return { ok: false, code: "invalid_opportunity_topic", field: "opportunity_topic" };
    }
    opportunityTopic = normalizedTopic.display_query;
  }

  const rightsFields = [
    "commercial_use",
    "embed_allowed",
    "modification_allowed",
    "citation_required",
  ] as const;
  for (const field of rightsFields) {
    if (typeof input[field] !== "boolean") return { ok: false, code: "boolean_required", field };
  }
  if (input.sandbox_compatible !== true) {
    return {
      ok: false,
      code: "sandbox_compatibility_required",
      field: "sandbox_compatible",
    };
  }
  if (input.source_identity_confirmed !== true) {
    return {
      ok: false,
      code: "source_identity_confirmation_required",
      field: "source_identity_confirmed",
    };
  }
  if (input.attribution_confirmed !== true) {
    return {
      ok: false,
      code: "attribution_confirmation_required",
      field: "attribution_confirmed",
    };
  }
  if (input.preview_display_authorized !== true) {
    return {
      ok: false,
      code: "preview_display_authorization_required",
      field: "preview_display_authorized",
    };
  }
  if (input.authorized_to_submit !== true) {
    return { ok: false, code: "authorization_required", field: "authorized_to_submit" };
  }

  return {
    ok: true,
    value: {
      canonicalUrl: canonicalUrl.value,
      embedUrl: embedUrl.value,
      previewUrl: previewUrl.value,
      assetType: input.asset_type as ValidatedSubmission["assetType"],
      title: title.value,
      description: description.value,
      attributionName: attributionName.value,
      attributionUrl: attributionUrl.value,
      attributionTerms: attributionTerms.value,
      rights: {
        schema_version: 1,
        embed_allowed: input.embed_allowed as boolean,
        commercial_use: input.commercial_use as boolean,
        modification_allowed: input.modification_allowed as boolean,
        citation_required: input.citation_required as boolean,
        sandbox_compatible: true,
        sandbox_profile: "v1:allow-scripts",
        attribution_required: true,
        attribution_terms: attributionTerms.value,
        source_identity_confirmed: true,
        attribution_confirmed: true,
        preview_display_authorized: true,
        submitter_authorized: true,
      },
      opportunityTopic,
    },
  };
}

export function normalizePublicHttpsUrl(
  input: unknown,
): { ok: true; value: string } | { ok: false; code: string } {
  if (typeof input !== "string") return { ok: false, code: "url_required" };
  const value = input.normalize("NFC").trim();
  if (value.length === 0) return { ok: false, code: "url_required" };
  if (value.length > 2_048) return { ok: false, code: "url_too_long" };
  if (/\s|\\/.test(value)) return { ok: false, code: "url_contains_whitespace" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, code: "invalid_url" };
  }
  if (url.protocol !== "https:") return { ok: false, code: "scheme_not_https" };
  if (!url.hostname || url.username || url.password) {
    return {
      ok: false,
      code: url.username || url.password ? "credentials_not_allowed" : "host_required",
    };
  }
  if (url.port) return { ok: false, code: "port_not_allowed" };

  const hostname = url.hostname.toLowerCase();
  if (isBlockedHost(hostname)) return { ok: false, code: "host_not_public" };
  url.hash = "";
  return { ok: true, value: url.toString() };
}

function normalizeText(
  input: unknown,
  minimum: number,
  maximum: number,
): { ok: true; value: string } | { ok: false; code: string } {
  if (typeof input !== "string") return { ok: false, code: "text_required" };
  const value = input.normalize("NFC").trim();
  if (/[\u0000-\u001F\u007F-\u009F]/.test(value)) {
    return { ok: false, code: "control_character" };
  }
  if (value.length < minimum) return { ok: false, code: "text_too_short" };
  if (value.length > maximum) return { ok: false, code: "text_too_long" };
  return { ok: true, value };
}

function containsHtmlMarkup(value: string): boolean {
  return /<\s*\/?\s*[a-z][^>]*>/iu.test(value);
}

function isBlockedHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".lan") ||
    hostname === "metadata.google.internal" ||
    (!hostname.includes(".") && !hostname.startsWith("["))
  ) {
    return true;
  }

  if (hostname.startsWith("[")) return isBlockedIpv6(hostname);
  if (isIpv4Literal(hostname)) return isBlockedIpv4(hostname);
  return false;
}

function isIpv4Literal(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return true;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && parts[2] === 100) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const segments = parseIpv6(hostname.slice(1, -1));
  if (!segments) return true;
  if (segments.slice(0, 5).every((value) => value === 0) && segments[5] === 0xffff) {
    const mapped = ((segments[6] << 16) | segments[7]) >>> 0;
    return isBlockedIpv4(
      `${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`,
    );
  }
  const first = segments[0];
  return (
    segments.every((value) => value === 0) ||
    (segments.slice(0, 7).every((value) => value === 0) && segments[7] === 1) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (segments[0] === 0x2001 && segments[1] === 0x0db8) ||
    (segments[0] === 0x2001 && segments[1] === 0) ||
    (segments[0] === 0x2001 && segments[1] === 2) ||
    (segments[0] === 0x2001 && (segments[1] & 0xfff0) === 0x0010)
  );
}

function parseIpv6(value: string): number[] | null {
  if (!value.includes(":")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const pieces = part.split(":");
    const result: number[] = [];
    for (const piece of pieces) {
      if (piece.includes(".")) {
        if (!isIpv4Literal(piece)) return null;
        const octets = piece.split(".").map(Number);
        result.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else if (/^[0-9a-fA-F]{1,4}$/.test(piece)) {
        result.push(Number.parseInt(piece, 16));
      } else {
        return null;
      }
    }
    return result;
  };
  const left = parsePart(halves[0]);
  const right = parsePart(halves[1] ?? "");
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  if (left.length + right.length >= 8) return null;
  return [...left, ...new Array(8 - left.length - right.length).fill(0), ...right];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
