import * as React from "react";
import type { DateRange } from "react-day-picker";

export type Guests = { adults: number; children: number };

type TripValue = {
  range: DateRange | undefined;
  setRange: (range: DateRange | undefined) => void;
  guests: Guests;
  setGuests: (guests: Guests) => void;
  saved: string[];
  isSaved: (slug: string) => boolean;
  toggleSaved: (slug: string) => boolean;
};

const TripContext = React.createContext<TripValue | null>(null);

const TRIP_KEY = "zen:trip";
const SAVED_KEY = "zen:wishlist";

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private modes; state still works for this visit.
  }
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function restoreRange(raw: { from?: string; to?: string } | null): DateRange | undefined {
  if (!raw?.from) return undefined;
  const from = new Date(raw.from);
  if (Number.isNaN(from.getTime()) || from < startOfToday()) return undefined;
  const to = raw.to ? new Date(raw.to) : undefined;
  return { from, to: to && !Number.isNaN(to.getTime()) ? to : undefined };
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = React.useState<DateRange | undefined>(() =>
    restoreRange(readJson(sessionStorage, TRIP_KEY, { range: null as null | { from?: string; to?: string } }).range),
  );
  const [guests, setGuestsState] = React.useState<Guests>(() => {
    const stored = readJson<{ guests?: Guests }>(sessionStorage, TRIP_KEY, {}).guests;
    return stored && stored.adults >= 1 ? stored : { adults: 2, children: 0 };
  });
  const [saved, setSaved] = React.useState<string[]>(() => readJson<string[]>(localStorage, SAVED_KEY, []));

  React.useEffect(() => {
    writeJson(sessionStorage, TRIP_KEY, {
      range: range?.from ? { from: range.from.toISOString(), to: range.to?.toISOString() } : null,
      guests,
    });
  }, [range, guests]);

  React.useEffect(() => writeJson(localStorage, SAVED_KEY, saved), [saved]);

  const toggleSaved = React.useCallback(
    (slug: string) => {
      const willSave = !saved.includes(slug);
      setSaved((current) => (willSave ? [...current, slug] : current.filter((s) => s !== slug)));
      return willSave;
    },
    [saved],
  );

  const value = React.useMemo<TripValue>(
    () => ({
      range,
      setRange: setRangeState,
      guests,
      setGuests: setGuestsState,
      saved,
      isSaved: (slug) => saved.includes(slug),
      toggleSaved,
    }),
    [range, guests, saved, toggleSaved],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = React.useContext(TripContext);
  if (!value) throw new Error("useTrip must be used inside <TripProvider>");
  return value;
}

export { startOfToday };
