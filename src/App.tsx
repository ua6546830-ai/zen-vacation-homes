import { SiteHeader, CategoryBar } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Zeno } from "@/components/zeno";
import { AdminPage } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { CatalogProvider, useCatalog } from "@/lib/catalog";
import { RouterProvider, useRouter } from "@/lib/router";
import { TripProvider } from "@/lib/trip";
import { HomePage, ListingPage, WishlistPage, NotFoundPage } from "./pages";

function Site() {
  const { path } = useRouter();
  const { listings, status, reload } = useCatalog();
  const admin = path === "/admin" || path === "/admin/";
  const match = /^\/homes\/([a-z0-9-]+)\/?$/.exec(path);
  const listing = match ? listings.find(home => home.slug === match[1]) : undefined;
  const browsing = path === "/" || path === "/wishlist" || Boolean(match);
  return (
    <>
      <a href="#main-content" className="sr-only fixed top-2 left-2 z-[100] rounded-lg bg-background px-4 py-3 focus:not-sr-only">Skip to content</a>
      <SiteHeader>{path === "/" && <CategoryBar />}</SiteHeader>
      <div id="main-content" tabIndex={-1}>
        {admin ? <AdminPage /> : browsing && status !== "ready" ? (
          <main className="shell min-h-[65vh] py-12" aria-live="polite">
            <h1 className="font-display text-3xl font-medium">{status === "loading" ? "Finding your next calm escape…" : "Our homes are temporarily unavailable"}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{status === "loading" ? "Loading the latest property details." : "Please try again, or contact your host using the details below."}</p>
            {status === "error" ? <Button className="mt-6 rounded-full" onClick={() => void reload()}>Try again</Button> : <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>{Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[20/19] animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>}
          </main>
        ) : path === "/" ? <HomePage /> : listing ? <ListingPage key={listing.slug} listing={listing} /> : path === "/wishlist" ? <WishlistPage /> : <NotFoundPage />}
      </div>
      <SiteFooter className={listing ? "pb-20 md:pb-0" : undefined} />
      {!admin && <Zeno />}
      <Toaster theme="light" position="top-center" />
    </>
  );
}

export default function App() {
  return <RouterProvider><TripProvider><CatalogProvider><Site /></CatalogProvider></TripProvider></RouterProvider>;
}
