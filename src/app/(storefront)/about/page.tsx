import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Hammer, Leaf, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "The story behind HomeNest Kitchen — how a small apartment kitchen grew into a trusted source of premium cookware, tools, and storage for the modern home.",
};

// ---------------------------------------------------------------------------
// About — static editorial page. All copy is hand-written for the brand voice:
// warm, specific, and grounded in the reference's stats and values.
// ---------------------------------------------------------------------------

const STATS = [
  { stat: "50K+", label: "Happy Customers" },
  { stat: "500+", label: "Premium Products" },
  { stat: "25+", label: "Expert Brands" },
  { stat: "4.9", label: "Average Rating" },
] as const;

const VALUES = [
  {
    icon: Award,
    title: "Premium Quality",
    text: "Award-winning standard. Every piece in our catalog is vetted by our team for durability, performance, and finish — we cook with what we sell, and we only stock what earns a place in our own kitchens.",
  },
  {
    icon: Sparkles,
    title: "Thoughtful Design",
    text: "Beautiful and functional. We believe a great pan should sear like a dream and look stunning on an open shelf, so we curate tools you'll be proud to leave out on the counter.",
  },
  {
    icon: Leaf,
    title: "Sustainable Practices",
    text: "Eco-friendly materials. From responsibly harvested walnut to PFOA-free ceramics, we partner with makers who share our commitment to greener manufacturing and honest sourcing.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="container-page flex flex-col gap-14 py-8 sm:py-10">
      {/* Hero: story copy left, image right */}
      <section aria-labelledby="about-story-heading" className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <div>
          <h1 id="about-story-heading" className="font-display text-3xl font-bold sm:text-4xl">
            Our Story
          </h1>
          <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
            <p>
              Founded in 2020, HomeNest Kitchen began in a tiny apartment kitchen with one stubborn
              frustration: cookware that looked gorgeous online but warped, scratched, or dulled within a
              season. We set out to build the store we wished existed — one where every pan, knife, and
              storage container had been cooked with, cleaned, and lived with before it earned a listing.
            </p>
            <p>
              Five years later, that obsession has grown into a catalog of more than 500 premium products
              from 25 expert brands, shipped to over 50,000 happy customers. We read every review, test
              every new collection in our own test kitchen, and stand behind each order with a 30-day
              return promise. Because a kitchen should be the room you never want to leave.
            </p>
          </div>
        </div>
        <Image
          src="/images/hero-new-arrivals.png"
          alt="A modern kitchen counter styled with new HomeNest arrivals"
          width={880}
          height={660}
          priority
          className="h-auto w-full rounded-3xl border border-border object-cover shadow-sm"
        />
      </section>

      {/* Stats band */}
      <section
        aria-label="HomeNest in numbers"
        className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm sm:grid-cols-4 sm:p-10"
      >
        {STATS.map((item) => (
          <div key={item.label}>
            <p className="font-display text-3xl font-bold text-primary sm:text-4xl">{item.stat}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </section>

      {/* Values */}
      <section aria-labelledby="about-values-heading">
        <div className="mb-6">
          <h2 id="about-values-heading" className="font-display text-2xl font-bold sm:text-3xl">
            What We Stand For
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Three principles guide every product we stock.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                <value.icon className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{value.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{value.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Craftsmanship */}
      <section
        aria-labelledby="about-craft-heading"
        className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2"
      >
        <Image
          src="/images/about-workshop.jpg"
          alt="Artisans shaping and finishing kitchenware in a woodworking workshop"
          width={880}
          height={660}
          className="order-last h-auto w-full rounded-3xl border border-border object-cover shadow-sm lg:order-first"
        />
        <div>
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
            <Hammer className="h-6 w-6" aria-hidden />
          </span>
          <h2 id="about-craft-heading" className="mt-4 font-display text-2xl font-bold sm:text-3xl">
            Craftsmanship You Can Feel
          </h2>
          <div className="mt-4 space-y-4 leading-7 text-muted-foreground">
            <p>
              Our most-loved pieces come from small workshops where a single artisan may sand, oil, and
              inspect every board by hand. A walnut cutting board from our collection carries hundreds of
              hours of pattern-making across its grain — no two are ever exactly alike.
            </p>
            <p>
              We visit the factories we work with, walk the floors, and ask awkward questions about
              materials and waste. The result is cookware that passes heirloom tests: copper pans re-tinned
              rather than replaced, knives that hold their edge through years of Sunday prep, and ceramics
              glazed to survive a lifetime of dishwashers.
            </p>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden rounded-3xl bg-foreground text-background">
        <Image
          src="/images/hero-elevate.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-14 text-center sm:py-16">
          <h2 className="font-display text-2xl font-bold sm:text-4xl">Ready to elevate your kitchen?</h2>
          <p className="max-w-xl text-sm text-background/70 sm:text-base">
            Browse the collection that 50,000 home cooks already trust — and find the piece your kitchen has
            been missing.
          </p>
          <Link
            href="/products"
            className="mt-2 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            Shop the Collection <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
