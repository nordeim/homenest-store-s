"use client";

/**
 * HeroCarousel — auto-rotating hero matching the reference: rounded-3xl
 * media with a bottom-left dark gradient scrim, large serif title, subtitle,
 * solid-orange CTA, bottom-left dot indicators and bottom-right circular
 * prev/next buttons.
 *
 * v4 trap-log: the slide transition animates opacity only (compositor-safe);
 * slides are absolutely stacked so height is driven by the tallest image —
 * no `hidden` toggling anywhere.
 */
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Slide = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  ctaLink: string;
};

export function HeroCarousel({ slides, autoRotateMs = 6000 }: { slides: Slide[]; autoRotateMs?: number }) {
  const [active, setActive] = React.useState(0);
  const count = slides.length;

  const next = React.useCallback(() => setActive((i) => (i + 1) % count), [count]);
  const prev = React.useCallback(() => setActive((i) => (i - 1 + count) % count), [count]);

  React.useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(next, autoRotateMs);
    return () => window.clearInterval(timer);
  }, [next, autoRotateMs, count]);

  if (count === 0) return null;
  const activeSlide = slides[active];
  if (!activeSlide) return null;

  return (
    <section aria-roledescription="carousel" aria-label="Featured collections" className="relative overflow-hidden rounded-3xl bg-secondary shadow-sm">
      <div className="relative aspect-[21/9] min-h-[320px] w-full sm:aspect-[16/7]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i !== active}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              i === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Image
              src={slide.image}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
            {/* sRGB-interpolated scrim (arbitrary gradient form — the v4
                oklab interpolation trap produces a different ramp). */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent [background-image:linear-gradient(to_top,rgb(0_0_0/0.55),rgb(0_0_0/0.15)_45%,transparent_75%)]" />
          </div>
        ))}

        {/* Slide text */}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <h1 className="font-display text-3xl font-bold text-white drop-shadow-md sm:text-5xl">
            {activeSlide.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/90 drop-shadow sm:text-lg">{activeSlide.subtitle}</p>
          <Link
            href={activeSlide.ctaLink}
            className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            {activeSlide.ctaText}
          </Link>
        </div>

        {/* Dots */}
        <div className="absolute bottom-5 left-6 flex items-center gap-2 sm:left-10" role="tablist" aria-label="Choose slide">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              role="tab"
              aria-selected={i === active}
              aria-label={`Slide ${i + 1}: ${slide.title}`}
              onClick={() => setActive(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === active ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80",
              )}
            />
          ))}
        </div>

        {/* Arrows */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
