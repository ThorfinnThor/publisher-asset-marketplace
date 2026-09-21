"use client";

export default function AssetError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <div className="notice notice--error" role="alert">
        <strong>This asset is temporarily unavailable.</strong> The marketplace could not load its
        data. Please try again.
      </div>
      <button className="button button--secondary" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
