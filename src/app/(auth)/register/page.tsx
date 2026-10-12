import type { Metadata } from "next";

import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic"; // per-request CSP nonce — see (auth)/layout.tsx

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your HomeNest Kitchen account for faster checkout, saved addresses, order tracking, and a synced wishlist.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
