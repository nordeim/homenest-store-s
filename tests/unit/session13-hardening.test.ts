import { describe, expect, it } from "vitest";

import { demoModeEnabled } from "@/lib/demo-mode";
import { utcMonthStart } from "@/lib/analytics";
import { clientIp } from "@/lib/rate-limit";
import { settingsPatchSchema } from "@/lib/settings-schema";

// ---------------------------------------------------------------------------
// S13-1 — the demo quick-fill flag is computed once, server-side, purely
// ---------------------------------------------------------------------------

describe("demoModeEnabled (S13-1: server-side flag, unit-pinned truth table)", () => {
  it("is OFF in production by default (the box names the seeded admin)", () => {
    expect(demoModeEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(demoModeEnabled({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: undefined })).toBe(false);
  });

  it("is ON in production only with an explicit opt-in", () => {
    expect(demoModeEnabled({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "true" })).toBe(true);
  });

  it("stays OFF in production even with a stale dev default string", () => {
    expect(demoModeEnabled({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "false" })).toBe(false);
    expect(demoModeEnabled({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "garbage" })).toBe(false);
  });

  it("is ON in dev by default (unchanged developer experience)", () => {
    expect(demoModeEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(demoModeEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("is OFF in dev only with an explicit opt-out", () => {
    expect(demoModeEnabled({ NODE_ENV: "development", NEXT_PUBLIC_DEMO_MODE: "false" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S13-6 — "Revenue This Month" shares the chart's UTC day boundaries
// ---------------------------------------------------------------------------

describe("utcMonthStart (S13-6: UTC month boundary, timezone-independent)", () => {
  it("returns UTC midnight of the first of the month", () => {
    expect(utcMonthStart(new Date("2026-10-13T04:20:00.000Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("rolls over at the UTC month boundary (not the local one)", () => {
    expect(utcMonthStart(new Date("2026-01-01T00:00:00.000Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(utcMonthStart(new Date("2025-12-31T23:59:59.999Z")).toISOString()).toBe(
      "2025-12-01T00:00:00.000Z",
    );
  });

  it("is independent of the host timezone (a TZ-shifted wall clock still buckets by UTC)", () => {
    // 2026-03-01 02:30 in UTC+8 is still 2026-02-28 18:30Z — the UTC February bucket.
    const instant = new Date("2026-02-28T18:30:00.000Z");
    expect(utcMonthStart(instant).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// S13-7 — clientIp keeps the session-6 precedence by default and gains an
// explicit opt-out for direct (no trusted edge) deployments
// ---------------------------------------------------------------------------

describe("clientIp TRUST_CF_CONNECTING_IP opt-out (S13-7)", () => {
  const h = (headers: Record<string, string>) => new Headers(headers);

  it("default preserves the session-6 invariant: cf-connecting-ip wins", () => {
    expect(
      clientIp(h({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4, 198.51.100.7" })),
    ).toBe("198.51.100.7");
  });

  it("trustCf:false ignores the (client-forgeable) cf header on direct deploys", () => {
    expect(
      clientIp(h({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "1.2.3.4, 203.0.113.7" }), {
        trustCf: false,
      }),
    ).toBe("203.0.113.7");
  });

  it("trustCf:false with no XFF falls through to the shared direct bucket", () => {
    expect(clientIp(h({ "cf-connecting-ip": "6.6.6.6" }), { trustCf: false })).toBe("direct");
  });
});

// ---------------------------------------------------------------------------
// C8 — the store-settings patch schema is a pure, exported boundary
// ---------------------------------------------------------------------------

describe("settingsPatchSchema clamps (C8)", () => {
  it("accepts an in-range tax rate and normalizes it", () => {
    const parsed = settingsPatchSchema.safeParse({ taxRatePercent: "7.5" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.taxRatePercent).toBe("7.5");
  });

  it("rejects an out-of-range tax rate (0–100)", () => {
    expect(settingsPatchSchema.safeParse({ taxRatePercent: "100.1" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ taxRatePercent: "-1" }).success).toBe(false);
  });

  it("rejects non-numeric and partially-numeric strings", () => {
    expect(settingsPatchSchema.safeParse({ taxRatePercent: "abc" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ taxRatePercent: "7.5x" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ taxRatePercent: "" }).success).toBe(false);
  });

  it("bounds the shipping cents (0–1,000,000) and rejects fractions", () => {
    expect(settingsPatchSchema.safeParse({ standardShippingCents: "0" }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ standardShippingCents: "1000000" }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ standardShippingCents: "1000001" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ expressShippingCents: "5.5" }).success).toBe(false);
  });

  it("rejects javascript: social URLs while accepting http(s) and blank", () => {
    expect(settingsPatchSchema.safeParse({ socialInstagram: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ socialInstagram: "https://instagram.com/homenest" }).success).toBe(
      true,
    );
    expect(settingsPatchSchema.safeParse({ socialInstagram: "" }).success).toBe(true);
  });

  it("strips unknown keys and trims whitespace", () => {
    const parsed = settingsPatchSchema.safeParse({
      storeName: "  HomeNest  ",
      isAdmin: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.storeName).toBe("HomeNest");
      expect("isAdmin" in parsed.data).toBe(false);
    }
  });
});
