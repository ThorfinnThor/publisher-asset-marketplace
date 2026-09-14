import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit an asset",
  robots: { index: false, follow: false },
};

export default function SubmitPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
        Creator submissions
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-emerald-950">
        Submissions open after publisher search is proven.
      </h1>
      <p className="mt-5 max-w-2xl leading-7 text-emerald-950/65">
        The first milestone measures real publisher demand before adding creator accounts and the
        moderation queue.
      </p>
    </main>
  );
}
