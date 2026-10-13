"use server";

/**
 * Admin server actions — every mutation:
 *   1. verifies the caller is a signed-in admin (getCurrentUser + isAdmin),
 *   2. zod-validates its input (schemas from @/lib/validation),
 *   3. revalidates the affected admin (and storefront) paths,
 *   4. returns { ok: true } or { ok: false, error }.
 */

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderGoneError, applyCarrierTracking } from "@/lib/order-tracking";
import { applyOrderStatusTransition, canTransitionOrderStatus } from "@/lib/order-status";
import { settingsPatchSchema, type SettingsPatch } from "@/lib/settings-schema";
import { updateSettings } from "@/lib/settings";
import {
  carouselSlideInputSchema,
  categoryInputSchema,
  firstError,
  orderStatusSchema,
  productInputSchema,
  trackingSchema,
} from "@/lib/validation";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/** Guard helper — resolves to an error string when the caller is not an admin. */
async function requireAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return "Unauthorized";
  return null;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductUpsertInput = z.input<typeof productInputSchema> & { id?: string | null };

export async function upsertProductAction(data: ProductUpsertInput): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = productInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;
  const id = typeof data.id === "string" && data.id.length > 0 ? data.id : null;

  const slugClash = await db.product.findFirst({
    where: { slug: input.slug, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (slugClash) return { ok: false, error: "A product with this slug already exists." };

  const skuClash = await db.product.findFirst({
    where: { sku: input.sku, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (skuClash) return { ok: false, error: "A product with this SKU already exists." };

  const category = await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
  if (!category) return { ok: false, error: "The selected category no longer exists." };

  const dbData = {
    name: input.name,
    slug: input.slug,
    shortDescription: input.shortDescription ?? "",
    description: input.description,
    categoryId: input.categoryId,
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    sku: input.sku,
    stock: input.stock,
    images: JSON.stringify(input.images),
    tags: JSON.stringify(input.tags ?? []),
    specs: JSON.stringify(input.specs ?? []),
    badge: input.badge || null,
    isFeatured: input.isFeatured ?? false,
    isNewArrival: input.isNewArrival ?? false,
    isActive: input.isActive ?? true,
  };

  try {
    if (id) {
      await db.product.update({ where: { id }, data: dbData });
    } else {
      await db.product.create({ data: dbData });
    }
  } catch (error) {
    // The slug/SKU pre-checks race under concurrent admins — a P2002 here is
    // a unique clash, NOT a missing product; say so instead of the misleading
    // "refresh the list" message.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A product with this slug or SKU already exists." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "Product not found. Refresh the list and try again." };
    }
    throw error;
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProductAction(id: string): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (!id) return { ok: false, error: "Missing product id." };

  const orderedCount = await db.orderItem.count({ where: { productId: id } });
  if (orderedCount > 0) {
    return {
      ok: false,
      error: "This product has been ordered and cannot be deleted. Archive it instead.",
    };
  }

  const result = await db.product.deleteMany({ where: { id } });
  if (result.count === 0) return { ok: false, error: "Product not found. Refresh the list." };

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/products");
  return { ok: true };
}

export async function toggleProductActiveAction(id: string, isActive: boolean): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (!id || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };

  try {
    await db.product.update({ where: { id }, data: { isActive } });
  } catch (error) {
    // Session-13 S13-5: a concurrent delete is a P2025; anything else (DB
    // outage) must not lie that the product is gone — mirror the sibling
    // upsert action's narrowing and rethrow the unknown.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "Product not found. Refresh the list and try again." };
    }
    throw error;
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/products");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryUpsertInput = z.input<typeof categoryInputSchema> & { id?: string | null };

export async function upsertCategoryAction(data: CategoryUpsertInput): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = categoryInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;
  const id = typeof data.id === "string" && data.id.length > 0 ? data.id : null;

  const slugClash = await db.category.findFirst({
    where: { slug: input.slug, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (slugClash) return { ok: false, error: "A category with this slug already exists." };

  const dbData = {
    name: input.name,
    slug: input.slug,
    description: input.description ?? "",
    icon: input.icon ?? "package",
    iconGradient: input.iconGradient ?? "from-orange-400 to-orange-600",
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };

  try {
    if (id) {
      await db.category.update({ where: { id }, data: dbData });
    } else {
      await db.category.create({ data: dbData });
    }
  } catch (error) {
    // Session-8 S8-13: distinguish the races the pre-check can't close — two
    // admins creating the same slug concurrently hit P2002, a concurrent
    // delete of an edited row hits P2025 — instead of mapping every failure
    // to the misleading "not found".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A category with this slug already exists." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "Category not found. Refresh and try again." };
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (!id) return { ok: false, error: "Missing category id." };

  const productCount = await db.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return {
      ok: false,
      error: `${productCount} product${productCount === 1 ? "" : "s"} still use this category. Move them before deleting.`,
    };
  }

  const result = await db.category.deleteMany({ where: { id } });
  if (result.count === 0) return { ok: false, error: "Category not found. Refresh the page." };

  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/products");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Hero carousel
// ---------------------------------------------------------------------------

export type SlideUpsertInput = z.input<typeof carouselSlideInputSchema> & { id?: string | null };

export async function upsertSlideAction(data: SlideUpsertInput): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = carouselSlideInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;
  const id = typeof data.id === "string" && data.id.length > 0 ? data.id : null;

  const dbData = {
    title: input.title,
    subtitle: input.subtitle ?? "",
    image: input.image,
    ctaText: input.ctaText ?? "Shop Now",
    ctaLink: input.ctaLink ?? "/products",
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };

  try {
    if (id) {
      await db.carouselSlide.update({ where: { id }, data: dbData });
    } else {
      await db.carouselSlide.create({ data: dbData });
    }
  } catch (error) {
    // Session-13 S13-5: narrow to the row-missing race; an outage is not a
    // "slide not found".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "Slide not found. Refresh and try again." };
    }
    throw error;
  }

  revalidatePath("/admin/carousel");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSlideAction(id: string): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };
  if (!id) return { ok: false, error: "Missing slide id." };

  const result = await db.carouselSlide.deleteMany({ where: { id } });
  if (result.count === 0) return { ok: false, error: "Slide not found. Refresh the page." };

  revalidatePath("/admin/carousel");
  revalidatePath("/");
  return { ok: true };
}

/** Reorder slides: `ids` is the full ordered list; index becomes sortOrder. */
export async function reorderSlidesAction(ids: string[]): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = z.array(z.string().min(1)).min(1).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid slide order." };

  try {
    await db.$transaction(
      parsed.data.map((id, index) => db.carouselSlide.update({ where: { id }, data: { sortOrder: index } })),
    );
  } catch (error) {
    // Session-13 S13-5: narrow to the row-missing race; an outage is not a
    // "could not reorder".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: "Could not reorder slides. Refresh and try again." };
    }
    throw error;
  }

  revalidatePath("/admin/carousel");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** Thrown inside the status tx when a concurrent transition won the guarded write. */
class OrderTransitionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderTransitionConflictError";
  }
}

export async function setOrderStatusAction(input: z.input<typeof orderStatusSchema>): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // Fast-fail UX path: the pre-transaction read gives an instant no-op/invalid
  // transition answer. The AUTHORITATIVE decision is re-made inside the tx
  // below (session-9 S9-2) — two admins who both read `pending` must not both
  // restock, and a stale write must never reopen a terminal order.
  const order = await db.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found. Refresh the list." };
  if (order.status === parsed.data.status) return { ok: true };
  if (!canTransitionOrderStatus(order.status, parsed.data.status)) {
    return { ok: false, error: `An order cannot move from "${order.status}" to "${parsed.data.status}".` };
  }

  try {
    await db.$transaction(async (tx) => {
      // Re-read INSIDE the tx: the guarded write (applyOrderStatusTransition)
      // only lands when the order is still in the state read here — the event
      // and the restock derive from the guarded winner, never from the stale
      // pre-transaction snapshot.
      const current = await tx.order.findUnique({
        where: { id: parsed.data.orderId },
        select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
      });
      if (!current) throw new OrderTransitionConflictError("Order not found. Refresh the list.");
      if (current.status !== order.status) {
        // Someone moved it while this submission was in flight — the exact
        // transition rules apply to the LIVE status.
        if (current.status === parsed.data.status) return; // already there — no-op
        if (!canTransitionOrderStatus(current.status, parsed.data.status)) {
          throw new OrderTransitionConflictError(
            `An order cannot move from "${current.status}" to "${parsed.data.status}".`,
          );
        }
      }
      const applied = await applyOrderStatusTransition(tx, current, parsed.data.status, parsed.data.note);
      if (!applied.applied) {
        throw new OrderTransitionConflictError(
          `An order cannot move from "${current.status}" to "${parsed.data.status}".`,
        );
      }
    });
  } catch (error) {
    if (error instanceof OrderTransitionConflictError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/track-order");
  return { ok: true };
}

export async function setTrackingAction(input: z.input<typeof trackingSchema>): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const order = await db.order.findUnique({ where: { id: parsed.data.orderId }, select: { id: true } });
  if (!order) return { ok: false, error: "Order not found. Refresh the list." };

  // Session-11 S11-4: the guarded write is its own gate (S9-2/S9-3 pattern) —
  // a scoped conditional updateMany throws OrderGoneError on a concurrently
  // deleted order (no event, no raw P2025 digest); the event is created from
  // the guarded winner inside the same transaction.
  try {
    await db.$transaction((tx) =>
      applyCarrierTracking(tx, order.id, parsed.data.carrier, parsed.data.trackingNumber),
    );
  } catch (error) {
    if (error instanceof OrderGoneError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/track-order");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Store settings — the boundary schema lives in `@/lib/settings-schema`
// (session-13 C8: pure, exported, unit-pinned); this action stays the writer.
// ---------------------------------------------------------------------------

export type SettingsPatchInput = SettingsPatch;

export async function updateSettingsAction(patch: SettingsPatchInput): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = settingsPatchSchema.safeParse(patch ?? {});
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (Object.keys(parsed.data).length === 0) return { ok: false, error: "Nothing to update." };

  try {
    await updateSettings(parsed.data);
  } catch {
    return { ok: false, error: "Could not save settings. Try again." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
