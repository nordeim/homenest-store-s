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
import { canTransitionOrderStatus, shouldRestockOnStatusChange } from "@/lib/order-status";
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
  } catch {
    return { ok: false, error: "Product not found. Refresh the list and try again." };
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
  } catch {
    return { ok: false, error: "Slide not found. Refresh and try again." };
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
  } catch {
    return { ok: false, error: "Could not reorder slides. Refresh and try again." };
  }

  revalidatePath("/admin/carousel");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function setOrderStatusAction(input: z.input<typeof orderStatusSchema>): Promise<AdminActionResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const order = await db.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!order) return { ok: false, error: "Order not found. Refresh the list." };

  // Submitting the status that's already set is a UI no-op — succeed without
  // writing a duplicate event (the strict transition rules stay in
  // canTransitionOrderStatus for real changes).
  if (order.status === parsed.data.status) return { ok: true };

  // Workflow rules (order-status.ts): cancelled is terminal — reopening it
  // would double-sell stock that was already restored. Delivered is terminal.
  if (!canTransitionOrderStatus(order.status, parsed.data.status)) {
    return { ok: false, error: `An order cannot move from "${order.status}" to "${parsed.data.status}".` };
  }

  const restock = shouldRestockOnStatusChange(order.status, parsed.data.status);
  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: parsed.data.status } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "status_changed",
        status: parsed.data.status,
        note:
          parsed.data.note ||
          `Status updated to ${parsed.data.status}.${restock ? " Stock restored." : ""}`,
      },
    });
    // Cancelling releases the reserved inventory back to the catalog —
    // otherwise a cancelled order would consume stock forever.
    if (restock) {
      for (const item of order.items) {
        if (!item.productId) continue; // deleted product — nothing to restore
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  });

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

  await db.$transaction([
    db.order.update({
      where: { id: order.id },
      data: { carrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber },
    }),
    db.orderEvent.create({
      data: {
        orderId: order.id,
        type: "tracking_added",
        note: `Tracking added: ${parsed.data.carrier} · ${parsed.data.trackingNumber}`,
      },
    }),
  ]);

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/track-order");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

/** Plain numeric string ("7.5", "42") clamped to a range. */
function numericSetting(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) >= min && Number(v) <= max, {
      message: `Enter a number between ${min} and ${max}.`,
    })
    .transform((v) => String(Number(v)));
}

/** Whole-number string (cents amounts arriving from the dollars input). */
function integerSetting(min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, {
      message: `Enter a whole number between ${min} and ${max}.`,
    });
}

function socialSetting() {
  return z
    .string()
    .trim()
    .max(200, "URL is too long")
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Enter a valid http(s) URL (or leave blank)")
    .transform((v) => v);
}

const settingsPatchSchema = z
  .object({
    storeName: z.string().trim().min(1, "Store name is required").max(80).optional(),
    tagline: z.string().trim().min(1, "Tagline is required").max(200).optional(),
    contactEmail: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address")
      .optional(),
    contactPhone: z.string().trim().min(3, "Phone is required").max(40).optional(),
    address: z.string().trim().min(3, "Address is required").max(200).optional(),
    taxRatePercent: numericSetting(0, 100).optional(),
    standardShippingCents: integerSetting(0, 1000000).optional(),
    expressShippingCents: integerSetting(0, 1000000).optional(),
    freeShippingThresholdCents: integerSetting(0, 1000000).optional(),
    socialInstagram: socialSetting().optional(),
    socialPinterest: socialSetting().optional(),
    socialFacebook: socialSetting().optional(),
    socialTikTok: socialSetting().optional(),
  })
  .strip();

export type SettingsPatchInput = z.input<typeof settingsPatchSchema>;

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
