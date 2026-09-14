import Link from "next/link";

const principles = [
  ["Publisher-first", "Search, preview, cite, and embed without an account."],
  ["Source-hosted", "Use approved canonical embeds instead of rebuilding third-party assets."],
  [
    "Rights-aware",
    "Keep embed, commercial, modification, attribution, and raw-data rights separate.",
  ],
] as const;

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.25fr_0.75fr] lg:py-28">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Publisher utility first
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-emerald-950 sm:text-7xl">
            Find charts and tools you can confidently publish.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-emerald-950/70">
            Search reusable calculators, charts, benchmarks, datasets, and mini-tools. See the
            source, freshness, citation, and exact reuse conditions before you publish.
          </p>
          <form action="/search" className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="home-search">
              Search publisher-ready assets
            </label>
            <input
              className="min-w-0 flex-1 rounded-xl border border-emerald-950/15 bg-white px-5 py-4 text-base shadow-sm outline-none placeholder:text-emerald-950/35 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
              id="home-search"
              name="q"
              placeholder="Try: life expectancy Germany"
              type="search"
            />
            <button
              className="rounded-xl bg-emerald-950 px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-emerald-800"
              type="submit"
            >
              Find assets
            </button>
          </form>
        </div>

        <aside className="rounded-3xl border border-emerald-950/10 bg-emerald-950 p-8 text-white shadow-xl shadow-emerald-950/10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            First validation slice
          </p>
          <p className="mt-5 text-3xl font-semibold tracking-tight">10 audited OWID assets</p>
          <p className="mt-4 leading-7 text-emerald-50/75">
            The complete 3,000-item corpus stays out of public search until ingestion and
            asset-level rights checks are proven end to end.
          </p>
          <Link
            className="mt-8 inline-flex rounded-lg bg-white px-4 py-3 text-sm font-semibold text-emerald-950"
            href="/search"
          >
            View search foundation
          </Link>
        </aside>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-3">
          {principles.map(([title, description]) => (
            <article className="rounded-2xl border border-emerald-950/10 bg-white p-6" key={title}>
              <h2 className="font-semibold text-emerald-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-950/65">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
