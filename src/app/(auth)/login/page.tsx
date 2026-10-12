import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic"; // per-request CSP nonce — see (auth)/layout.tsx

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your HomeNest Kitchen account to track orders, manage addresses, and keep your wishlist in sync.",
  // Session-8 S8-9: utility pages — keep them out of the index.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginForm />;
}
