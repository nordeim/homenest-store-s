// Session-17 S17-1 / C6 — the guarded category delete and the FK-violation
// introspection helper.
//
// Server actions are import-unsafe in the Vitest node env (next/cache — the
// carried convention), so the delete guard lives at the lib level
// (`deleteCategoryIfEmpty`) and the pin lives here. The db client is a fake
// typed to the minimal surface the helper touches. P2003 must be a REAL
// `PrismaClientKnownRequestError` — a code-stamped plain Error fails the
// `instanceof` gate (the session-16 S16-1 lesson).
import { describe, expect, it, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import {
  deleteCategoryIfEmpty,
  type CategoryWriteClient,
} from "@/lib/admin-categories";
import { isForeignKeyViolation } from "@/lib/prisma-errors";

function fakeDb(overrides: {
  count?: number;
  deleteMany?: ReturnType<typeof vi.fn>;
  deleteError?: unknown;
}) {
  const deleteMany =
    overrides.deleteMany ??
    (overrides.deleteError
      ? vi.fn().mockRejectedValue(overrides.deleteError)
      : vi.fn().mockResolvedValue({ count: 1 }));
  return {
    client: {
      product: { count: vi.fn().mockResolvedValue(overrides.count ?? 0) },
      category: { deleteMany },
    } satisfies CategoryWriteClient,
    deleteMany,
  };
}

function p2003(): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError(
    "Foreign key constraint failed on the field: `categoryId`",
    { code: "P2003", clientVersion: "test" },
  );
}

describe("isForeignKeyViolation", () => {
  it("accepts a real P2003 error object", () => {
    expect(isForeignKeyViolation(p2003())).toBe(true);
  });

  it("duck-types like isUniqueViolation: any {code:'P2003'} shape matches", () => {
    // The repo's P-code introspection is intentionally duck-typed (the
    // isUniqueViolation convention) — a code-stamped plain Error matches the
    // same way. The S16-1 "real class" lesson applies to instanceof gates,
    // not this shape.
    expect(isForeignKeyViolation(Object.assign(new Error("x"), { code: "P2003" }))).toBe(true);
  });

  it("rejects other Prisma codes and non-errors", () => {
    const p2002 = new PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
    });
    expect(isForeignKeyViolation(p2002)).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation("P2003")).toBe(false);
    expect(isForeignKeyViolation({ code: "P2003" })).toBe(true);
  });
});

describe("deleteCategoryIfEmpty (S17-1 / C6)", () => {
  it("returns in-use with the product count and never deletes when the pre-count is positive", async () => {
    const { client, deleteMany } = fakeDb({ count: 3 });
    const result = await deleteCategoryIfEmpty(client, "cat-1");
    expect(result).toEqual({ outcome: "in-use", productCount: 3 });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("returns deleted when the delete lands", async () => {
    const { client, deleteMany } = fakeDb({ deleteMany: vi.fn().mockResolvedValue({ count: 1 }) });
    const result = await deleteCategoryIfEmpty(client, "cat-1");
    expect(result).toEqual({ outcome: "deleted" });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "cat-1" } });
  });

  it("returns not-found when the delete matches no rows", async () => {
    const { client } = fakeDb({ deleteMany: vi.fn().mockResolvedValue({ count: 0 }) });
    const result = await deleteCategoryIfEmpty(client, "cat-1");
    expect(result).toEqual({ outcome: "not-found" });
  });

  it("maps a P2003 raised by the delete (product created in the race window) to in-use with an unknown count", async () => {
    const { client, deleteMany } = fakeDb({ deleteError: p2003() });
    const result = await deleteCategoryIfEmpty(client, "cat-1");
    expect(result).toEqual({ outcome: "in-use", productCount: null });
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it("rethrows unrelated delete failures (the S13-2 contract: unknown errors are not swallowed)", async () => {
    const { client } = fakeDb({ deleteError: new Error("db offline") });
    await expect(deleteCategoryIfEmpty(client, "cat-1")).rejects.toThrow("db offline");
  });
});
