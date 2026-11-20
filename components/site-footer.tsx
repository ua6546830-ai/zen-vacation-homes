import { Mail } from "lucide-react";
import { FacebookIcon, InstagramIcon, WhatsAppIcon, YoutubeIcon } from "@/components/icons";
import { areas, business } from "@/functions/catalog";
import { asset } from "@/lib/assets";
import { emailLink, whatsappLink } from "@/lib/format";
import { homeUrl } from "@/lib/listings";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

const social = [
  { label: "Instagram", href: business.links.instagram, icon: InstagramIcon },
  { label: "Facebook", href: business.links.facebook, icon: FacebookIcon },
  { label: "YouTube", href: business.links.youtube, icon: YoutubeIcon },
];

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-24 bg-(--site-fg) text-(--site-bg)", className)}>
      <div className="shell grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1fr]">
        <div>
          <img src={asset("/brand/zen-logo-light.png")} alt={business.name} width={277} height={249} className="h-16 w-auto" />
          <p className="mt-5 font-display text-2xl">{business.slogans[2]}</p>
          <p className="mt-2 max-w-xs text-sm text-(--site-bg)/75">
            {business.slogans[1]} Private homes for short stays across {business.city}, booked directly with your host.
          </p>
        </div>
        <nav aria-labelledby="footer-areas">
          <h2 id="footer-areas" className="text-sm font-semibold">
            Neighbourhoods
          </h2>
          <ul className="mt-4 grid gap-3 text-sm text-(--site-bg)/75">
            {areas.map((area) => (
              <li key={area.id}>
                <Link to={homeUrl({ area: area.id }, "#homes")} className="hover:text-(--site-bg) hover:underline">
                  {area.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/wishlist" className="hover:text-(--site-bg) hover:underline">
                Your wishlist
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="text-sm font-semibold">Book directly</h2>
          <ul className="mt-4 grid gap-3 text-sm text-(--site-bg)/75">
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-(--site-bg)">
                <WhatsAppIcon className="size-4" />
                {business.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={emailLink("Stay enquiry", "Hello Zen Vacation Homes,\n\n")}
                className="inline-flex items-center gap-2 break-all hover:text-(--site-bg)"
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                {business.email}
              </a>
            </li>
            <li>Also on {business.alsoListedOn.join(" and ")}</li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Follow</h2>
          <ul className="mt-4 flex gap-2">
            {social.map(({ label, href, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${business.name} on ${label}`}
                  className="grid size-10 place-items-center rounded-full border border-(--site-bg)/25 hover:bg-(--site-bg)/10"
                >
                  <Icon className="size-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <section aria-labelledby="footer-credits" className="shell grid gap-4 border-t border-(--site-bg)/15 py-6 text-sm sm:flex sm:items-start sm:justify-between">
        <div>
          <h2 id="footer-credits" className="font-medium">
            Designed &amp; built by{" "}
            <a href="https://www.linkedin.com/in/uzairahmad02/?originalSubdomain=pk" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-gold">
              Uzair Ahmad
            </a>
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-(--site-bg)/75">
            <a href="https://druzairahmadrph.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-(--site-bg) hover:underline">Portfolio</a>
            <a href="mailto:dr.uzair.m.ahmad@gmail.com" className="break-all hover:text-(--site-bg) hover:underline">dr.uzair.m.ahmad@gmail.com</a>
          </div>
        </div>
        <p className="text-xs text-(--site-bg)/70">Built with Qoder · CEGA Buildathon</p>
      </section>
      <div className="shell flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-(--site-bg)/15 py-6 text-xs text-(--site-bg)/70">
        <span>
          © {new Date().getFullYear()} {business.name} · {business.city}, {business.country}
        </span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>{business.slogans[0]}</span>
          <Link to="/admin" className="hover:text-(--site-bg) hover:underline">Property administration</Link>
        </div>
      </div>
    </footer>
  );
}
