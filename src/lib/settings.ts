import { db } from "@/lib/db";

/** Typed view over the StoreSetting key/value table. */
export type StoreSettings = {
  storeName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  taxRatePercent: number;
  standardShippingCents: number;
  expressShippingCents: number;
  freeShippingThresholdCents: number;
  socialInstagram: string;
  socialPinterest: string;
  socialFacebook: string;
  socialTikTok: string;
};

const DEFAULTS: StoreSettings = {
  storeName: "HomeNest",
  tagline: "Premium home & kitchen products for the modern lifestyle",
  contactEmail: "hello@homenest.com",
  contactPhone: "+1 (555) 123-4567",
  address: "123 Kitchen Lane, Home City, HC 10001",
  taxRatePercent: 7.5,
  standardShippingCents: 695,
  expressShippingCents: 1895,
  freeShippingThresholdCents: 5000,
  socialInstagram: "https://instagram.com",
  socialPinterest: "https://pinterest.com",
  socialFacebook: "https://facebook.com",
  socialTikTok: "https://tiktok.com",
};

/** Load all settings with defaults for anything missing. One query. */
export async function getSettings(): Promise<StoreSettings> {
  const rows = await db.storeSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: keyof StoreSettings, fallback: number) => {
    const raw = map.get(key);
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const str = (key: keyof StoreSettings, fallback: string) => map.get(key) ?? fallback;
  return {
    storeName: str("storeName", DEFAULTS.storeName),
    tagline: str("tagline", DEFAULTS.tagline),
    contactEmail: str("contactEmail", DEFAULTS.contactEmail),
    contactPhone: str("contactPhone", DEFAULTS.contactPhone),
    address: str("address", DEFAULTS.address),
    taxRatePercent: num("taxRatePercent", DEFAULTS.taxRatePercent),
    standardShippingCents: num("standardShippingCents", DEFAULTS.standardShippingCents),
    expressShippingCents: num("expressShippingCents", DEFAULTS.expressShippingCents),
    freeShippingThresholdCents: num("freeShippingThresholdCents", DEFAULTS.freeShippingThresholdCents),
    socialInstagram: str("socialInstagram", DEFAULTS.socialInstagram),
    socialPinterest: str("socialPinterest", DEFAULTS.socialPinterest),
    socialFacebook: str("socialFacebook", DEFAULTS.socialFacebook),
    socialTikTok: str("socialTikTok", DEFAULTS.socialTikTok),
  };
}

/** Persist a patch of settings (admin) — atomically, so a mid-loop failure never persists a partial patch. */
export async function updateSettings(patch: Partial<Record<keyof StoreSettings, string>>): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  await db.$transaction(
    entries.map(([key, value]) =>
      db.storeSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    ),
  );
}
