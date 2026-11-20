import * as React from "react";
import { ChevronLeft, ChevronRight, Heart, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { areaName, type Listing, type Photo } from "@/functions/catalog";
import { bathsLabel, bedroomsLabel } from "@/lib/format";
import { Link, useRouter } from "@/lib/router";
import { useTrip } from "@/lib/trip";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function PhotoStrip({
  photos,
  href,
  className,
  eager = false,
  showCounter = false,
  label,
}: {
  photos: Photo[];
  href?: string;
  className?: string;
  eager?: boolean;
  showCounter?: boolean;
  label: string;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);

  const goTo = (next: number) => {
    const el = scroller.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, next));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const onScroll = () => {
    const el = scroller.current;
    if (el) setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  const renderSlide = (photo: Photo, i: number) => {
    const img = (
      <img
        src={photo.src}
        alt={href ? "" : photo.alt}
        loading={eager && i === 0 ? "eager" : "lazy"}
        fetchPriority={eager && i === 0 ? "high" : undefined}
        decoding="async"
        draggable={false}
        className="size-full object-cover"
      />
    );
    return href ? (
      <Link key={photo.src} to={href} tabIndex={-1} aria-hidden className="block size-full shrink-0 snap-start snap-always">
        {img}
      </Link>
    ) : (
      <div
        key={photo.src}
        className="size-full shrink-0 snap-start snap-always"
        role="group"
        aria-roledescription="slide"
        aria-label={`${i + 1} of ${photos.length}`}
      >
        {img}
      </div>
    );
  };

  return (
    <div className={cn("group/strip relative overflow-hidden bg-muted", className)} aria-label={label} role="region" aria-roledescription="carousel">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scrollbar-none"
      >
        {photos.map(renderSlide)}
      </div>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
            className={cn(
              "absolute top-1/2 left-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#222] shadow-md transition hover:scale-105 hover:bg-white",
              "opacity-0 group-hover/strip:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden",
              index === 0 && "invisible",
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
            className={cn(
              "absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#222] shadow-md transition hover:scale-105 hover:bg-white",
              "opacity-0 group-hover/strip:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden",
              index === photos.length - 1 && "invisible",
            )}
          >
            <ChevronRight className="size-4" />
          </button>
          {showCounter ? (
            <span className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white tabular-nums">
              {index + 1} / {photos.length}
            </span>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
              {photos.slice(0, 5).map((p, i) => (
                <span
                  key={p.src}
                  className={cn(
                    "size-1.5 rounded-full bg-white/60 shadow-sm transition",
                    (index < 5 ? index : 4) === i && "bg-white scale-110",
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SaveButton({ listing, className, withLabel = false }: { listing: Listing; className?: string; withLabel?: boolean }) {
  const { isSaved, toggleSaved } = useTrip();
  const { navigate } = useRouter();
  const saved = isSaved(listing.slug);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? `Remove ${listing.name} from wishlist` : `Save ${listing.name} to wishlist`}
      onClick={() => {
        const nowSaved = toggleSaved(listing.slug);
        toast(nowSaved ? `Saved ${listing.name}` : `Removed ${listing.name}`, {
          action: nowSaved ? { label: "View wishlist", onClick: () => navigate("/wishlist") } : undefined,
        });
      }}
      className={className}
    >
      <Heart
        className={cn(
          "size-6 transition active:scale-90",
          saved ? "fill-[#d43c5a] text-white" : "fill-black/40 text-white",
          withLabel && (saved ? "size-4 fill-[#d43c5a] text-[#d43c5a]" : "size-4 fill-none text-current"),
        )}
        strokeWidth={withLabel ? 2 : 2.25}
        aria-hidden
      />
      {withLabel && <span className="underline underline-offset-4">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}

export function ListingCard({ listing, eager }: { listing: Listing; eager?: boolean }) {
  const href = `/homes/${listing.slug}`;
  return (
    <article className="group relative">
      <div className="relative">
        <PhotoStrip
          photos={listing.photos.slice(0, 6)}
          href={href}
          eager={eager}
          label={`Photos of ${listing.name}`}
          className="aspect-[20/19] rounded-xl"
        />
        {listing.airbnb?.guestFavourite && (
          <span className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#222] shadow-sm">
            Guest favourite
          </span>
        )}
        <SaveButton listing={listing} className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full" />
      </div>
      <Link to={href} className="mt-3 block rounded-md">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-lg leading-snug font-semibold tracking-tight text-pretty">{listing.name}</h3>
          {listing.airbnb && (
            <span className="mt-0.5 flex shrink-0 items-center gap-1 text-sm">
              <Star className="size-3.5 fill-current" aria-hidden />
              <span>{listing.airbnb.rating.toFixed(1)}</span>
              <span className="sr-only">out of 5, {listing.airbnb.reviews} reviews</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {listing.type === "Portion" ? "Private portion" : listing.type} in {areaName(listing.area)}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {bedroomsLabel(listing.bedrooms)} · {bathsLabel(listing.bathrooms)}
          {listing.maxGuests ? ` · up to ${listing.maxGuests} guests` : ""}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{listing.summary}</p>
        <p className="mt-3 text-sm font-semibold text-primary">Ask host for price</p>
      </Link>
    </article>
  );
}
