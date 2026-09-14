import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submission moderation",
  robots: { index: false, follow: false },
};

export default function AdminSubmissionsPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight text-emerald-950">
        Submission moderation
      </h1>
      <p className="mt-5 text-emerald-950/65">
        Manual moderation will be implemented after the publisher search and analytics gates pass.
      </p>
    </main>
  );
}
