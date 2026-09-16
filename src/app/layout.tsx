import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Publisher Asset Marketplace",
    template: "%s | Publisher Asset Marketplace",
  },
  description: "Find source-hosted charts and tools with clear reuse information.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <Link className="brand" href="/" aria-label="Publisher Assets home">
              <span aria-hidden="true" className="brand__mark">
                PA
              </span>
              <span>Publisher Assets</span>
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
                PA
              </span>
              <span>Publisher Assets</span>
            </Link>
            <p>Source links and rights evidence stay visible. Backlinks are never guaranteed.</p>
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
