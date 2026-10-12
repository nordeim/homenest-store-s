"use client";

// Global error boundary — the last line of defense when the ROOT layout
// itself throws. Must render its own <html>/<body> (nothing else renders at
// that point). Kept deliberately dependency-free so it can never fail the
// same way the app just did. Session-5 audit S5-3.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf7f2",
          color: "#1f2937",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: "0 24px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6b7280", margin: "0 0 24px" }}>
            The store hit an unexpected error. Please try again in a moment.
            {error?.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#c2410c",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
