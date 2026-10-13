import { z } from "zod";

/**
 * Store-settings boundary schemas — extracted from the admin server action
 * (session-13 C8) so the clamps are unit-pinnable and every consumer shares
 * one definition. Pure zod; no db / next imports (import-safe in Vitest).
 */

/** Plain numeric string ("7.5", "42") clamped to a range. */
export function numericSetting(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) >= min && Number(v) <= max, {
      message: `Enter a number between ${min} and ${max}.`,
    })
    .transform((v) => String(Number(v)));
}

/** Whole-number string (cents amounts arriving from the dollars input). */
export function integerSetting(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, {
      message: `Enter a whole number between ${min} and ${max}.`,
    });
}

/** Optional social profile URL — http(s) only, or blank to clear. */
export function socialSetting() {
  return z
    .string()
    .trim()
    .max(200, "URL is too long")
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Enter a valid http(s) URL (or leave blank)")
    .transform((v) => v);
}

export const settingsPatchSchema = z
  .object({
    storeName: z.string().trim().min(1, "Store name is required").max(80).optional(),
    tagline: z.string().trim().min(1, "Tagline is required").max(200).optional(),
    contactEmail: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address")
      .optional(),
    contactPhone: z.string().trim().min(3, "Phone is required").max(40).optional(),
    address: z.string().trim().min(3, "Address is required").max(200).optional(),
    taxRatePercent: numericSetting(0, 100).optional(),
    standardShippingCents: integerSetting(0, 1000000).optional(),
    expressShippingCents: integerSetting(0, 1000000).optional(),
    freeShippingThresholdCents: integerSetting(0, 1000000).optional(),
    socialInstagram: socialSetting().optional(),
    socialPinterest: socialSetting().optional(),
    socialFacebook: socialSetting().optional(),
    socialTikTok: socialSetting().optional(),
  })
  .strip();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
