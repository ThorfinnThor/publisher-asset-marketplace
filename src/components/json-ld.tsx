import { serializeJsonLd } from "@/lib/seo";

export function JsonLd({ value }: { value: Record<string, unknown> }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(value) }}
      type="application/ld+json"
    />
  );
}
