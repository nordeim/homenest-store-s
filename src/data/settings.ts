import type { StoreSettings } from "@/types";

export const defaultSettings: StoreSettings = {
  storeName: "HomeNest Kitchen",
  tagline:
    "Your professional destination for premium kitchen essentials, organized storage solutions, and gourmet cooking tools designed to elevate your culinary experience.",
  currency: "USD",
  currencySymbol: "$",
  taxRatePercent: 7.5,
  flatShippingRate: 6.95,
  expressShippingRate: 18.95,
  freeShippingThreshold: 75,
  contactEmail: "care@homenestkitchen.com",
  contactPhone: "+1 (800) 555-0142",
  address: "148 Copper Row, Portland, OR 97204, United States",
  socialLinks: [
    { platform: "Instagram", url: "https://instagram.com" },
    { platform: "Pinterest", url: "https://pinterest.com" },
    { platform: "Facebook", url: "https://facebook.com" },
    { platform: "TikTok", url: "https://tiktok.com" },
  ],
};
