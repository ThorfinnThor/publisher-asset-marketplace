import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Search</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-emerald-950 sm:text-5xl">
        Find data, calculators, and charts you can publish.
      </h1>
      <form className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="search-query">
          Search publisher-ready assets
        </label>
        <input
          className="min-w-0 flex-1 rounded-xl border border-emerald-950/15 bg-white px-5 py-4 shadow-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
          defaultValue={query}
          id="search-query"
          name="q"
          placeholder="life expectancy Germany"
          type="search"
        />
        <button
          className="rounded-xl bg-emerald-950 px-6 py-4 font-semibold text-white"
          type="submit"
        >
          Search
        </button>
      </form>

      <section
        className="mt-12 rounded-2xl border border-amber-900/15 bg-amber-50 p-6"
        aria-live="polite"
      >
        <h2 className="font-semibold text-amber-950">
          {query
            ? `Search is not public yet for “${query}”.`
            : "Search indexing is being validated."}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-950/75">
          The first ten records are available to the ingestion normalizer. Results and reuse actions
          remain disabled until the source metadata and asset-level rights classifier pass review.
        </p>
      </section>
    </main>
  );
}
