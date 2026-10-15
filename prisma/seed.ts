/**
 * Seed — idempotent (upserts by natural keys). Seeds:
 *  - 8 categories matching the reference storefront
 *  - the reference catalog (8 products) + HomeNest superset extras
 *  - hero carousel slides matching the reference
 *  - coupons, store settings, demo accounts (admin + customer)
 *  - a starter review per product matching the reference rating/count
 *
 * Run: npm run db:seed   (tsx prisma/seed.ts)
 */
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { scryptHash } from "../src/lib/password";
import { productSeedCreatedAt, productSeedUpdate } from "../src/lib/seed-policy";

const prisma = new PrismaClient();

type Spec = { label: string; value: string };

type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  price: number; // cents
  compareAtPrice?: number;
  sku: string;
  stock: number;
  rating: number;
  reviewCount: number;
  images: string[];
  tags: string[];
  specs: Spec[];
  shortDescription: string;
  description: string;
  badge?: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
};

const CATEGORIES = [
  {
    slug: "cookware",
    name: "Cookware",
    description: "Professional-grade pots and pans built for even heat and a lifetime of family meals.",
    icon: "cooking-pot",
    iconGradient: "from-orange-400 to-orange-600",
    sortOrder: 1,
  },
  {
    slug: "bakeware",
    name: "Bakeware",
    description: "Trusted trays, tins and racks that deliver consistent, golden results every bake.",
    icon: "cake",
    iconGradient: "from-pink-400 to-pink-600",
    sortOrder: 2,
  },
  {
    slug: "kitchen-tools",
    name: "Kitchen Tools",
    description: "Precision-forged blades and everyday prep tools designed for effortless cooking.",
    icon: "utensils-crossed",
    iconGradient: "from-amber-400 to-orange-500",
    sortOrder: 3,
  },
  {
    slug: "storage",
    name: "Storage",
    description: "Airtight, stackable storage that keeps your pantry organized and ingredients fresher.",
    icon: "package",
    iconGradient: "from-teal-400 to-emerald-500",
    sortOrder: 4,
  },
  {
    slug: "appliances",
    name: "Appliances",
    description: "Countertop machines that bring café-quality coffee and bakery-quality bread home.",
    icon: "zap",
    iconGradient: "from-blue-400 to-blue-600",
    sortOrder: 5,
  },
  {
    slug: "dining",
    name: "Dining",
    description: "Minimalist, chip-resistant plates, bowls and mugs that set a beautiful table every day.",
    icon: "wine",
    iconGradient: "from-purple-400 to-purple-600",
    sortOrder: 6,
  },
  {
    slug: "cleaning",
    name: "Cleaning",
    description: "Effective, gentle cleaning tools that keep your kitchen sparkling and hygienic.",
    icon: "sparkles",
    iconGradient: "from-cyan-400 to-sky-500",
    sortOrder: 7,
  },
  {
    slug: "decor",
    name: "Decor",
    description: "Warm, natural accents that make your kitchen the heart of your home.",
    icon: "sprout",
    iconGradient: "from-green-400 to-emerald-600",
    sortOrder: 8,
  },
];

export const PRODUCTS: SeedProduct[] = [
  // ---- The reference catalog (visual-parity core) ----
  {
    slug: "damascus-steel-chef-knife-set",
    name: "Damascus Steel Chef Knife Set",
    category: "kitchen-tools",
    price: 19999,
    compareAtPrice: 27999,
    sku: "HN-KNIFE-001",
    stock: 24,
    rating: 4.9,
    reviewCount: 412,
    images: ["/images/product-damascus-knife-set.png", "/images/product-damascus-knife-set-2.png"],
    tags: ["Damascus steel", "professional", "gift set"],
    specs: [
      { label: "Blade Material", value: "67-layer Damascus steel" },
      { label: "Pieces", value: "5 knives + magnetic holder" },
      { label: "Handle", value: "Ergonomic walnut" },
      { label: "Hardness", value: "62 HRC" },
    ],
    shortDescription:
      "Professional 5-piece knife set with Damascus steel blades and ergonomic walnut handles.",
    description:
      "Professional 5-piece knife set with Damascus steel blades and ergonomic walnut handles. Includes magnetic wooden holder. Razor-sharp precision for every cut.",
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
  },
  {
    slug: "artisan-copper-frying-pan",
    name: "Artisan Copper Frying Pan",
    category: "cookware",
    price: 8999,
    compareAtPrice: 12999,
    sku: "HN-COPPER-002",
    stock: 32,
    rating: 4.8,
    reviewCount: 234,
    images: ["/images/product-copper-pan.png", "/images/product-copper-pan-2.png"],
    tags: ["copper", "non-stick", "premium"],
    specs: [
      { label: "Material", value: "Hand-hammered copper" },
      { label: "Base", value: "Tri-ply, even heat" },
      { label: "Coating", value: "Non-stick ceramic" },
      { label: "Diameter", value: '10 in (26 cm)' },
    ],
    shortDescription:
      "Hand-hammered copper frying pan with a tri-ply base for even heat distribution.",
    description:
      "Hand-hammered copper frying pan with a tri-ply base for even heat distribution. Non-stick ceramic coating makes cooking and cleanup a breeze. Perfect for everything from delicate eggs to seared steaks.",
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
  },
  {
    slug: "artisan-ceramic-dinner-set",
    name: "Artisan Ceramic Dinner Set",
    category: "dining",
    price: 11999,
    compareAtPrice: 15999,
    sku: "HN-DINING-003",
    stock: 18,
    rating: 4.8,
    reviewCount: 203,
    images: ["/images/product-ceramic-dinner-set.png"],
    tags: ["handcrafted", "ceramic", "dinner set"],
    specs: [
      { label: "Pieces", value: "16-piece set" },
      { label: "Includes", value: "4 plates, 4 salad plates, 4 bowls, 4 mugs" },
      { label: "Material", value: "Glazed stoneware" },
      { label: "Care", value: "Dishwasher & microwave safe" },
    ],
    shortDescription: "16-piece handcrafted dinner set in warm terracotta and cream.",
    description:
      "16-piece handcrafted dinner set in warm terracotta and cream. Includes 4 each of dinner plates, salad plates, bowls, and mugs. Each piece is uniquely glazed.",
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
  },
  {
    slug: "enameled-cast-iron-dutch-oven",
    name: "Enameled Cast Iron Dutch Oven",
    category: "cookware",
    price: 14999,
    compareAtPrice: 19999,
    sku: "HN-DUTCH-004",
    stock: 21,
    rating: 4.9,
    reviewCount: 367,
    images: ["/images/product-dutch-oven.png", "/images/product-copper-pan-2.png"],
    tags: ["cast iron", "enamel", "Dutch oven"],
    specs: [
      { label: "Capacity", value: "6 quarts" },
      { label: "Material", value: "Enameled cast iron" },
      { label: "Color", value: "Deep burgundy" },
      { label: "Lid", value: "Self-basting" },
    ],
    shortDescription: "6-quart cast iron Dutch oven with premium enamel coating in deep burgundy.",
    description:
      "6-quart cast iron Dutch oven with premium enamel coating in deep burgundy. Self-basting lid locks in moisture. Perfect for braising, roasting, and slow-cooking.",
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
  },
  {
    slug: "walnut-cutting-board-collection",
    name: "Walnut Cutting Board Collection",
    category: "kitchen-tools",
    price: 7999,
    sku: "HN-BOARD-005",
    stock: 40,
    rating: 4.7,
    reviewCount: 142,
    images: ["/images/product-walnut-boards.png", "/images/product-damascus-knife-set-2.png"],
    tags: ["walnut", "handcrafted", "natural"],
    specs: [
      { label: "Pieces", value: "3 boards (large, medium, small)" },
      { label: "Material", value: "Premium walnut" },
      { label: "Feature", value: "Juice grooves" },
      { label: "Finish", value: "Food-safe mineral oil" },
    ],
    shortDescription: "Set of 3 premium walnut cutting boards with juice grooves.",
    description:
      "Set of 3 premium walnut cutting boards with juice grooves. Hand-finished with food-safe mineral oil. Includes large, medium, and small sizes.",
    isNewArrival: true,
  },
  {
    slug: "ceramic-mixing-bowl-set",
    name: "Ceramic Mixing Bowl Set",
    category: "bakeware",
    price: 5499,
    compareAtPrice: 6999,
    sku: "HN-BOWL-006",
    stock: 35,
    rating: 4.6,
    reviewCount: 187,
    images: ["/images/product-mixing-bowls.png"],
    tags: ["ceramic", "set", "nesting"],
    specs: [
      { label: "Pieces", value: "4 nesting bowls" },
      { label: "Material", value: "Durable stoneware" },
      { label: "Base", value: "Non-slip" },
      { label: "Care", value: "Microwave & dishwasher safe" },
    ],
    shortDescription: "Set of 4 nesting mixing bowls in beautiful matte earth tones.",
    description:
      "Set of 4 nesting mixing bowls in beautiful matte earth tones. Made from durable stoneware with non-slip bases. Microwave and dishwasher safe.",
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
  },
  {
    slug: "glass-storage-container-set",
    name: "Glass Storage Container Set",
    category: "storage",
    price: 4299,
    sku: "HN-STORE-007",
    stock: 50,
    rating: 4.5,
    reviewCount: 156,
    images: ["/images/product-glass-storage.png"],
    tags: ["glass", "eco-friendly", "airtight"],
    specs: [
      { label: "Pieces", value: "12-piece set" },
      { label: "Material", value: "Borosilicate glass" },
      { label: "Lids", value: "Airtight bamboo" },
      { label: "Safe", value: "Oven, microwave & freezer" },
    ],
    shortDescription: "12-piece borosilicate glass food storage set with airtight bamboo lids.",
    description:
      "12-piece borosilicate glass food storage set with airtight bamboo lids. Eco-friendly alternative to plastic. Oven, microwave, and freezer safe.",
    isNewArrival: true,
  },
  {
    slug: "professional-stand-mixer",
    name: "Professional Stand Mixer",
    category: "appliances",
    price: 34999,
    compareAtPrice: 42999,
    sku: "HN-MIXER-008",
    stock: 14,
    rating: 4.7,
    reviewCount: 298,
    images: ["/images/product-stand-mixer.png"],
    tags: ["mixer", "professional", "powerful"],
    specs: [
      { label: "Motor", value: "800W, 10 speeds" },
      { label: "Bowl", value: "5-quart stainless steel" },
      { label: "Includes", value: "Dough hook, flat beater, whisk" },
      { label: "Warranty", value: "5-year motor" },
    ],
    shortDescription: "Powerful 800W stand mixer with 10-speed settings and 5-quart stainless bowl.",
    description:
      "Powerful 800W stand mixer with 10-speed settings and 5-quart stainless steel bowl. Includes dough hook, flat beater, and wire whisk attachments.",
    badge: "Featured",
    isFeatured: true,
    isNewArrival: true,
  },
  // ---- HomeNest superset extras (beyond the reference catalog) ----
  {
    slug: "stainless-steel-cookware-set",
    name: "Stainless Steel Cookware Set",
    category: "cookware",
    price: 24999,
    compareAtPrice: 32999,
    sku: "HN-COOK-009",
    stock: 22,
    rating: 4.7,
    reviewCount: 189,
    images: ["/images/product-copper-pan-2.png"],
    tags: ["stainless steel", "10-piece", "induction"],
    specs: [
      { label: "Pieces", value: "10-piece set" },
      { label: "Material", value: "Tri-ply stainless steel" },
      { label: "Compatible", value: "All cooktops incl. induction" },
      { label: "Oven Safe", value: "Up to 500°F" },
    ],
    shortDescription: "10-piece tri-ply stainless steel set for every cooking task.",
    description:
      "10-piece tri-ply stainless steel cookware set engineered for professional results at home. Impact-bonded bases eliminate hot spots, riveted stay-cool handles, and every piece is oven safe to 500°F. Works on all cooktops including induction.",
    badge: "Best Seller",
    isFeatured: false,
    isNewArrival: false,
  },
  {
    slug: "french-rolling-pin-baking-set",
    name: "French Rolling Pin & Baking Set",
    category: "bakeware",
    price: 3499,
    compareAtPrice: 4499,
    sku: "HN-BAKE-010",
    stock: 44,
    rating: 4.6,
    reviewCount: 98,
    images: ["/images/product-walnut-boards.png"],
    tags: ["baking", "beechwood", "pastry"],
    specs: [
      { label: "Material", value: "Solid beechwood" },
      { label: "Includes", value: "Rolling pin + pastry mat" },
      { label: "Design", value: "Tapered French style" },
      { label: "Care", value: "Hand wash, oil regularly" },
    ],
    shortDescription: "Tapered beechwood French rolling pin with a non-stick pastry mat.",
    description:
      "The tapered French rolling pin gives you superior control for pastry, pizza, and cookies. Paired with a food-grade silicone pastry mat printed with measurement guides, this set turns any counter into a baker's station.",
    isNewArrival: false,
  },
  {
    slug: "espresso-machine-compact",
    name: "Compact Espresso Machine",
    category: "appliances",
    price: 27999,
    compareAtPrice: 34999,
    sku: "HN-ESP-011",
    stock: 12,
    rating: 4.8,
    reviewCount: 176,
    images: ["/images/product-stand-mixer.png"],
    tags: ["espresso", "15-bar", "compact"],
    specs: [
      { label: "Pressure", value: "15-bar pump" },
      { label: "Reservoir", value: "1.5 L removable" },
      { label: "Modes", value: "Single & double shot" },
      { label: "Steam Wand", value: "Yes, for latte art" },
    ],
    shortDescription: "Café-grade 15-bar espresso in a counter-friendly footprint.",
    description:
      "Pull rich, velvety shots at home with a 15-bar Italian pump, precise temperature control, and a powerful steam wand for silky microfoam. The compact footprint fits any kitchen without sacrificing café-grade performance.",
    badge: "Top Rated",
    isNewArrival: false,
  },
  {
    slug: "bamboo-utensil-organizer",
    name: "Bamboo Utensil Organizer",
    category: "storage",
    price: 2499,
    sku: "HN-ORG-012",
    stock: 60,
    rating: 4.5,
    reviewCount: 87,
    images: ["/images/product-glass-storage.png"],
    tags: ["bamboo", "drawer", "organizer"],
    specs: [
      { label: "Material", value: "Sustainable bamboo" },
      { label: "Compartments", value: "6 expandable slots" },
      { label: "Fits", value: "Standard 18in drawers" },
      { label: "Care", value: "Wipe clean" },
    ],
    shortDescription: "Expandable bamboo drawer organizer for tidy kitchen tools.",
    description:
      "Keep every spatula and whisk within reach. This expandable bamboo organizer adjusts from 6 to 8 compartments to fit your drawer, with a smooth sanded finish and sturdy finger-jointed corners built to last.",
    isNewArrival: false,
  },
  {
    slug: "linen-napkin-set",
    name: "Stonewashed Linen Napkin Set",
    category: "dining",
    price: 2999,
    compareAtPrice: 3999,
    sku: "HN-LINEN-013",
    stock: 48,
    rating: 4.6,
    reviewCount: 64,
    images: ["/images/product-ceramic-dinner-set.png"],
    tags: ["linen", "napkins", "natural"],
    specs: [
      { label: "Pieces", value: "Set of 6" },
      { label: "Material", value: "100% French flax linen" },
      { label: "Size", value: '18 x 18 in' },
      { label: "Care", value: "Machine washable" },
    ],
    shortDescription: "Soft stonewashed linen napkins in warm, natural tones.",
    description:
      "Cut from 100% French flax linen and stonewashed for everyday softness, these napkins drape beautifully and get better with every wash. Warm, natural tones complement both casual meals and holiday tables.",
    isNewArrival: false,
  },
  {
    slug: "kitchen-cleaning-brush-set",
    name: "Kitchen Cleaning Brush Set",
    category: "cleaning",
    price: 1999,
    sku: "HN-CLEAN-014",
    stock: 70,
    rating: 4.4,
    reviewCount: 73,
    images: ["/images/product-mixing-bowls.png"],
    tags: ["cleaning", "bamboo", "brush"],
    specs: [
      { label: "Pieces", value: "4 brushes + holder" },
      { label: "Bristles", value: "Plant-based" },
      { label: "Handles", value: "FSC-certified bamboo" },
      { label: "Use", value: "Dishes, produce, cast iron" },
    ],
    shortDescription: "Plant-fiber brushes with bamboo handles for every cleaning task.",
    description:
      "A complete natural cleaning kit: a dish brush with replaceable head, a pot scrubber for cast iron, a produce brush, and a detail brush for crevices — all with FSC-certified bamboo handles and durable plant-fiber bristles.",
    isNewArrival: false,
  },
  {
    slug: "copper-measuring-spoon-set",
    name: "Copper Measuring Spoon Set",
    category: "kitchen-tools",
    price: 1699,
    compareAtPrice: 2199,
    sku: "HN-MEAS-015",
    stock: 55,
    rating: 4.7,
    reviewCount: 59,
    images: ["/images/product-copper-pan.png"],
    tags: ["copper", "measuring", "gift"],
    specs: [
      { label: "Pieces", value: "Set of 6 + ring" },
      { label: "Material", value: "Solid copper" },
      { label: "Sizes", value: "1/8 tsp to 1 tbsp" },
      { label: "Care", value: "Hand wash & dry" },
    ],
    shortDescription: "Solid-copper measuring spoons, stamped with permanent markings.",
    description:
      "These solid-copper measuring spoons bring warmth to the prep bench and accuracy to every recipe. Permanently stamped size markings won't fade, and the included brass ring keeps the set together in the drawer.",
    isNewArrival: false,
  },
  {
    slug: "dried-eucalyptus-bundle",
    name: "Dried Eucalyptus Kitchen Bundle",
    category: "decor",
    price: 2199,
    sku: "HN-DECOR-016",
    stock: 38,
    rating: 4.5,
    reviewCount: 41,
    images: ["/images/product-walnut-boards.png"],
    tags: ["eucalyptus", "dried", "decor"],
    specs: [
      { label: "Stems", value: "12-15 dried stems" },
      { label: "Length", value: "16-18 in" },
      { label: "Scent", value: "Natural eucalyptus" },
      { label: "Longevity", value: "Years with care" },
    ],
    shortDescription: "Fragrant dried eucalyptus for shelves, islands and open nooks.",
    description:
      "A generous bundle of dried eucalyptus that brings soft green-silver tone and a gentle natural scent to the kitchen. Style it across a shelf, above the range hood, or in a crock on the island.",
    isNewArrival: false,
  },
];

const SLIDES = [
  {
    title: "New Arrivals",
    subtitle: "Explore our latest collection of beautifully designed kitchen essentials.",
    image: "/images/hero-new-arrivals.png",
    ctaText: "Browse Collection",
    ctaLink: "/products",
    sortOrder: 1,
  },
  {
    title: "Elevate Your Kitchen",
    subtitle: "Discover premium cookware and tools for the modern home chef.",
    image: "/images/hero-elevate.png",
    ctaText: "Shop Now",
    ctaLink: "/products",
    sortOrder: 2,
  },
  {
    title: "Sale Up to 40% Off",
    subtitle: "Limited time offers on top-rated home and kitchen products.",
    image: "/images/hero-sale.png",
    ctaText: "Shop the Sale",
    ctaLink: "/products",
    sortOrder: 3,
  },
];

const SETTINGS: Record<string, string> = {
  storeName: "HomeNest",
  tagline: "Premium home & kitchen products for the modern lifestyle",
  contactEmail: "hello@homenest.com",
  contactPhone: "+1 (555) 123-4567",
  address: "123 Kitchen Lane, Home City, HC 10001",
  taxRatePercent: "7.5",
  standardShippingCents: "695",
  expressShippingCents: "1895",
  freeShippingThresholdCents: "5000",
  socialInstagram: "https://instagram.com",
  socialPinterest: "https://pinterest.com",
  socialFacebook: "https://facebook.com",
  socialTikTok: "https://tiktok.com",
};

const COUPONS = [
  // Lifecycle fields (expiresAt / maxRedemptions) are enforced by
  // isCouponRedeemable at coupon-lookup and inside the checkout transaction.
  { code: "WELCOME10", type: "percent", value: 10, description: "10% off your first order", minSubtotal: 0, expiresAt: null, maxRedemptions: null },
  { code: "SAVE20", type: "percent", value: 20, description: "20% off orders over $100", minSubtotal: 10000, expiresAt: null, maxRedemptions: 500 },
  // Session-20 S20-6: a first-class free_shipping coupon — zeroes shipping
  // outright. (Fresh databases get this row; an EXISTING database keeps its
  // earlier fixed-type FREESHIP — the seed is create-only, both work.)
  { code: "FREESHIP", type: "free_shipping", value: 0, description: "Free standard shipping on orders over $30", minSubtotal: 3000, expiresAt: null, maxRedemptions: null },
];

const REVIEW_TEMPLATES = [
  { title: "Exceeded expectations", comment: "Beautifully made and clearly built to last. It has already become part of my daily routine — I could not be happier with this purchase." },
  { title: "Wonderful quality", comment: "The finish is gorgeous and it feels great to use. Arrived quickly and packaged with real care. Would happily buy again as a gift." },
  { title: "Worth every penny", comment: "I compared several options before choosing this one and I am glad I did. The quality difference is obvious the moment you hold it." },
  { title: "My kitchen favorite", comment: "I use this constantly and it still looks brand new. Friends keep asking where I got it — highly recommend to anyone upgrading their kitchen." },
];

async function main() {
  console.log("Seeding HomeNest Kitchen…");

  // ---- Users ----
  const admin = await prisma.user.upsert({
    where: { email: "admin@homenestkitchen.com" },
    update: {},
    create: {
      email: "admin@homenestkitchen.com",
      name: "Store Admin",
      phone: "+1 (555) 123-4500",
      role: "admin",
      passwordHash: scryptHash("Admin123!"),
    },
  });
  const demo = await prisma.user.upsert({
    where: { email: "demo@homenestkitchen.com" },
    update: {},
    create: {
      email: "demo@homenestkitchen.com",
      name: "Jordan Rivera",
      phone: "+1 (512) 555-0133",
      role: "customer",
      passwordHash: scryptHash("Demo1234!"),
    },
  });
  await prisma.address.upsert({
    where: { id: "seed-demo-address" },
    update: {},
    create: {
      id: "seed-demo-address",
      userId: demo.id,
      label: "Home",
      fullName: "Jordan Rivera",
      phone: "+1 (512) 555-0133",
      line1: "482 Maple Avenue",
      city: "Austin",
      state: "TX",
      postalCode: "73301",
      isDefault: true,
    },
  });
  console.log(`Users: admin=${admin.id} demo=${demo.id}`);

  // ---- Categories ----
  const categoryIds = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        iconGradient: cat.iconGradient,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
    categoryIds.set(cat.slug, row.id);
  }
  console.log(`Categories: ${categoryIds.size}`);

  // ---- Products ----
  let createdProducts = 0;
  // Session-12 S12-5 (re-aligned session-33 S33-1 and session-34 S34-1):
  // create rows with BACKDATED timestamps (productSeedCreatedAt) so the
  // seed-list order = the reference's authored order = the `createdAt: desc`
  // consumers' newest-first order (products "Newest", home New Arrivals +
  // Featured). The live reference re-ordered its catalog twice since the
  // original pinning (session-33, then session-34 — the core list now
  // matches the current live order, Damascus-first); the superset tail
  // follows (create-only: reseeds never rewrite the createdAt of existing
  // rows — re-ordering requires a fresh DB).
  for (const [index, p] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(p.category);
    if (!categoryId) throw new Error(`Unknown category ${p.category} for ${p.slug}`);
    const data = {
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.description,
      categoryId,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
      sku: p.sku,
      stock: p.stock,
      rating: p.rating,
      reviewCount: p.reviewCount,
      images: JSON.stringify(p.images),
      tags: JSON.stringify(p.tags),
      specs: JSON.stringify(p.specs),
      badge: p.badge ?? null,
      isFeatured: p.isFeatured ?? false,
      isNewArrival: p.isNewArrival ?? false,
      isActive: true,
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      // Session-7 S7-3: the update branch refreshes CATALOG CONTENT only
      // (seed-policy.ts). price/stock/rating/reviewCount/badge/featured are
      // admin- or traffic-owned — a reseed must never reset them.
      update: productSeedUpdate(data),
      create: { ...data, createdAt: productSeedCreatedAt(index) },
    });
    createdProducts += 1;

    // A starter review per product so detail pages are never empty.
    const existing = await prisma.review.findFirst({ where: { productId: product.id } });
    if (!existing) {
      const template = REVIEW_TEMPLATES[createdProducts % REVIEW_TEMPLATES.length];
      if (template) {
        await prisma.review.create({
          data: {
            productId: product.id,
            userId: demo.id,
            author: "Jordan Rivera",
            rating: Math.round(p.rating),
            title: template.title,
            comment: template.comment,
            verified: true,
          },
        });
      }
    }
  }
  console.log(`Products: ${createdProducts}`);

  // ---- Carousel ----
  // Session-7 S7-3: slides are admin-managed (CRUD + reorder) — create-only
  // on reseed, exactly like coupons (S4-8) and settings below.
  for (const slide of SLIDES) {
    const existing = await prisma.carouselSlide.findFirst({ where: { title: slide.title } });
    if (!existing) {
      await prisma.carouselSlide.create({ data: slide });
    }
  }
  console.log(`Carousel slides: ${SLIDES.length}`);

  // ---- Settings ----
  // Session-7 S7-3: settings are admin-edited through the settings UI —
  // create-only on reseed (missing keys are created; existing values survive).
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.storeSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`Settings: ${Object.keys(SETTINGS).length}`);

  // ---- Coupons ----
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      // Create-only: a reseed must never reset live redemption bookkeeping
      // (timesUsed / expiresAt / maxRedemptions) — that state is admin- and
      // traffic-owned once the coupon exists (the admin coupon UI manages
      // it; reseeds only top up missing codes).
      update: {},
      create: coupon,
    });
  }
  console.log(`Coupons: ${COUPONS.length}`);

  console.log("Seed complete.");
}

// Run the seed only when executed directly (tsx prisma/seed.ts) — importing
// the module (scripts/restore-demo-stock.ts reads PRODUCTS for the e2e stock
// restore) must NOT trigger a seed.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
