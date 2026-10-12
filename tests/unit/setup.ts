// Vitest node-env setup — no DOM globals needed for the unit suite.
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:../db/custom.db";
