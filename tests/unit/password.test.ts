import { describe, expect, it } from "vitest";

import { scryptHash, scryptVerify } from "@/lib/password";

describe("scrypt password hashing", () => {
  it("produces the scrypt$N$r$p$salt$hash format", () => {
    const hash = scryptHash("Sup3rSecret!");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBe(16384);
    expect(Number(parts[2])).toBe(8);
    expect(Number(parts[3])).toBe(1);
  });

  it("verifies the correct password", () => {
    const hash = scryptHash("Admin123!");
    expect(scryptVerify("Admin123!", hash)).toBe(true);
  });

  it("rejects the wrong password", () => {
    const hash = scryptHash("Admin123!");
    expect(scryptVerify("admin123!", hash)).toBe(false);
    expect(scryptVerify("", hash)).toBe(false);
  });

  it("salts every hash uniquely", () => {
    expect(scryptHash("same-password")).not.toBe(scryptHash("same-password"));
  });

  it("rejects malformed stored hashes without throwing", () => {
    expect(scryptVerify("x", "not-a-hash")).toBe(false);
    expect(scryptVerify("x", "bcrypt$shouldfail")).toBe(false);
    expect(scryptVerify("x", "")).toBe(false);
  });
});
