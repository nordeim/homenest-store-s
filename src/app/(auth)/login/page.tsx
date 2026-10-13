import type { Metadata } from "next";

import { demoModeEnabled } from "@/lib/demo-mode";
import { getSettings } from "@/lib/settings";

import { LoginForm, type DemoAccount } from "./login-form";

export const dynamic = "force-dynamic"; // per-request CSP nonce — see (auth)/layout.tsx

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your HomeNest Kitchen account to track orders, manage addresses, and keep your wishlist in sync.",
  // Session-8 S8-9: utility pages — keep them out of the index.
  robots: { index: false, follow: true },
};

/**
 * Demo quick-fill is an evaluation affordance for development builds.
 * Session-12 S12-2: OFF by default in production (the box names the seeded
 * ADMIN credentials), opt-in with NEXT_PUBLIC_DEMO_MODE="true". Session-13
 * S13-1: the flag is computed HERE, server-side, and the credentials are
 * passed as props ONLY when enabled — production builds (flag unset) ship
 * no credential strings in the client bundle at all. See .env.example and
 * docs/DEPLOYMENT.md.
 */
const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    label: "Customer demo",
    email: "demo@homenestkitchen.com",
    password: "Demo1234!",
  },
  {
    label: "Admin demo",
    email: "admin@homenestkitchen.com",
    password: "Admin123!",
  },
];

export default async function LoginPage() {
  // Session-11 S11-5: the "Forgot password?" mailto follows the admin-editable
  // settings.contactEmail (the S7-5 sweep's last hardcoded shadow).
  const settings = await getSettings().catch(() => null);
  const showDemoBox = demoModeEnabled({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  });
  return (
    <LoginForm
      contactEmail={settings?.contactEmail ?? "hello@homenest.com"}
      demoAccounts={showDemoBox ? DEMO_ACCOUNTS : undefined}
    />
  );
}
