import * as React from "react";
import type { Listing } from "@/functions/catalog";

interface CatalogState {
  listings: Listing[];
  status: "loading" | "ready" | "error";
  reload: () => Promise<void>;
}
const CatalogContext = React.createContext<CatalogState | null>(null);

function validListing(value: unknown): value is Listing {
  if (!value || typeof value !== "object") return false;
  const item = value as Listing;
  return typeof item.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
    && typeof item.name === "string" && typeof item.summary === "string"
    && ["dha", "gulshan", "johar"].includes(item.area)
    && ["Apartment", "Penthouse", "Portion"].includes(item.type)
    && Number.isSafeInteger(item.bedrooms) && Number.isSafeInteger(item.bathrooms)
    && Array.isArray(item.photos) && Array.isArray(item.about) && Array.isArray(item.space)
    && Array.isArray(item.amenities) && Array.isArray(item.highlights);
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [status, setStatus] = React.useState<CatalogState["status"]>("loading");
  const active = React.useRef<AbortController | null>(null);
  const reload = React.useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch("/functions/v1/app/api/properties", {
        credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("catalog_unavailable");
      const value = await response.json();
      if (!Array.isArray(value?.properties) || value.properties.length > 50 || !value.properties.every(validListing)) throw new Error("catalog_invalid");
      if (active.current !== controller) return;
      setListings(value.properties);
      setStatus("ready");
    } catch {
      if (active.current !== controller || controller.signal.aborted) return;
      setListings([]);
      setStatus("error");
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);
  React.useEffect(() => {
    void reload();
    const refresh = () => { void reload(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("zen:catalog-changed", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active.current?.abort();
      active.current = null;
      window.removeEventListener("zen:catalog-changed", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [reload]);
  return <CatalogContext.Provider value={{ listings, status, reload }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = React.useContext(CatalogContext);
  if (!value) throw new Error("catalog_provider_missing");
  return value;
}
