/**
 * Session-26 S26-3 — the checkout money path against the REAL engine.
 *
 * The temp-SQLite harness family is three strong (P2002 recovery S24-4,
 * coupon cap S25-5, saveAddress S25-6) but each pins ONE seam. This harness
 * runs the FULL `placeOrderTx` — the codebase's money authority, extracted
 * verbatim into `src/lib/order-placement.ts` with the db client injected —
 * against a REAL temporary SQLite database: every monetary amount is
 * re-derived from the live product rows INSIDE the transaction (the args'
 * cosmetic cart-summary mirrors are ignored), the receipt snapshots the
 * in-tx product rows, stock reserves via the conditional decrements, the
 * coupon burns with the order through the guarded increment, ONLY the
 * ordered cart lines clear (the concurrent-tab line survives), and the
 * best-effort address save never blocks placement. Pins that previously ran
 * only under HTTP (e2e) or synthetic `$transaction` mocks (C1) now run
 * against the engine itself.
 */
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import {
  CheckoutError,
  placeOrderTx,
  type PlaceOrderArgs,
} from "@/lib/order-placement";
import type { CartLine } from "@/lib/cart";

let db: PrismaClient;
let dir: string;

const SETTINGS = {
  freeShippingThresholdCents: 5000,
  standardShippingCents: 699,
  expressShippingCents: 1499,
  taxRatePercent: 8,
};

const ADDRESS = {
  label: "Home",
  fullName: "Guest Guest",
  phone: "+1 555 000 0000",
  line1: "1 Main Street",
  line2: "",
  city: "Testville",
  state: "TS",
  postalCode: "12345",
  country: "United States",
};

type World = {
  tag: string;
  p1Id: string;
  p2Id: string;
  p3Id: string;
  userId: string;
  cartId: string;
  line1Id: string;
  line2Id: string;
  couponCode: string | null;
};

/**
 * Seed a self-contained world (unique tag suffixes keep the tests
 * independent). p3 exists as the concurrent-tab line's product: the
 * CartItem @@unique([cartId, productId]) means a surviving unordered line
 * must be a DIFFERENT product than the ordered ones.
 */
async function seedWorld(
  tag: string,
  facts: {
    p1Stock?: number;
    p2Stock?: number;
    coupon?: { maxRedemptions: number | null; timesUsed: number; type?: string; value?: number } | null;
    addressCount?: number;
  } = {},
): Promise<World> {
  const cat = await db.category.create({ data: { slug: `cat-${tag}`, name: `Category ${tag}` } });
  const p1 = await db.product.create({
    data: {
      slug: `p1-${tag}`, name: `Product One ${tag}`, description: "d", categoryId: cat.id,
      price: 1000, sku: `SKU-P1-${tag}`, stock: facts.p1Stock ?? 10,
      images: JSON.stringify(["/images/p1.png"]),
    },
  });
  const p2 = await db.product.create({
    data: {
      slug: `p2-${tag}`, name: `Product Two ${tag}`, description: "d", categoryId: cat.id,
      price: 500, sku: `SKU-P2-${tag}`, stock: facts.p2Stock ?? 3,
      images: JSON.stringify(["/images/p2.png"]),
    },
  });
  const p3 = await db.product.create({
    data: {
      slug: `p3-${tag}`, name: `Product Three ${tag}`, description: "d", categoryId: cat.id,
      price: 700, sku: `SKU-P3-${tag}`, stock: 5,
      images: JSON.stringify(["/images/p3.png"]),
    },
  });
  const user = await db.user.create({ data: { email: `u-${tag}@test.dev`, name: `User ${tag}` } });
  const cart = await db.cart.create({ data: { token: `token-${tag}`, userId: user.id } });
  // The ordered lines ride in the cart too (what the summary read left
  // behind) — the lines below carry their REAL CartItem ids, exactly what
  // getCartSummary hands the tx in production.
  const li1 = await db.cartItem.create({ data: { cartId: cart.id, productId: p1.id, quantity: 2 } });
  const li2 = await db.cartItem.create({ data: { cartId: cart.id, productId: p2.id, quantity: 1 } });
  // The concurrent-tab line: p3 in the cart but NOT in args.lines (a tab
  // added it after the summary read).
  await db.cartItem.create({ data: { cartId: cart.id, productId: p3.id, quantity: 1 } });
  for (let i = 0; i < (facts.addressCount ?? 0); i++) {
    await db.address.create({
      data: { userId: user.id, label: `A${i}`, fullName: `User ${tag}`, phone: "+1 555 000 0000", line1: `${i} Book St`, city: "Testville", state: "TS", postalCode: "12345" },
    });
  }
  let couponCode: string | null = null;
  if (facts.coupon) {
    couponCode = `SAVE10-${tag.toUpperCase()}`;
    await db.coupon.create({
      data: {
        code: couponCode, type: facts.coupon.type ?? "percent", value: facts.coupon.value ?? 10,
        description: "Harness coupon", minSubtotal: 0,
        maxRedemptions: facts.coupon.maxRedemptions, timesUsed: facts.coupon.timesUsed,
      },
    });
  }
  return { tag, p1Id: p1.id, p2Id: p2.id, p3Id: p3.id, userId: user.id, cartId: cart.id, line1Id: li1.id, line2Id: li2.id, couponCode };
}

/**
 * Cart summary lines with GARBAGE cosmetic mirrors (stale names, absurd
 * prices/stocks) — if the tx ever trusted them, the money/receipt pins fail
 * loudly. This is the TOCTOU-proof proof: only the in-tx product rows count.
 */
function linesFor(w: World, p1Qty = 2, p2Qty = 1): CartLine[] {
  return [
    {
      id: w.line1Id, productId: w.p1Id, name: "STALE SUMMARY NAME", slug: "stale-slug-1",
      image: "/images/p1.png", unitPrice: 999_999, quantity: p1Qty, stock: 9999, lineTotal: 9_999_999,
    },
    {
      id: w.line2Id, productId: w.p2Id, name: "STALE SUMMARY TWO", slug: "stale-slug-2",
      image: "/images/p2.png", unitPrice: 1, quantity: p2Qty, stock: 9999, lineTotal: 123,
    },
  ];
}

function argsFor(w: World, lines: CartLine[], overrides: Partial<PlaceOrderArgs> = {}): PlaceOrderArgs {
  return {
    cartId: w.cartId,
    userId: null,
    email: "guest@test.dev",
    customerName: "Guest Guest",
    lines,
    couponCode: w.couponCode,
    shippingMethod: "standard",
    paymentMethod: "cod",
    cardLast4: null,
    shippingAddressJson: JSON.stringify(ADDRESS),
    saveAddress: false,
    address: ADDRESS,
    idempotencyKey: null,
    cartToken: `cart-token-${w.tag}`,
    settings: SETTINGS,
    ...overrides,
  };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "homenest-place-order-"));
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

describe("placeOrderTx against the real engine (S26-3)", () => {
  it("derives ALL money from the live product rows inside the tx — the args mirrors are ignored", async () => {
    const w = await seedWorld("money", { coupon: { maxRedemptions: null, timesUsed: 0 } });

    const number = await placeOrderTx(db, "ORD-2026-201", argsFor(w, linesFor(w)));
    expect(number).toBe("ORD-2026-201");

    const order = await db.order.findUnique({ where: { number } });
    expect(order).not.toBeNull();
    // subtotal = 1000×2 + 500×1 — from the LIVE rows, not the 999_999/1 mirrors
    expect(order!.subtotal).toBe(2500);
    // discount = round(2500 × 10%) = 250 — the in-tx coupon math
    expect(order!.discount).toBe(250);
    // taxable 2250 < threshold 5000 → standard shipping
    expect(order!.shipping).toBe(699);
    // tax = round(2250 × 8%) = 180; total = 2250 + 699 + 180
    expect(order!.tax).toBe(180);
    expect(order!.total).toBe(3129);
  });

  it("snapshots the receipt from the in-tx product row, the image from the line", async () => {
    const w = await seedWorld("receipt");

    const number = await placeOrderTx(db, "ORD-2026-202", argsFor(w, linesFor(w)));
    const order = await db.order.findUnique({ where: { number }, include: { items: true } });
    expect(order).not.toBeNull();

    const item1 = order!.items.find((i) => i.productId === w.p1Id);
    expect(item1).toBeDefined();
    expect(item1!.unitPrice).toBe(1000); // NOT the mirror 999_999
    expect(item1!.nameSnapshot).toBe(`Product One ${w.tag}`); // NOT the stale summary name
    expect(item1!.imageSnapshot).toBe("/images/p1.png"); // the line carries the image
    const item2 = order!.items.find((i) => i.productId === w.p2Id);
    expect(item2!.unitPrice).toBe(500); // NOT the mirror 1
  });

  it("creates the placed OrderEvent and reserves stock with the order", async () => {
    const w = await seedWorld("stock");

    await placeOrderTx(db, "ORD-2026-203", argsFor(w, linesFor(w)));

    const order = await db.order.findUnique({ where: { number: "ORD-2026-203" }, include: { events: true } });
    expect(order!.events).toHaveLength(1);
    expect(order!.events[0]!.type).toBe("placed");
    expect(order!.events[0]!.status).toBe("pending");
    expect(order!.events[0]!.note).toBe("Order placed");
    // Stock reserved: 10→8 and 3→2 (the unordered p3 stays untouched)
    expect((await db.product.findUnique({ where: { id: w.p1Id } }))!.stock).toBe(8);
    expect((await db.product.findUnique({ where: { id: w.p2Id } }))!.stock).toBe(2);
    expect((await db.product.findUnique({ where: { id: w.p3Id } }))!.stock).toBe(5);
  });

  it("burns the coupon with the order — timesUsed lands in the same tx", async () => {
    const w = await seedWorld("burn", { coupon: { maxRedemptions: null, timesUsed: 0 } });

    await placeOrderTx(db, "ORD-2026-204", argsFor(w, linesFor(w)));

    const row = await db.coupon.findUnique({ where: { code: w.couponCode! } });
    expect(row!.timesUsed).toBe(1);
    const order = await db.order.findUnique({ where: { number: "ORD-2026-204" } });
    expect(order!.couponCode).toBe(w.couponCode);
  });

  it("clears ONLY the ordered cart lines — the concurrent-tab line survives (S12-1)", async () => {
    const w = await seedWorld("cartclear");
    // The cart holds the two ordered lines (seeded) + the unordered p3 line
    expect(await db.cartItem.count({ where: { cartId: w.cartId } })).toBe(3);

    await placeOrderTx(db, "ORD-2026-205", argsFor(w, linesFor(w)));

    // The ordered lines are gone; the unordered p3 line survives; p3 stock untouched
    expect(await db.cartItem.count({ where: { cartId: w.cartId, productId: w.p1Id } })).toBe(0);
    expect(await db.cartItem.count({ where: { cartId: w.cartId, productId: w.p2Id } })).toBe(0);
    expect(await db.cartItem.count({ where: { cartId: w.cartId, productId: w.p3Id } })).toBe(1);
    expect((await db.product.findUnique({ where: { id: w.p3Id } }))!.stock).toBe(5);
  });

  it("insufficient stock → CheckoutError 409, no order row, stock untouched (the read-side guard)", async () => {
    const w = await seedWorld("nostock", { p1Stock: 1 });

    await expect(placeOrderTx(db, "ORD-2026-206", argsFor(w, linesFor(w)))).rejects.toBeInstanceOf(CheckoutError);

    expect(await db.order.count({ where: { number: "ORD-2026-206" } })).toBe(0);
    expect((await db.product.findUnique({ where: { id: w.p1Id } }))!.stock).toBe(1);
    expect((await db.product.findUnique({ where: { id: w.p2Id } }))!.stock).toBe(3);
  });

  it("the ATOMIC decrement guard refuses to over-sell — a duplicate-product handoff rolls back (the write-side guard)", async () => {
    // The cart's @@unique([cartId, productId]) means getCartSummary can never
    // produce two lines for one product — but placeOrderTx is the money
    // authority and must not over-sell even when the handoff is malformed.
    // The duplicate line makes the FIRST guarded decrement the "concurrent
    // writer" for the SECOND: read stock 3 passes both read checks, the
    // first decrement lands (3→1), the second's `stock: { gte: 2 }` guard
    // matches nothing → count 0 → 409 → the FULL rollback (the order row was
    // already created — it must be gone, and stock restored to 3).
    const w = await seedWorld("writeguard", { p1Stock: 3 });
    const lines = [linesFor(w, 2, 0)[0]!, { ...linesFor(w, 2, 0)[0]!, id: `dupe-${w.line1Id}` }];

    await expect(placeOrderTx(db, "ORD-2026-212", argsFor(w, lines))).rejects.toBeInstanceOf(CheckoutError);

    expect(await db.order.count({ where: { number: "ORD-2026-212" } })).toBe(0);
    expect((await db.product.findUnique({ where: { id: w.p1Id } }))!.stock).toBe(3);
  });

  it("an invalid coupon → CheckoutError 409, no rows written", async () => {
    const w = await seedWorld("badcoupon");
    const lines = linesFor(w);

    await expect(
      placeOrderTx(db, "ORD-2026-207", argsFor(w, lines, { couponCode: "NOPE-CODE" })),
    ).rejects.toBeInstanceOf(CheckoutError);

    expect(await db.order.count({ where: { number: "ORD-2026-207" } })).toBe(0);
    expect((await db.product.findUnique({ where: { id: w.p1Id } }))!.stock).toBe(10);
  });

  it("an at-cap coupon → CheckoutError 409, no order, timesUsed unchanged (S25-5 at full-tx scale)", async () => {
    const w = await seedWorld("capcoupon", { coupon: { maxRedemptions: 5, timesUsed: 5 } });

    await expect(placeOrderTx(db, "ORD-2026-208", argsFor(w, linesFor(w)))).rejects.toBeInstanceOf(CheckoutError);

    expect(await db.order.count({ where: { number: "ORD-2026-208" } })).toBe(0);
    const row = await db.coupon.findUnique({ where: { code: w.couponCode! } });
    expect(row!.timesUsed).toBe(5);
  });

  it("a mid-tx failure AFTER the coupon burn rolls EVERYTHING back (the atomic rollback)", async () => {
    const w = await seedWorld("rollback", { coupon: { maxRedemptions: null, timesUsed: 0 } });
    // Pre-place an order that owns the number: the tx's order.create hits the
    // unique violation AFTER the coupon increment already wrote — the engine
    // must restore the burn (the complement of the C1 synthetic retry pin:
    // this asserts the ROLLBACK semantics, the retry loop is route-level).
    await db.order.create({ data: { number: "ORD-2026-209", email: "prior@test.dev", customerName: "Prior", total: 1, subtotal: 1, shippingAddress: "{}" } });

    await expect(placeOrderTx(db, "ORD-2026-209", argsFor(w, linesFor(w)))).rejects.toThrow();

    // The burn is restored; the stock is untouched; the prior order is the ONLY 209
    const row = await db.coupon.findUnique({ where: { code: w.couponCode! } });
    expect(row!.timesUsed).toBe(0);
    expect((await db.product.findUnique({ where: { id: w.p1Id } }))!.stock).toBe(10);
    expect((await db.product.findUnique({ where: { id: w.p2Id } }))!.stock).toBe(3);
    expect(await db.order.count({ where: { number: "ORD-2026-209" } })).toBe(1);
  });

  it("saveAddress below the cap saves the address in the SAME tx", async () => {
    const w = await seedWorld("savesave");

    const number = await placeOrderTx(
      db, "ORD-2026-210",
      argsFor(w, linesFor(w), { saveAddress: true, userId: w.userId }),
    );
    expect(number).toBe("ORD-2026-210");

    const addresses = await db.address.findMany({ where: { userId: w.userId } });
    expect(addresses).toHaveLength(1);
    expect(addresses[0]!.isDefault).toBe(true); // first address auto-defaults
    expect(addresses[0]!.line1).toBe("1 Main Street");
    expect(await db.order.count({ where: { number } })).toBe(1);
  });

  it("saveAddress AT the address cap: the ORDER STILL PLACES (S7-8 best-effort)", async () => {
    const w = await seedWorld("capsave", { addressCount: 20 });

    const number = await placeOrderTx(
      db, "ORD-2026-211",
      argsFor(w, linesFor(w), { saveAddress: true, userId: w.userId }),
    );
    expect(number).toBe("ORD-2026-211");

    // The order placed; the book is byte-identical (no save, no rollback)
    expect(await db.order.count({ where: { number } })).toBe(1);
    expect(await db.address.count({ where: { userId: w.userId } })).toBe(20);
  });
});
