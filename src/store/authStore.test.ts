import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./authStore";

function resetStore() {
  useAuthStore.setState({ users: [], currentUserId: null, seeded: false });
}

describe("authStore", () => {
  beforeEach(resetStore);

  it("registers a new user and signs them in", async () => {
    const result = await useAuthStore.getState().register("Ada Lovelace", "ada@example.com", "SuperSecret1");
    expect(result.success).toBe(true);
    expect(useAuthStore.getState().currentUser()?.email).toBe("ada@example.com");
    expect(useAuthStore.getState().currentUser()?.role).toBe("customer");
  });

  it("rejects registration with a password shorter than 8 characters", async () => {
    const result = await useAuthStore.getState().register("Short Pw", "short@example.com", "abc123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/8 characters/);
  });

  it("rejects duplicate email registration (case-insensitive)", async () => {
    await useAuthStore.getState().register("First User", "dup@example.com", "SuperSecret1");
    const result = await useAuthStore.getState().register("Second User", "DUP@example.com", "SuperSecret1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/);
  });

  it("logs in with correct credentials and never stores the plaintext password", async () => {
    await useAuthStore.getState().register("Grace Hopper", "grace@example.com", "CompilerRocks1");
    useAuthStore.setState({ currentUserId: null });
    const result = await useAuthStore.getState().login("grace@example.com", "CompilerRocks1");
    expect(result.success).toBe(true);
    const user = useAuthStore.getState().currentUser();
    expect(user?.passwordHash).not.toBe("CompilerRocks1");
    expect(user?.passwordHash).toHaveLength(64); // sha-256 hex digest length
  });

  it("rejects login with an incorrect password", async () => {
    await useAuthStore.getState().register("Grace Hopper", "grace2@example.com", "CompilerRocks1");
    useAuthStore.setState({ currentUserId: null });
    const result = await useAuthStore.getState().login("grace2@example.com", "WrongPassword");
    expect(result.success).toBe(false);
  });

  it("rejects login for an unknown email", async () => {
    const result = await useAuthStore.getState().login("nobody@example.com", "whatever123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No account/);
  });

  it("logout clears the current user", async () => {
    await useAuthStore.getState().register("Temp User", "temp@example.com", "SuperSecret1");
    expect(useAuthStore.getState().currentUserId).not.toBeNull();
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().currentUserId).toBeNull();
  });
});
