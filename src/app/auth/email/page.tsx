import type { Metadata } from "next";

import { MagicLinkRedeemer } from "@/components/magic-link-redeemer";

export const metadata: Metadata = {
  title: "Email sign-in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EmailSignInPage() {
  return (
    <main className="page-shell auth-callback-page">
      <section className="creator-auth-card" aria-labelledby="email-sign-in-heading">
        <p className="eyebrow">Creator access</p>
        <h1 id="email-sign-in-heading">Email sign-in</h1>
        <MagicLinkRedeemer />
      </section>
    </main>
  );
}
