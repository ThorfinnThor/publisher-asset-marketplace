export const gaMeasurementId = "G-NJETCBLLNE";
export const consentStorageKey = "citesupply-analytics-consent-v1";
export const openConsentEvent = "citesupply:open-cookie-settings";

export type ConsentChoice = "granted" | "denied";

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
} & Record<string, unknown>;

// Signed-in, admin, private preview and publisher embed surfaces never load or send to GA.
// Embeds additionally run under `script-src 'none'`, so the client component cannot execute there.
const EXCLUDED_PREFIXES = [
  "/admin",
  "/auth",
  "/creator/assets",
  "/creator/dashboard",
  "/dashboard",
  "/embed",
  "/submit",
  "/_editorial",
  "/%5Feditorial",
];

export function isAnalyticsExcludedPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix.toLowerCase()}/`),
  );
}

export function readConsent(): ConsentChoice | null {
  try {
    const value = window.localStorage.getItem(consentStorageKey);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function storeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(consentStorageKey, choice);
  } catch {
    // Storage blocked: the choice applies to this page view only.
  }
}

// gtag.js is injected only after an explicit opt-in, so no request reaches Google without consent.
export function loadGoogleAnalytics(): void {
  const w = window as unknown as GtagWindow;
  w[`ga-disable-${gaMeasurementId}`] = false;
  if (w.gtag) {
    w.gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  w.dataLayer = w.dataLayer ?? [];
  const dataLayer = w.dataLayer;
  w.gtag = function gtag() {
    // gtag.js expects the arguments object, not an array.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  w.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  w.gtag("consent", "update", { analytics_storage: "granted" });
  w.gtag("js", new Date());
  w.gtag("config", gaMeasurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    // vinext client navigation is invisible to gtag's history listener, so page views are sent
    // explicitly by the consent component for every public pathname.
    send_page_view: false,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
  document.head.appendChild(script);
}

export function trackPageView(): void {
  const w = window as unknown as GtagWindow;
  w.gtag?.("event", "page_view", {
    page_location: window.location.href,
    page_title: document.title,
  });
}

// Pauses an already loaded gtag (e.g. after client navigation into an excluded area) without
// touching the stored choice.
export function pauseGoogleAnalytics(): void {
  (window as unknown as GtagWindow)[`ga-disable-${gaMeasurementId}`] = true;
}

export function disableGoogleAnalytics(): void {
  const w = window as unknown as GtagWindow;
  w[`ga-disable-${gaMeasurementId}`] = true;
  w.gtag?.("consent", "update", { analytics_storage: "denied" });
  deleteGoogleAnalyticsCookies();
}

export function isGoogleAnalyticsCookie(name: string): boolean {
  return name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name.startsWith("_gat");
}

function deleteGoogleAnalyticsCookies(): void {
  const labels = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < labels.length - 1; i += 1) {
    domains.push(`; domain=.${labels.slice(i).join(".")}`);
  }
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !isGoogleAnalyticsCookie(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}
