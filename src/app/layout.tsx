import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/json-ld";
import { buildSiteJsonLd, siteSeo } from "@/lib/seo";
import { siteBrand } from "@/lib/site-identity";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://citesupply.com"),
  title: {
    default: siteSeo.title,
    template: `%s | ${siteBrand.name}`,
  },
  description: siteSeo.description,
  applicationName: siteBrand.name,
  creator: siteBrand.name,
  publisher: siteBrand.name,
  category: "data publishing",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { address: false, email: false, telephone: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: siteBrand.name,
    title: siteSeo.title,
    description: siteSeo.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteSeo.title,
    description: siteSeo.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <JsonLd value={buildSiteJsonLd()} />
        <header className="site-header">
          <div className="site-header__inner">
            <Link className="brand" href="/" aria-label={`${siteBrand.name} home`}>
              <span aria-hidden="true" className="brand__mark">
                {siteBrand.mark}
              </span>
              <span>{siteBrand.name}</span>
            </Link>
            <nav aria-label="Primary" className="site-nav">
              <Link href="/search">Browse</Link>
              <Link href="/opportunities">Opportunities</Link>
              <Link href="/#topics">Topics</Link>
              <Link href="/#publishers">For publishers</Link>
              <Link href="/creator/guide">Creator guide</Link>
            </nav>
            <div className="site-header__actions">
              <Link className="mobile-browse" href="/search">
                Browse
              </Link>
              <Link className="header-login" href="/creator/dashboard">
                Log in
              </Link>
              <Link className="button button--secondary button--small" href="/submit">
                Publish an asset
              </Link>
            </div>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <Link className="brand brand--footer" href="/">
              <span aria-hidden="true" className="brand__mark">
                {siteBrand.mark}
              </span>
              <span>{siteBrand.name}</span>
            </Link>
            <p>
              {siteBrand.tagline} Source links and rights evidence stay visible. Backlinks are never
              guaranteed.
            </p>
            <nav aria-label="Footer">
              <Link href="/search">Browse</Link>
              <Link href="/submit">Publish</Link>
              <Link href="/creator/guide">Creator guide</Link>
              <Link href="/creator/terms">Creator terms</Link>
              <Link href="/legal-notice">Impressum</Link>
              <Link href="/report">Meldung</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
