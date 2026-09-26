import type { EditorialFactPack } from "./fact-pack-schema";

export function parseEditorialCsv(input: string): { rows: string[][]; lineNumbers: number[] } {
  const rows: string[][] = [];
  const lineNumbers: number[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let sourceLine = 1;
  let rowStart = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
        lineNumbers.push(rowStart);
      }
      row = [];
      field = "";
      sourceLine += 1;
      rowStart = sourceLine;
    } else {
      field += char;
      if (char === "\n") sourceLine += 1;
    }
  }

  if (quoted) throw new Error("csv_unclosed_quote");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
      lineNumbers.push(rowStart);
    }
  }
  if (rows.length < 2) throw new Error("csv_no_observations");
  const width = rows[0]?.length ?? 0;
  if (rows.some((values) => values.length !== width)) throw new Error("csv_row_width_mismatch");
  return { rows, lineNumbers };
}

type OwidParserConfig = {
  expectedHeaders: readonly string[];
  metadataColumnByCsvHeader: Readonly<Record<string, string>>;
  metadata: Record<string, unknown>;
  briefId: string;
};

export function parseOwidEditorialFacts(
  csvText: string,
  config: OwidParserConfig,
): EditorialFactPack["facts"] {
  const { rows, lineNumbers } = parseEditorialCsv(csvText);
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  if (JSON.stringify(headers) !== JSON.stringify(config.expectedHeaders)) {
    throw Object.assign(new Error("owid_header_mismatch"), { code: "owid_header_mismatch" });
  }
  const entityIndex = headers.indexOf("Entity");
  const codeIndex = headers.indexOf("Code");
  const yearIndex = headers.indexOf("Year");
  const series = headers.slice(3);
  const columns = config.metadata.columns as Record<string, Record<string, unknown>> | undefined;
  if (!columns) throw new Error("owid_metadata_columns_missing");

  const facts: EditorialFactPack["facts"] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const name = (row[entityIndex] ?? "").trim();
    const code = (row[codeIndex] ?? "").trim() || null;
    const period = (row[yearIndex] ?? "").trim();
    if (!name || !/^\d{4}$/.test(period)) {
      throw new Error(`owid_invalid_entity_or_year:${lineNumbers[rowIndex]}`);
    }
    for (const column of series) {
      const raw = (row[headers.indexOf(column)] ?? "").trim();
      const value = raw === "" ? null : Number(raw);
      if (value !== null && !Number.isFinite(value)) {
        throw new Error(`owid_non_numeric_value:${lineNumbers[rowIndex]}`);
      }
      const metadataColumn = config.metadataColumnByCsvHeader[column];
      const columnMeta = metadataColumn ? columns[metadataColumn] : undefined;
      if (!columnMeta) throw new Error(`owid_column_metadata_missing:${column}`);
      const shortName = String(columnMeta.shortName ?? column);
      const unit = String(columnMeta.unit ?? "unspecified source unit");
      const valueKey = `${code ?? name}:${period}:${shortName}`
        .toLowerCase()
        .replace(/[^a-z0-9:._-]/g, "-");
      facts.push({
        fact_id: `${config.briefId}:${valueKey}`,
        value,
        unit,
        geography: { name, code, classification: "source_entity_unclassified" },
        period,
        frequency: "annual",
        status_quality_flag: value === null ? "missing_value" : "observed_raw_source_value",
        missing_value: value === null,
        source_row_reference: `csv-line:${lineNumbers[rowIndex]};column:${column}`,
        dimensions: { entity_name: name, entity_code: code ?? "", series: shortName },
      });
    }
  }
  if (facts.length === 0) throw new Error("owid_no_fact_rows");
  return facts;
}

type EurostatParserConfig = {
  expectedDimensions: readonly string[];
  allowedGeoCodes: readonly string[];
  briefId: string;
  allowedDimensionValues?: Readonly<Record<string, readonly string[]>>;
  excludedPeriods?: readonly string[];
};

export function flattenEditorialEurostat(
  data: Record<string, unknown>,
  config: EurostatParserConfig,
): EditorialFactPack["facts"] {
  const ids = data.id;
  const sizes = data.size;
  const dims = data.dimension;
  const values = data.value;
  const statuses = (data.status ?? {}) as Record<string, string>;
  if (
    !Array.isArray(ids) ||
    !Array.isArray(sizes) ||
    typeof dims !== "object" ||
    !dims ||
    (typeof values !== "object" && !Array.isArray(values)) ||
    !values
  ) {
    throw new Error("eurostat_jsonstat_shape_invalid");
  }
  if (JSON.stringify(ids) !== JSON.stringify(config.expectedDimensions)) {
    throw Object.assign(new Error("eurostat_dimension_order_mismatch"), {
      code: "eurostat_dimension_order_mismatch",
    });
  }
  const dimensions = dims as Record<
    string,
    { category?: { index?: Record<string, number> | string[]; label?: Record<string, string> } }
  >;
  const geoIndex = dimensions.geo?.category?.index;
  if (!geoIndex) throw new Error("eurostat_geo_dimension_missing");
  const responseGeoCodes = Array.isArray(geoIndex)
    ? geoIndex
    : Object.entries(geoIndex)
        .sort((a, b) => a[1] - b[1])
        .map(([code]) => code);
  if (
    responseGeoCodes.length !== config.allowedGeoCodes.length ||
    config.allowedGeoCodes.some((code) => !responseGeoCodes.includes(code))
  ) {
    throw Object.assign(new Error("eurostat_geo_scope_mismatch"), {
      code: "eurostat_geo_scope_mismatch",
    });
  }

  const dimList = (ids as string[]).map((id, index) => {
    const dimension = dimensions[id];
    const categoryIndex = dimension?.category?.index;
    if (!categoryIndex) throw new Error(`eurostat_category_index_missing:${id}`);
    const codes = Array.isArray(categoryIndex)
      ? categoryIndex
      : Object.entries(categoryIndex)
          .sort((a, b) => a[1] - b[1])
          .map(([code]) => code);
    return {
      id,
      size: Number(sizes[index]),
      codes,
      labels: dimension.category?.label ?? {},
    };
  });
  if (dimList.some((dimension) => !Number.isInteger(dimension.size) || dimension.size < 1)) {
    throw new Error("eurostat_dimension_size_invalid");
  }
  const sizeProduct = dimList.reduce((product, dimension) => product * dimension.size, 1);
  if (dimList.some((dimension) => dimension.codes.length !== dimension.size)) {
    throw new Error("eurostat_dimension_size_mismatch");
  }
  const flatKeys = Array.isArray(values)
    ? values.map((_, index) => String(index))
    : Object.keys(values);
  if (
    flatKeys.some((key) => !/^\d+$/.test(key) || Number(key) >= sizeProduct) ||
    Object.keys(statuses).some((key) => !/^\d+$/.test(key) || Number(key) >= sizeProduct)
  ) {
    throw new Error("eurostat_value_index_invalid");
  }
  const facts: EditorialFactPack["facts"] = [];

  for (let index = 0; index < sizeProduct; index += 1) {
    let remaining = index;
    const positions = new Array(dimList.length);
    for (let dimensionIndex = dimList.length - 1; dimensionIndex >= 0; dimensionIndex -= 1) {
      const size = dimList[dimensionIndex]?.size ?? 0;
      positions[dimensionIndex] = remaining % size;
      remaining = Math.floor(remaining / size);
    }
    const codes = Object.fromEntries(
      dimList.map((dimension, dimensionIndex) => {
        const code = dimension.codes[positions[dimensionIndex]];
        if (!code) throw new Error(`eurostat_dimension_code_missing:${dimension.id}`);
        return [dimension.id, code];
      }),
    );
    if (
      Object.entries(config.allowedDimensionValues ?? {}).some(
        ([dimension, allowed]) => !allowed.includes(codes[dimension] ?? ""),
      ) ||
      (config.excludedPeriods ?? []).includes(codes.time ?? "")
    ) {
      continue;
    }
    const rawValue = Array.isArray(values)
      ? values[index]
      : Object.hasOwn(values, String(index))
        ? (values as Record<string, unknown>)[String(index)]
        : undefined;
    const value = rawValue === null || rawValue === undefined ? null : Number(rawValue);
    if (value !== null && !Number.isFinite(value)) {
      throw new Error("eurostat_non_numeric_value");
    }
    const status = statuses[String(index)] ?? "";
    const geoCode = codes.geo;
    const geoDimension = dimList.find((dimension) => dimension.id === "geo");
    const geographyName = geoCode
      ? (geoDimension?.labels[geoCode] ?? geoCode)
      : "unspecified geography";
    const timeCode = codes.time ?? "unspecified period";
    facts.push({
      fact_id: `${config.briefId}:${geoCode ?? "geo"}:${timeCode}:${index}`
        .toLowerCase()
        .replace(/[^a-z0-9:._-]/g, "-"),
      value,
      unit:
        dimList.find((dimension) => dimension.id === "unit")?.labels[codes.unit ?? ""] ??
        codes.unit ??
        "unspecified source unit",
      geography: {
        name: geographyName,
        code: geoCode ?? null,
        classification: "source_entity_unclassified",
      },
      period: timeCode,
      frequency:
        dimList.find((dimension) => dimension.id === "freq")?.labels[codes.freq ?? ""] ??
        codes.freq ??
        null,
      status_quality_flag: status || (value === null ? "missing_value" : "observed_no_status_flag"),
      missing_value: value === null,
      source_row_reference: `json-stat-index:${index}`,
      dimensions: codes,
    });
  }
  if (facts.length === 0) throw new Error("eurostat_no_fact_rows");
  return facts;
}

export function eurostatStatusLabels(data: Record<string, unknown>): Record<string, string> {
  const extension = data.extension;
  if (!extension || typeof extension !== "object") return {};
  const status = (extension as Record<string, unknown>).status;
  if (!status || typeof status !== "object") return {};
  const label = (status as Record<string, unknown>).label;
  if (!label || typeof label !== "object") return {};
  return Object.fromEntries(
    Object.entries(label as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
