/**
 * Session-25 S25-6 — the checkout saveAddress outcome contract against the
 * REAL engine.
 *
 * The "saved"/"at-cap" outcome contract is unit-pinned synthetically
 * (`session18-hardening.test.ts`, in-memory fake client). Nothing proved
 * the contract against a REAL address table: at-cap must land NO writes
 * (no partial unset of the previous defaults — the order-still-places
 * invariant), and below-cap must actually promote the new row to the single
 * default. This harness runs the LIVE call shape (inside a real
 * transaction, exactly like the checkout route does) against a REAL
 * temporary SQLite database.
 */
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

import { MAX_ADDRESSES_PER_USER, saveCheckoutAddressInTx } from "@/lib/addresses";

let db: PrismaClient;
let dir: string;

const USER_ID = "user-1";

const DRAFT = {
  fullName: "Integration Test",
  phone: "555-0100",
  line1: "1 Test Way",
  line2: null as string | null,
  city: "Testville",
  state: "TS",
  postalCode: "00000",
  country: "United States",
};

/** Fresh user + a one-address book whose only row is the default. */
async function seedSmallBook(): Promise<void> {
  await db.address.deleteMany();
  await db.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: "save-addr-int@test.local", name: "Save Addr" },
  });
  await db.address.create({
    data: { userId: USER_ID, label: "Old Home", fullName: "Old Name", line1: "9 Old Rd", city: "Oldtown", state: "OL", postalCode: "99999", isDefault: true },
  });
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "homenest-save-addr-"));
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

describe("saveCheckoutAddressInTx against the real engine (S25-6)", () => {
  it("below cap: 'saved', the previous default unset, the new row is the single default", async () => {
    await seedSmallBook();

    const outcome = await db.$transaction((tx) => saveCheckoutAddressInTx(tx, USER_ID, { ...DRAFT, label: "Work" }));
    expect(outcome).toBe("saved");

    const book = await db.address.findMany({ where: { userId: USER_ID }, orderBy: { createdAt: "asc" } });
    expect(book).toHaveLength(2);
    const defaults = book.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.label).toBe("Work");
    expect(book.find((a) => a.label === "Old Home")?.isDefault).toBe(false);
  });

  it("at cap: 'at-cap' and the book is untouched — no create, no default unset", async () => {
    await db.address.deleteMany();
    await db.user.upsert({
      where: { id: USER_ID },
      update: {},
      create: { id: USER_ID, email: "save-addr-int@test.local", name: "Save Addr" },
    });
    for (let i = 0; i < MAX_ADDRESSES_PER_USER; i += 1) {
      await db.address.create({
        data: { userId: USER_ID, label: `Book ${i}`, fullName: "Full Book", line1: `${i} Full St`, city: "Fulltown", state: "FS", postalCode: "11111", isDefault: i === 0 },
      });
    }

    const outcome = await db.$transaction((tx) => saveCheckoutAddressInTx(tx, USER_ID, { ...DRAFT, label: "Overflow" }));
    expect(outcome).toBe("at-cap");

    // The no-writes contract: the book is byte-identical after the call —
    // row count intact AND the previous default still set (no partial unset).
    const book = await db.address.findMany({ where: { userId: USER_ID } });
    expect(book).toHaveLength(MAX_ADDRESSES_PER_USER);
    const defaults = book.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.label).toBe("Book 0");
    expect(book.some((a) => a.label === "Overflow")).toBe(false);
  });

  it("a label-less draft defaults to 'Home' (the lib-level default)", async () => {
    await seedSmallBook();

    await db.$transaction((tx) => saveCheckoutAddressInTx(tx, USER_ID, { ...DRAFT, label: "" }));

    const created = await db.address.findFirst({ where: { userId: USER_ID, fullName: DRAFT.fullName }, orderBy: { createdAt: "desc" } });
    expect(created?.label).toBe("Home");
  });
});
