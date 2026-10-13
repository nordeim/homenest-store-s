import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

import { parseImages } from "@/lib/products";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** GET /api/search?q=… — typeahead search over active products. */
export async function GET(request: NextRequest) {
  try {
    // Typeahead fires per keystroke — generous but metered (120/min per IP) so
    // a scripted client can't hammer the catalog for free (session-5 S5-8).
    const ipLimit = rateLimit(`search:${clientIp(request.headers)}`, 120, 60_000);
    if (!ipLimit.ok) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    let q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    // Same 100-char cap the /products page applies (session-9 S9-7) — an
    // oversized term feeds three LIKE clauses for nothing.
    if (q.length > 100) q = q.slice(0, 100);
    if (q.length < 2) return NextResponse.json({ results: [] });

    const products = await db.product.findMany({
      where: {
        isActive: true,
        OR: [{ name: { contains: q } }, { shortDescription: { contains: q } }, { tags: { contains: q } }],
      },
      include: { category: { select: { name: true, slug: true } } },
      orderBy: { rating: "desc" },
      take: 8,
    });

    return NextResponse.json({
      results: products.map((p) => ({
        id: p.id,
        name: p.name,
        image: parseImages(p.images)[0] ?? "/images/placeholder.svg",
        price: p.price,
        category: p.category.name,
      })),
    });
  } catch {
    // Sibling-consistent error shape (session-7 S7-11): a failed query is a
    // JSON { error } 500, never Next's generic error page.
    return NextResponse.json({ error: "Something went wrong searching. Please try again." }, { status: 500 });
  }
}
