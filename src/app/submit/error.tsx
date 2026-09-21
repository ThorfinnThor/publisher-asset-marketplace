"use client";

export default function SubmitError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell submission-page">
      <section className="creator-auth-card" aria-labelledby="submit-error-heading">
        <p className="eyebrow">Temporarily unavailable</p>
        <h1 id="submit-error-heading">The submission page could not be loaded.</h1>
        <p>Your account and submission data are safe. Please try again in a moment.</p>
        <button className="button button--primary" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
