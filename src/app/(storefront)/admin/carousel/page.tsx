import type { Metadata } from "next";
import Image from "next/image";

import { db } from "@/lib/db";

import {
  SlideDeleteButton,
  SlideDialogButton,
  SlideMoveButton,
  SlideToggleButton,
  type SlideFormValues,
} from "./slide-dialog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Carousel" };

export default async function AdminCarouselPage() {
  const slides = await db.carouselSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const ids = slides.map((slide) => slide.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Hero Carousel</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Manage the hero banners shown at the top of the storefront home page. Slides are displayed in
            sort order — use the arrows to reorder, the eye to hide, and Add Slide for new banners.
          </p>
        </header>
        <SlideDialogButton slide={null} nextSortOrder={slides.length} label="Add Slide" />
      </div>

      <div className="space-y-4">
        {slides.map((slide, index) => {
          const formValues: SlideFormValues = {
            id: slide.id,
            title: slide.title,
            subtitle: slide.subtitle,
            image: slide.image,
            ctaText: slide.ctaText,
            ctaLink: slide.ctaLink,
            sortOrder: slide.sortOrder,
            isActive: slide.isActive,
          };
          return (
            <article
              key={slide.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-primary sm:flex"
                >
                  {index + 1}
                </span>
                <Image
                  src={slide.image}
                  alt=""
                  width={176}
                  height={96}
                  className="h-24 w-full max-w-[220px] rounded-lg border border-border object-cover sm:w-44"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{slide.title}</h2>
                  {!slide.isActive && (
                    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                      Hidden
                    </span>
                  )}
                </div>
                {slide.subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{slide.subtitle}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  CTA: <span className="font-medium text-foreground">{slide.ctaText}</span> → {slide.ctaLink}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">{slide.image}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <SlideMoveButton ids={ids} index={index} direction="up" />
                <SlideMoveButton ids={ids} index={index} direction="down" />
                <SlideToggleButton slide={formValues} />
                <SlideDialogButton slide={formValues} nextSortOrder={slides.length} />
                <SlideDeleteButton id={slide.id} title={slide.title} />
              </div>
            </article>
          );
        })}
        {slides.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No slides yet — add your first hero banner.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
