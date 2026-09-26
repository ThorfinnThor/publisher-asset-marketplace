import { SITE_ORIGIN } from "@/lib/seo";

const excludedPaths = ["/_editorial/", "/api/", "/e/", "/embed/"];

export function GET(): Response {
  const rules = [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference",
    "Allow: /",
    ...excludedPaths.map((path) => `Disallow: ${path}`),
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    ...excludedPaths.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ];

  return new Response(rules.join("\n"), {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
