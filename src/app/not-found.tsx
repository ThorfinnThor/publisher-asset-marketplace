import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  return (
    <main className="page-shell not-found-page">
      <p className="eyebrow">Not found</p>
      <h1 className="page-title">This asset is not published.</h1>
      <p className="page-intro">
        Assets appear only after their source metadata and reuse conditions have been reviewed.
      </p>
      <Link className="button button--primary" href="/search">
        Return to search
      </Link>
    </main>
  );
}
