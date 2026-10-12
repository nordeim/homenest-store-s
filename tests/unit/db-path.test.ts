import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveDatabaseUrl, standaloneRepoRoot } from "@/lib/db-path";

/**
 * Pins the DATABASE_URL resolution contract documented in .env.example:
 * a RELATIVE file: URL resolves against the anchor that owns
 * prisma/schema.prisma — exactly like the Prisma CLI — so
 * `file:../db/custom.db` lands at <repo>/db/custom.db regardless of CWD.
 */
function makeRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "homenest-dbpath-"));
  mkdirSync(path.join(root, "prisma"), { recursive: true });
  writeFileSync(path.join(root, "prisma", "schema.prisma"), "// fixture schema\n");
  return root;
}

describe("resolveDatabaseUrl", () => {
  it("resolves the documented default when .env is silent", () => {
    const repo = makeRepo();
    const resolved = resolveDatabaseUrl(undefined, [repo]);
    expect(resolved).toBe(`file:${path.resolve(repo, "prisma", "../db/custom.db")}`);
    expect(resolved).toContain(path.join("db", "custom.db"));
  });

  it("resolves file:../db/custom.db against the schema-owning anchor", () => {
    const repo = makeRepo();
    const resolved = resolveDatabaseUrl("file:../db/custom.db", [repo]);
    expect(resolved).toBe(`file:${path.resolve(repo, "prisma", "../db/custom.db")}`);
  });

  it("skips anchors without a prisma/schema.prisma", () => {
    const repo = makeRepo();
    const empty = mkdtempSync(path.join(tmpdir(), "homenest-empty-"));
    const resolved = resolveDatabaseUrl("file:../db/custom.db", [empty, repo]);
    expect(resolved).toBe(`file:${path.resolve(repo, "prisma", "../db/custom.db")}`);
  });

  it("falls back to the LAST anchor (CWD rule) when none owns a schema", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "homenest-noschema-"));
    const resolved = resolveDatabaseUrl("file:../db/custom.db", [cwd]);
    expect(resolved).toBe(`file:${path.resolve(cwd, "prisma", "../db/custom.db")}`);
  });

  it("passes ABSOLUTE file: URLs through untouched (POSIX)", () => {
    const repo = makeRepo();
    const abs = `file:${repo}/data/store.db`;
    expect(resolveDatabaseUrl(abs, [repo])).toBe(abs);
  });

  it("passes ABSOLUTE file: URLs through untouched (Windows drive letters)", () => {
    const repo = makeRepo();
    const abs = "file:C:\\data\\store.db";
    expect(resolveDatabaseUrl(abs, [repo])).toBe(abs);
  });

  it("passes non-SQLite URLs (e.g. postgres) through untouched", () => {
    const repo = makeRepo();
    const url = "postgresql://user:pass@host:5432/store";
    expect(resolveDatabaseUrl(url, [repo])).toBe(url);
  });

  it("trims surrounding whitespace in the env value", () => {
    const repo = makeRepo();
    const resolved = resolveDatabaseUrl("  file:../db/custom.db  ", [repo]);
    expect(resolved).toBe(`file:${path.resolve(repo, "prisma", "../db/custom.db")}`);
  });
});

describe("standaloneRepoRoot", () => {
  it("detects an in-repo standalone build dir and returns the repo root", () => {
    const repo = makeRepo();
    const standalone = path.join(repo, ".next", "standalone");
    mkdirSync(standalone, { recursive: true });
    writeFileSync(path.join(standalone, "server.js"), "// standalone server\n");
    expect(standaloneRepoRoot(standalone)).toBe(repo);
  });

  it("returns null when the dir is not named standalone", () => {
    const repo = makeRepo();
    expect(standaloneRepoRoot(repo)).toBeNull();
  });

  it("returns null without server.js", () => {
    const repo = makeRepo();
    const standalone = path.join(repo, ".next", "standalone");
    mkdirSync(standalone, { recursive: true });
    expect(standaloneRepoRoot(standalone)).toBeNull();
  });

  it("returns null for a standalone copy deployed OUTSIDE a repo", () => {
    const orphan = mkdtempSync(path.join(tmpdir(), "homenest-orphan-"));
    writeFileSync(path.join(orphan, "server.js"), "// deployed copy\n");
    expect(standaloneRepoRoot(orphan)).toBeNull();
  });
});
