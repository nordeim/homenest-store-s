"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateSettingsAction } from "@/lib/actions/admin";
import { parseDollarsToCents } from "@/lib/money";
import type { StoreSettings } from "@/lib/settings";
import { useToast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsFormState = {
  storeName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  taxRatePercent: string;
  standardShippingDollars: string;
  expressShippingDollars: string;
  freeShippingThresholdDollars: string;
  socialInstagram: string;
  socialPinterest: string;
  socialFacebook: string;
  socialTikTok: string;
};

function toFormState(settings: StoreSettings): SettingsFormState {
  return {
    storeName: settings.storeName,
    tagline: settings.tagline,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    address: settings.address,
    taxRatePercent: String(settings.taxRatePercent),
    standardShippingDollars: (settings.standardShippingCents / 100).toFixed(2),
    expressShippingDollars: (settings.expressShippingCents / 100).toFixed(2),
    freeShippingThresholdDollars: (settings.freeShippingThresholdCents / 100).toFixed(2),
    socialInstagram: settings.socialInstagram,
    socialPinterest: settings.socialPinterest,
    socialFacebook: settings.socialFacebook,
    socialTikTok: settings.socialTikTok,
  };
}

/**
 * Admin settings form — dollars ⇄ cents conversion happens here: the three
 * shipping/threshold fields are edited in dollars and submitted as integer
 * cents; the tax rate is submitted as a plain percent number.
 */
export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = React.useState<SettingsFormState>(() => toFormState(settings));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setField<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const shippingCents = parseDollarsToCents(form.standardShippingDollars);
    if (shippingCents === null) {
      setError("Enter a valid dollar amount for standard shipping (e.g. 6.95).");
      return;
    }
    const expressCents = parseDollarsToCents(form.expressShippingDollars);
    if (expressCents === null) {
      setError("Enter a valid dollar amount for express shipping (e.g. 18.95).");
      return;
    }
    const thresholdCents = parseDollarsToCents(form.freeShippingThresholdDollars);
    if (thresholdCents === null) {
      setError("Enter a valid dollar amount for the free-shipping threshold (e.g. 50).");
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(form.taxRatePercent.trim()) || Number(form.taxRatePercent) < 0 || Number(form.taxRatePercent) > 100) {
      setError("Enter a tax rate between 0 and 100 percent.");
      return;
    }

    setPending(true);
    try {
      const result = await updateSettingsAction({
        storeName: form.storeName.trim(),
        tagline: form.tagline.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        address: form.address.trim(),
        taxRatePercent: form.taxRatePercent.trim(),
        standardShippingCents: String(shippingCents),
        expressShippingCents: String(expressCents),
        freeShippingThresholdCents: String(thresholdCents),
        socialInstagram: form.socialInstagram.trim(),
        socialPinterest: form.socialPinterest.trim(),
        socialFacebook: form.socialFacebook.trim(),
        socialTikTok: form.socialTikTok.trim(),
      });
      if (result.ok) {
        toast({ title: "Store settings saved", description: "Changes are live across the storefront.", variant: "success" });
        router.refresh();
      } else {
        setError(result.error);
        toast({ title: "Could not save settings", description: result.error, variant: "destructive" });
      }
    } catch {
      // Session-13 S13-2: unknown errors must be visible, never silent.
      setError("Something went wrong. Please try again.");
      toast({ title: "Something went wrong", description: "The settings did not save. Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Store Identity */}
      <section aria-labelledby="settings-identity" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 id="settings-identity" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Store Identity
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-store-name">Store name</Label>
            <Input
              id="settings-store-name"
              value={form.storeName}
              onChange={(e) => setField("storeName", e.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-tagline">Tagline</Label>
            <Input
              id="settings-tagline"
              value={form.tagline}
              onChange={(e) => setField("tagline", e.target.value)}
              maxLength={200}
              required
            />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section aria-labelledby="settings-contact" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 id="settings-contact" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Contact
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-email">Contact email</Label>
            <Input
              id="settings-email"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setField("contactEmail", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-phone">Contact phone</Label>
            <Input
              id="settings-phone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setField("contactPhone", e.target.value)}
              required
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="settings-address">Address</Label>
          <Input
            id="settings-address"
            value={form.address}
            onChange={(e) => setField("address", e.target.value)}
            maxLength={200}
            required
          />
        </div>
      </section>

      {/* Commerce */}
      <section aria-labelledby="settings-commerce" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 id="settings-commerce" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Commerce
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="settings-tax">Tax rate (%)</Label>
            <Input
              id="settings-tax"
              type="text"
              inputMode="decimal"
              value={form.taxRatePercent}
              onChange={(e) => setField("taxRatePercent", e.target.value)}
              placeholder="7.5"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-standard-shipping">Standard shipping ($)</Label>
            <Input
              id="settings-standard-shipping"
              type="text"
              inputMode="decimal"
              value={form.standardShippingDollars}
              onChange={(e) => setField("standardShippingDollars", e.target.value)}
              placeholder="6.95"
              required
            />
            <p className="text-xs text-muted-foreground">Enter dollars.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-express-shipping">Express shipping ($)</Label>
            <Input
              id="settings-express-shipping"
              type="text"
              inputMode="decimal"
              value={form.expressShippingDollars}
              onChange={(e) => setField("expressShippingDollars", e.target.value)}
              placeholder="18.95"
              required
            />
            <p className="text-xs text-muted-foreground">Enter dollars.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-free-threshold">Free shipping threshold ($)</Label>
            <Input
              id="settings-free-threshold"
              type="text"
              inputMode="decimal"
              value={form.freeShippingThresholdDollars}
              onChange={(e) => setField("freeShippingThresholdDollars", e.target.value)}
              placeholder="50"
              required
            />
            <p className="text-xs text-muted-foreground">Enter dollars.</p>
          </div>
        </div>
      </section>

      {/* Social */}
      <section aria-labelledby="settings-social" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 id="settings-social" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Social
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-instagram">Instagram URL</Label>
            <Input
              id="settings-instagram"
              type="url"
              value={form.socialInstagram}
              onChange={(e) => setField("socialInstagram", e.target.value)}
              placeholder="https://instagram.com/homenest"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-pinterest">Pinterest URL</Label>
            <Input
              id="settings-pinterest"
              type="url"
              value={form.socialPinterest}
              onChange={(e) => setField("socialPinterest", e.target.value)}
              placeholder="https://pinterest.com/homenest"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-facebook">Facebook URL</Label>
            <Input
              id="settings-facebook"
              type="url"
              value={form.socialFacebook}
              onChange={(e) => setField("socialFacebook", e.target.value)}
              placeholder="https://facebook.com/homenest"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-tiktok">TikTok URL</Label>
            <Input
              id="settings-tiktok"
              type="url"
              value={form.socialTikTok}
              onChange={(e) => setField("socialTikTok", e.target.value)}
              placeholder="https://tiktok.com/@homenest"
            />
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} size="lg">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save Settings
        </Button>
      </div>
    </form>
  );
}
