"use client";

import * as React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

const FALLBACK_IMAGE = "/images/placeholder.svg";

/**
 * ProductGallery — main square image plus a clickable thumbnail row that
 * swaps the main image. Falls back to the neutral placeholder when a product
 * has no images.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const gallery = images.length > 0 ? images : [FALLBACK_IMAGE];
  const [active, setActive] = React.useState(0);
  const index = Math.min(Math.max(active, 0), gallery.length - 1);
  const mainSrc = gallery[index] ?? FALLBACK_IMAGE;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary">
        <Image
          src={mainSrc}
          alt={name}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {gallery.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-3" role="group" aria-label={`${name} images`}>
          {gallery.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1} of ${gallery.length}`}
              aria-pressed={i === index}
              className={cn(
                "relative h-20 w-20 overflow-hidden rounded-lg border-2 bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === index ? "border-primary" : "border-transparent hover:border-border",
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
