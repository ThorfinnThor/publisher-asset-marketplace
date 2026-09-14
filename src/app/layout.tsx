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
        <header className="border-b border-emerald-950/10 bg-[#f6f5ef]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link className="font-semibold tracking-tight text-emerald-950" href="/">
              Publisher Asset Marketplace
            </Link>
            <nav
              aria-label="Primary"
              className="flex items-center gap-5 text-sm text-emerald-950/75"
            >
              <Link className="hover:text-emerald-950" href="/search">
                Search
              </Link>
              <Link className="hover:text-emerald-950" href="/submit">
                Submit
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-6xl px-6 py-12 text-sm text-emerald-950/60">
          Source links and rights evidence stay visible. Backlinks are never guaranteed.
        </footer>
      </body>
    </html>
  );
}
