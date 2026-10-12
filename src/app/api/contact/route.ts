import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { contactSchema, firstError } from "@/lib/validation";

/**
 * POST /api/contact — persist a contact-form message for the support queue.
 * Body: contactSchema JSON. Returns { ok: true }.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
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
