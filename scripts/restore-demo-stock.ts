/**
 * restore-demo-stock — S14-4 (session 14) e2e determinism guard.
 *
 * The demo DB's stock is TRAFFIC-OWNED by the seed policy (S7-3: reseeds
 * refresh catalog content, never price/stock/rating/...) — so every e2e
 * checkout decrements it permanently. Fourteen sessions of suite runs
 * drained `Damascus Steel Chef Knife Set` to 0 and the storefront/S10-2
 * pins (which assume the seeded "In Stock" state) started failing — a
 * data-depletion failure mode, not a code regression.
 *
 * This script tops every product's stock back to its SEED value before the
 * e2e webServer starts. It is a TEST-DATA restore (the session-7 live-verify
 * convention: "data restored to seed values afterwards"), not a policy
 * change: `prisma/seed.ts` still never touches stock.
 *
 * Wired into playwright.config.ts's webServer.command (a fresh server start
 * restores first; a reused healthy server keeps its state — documented in
 * AGENTS.md). Manual run: npx tsx scripts/restore-demo-stock.ts
 */
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import { PRODUCTS } from "../prisma/seed";

// The repo contract (tests/unit/db-path.test.ts): the demo DB lives at
// <repo>/db/custom.db. Resolve ABSOLUTELY from this script's location so the
// process env (which may shadow DATABASE_URL) cannot point the restore at a
// different file.
const repoDbUrl = `file:${path.resolve(import.meta.dirname, "../db/custom.db")}`;
process.env.DATABASE_URL = repoDbUrl;

async function main() {
  const db = new PrismaClient();
  try {
    let restored = 0;
    let alreadyAtSeed = 0;
    for (const product of PRODUCTS) {
      const current = await db.product.findUnique({
        where: { slug: product.slug },
        select: { stock: true },
      });
      if (!current) continue; // catalog row absent — the seed owns creation
      if (current.stock === product.stock) {
        alreadyAtSeed += 1;
        continue;
      }
      await db.product.update({ where: { slug: product.slug }, data: { stock: product.stock } });
      restored += 1;
      console.log(`restored ${product.slug}: ${current.stock} → ${product.stock}`);
    }
    console.log(
      `restore-demo-stock: ${restored} restored, ${alreadyAtSeed} already at seed, ${PRODUCTS.length} catalog entries`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
