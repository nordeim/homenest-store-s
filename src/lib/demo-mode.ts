/**
 * Demo quick-fill flag — the single source of truth for whether the login
 * page's demo-credentials box renders.
 *
 * Session-12 S12-2 made the box OFF by default in production builds (it
 * names the seeded ADMIN account); session-13 S13-1 moved the flag itself
 * behind the server boundary — the credentials are owned by the (server)
 * login page and passed as props ONLY when this helper is true, so the
 * strings never compile into the client bundle. Unit-pinned truth table in
 * tests/unit/session13-hardening.test.ts; see .env.example and
 * docs/DEPLOYMENT.md.
 */
export function demoModeEnabled(env: {
  NODE_ENV?: string | undefined;
  NEXT_PUBLIC_DEMO_MODE?: string | undefined;
}): boolean {
  if (env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return env.NODE_ENV !== "production";
}
