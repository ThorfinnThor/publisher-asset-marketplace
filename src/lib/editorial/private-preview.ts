import hicpHtml from "../../../docs/editorial/previews/cb-003-hicp-private-rendered.html?raw";
import renewablesHtml from "../../../docs/editorial/previews/cb-002-renewables-private-rendered.html?raw";

export type PrivateEditorialPreview = {
  briefId: string;
  html: string;
  expectedSha256: string;
};

const previews = new Map<string, PrivateEditorialPreview>([
  [
    "cb-002-eu-renewable-share-patterns",
    {
      briefId: "cb-002-eu-renewable-share-patterns",
      html: renewablesHtml,
      expectedSha256: "9c405aff27dfa7c8b1f7fb3ef5c3c50d450781a6ed910070739fed972a211323",
    },
  ],
  [
    "cb-003-hicp-inflation-explainer",
    {
      briefId: "cb-003-hicp-inflation-explainer",
      html: hicpHtml,
      expectedSha256: "8e4585c6a4536ee61f2eb8cec484048fb11df27662695b5a08dbc1ca74a2694d",
    },
  ],
]);

export function privateEditorialPreviewHeaders(): Headers {
  return new Headers({
    "cache-control": "private, no-store",
    "content-security-policy":
      "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; connect-src 'none'",
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
}

export async function getVerifiedPrivateEditorialPreview(
  briefId: string,
): Promise<PrivateEditorialPreview | null> {
  const preview = previews.get(briefId);
  if (!preview) return null;
  const actualSha256 = await sha256(preview.html);
  return actualSha256 === preview.expectedSha256 ? preview : null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
