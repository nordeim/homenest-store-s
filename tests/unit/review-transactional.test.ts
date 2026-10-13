/**
 * Session-13 S13-4 — the review insert and the aggregate growth share ONE
 * transaction.
 *
 * These cases run against a REAL temporary SQLite database (not mocks): the
 * S13-4 defect was transactional-shape, so the regression pin has to prove
 * the DB semantics the folded action relies on — a failure anywhere inside
 * the transaction rolls the review insert back, and the success path grows
 * the denormalized aggregate (the S8-2 growth rule, now in the same tx).
 */
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { growReviewAggregate } from "@/lib/review-aggregate";

let db: PrismaClient;
let dir: string;
const reviewData = {
  productId: "product-1",
  rating: 1,
  title: "Not for me",
  comment: "Edge arrived misaligned.",
  author: "Integration Test",
  userId: null,
  verified: false,
} as const;

/** Each case starts from a clean slate: no reviews, baseline product (4.7 × 10). */
async function ensureProduct(): Promise<void> {
  await db.review.deleteMany();
  await db.category.upsert({
    where: { id: "cat-1" },
    update: {},
    create: { id: "cat-1", name: "Test Category", slug: "test-category" },
  });
  await db.product.upsert({
    where: { id: "product-1" },
    update: { rating: 4.7, reviewCount: 10 },
    create: {
      id: "product-1",
      name: "Test Knife",
      slug: "test-knife",
      description: "A test product.",
      categoryId: "cat-1",
      price: 19999,
      sku: "TEST-KNIFE",
      stock: 10,
      rating: 4.7,
      reviewCount: 10,
      isActive: true,
    },
  });
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "homenest-review-tx-"));
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

describe("review create + aggregate growth in one transaction (S13-4)", () => {
  it("commits the insert and grows the aggregate when everything succeeds", async () => {
    await ensureProduct();

    await db.$transaction(async (tx) => {
      await tx.review.create({ data: reviewData });
      await growReviewAggregate(tx, "product-1", 1);
    });

    const product = await db.product.findUnique({ where: { id: "product-1" } });
    expect(await db.review.count()).toBe(1);
    // (4.7 × 10 + 1) / 11 = 4.3636… → 4.4 (one decimal, the S8-2 growth rule)
    expect(product?.rating).toBeCloseTo(4.4, 5);
    expect(product?.reviewCount).toBe(11);
  });

  it("rolls the insert back when the aggregate write fails inside the transaction", async () => {
    await ensureProduct();
    await expect(
      db.$transaction(async (tx) => {
        await tx.review.create({ data: reviewData });
        // Any aggregate-side failure (here: a P2025 on a vanished product
        // row — the same class of failure a concurrent delete causes) must
        // undo the insert that preceded it in the same tx.
        await tx.product.update({ where: { id: "product-vanished" }, data: { reviewCount: 1 } });
      }),
    ).rejects.toThrow();

    expect(await db.review.count()).toBe(0);
  });

  it("documents the S13-4 defect shape: outside one transaction the orphan persists", async () => {
    await ensureProduct();
    // The pre-fix shape — create OUTSIDE the tx, grow inside (or not at all)
    // — leaves an uncounted row behind when the aggregate write fails. This
    // case pins the failure mode the action no longer has.
    await db.review.create({ data: { ...reviewData, title: "Orphan" } });
    await expect(
      db.product.update({ where: { id: "product-vanished" }, data: { reviewCount: 1 } }),
    ).rejects.toThrow();
    expect(await db.review.count()).toBe(1);
  });
});
