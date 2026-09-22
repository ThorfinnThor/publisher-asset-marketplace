import type { PublicAssetEventType } from "@/lib/analytics/events";

let ephemeralSessionId: string | null = null;

export type SearchAnalyticsPayload = {
  query: string;
  resultCount: number;
  assetIds: string[];
};

export async function recordAssetAnalyticsEvent(
  assetSlug: string,
  eventType: PublicAssetEventType,
): Promise<void> {
  const sessionId = getAnonymousSessionId();
  if (!sessionId) return;
  try {
    await fetch(`/api/analytics/asset/${encodeURIComponent(assetSlug)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-anonymous-session-id": sessionId,
      },
      body: JSON.stringify({ event_type: eventType }),
      keepalive: true,
    });
  } catch {
    // Analytics must not block browsing or source navigation.
  }
}

export async function recordAssetAction(
  assetSlug: string,
  action: "embed" | "citation",
): Promise<void> {
  const sessionId = getAnonymousSessionId();
  if (!sessionId) return;
  try {
    await fetch(`/api/assets/${encodeURIComponent(assetSlug)}/${action}-copy`, {
      method: "POST",
      headers: { "x-anonymous-session-id": sessionId },
      keepalive: true,
    });
  } catch {
    // Copying remains successful even when analytics is temporarily unavailable.
  }
}

export async function recordSearchAnalytics(payload: SearchAnalyticsPayload): Promise<void> {
  const sessionId = getAnonymousSessionId();
  if (!sessionId) return;
  try {
    await fetch("/api/analytics/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-anonymous-session-id": sessionId,
      },
      body: JSON.stringify({
        query: payload.query,
        result_count: payload.resultCount,
        asset_ids: payload.assetIds,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must not block search rendering.
  }
}

export function getAnonymousSessionId(): string | null {
  try {
    if (ephemeralSessionId && isAnonymousSessionId(ephemeralSessionId)) {
      return ephemeralSessionId;
    }
    ephemeralSessionId = crypto.randomUUID();
    return ephemeralSessionId;
  } catch {
    return null;
  }
}

function isAnonymousSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
