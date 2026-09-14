import { normalizeQuery } from "./normalize-query";

export const demandQueryNormalizationVersion = "demand-query-v1" as const;

export type DemandQuerySuppressionReason =
  | "empty"
  | "too_long"
  | "sensitive_email"
  | "sensitive_secret"
  | "sensitive_phone"
  | "high_entropy_identifier";

export type DemandQueryNormalization = {
  version: typeof demandQueryNormalizationVersion;
  search_normalized: string;
  aggregation_key: string | null;
  display_query: string | null;
  tokens: string[];
  aggregation_eligible: boolean;
  suppression_reason: DemandQuerySuppressionReason | null;
};

const inflectionMap: Readonly<Record<string, string>> = {
  rates: "rate",
  prices: "price",
  charts: "chart",
  datasets: "dataset",
  benchmarks: "benchmark",
  calculators: "calculator",
  accounts: "account",
  users: "user",
  countries: "country",
  technologies: "technology",
  emissions: "emission",
  percentages: "percentage",
};

const phraseAliases: ReadonlyArray<readonly [readonly string[], readonly string[]]> = [
  [["gross", "domestic", "product"], ["gdp"]],
  [["carbon", "dioxide"], ["co2"]],
  [
    ["solar", "photovoltaic"],
    ["solar", "pv"],
  ],
  [["year", "over", "year"], ["yoy"]],
  [
    ["saas", "churn", "rate"],
    ["saas", "churn"],
  ],
  [["percentage"], ["percent"]],
];

const unicodeLetter = /^\p{L}$/u;
const unicodeNumber = /^\p{N}$/u;
const apostrophe = /[\u0027\u2019]/u;

function isLetter(value: string | undefined): boolean {
  return value !== undefined && unicodeLetter.test(value);
}

function isNumber(value: string | undefined): boolean {
  return value !== undefined && unicodeNumber.test(value);
}

function isEmail(value: string): boolean {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/u.test(value);
}

function isJwt(value: string): boolean {
  return /(?:^|\s)[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:$|\s)/u.test(value);
}

function isCredential(value: string): boolean {
  return /(?:^|\s)(?:api[_-]?key|access[_-]?token|auth[_-]?token|bearer|secret|token|sk-|pk_|rk_|ghp_|github_pat_|xox[bpars]-|AIza|AKIA)[A-Za-z0-9_-]{16,}(?:$|\s)/iu.test(
    value,
  );
}

function isPhone(value: string): boolean {
  const digits = value.replace(/\D/gu, "");
  return digits.length >= 10 && /^[\d\s()+-]+$/u.test(value);
}

function isHighEntropyIdentifier(value: string): boolean {
  return value.split(/\s+/u).some((token) => {
    return token.length >= 32 && /[A-Za-z]/u.test(token) && /\d/u.test(token);
  });
}

function suppressionReason(value: string): DemandQuerySuppressionReason | null {
  if (isEmail(value)) return "sensitive_email";
  if (isJwt(value)) return "sensitive_secret";
  if (isCredential(value)) return "sensitive_secret";
  if (isPhone(value)) return "sensitive_phone";
  if (isHighEntropyIdentifier(value)) return "high_entropy_identifier";
  return null;
}

function structuralTokens(value: string): string[] {
  const characters = Array.from(value);
  let candidate = "";
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] as string;
    const previous = characters[index - 1];
    const next = characters[index + 1];

    if (isLetter(character) || isNumber(character)) {
      candidate += character;
      continue;
    }
    if (apostrophe.test(character) && isLetter(previous) && isLetter(next)) {
      continue;
    }
    if (character === "%") {
      candidate += " percent ";
      continue;
    }
    if (character === "&") {
      candidate += " and ";
      continue;
    }
    if (
      character === "+" &&
      (isLetter(previous) || isLetter(next) || previous === "+" || next === "+")
    ) {
      candidate += character;
      continue;
    }
    if (character === "." && isNumber(previous) && isNumber(next)) {
      candidate += character;
      continue;
    }
    candidate += " ";
  }
  return candidate.trim().split(/\s+/u).filter(Boolean);
}

function applyAliases(tokens: string[]): string[] {
  const inflected = tokens.map((token) => inflectionMap[token] ?? token);
  const result: string[] = [];
  let index = 0;
  while (index < inflected.length) {
    const alias = phraseAliases.find(([input]) =>
      input.every((token, offset) => inflected[index + offset] === token),
    );
    if (alias) {
      result.push(...alias[1]);
      index += alias[0].length;
    } else {
      result.push(inflected[index] as string);
      index += 1;
    }
  }
  return result;
}

export function normalizeDemandQuery(input: string): DemandQueryNormalization {
  const searchNormalized = normalizeQuery(input);
  if (!searchNormalized) {
    return suppressed(searchNormalized, "empty");
  }
  if (searchNormalized.length > 120) {
    return suppressed(searchNormalized, "too_long");
  }

  const sensitiveReason = suppressionReason(searchNormalized);
  if (sensitiveReason) {
    return suppressed(searchNormalized, sensitiveReason);
  }

  const tokens = applyAliases(structuralTokens(searchNormalized));
  if (tokens.length === 0) {
    return suppressed(searchNormalized, "empty");
  }
  const key = tokens.join(" ");
  return {
    version: demandQueryNormalizationVersion,
    search_normalized: searchNormalized,
    aggregation_key: key,
    display_query: key,
    tokens,
    aggregation_eligible: true,
    suppression_reason: null,
  };
}

function suppressed(
  searchNormalized: string,
  reason: DemandQuerySuppressionReason,
): DemandQueryNormalization {
  return {
    version: demandQueryNormalizationVersion,
    search_normalized: searchNormalized,
    aggregation_key: null,
    display_query: null,
    tokens: [],
    aggregation_eligible: false,
    suppression_reason: reason,
  };
}
