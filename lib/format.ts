import { differenceInCalendarDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { areaName, business, typeLabel, type Listing } from "@/functions/catalog";
import type { Guests } from "@/lib/trip";

export function nightsIn(range: DateRange | undefined) {
  if (!range?.from || !range.to) return 0;
  return Math.max(0, differenceInCalendarDays(range.to, range.from));
}

export const shortDate = (date: Date) => format(date, "d MMM");

export function rangeLabel(range: DateRange | undefined, empty = "Any week") {
  if (!range?.from) return empty;
  if (!range.to) return `${shortDate(range.from)} – add checkout`;
  const sameMonth = range.from.getMonth() === range.to.getMonth();
  return sameMonth
    ? `${format(range.from, "d")}–${format(range.to, "d MMM")}`
    : `${shortDate(range.from)} – ${shortDate(range.to)}`;
}

export function guestsLabel(guests: Guests, empty = "Add guests") {
  const total = guests.adults + guests.children;
  if (total === 0) return empty;
  return `${total} guest${total === 1 ? "" : "s"}`;
}

export function guestsDetail(guests: Guests) {
  const parts = [`${guests.adults} adult${guests.adults === 1 ? "" : "s"}`];
  if (guests.children) parts.push(`${guests.children} child${guests.children === 1 ? "" : "ren"}`);
  return parts.join(", ");
}

export const bedroomsLabel = (n: number) => `${n} bedroom${n === 1 ? "" : "s"}`;
export const bathsLabel = (n: number) => `${n} bath${n === 1 ? "" : "s"}`;

export const listingKind = (l: Listing) => `${l.bedrooms}-bedroom ${typeLabel(l).toLowerCase()}`;

type BookingRequest = {
  listing: Listing;
  range: DateRange | undefined;
  guests: Guests;
  name?: string;
  note?: string;
};

export function bookingMessage({ listing, range, guests, name, note }: BookingRequest, newline = "\n") {
  const nights = nightsIn(range);
  const dates =
    range?.from && range.to
      ? `${format(range.from, "EEE d MMM yyyy")} to ${format(range.to, "EEE d MMM yyyy")} (${nights} night${nights === 1 ? "" : "s"})`
      : "Flexible, please suggest available dates";
  const lines = [
    `Hello Zen Vacation Homes, I would like to request a booking.`,
    "",
    `Home: ${listing.name}, ${listingKind(listing)} in ${areaName(listing.area)}`,
    `Dates: ${dates}`,
    `Guests: ${guestsDetail(guests)}`,
    "Please confirm availability and the current price for these dates.",
    name?.trim() ? `Name: ${name.trim()}` : "",
    note?.trim() ? `Message: ${note.trim()}` : "",
    "",
    `${window.location.origin}/homes/${listing.slug}`,
    "I have read the house rules.",
  ];
  return lines.filter((line, i) => line !== "" || (i > 0 && lines[i - 1] !== "")).join(newline);
}

export const whatsappLink = (text?: string) =>
  `https://wa.me/${business.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const emailLink = (subject: string, body: string) =>
  `mailto:${business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const mapsLink = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
