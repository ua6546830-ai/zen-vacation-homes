import * as React from "react";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { GuestCounter, TripCalendar } from "@/components/search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { houseRules, type Listing } from "@/functions/catalog";
import { useIsMobile } from "@/hooks/use-mobile";
import { bookingMessage, emailLink, guestsLabel, nightsIn, shortDate, whatsappLink } from "@/lib/format";
import { useTrip } from "@/lib/trip";

function tripDates(range: DateRange | undefined) {
  if (!range?.from) return range?.to ? "Add check-in" : "Flexible dates";
  return range.to
    ? `${shortDate(range.from)} – ${shortDate(range.to)}`
    : `${shortDate(range.from)} – add checkout`;
}

function useBookingDetails(listing: Listing) {
  const { range, setRange, guests, setGuests } = useTrip();
  const nights = nightsIn(range);
  const warnings: string[] = [];

  if (listing.maxGuests !== undefined && guests.adults + guests.children > listing.maxGuests) {
    warnings.push(
      `This home accommodates up to ${listing.maxGuests} guest${listing.maxGuests === 1 ? "" : "s"}. Reduce your guest count to request this stay.`,
    );
  }
  if (range?.from && !range.to) {
    warnings.push("Add a checkout date, or clear dates for a flexible stay.");
  } else if (range?.to && !range.from) {
    warnings.push("Add a check-in date, or clear dates for a flexible stay.");
  } else if (range?.from && range.to && nights < 1) {
    warnings.push("Checkout must be after check-in. Please update your dates.");
  }

  return { range, setRange, guests, setGuests, nights, warnings, blocked: warnings.length > 0 };
}

function TripWarnings({ warnings, id }: { warnings: string[]; id: string }) {
  if (!warnings.length) return null;
  return (
    <div id={id} role="status" className="grid gap-1 text-xs leading-relaxed text-destructive">
      {warnings.map((warning) => <p key={warning}>{warning}</p>)}
    </div>
  );
}

function RequestDialog({ listing, children }: { listing: Listing; children: React.ReactElement }) {
  const { range, guests, nights, warnings, blocked } = useBookingDetails(listing);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const id = React.useId();
  const canSend = open && acknowledged && !blocked;
  const message = canSend ? bookingMessage({ listing, range, guests, name, note }) : undefined;
  const whatsappLabel = <><MessageCircle aria-hidden />Continue on WhatsApp</>;
  const emailLabel = <><Mail aria-hidden />Request by email</>;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && blocked) return;
        setAcknowledged(false);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl bg-background p-5 sm:max-w-xl sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="font-display text-2xl font-medium">Request availability &amp; price</DialogTitle>
          <DialogDescription>Your host confirms availability and current rates for your dates. This is not a confirmed booking.</DialogDescription>
        </DialogHeader>

        <section aria-label="Your stay summary" className="grid gap-3 rounded-xl border bg-background p-4">
          <div>
            <h3 className="font-semibold">{listing.name}</h3>
            <p className="text-sm text-muted-foreground">{listing.locality}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Dates</dt>
              <dd className="mt-1">{tripDates(range)}{nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Guests</dt>
              <dd className="mt-1">{guestsLabel(guests)}</dd>
            </div>
          </dl>
          <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">Ask host for current rates. Prices vary with your dates; your host will send a quote before you confirm.</p>
        </section>

        <TripWarnings warnings={warnings} id={`${id}-warnings`} />

        <div className="grid gap-2">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Your name <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 80))}
            className="h-11 rounded-xl bg-background"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${id}-note`} className="text-sm font-medium">
            Note for your host <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id={`${id}-note`}
            name="note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 1000))}
            aria-describedby={`${id}-note-limit`}
            placeholder="Arrival plans or anything you’d like to ask"
            className="max-h-40 resize-y rounded-xl bg-background"
          />
          <p id={`${id}-note-limit`} className="text-right text-xs text-muted-foreground">{note.length} / 1,000 characters</p>
        </div>

        <section aria-labelledby={`${id}-rules-title`} className="rounded-xl border bg-background p-4">
          <h3 id={`${id}-rules-title`} className="text-sm font-semibold">House rules</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Check-in: {houseRules.checkIn} · Checkout: {houseRules.checkOut}
          </p>
          <ul className="mt-3 grid gap-2 text-xs leading-relaxed">
            {houseRules.rules.map((rule) => (
              <li key={rule.id}>
                <span className="font-semibold">{rule.title}. </span>{rule.text}
              </li>
            ))}
          </ul>
        </section>
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${id}-rules`}
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            required
            aria-describedby={`${id}-acknowledgement`}
            className="mt-0.5"
          />
          <label htmlFor={`${id}-rules`} className="text-sm leading-relaxed">
            I have read and acknowledge the house rules above.
          </label>
        </div>
        <p id={`${id}-acknowledgement`} className="text-xs text-muted-foreground">
          Acknowledge the house rules to enable WhatsApp and email requests.
        </p>

        <div className="grid gap-2" aria-describedby={blocked ? `${id}-warnings` : `${id}-acknowledgement`}>
          {message ? (
            <>
              <Button asChild size="lg" className="h-11 rounded-xl bg-whatsapp text-white hover:bg-whatsapp/90">
                <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">{whatsappLabel}</a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-xl">
                <a href={emailLink(`Stay request: ${listing.name}`, message)}>{emailLabel}</a>
              </Button>
            </>
          ) : (
            <>
              <Button type="button" disabled size="lg" className="h-11 rounded-xl bg-whatsapp text-white hover:bg-whatsapp/90">{whatsappLabel}</Button>
              <Button type="button" disabled variant="outline" size="lg" className="h-11 rounded-xl">{emailLabel}</Button>
            </>
          )}
          <p className="mt-1 text-center text-xs text-muted-foreground">You won’t be charged on this website</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BookingCard({ listing }: { listing: Listing }) {
  const { range, setRange, guests, setGuests, nights, warnings, blocked } = useBookingDetails(listing);
  const isMobile = useIsMobile();
  const [datesOpen, setDatesOpen] = React.useState(false);
  const [guestsOpen, setGuestsOpen] = React.useState(false);
  const warningId = React.useId();
  const partialDates = Boolean((range?.from && !range.to) || (range?.to && !range.from));

  return (
    <aside aria-label="Request this home" className="sticky top-[calc(var(--header-h)+1.5rem)] grid h-fit gap-5 rounded-xl border bg-background p-5 shadow-sm lg:p-6">
      <div>
        <h2 className="font-display text-2xl font-medium">Your stay, your quote</h2>
        <p className="mt-2 text-sm font-semibold text-primary">Ask host for current rates</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Rates vary by date. Share your plans for availability and a personalised quote.</p>
      </div>
      <div className="rounded-xl border bg-background">
        <Popover open={datesOpen} onOpenChange={setDatesOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" aria-label="Choose check-in and checkout dates" className="h-auto w-full justify-start rounded-t-xl rounded-b-none p-0 text-left">
              <span className="grid w-full grid-cols-2 divide-x">
                <span className="grid gap-1 px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Check-in</span>
                  <span className="text-sm font-normal">{range?.from ? shortDate(range.from) : "Add date"}</span>
                </span>
                <span className="grid gap-1 px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Checkout</span>
                  <span className="text-sm font-normal">{range?.to ? shortDate(range.to) : range?.from ? "Add checkout" : "Add date"}</span>
                </span>
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} collisionPadding={16} aria-label="Choose your stay dates" className="max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background p-4">
            <TripCalendar range={range} onChange={setRange} months={isMobile ? 1 : 2} />
            <p role="status" className="mt-3 border-t pt-3 text-sm text-muted-foreground">
              {partialDates ? "Complete your check-in and checkout dates." : nights ? `${nights} night${nights === 1 ? "" : "s"} · ${tripDates(range)}` : "Choose dates, or leave them flexible."}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="sm" disabled={!range?.from && !range?.to} onClick={() => setRange(undefined)} className="rounded-xl underline underline-offset-4">Clear dates</Button>
              <Button type="button" size="sm" disabled={partialDates} onClick={() => setDatesOpen(false)} className="rounded-xl">Done</Button>
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" aria-label={`Choose guests, currently ${guestsLabel(guests)}`} className="h-auto w-full justify-between rounded-t-none rounded-b-xl border-t px-4 py-3 text-left">
              <span className="grid gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide">Guests</span>
                <span className="text-sm font-normal">{guestsLabel(guests)}</span>
              </span>
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} collisionPadding={16} aria-label="Choose guests" className="w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-background p-4">
            <GuestCounter guests={guests} onChange={setGuests} maxGuests={listing.maxGuests ?? 16} />
            <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
              {listing.maxGuests !== undefined
                ? `Up to ${listing.maxGuests} guest${listing.maxGuests === 1 ? "" : "s"}.`
                : "Your host will confirm whether this home suits your group."}
            </p>
            <div className="mt-3 flex justify-end">
              <Button type="button" size="sm" className="rounded-xl" onClick={() => setGuestsOpen(false)}>Done</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <TripWarnings warnings={warnings} id={warningId} />
      <RequestDialog key={listing.slug} listing={listing}>
        <Button type="button" size="lg" disabled={blocked} aria-describedby={blocked ? warningId : undefined} className="h-12 w-full rounded-xl">Request availability &amp; price</Button>
      </RequestDialog>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">You won’t be charged on this website. Your host confirms the quote and booking directly.</p>
    </aside>
  );
}

export function MobileBookingBar({ listing }: { listing: Listing }) {
  const { range, warnings, blocked } = useBookingDetails(listing);
  const warningId = React.useId();

  return (
    <div aria-label="Request this home" className="fixed inset-x-0 bottom-0 z-40 grid gap-2 border-t bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:hidden">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:block">
          <p className="text-sm font-semibold">Ask host for current rates</p>
          <p className="text-xs text-muted-foreground">{tripDates(range)}</p>
        </div>
        <RequestDialog key={listing.slug} listing={listing}>
          <Button type="button" size="lg" disabled={blocked} aria-describedby={blocked ? warningId : undefined} className="h-11 w-full rounded-xl px-4 sm:w-auto">Request availability &amp; price</Button>
        </RequestDialog>
      </div>
      <TripWarnings warnings={warnings} id={warningId} />
      {blocked && <p className="text-xs text-muted-foreground">Edit dates and guests in the search above.</p>}
    </div>
  );
}
