import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import prettier from "prettier";
import { z } from "zod";
import {
  CreatorVerificationPackSchema,
  EditorialFactPackSchema,
  EditorialGenerationStatusSchema,
  type EditorialFactPack,
} from "../../src/lib/editorial/fact-pack-schema.js";
import {
  eurostatStatusLabels,
  flattenEditorialEurostat,
  parseEditorialCsv,
  parseOwidEditorialFacts,
} from "../../src/lib/editorial/source-parsers.js";
import { isEditorialRightsEligible } from "../../src/lib/editorial/rights-gate.js";

const REPO_ROOT = new URL("../../", import.meta.url);
const BRIEFS_PATH = new URL("data/editorial/calibration-briefs.json", REPO_ROOT);
const BRIEF_REVISIONS_PATH = new URL("data/editorial/brief-revisions.json", REPO_ROOT);
const OUTPUT_ROOT = new URL("data/editorial/fact-packs/", REPO_ROOT);
const SNAPSHOT_ROOT = new URL("data/editorial/source-snapshots/", REPO_ROOT);
const STATUS_PATH = new URL("data/editorial/fact-pack-generation-status.json", REPO_ROOT);
const CREATOR_PACK_PATH = new URL(
  "data/editorial/verification-packs/creator-calculator-guide.json",
  REPO_ROOT,
);
const PARSER_VERSION = "citesupply-editorial-fetch/1.0.0";
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const META_MARKER = "\n__CITESUPPLY_CURL_META__";

const BriefSchema = z.object({
  brief_id: z.string(),
  candidate_id: z.string(),
  format: z.string(),
  source_families: z.array(z.string()),
  question: z.string(),
  thesis: z.string(),
  brief_revision: z.string().default("1.0.0"),
  eurostat_scope: z
    .object({
      allowed_dimension_values: z.record(z.string(), z.array(z.string())).default({}),
      excluded_periods: z.array(z.string()).default([]),
      interpretation: z.string(),
    })
    .optional(),
  asset_slugs: z.array(z.string()),
  required_source_requests: z.array(
    z.object({
      url: z.url(),
      purpose: z.string(),
    }),
  ),
  rights_plan: z.object({
    commercial_use: z.string(),
    modification: z.string(),
    raw_data_redistribution: z.string(),
    citation: z.string(),
    presentation: z.string(),
  }),
  mandatory_limitations: z.array(z.string()),
});

const InventorySchema = z.object({
  generated_at: z.string(),
  creator_assets: z.array(
    z.object({
      slug: z.string(),
      source_url: z.url(),
      rights: z.object({
        commercial_use: z.string(),
        modification: z.string(),
        source_hosted_embed: z.string(),
        marketplace_rendered_embed: z.string(),
        citation: z.string(),
        raw_data_redistribution: z.string(),
        evidence_url: z.url(),
      }),
    }),
  ),
  candidates: z.array(
    z.object({
      candidate_id: z.string(),
      asset_slugs: z.array(z.string()),
      rights_summary: z.object({
        published: z.boolean(),
        commercial_use: z.array(z.string()),
        modification: z.array(z.string()),
        source_hosted_embed: z.array(z.string()),
        marketplace_rendered_embed: z.array(z.string()),
        citation: z.array(z.string()),
        raw_data_redistribution: z.array(z.string()),
        evidence_urls: z.array(z.url()),
      }),
    }),
  ),
});

const BriefCollectionSchema = z.object({
  generated_at: z.string(),
  calibration_briefs: z.array(BriefSchema),
});

const BriefRevisionsSchema = z.object({
  schema_version: z.literal("1.0.0"),
  revisions: z.array(
    z.object({
      brief_id: z.string(),
      from_revision: z.string(),
      revision: z.string(),
      working_title: z.string(),
      question: z.string(),
      thesis: z.string(),
      reader_value: z.string(),
      asset_slugs: z.array(z.string()),
      eurostat_scope: z
        .object({
          allowed_dimension_values: z.record(z.string(), z.array(z.string())),
          excluded_periods: z.array(z.string()),
          interpretation: z.string(),
        })
        .optional(),
      dropped_asset_slugs: z.array(z.string()).optional(),
    }),
  ),
});

type Brief = z.infer<typeof BriefSchema>;
type Download = {
  body: string;
  rawBytes: Buffer;
  sha256: string;
  status: number;
  contentType: string;
  finalUrl: URL;
  retrievedAt: string;
  snapshotPath: string;
};

const OWID_CONFIG = {
  "cb-001-internet-adoption-gap": {
    sourceId: "source_owid",
    chartSlug: "share-of-individuals-using-the-internet",
    variableIds: [1294130],
    expectedHeaders: ["Entity", "Code", "Year", "Share of the population using the Internet"],
    metadataColumnByCsvHeader: {
      "Share of the population using the Internet":
        "Individuals using the Internet (% of population)",
    },
    expectedShortNames: ["it_net_user_zs"],
    displayColumn: "Individuals using the Internet (% of population)",
    assetLicenseEvidence: "CC BY 4.0",
    caveats: [
      "Values are copied from the source CSV without unit conversion; the source unit is % of population.",
      "Entity codes are preserved as source labels; the country-versus-aggregate classification has not yet been reviewed.",
      "The underlying data is sourced from ITU via World Bank WDI; this pack preserves that upstream attribution.",
      "No interpolation, ranking, coverage threshold, or derived change has been calculated.",
    ],
  },
  "cb-004-wildfire-land-cover": {
    sourceId: "source_owid",
    chartSlug: "area-burned-wildfires-by-type",
    variableIds: [1306108, 1306107, 1306106, 1306109],
    expectedHeaders: [
      "Entity",
      "Code",
      "Year",
      "Shrublands and grasslands",
      "Savannas",
      "Forests",
      "Croplands",
    ],
    metadataColumnByCsvHeader: {
      "Shrublands and grasslands": "Yearly burned area in shrublands and grasslands",
      Savannas: "Yearly burned area in savannas",
      Forests: "Yearly burned area in forests",
      Croplands: "Yearly burned area in croplands",
    },
    expectedShortNames: ["shrublands_grasslands", "savannas", "forest", "croplands"],
    displayColumn: null,
    assetLicenseEvidence: "CC BY 4.0",
    caveats: [
      "All source values are stored without unit conversion or aggregation.",
      "Entity codes are preserved as source labels; the country-versus-aggregate classification has not yet been reviewed.",
      "The source notes that satellite detection can underestimate burned area and fire occurrence.",
      "No interpolation, ranking, total across land-cover classes, or trend has been calculated.",
    ],
  },
} as const;

const EUROSTAT_CONFIG = {
  "cb-002-eu-renewable-share-patterns": {
    sourceId: "source_eurostat",
    outputId: "cb-002-eu-renewable-share-patterns",
    topic:
      "EU27 renewable-energy shares across selected consumption sectors, 2020–2024; 2020–2021 methodology break noted.",
    dataset: "nrg_ind_ren",
    url: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_ind_ren?lang=en&sinceTimePeriod=2020&geo=EU27_2020",
    allowedGeoCodes: ["EU27_2020"],
    rightsPolicyUrl: "https://ec.europa.eu/eurostat/help/copyright-notice",
    expectedDimensions: ["freq", "nrg_bal", "unit", "geo", "time"],
    allowedDimensionValues: {
      nrg_bal: ["REN", "REN_ELC", "REN_TRA", "REN_HEAT_CL"],
    },
    excludedPeriods: ["2025"],
    rightsEvidenceIndex: 0,
    caveats: [
      "The full response dimension and status metadata for the scoped EU aggregate is preserved.",
      "Only the EU27_2020 aggregate is included. Eurostat's commercial reuse policy has exceptions for third-party data and data for other countries.",
      "The secondary SDG series is not included because its compatibility with the main energy-balance categories has not been demonstrated.",
      "2024 is the latest complete common year for the four selected categories in this snapshot. Values through 2020 and from 2021 onward cross a source methodology change.",
      "2025 is excluded because the available values are provisional and the transport observation is absent. No derived statistic has been calculated.",
    ],
  },
  "cb-003-hicp-inflation-explainer": {
    sourceId: "source_eurostat",
    outputId: "cb-003-hicp-inflation-explainer",
    topic:
      "EU27 annual-average HICP rate of change, 2018–2025; an aggregate indicator explainer, not a country comparison.",
    dataset: "tec00118",
    url: "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tec00118?lang=en&sinceTimePeriod=2018&geo=EU27_2020",
    allowedGeoCodes: ["EU27_2020"],
    allowedDimensionValues: {},
    excludedPeriods: [],
    rightsPolicyUrl: "https://ec.europa.eu/eurostat/help/copyright-notice",
    expectedDimensions: ["freq", "unit", "coicop18", "geo", "time"],
    rightsEvidenceIndex: 0,
    caveats: [
      "The full response dimension and status metadata is preserved; no country or currency-area grouping is applied yet.",
      "Only the EU27_2020 aggregate is included. Eurostat's commercial reuse policy has exceptions for third-party data and data for other countries.",
      "Annual-average rate of change is kept separate from monthly and year-on-year monthly inflation measures.",
      "No comparison, ranking, or derived statistic has been calculated.",
    ],
  },
} as const;

function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function requestParameters(url: URL): Record<string, string> {
  return Object.fromEntries([...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function curlGet(
  url: string,
  allowedHosts: ReadonlySet<string>,
): Promise<{
  body: string;
  rawBytes: Buffer;
  status: number;
  contentType: string;
  finalUrl: URL;
  retrievedAt: string;
}> {
  const requestUrl = new URL(url);
  if (requestUrl.protocol !== "https:" || !allowedHosts.has(requestUrl.hostname)) {
    throw Object.assign(new Error("source_host_not_allowlisted"), {
      code: "source_host_not_allowlisted",
    });
  }

  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--max-redirs",
    "3",
    "--max-time",
    "45",
    "--max-filesize",
    String(MAX_RESPONSE_BYTES),
    "--proto",
    "=https",
    "--proto-redir",
    "=https",
    "--globoff",
    "--header",
    "Accept: application/json, text/csv;q=0.9, text/html;q=0.7",
    "--write-out",
    `${META_MARKER}%{http_code}\t%{content_type}\t%{url_effective}`,
    url,
  ];

  const result = await new Promise<{ stdout: Buffer; stderr: string; code: number }>(
    (resolve, reject) => {
      const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
      const stdoutChunks: Buffer[] = [];
      let stderr = "";
      let totalBytes = 0;
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_RESPONSE_BYTES + 2048) child.kill("SIGKILL");
        else stdoutChunks.push(chunk);
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) =>
        resolve({ stdout: Buffer.concat(stdoutChunks), stderr, code: code ?? 1 }),
      );
    },
  );

  const marker = Buffer.from(META_MARKER, "ascii");
  const markerIndex = result.stdout.lastIndexOf(marker);
  const tlsFailure =
    /SSL certificate problem|certificate verify failed|unable to get local issuer/i.test(
      result.stderr,
    );
  if (markerIndex < 0) {
    throw Object.assign(new Error(tlsFailure ? "tls_validation_failed" : "source_fetch_failed"), {
      code: tlsFailure ? "tls_validation_failed" : "source_fetch_failed",
    });
  }

  const rawBytes = result.stdout.subarray(0, markerIndex);
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch {
    throw Object.assign(new Error("source_response_not_utf8"), {
      code: "source_response_not_utf8",
    });
  }
  const meta = result.stdout
    .subarray(markerIndex + marker.length)
    .toString("utf8")
    .trim()
    .split("\t");
  const status = Number(meta[0]);
  const contentType = meta[1] ?? "";
  if (tlsFailure) {
    throw Object.assign(new Error("tls_validation_failed"), { code: "tls_validation_failed" });
  }
  if (result.code !== 0) {
    throw Object.assign(new Error("source_fetch_failed"), { code: "source_fetch_failed" });
  }
  const finalUrl = new URL(meta[2] ?? "");
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    throw Object.assign(new Error(`http_${status || "unknown"}`), {
      code: `http_${status || "unknown"}`,
    });
  }
  if (!allowedHosts.has(finalUrl.hostname) || finalUrl.protocol !== "https:") {
    throw Object.assign(new Error("redirect_host_not_allowlisted"), {
      code: "redirect_host_not_allowlisted",
    });
  }
  return { body, rawBytes, status, contentType, finalUrl, retrievedAt: new Date().toISOString() };
}

async function readVerifiedSnapshot(
  briefId: string,
  url: string,
  allowedHosts: ReadonlySet<string>,
): Promise<Download> {
  const packUrl = new URL(`${briefId}.json`, OUTPUT_ROOT);
  const prior = JSON.parse(await readFile(fileURLToPath(packUrl), "utf8")) as {
    status?: string;
    source_requests?: Array<{
      url?: string;
      final_url?: string;
      http_status?: number;
      content_type?: string;
      response_sha256?: string;
      retrieved_at?: string;
      snapshot_path?: string;
    }>;
  };
  if (prior.status !== "ready_for_sol_review" || !Array.isArray(prior.source_requests)) {
    throw new Error(`verified_snapshot_pack_not_ready:${briefId}`);
  }
  const request = prior.source_requests.find((entry) => entry.url === url);
  if (
    !request?.snapshot_path ||
    !request.final_url ||
    !request.response_sha256 ||
    !request.retrieved_at ||
    !request.content_type ||
    !request.http_status ||
    request.http_status < 200 ||
    request.http_status >= 300
  ) {
    throw new Error(`verified_snapshot_request_missing:${briefId}`);
  }
  const requestedUrl = new URL(url);
  const finalUrl = new URL(request.final_url);
  if (
    !request.snapshot_path.startsWith("data/editorial/source-snapshots/") ||
    request.snapshot_path.split("/").includes("..") ||
    requestedUrl.protocol !== "https:" ||
    finalUrl.protocol !== "https:" ||
    !allowedHosts.has(requestedUrl.hostname) ||
    !allowedHosts.has(finalUrl.hostname)
  ) {
    throw new Error(`verified_snapshot_host_invalid:${briefId}`);
  }
  const snapshotUrl = new URL(request.snapshot_path, REPO_ROOT);
  const bytes = await readFile(fileURLToPath(snapshotUrl));
  const digest = sha256(bytes);
  if (digest !== request.response_sha256) {
    throw new Error(`verified_snapshot_hash_mismatch:${briefId}`);
  }
  return {
    body: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    rawBytes: bytes,
    sha256: digest,
    status: request.http_status,
    contentType: request.content_type,
    finalUrl,
    retrievedAt: request.retrieved_at,
    snapshotPath: request.snapshot_path,
  };
}

async function writeAtomic(path: URL, content: string | Buffer): Promise<void> {
  const targetPath = fileURLToPath(path);
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}`;
  await writeFile(tempPath, content);
  await rename(tempPath, targetPath);
}

async function writeJsonAtomic(path: URL, value: unknown): Promise<void> {
  const content = await prettier.format(`${JSON.stringify(value)}\n`, { parser: "json" });
  await writeAtomic(path, content);
}

async function writeSnapshotImmutable(
  path: URL,
  content: Buffer,
  expectedHash: string,
): Promise<void> {
  const targetPath = fileURLToPath(path);
  await mkdir(dirname(targetPath), { recursive: true });
  try {
    await writeFile(targetPath, content, { flag: "wx" });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    const existing = await readFile(targetPath);
    if (sha256(existing) !== expectedHash) throw new Error("snapshot_content_hash_collision");
  }
}

function assetEvidence(brief: Brief, inventory: z.infer<typeof InventorySchema>, index: number) {
  const candidate = inventory.candidates.find((entry) => entry.candidate_id === brief.candidate_id);
  if (!candidate) throw new Error(`candidate_not_in_inventory:${brief.candidate_id}`);
  const slug = brief.asset_slugs[index];
  if (!slug || !candidate.asset_slugs.includes(slug)) {
    throw new Error(`brief_asset_mismatch:${brief.candidate_id}`);
  }
  const rights = candidate.rights_summary;
  return {
    candidate,
    slug,
    evidence: {
      commercial_use: rights.commercial_use,
      modification: rights.modification,
      raw_data_redistribution: rights.raw_data_redistribution,
      citation: rights.citation,
      evidence_urls: rights.evidence_urls,
    },
  };
}

function sourceAsset(
  brief: Brief,
  inventory: z.infer<typeof InventorySchema>,
  index: number,
  sourceId: string,
  evidenceUrl: string,
  licenceCode: string | null,
) {
  const { evidence } = assetEvidence(brief, inventory, index);
  const commercial = evidence.commercial_use.includes("Allowed") ? "Allowed" : "Unknown";
  const modification = evidence.modification.includes("Allowed") ? "Allowed" : "Unknown";
  const raw = evidence.raw_data_redistribution.includes("Allowed") ? "Allowed" : "Unknown";
  const slug = brief.asset_slugs[index];
  return {
    asset_id: null,
    asset_id_resolution: "public_route_only" as const,
    slug,
    source_id: sourceId,
    canonical_url: `https://citesupply.com/asset/${slug}`,
    evidence_url: evidenceUrl,
    evidence_checked_at: inventory.generated_at,
    licence_code: licenceCode,
    commercial_use: commercial,
    modification_allowed: modification,
    raw_data_redistribution: raw,
    attribution_required: evidence.citation.includes("Required"),
  };
}

function assertRights(brief: Brief, inventory: z.infer<typeof InventorySchema>): void {
  if (
    brief.rights_plan.commercial_use !== "Allowed" ||
    brief.rights_plan.modification !== "Allowed" ||
    brief.rights_plan.raw_data_redistribution !== "Allowed"
  ) {
    throw Object.assign(new Error("brief_rights_not_allowed"), {
      code: "brief_rights_not_allowed",
    });
  }
  const candidate = inventory.candidates.find((entry) => entry.candidate_id === brief.candidate_id);
  if (!isEditorialRightsEligible(candidate?.rights_summary)) {
    throw Object.assign(new Error("asset_rights_not_allowed"), {
      code: "asset_rights_not_allowed",
    });
  }
  brief.asset_slugs.forEach((_, index) => {
    const { evidence } = assetEvidence(brief, inventory, index);
    if (!isEditorialRightsEligible({ published: true, ...evidence })) {
      throw Object.assign(new Error("asset_rights_not_allowed"), {
        code: "asset_rights_not_allowed",
      });
    }
  });
}

async function saveResponse(
  briefId: string,
  name: string,
  response: Awaited<ReturnType<typeof curlGet>>,
): Promise<Download> {
  const bodyBytes = response.rawBytes;
  const responseHash = sha256(bodyBytes);
  const fileUrl = new URL(`${briefId}/${responseHash}/${name}`, SNAPSHOT_ROOT);
  await writeSnapshotImmutable(fileUrl, bodyBytes, responseHash);
  return {
    ...response,
    sha256: responseHash,
    snapshotPath: relative(fileURLToPath(REPO_ROOT), fileURLToPath(fileUrl)),
  };
}

function sourceRequest(url: string, download: Download) {
  return {
    url,
    final_url: download.finalUrl.toString(),
    parameters: requestParameters(new URL(url)),
    http_status: download.status,
    content_type: download.contentType,
    response_sha256: download.sha256,
    retrieved_at: download.retrievedAt,
    snapshot_path: download.snapshotPath,
    parser_version: PARSER_VERSION,
  };
}

async function fetchOwid(
  brief: Brief,
  inventory: z.infer<typeof InventorySchema>,
  fromVerifiedSnapshots = false,
): Promise<EditorialFactPack> {
  const config = OWID_CONFIG[brief.brief_id as keyof typeof OWID_CONFIG];
  if (!config) throw new Error("owid_brief_not_configured");
  assertRights(brief, inventory);
  if (brief.asset_slugs.length !== 1 || !brief.asset_slugs[0]?.includes(config.chartSlug)) {
    throw new Error("owid_asset_slug_mismatch");
  }
  const chartMetaUrl = `https://ourworldindata.org/grapher/${config.chartSlug}.metadata.json`;
  const csvUrl = `https://ourworldindata.org/grapher/${config.chartSlug}.csv`;
  for (const requiredUrl of [csvUrl, chartMetaUrl]) {
    const required = new URL(requiredUrl);
    if (
      !brief.required_source_requests.some((request) => {
        const declared = new URL(request.url);
        return declared.origin === required.origin && declared.pathname === required.pathname;
      })
    ) {
      throw new Error(`brief_source_request_mismatch:${brief.brief_id}`);
    }
  }
  const apiMetaUrls = config.variableIds.map(
    (id) => `https://api.ourworldindata.org/v1/indicators/${id}.metadata.json`,
  );
  const allowedHosts = new Set(["ourworldindata.org", "api.ourworldindata.org"]);
  const urls = [csvUrl, chartMetaUrl, ...apiMetaUrls];
  const fetched = await Promise.all(
    urls.map((url) =>
      fromVerifiedSnapshots
        ? readVerifiedSnapshot(brief.brief_id, url, allowedHosts)
        : curlGet(url, allowedHosts),
    ),
  );
  const chartMetadata = JSON.parse(fetched[1]!.body) as Record<string, unknown>;
  const csvHeaders =
    parseEditorialCsv(fetched[0]!.body).rows[0]?.map((header) => header.trim()) ?? [];
  if (JSON.stringify(csvHeaders) !== JSON.stringify(config.expectedHeaders)) {
    throw Object.assign(new Error("owid_header_mismatch"), { code: "owid_header_mismatch" });
  }
  if (
    config.displayColumn &&
    !Object.hasOwn(chartMetadata.columns as object, config.displayColumn)
  ) {
    throw Object.assign(new Error("owid_expected_column_missing"), {
      code: "owid_expected_column_missing",
    });
  }

  const indicatorMetas = await Promise.all(
    fetched
      .slice(2)
      .map((response, index) =>
        saveResponse(
          brief.brief_id,
          `indicator-${config.variableIds[index]}.metadata.json`,
          response,
        ),
      ),
  );

  const provenance: EditorialFactPack["source_provenance"] = [];
  for (let index = 0; index < indicatorMetas.length; index += 1) {
    const metadata = JSON.parse(fetched[index + 2]!.body) as Record<string, unknown>;
    if (
      metadata.id !== config.variableIds[index] ||
      metadata.shortName !== config.expectedShortNames[index]
    ) {
      throw Object.assign(new Error("owid_indicator_metadata_mismatch"), {
        code: "owid_indicator_metadata_mismatch",
      });
    }
    if (
      metadata.nonRedistributable !== false ||
      !Array.isArray(metadata.origins) ||
      metadata.origins.length === 0
    ) {
      throw Object.assign(new Error("owid_redistribution_not_confirmed"), {
        code: "owid_redistribution_not_confirmed",
      });
    }
    const metaUrl = apiMetaUrls[index]!;
    for (const origin of metadata.origins as Array<Record<string, unknown>>) {
      const license = origin.license as Record<string, unknown> | undefined;
      if (
        license?.name !== config.assetLicenseEvidence ||
        typeof license.url !== "string" ||
        typeof origin.urlMain !== "string"
      ) {
        throw Object.assign(new Error("owid_origin_license_mismatch"), {
          code: "owid_origin_license_mismatch",
        });
      }
      provenance.push({
        source_metadata_url: metaUrl,
        origin_name: String(origin.producer ?? origin.title ?? "unknown origin"),
        origin_url: origin.urlMain,
        license_name: license.name,
        license_url: license.url,
        non_redistributable: false,
        metadata_sha256: indicatorMetas[index]!.sha256,
      });
    }
  }

  // Persist observation and chart snapshots only after all upstream metadata
  // and raw-redistribution license checks have passed.
  const csv = await saveResponse(brief.brief_id, `${config.chartSlug}.csv`, fetched[0]!);
  const chartMeta = await saveResponse(
    brief.brief_id,
    `${config.chartSlug}.grapher-metadata.json`,
    fetched[1]!,
  );

  const facts = parseOwidEditorialFacts(fetched[0]!.body, {
    expectedHeaders: config.expectedHeaders,
    metadataColumnByCsvHeader: config.metadataColumnByCsvHeader,
    metadata: chartMetadata,
    briefId: brief.brief_id,
  });
  const evidenceUrl = `https://ourworldindata.org/grapher/${config.chartSlug}`;
  const inputAssets = brief.asset_slugs.map((_, index) =>
    sourceAsset(brief, inventory, index, config.sourceId, evidenceUrl, config.assetLicenseEvidence),
  );
  const requestUrls = [csvUrl, chartMetaUrl, ...apiMetaUrls];
  const downloads = [csv, chartMeta, ...indicatorMetas];
  const fetchedAt = downloads.map((item) => item.retrievedAt).sort()[0]!;
  const pack = {
    schema_version: "1.0.0",
    id: brief.brief_id,
    topic: brief.question,
    generated_at: new Date().toISOString(),
    source_fetched_at: fetchedAt,
    method_version: PARSER_VERSION,
    brief_revision: brief.brief_revision,
    scope_note: null,
    status: "ready_for_sol_review",
    input_assets: inputAssets,
    source_requests: requestUrls.map((url, index) => sourceRequest(url, downloads[index]!)),
    facts,
    derived_facts: [],
    source_status_labels: {},
    caveats: config.caveats,
    source_provenance: provenance,
  };
  return EditorialFactPackSchema.parse(pack);
}

async function fetchEurostat(
  brief: Brief,
  inventory: z.infer<typeof InventorySchema>,
  fromVerifiedSnapshots = false,
): Promise<EditorialFactPack> {
  const config = EUROSTAT_CONFIG[brief.brief_id as keyof typeof EUROSTAT_CONFIG];
  if (!config) throw new Error("eurostat_brief_not_configured");
  assertRights(brief, inventory);
  const configuredUrl = new URL(config.url);
  if (
    !brief.required_source_requests.some((request) => {
      const declared = new URL(request.url);
      return (
        declared.origin === configuredUrl.origin && declared.pathname === configuredUrl.pathname
      );
    })
  ) {
    throw new Error(`brief_source_request_mismatch:${brief.brief_id}`);
  }
  const allowedHosts = new Set(["ec.europa.eu"]);
  const getSource = (url: string) =>
    fromVerifiedSnapshots
      ? readVerifiedSnapshot(brief.brief_id, url, allowedHosts)
      : curlGet(url, allowedHosts);
  const [fetched, policyResponse] = await Promise.all([
    getSource(config.url),
    getSource(config.rightsPolicyUrl),
  ]);
  const policyText = policyResponse.body
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#\d+);/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (
    !policyText.includes("reuse of statistical data") ||
    !policyText.includes("may not be reused for commercial purposes") ||
    !policyText.includes("member states of the european union")
  ) {
    throw Object.assign(new Error("eurostat_reuse_policy_unrecognized"), {
      code: "eurostat_reuse_policy_unrecognized",
    });
  }
  const data = JSON.parse(fetched.body) as Record<string, unknown>;
  const dims = data.dimension as
    Record<string, { category?: { label?: Record<string, string> } }> | undefined;
  if (
    !Array.isArray(data.id) ||
    !Array.isArray(data.size) ||
    !dims ||
    typeof data.value !== "object"
  ) {
    throw Object.assign(new Error("eurostat_jsonstat_shape_invalid"), {
      code: "eurostat_jsonstat_shape_invalid",
    });
  }
  const scope = brief.eurostat_scope;
  if (!scope) throw new Error("eurostat_brief_scope_missing");
  if (
    JSON.stringify(scope.allowed_dimension_values) !== JSON.stringify(config.allowedDimensionValues)
  ) {
    throw new Error("eurostat_brief_generator_scope_mismatch");
  }
  if (JSON.stringify(scope.excluded_periods) !== JSON.stringify(config.excludedPeriods)) {
    throw new Error("eurostat_brief_generator_period_mismatch");
  }
  const facts = flattenEditorialEurostat(data, {
    expectedDimensions: config.expectedDimensions,
    allowedGeoCodes: config.allowedGeoCodes,
    briefId: brief.brief_id,
    allowedDimensionValues: scope.allowed_dimension_values,
    excludedPeriods: scope.excluded_periods,
  });
  const downloaded = await saveResponse(brief.brief_id, `${config.dataset}.json`, fetched);
  const policySnapshot = await saveResponse(
    brief.brief_id,
    "eurostat-copyright-notice.html",
    policyResponse,
  );
  const evidenceUrl = `https://ec.europa.eu/eurostat/databrowser/view/${config.dataset}/default/table?lang=en`;
  const inputAssets = [
    sourceAsset(
      brief,
      inventory,
      config.rightsEvidenceIndex,
      config.sourceId,
      evidenceUrl,
      "Eurostat re-use policy (exceptions apply)",
    ),
  ];
  const pack = {
    schema_version: "1.0.0",
    id: config.outputId,
    topic: config.topic,
    generated_at: new Date().toISOString(),
    source_fetched_at: [downloaded.retrievedAt, policySnapshot.retrievedAt].sort()[0],
    method_version: PARSER_VERSION,
    brief_revision: brief.brief_revision,
    scope_note: scope.interpretation,
    status: "ready_for_sol_review",
    input_assets: inputAssets,
    source_requests: [
      sourceRequest(config.url, downloaded),
      sourceRequest(config.rightsPolicyUrl, policySnapshot),
    ],
    facts,
    derived_facts: [],
    source_status_labels: eurostatStatusLabels(data),
    caveats: config.caveats,
    source_provenance: [
      {
        source_metadata_url: config.rightsPolicyUrl,
        origin_name: "Eurostat",
        origin_url: evidenceUrl,
        license_name: "Eurostat statistical data re-use policy (attribution; exceptions apply)",
        license_url: config.rightsPolicyUrl,
        non_redistributable: false,
        metadata_sha256: policySnapshot.sha256,
      },
    ],
  };
  return EditorialFactPackSchema.parse(pack);
}

async function writeCreatorVerificationPack(
  brief: Brief,
  inventory: z.infer<typeof InventorySchema>,
) {
  const assets = brief.asset_slugs.map((asset_slug) => {
    const record = inventory.creator_assets.find((asset) => asset.slug === asset_slug);
    if (!record) throw new Error(`creator_asset_not_in_inventory:${asset_slug}`);
    return {
      asset_slug,
      marketplace_url: `https://citesupply.com/asset/${asset_slug}`,
      creator_url: record.source_url,
      rights_evidence_url: record.rights.evidence_url,
      rights_status_from_reviewed_candidate: {
        commercial_use: [record.rights.commercial_use],
        modification: [record.rights.modification],
        source_hosted_embed: [record.rights.source_hosted_embed],
        marketplace_rendered_embed: [record.rights.marketplace_rendered_embed],
        citation: [record.rights.citation],
        raw_data_redistribution: [record.rights.raw_data_redistribution],
      },
    };
  });
  const pack = CreatorVerificationPackSchema.parse({
    schema_version: "1.0.0",
    id: "creator-calculator-guide-verification",
    candidate_id: brief.candidate_id,
    generated_at: new Date().toISOString(),
    status: "checklist_prepared",
    factual_outputs_used: false,
    assets,
    checks: [
      {
        check_id: "asset-pages-and-source-pages-http",
        state: "not_run",
        evidence: "Reachability must be checked in this run before drafting.",
      },
      {
        check_id: "current-asset-rights-review",
        state: "not_run",
        evidence:
          "Re-read each live Cite Supply rights panel; prior inventory evidence is not a live grant.",
      },
      {
        check_id: "sandbox-embed-functionality",
        state: "not_run",
        evidence: "Exercise each calculator's main controls inside the marketplace sandbox.",
      },
      {
        check_id: "output-accuracy",
        state: "not_run",
        evidence:
          "No independent domain-specific validation contract is available; do not claim output accuracy.",
      },
      {
        check_id: "attribution-and-source-link",
        state: "not_run",
        evidence: "Confirm attribution remains visible and links to the correct creator page.",
      },
      {
        check_id: "keyboard-and-mobile",
        state: "not_run",
        evidence: "Check keyboard use and a narrow viewport in a real browser.",
      },
      {
        check_id: "no-output-harvesting",
        state: "prepared",
        evidence: "The guide schema forbids calculator outputs as factual inputs.",
      },
    ],
    publication_effect: "none",
  });
  await writeJsonAtomic(CREATOR_PACK_PATH, pack);
  return pack;
}

async function main() {
  const [, , ...args] = process.argv;
  const fromVerifiedSnapshots = args.includes("--from-verified-snapshots");
  if (args.some((arg) => arg !== "--from-verified-snapshots")) {
    throw new Error("Usage: npm run editorial:fact-packs -- [--from-verified-snapshots]");
  }
  const briefsRaw = await readFile(fileURLToPath(BRIEFS_PATH), "utf8");
  const revisionsRaw = await readFile(fileURLToPath(BRIEF_REVISIONS_PATH), "utf8");
  const inventoryPath = new URL("data/editorial/article-candidates.json", REPO_ROOT);
  const inventoryRaw = await readFile(fileURLToPath(inventoryPath), "utf8");
  const baseBriefCollection = BriefCollectionSchema.parse(JSON.parse(briefsRaw));
  const revisions = BriefRevisionsSchema.parse(JSON.parse(revisionsRaw));
  const revisionById = new Map(
    revisions.revisions.map((revision) => [revision.brief_id, revision]),
  );
  if (revisionById.size !== revisions.revisions.length) {
    throw new Error("duplicate_brief_revision");
  }
  const briefCollection = {
    ...baseBriefCollection,
    calibration_briefs: baseBriefCollection.calibration_briefs.map((brief) => {
      const revision = revisionById.get(brief.brief_id);
      if (!revision) return brief;
      if (revision.from_revision !== brief.brief_revision) {
        throw new Error(`brief_revision_mismatch:${brief.brief_id}`);
      }
      if (
        revision.dropped_asset_slugs?.some((slug) => !brief.asset_slugs.includes(slug)) ||
        revision.asset_slugs.some((slug) => !brief.asset_slugs.includes(slug))
      ) {
        throw new Error(`brief_revision_asset_mismatch:${brief.brief_id}`);
      }
      return {
        ...brief,
        brief_revision: revision.revision,
        question: revision.question,
        thesis: revision.thesis,
        asset_slugs: revision.asset_slugs,
        eurostat_scope: revision.eurostat_scope,
      };
    }),
  };
  const inventory = InventorySchema.parse(JSON.parse(inventoryRaw));
  const entries: z.infer<typeof EditorialGenerationStatusSchema>["entries"] = [];
  const creatorBrief = briefCollection.calibration_briefs.find(
    (brief) => brief.candidate_id === "c-043-creator-calculator-guide",
  );
  if (!creatorBrief) throw new Error("creator_calibration_brief_missing");
  await writeCreatorVerificationPack(creatorBrief, inventory);

  for (const brief of briefCollection.calibration_briefs.filter(
    (item) => item.candidate_id !== creatorBrief.candidate_id,
  )) {
    try {
      const pack = brief.source_families?.includes("eurostat")
        ? await fetchEurostat(brief, inventory, fromVerifiedSnapshots)
        : await fetchOwid(brief, inventory, fromVerifiedSnapshots);
      const outputPath = new URL(`${pack.id}.json`, OUTPUT_ROOT);
      await writeJsonAtomic(outputPath, pack);
      entries.push({
        brief_id: brief.brief_id,
        candidate_id: brief.candidate_id,
        status: "ready_for_sol_review",
        fact_pack_path: `data/editorial/fact-packs/${pack.id}.json`,
        error_code: null,
      });
      console.log(`${brief.brief_id}: ready (${pack.facts.length} source observations)`);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : error instanceof z.ZodError
            ? `schema_validation_failed:${error.issues
                .slice(0, 3)
                .map((issue) => `${issue.path.join(".")}:${issue.code}`)
                .join(",")}`
            : error instanceof Error
              ? error.message.slice(0, 120)
              : "source_processing_failed";
      const status =
        code === "tls_validation_failed"
          ? "blocked_tls"
          : code.includes("rights") || code.includes("license") || code.includes("redistributable")
            ? "blocked_rights"
            : "blocked_source";
      entries.push({
        brief_id: brief.brief_id,
        candidate_id: brief.candidate_id,
        status,
        fact_pack_path: null,
        error_code: code,
      });
      console.error(`${brief.brief_id}: ${status} (${code})`);
    }
  }

  const status = EditorialGenerationStatusSchema.parse({
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    step: 4,
    production_writes: false,
    source_mode: fromVerifiedSnapshots ? "verified_snapshots" : "live_https",
    entries,
  });
  await writeJsonAtomic(STATUS_PATH, status);
  if (entries.some((entry) => entry.status.startsWith("blocked_"))) {
    console.log("Completed with source blockers; no unverified source values were saved.");
  }
}

await main();
