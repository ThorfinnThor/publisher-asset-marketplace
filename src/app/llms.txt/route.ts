import { PUBLIC_EDITORIAL_ARTICLES } from "@/lib/editorial/public-articles";
import { SITE_ORIGIN, siteSeo } from "@/lib/seo";
import { TOPICS } from "@/lib/topics";

export function GET(): Response {
  const lines = [
    "# Cite Supply",
    "",
    `> ${siteSeo.description}`,
    "",
    "Cite Supply is a discovery catalog for publishers. It lists charts, datasets, tables, calculators and benchmarks while keeping canonical source links, freshness information, citations and reviewed reuse conditions visible.",
    "",
    "Interpretation notes:",
    "- A listing does not imply that Cite Supply owns the underlying source data or is partnered with the named source.",
    "- Check each asset page before reuse. Embed, commercial-use, modification and attribution permissions differ by asset.",
    "- A disabled embed action means Cite Supply has not approved an embed for that asset.",
    "- Prefer the canonical source and methodology linked from an asset when making factual claims.",
    "",
    "## Core pages",
    "",
    link("Cite Supply home", "/", "Overview of the catalog for publishers and creators."),
    link(
      "Browse assets",
      "/search",
      "Search the public catalog and filter by format, source, rights status and freshness.",
    ),
    link(
      "Topics",
      "/topics",
      "Curated subject hubs that explain how to interpret the available measures.",
    ),
    link(
      "Data insights",
      "/insights",
      "Original source-led analysis with methods, citations and links to underlying assets.",
    ),
    link(
      "Creator guide",
      "/creator/guide",
      "Requirements for submitting a canonical page, preview, embed route and rights evidence.",
    ),
    "",
    "## Topic guides",
    "",
    ...TOPICS.map((topic) => link(topic.name, `/topics/${topic.slug}`, topic.seoDescription)),
    "",
    "## Published data insights",
    "",
    ...PUBLIC_EDITORIAL_ARTICLES.map((article) =>
      link(
        article.draft.title,
        `/insights/${article.draft.slug}`,
        `${article.draft.seo_description} Primary data: ${article.sourceLabel}.`,
      ),
    ),
    "",
    "## Policies and reporting",
    "",
    link(
      "Creator terms",
      "/creator/terms",
      "Terms governing asset submissions, declarations, marketplace use and removal.",
    ),
    link(
      "Privacy policy",
      "/privacy",
      "Information about hosting, analytics, authentication, cookies and data processing.",
    ),
    link("Legal notice", "/legal-notice", "Operator identity and legal contact details."),
    link("Report content", "/report", "How to report rights, accuracy or safety concerns."),
    "",
    "## Optional",
    "",
    link(
      "XML sitemap",
      "/sitemap.xml",
      "Selective list of public hubs, articles and assets that passed the search-indexing quality gate.",
    ),
    link(
      "Robots policy",
      "/robots.txt",
      "Crawler access rules and the declared content-use signals.",
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "content-type": "text/markdown; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function link(label: string, path: string, description: string): string {
  return `- [${singleLine(label)}](${new URL(path, SITE_ORIGIN).toString()}): ${singleLine(description)}`;
}

function singleLine(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ").replaceAll(/\s+/g, " ").trim();
}
