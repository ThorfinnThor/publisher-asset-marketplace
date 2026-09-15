export type AcceptedInput = {
  line: number;
  input: string;
  slug: string;
  canonicalUrl: string;
  title?: string;
};

export type RejectedInput = {
  line: number;
  input: string;
  reason: string;
};

export type DuplicateInput = RejectedInput & {
  slug: string;
};

export type NormalizeReport = {
  accepted: AcceptedInput[];
  duplicates: DuplicateInput[];
  invalid: RejectedInput[];
};

type Candidate = {
  line: number;
  input: string;
  title?: string;
};

const allowedHosts = new Set(["ourworldindata.org", "www.ourworldindata.org"]);
// OWID has published Grapher slugs that end in a hyphen, for example charts
// whose title ends in "international-$". Keep the first character strict but
// otherwise accept OWID's lowercase alphanumeric/hyphen path segment.
const slugPattern = /^[a-z0-9][a-z0-9-]*$/;

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[\s_-]+/g, "");
}

function candidatesFromCsv(input: string): Candidate[] {
  const rows = parseCsvRows(input);
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const urlIndex = headers.findIndex((header) => ["asseturl", "url", "slug"].includes(header));
  const titleIndex = headers.findIndex((header) => header === "title");

  if (urlIndex < 0) {
    return [{ line: 1, input: "", title: undefined }];
  }

  return rows.slice(1).map((row, index) => ({
    line: index + 2,
    input: row[urlIndex] ?? "",
    title: titleIndex >= 0 ? row[titleIndex]?.trim() || undefined : undefined,
  }));
}

function candidatesFromJson(input: string): Candidate[] {
  const parsed: unknown = JSON.parse(input);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON input must be an array");
  }

  return parsed.map((value, index) => {
    if (typeof value === "string") {
      return { line: index + 1, input: value };
    }
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      const locator = record.asset_url ?? record.assetUrl ?? record.url ?? record.slug ?? "";
      return {
        line: index + 1,
        input: typeof locator === "string" ? locator : "",
        title: typeof record.title === "string" ? record.title.trim() || undefined : undefined,
      };
    }
    return { line: index + 1, input: "" };
  });
}

function candidatesFromText(input: string): Candidate[] {
  return input
    .split(/\r?\n/)
    .map((value, index) => ({ line: index + 1, input: value.trim() }))
    .filter((candidate) => candidate.input !== "");
}

function normalizeLocator(value: string): { slug: string; canonicalUrl: string } {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("missing OWID URL or slug");
  }

  let slug: string;
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      throw new Error("URL must use HTTPS");
    }
    if (!allowedHosts.has(url.hostname.toLocaleLowerCase("en"))) {
      throw new Error("URL must use the ourworldindata.org host");
    }
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length !== 2 || pathSegments[0] !== "grapher") {
      throw new Error("URL must match /grapher/<slug>");
    }
    slug = pathSegments[1].toLocaleLowerCase("en");
  } else {
    slug = trimmed.toLocaleLowerCase("en");
  }

  if (!slugPattern.test(slug)) {
    throw new Error("slug contains unsupported characters");
  }

  return {
    slug,
    canonicalUrl: `https://ourworldindata.org/grapher/${slug}`,
  };
}

export function normalizeOwidInput(input: string, format: "csv" | "json" | "txt"): NormalizeReport {
  const report: NormalizeReport = { accepted: [], duplicates: [], invalid: [] };
  const seen = new Set<string>();
  let candidates: Candidate[];

  try {
    if (format === "csv") {
      candidates = candidatesFromCsv(input);
    } else if (format === "json") {
      candidates = candidatesFromJson(input);
    } else {
      candidates = candidatesFromText(input);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "input could not be parsed";
    report.invalid.push({ line: 1, input: "", reason });
    return report;
  }

  for (const candidate of candidates) {
    try {
      const normalized = normalizeLocator(candidate.input);
      if (seen.has(normalized.slug)) {
        report.duplicates.push({
          line: candidate.line,
          input: candidate.input,
          slug: normalized.slug,
          reason: "duplicate slug",
        });
        continue;
      }
      seen.add(normalized.slug);
      report.accepted.push({ ...candidate, ...normalized });
    } catch (error) {
      report.invalid.push({
        line: candidate.line,
        input: candidate.input,
        reason: error instanceof Error ? error.message : "input could not be normalized",
      });
    }
  }

  return report;
}
