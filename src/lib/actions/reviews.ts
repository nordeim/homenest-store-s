"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit, reviewRateLimitKeys } from "@/lib/rate-limit";
import { growReviewAggregate } from "@/lib/review-aggregate";
import { firstError, reviewSchema } from "@/lib/validation";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

/**
 * Submit a product review. Validates with the shared reviewSchema, stores the
 * review as unverified, then GROWS the product's rating / reviewCount via
 * mergeReviewAggregate (review-aggregate.ts) so the displayed numbers stay
 * monotonic instead of collapsing to the stored Review-row count (the seed
 * ships reference-parity display counts with only one template row).
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

  // Guest-reachable write — keep the spam budget tight but human-friendly.
  // Two-tier budget (session-11 S11-1): the PER-IP ceiling is the
  // authoritative anti-spam gate — the author string is client-controlled
  // free text, so keyed alone it would let an attacker rotate fresh budgets
  // (and permanently skew the monotonic rating/reviewCount aggregates). The
  // per-author key underneath keeps the tight 5/min budget for honest
  // repeat submissions of one product.
  const h = await headers();
  const ip = clientIp(h);
  const { ipKey, authorKey } = reviewRateLimitKeys(ip, pid, safeAuthor);
  if (!rateLimit(ipKey, 20, 60_000).ok || !rateLimit(authorKey, 5, 60_000).ok) {
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

    // Session-13 S13-4: the insert and the aggregate growth share ONE
    // transaction — the pre-fix shape (create outside the tx) left an
    // uncounted orphan row behind whenever the aggregate write failed, and
    // the retry it invited double-inserted. Session-8 S8-2: the read-merge-
    // write runs inside the caller's transaction — two concurrent
    // submissions outside one would both read reviewCount = N and one
    // increment would be lost (see review-aggregate.ts for why a
    // from-scratch recompute is wrong here).
    await db.$transaction(async (tx) => {
      await tx.review.create({
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
      await growReviewAggregate(tx, pid, safeRating);
    });

    revalidatePath(`/product/${pid}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save your review. Please try again." };
  }
}
