import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight text-emerald-950">Creator dashboard</h1>
      <p className="mt-5 text-emerald-950/65">
        This route is reserved for the creator milestone and is not active in the publisher-first
        release.
      </p>
    </main>
  );
}
