import { BedDouble, BedSingle, Building2, LayoutGrid, SquareParking, Sunset, Users, type LucideIcon } from "lucide-react";
import { areas, type AreaId, type Listing } from "@/functions/catalog";

export type CategoryId = "all" | "family" | "two" | "one" | "penthouse" | "outdoor" | "parking";
export type SortId = "recommended" | "bedrooms" | "name";

export const categories: { id: CategoryId; label: string; icon: LucideIcon; test: (l: Listing) => boolean }[] = [
  { id: "all", label: "All homes", icon: LayoutGrid, test: () => true },
  { id: "family", label: "3 bedrooms", icon: Users, test: (l) => l.bedrooms >= 3 },
  { id: "two", label: "2 bedrooms", icon: BedDouble, test: (l) => l.bedrooms === 2 },
  { id: "one", label: "1 bedroom", icon: BedSingle, test: (l) => l.bedrooms === 1 },
  { id: "penthouse", label: "Penthouses", icon: Building2, test: (l) => l.type === "Penthouse" },
  {
    id: "outdoor",
    label: "Terraces & views",
    icon: Sunset,
    test: (l) => l.amenities.some((a) => a === "terrace" || a === "balcony" || a === "view"),
  },
  { id: "parking", label: "Parking", icon: SquareParking, test: (l) => l.amenities.includes("parking") },
];

export const sorts: { id: SortId; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "bedrooms", label: "Most bedrooms" },
  { id: "name", label: "Name: A–Z" },
];

export const parseArea = (value: string | null): AreaId | null =>
  areas.some((a) => a.id === value) ? (value as AreaId) : null;

export const parseCategory = (value: string | null): CategoryId =>
  categories.some((c) => c.id === value) ? (value as CategoryId) : "all";

export const parseSort = (value: string | null): SortId =>
  sorts.some((s) => s.id === value) ? (value as SortId) : "recommended";

export function findHomes(listings: Listing[], area: AreaId | null, category: CategoryId, sort: SortId) {
  const test = categories.find((c) => c.id === category)!.test;
  const found = listings.filter((l) => (!area || l.area === area) && test(l));
  if (sort === "bedrooms") found.sort((a, b) => b.bedrooms - a.bedrooms || a.name.localeCompare(b.name));
  if (sort === "name") found.sort((a, b) => a.name.localeCompare(b.name));
  return found;
}

export function homeUrl(params: { area?: AreaId | null; type?: CategoryId; sort?: SortId }, hash = "") {
  const search = new URLSearchParams();
  if (params.area) search.set("area", params.area);
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.sort && params.sort !== "recommended") search.set("sort", params.sort);
  const query = search.toString();
  return `/${query ? `?${query}` : ""}${hash}`;
}

export const homesInArea = (listings: Listing[], area: AreaId | null) => listings.filter((l) => !area || l.area === area).length;
