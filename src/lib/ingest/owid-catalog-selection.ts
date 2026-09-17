import type { AcceptedInput } from "./normalize-input";

export function selectMissingOwidAssets(
  catalogue: readonly AcceptedInput[],
  existingSlugs: ReadonlySet<string>,
  excludedSlugs: ReadonlySet<string> = new Set(),
): AcceptedInput[] {
  return catalogue.filter(
    (asset) => !existingSlugs.has(asset.slug) && !excludedSlugs.has(asset.slug),
  );
}

function csvField(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function owidAssetsToCsv(assets: readonly AcceptedInput[]): string {
  return `${[
    "asset_url,title",
    ...assets.map(
      (asset) => `${csvField(asset.canonicalUrl)},${csvField(asset.title ?? asset.slug)}`,
    ),
  ].join("\n")}\n`;
}
