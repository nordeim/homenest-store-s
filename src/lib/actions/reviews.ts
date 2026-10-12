"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { firstError, reviewSchema } from "@/lib/validation";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

/**
 * Submit a product review. Validates with the shared reviewSchema, stores the
 * review as unverified, then recomputes the product's rating / reviewCount
 * from the review aggregate so the storefront always shows honest numbers.
 */
export async function submitReviewAction(
  productId: string,
  rating: number,
  title: string,
  comment: string,
  author: string,
): Promise<ReviewActionResult> {
  const parsed = reviewSchema.safeParse({ productId, rating, title, comment, author });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { productId: pid, rating: safeRating, title: safeTitle, comment: safeComment, author: safeAuthor } = parsed.data;

  // Guest-reachable write — keep the spam budget tight but human-friendly
  // (per author-name per product per minute).
  const limit = rateLimit(`review:${safeAuthor.toLowerCase()}:${pid}`, 5, 60_000);
  if (!limit.ok) {
    return { ok: false, error: "Too many reviews submitted. Please try again shortly." };
  }

  try {
    const product = await db.product.findUnique({
      where: { id: pid },
      select: { id: true, isActive: true },
    });
    if (!product || !product.isActive) {
      return { ok: false, error: "Product not found." };
    }

    // Attribute the review to the signed-in user when there is one; guests
    // can still review (userId stays null).
    const user = await getCurrentUser();
    await db.review.create({
      data: {
        productId: pid,
        rating: safeRating,
        title: safeTitle,
        comment: safeComment,
        author: safeAuthor,
        userId: user?.id ?? null,
        verified: false,
      },
    });

    // Recompute the denormalized rating fields from the source of truth.
    const agg = await db.review.aggregate({
      where: { productId: pid },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const average = agg._avg.rating ?? 0;
    await db.product.update({
      where: { id: pid },
      data: {
        rating: Math.round(average * 10) / 10,
        reviewCount: agg._count._all,
      },
    });

    revalidatePath(`/product/${pid}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save your review. Please try again." };
  }
}
