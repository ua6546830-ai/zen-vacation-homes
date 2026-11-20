import { Award, BedDouble, Check, ChevronLeft, Heart, MapPin, Share2, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Gallery } from "@/components/gallery";
import { BookingCard, MobileBookingBar } from "@/components/booking";
import { ListingCard, SaveButton } from "@/components/listing-card";
import { ClosingCta, HostSection, HouseRulesList, HowToBookSection, ReviewsSection, RulesSection } from "@/components/home-sections";
import { amenityInfo, highlightIcons } from "@/components/icons";
import { areaName, business, type Listing } from "@/functions/catalog";
import { useCatalog } from "@/lib/catalog";
import { bathsLabel, bedroomsLabel, mapsLink } from "@/lib/format";
import { findHomes, homeUrl, parseArea, parseCategory, parseSort, sorts, type SortId } from "@/lib/listings";
import { Link, useDocumentTitle, useRouter } from "@/lib/router";
import { useTrip } from "@/lib/trip";

export function HomePage() {
  useDocumentTitle("Zen Vacation Homes — Real homes for short stays in Karachi");
  const { search, navigate } = useRouter();
  const area = parseArea(search.get("area"));
  const type = parseCategory(search.get("type"));
  const sort = parseSort(search.get("sort"));
  const { listings } = useCatalog();
  const homes = findHomes(listings, area, type, sort);
  return (
    <main className="shell">
      <section className="flex flex-wrap items-end justify-between gap-5 pt-9 pb-8 md:pt-11 md:pb-9" aria-labelledby="home-title">
        <div>
          <p className="text-xs font-semibold tracking-[.12em] text-primary uppercase">Real stays. Real pictures.</p>
          <h1 id="home-title" className="mt-2 font-display text-3xl font-medium text-balance sm:text-4xl lg:text-5xl">Escape to calmness in Karachi</h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">Your own space. A local host. Explore our current homes and ask for a quote.</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium sm:text-sm">
          <span className="flex items-center gap-1.5"><Award className="size-4 text-primary" /> Superhost</span>
          <span className="flex items-center gap-1.5"><Star className="size-3.5 fill-primary text-primary" /> {business.host.rating} · {business.host.reviewCount} Airbnb reviews</span>
          <span className="flex items-center gap-1.5"><Check className="size-4 text-primary" /> Book direct</span>
        </div>
      </section>
      <section id="homes" aria-labelledby="homes-title">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
          <div>
            <h2 id="homes-title" className="text-base font-semibold">{homes.length} {homes.length === 1 ? "home" : "homes"} in {area ? areaName(area) : "Karachi"}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Zap className="size-3.5" /> Utilities, Wi-Fi and AC included · Host confirms availability</p>
          </div>
          <NativeSelect aria-label="Sort homes" value={sort} onChange={(e) => navigate(homeUrl({ area, type, sort: e.target.value as SortId }), { replace: true, scroll: false })} className="h-10 rounded-lg border-border text-xs sm:text-sm">
            {sorts.map((s) => <NativeSelectOption value={s.id} key={s.id}>{s.label}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        {homes.length ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {homes.map((listing, i) => <ListingCard key={listing.slug} listing={listing} eager={i < 4} />)}
          </div>
        ) : (
          <Empty className="min-h-72 rounded-2xl border">
            <EmptyHeader><EmptyMedia variant="icon"><MapPin /></EmptyMedia><EmptyTitle>No homes match this combination</EmptyTitle><EmptyDescription>Try another neighbourhood or browse all current homes.</EmptyDescription></EmptyHeader>
            <EmptyContent><Button asChild className="rounded-full"><Link to="/#homes">Show all homes</Link></Button></EmptyContent>
          </Empty>
        )}
        <p className="mt-7 text-xs text-muted-foreground">Rates vary by date. Ask your host for availability and the current price for your stay.</p>
      </section>
      <div className="mt-20 grid gap-20 md:mt-28 md:gap-28">
        <ReviewsSection />
        <HostSection />
        <RulesSection />
        <HowToBookSection />
        <ClosingCta />
      </div>
    </main>
  );
}

async function shareHome(listing: Listing) {
  const url = `${window.location.origin}/homes/${listing.slug}`;
  try {
    if (navigator.share) await navigator.share({ title: `${listing.name} · Zen Vacation Homes`, url });
    else { await navigator.clipboard.writeText(url); toast.success("Home link copied"); }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Could not share. Copy the link from your address bar.");
  }
}

export function ListingPage({ listing }: { listing: Listing }) {
  useDocumentTitle(`${listing.name} · ${listing.bedrooms}BR ${listing.type} in ${areaName(listing.area)} · Zen Vacation Homes`);
  const { listings } = useCatalog();
  const more = listings.filter((l) => l.slug !== listing.slug).sort((a, b) => Number(b.area === listing.area) - Number(a.area === listing.area)).slice(0, 4);
  return (
    <main className="shell pb-32 md:pb-0">
      <div className="pt-5 pb-6 md:pt-7">
        <Link to={homeUrl({ area: listing.area }, "#homes")} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> All homes in {areaName(listing.area)}</Link>
        <h1 className="font-display text-3xl font-medium md:text-4xl">{listing.name}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {listing.airbnb && <span className="flex items-center gap-1.5"><Star className="size-3.5 fill-current" /> {listing.airbnb.rating.toFixed(1)} · <a href={listing.airbnb.url} target="_blank" rel="noopener noreferrer" className="underline">{listing.airbnb.reviews} Airbnb reviews</a></span>}
            <span className="flex items-center gap-1"><Award className="size-4" /> Superhost</span>
            <a href="#location" className="underline underline-offset-2">{listing.locality}, Karachi</a>
          </div>
          <div className="flex gap-5">
            <button type="button" onClick={() => shareHome(listing)} className="flex items-center gap-2 rounded-md"><Share2 className="size-4" /><span className="underline underline-offset-4">Share</span></button>
            <SaveButton listing={listing} withLabel className="flex items-center gap-2 rounded-md" />
          </div>
        </div>
      </div>
      <Gallery listing={listing} />
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)] lg:gap-16">
        <div className="min-w-0">
          <section className="border-b pb-7">
            <h2 className="text-xl font-semibold">{listing.type === "Portion" ? "Private portion" : `Entire ${listing.type.toLowerCase()}`} in {areaName(listing.area)}</h2>
            <p className="mt-1 text-sm">{listing.maxGuests ? `Up to ${listing.maxGuests} guests · ` : ""}{bedroomsLabel(listing.bedrooms)}{listing.beds ? ` · ${listing.beds} beds` : ""} · {bathsLabel(listing.bathrooms)}</p>
            {listing.floor && <p className="mt-1 text-sm text-muted-foreground">{listing.floor}</p>}
            <div className="mt-6 flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-secondary font-display text-xl" aria-hidden>F</span>
              <div><p className="text-sm font-semibold">Hosted by {business.host.firstName}</p><p className="text-xs text-muted-foreground">Superhost · {business.host.yearsHosting} years hosting</p></div>
            </div>
          </section>
          <ul className="grid gap-6 border-b py-7">
            {listing.highlights.map((h) => { const Icon = highlightIcons[h.icon]; return <li key={h.title} className="flex gap-4"><Icon className="mt-0.5 size-7 shrink-0" strokeWidth={1.5} /><div><h3 className="font-semibold">{h.title}</h3><p className="mt-1 text-sm text-muted-foreground">{h.text}</p></div></li>; })}
          </ul>
          <section className="border-b py-8" aria-labelledby="about-title">
            <h2 id="about-title" className="text-xl font-semibold">About this home</h2>
            {listing.about.map((p) => <p key={p} className="mt-4 text-base leading-relaxed text-pretty">{p}</p>)}
            <h3 className="mt-7 font-semibold">The space</h3>
            <ul className="mt-3 grid gap-2 text-sm">{listing.space.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{s}</li>)}</ul>
          </section>
          {listing.sleeping && <section className="border-b py-8"><h2 className="text-xl font-semibold">Where you’ll sleep</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{listing.sleeping.map((s) => <div key={s.room} className="rounded-xl border p-5"><BedDouble className="size-7" strokeWidth={1.5} /><h3 className="mt-4 font-semibold">{s.room}</h3><p className="mt-1 text-sm text-muted-foreground">{s.beds}</p></div>)}</div></section>}
          <section className="border-b py-8" aria-labelledby="amenities-title">
            <h2 id="amenities-title" className="text-xl font-semibold">What this home offers</h2>
            <ul className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">{listing.amenities.map((a) => { const { icon: Icon, label } = amenityInfo[a]; return <li key={a} className="flex items-center gap-4 text-sm"><Icon className="size-6 shrink-0" strokeWidth={1.5} />{label}</li>; })}</ul>
          </section>
          <section id="house-rules" className="border-b py-8" aria-labelledby="listing-rules-title"><h2 id="listing-rules-title" className="mb-6 text-xl font-semibold">Things to know</h2><HouseRulesList listing={listing} /></section>
          <section id="location" className="py-8" aria-labelledby="location-title">
            <h2 id="location-title" className="text-xl font-semibold">Where you’ll be</h2><p className="mt-3 text-sm">{listing.address}</p><p className="mt-1 text-xs text-muted-foreground">Map shows the neighbourhood. Your host shares arrival details after confirmation.</p>
            <iframe title={`Neighbourhood map for ${listing.name}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(listing.mapQuery)}&z=15&output=embed`} loading="lazy" referrerPolicy="no-referrer" className="mt-5 h-72 w-full rounded-xl border bg-muted" />
            <a href={mapsLink(listing.mapQuery)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"><MapPin className="size-4" /> Open in Google Maps</a>
          </section>
        </div>
        <aside className="hidden md:block lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]"><BookingCard listing={listing} /></aside>
      </div>
      <div className="mt-16 grid gap-20 border-t pt-12"><ReviewsSection title="Warm welcomes, memorable stays" /><HostSection id="listing-host" />
        <section aria-labelledby="more-title"><h2 id="more-title" className="font-display text-3xl font-medium">More homes to explore</h2><div className="mt-7 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">{more.map((l) => <ListingCard key={l.slug} listing={l} />)}</div></section>
      </div>
      <MobileBookingBar listing={listing} />
    </main>
  );
}

export function WishlistPage() {
  useDocumentTitle("Wishlist · Zen Vacation Homes");
  const { saved } = useTrip();
  const { listings } = useCatalog();
  const homes = listings.filter((l) => saved.includes(l.slug));
  return <main className="shell min-h-[60vh] py-10"><h1 className="font-display text-4xl font-medium">Your wishlist</h1><p className="mt-3 text-sm text-muted-foreground">Your saved homes, kept on this device.</p>
    {homes.length ? <div className="mt-9 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{homes.map((l) => <ListingCard key={l.slug} listing={l} />)}</div> : <Empty className="mt-10 min-h-80 rounded-2xl border"><EmptyHeader><EmptyMedia variant="icon"><Heart /></EmptyMedia><EmptyTitle>A little calm to come back to</EmptyTitle><EmptyDescription>Tap the heart on a home to save it here. No account needed.</EmptyDescription></EmptyHeader><EmptyContent><Button asChild className="h-11 rounded-full"><Link to="/#homes">Explore homes</Link></Button></EmptyContent></Empty>}
  </main>;
}

export function NotFoundPage() {
  useDocumentTitle("Home not found · Zen Vacation Homes");
  return <main className="shell py-16"><Empty className="min-h-80"><EmptyHeader><EmptyMedia variant="icon"><MapPin /></EmptyMedia><EmptyTitle>This home couldn’t be found</EmptyTitle><EmptyDescription>It may have moved. Explore our current homes in Karachi.</EmptyDescription></EmptyHeader><EmptyContent><Button asChild className="rounded-full"><Link to="/">Back to all homes</Link></Button></EmptyContent></Empty></main>;
}
