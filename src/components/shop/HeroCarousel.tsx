import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CarouselSlide } from "@/types";
import { cn } from "@/utils/cn";

export function HeroCarousel({ slides }: { slides: CarouselSlide[] }) {
  const activeSlides = slides.filter((s) => s.active).sort((a, b) => a.order - b.order);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % activeSlides.length), 6000);
    return () => clearInterval(timer);
  }, [activeSlides.length]);

  if (activeSlides.length === 0) return null;

  return (
    <section className="relative overflow-hidden" aria-label="Featured promotions">
      <div className="relative h-[420px] sm:h-[480px] lg:h-[560px]">
        {activeSlides.map((slide, i) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={i !== index}
          >
            <img
              src={slide.image}
              alt=""
              className="h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950/70 via-ink-950/30 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="max-w-lg animate-fade-in text-cream-50">
                  <h1 className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl lg:text-5xl">
                    {slide.title}
                  </h1>
                  <p className="mt-4 text-base text-cream-100/90 sm:text-lg">{slide.subtitle}</p>
                  <Link
                    to={slide.ctaLink}
                    className="mt-7 inline-flex items-center rounded-lg bg-ember-600 px-6 py-3 text-sm font-semibold text-cream-50 shadow-lifted transition-colors hover:bg-ember-700"
                  >
                    {slide.ctaText}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + activeSlides.length) % activeSlides.length)}
            className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/20 text-cream-50 backdrop-blur hover:bg-cream-50/30 sm:flex"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % activeSlides.length)}
            className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/20 text-cream-50 backdrop-blur hover:bg-cream-50/30 sm:flex"
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {activeSlides.map((slide, i) => (
              <button
                key={slide.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full bg-cream-50/50 transition-all",
                  i === index ? "w-7 bg-cream-50" : "w-1.5",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
