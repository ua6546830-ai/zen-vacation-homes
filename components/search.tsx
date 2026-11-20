import * as React from "react";
import { MapPin, Minus, Plus, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { areas, type AreaId } from "@/functions/catalog";
import { guestsLabel, nightsIn, rangeLabel, shortDate } from "@/lib/format";
import { homeUrl, homesInArea, parseArea, parseCategory, parseSort } from "@/lib/listings";
import { useRouter } from "@/lib/router";
import { startOfToday, useTrip, type Guests } from "@/lib/trip";

export function AreaList({ value, onSelect }: { value: AreaId | null; onSelect: (area: AreaId | null) => void }) {
  const { listings } = useCatalog();
  const options: { id: AreaId | null; name: string; hint: string }[] = [
    { id: null, name: "Anywhere in Karachi", hint: "All neighbourhoods" },
    ...areas,
  ];
  return (
    <ul className="grid gap-1" aria-label="Neighbourhoods">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <li key={option.id ?? "all"}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted",
                active && "bg-muted",
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-background">
                <MapPin className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {homesInArea(listings, option.id)} {homesInArea(listings, option.id) === 1 ? "home" : "homes"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TripCalendar({
  range,
  onChange,
  months = 2,
}: {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  months?: number;
}) {
  const today = startOfToday();
  return (
    <Calendar
      mode="range"
      selected={range}
      onSelect={onChange}
      numberOfMonths={months}
      defaultMonth={range?.from ?? today}
      startMonth={today}
      disabled={{ before: today }}
      min={1}
      resetOnSelect
      className="bg-transparent p-0 [--cell-size:--spacing(10)]"
    />
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3" role="group" aria-labelledby={id}>
      <div>
        <div id={id} className="text-sm font-medium">
          {label}
        </div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          <Minus />
        </Button>
        <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          aria-label={`More ${label.toLowerCase()}`}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export function GuestCounter({
  guests,
  onChange,
  maxGuests = 16,
}: {
  guests: Guests;
  onChange: (guests: Guests) => void;
  maxGuests?: number;
}) {
  const total = guests.adults + guests.children;
  return (
    <div className="divide-y">
      <Stepper
        label="Adults"
        hint="Age 13 or above"
        value={guests.adults}
        min={1}
        max={guests.adults + (maxGuests - total)}
        onChange={(adults) => onChange({ ...guests, adults })}
      />
      <Stepper
        label="Children"
        hint="Ages 2–12"
        value={guests.children}
        min={0}
        max={guests.children + (maxGuests - total)}
        onChange={(children) => onChange({ ...guests, children })}
      />
    </div>
  );
}

function DatesSummary({ range, onClear }: { range: DateRange | undefined; onClear: () => void }) {
  const nights = nightsIn(range);
  return (
    <div className="mt-3 flex items-center justify-between gap-4 border-t pt-3 text-sm">
      <span className="text-muted-foreground">
        {nights
          ? `${nights} night${nights === 1 ? "" : "s"} · ${shortDate(range!.from!)} – ${shortDate(range!.to!)}`
          : range?.from
            ? "Now choose your checkout date"
            : "Choose your check-in date"}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={!range?.from} className="underline underline-offset-4">
        Clear dates
      </Button>
    </div>
  );
}

function useSearchState() {
  const { path, search, navigate } = useRouter();
  const trip = useTrip();
  const area = parseArea(search.get("area"));
  const go = (nextArea: AreaId | null, toResults: boolean) => {
    const url = homeUrl(
      { area: nextArea, type: parseCategory(search.get("type")), sort: parseSort(search.get("sort")) },
      toResults ? "#homes" : "",
    );
    navigate(url, { replace: path === "/" && !toResults, scroll: toResults });
  };
  return { path, area, go, ...trip };
}

type Segment = "where" | "dates" | "who" | null;

function SegmentButton({
  label,
  value,
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string; value: string; active: boolean }) {
  return (
    <button
      type="button"
      data-active={active}
      className={cn(
        "flex h-full min-w-0 flex-col justify-center rounded-full px-5 text-left hover:bg-muted data-[active=true]:bg-background data-[active=true]:shadow-[0_4px_18px_rgba(34,34,34,.14)]",
        className,
      )}
      {...props}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className="truncate text-sm text-muted-foreground">{value}</span>
    </button>
  );
}

export function DesktopSearch({ className }: { className?: string }) {
  const { area, go, path, range, setRange, guests, setGuests } = useSearchState();
  const [open, setOpen] = React.useState<Segment>(null);
  const toggle = (segment: Exclude<Segment, null>) => (next: boolean) => setOpen(next ? segment : null);

  return (
    <div
      role="search"
      aria-label="Search homes"
      className={cn(
        "h-14 items-center rounded-full border bg-background p-1 shadow-[0_2px_10px_rgba(34,34,34,.08)] lg:h-16",
        open && "bg-muted",
        className,
      )}
    >
      <Popover open={open === "where"} onOpenChange={toggle("where")}>
        <PopoverTrigger asChild>
          <SegmentButton
            label="Where"
            value={area ? areas.find((a) => a.id === area)!.name : "Anywhere in Karachi"}
            active={open === "where"}
            className="w-40 xl:w-52"
          />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={12} className="w-[22rem] rounded-2xl p-3">
          <AreaList
            value={area}
            onSelect={(next) => {
              if (path === "/") go(next, false);
              else go(next, true);
              setOpen("dates");
            }}
          />
        </PopoverContent>
      </Popover>
      <span className="h-8 w-px bg-border" aria-hidden />
      <Popover open={open === "dates"} onOpenChange={toggle("dates")}>
        <PopoverAnchor asChild>
          <div className="flex h-full">
            <SegmentButton
              label="Check in"
              value={range?.from ? shortDate(range.from) : "Add dates"}
              active={open === "dates"}
              aria-haspopup="dialog"
              aria-expanded={open === "dates"}
              onClick={() => setOpen(open === "dates" ? null : "dates")}
              className="w-28 xl:w-36"
            />
            <span className="my-auto h-8 w-px bg-border" aria-hidden />
            <SegmentButton
              label="Check out"
              value={range?.to ? shortDate(range.to) : "Add dates"}
              active={open === "dates"}
              aria-haspopup="dialog"
              aria-expanded={open === "dates"}
              onClick={() => setOpen(open === "dates" ? null : "dates")}
              className="w-28 xl:w-36"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent align="center" sideOffset={12} className="w-auto rounded-3xl p-6" aria-label="Choose dates">
          <TripCalendar range={range} onChange={setRange} />
          <DatesSummary range={range} onClear={() => setRange(undefined)} />
        </PopoverContent>
      </Popover>
      <span className="h-8 w-px bg-border" aria-hidden />
      <div className="flex h-full items-center">
        <Popover open={open === "who"} onOpenChange={toggle("who")}>
          <PopoverTrigger asChild>
            <SegmentButton label="Who" value={guestsLabel(guests)} active={open === "who"} className="w-32 xl:w-40" />
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={12} className="w-80 rounded-2xl px-6 py-3">
            <GuestCounter guests={guests} onChange={setGuests} />
            <p className="border-t pt-3 pb-1 text-xs text-muted-foreground">
              Your host confirms the best home for your group on WhatsApp.
            </p>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="icon"
          className="ml-1 size-11 rounded-full lg:size-12"
          onClick={() => {
            setOpen(null);
            go(area, true);
          }}
        >
          <Search className="size-5" />
          <span className="sr-only">Search</span>
        </Button>
      </div>
    </div>
  );
}

export function MobileSearch({ className }: { className?: string }) {
  const { area, go, range, setRange, guests, setGuests } = useSearchState();
  const [open, setOpen] = React.useState(false);
  const [draftArea, setDraftArea] = React.useState<AreaId | null>(area);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraftArea(area);
        setOpen(next);
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full min-w-0 items-center gap-3 rounded-full border bg-background px-4 py-2 text-left shadow-[0_3px_12px_rgba(34,34,34,.10)]",
            className,
          )}
        >
          <Search className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {area ? areas.find((a) => a.id === area)!.name : "Where to in Karachi?"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {rangeLabel(range)} · {guestsLabel(guests)}
            </span>
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-display text-2xl font-medium">Find your stay</SheetTitle>
          <SheetDescription>Find your private stay across Karachi.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-4">
          <section aria-labelledby="m-where">
            <h3 id="m-where" className="mb-2 text-base font-semibold">
              Where
            </h3>
            <AreaList value={draftArea} onSelect={setDraftArea} />
          </section>
          <section aria-labelledby="m-when">
            <h3 id="m-when" className="mb-2 text-base font-semibold">
              When
            </h3>
            <div className="flex justify-center">
              <TripCalendar range={range} onChange={setRange} months={1} />
            </div>
            <DatesSummary range={range} onClear={() => setRange(undefined)} />
          </section>
          <section aria-labelledby="m-who">
            <h3 id="m-who" className="text-base font-semibold">
              Who
            </h3>
            <GuestCounter guests={guests} onChange={setGuests} />
          </section>
        </div>
        <SheetFooter className="sticky bottom-0 flex-row items-center justify-between border-t bg-background">
          <Button
            type="button"
            variant="ghost"
            className="underline underline-offset-4"
            onClick={() => {
              setDraftArea(null);
              setRange(undefined);
              setGuests({ adults: 2, children: 0 });
            }}
          >
            Clear all
          </Button>
          <Button
            type="button"
            size="lg"
            className="rounded-full"
            onClick={() => {
              setOpen(false);
              go(draftArea, true);
            }}
          >
            <Search /> Search
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
