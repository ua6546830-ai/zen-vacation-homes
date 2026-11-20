import { useState } from "react";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PhotoStrip } from "@/components/listing-card";
import type { Listing } from "@/functions/catalog";

export function Gallery({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative hidden h-[min(36vw,480px)] min-h-80 grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:grid">
        {listing.photos.slice(0, 5).map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`View all photos: ${photo.alt}`}
            className={`overflow-hidden bg-muted ${i === 0 ? "col-span-2 row-span-2" : ""}`}
          >
            <img src={photo.src} alt={photo.alt} loading={i === 0 ? "eager" : "lazy"} className="size-full object-cover transition hover:brightness-90" />
          </button>
        ))}
        <Button onClick={() => setOpen(true)} variant="outline" className="absolute right-5 bottom-5 rounded-lg border-foreground bg-background shadow-md">
          <Images /> Show all photos
        </Button>
      </div>
      <div className="relative -mx-5 md:hidden">
        <PhotoStrip photos={listing.photos} label={`Photos of ${listing.name}`} eager showCounter className="aspect-[4/3]" />
        <button type="button" onClick={() => setOpen(true)} className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
          <Images className="size-4" /> All photos
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-4xl">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-2xl">{listing.name}</DialogTitle>
            <DialogDescription>{listing.photos.length} real photos of this home</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 sm:grid-cols-2">
            {listing.photos.map((photo, i) => (
              <figure key={photo.src} className={i === 0 ? "sm:col-span-2" : ""}>
                <img src={photo.src} alt={photo.alt} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
                <figcaption className="mt-2 text-xs text-muted-foreground">{i + 1}. {photo.alt}</figcaption>
              </figure>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
