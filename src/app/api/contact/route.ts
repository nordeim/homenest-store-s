import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { contactSchema, firstError } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/contact — persist a contact-form message for the support queue.
 * Body: contactSchema JSON. Returns { ok: true }.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    
    const limit = rateLimit(`contact:${clientIp(request.headers)}`, 5, 60_000);
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many messages sent. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } });
    }

    await db.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject ?? "",
        message: parsed.data.message,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
