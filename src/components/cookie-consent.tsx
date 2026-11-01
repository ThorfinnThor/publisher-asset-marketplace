"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  consentDecidedAttribute,
  disableGoogleAnalytics,
  isAnalyticsExcludedPath,
  loadGoogleAnalytics,
  openConsentEvent,
  pauseGoogleAnalytics,
  readConsent,
  storeConsent,
  trackPageView,
  type ConsentChoice,
} from "@/lib/analytics/consent";

// Opt-in banner for Google Analytics 4. Nothing is requested from Google before "Accept";
// the footer button reopens the banner so consent can be withdrawn at any time.
// It renders open on the server (outside excluded paths) so it paints with the page;
// the head script hides it before paint for a reader who already chose, and the first
// effect run then removes it.
export function CookieConsent() {
  const pathname = usePathname();
  const excluded = isAnalyticsExcludedPath(pathname);
  const [open, setOpen] = useState(!excluded);
  const settled = useRef(false);

  useEffect(() => {
    const reopen = () => {
      document.documentElement.removeAttribute(consentDecidedAttribute);
      setOpen(true);
    };
    window.addEventListener(openConsentEvent, reopen);
    return () => window.removeEventListener(openConsentEvent, reopen);
  }, []);

  useEffect(() => {
    const stored = readConsent();
    if (!settled.current) {
      settled.current = true;
      if (stored !== null) setOpen(false);
    }
    if (excluded) {
      pauseGoogleAnalytics();
      return;
    }
    if (stored === "granted") {
      loadGoogleAnalytics();
      // Let the new route commit its document title before the page view is queued.
      const timer = window.setTimeout(trackPageView, 0);
      return () => window.clearTimeout(timer);
    }
    if (stored === null) setOpen(true);
  }, [excluded, pathname]);

  function choose(choice: ConsentChoice) {
    storeConsent(choice);
    if (choice === "denied") disableGoogleAnalytics();
    else if (!excluded) {
      loadGoogleAnalytics();
      trackPageView();
    }
    setOpen(false);
  }

  if (!open || pathname.startsWith("/embed")) return null;
  return (
    <section
      aria-describedby="cookie-consent-text"
      aria-labelledby="cookie-consent-title"
      aria-modal="false"
      className="cookie-consent"
      role="dialog"
    >
      <p className="cookie-consent__title" id="cookie-consent-title">
        Audience measurement
      </p>
      <p className="cookie-consent__text" id="cookie-consent-text">
        With your consent, Cite Supply uses Google Analytics 4 to understand how many people visit
        its public pages. This sets cookies and transfers data to Google, including to the United
        States. Without consent, Google Analytics is not loaded. You can change your choice at any
        time via “Cookie settings” in the footer.{" "}
        <a href="/privacy#privacy-4-google-analytics-4">Details in the privacy policy</a>
      </p>
      <div className="cookie-consent__actions">
        <button className="button button--secondary" onClick={() => choose("denied")} type="button">
          Decline
        </button>
        <button
          className="button button--secondary"
          onClick={() => choose("granted")}
          type="button"
        >
          Accept
        </button>
      </div>
    </section>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      className="cookie-settings-link"
      onClick={() => window.dispatchEvent(new Event(openConsentEvent))}
      type="button"
    >
      Cookie settings
    </button>
  );
}
