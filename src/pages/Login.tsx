import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const push = useToastStore((s) => s.push);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/account";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Unable to sign in");
      return;
    }
    push("Welcome back!", "success");
    navigate(redirectTo, { replace: true });
  }

  function fillDemo(role: "admin" | "customer") {
    setEmail(role === "admin" ? "admin@homenestkitchen.com" : "demo@homenestkitchen.com");
    setPassword(role === "admin" ? "Admin123!" : "Demo1234!");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink-900">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-500">Sign in to manage orders, wishlists and more.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>

      <div className="mt-5 rounded-lg bg-ink-50 p-3.5 text-xs text-ink-500">
        <p className="font-semibold text-ink-700">Demo accounts</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => fillDemo("customer")} className="rounded-md border border-ink-200 px-2.5 py-1 font-medium hover:bg-cream-50">
            Use Customer Demo
          </button>
          <button onClick={() => fillDemo("admin")} className="rounded-md border border-ink-200 px-2.5 py-1 font-medium hover:bg-cream-50">
            Use Admin Demo
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-500">
        New here?{" "}
        <Link to="/register" className="font-semibold text-forest-800 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
