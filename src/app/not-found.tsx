import Link from "next/link";

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
