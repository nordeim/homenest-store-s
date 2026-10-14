// Session-24 S24-4 — the REAL engine's P2002 shape feeds the checkout
// recovery loop's tolerant matchers. This is the "checkout P2002
// recovery-loop integration seam" recorded session 12.
//
// Why this must hit a REAL database: placeOrderWithRetry's recovery branch
// depends on uniqueTargetField()/isUniqueViolation() tolerating the LIVE
// meta.target shape the Prisma engine emits on a genuine SQLite collision.
// Every existing pin (session8-hardening.test.ts) feeds SYNTHETIC error
// objects — if the engine's shape drifted, those pins would stay green while
// the recovery loop silently died (the exact failure the S8-3
// tolerant-matching comment warns about). The temp-SQLite harness is the
// review-transactional.test.ts precedent (S13-4).
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";

import { isUniqueViolation, uniqueTargetField } from "@/lib/prisma-errors";

let db: PrismaClient;
let dir: string;

/** The minimal Order.create payload (defaults cover status/money-optional columns). */
function orderRow(overrides: Partial<Prisma.OrderCreateInput> & { number: string }): Prisma.OrderCreateInput {
  return {
    email: "buyer@example.com",
    customerName: "Jordan Rivera",
    subtotal: 3499,
    total: 3499,
    shippingAddress: JSON.stringify({ line1: "1 Main St", city: "Austin" }),
    ...overrides,
  };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "homenest-checkout-recovery-"));
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

describe("the live P2002 shape matches the recovery loop's tolerant matchers (S24-4)", () => {
  it("a genuine idempotency-key collision matches uniqueTargetField(err, 'idempotencyKey')", async () => {
    const winner = await db.order.create({ data: orderRow({ number: "ORD-2099-001", idempotencyKey: "replay-key-1" }) });

    let caught: unknown = null;
    try {
      // A racing first attempt with the SAME key — the shape
      // placeOrderWithRetry's recovery branch is built for.
      await db.order.create({ data: orderRow({ number: "ORD-2099-002", idempotencyKey: "replay-key-1" }) });
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBeNull();
    // The tolerant matcher must recognize the LIVE engine shape — today the
    // field-array form; the constraint-name string form stays covered by the
    // synthetic pins. Stripping either branch of the matcher fails here.
    expect(isUniqueViolation(caught)).toBe(true);
    expect(uniqueTargetField(caught, "idempotencyKey")).toBe(true);
    expect(winner.number).toBe("ORD-2099-001");
  });

  it("a genuine number collision is a unique violation but does NOT match the key field (cross-field discrimination)", async () => {
    await db.order.create({ data: orderRow({ number: "ORD-2099-003", idempotencyKey: "replay-key-2" }) });

    let caught: unknown = null;
    try {
      // A DIFFERENT key on an already-taken number — the number-collision
      // retry path (the loop's `continue` branch), never the replay branch.
      await db.order.create({ data: orderRow({ number: "ORD-2099-003", idempotencyKey: "replay-key-9" }) });
    } catch (error) {
      caught = error;
    }

    expect(caught).not.toBeNull();
    expect(isUniqueViolation(caught)).toBe(true);
    expect(uniqueTargetField(caught, "number")).toBe(true);
    // The discrimination that keeps a number clash from resolving a replay.
    expect(uniqueTargetField(caught, "idempotencyKey")).toBe(false);
  });

  it("the recovery read findUnique({ where: { idempotencyKey } }) returns the winning row", async () => {
    await db.order.create({ data: orderRow({ number: "ORD-2099-004", idempotencyKey: "replay-key-3" }) });

    // The exact call shape placeOrderWithRetry uses after a key collision.
    const found = await db.order.findUnique({ where: { idempotencyKey: "replay-key-3" } });

    expect(found).not.toBeNull();
    expect(found?.number).toBe("ORD-2099-004");
    expect(found?.email).toBe("buyer@example.com");
  });
});
