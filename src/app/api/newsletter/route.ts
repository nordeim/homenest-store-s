import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { firstError, newsletterSchema } from "@/lib/validation";

/** POST /api/newsletter — subscribe an email (idempotent). */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = newsletterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }
    await db.newsletterSubscriber.upsert({
      where: { email: parsed.data.email },
      update: {},
      create: { email: parsed.data.email },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
