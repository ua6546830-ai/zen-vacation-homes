import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons";
import { DesktopSearch, MobileSearch } from "@/components/search";
import { business } from "@/functions/catalog";
import { asset } from "@/lib/assets";
import { whatsappLink } from "@/lib/format";
import { categories, homeUrl, parseArea, parseCategory, parseSort } from "@/lib/listings";
import { Link, useRouter } from "@/lib/router";
import { useTrip } from "@/lib/trip";
import { cn } from "@/lib/utils";

export function BrandLink({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label={business.name} className={cn("flex shrink-0 items-center gap-3 rounded-lg", className)}>
      <img src={asset("/brand/zen-logo.png")} alt="" width={277} height={249} className="h-10 w-auto md:h-12" />
      <span className="hidden leading-tight xl:block">
        <span className="block font-display text-lg font-medium">{business.name}</span>
        <span className="block text-xs text-muted-foreground">{business.slogans[0]}</span>
      </span>
    </Link>
  );
}

function WishlistLink() {
  const { saved } = useTrip();
  return (
    <Link
      to="/wishlist"
      aria-label={saved.length ? `Wishlist, ${saved.length} saved` : "Wishlist"}
      className="relative grid size-10 place-items-center rounded-full hover:bg-muted"
    >
      <Heart className="size-5" aria-hidden />
      {saved.length > 0 && (
        <span className="absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {saved.length}
        </span>
      )}
    </Link>
  );
}

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={ref} className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="shell flex h-18 items-center gap-3 md:h-22 md:gap-4">
        <BrandLink />
        <div className="flex min-w-0 flex-1 justify-center">
          <DesktopSearch className="hidden lg:flex" />
          <MobileSearch className="lg:hidden" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" className="hidden h-10 rounded-full lg:inline-flex" title={`WhatsApp ${business.phoneDisplay}`}>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-5 text-whatsapp" />
              <span className="hidden xl:inline">WhatsApp</span>
              <span className="sr-only xl:hidden">WhatsApp {business.name}</span>
            </a>
          </Button>
          <WishlistLink />
        </div>
      </div>
      {children}
    </header>
  );
}

export function CategoryBar() {
  const { search, navigate } = useRouter();
  const area = parseArea(search.get("area"));
  const type = parseCategory(search.get("type"));
  const sort = parseSort(search.get("sort"));

  return (
    <nav aria-label="Home types" className="shell">
      <ul className="-mb-px flex gap-7 overflow-x-auto scrollbar-none md:gap-10">
        {categories.map((category) => {
          const active = category.id === type;
          const Icon = category.icon;
          return (
            <li key={category.id} className="shrink-0">
              <Link
                to={homeUrl({ area, type: category.id, sort })}
                replace
                scroll={false}
                aria-current={active ? "true" : undefined}
                onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
                  const results = document.getElementById("homes");
                  if (results && results.getBoundingClientRect().top < 0) {
                    event.preventDefault();
                    navigate(homeUrl({ area, type: category.id, sort }, "#homes"), { replace: true });
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-1.5 border-b-2 pt-2.5 pb-3 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="size-6" strokeWidth={1.6} aria-hidden />
                {category.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
