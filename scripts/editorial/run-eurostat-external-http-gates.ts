import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import https from "node:https";
import path from "node:path";
import { rootCertificates } from "node:tls";

type Inventory = {
  rights_evidence_contract: {
    source_policy_evidence: { url: string };
  };
  previews: Array<{
    brief_id: string;
    expected_external_id: string;
    source_evidence_url: string;
    source_query: {
      url: string;
      expected_dimensions: Record<string, string[]>;
      period_policy: string;
    };
  }>;
};

type FactPack = {
  scope_note: string;
  source_requests: Array<{
    url: string;
    response_sha256: string;
  }>;
};

type JsonStatDimension = {
  category?: {
    index?: Record<string, number> | string[];
  };
};

type JsonStatResponse = {
  class?: string;
  id?: string[];
  size?: number[];
  label?: string;
  updated?: string;
  value?: unknown[] | Record<string, unknown>;
  status?: unknown[] | Record<string, unknown>;
  dimension?: Record<string, JsonStatDimension>;
};

const root = process.cwd();
const inventory = JSON.parse(
  readFileSync(
    path.join(root, "data/editorial/private-eurostat-external-gate-inventory-v2.2.json"),
    "utf8",
  ),
) as Inventory;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const globalSignRootR46 = execFileSync(
  "security",
  [
    "find-certificate",
    "-a",
    "-c",
    "GlobalSign Root R46",
    "-p",
    "/System/Library/Keychains/SystemRootCertificates.keychain",
  ],
  { encoding: "utf8" },
);
const certificateAuthorities = [...rootCertificates, globalSignRootR46];

const categoryCodes = (dimension: JsonStatDimension | undefined): string[] => {
  const index = dimension?.category?.index;
  if (Array.isArray(index)) return index;
  if (index && typeof index === "object") {
    return Object.entries(index)
      .sort(([, left], [, right]) => left - right)
      .map(([code]) => code);
  }
  return [];
};

type HttpResult = {
  finalUrl: string;
  status: number;
  headers: IncomingHttpHeaders;
  bytes: Uint8Array;
  tlsAuthorized: boolean;
};

const fetchBytes = async (url: string, accept: string, redirectCount = 0): Promise<HttpResult> =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        ca: certificateAuthorities,
        rejectUnauthorized: true,
        headers: {
          Accept: accept,
          "Accept-Encoding": "identity",
          "User-Agent": "CiteSupply editorial read-only gate/1.0 (+https://citesupply.com)",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const tlsSocket = response.socket as typeof response.socket & { authorized?: boolean };
        const tlsAuthorized = tlsSocket?.authorized === true;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          if (redirectCount >= 5) {
            reject(new Error(`Too many redirects while fetching ${url}`));
            return;
          }
          fetchBytes(new URL(location, url).toString(), accept, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            finalUrl: url,
            status,
            headers: response.headers,
            bytes: new Uint8Array(Buffer.concat(chunks)),
            tlsAuthorized,
          });
        });
      },
    );
    request.on("error", reject);
  });

const datasets = [];
for (const preview of inventory.previews) {
  const factPack = JSON.parse(
    readFileSync(path.join(root, "data/editorial/fact-packs", `${preview.brief_id}.json`), "utf8"),
  ) as FactPack;
  const pinnedRequest = factPack.source_requests.find(
    (request) => request.url === preview.source_query.url,
  );
  const retrievedAt = new Date().toISOString();
  const response = await fetchBytes(preview.source_query.url, "application/json");
  const { bytes } = response;
  let parsed: JsonStatResponse | null = null;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as JsonStatResponse;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const actualDimensions = Object.fromEntries(
    (parsed?.id ?? []).map((dimensionId) => [
      dimensionId,
      categoryCodes(parsed?.dimension?.[dimensionId]),
    ]),
  );
  const expectedDimensionChecks = Object.fromEntries(
    Object.entries(preview.source_query.expected_dimensions).map(([dimensionId, expected]) => {
      const actual = actualDimensions[dimensionId] ?? [];
      return [
        dimensionId,
        {
          expected,
          actual,
          contains_all_expected: expected.every((code) => actual.includes(code)),
          exact_match:
            expected.length === actual.length &&
            expected.every((code, index) => code === actual[index]),
        },
      ];
    }),
  );

  const statusValues = parsed?.status
    ? [
        ...new Set(
          Object.values(parsed.status)
            .filter((value) => value != null)
            .map(String),
        ),
      ].sort()
    : [];
  const expectedDimensionsContained = Object.values(expectedDimensionChecks).every(
    (check) => check.contains_all_expected,
  );
  const unexpectedDimensionCodes = Object.fromEntries(
    Object.entries(expectedDimensionChecks)
      .map(([dimensionId, check]) => [
        dimensionId,
        check.actual.filter((code) => !check.expected.includes(code)),
      ])
      .filter(([, codes]) => (codes as string[]).length > 0),
  );
  const responseSha256 = sha256(bytes);
  const transportPass =
    response.status === 200 &&
    (response.headers["content-type"] ?? "").toLowerCase().includes("json") &&
    response.tlsAuthorized &&
    !response.headers["content-encoding"] &&
    parseError === null &&
    parsed?.class === "dataset";
  const evidenceRetrievedAt = new Date().toISOString();
  const evidenceResponse = await fetchBytes(preview.source_evidence_url, "text/html");
  const evidenceContentType = evidenceResponse.headers["content-type"] ?? "";

  datasets.push({
    brief_id: preview.brief_id,
    expected_dataset_code: preview.expected_external_id,
    request_url: preview.source_query.url,
    final_url: response.finalUrl,
    retrieved_at: retrievedAt,
    http_status: response.status,
    content_type: response.headers["content-type"] ?? null,
    content_encoding: response.headers["content-encoding"] ?? null,
    tls_authorized: response.tlsAuthorized,
    decoded_body_length_bytes: bytes.byteLength,
    response_sha256: responseSha256,
    pinned_response_sha256: pinnedRequest?.response_sha256 ?? null,
    response_sha256_matches_pinned: pinnedRequest?.response_sha256 === responseSha256,
    json_parse_error: parseError,
    json_stat_class: parsed?.class ?? null,
    label: parsed?.label ?? null,
    updated: parsed?.updated ?? null,
    dimension_order: parsed?.id ?? [],
    dimension_sizes: parsed?.size ?? [],
    actual_dimensions: actualDimensions,
    expected_dimension_checks: expectedDimensionChecks,
    expected_dimensions_contained: expectedDimensionsContained,
    unexpected_dimension_codes: unexpectedDimensionCodes,
    period_policy: preview.source_query.period_policy,
    pinned_scope_note: factPack.scope_note,
    value_count: Array.isArray(parsed?.value)
      ? parsed.value.length
      : parsed?.value
        ? Object.keys(parsed.value).length
        : 0,
    status_flags: statusValues,
    dataset_evidence: {
      request_url: preview.source_evidence_url,
      final_url: evidenceResponse.finalUrl,
      retrieved_at: evidenceRetrievedAt,
      http_status: evidenceResponse.status,
      content_type: evidenceContentType || null,
      content_encoding: evidenceResponse.headers["content-encoding"] ?? null,
      tls_authorized: evidenceResponse.tlsAuthorized,
      decoded_body_length_bytes: evidenceResponse.bytes.byteLength,
      response_sha256: sha256(evidenceResponse.bytes),
      transport_pass:
        evidenceResponse.status === 200 &&
        evidenceContentType.toLowerCase().includes("html") &&
        evidenceResponse.tlsAuthorized &&
        !evidenceResponse.headers["content-encoding"],
    },
    transport_pass: transportPass,
    freshness_gate_pass:
      transportPass &&
      expectedDimensionsContained &&
      pinnedRequest?.response_sha256 === responseSha256,
  });
}

const policyUrl = inventory.rights_evidence_contract.source_policy_evidence.url;
const policyRetrievedAt = new Date().toISOString();
const policyResponse = await fetchBytes(policyUrl, "text/html");
const { bytes: policyBytes } = policyResponse;
const policyHtml = new TextDecoder().decode(policyBytes);
const policyText = policyHtml
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();
const policyLower = policyText.toLowerCase();
const policyPhrases = [
  "reuse",
  "commercial",
  "acknowledge the source",
  "modifications to the data or text",
  "non-responsibility of eurostat",
  "third-party",
  "exceptions",
];

const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  read_only: true,
  datasets,
  source_policy: {
    request_url: policyUrl,
    final_url: policyResponse.finalUrl,
    retrieved_at: policyRetrievedAt,
    http_status: policyResponse.status,
    content_type: policyResponse.headers["content-type"] ?? null,
    content_encoding: policyResponse.headers["content-encoding"] ?? null,
    tls_authorized: policyResponse.tlsAuthorized,
    decoded_body_length_bytes: policyBytes.byteLength,
    response_sha256: sha256(policyBytes),
    phrase_presence: Object.fromEntries(
      policyPhrases.map((phrase) => [phrase, policyLower.includes(phrase)]),
    ),
    transport_pass:
      policyResponse.status === 200 &&
      (policyResponse.headers["content-type"] ?? "").toLowerCase().includes("html") &&
      policyResponse.tlsAuthorized &&
      !policyResponse.headers["content-encoding"],
  },
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
