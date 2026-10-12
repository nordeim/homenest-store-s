import { describe, expect, it } from "vitest";

import { assertAuthSecret } from "@/lib/auth-secret";

describe("assertAuthSecret", () => {
  it("accepts a strong secret in production", () => {
    expect(() =>
      assertAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "a-long-random-production-secret" }),
    ).not.toThrow();
  });

  it("throws in production when AUTH_SECRET is missing", () => {
    expect(() => assertAuthSecret({ NODE_ENV: "production" })).toThrowError(/AUTH_SECRET/);
  });

  it("throws in production when AUTH_SECRET is empty", () => {
    expect(() => assertAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "" })).toThrowError(/AUTH_SECRET/);
  });

  it("throws in production when AUTH_SECRET is still the documented dev constant", () => {
    expect(() =>
      assertAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "insecure-dev-only-secret-change-me" }),
    ).toThrowError(/AUTH_SECRET/);
  });

  it("allows the dev fallback in development and test", () => {
    expect(() => assertAuthSecret({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertAuthSecret({ NODE_ENV: "test" })).not.toThrow();
    expect(() => assertAuthSecret({})).not.toThrow();
  });
});
