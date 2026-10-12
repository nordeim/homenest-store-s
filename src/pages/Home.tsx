import { Link } from "react-router-dom";
import { ArrowRight, Leaf, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useCatalogStore } from "@/store/catalogStore";
import { HeroCarousel } from "@/components/shop/HeroCarousel";
import { CategoryCard } from "@/components/shop/CategoryCard";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/Button";
import { initials } from "@/lib/format";

const perks = [
  { icon: Truck, title: "Free Shipping $75+", desc: "Fast, trackable delivery nationwide" },
  { icon: ShieldCheck, title: "Lifetime Guarantee", desc: "On all knives & cookware sets" },
  { icon: RefreshCw, title: "30-Day Returns", desc: "No questions asked" },
  { icon: Leaf, title: "Responsibly Sourced", desc: "Materials that last generations" },
];

const testimonials = [
  {
    name: "Sofia Martinez",
    role: "Home Cook, Denver CO",
    quote:
      "The cookware set paid for itself in the first month. Everything heats evenly and cleanup takes minutes.",
  },
  {
    name: "Daniel Osei",
    role: "Verified Buyer",
    quote:
      "Ordered the knife block as a gift and ended up buying a second one for myself. Impeccable quality.",
  },
  {
    name: "Harriet Wong",
    role: "Verified Buyer",
    quote:
      "Customer service helped me track a delayed order within minutes. It's rare to get this kind of care anymore.",
  },
];

export function Home() {
  const slides = useCatalogStore((s) => s.slides);
  const categories = useCatalogStore((s) => s.categories);
  const products = useCatalogStore((s) => s.products);

  const bestsellers = products.filter((p) => p.isBestseller).slice(0, 8);
  const newArrivals = products.filter((p) => p.isNew).slice(0, 4);

  return (
    <div>
      <HeroCarousel slides={slides} />

      <section className="border-b border-ink-100 bg-cream-50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
          {perks.map((perk) => (
            <div key={perk.title} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700">
                <perk.icon size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{perk.title}</p>
                <p className="text-xs text-ink-500">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ember-600">
              Shop by Category
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink-900">
              Find your essentials
            </h2>
          </div>
          <Link
            to="/products"
            className="hidden items-center gap-1.5 text-sm font-semibold text-forest-800 hover:underline sm:inline-flex"
          >
            View all products <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </section>

      <section className="bg-forest-50/60 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ember-600">
                Customer Favorites
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-ink-900">Bestsellers</h2>
            </div>
            <Link
              to="/products?sort=bestselling"
              className="hidden items-center gap-1.5 text-sm font-semibold text-forest-800 hover:underline sm:inline-flex"
            >
              Shop all bestsellers <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {bestsellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-ember-600">
              Just Landed
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-ink-900">New Arrivals</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="bg-ink-900 py-16 text-cream-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-400">
            Loved by home cooks
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold">What our customers say</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.name} className="rounded-2xl bg-cream-50/5 p-6">
                <blockquote className="text-sm leading-relaxed text-cream-100/90">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-600 text-xs font-semibold text-cream-50">
                    {initials(t.name)}
                  </span>
                  <span>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-cream-100/60">{t.role}</p>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-semibold text-ink-900">
          Get 10% off your first order
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-500">
          Join our newsletter for recipes, kitchen organization tips, and early access to new
          arrivals.
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-ink-200 bg-cream-50 px-4 py-3 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-100"
            aria-label="Email address"
          />
          <Button type="submit" className="shrink-0">
            Subscribe
          </Button>
        </form>
        <p className="mt-2 text-xs text-ink-400">Use code WELCOME10 at checkout.</p>
      </section>
    </div>
  );
}
