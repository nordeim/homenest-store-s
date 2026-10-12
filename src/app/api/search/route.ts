import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

import { parseImages } from "@/lib/products";

/** GET /api/search?q=… — typeahead search over active products. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
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
}
