import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headset, RefreshCcw, ShieldCheck, Truck } from "lucide-react";

import { siteBaseUrl } from "@/lib/seo";

import { db } from "@/lib/db";
import { toCardData } from "@/lib/products";
import { getWishlistIds } from "@/lib/wishlist";
import { CategoryCard } from "@/components/store/category-card";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { ProductCard } from "@/components/store/product-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: `${siteBaseUrl()}/` },
};

const TRUST_BADGES = [
  { icon: Truck, title: "Free Shipping", text: "On orders over $50" },
  { icon: ShieldCheck, title: "Secure Payment", text: "100% protected checkout" },
  { icon: RefreshCcw, title: "Easy Returns", text: "30-day return policy" },
  { icon: Headset, title: "24/7 Support", text: "Dedicated customer care" },
];

export default async function HomePage() {
  const [slides, categories, featured, newArrivals, wishlistIds] = await Promise.all([
    db.carouselSlide.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    // take: 8 — the home page renders 8 tiles per grid; don't read the world.
    // Session-12 S12-5: desc (not asc) — the seed backdates rows so the
    // reference's authored order IS the newest-first order; featured renders
    // Damascus-first either way, and admin-featured products sort as newest.
    db.product.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { category: { select: { name: true, slug: true } } },
    }),
    db.product.findMany({
      where: { isActive: true, isNewArrival: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { category: { select: { name: true, slug: true } } },
    }),
    // Session-11 S11-2: the grid hearts render the filled wishlist state.
    getWishlistIds(),
  ]);

  return (
    <div className="container-page flex flex-col gap-14 py-6 sm:py-8">
      {/* Hero */}
      <HeroCarousel
        slides={slides.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          image: s.image,
          ctaText: s.ctaText,
          ctaLink: s.ctaLink,
        }))}
      />

      {/* Trust badges */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_BADGES.map((badge) => (
          <div key={badge.title} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <badge.icon className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{badge.title}</p>
              <p className="text-sm text-muted-foreground">{badge.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Shop by Category */}
      <section aria-labelledby="shop-by-category">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 id="shop-by-category" className="font-display text-2xl font-bold sm:text-3xl">
              Shop by Category
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} slug={cat.slug} name={cat.name} icon={cat.icon} iconGradient={cat.iconGradient} />
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section aria-labelledby="featured-products">
        <div className="mb-6">
          <h2 id="featured-products" className="font-display text-2xl font-bold sm:text-3xl">
            Featured Products
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Hand-picked favorites for your home</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.slice(0, 8).map((p, i) => (
            <ProductCard
              key={p.id}
              product={toCardData(p, p.category)}
              priority={i < 4}
              inWishlist={wishlistIds.has(p.id)}
            />
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section aria-labelledby="new-arrivals">
        <div className="mb-6">
          <h2 id="new-arrivals" className="font-display text-2xl font-bold sm:text-3xl">
            New Arrivals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Fresh additions to elevate your everyday</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {newArrivals.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={toCardData(p, p.category)} inWishlist={wishlistIds.has(p.id)} />
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/products"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-primary/30 px-6 text-sm font-semibold text-primary transition-colors hover:bg-accent"
          >
            View All Products <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative overflow-hidden rounded-3xl bg-foreground text-background">
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-bold sm:text-4xl">Transform Your Kitchen Today</h2>
          <p className="max-w-xl text-sm text-background/70 sm:text-base">
            Join thousands of home chefs who trust HomeNest for premium quality and thoughtful design.
          </p>
          <Link
            href="/products"
            className="mt-2 inline-flex h-11 items-center rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            Browse All Products
          </Link>
        </div>
        <Image
          src="/images/hero-elevate.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25"
        />
      </section>

      {/* Newsletter */}
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
        <h2 className="font-display text-2xl font-bold">Join Our Newsletter</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Be the first to know about new arrivals, exclusive offers, and cooking inspiration.
        </p>
        <NewsletterForm />
      </section>
    </div>
  );
}
