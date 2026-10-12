import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/health — liveness + DB roundtrip for the standalone deploy. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
