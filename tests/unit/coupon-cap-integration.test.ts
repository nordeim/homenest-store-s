/**
 * Session-25 S25-5 — the coupon redemption guard against the REAL engine.
 *
 * Every prior pin for `couponRedemptionFilter` is SYNTHETIC (the session-20
 * truth table inspects the where-clause OBJECT shape). If the filter
 * drifted — dropping the always-on `isActive` guard or the `timesUsed` cap
 * clause — those pins would stay green while the checkout's atomic guard
 * silently weakened. This harness runs the LIVE increment call shape from
 * the checkout transaction (`src/app/api/checkout/route.ts:312-313`)
 * against a REAL temporary SQLite database, so the guard's semantics are
 * proven by the engine itself, not by shape reflection.
 */
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { couponRedemptionFilter } from "@/lib/coupons";

let db: PrismaClient;
let dir: string;

/** Seed one coupon row with exactly the given lifecycle facts. */
async function seedCoupon(code: string, facts: { maxRedemptions: number | null; timesUsed: number; isActive: boolean }): Promise<void> {
  await db.coupon.upsert({
    where: { code },
    update: { ...facts },
    create: {
      code,
      type: "percent",
      value: 10,
      description: "Integration test coupon",
      minSubtotal: 0,
      ...facts,
    },
  });
}

/** The EXACT increment shape the checkout transaction runs (route.ts:312-313). */
async function runLiveIncrement(code: string, maxRedemptions: number | null): Promise<{ count: number }> {
  return db.$transaction((tx) =>
    tx.coupon.updateMany({
      where: couponRedemptionFilter(code, maxRedemptions),
      data: { timesUsed: { increment: 1 } },
    }),
  );
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "homenest-coupon-cap-"));
  const url = `file:${join(dir, "test.db")}`;
  // Push the schema into the temp file with a dedicated engine run; the
  // client instance below is pointed at the same file via datasourceUrl so
  // no process env (or the sandbox's DATABASE_URL shadow) is involved.
  execSync("npx prisma db push --skip-generate", {
    cwd: join(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  db = new PrismaClient({ datasourceUrl: url });
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("couponRedemptionFilter against the real engine (S25-5)", () => {
  it("at-cap: the guarded increment lands count 0 and never touches the row", async () => {
    await seedCoupon("CAPFULL", { maxRedemptions: 5, timesUsed: 5, isActive: true });

    const redeemed = await runLiveIncrement("CAPFULL", 5);
    expect(redeemed.count).toBe(0);

    const row = await db.coupon.findUnique({ where: { code: "CAPFULL" } });
    expect(row?.timesUsed).toBe(5);
  });

  it("one-under cap: count 1 and the increment actually lands", async () => {
    await seedCoupon("CAPROOM", { maxRedemptions: 5, timesUsed: 4, isActive: true });

    const redeemed = await runLiveIncrement("CAPROOM", 5);
    expect(redeemed.count).toBe(1);

    const row = await db.coupon.findUnique({ where: { code: "CAPROOM" } });
    expect(row?.timesUsed).toBe(5);
  });

  it("deactivated with budget remaining: the always-on isActive guard blocks the increment", async () => {
    await seedCoupon("CAPDEAD", { maxRedemptions: 5, timesUsed: 1, isActive: false });

    const redeemed = await runLiveIncrement("CAPDEAD", 5);
    expect(redeemed.count).toBe(0);

    const row = await db.coupon.findUnique({ where: { code: "CAPDEAD" } });
    expect(row?.timesUsed).toBe(1);
  });

  it("unlimited coupon (maxRedemptions null): no cap clause, the increment lands at any timesUsed", async () => {
    await seedCoupon("CAPFREE", { maxRedemptions: null, timesUsed: 9_999, isActive: true });

    const redeemed = await runLiveIncrement("CAPFREE", null);
    expect(redeemed.count).toBe(1);

    const row = await db.coupon.findUnique({ where: { code: "CAPFREE" } });
    expect(row?.timesUsed).toBe(10_000);
  });
});
