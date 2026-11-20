import * as React from "react";
import {
  Award,
  Ban,
  Check,
  Clock,
  HeartHandshake,
  IdCard,
  Info,
  KeyRound,
  Mail,
  MessageCircle,
  Quote,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/icons";
import { business, houseRules, reviews, type Listing } from "@/functions/catalog";
import { emailLink, whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
      <h2 id={id} className="mt-1 font-display text-3xl font-medium text-balance md:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-3 text-base text-muted-foreground text-pretty">{children}</p>}
    </div>
  );
}

const initials = (name: string) =>
  name
    .replace(/^(Mr\.|Dr)\s+/i, "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function HostRating({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="font-display text-5xl leading-none">{business.host.rating.toFixed(2)}</span>
      <span className="text-sm">
        <span className="flex gap-0.5" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className="size-3.5 fill-current" />
          ))}
        </span>
        <span className="mt-1 block text-muted-foreground">
          <span className="sr-only">Rated {business.host.rating} out of 5 from </span>
          {business.host.reviewCount} reviews on Airbnb
        </span>
      </span>
    </div>
  );
}

export function ReviewsSection({ id = "reviews", title = "Guests feel right at home" }: { id?: string; title?: string }) {
  const [featured, ...rest] = reviews;
  return (
    <section aria-labelledby={`${id}-title`} id={id}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading id={`${id}-title`} eyebrow="Guest reviews" title={title}>
          Words from families and travellers who stayed with {business.host.firstName}.
        </SectionHeading>
        <HostRating />
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <figure className="flex flex-col rounded-2xl bg-secondary p-7 md:p-10">
          <Quote className="size-8 text-gold" aria-hidden />
          <p className="mt-4 text-sm font-semibold">{featured.title}</p>
          <blockquote className="mt-2 font-display text-lg leading-relaxed text-pretty md:text-xl">{featured.text}</blockquote>
          <ReviewAuthor review={featured} className="mt-auto pt-8" />
        </figure>
        <div className="grid gap-6">
          {rest.map((review) => (
            <figure key={review.name} className="flex flex-col rounded-2xl border bg-background p-6">
              <p className="text-sm font-semibold">{review.title}</p>
              <blockquote className="mt-2 text-base leading-relaxed text-pretty">{review.text}</blockquote>
              <ReviewAuthor review={review} className="mt-auto pt-5" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewAuthor({ review, className }: { review: (typeof reviews)[number]; className?: string }) {
  return (
    <figcaption className={cn("flex items-center gap-3", className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-(--site-fg) text-sm font-semibold text-(--site-bg)" aria-hidden>
        {initials(review.name)}
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-semibold">{review.name}</span>
        <span className="block text-muted-foreground">
          {review.from} · {review.source}
        </span>
      </span>
    </figcaption>
  );
}

export function HostCard({ className }: { className?: string }) {
  const { host } = business;
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr] items-center gap-6 rounded-3xl bg-background p-6 shadow-[0_6px_28px_rgba(34,34,34,.12)] sm:p-8",
        className,
      )}
    >
      <div className="text-center">
        <span className="relative mx-auto grid size-24 place-items-center rounded-full bg-(--site-fg) font-display text-4xl text-(--site-bg)" aria-hidden>
          {host.firstName[0]}
          <span className="absolute -right-1 bottom-1 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
            <Award className="size-4" />
          </span>
        </span>
        <p className="mt-3 font-display text-2xl font-medium">{host.firstName}</p>
        <p className="text-sm text-muted-foreground">{host.superhost ? "Superhost" : "Host"}</p>
      </div>
      <dl className="divide-y text-sm">
        <div className="pb-3">
          <dd className="text-xl font-semibold">{host.reviewCount}</dd>
          <dt className="text-xs text-muted-foreground">Reviews</dt>
        </div>
        <div className="py-3">
          <dd className="flex items-center gap-1 text-xl font-semibold">
            {host.rating.toFixed(2)} <Star className="size-3.5 fill-current" aria-hidden />
          </dd>
          <dt className="text-xs text-muted-foreground">Rating</dt>
        </div>
        <div className="pt-3">
          <dd className="text-xl font-semibold">{host.yearsHosting}</dd>
          <dt className="text-xs text-muted-foreground">Years hosting</dt>
        </div>
      </dl>
    </div>
  );
}

export function HostSection({ id = "host" }: { id?: string }) {
  const { host } = business;
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="grid items-center gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
      <HostCard />
      <div>
        <SectionHeading id={`${id}-title`} eyebrow="Meet your host" title={`${host.firstName} looks after every stay`}>
          {host.firstName} {host.superhost ? "is a Superhost and " : ""}hosts every Zen home with co-host {host.coHost}. Guests
          mention the warm welcome, quick help and clean, comfortable homes.
        </SectionHeading>
        <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" aria-hidden /> Response rate: {host.responseRate}
          </li>
          <li className="flex items-center gap-2">
            <Clock className="size-4 text-primary" aria-hidden /> Replies {host.responseTime}
          </li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-xl bg-whatsapp px-5 text-base text-white hover:bg-whatsapp/90">
            <a href={whatsappLink(`Hello ${host.firstName}, I have a question about Zen Vacation Homes.`)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-5" /> Message {host.firstName}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-5 text-base">
            <a href={emailLink("Stay enquiry", `Hello ${host.firstName},\n\n`)}>
              <Mail className="size-5" /> Email
            </a>
          </Button>
        </div>
        <div className="mt-8 rounded-2xl border p-5">
          <h3 className="text-sm font-semibold">Every Zen home includes</h3>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {business.includedEverywhere.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const ruleIcons: Record<(typeof houseRules.rules)[number]["id"], LucideIcon> = {
  registered: Users,
  couples: HeartHandshake,
  id: IdCard,
  substances: Ban,
};

export function HouseRulesList({ listing, className }: { listing?: Listing; className?: string }) {
  return (
    <ul className={cn("grid gap-5", className)}>
      <li className="flex gap-4">
        <KeyRound className="mt-0.5 size-6 shrink-0" strokeWidth={1.6} aria-hidden />
        <div>
          <p className="font-medium">Check-in {houseRules.checkIn.toLowerCase()}</p>
          <p className="text-sm text-muted-foreground">Checkout {houseRules.checkOut.toLowerCase()}</p>
        </div>
      </li>
      {houseRules.rules.map((rule) => {
        const Icon = ruleIcons[rule.id];
        return (
          <li key={rule.id} className="flex gap-4">
            <Icon className="mt-0.5 size-6 shrink-0" strokeWidth={1.6} aria-hidden />
            <div>
              <p className="font-medium">{rule.title}</p>
              <p className="text-sm text-muted-foreground text-pretty">{rule.text}</p>
            </div>
          </li>
        );
      })}
      {listing?.safetyNotes?.map((note) => (
        <li key={note} className="flex gap-4">
          <Info className="mt-0.5 size-6 shrink-0" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="font-medium">{note}</p>
            <p className="text-sm text-muted-foreground">Noted by the host for this home.</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RulesSection({ id = "rules" }: { id?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
      <SectionHeading id={`${id}-title`} eyebrow="House rules" title="Calm, safe and family-friendly">
        Rules are the same in every Zen home. Please read them before you send a booking request.
      </SectionHeading>
      <HouseRulesList className="sm:grid-cols-2 sm:gap-x-10 sm:gap-y-7" />
    </section>
  );
}

const steps = [
  {
    title: "Choose your home",
    text: "Browse real photos, amenities and house rules, then add your dates and guests.",
  },
  {
    title: "Send a request",
    text: "Request availability and price. We prepare a WhatsApp message or email with your dates, guests and the home.",
  },
  {
    title: "Get confirmed",
    text: `${business.host.firstName} confirms availability and the final rate, and asks for ID for each adult guest.`,
  },
];

export function HowToBookSection({ id = "how-to-book" }: { id?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id}>
      <SectionHeading id={`${id}-title`} eyebrow="Booking" title="Book directly with your host">
        No account to create. Your host confirms the rate and booking directly; you won't be charged on this website.
      </SectionHeading>
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border bg-background p-6">
            <span className="grid size-10 place-items-center rounded-full bg-secondary font-display text-lg" aria-hidden>
              {i + 1}
            </span>
            <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="relative isolate overflow-hidden rounded-3xl">
      <img
        src="/listings/demo/04.png"
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/20" aria-hidden />
      <div className="max-w-xl px-7 py-14 text-white md:px-14 md:py-20">
        <p className="text-sm font-medium text-white/85">{business.slogans[1]}</p>
        <h2 id="closing-title" className="mt-2 font-display text-4xl font-medium text-balance md:text-5xl">
          {business.slogans[2]}
        </h2>
        <p className="mt-4 text-base text-white/85">
          Tell us your dates and group size. {business.host.firstName} usually replies {business.host.responseTime}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-xl bg-whatsapp px-5 text-base text-white hover:bg-whatsapp/90">
            <a href={whatsappLink("Hello Zen Vacation Homes, I would like to plan a stay in Karachi.")} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-5" /> WhatsApp {business.phoneDisplay}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-white/40 bg-white/10 px-5 text-base text-white hover:bg-white/20 hover:text-white">
            <a href={emailLink("Stay enquiry", "Hello Zen Vacation Homes,\n\n")}>
              <Mail className="size-5" /> Email us
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
