import type { Metadata } from "next";

import { getSettings } from "@/lib/settings";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Settings" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Store-wide configuration used across the storefront — identity, contact details, commerce
          rules and social links.
        </p>
      </header>

      <SettingsForm settings={settings} />
    </div>
  );
}
