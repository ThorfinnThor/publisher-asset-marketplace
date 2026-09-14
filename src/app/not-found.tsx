import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
        Not found
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-emerald-950">
        This asset is not published.
      </h1>
      <p className="mt-4 leading-7 text-emerald-950/65">
        Assets appear only after their source metadata and reuse conditions have been reviewed.
      </p>
      <Link className="mt-8 inline-flex font-semibold text-emerald-800 underline" href="/search">
        Return to search
      </Link>
    </main>
  );
}
