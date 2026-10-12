import { useState } from "react";
import { useCatalogStore } from "@/store/catalogStore";
import { useToastStore } from "@/store/toastStore";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";

export function AdminSettings() {
  const settings = useCatalogStore((s) => s.settings);
  const updateSettings = useCatalogStore((s) => s.updateSettings);
  const push = useToastStore((s) => s.push);
  const [form, setForm] = useState(settings);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateSettings(form);
    push("Store settings saved", "success");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Store Settings</h1>
        <p className="text-sm text-ink-500">Configure store-wide information used across the site.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-ink-200 bg-cream-50 p-6">
        <Input label="Store Name" required value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
        <Textarea label="Tagline" required value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Contact Email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <Input label="Contact Phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
        </div>
        <Input label="Store Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Tax Rate (%)"
            type="number"
            step="0.1"
            value={form.taxRatePercent}
            onChange={(e) => setForm({ ...form, taxRatePercent: Number(e.target.value) })}
          />
          <Input
            label="Flat Shipping Rate ($)"
            type="number"
            step="0.01"
            value={form.flatShippingRate}
            onChange={(e) => setForm({ ...form, flatShippingRate: Number(e.target.value) })}
          />
          <Input
            label="Express Shipping Rate ($)"
            type="number"
            step="0.01"
            value={form.expressShippingRate}
            onChange={(e) => setForm({ ...form, expressShippingRate: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Free Shipping Threshold ($)"
          type="number"
          step="1"
          value={form.freeShippingThreshold}
          onChange={(e) => setForm({ ...form, freeShippingThreshold: Number(e.target.value) })}
        />
        <Button type="submit">Save Settings</Button>
      </form>
    </div>
  );
}
