import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation — every external input (server actions, API routes) is parsed
// through these schemas before it touches the database. SQLite has no enums,
// so the status/role vocabularies live here.
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
export const SHIPPING_METHODS = ["standard", "express"] as const;
export const PAYMENT_METHODS = ["card", "paypal", "cod"] as const;
export const ROLES = ["customer", "admin"] as const;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).default("Home"),
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  phone: z.string().trim().min(7, "Phone is required").max(40),
  line1: z.string().trim().min(4, "Street address is required").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(60),
  state: z.string().trim().min(2, "State is required").max(60),
  postalCode: z.string().trim().min(3, "Postal code is required").max(20),
  country: z.string().trim().min(2).max(60).default("United States"),
});

export const cartMutateSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  email: emailSchema,
  customerName: z.string().trim().min(2, "Full name is required").max(80),
  shippingMethod: z.enum(SHIPPING_METHODS),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
  saveAddress: z.boolean().optional(),
  // Client-generated (crypto.randomUUID). A retry that carries the same key
  // returns the already-placed order instead of double-ordering.
  idempotencyKey: z.string().trim().min(16, "Invalid idempotency key").max(64).optional(),
  address: addressSchema,
});

/** Public order tracking: order number PLUS the purchase email (anti-enumeration). */
export const trackOrderSchema = z.object({
  number: z
    .string()
    .trim()
    .min(4, "Order number is required")
    .max(40)
    .transform((v) => v.toUpperCase()),
  email: emailSchema,
});

export const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(280).optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1, "Select a rating").max(5),
  title: z.string().trim().max(120).default(""),
  comment: z.string().trim().min(10, "Review must be at least 10 characters").max(2000),
  author: z.string().trim().min(2, "Name is required").max(80),
});

export const newsletterSchema = z.object({
  email: emailSchema,
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: emailSchema,
  subject: z.string().trim().max(120).default(""),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
});

// Product image source: root-relative store path ONLY (no protocol-relative
// "//", no absolute http(s)). The production CSP is `img-src 'self' data:` —
// session-7 S7-6: an absolute http(s) URL passed validation but silently
// never rendered (blocked by the CSP at runtime), a confusing admin trap.
// Self-hosted root-relative paths are the only source the CSP serves, so the
// boundary now agrees exactly with the CSP (session-5 S5-9 introduced the
// scheme gate; S7-6 removed the never-renderable http(s) branch). Serving
// external hosts is a deliberate CSP-widening decision, not a schema edit.
export const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^(\/(?!\/)[^\s]*)$/, "Image must be an internal path starting with / (self-hosted under public/)");

/** Upper money bound shared by price/compareAtPrice (session-7 S7-7): $1M keeps every value inside Prisma's Int32 far below 2^31 cents. */
const MAX_PRICE_CENTS = 100_000_000;

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, dashes"),
  shortDescription: z.string().trim().max(300).default(""),
  description: z.string().trim().min(10, "Description is required").max(8000),
  categoryId: z.string().min(1, "Category is required"),
  price: z
    .number()
    .int()
    .min(1, "Price must be positive")
    .max(MAX_PRICE_CENTS, "Price must be under $1,000,000"),
  compareAtPrice: z
    .number()
    .int()
    .min(1)
    .max(MAX_PRICE_CENTS, "Compare-at price must be under $1,000,000")
    .nullable()
    .optional(),
  sku: z.string().trim().min(2).max(60),
  stock: z.number().int().min(0).max(100000),
  images: z
    .array(imageUrlSchema)
    .min(1, "At least one image is required"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  specs: z
    .array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(80) }))
    .max(24)
    .default([]),
  badge: z.string().trim().max(40).nullable().optional(),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, dashes"),
  description: z.string().trim().max(500).default(""),
  icon: z.string().trim().min(2).max(40).default("package"),
  iconGradient: z.string().trim().max(80).default("from-orange-400 to-orange-600"),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

// Internal path (no protocol-relative "//") or absolute http(s) URL — blocks
// `javascript:`/`data:`-style injection through the admin carousel form.
export const safeLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(
    /^(\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/i,
    "Link must be an internal path (starting with /) or an http(s) URL",
  );

export const carouselSlideInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(200).default(""),
  image: imageUrlSchema,
  ctaText: z.string().trim().min(2).max(40).default("Shop Now"),
  ctaLink: safeLinkSchema.default("/products"),
  sortOrder: z.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
});

export const trackingSchema = z.object({
  orderId: z.string().min(1),
  carrier: z.string().trim().min(2, "Carrier is required").max(60),
  trackingNumber: z.string().trim().min(4, "Tracking number is required").max(60),
});

/** Flatten a ZodError to a single first-error message (action return shape). */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
