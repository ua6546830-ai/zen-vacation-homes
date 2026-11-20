import * as React from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, BedDouble, Building2, CheckCircle2, ExternalLink,
  Eye, ImagePlus, Images, KeyRound, Loader2, LockKeyhole, LogOut, MapPin, Plus,
  RefreshCw, Save, Search, ShieldCheck, Trash2, X,
} from "lucide-react";
import { areas, type AmenityId, type HighlightIcon, type Listing } from "@/functions/catalog";
import { amenityInfo, highlightIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AdminApiError, adminRequest, isAdminSlug, MAX_PHOTO_BYTES, PHOTO_MIME_TYPES,
  uploadPhoto, type AdminListing, type AdminPhoto, type AdminProperty,
} from "@/lib/admin-api";
import { Link, useDocumentTitle, useRouter } from "@/lib/router";
import { cn } from "@/lib/utils";

type Draft = {
  name: string; slug: string; type: Listing["type"]; area: Listing["area"];
  locality: string; address: string; mapQuery: string; floor: string;
  bedrooms: string; bathrooms: string; beds: string; maxGuests: string;
  summary: string; about: string; space: string; safetyNotes: string;
  amenities: AmenityId[]; highlights: Listing["highlights"];
  sleeping: NonNullable<Listing["sleeping"]>; photos: AdminPhoto[];
  hasAirbnb: boolean; airbnbUrl: string; rating: string; reviews: string; guestFavourite: boolean;
};
type TextKey = "name" | "slug" | "locality" | "address" | "mapQuery" | "floor" | "summary" | "about" | "space" | "safetyNotes" | "airbnbUrl";
type NumberKey = "bedrooms" | "bathrooms" | "beds" | "maxGuests" | "rating" | "reviews";
type Editor = { original: AdminProperty | null; form: Draft };
type Notice = { kind: "error" | "success" | "info"; text: string };
type Busy = "saving" | "uploading" | "reloading" | "deleting" | "logging-out" | null;
type Confirmation = { kind: "select"; property: AdminProperty } | { kind: "new" | "logout" | "reload" | "leave" | "delete" };
type Recovery = { slug: string; operation: "save" | "delete" };
type Session = "checking" | "login" | "locked" | "ready" | "error";

const emptyDraft = (): Draft => ({
  name: "", slug: "", type: "Apartment", area: areas[0].id,
  locality: "", address: "", mapQuery: "", floor: "", bedrooms: "2", bathrooms: "2", beds: "2", maxGuests: "",
  summary: "", about: "", space: "", safetyNotes: "", amenities: [], highlights: [], sleeping: [], photos: [],
  hasAirbnb: false, airbnbUrl: "", rating: "", reviews: "", guestFavourite: false,
});

function toDraft(listing: AdminListing): Draft {
  return {
    name: listing.name, slug: listing.slug, type: listing.type, area: listing.area,
    locality: listing.locality, address: listing.address, mapQuery: listing.mapQuery, floor: listing.floor ?? "",
    bedrooms: String(listing.bedrooms), bathrooms: String(listing.bathrooms),
    beds: listing.beds === undefined ? "" : String(listing.beds), maxGuests: listing.maxGuests === undefined ? "" : String(listing.maxGuests),
    summary: listing.summary, about: listing.about.join("\n\n"), space: listing.space.join("\n"), safetyNotes: (listing.safetyNotes ?? []).join("\n"),
    amenities: [...listing.amenities], highlights: listing.highlights.map((row) => ({ ...row })),
    sleeping: (listing.sleeping ?? []).map((row) => ({ ...row })), photos: listing.photos.map((photo) => ({ ...photo })),
    hasAirbnb: !!listing.airbnb, airbnbUrl: listing.airbnb?.url ?? "",
    rating: listing.airbnb ? String(listing.airbnb.rating) : "", reviews: listing.airbnb ? String(listing.airbnb.reviews) : "",
    guestFavourite: listing.airbnb?.guestFavourite ?? false,
  };
}

const lines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const paragraphs = (value: string) => value.split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter(Boolean);
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/, "");
const fieldId = (key: string) => `admin-${key}`;

function validate(form: Draft, published: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const text = (key: TextKey, label: string, max: number, required = false) => {
    if (required && !form[key].trim()) errors[key] = `${label} is required.`;
    else if (form[key].length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
  };
  text("name", "Property name", 120, true);
  text("slug", "Property URL slug", 100, true);
  if (form.slug && !isAdminSlug(form.slug)) errors.slug = "Use lowercase letters, numbers and single hyphens for the slug.";
  text("locality", "Locality", 200);
  text("address", "Address", 400);
  text("mapQuery", "Map search query", 400);
  text("floor", "Floor", 200);
  text("summary", "Summary", 1000);
  if (published) {
    for (const key of ["locality", "address", "mapQuery", "summary"] as const) {
      if (!form[key].trim()) errors[key] = `${({ locality: "Locality", address: "Address", mapQuery: "Map search query", summary: "Summary" })[key]} is required to publish.`;
    }
    if (!form.photos.length) errors.photos = "Add at least one photo before publishing.";
    if (!paragraphs(form.about).length) errors.about = "Add at least one About paragraph before publishing.";
  }
  const number = (key: NumberKey, label: string, min: number, max: number, step: number, required: boolean) => {
    if (!form[key].trim()) {
      if (required) errors[key] = `${label} is required.`;
      return;
    }
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value < min || value > max || Math.abs(value / step - Math.round(value / step)) > 0.000001) {
      errors[key] = `${label} must be ${step === 1 ? "a whole number" : `in steps of ${step}`} from ${min} to ${max}.`;
    }
  };
  number("bedrooms", "Bedrooms", 0, 20, 1, true);
  number("bathrooms", "Bathrooms", 1, 20, 1, true);
  number("beds", "Beds", 1, 50, 1, false);
  number("maxGuests", "Maximum guests", 1, 50, 1, false);
  const checkLines = (key: "about" | "space" | "safetyNotes", items: string[], count: number, itemMax: number) => {
    if (items.length > count || items.some((item) => item.length > itemMax)) errors[key] = `Use at most ${count} ${key === "about" ? "paragraphs" : "lines"}, each no longer than ${itemMax} characters.`;
  };
  checkLines("about", paragraphs(form.about), 12, 4000);
  checkLines("space", lines(form.space), 30, 500);
  checkLines("safetyNotes", lines(form.safetyNotes), 20, 500);
  if (form.highlights.length > 8) errors.highlights = "Use at most 8 highlights.";
  form.highlights.forEach((row, index) => {
    if (!row.title.trim() || row.title.length > 100) errors[`highlight-${index}-title`] = "A highlight title is required (up to 100 characters).";
    if (!row.text.trim() || row.text.length > 500) errors[`highlight-${index}-text`] = "Highlight text is required (up to 500 characters).";
  });
  if (form.sleeping.length > 20) errors.sleeping = "Use at most 20 sleeping spaces.";
  form.sleeping.forEach((row, index) => {
    if (!row.room.trim() || row.room.length > 100) errors[`sleeping-${index}-room`] = "Enter a room name (up to 100 characters).";
    if (!row.beds.trim() || row.beds.length > 300) errors[`sleeping-${index}-beds`] = "Enter the beds in this room (up to 300 characters).";
  });
  if (form.photos.length > 30) errors.photos = "Use at most 30 photos.";
  form.photos.forEach((photo, index) => {
    if (published && !photo.alt.trim()) errors[`photo-${index}-alt`] = "Describe this photo for accessibility before publishing.";
    else if (photo.alt.length > 300) errors[`photo-${index}-alt`] = "Photo alt text must be 300 characters or fewer.";
    if ((photo.caption?.length ?? 0) > 1000) errors[`photo-${index}-caption`] = "Photo caption must be 1,000 characters or fewer.";
  });
  if (form.hasAirbnb) {
    text("airbnbUrl", "Airbnb URL", 2048, true);
    try {
      const url = new URL(form.airbnbUrl.trim());
      if (url.protocol !== "https:" || url.username || url.password) errors.airbnbUrl = "Enter a valid HTTPS Airbnb URL.";
    } catch {
      errors.airbnbUrl = "Enter a valid HTTPS Airbnb URL.";
    }
    number("rating", "Airbnb rating", 0, 5, 0.01, true);
    number("reviews", "Airbnb reviews", 0, 100000, 1, true);
  }
  if (!errors.summary && new TextEncoder().encode(JSON.stringify(toListing(form))).byteLength > 32000) {
    errors.summary = "This property's details are too large to save together. Shorten descriptions or remove photos.";
  }
  return errors;
}

function toListing(form: Draft): AdminListing {
  return {
    name: form.name.trim(), slug: form.slug, type: form.type, area: form.area,
    locality: form.locality.trim(), address: form.address.trim(), mapQuery: form.mapQuery.trim(),
    ...(form.floor.trim() ? { floor: form.floor.trim() } : {}),
    bedrooms: Number(form.bedrooms), bathrooms: Number(form.bathrooms),
    ...(form.beds.trim() ? { beds: Number(form.beds) } : {}), ...(form.maxGuests.trim() ? { maxGuests: Number(form.maxGuests) } : {}),
    summary: form.summary.trim(), about: paragraphs(form.about), space: lines(form.space),
    amenities: [...form.amenities], highlights: form.highlights.map((row) => ({ icon: row.icon, title: row.title.trim(), text: row.text.trim() })),
    sleeping: form.sleeping.map((row) => ({ room: row.room.trim(), beds: row.beds.trim() })), safetyNotes: lines(form.safetyNotes),
    ...(form.hasAirbnb ? { airbnb: { url: form.airbnbUrl.trim(), rating: Number(form.rating), reviews: Number(form.reviews), guestFavourite: form.guestFavourite } } : {}),
    photos: form.photos.map((photo) => ({ src: photo.src, alt: photo.alt.trim(), ...(photo.caption?.trim() ? { caption: photo.caption.trim() } : {}) })),
  };
}

function Field({ id, label, hint, error, children, className }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-2 [&_[data-slot=native-select-wrapper]]:w-full", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
      <div><h3 className="font-semibold">{title}</h3>{description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>
      {children}
    </section>
  );
}

function NoticePanel({ notice, children }: { notice: Notice; children?: React.ReactNode }) {
  return (
    <div role={notice.kind === "error" ? "alert" : "status"} className={cn("rounded-xl border p-4 text-sm", notice.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-foreground")}>
      <div className="flex items-start gap-2">{notice.kind === "success" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}<p className="leading-relaxed">{notice.text}</p></div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}><span className={cn("size-1.5 rounded-full", published ? "bg-primary" : "bg-muted-foreground")} />{published ? "Published" : "Draft"}</span>;
}

export function AdminPage() {
  useDocumentTitle("Property management | Zen Vacation Homes");
  const { navigate } = useRouter();
  const [session, setSession] = React.useState<Session>("checking");
  const [password, setPassword] = React.useState("");
  const [loginBusy, setLoginBusy] = React.useState(false);
  const [authNotice, setAuthNotice] = React.useState<Notice | null>(null);
  const [properties, setProperties] = React.useState<AdminProperty[]>([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [areaFilter, setAreaFilter] = React.useState("all");
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [slugEdited, setSlugEdited] = React.useState(false);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [recovery, setRecovery] = React.useState<Recovery | null>(null);
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null);
  const [tab, setTab] = React.useState("overview");
  const [preview, setPreview] = React.useState(false);
  const alive = React.useRef(true);
  const operation = React.useRef<Busy>(null);
  const authOperation = React.useRef(false);
  const listSequence = React.useRef(0);
  const sessionSequence = React.useRef(0);
  const createAttempt = React.useRef<{ signature: string; requestId: string } | null>(null);

  const dirty = !!editor && (!editor.original || JSON.stringify(editor.form) !== JSON.stringify(toDraft(editor.original.listing)));
  const latestRecord = editor?.original ? properties.find((property) => property.listing.slug === editor.original!.listing.slug) : undefined;
  const changedElsewhere = !!editor?.original && loaded && (!latestRecord || latestRecord.version !== editor.original.version);
  const mustReload = !!recovery || changedElsewhere;

  React.useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; listSequence.current += 1; sessionSequence.current += 1; };
  }, []);

  React.useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  const checkSession = React.useCallback(async () => {
    const sequence = ++sessionSequence.current;
    setSession("checking");
    setAuthNotice(null);
    try {
      const result = await adminRequest<{ authenticated: boolean; configured: boolean }>("/session");
      if (!alive.current || sequence !== sessionSequence.current) return;
      setSession(!result.configured ? "locked" : result.authenticated ? "ready" : "login");
    } catch (error) {
      if (!alive.current || sequence !== sessionSequence.current) return;
      const safe = error instanceof AdminApiError ? error : new AdminApiError("request_failed");
      setSession(safe.code === "admin_not_configured" ? "locked" : "error");
      setAuthNotice({ kind: "error", text: safe.message });
    }
  }, []);

  React.useEffect(() => { void checkSession(); }, [checkSession]);

  const handleError = React.useCallback((error: unknown) => {
    const safe = error instanceof AdminApiError ? error : new AdminApiError("request_failed");
    if (safe.code === "login_required" || safe.code === "admin_not_configured") {
      listSequence.current += 1;
      setListLoading(false);
      setPassword("");
      setSession(safe.code === "admin_not_configured" ? "locked" : "login");
      setAuthNotice({ kind: "error", text: `${safe.message}${safe.code === "login_required" ? " Any unsaved form is kept in this tab." : ""}` });
    }
    return safe;
  }, []);

  const loadProperties = React.useCallback(async (): Promise<AdminProperty[] | null> => {
    const sequence = ++listSequence.current;
    setListLoading(true);
    setListError(null);
    try {
      const result = await adminRequest<{ properties: AdminProperty[] }>("/properties");
      if (!alive.current || sequence !== listSequence.current) return null;
      setProperties(result.properties);
      setLoaded(true);
      return result.properties;
    } catch (error) {
      if (alive.current && sequence === listSequence.current) setListError(handleError(error).message);
      return null;
    } finally {
      if (alive.current && sequence === listSequence.current) setListLoading(false);
    }
  }, [handleError]);

  React.useEffect(() => { if (session === "ready") void loadProperties(); }, [session, loadProperties]);

  function startOperation(value: Exclude<Busy, null>) {
    if (operation.current) return false;
    operation.current = value;
    setBusy(value);
    setNotice(null);
    return true;
  }
  function finishOperation() { operation.current = null; if (alive.current) setBusy(null); }
  function replaceEditor(property: AdminProperty | null) {
    setEditor(property ? { original: property, form: toDraft(property.listing) } : { original: null, form: emptyDraft() });
    setSlugEdited(!!property);
    setNotice(null); setErrors({}); setRecovery(null); setTab("overview"); setPreview(false);
    createAttempt.current = null;
  }
  function updateForm(update: (current: Draft) => Draft) {
    if (operation.current) return;
    setEditor((current) => current ? { ...current, form: update(current.form) } : current);
    setErrors({});
    setNotice((current) => current?.kind === "success" ? null : current);
  }
  function setField<K extends keyof Draft>(key: K, value: Draft[K]) { updateForm((current) => ({ ...current, [key]: value })); }
  function requestAction(action: Confirmation) {
    if (operation.current) return;
    if (recovery && (action.kind === "new" || action.kind === "select")) {
      setNotice({ kind: "error", text: "Reload the current record to reconcile the last write before switching properties." });
      return;
    }
    if (action.kind === "delete" || ((action.kind === "reload") && (dirty || mustReload)) || dirty) setConfirmation(action);
    else void performAction(action);
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (authOperation.current || !password) return;
    authOperation.current = true;
    setLoginBusy(true); setAuthNotice(null);
    const submittedPassword = password;
    setPassword("");
    try {
      await adminRequest<{ authenticated: true }>("/login", { method: "POST", body: { password: submittedPassword } });
      if (alive.current) setSession("ready");
    } catch (error) {
      if (alive.current) {
        const safe = handleError(error);
        setAuthNotice({ kind: "error", text: safe.message });
      }
    } finally { authOperation.current = false; if (alive.current) setLoginBusy(false); }
  }

  async function logout() {
    if (!startOperation("logging-out")) return;
    try {
      await adminRequest<{ authenticated: false }>("/logout", { method: "POST", body: {} });
      if (!alive.current) return;
      listSequence.current += 1;
      setSession("login"); setEditor(null); setProperties([]); setLoaded(false); setListLoading(false);
      setPassword(""); setRecovery(null); setErrors({}); setAuthNotice({ kind: "success", text: "You have signed out securely." });
    } catch (error) { if (alive.current) setNotice({ kind: "error", text: handleError(error).message }); }
    finally { finishOperation(); }
  }

  function focusError(key: string) {
    const nextTab = key.startsWith("photo-") || key === "photos" ? "photos"
      : key.startsWith("highlight-") ? "features"
      : key.startsWith("sleeping-") || ["summary", "about", "space"].includes(key) ? "details"
      : ["safetyNotes", "airbnbUrl", "rating", "reviews"].includes(key) ? "guest-info" : "overview";
    setTab(nextTab);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(fieldId(key))?.focus()));
  }

  async function save(published: boolean) {
    if (!editor || operation.current || mustReload) return;
    const snapshot = editor;
    const validation = validate(snapshot.form, published);
    setErrors(validation);
    const firstError = Object.keys(validation)[0];
    if (firstError) { setNotice({ kind: "error", text: "Check the highlighted fields. Nothing has been saved." }); focusError(firstError); return; }
    if (!startOperation("saving")) return;
    const listing = toListing(snapshot.form);
    const body = snapshot.original ? { listing, published, version: snapshot.original.version } : { listing, published: false };
    try {
      let requestId: string | undefined;
      if (!snapshot.original) {
        const signature = JSON.stringify(body);
        if (!createAttempt.current || createAttempt.current.signature !== signature) createAttempt.current = { signature, requestId: crypto.randomUUID() };
        requestId = createAttempt.current.requestId;
      }
      const result = await adminRequest<{ property: AdminProperty }>(snapshot.original ? `/properties/${snapshot.original.listing.slug}` : "/properties", {
        method: snapshot.original ? "PATCH" : "POST", body, requestId,
      });
      if (result.property.listing.slug !== listing.slug || result.property.published !== body.published) throw new AdminApiError("invalid_response", 200, true);
      if (!alive.current) return;
      // Invalidate any older GET without letting its response replace this successful write.
      listSequence.current += 1; setListLoading(false);
      setProperties((current) => [...current.filter((property) => property.listing.slug !== result.property.listing.slug), result.property]);
      setEditor({ original: result.property, form: toDraft(result.property.listing) });
      setSlugEdited(true); setRecovery(null); setErrors({}); createAttempt.current = null;
      setNotice({ kind: "success", text: !snapshot.original ? "Draft created. You can now upload photos; save your gallery before publishing." : result.property.published ? "Changes saved. This home is published." : "Changes saved. This home is a private draft." });
      window.dispatchEvent(new Event("zen:catalog-changed"));
    } catch (error) {
      if (alive.current) {
        const safe = handleError(error);
        if (safe.uncertain || safe.status === 409 || safe.code === "write_conflict" || safe.code === "idempotency_conflict") setRecovery({ slug: listing.slug, operation: "save" });
        setNotice({ kind: "error", text: safe.message });
      }
    } finally { finishOperation(); }
  }

  async function reloadCurrent() {
    if (!editor || !startOperation("reloading")) return;
    const slug = recovery?.slug ?? editor.original?.listing.slug ?? editor.form.slug;
    try {
      const records = await loadProperties();
      if (!records || !alive.current) return;
      const current = records.find((record) => record.listing.slug === slug);
      if (current) {
        replaceEditor(current);
        setNotice({ kind: "success", text: "The latest saved record has been loaded. Previous unsaved changes were discarded." });
      } else if (!editor.original && recovery?.operation === "save") {
        setRecovery(null);
        setNotice({ kind: "info", text: "No saved record was found for this slug. Your draft is still here. Review the details before explicitly saving again." });
      } else {
        setEditor(null); setRecovery(null); setErrors({});
        setNotice({ kind: "info", text: "This property is no longer on the server. The property list has been refreshed." });
      }
      window.dispatchEvent(new Event("zen:catalog-changed"));
    } finally { finishOperation(); }
  }

  async function removeProperty() {
    if (!editor?.original || mustReload || !startOperation("deleting")) return;
    const original = editor.original;
    try {
      await adminRequest<{ deleted: true }>(`/properties/${original.listing.slug}`, { method: "DELETE", body: { version: original.version } });
      if (!alive.current) return;
      listSequence.current += 1; setListLoading(false);
      setProperties((current) => current.filter((property) => property.listing.slug !== original.listing.slug));
      setEditor(null); setRecovery(null); setErrors({});
      setNotice({ kind: "success", text: "Property removed. Its photos were not automatically deleted from storage." });
      window.dispatchEvent(new Event("zen:catalog-changed"));
    } catch (error) {
      if (alive.current) {
        const safe = handleError(error);
        if (safe.uncertain || safe.status === 409 || safe.code === "write_conflict" || safe.code === "idempotency_conflict") setRecovery({ slug: original.listing.slug, operation: "delete" });
        setNotice({ kind: "error", text: safe.message });
      }
    } finally { finishOperation(); }
  }

  async function addPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !editor?.original || mustReload || operation.current) return;
    if (!PHOTO_MIME_TYPES.some((mime) => mime === file.type) || file.size < 1 || file.size > MAX_PHOTO_BYTES || file.name.length > 255) {
      setNotice({ kind: "error", text: "Choose a JPEG, PNG or WebP photo no larger than 5 MiB, with a filename no longer than 255 characters." }); return;
    }
    if (editor.form.photos.length >= 30) { setNotice({ kind: "error", text: "This gallery already has 30 photos. Remove a photo before adding another." }); return; }
    const slug = editor.original.listing.slug;
    if (!startOperation("uploading")) return;
    try {
      const photo = await uploadPhoto(slug, file);
      if (!alive.current) return;
      setEditor((current) => current?.original?.listing.slug === slug ? { ...current, form: { ...current.form, photos: [...current.form.photos, photo] } } : current);
      setErrors({});
      setNotice({ kind: "success", text: "Photo uploaded and added to your unsaved gallery. Edit its alt text and caption, then Save changes." });
    } catch (error) {
      if (alive.current) setNotice({ kind: "error", text: `${handleError(error).message} No photo was added to the form, and the upload will not be retried automatically.` });
    } finally { finishOperation(); }
  }

  async function performAction(action: Confirmation) {
    if (operation.current) return;
    switch (action.kind) {
      case "select": replaceEditor(action.property); break;
      case "new": replaceEditor(null); break;
      case "logout": await logout(); break;
      case "reload": await reloadCurrent(); break;
      case "delete": await removeProperty(); break;
      case "leave": navigate("/"); break;
    }
  }

  const filtered = properties.filter((property) => {
    const listing = property.listing;
    const searchText = `${listing.name} ${listing.slug} ${listing.locality} ${listing.address} ${listing.type}`.toLowerCase();
    return searchText.includes(query.trim().toLowerCase()) && (areaFilter === "all" || listing.area === areaFilter)
      && (statusFilter === "all" || (statusFilter === "published" ? property.published : !property.published));
  }).sort((a, b) => a.listing.name.localeCompare(b.listing.name));
  const publishedCount = properties.filter((property) => property.published).length;
  const form = editor?.form;

  function textField(key: TextKey, label: string, options: { hint?: string; multiline?: boolean; rows?: number; required?: boolean; max?: number; placeholder?: string } = {}) {
    if (!form) return null;
    const id = fieldId(key);
    const props = {
      id, name: key, value: form[key], placeholder: options.placeholder, maxLength: options.max,
      "aria-invalid": !!errors[key], "aria-required": options.required,
      "aria-describedby": [options.hint ? `${id}-hint` : "", errors[key] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        if (key === "name" && !editor?.original && !slugEdited) updateForm((current) => ({ ...current, name: value, slug: slugify(value) }));
        else { if (key === "slug") setSlugEdited(true); setField(key, value); }
      },
    };
    return <Field id={id} label={label} hint={options.hint} error={errors[key]}>{options.multiline ? <Textarea {...props} rows={options.rows ?? 4} /> : <Input {...props} type={key === "airbnbUrl" ? "url" : "text"} readOnly={key === "slug" && !!editor?.original} className={key === "slug" && editor?.original ? "bg-muted text-muted-foreground" : undefined} />}</Field>;
  }
  function numberField(key: NumberKey, label: string, min: number, max: number, step = 1, hint?: string) {
    if (!form) return null;
    const id = fieldId(key);
    return <Field id={id} label={label} hint={hint} error={errors[key]}><Input id={id} name={key} type="number" inputMode={step === 1 ? "numeric" : "decimal"} min={min} max={max} step={step} value={form[key]} onChange={(event) => setField(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={[hint ? `${id}-hint` : "", errors[key] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} /></Field>;
  }
  function movePhoto(index: number, direction: -1 | 1) {
    updateForm((current) => {
      const photos = [...current.photos];
      const target = index + direction;
      if (target < 0 || target >= photos.length) return current;
      [photos[index], photos[target]] = [photos[target], photos[index]];
      return { ...current, photos };
    });
  }

  const backLink = <Link to="/" onClick={(event) => { if (operation.current || dirty) { event.preventDefault(); if (!operation.current) requestAction({ kind: "leave" }); } }} className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Back to homes</Link>;

  if (session !== "ready") {
    return (
      <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
        <div className="mx-auto max-w-5xl">{backLink}</div>
        <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:mt-24 sm:p-9">
          <div className="mb-6 flex items-center gap-3"><img src="/brand/zen-logo.png" alt="Zen Vacation Homes" className="h-12 w-auto" /><div><p className="font-display text-xl">Zen Vacation Homes</p><p className="text-xs text-muted-foreground">Private property workspace</p></div></div>
          <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole className="size-6" aria-hidden /></div>
          <h1 className="font-display text-3xl">{session === "locked" ? "Setup required" : session === "checking" ? "Checking access" : session === "error" ? "Unable to check access" : "Welcome back"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{session === "locked" ? "Administrator access is locked. Configure the private password in Site Settings to enable this workspace. There is no default credential or public signup." : "Manage your homes with the private password configured in Site Settings. This workspace is for authorized property administrators only."}</p>
          {authNotice && <div className="mt-5"><NoticePanel notice={authNotice} /></div>}
          {session === "checking" ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Checking your private session…</p>
            : session === "login" ? <form onSubmit={login} className="mt-6 space-y-5">
              <Field id="admin-password" label="Private administrator password" hint="Your password is cleared from this form when you sign in."><Input id="admin-password" name="password" type="password" autoComplete="current-password" maxLength={1024} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={loginBusy} autoFocus /></Field>
              <Button type="submit" className="w-full" size="lg" disabled={loginBusy || !password}>{loginBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}{loginBusy ? "Signing in…" : "Sign in securely"}</Button>
            </form> : <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => void checkSession()}><RefreshCw className="size-4" aria-hidden />Check access again</Button>}
          <p className="mt-6 flex items-center gap-2 border-t pt-5 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" aria-hidden />Private access. No public registration.</p>
        </div>
        <DiscardDialog confirmation={confirmation} dirty={dirty} propertyName={editor?.original?.listing.name ?? "this property"} onClose={() => setConfirmation(null)} onConfirm={() => { const action = confirmation; setConfirmation(null); if (action) void performAction(action); }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><img src="/brand/zen-logo.png" alt="" className="h-11 w-auto" /><div><p className="font-display text-lg">Zen Vacation Homes</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3" aria-hidden />Administrator workspace</p></div></div>
          <div className="flex items-center gap-4">{backLink}<Button type="button" variant="outline" size="sm" onClick={() => requestAction({ kind: "logout" })} disabled={!!busy}><LogOut className="size-4" aria-hidden /><span>{busy === "logging-out" ? "Signing out…" : "Sign out"}</span></Button></div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Your portfolio</p><h1 className="font-display text-3xl sm:text-4xl">Property management</h1><p className="mt-2 text-sm text-muted-foreground">Thoughtful stays start with well-kept details. Manage, review and publish your homes.</p></div><Button type="button" onClick={() => requestAction({ kind: "new" })} disabled={!!busy || !!recovery || !loaded || !!listError}><Plus className="size-4" aria-hidden />New property</Button></div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[{ label: "Total homes", count: properties.length, icon: Building2 }, { label: "Published", count: publishedCount, icon: CheckCircle2 }, { label: "Private drafts", count: properties.length - publishedCount, icon: LockKeyhole }].map(({ label, count, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-5"><Icon className="hidden size-5 text-primary sm:block" aria-hidden /><div><p className="text-xs text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 text-2xl font-semibold">{loaded ? count : "—"}</p></div></div>)}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-xl border bg-card lg:sticky lg:top-6" aria-label="Property list">
            <div className="space-y-4 border-b p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Your homes</h2><Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh property list" title="Refresh property list without changing your form" disabled={listLoading || !!busy} onClick={() => void loadProperties()}><RefreshCw className={cn("size-4", listLoading && "animate-spin")} aria-hidden /></Button></div>
              <Field id="admin-search" label="Search properties"><div className="relative"><Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden /><Input id="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, locality or slug" className="pl-9" /></div></Field>
              <div className="grid grid-cols-2 gap-3"><Field id="admin-status-filter" label="Status"><NativeSelect id="admin-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><NativeSelectOption value="all">All statuses</NativeSelectOption><NativeSelectOption value="published">Published</NativeSelectOption><NativeSelectOption value="draft">Drafts</NativeSelectOption></NativeSelect></Field><Field id="admin-area-filter" label="Area"><NativeSelect id="admin-area-filter" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><NativeSelectOption value="all">All areas</NativeSelectOption>{areas.map((area) => <NativeSelectOption key={area.id} value={area.id}>{area.short}</NativeSelectOption>)}</NativeSelect></Field></div>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2 lg:max-h-[calc(100vh-300px)]">
              {listError && <div className="p-2"><NoticePanel notice={{ kind: "error", text: listError }}><Button type="button" variant="outline" size="sm" disabled={listLoading || !!busy} onClick={() => void loadProperties()}>Refresh properties</Button></NoticePanel></div>}
              {listLoading && !loaded ? <div role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading properties…</div> : filtered.map((property) => {
                const selected = editor?.original?.listing.slug === property.listing.slug;
                return <button key={property.listing.slug} type="button" disabled={!!busy} aria-pressed={selected} onClick={() => { if (!selected) requestAction({ kind: "select", property }); }} className={cn("mb-1 flex w-full gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60", selected ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-muted")}>
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">{property.listing.photos[0] ? <img src={property.listing.photos[0].src} alt="" className="size-full object-cover" loading="lazy" /> : <Images className="size-6 text-muted-foreground" aria-hidden />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{property.listing.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{property.listing.locality || areas.find((area) => area.id === property.listing.area)?.name}</p><div className="mt-2 flex items-center justify-between gap-2"><StatusBadge published={property.published} /><span className="text-xs text-muted-foreground">{property.listing.photos.length} photos</span></div></div>
                </button>;
              })}
              {loaded && !filtered.length && !listError && <div className="p-6 text-center"><Building2 className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden /><p className="text-sm font-medium">{properties.length ? "No matching properties" : "Your next home starts here"}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{properties.length ? "Try a different search or clear your filters." : "Create a private draft, add its details and photos, then publish when ready."}</p>{properties.length > 0 && <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => { setQuery(""); setStatusFilter("all"); setAreaFilter("all"); }}>Clear filters</Button>}</div>}
            </div>
            {loaded && <p className="border-t px-4 py-3 text-xs text-muted-foreground">{filtered.length} of {properties.length} homes · Refresh never overwrites your form</p>}
          </aside>
          <div className="min-w-0 space-y-4">
            {notice && <NoticePanel notice={notice} />}
            {mustReload && <NoticePanel notice={{ kind: "error", text: recovery ? "The last write needs to be reconciled. Your typed form is preserved. Do not repeat the write until you reload the current record." : "The server record changed or was removed. Your form has not been overwritten. Reload the current record before continuing." }}><Button type="button" variant="outline" size="sm" disabled={!!busy || listLoading} onClick={() => requestAction({ kind: "reload" })}><RefreshCw className="size-4" aria-hidden />Reload current record</Button></NoticePanel>}
            {editor && form ? <>
              <div className="rounded-xl border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge published={editor.original?.published ?? false} /><span className={cn("text-xs", dirty ? "text-primary" : "text-muted-foreground")}>{dirty ? "Unsaved changes" : "All changes saved"}</span>{editor.original && <span className="text-xs text-muted-foreground">Version {editor.original.version}</span>}</div><h2 className="break-words font-display text-2xl">{form.name || "New property"}</h2><p className="mt-1 text-xs text-muted-foreground">{editor.original ? `/homes/${editor.original.listing.slug}` : "Create a draft first. Uploads become available after its first save."}</p></div>
                  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPreview(true)} disabled={!!busy}><Eye className="size-4" aria-hidden />Preview form</Button>{editor.original?.published && <Button asChild variant="outline" size="sm"><Link to={`/homes/${editor.original.listing.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" aria-hidden />View live</Link></Button>}{editor.original && <Button type="button" variant="ghost" size="icon-sm" aria-label="Reload current record" title="Reload current record" disabled={!!busy || listLoading} onClick={() => requestAction({ kind: "reload" })}><RefreshCw className="size-4" aria-hidden /></Button>}</div>
                </div>
                <p className="mt-4 border-t pt-4 text-xs leading-relaxed text-muted-foreground">{editor.original?.published ? "Live preview shows the last saved, published version. Form edits are private until you save." : "Drafts are private and do not have a public preview link. Review your current form and gallery before publishing."} Changes are never saved automatically.</p>
              </div>
              {Object.keys(errors).length > 0 && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert"><p className="text-sm font-medium text-destructive">Please review these fields</p><ul className="mt-2 space-y-1">{Object.entries(errors).map(([key, message]) => <li key={key}><button type="button" className="text-left text-xs text-destructive underline underline-offset-2" onClick={() => focusError(key)}>{message}</button></li>)}</ul></div>}
              <form onSubmit={(event) => { event.preventDefault(); void save(editor.original?.published ?? false); }} noValidate>
                <fieldset disabled={!!busy} className="min-w-0 space-y-5">
                  <legend className="sr-only">Property details</legend>
                  <Tabs value={tab} onValueChange={setTab} className="gap-5">
                    <div className="overflow-x-auto pb-1"><TabsList className="h-10 min-w-full justify-start sm:min-w-0" aria-label="Property editing sections"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="features">Features</TabsTrigger><TabsTrigger value="photos">Photos ({form.photos.length})</TabsTrigger><TabsTrigger value="guest-info">Guest info</TabsTrigger></TabsList></div>
                    <TabsContent value="overview" className="space-y-5">
                      <Section title="Property identity" description="Name your home and choose its permanent public URL. Only name and slug are required for a new draft.">
                        {textField("name", "Property name", { required: true, max: 200, placeholder: "e.g. A calm retreat in DHA" })}
                        {textField("slug", "Property URL slug", { required: true, max: 100, hint: editor.original ? "The slug is permanent and cannot be changed for an existing property." : "Lowercase letters, numbers and hyphens. Generated from the name until you edit it." })}
                        <div className="grid gap-4 sm:grid-cols-2"><Field id="admin-property-type" label="Property type"><NativeSelect id="admin-property-type" value={form.type} onChange={(event) => setField("type", event.target.value as Listing["type"])}>{["Apartment", "Penthouse", "Portion"].map((type) => <NativeSelectOption key={type} value={type}>{type}</NativeSelectOption>)}</NativeSelect></Field><Field id="admin-property-area" label="Area"><NativeSelect id="admin-property-area" value={form.area} onChange={(event) => setField("area", event.target.value as Listing["area"])}>{areas.map((area) => <NativeSelectOption key={area.id} value={area.id}>{area.name}</NativeSelectOption>)}</NativeSelect></Field></div>
                      </Section>
                      <Section title="Location" description="Keep directions precise. Complete locality, address and map query before publishing.">
                        <div className="grid gap-4 sm:grid-cols-2">{textField("locality", "Locality", { max: 300, placeholder: "Neighbourhood or commercial area" })}{textField("floor", "Floor (optional)", { max: 200, placeholder: "e.g. 4th floor, with lift" })}</div>
                        {textField("address", "Full address", { max: 1000 })}{textField("mapQuery", "Map search query", { max: 1000, hint: "A place or address to search on the map, not an embed code." })}
                      </Section>
                      <Section title="Capacity" description="Use 0 bedrooms for a studio. Optional values can be left blank."><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{numberField("bedrooms", "Bedrooms", 0, 20)}{numberField("bathrooms", "Bathrooms", 1, 20)}{numberField("beds", "Beds (optional)", 1, 50)}{numberField("maxGuests", "Max guests (optional)", 1, 50)}</div></Section>
                    </TabsContent>
                    <TabsContent value="details" className="space-y-5">
                      <Section title="Tell the home's story" description="Clear, welcoming descriptions help guests choose the right stay.">
                        {textField("summary", "Short summary", { multiline: true, rows: 3, max: 2000, hint: "A concise introduction. Required before publishing." })}
                        {textField("about", "About this home", { multiline: true, rows: 8, hint: "Separate paragraphs with a blank line. Plain text only." })}
                        {textField("space", "The space — line items", { multiline: true, rows: 6, hint: "One feature or space description per line. Empty lines are ignored." })}
                      </Section>
                      <Section title="Sleeping arrangements" description="Add one row for each bedroom or sleeping space.">
                        {form.sleeping.length === 0 && <p className="text-sm text-muted-foreground">No sleeping arrangements added yet.</p>}
                        {form.sleeping.map((row, index) => <div key={index} className="space-y-3 rounded-lg border bg-background p-4"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-medium"><BedDouble className="size-4 text-primary" aria-hidden />Sleeping space {index + 1}</p><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove sleeping space ${index + 1}`} onClick={() => setField("sleeping", form.sleeping.filter((_, i) => i !== index))}><X className="size-4" aria-hidden /></Button></div><div className="grid gap-4 sm:grid-cols-2">{(["room", "beds"] as const).map((key) => { const id = fieldId(`sleeping-${index}-${key}`); const error = errors[`sleeping-${index}-${key}`]; return <Field key={key} id={id} label={key === "room" ? `Room name ${index + 1}` : `Beds in room ${index + 1}`} error={error}><Input id={id} value={row[key]} maxLength={key === "room" ? 200 : 1000} placeholder={key === "room" ? "Bedroom 1" : "1 king bed"} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setField("sleeping", form.sleeping.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} /></Field>; })}</div></div>)}
                        <Button type="button" variant="outline" onClick={() => setField("sleeping", [...form.sleeping, { room: "", beds: "" }])} disabled={form.sleeping.length >= 20}><Plus className="size-4" aria-hidden />Add sleeping space</Button>
                      </Section>
                    </TabsContent>
                    <TabsContent value="features" className="space-y-5">
                      <Section title="Amenities" description="Select only the amenities available in this property."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(Object.keys(amenityInfo) as AmenityId[]).map((amenity) => { const { label, icon: Icon } = amenityInfo[amenity]; const checked = form.amenities.includes(amenity); return <label key={amenity} htmlFor={`admin-amenity-${amenity}`} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors", checked ? "border-primary/30 bg-primary/5" : "hover:bg-muted")}><Checkbox id={`admin-amenity-${amenity}`} checked={checked} onCheckedChange={(value) => setField("amenities", value === true ? [...new Set([...form.amenities, amenity])] : form.amenities.filter((item) => item !== amenity))} /><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /><span>{label}</span></label>; })}</div></Section>
                      <Section title="Property highlights" description="Small details worth calling out. Choose an icon, a title and a short explanation.">
                        {!form.highlights.length && <p className="text-sm text-muted-foreground">No highlights added yet.</p>}
                        {form.highlights.map((row, index) => { const Icon = highlightIcons[row.icon]; return <div key={index} className="space-y-4 rounded-lg border bg-background p-4"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-primary" aria-hidden />Highlight {index + 1}</p><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove highlight ${index + 1}`} onClick={() => setField("highlights", form.highlights.filter((_, i) => i !== index))}><X className="size-4" aria-hidden /></Button></div><div className="grid gap-4 sm:grid-cols-[140px_1fr]"><Field id={`admin-highlight-${index}-icon`} label={`Icon for highlight ${index + 1}`}><NativeSelect id={`admin-highlight-${index}-icon`} value={row.icon} onChange={(event) => setField("highlights", form.highlights.map((item, i) => i === index ? { ...item, icon: event.target.value as HighlightIcon } : item))}>{(Object.keys(highlightIcons) as HighlightIcon[]).map((icon) => <NativeSelectOption key={icon} value={icon}>{icon.charAt(0).toUpperCase() + icon.slice(1)}</NativeSelectOption>)}</NativeSelect></Field><Field id={fieldId(`highlight-${index}-title`)} label={`Title for highlight ${index + 1}`} error={errors[`highlight-${index}-title`]}><Input id={fieldId(`highlight-${index}-title`)} value={row.title} maxLength={200} aria-invalid={!!errors[`highlight-${index}-title`]} aria-describedby={errors[`highlight-${index}-title`] ? `${fieldId(`highlight-${index}-title`)}-error` : undefined} onChange={(event) => setField("highlights", form.highlights.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} /></Field></div><Field id={fieldId(`highlight-${index}-text`)} label={`Text for highlight ${index + 1}`} error={errors[`highlight-${index}-text`]}><Textarea id={fieldId(`highlight-${index}-text`)} rows={2} value={row.text} maxLength={2000} aria-invalid={!!errors[`highlight-${index}-text`]} aria-describedby={errors[`highlight-${index}-text`] ? `${fieldId(`highlight-${index}-text`)}-error` : undefined} onChange={(event) => setField("highlights", form.highlights.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} /></Field></div>; })}
                        <Button type="button" variant="outline" disabled={form.highlights.length >= 8} onClick={() => setField("highlights", [...form.highlights, { icon: "sparkles", title: "", text: "" }])}><Plus className="size-4" aria-hidden />Add highlight</Button>
                      </Section>
                    </TabsContent>
                    <TabsContent value="photos" className="space-y-5">
                      <Section title="Photo gallery" description="The first photo is the cover. Reorder with the arrows, then save to update your listing.">
                        {!editor.original && <NoticePanel notice={{ kind: "info", text: "Save this new property as a draft first. Photo uploads are enabled once the draft exists. Drafts can have zero photos; published homes need at least one." }} />}
                        <Field id="admin-photos" label="Upload a property photo" hint="JPEG, PNG or WebP · maximum 5 MiB each. Local file uploads only; remote image URLs cannot be added." error={errors.photos}><Input id="admin-photos" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void addPhoto(event)} disabled={!editor.original || !!busy || mustReload || form.photos.length >= 30} aria-invalid={!!errors.photos} aria-describedby={`admin-photos-hint${errors.photos ? " admin-photos-error" : ""}`} className="h-auto min-h-10 py-2" /></Field>
                        {busy === "uploading" && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Uploading and checking your photo…</p>}
                        <p className="text-xs leading-relaxed text-muted-foreground">An uploaded photo is added to this unsaved gallery only. Removing a photo here removes it from the gallery on Save; it does not delete a storage object. Existing image paths are kept unchanged.</p>
                        {!form.photos.length ? <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center"><ImagePlus className="mx-auto mb-3 size-9 text-muted-foreground" aria-hidden /><p className="text-sm font-medium">Make a good first impression</p><p className="mt-2 text-xs text-muted-foreground">Add a bright, welcoming photo to use as the cover.</p></div> : <div className="grid gap-4 sm:grid-cols-2">{form.photos.map((photo, index) => <div key={`${photo.src}-${index}`} className="overflow-hidden rounded-xl border bg-background"><div className="relative aspect-[4/3] bg-muted"><img src={photo.src} alt={photo.alt || `Property photo ${index + 1}`} className="size-full object-cover" loading="lazy" /><span className="absolute top-3 left-3 rounded-full border bg-background/95 px-2.5 py-1 text-xs font-medium">{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</span></div><div className="space-y-4 p-4"><div className="flex items-center justify-between gap-2"><div className="flex gap-1"><Button type="button" variant="outline" size="icon-sm" disabled={index === 0} aria-label={`Move photo ${index + 1} up`} title="Move up · closer to cover" onClick={() => movePhoto(index, -1)}><ArrowUp className="size-4" aria-hidden /></Button><Button type="button" variant="outline" size="icon-sm" disabled={index === form.photos.length - 1} aria-label={`Move photo ${index + 1} down`} title="Move down" onClick={() => movePhoto(index, 1)}><ArrowDown className="size-4" aria-hidden /></Button></div><Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label={`Remove photo ${index + 1} from gallery`} onClick={() => setField("photos", form.photos.filter((_, i) => i !== index))}><Trash2 className="size-4" aria-hidden />Remove</Button></div>{(["alt", "caption"] as const).map((key) => { const id = fieldId(`photo-${index}-${key}`); const error = errors[`photo-${index}-${key}`]; return <Field key={key} id={id} label={key === "alt" ? `Alt text for photo ${index + 1}` : `Caption for photo ${index + 1} (optional)`} error={error} hint={key === "alt" ? "Describe what is visible for guests using screen readers." : undefined}><Input id={id} value={photo[key] ?? ""} maxLength={1000} aria-invalid={!!error} aria-describedby={[key === "alt" ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} onChange={(event) => setField("photos", form.photos.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} /></Field>; })}</div></div>)}</div>}
                      </Section>
                    </TabsContent>
                    <TabsContent value="guest-info" className="space-y-5">
                      <Section title="Safety and guest notes" description="Share practical information guests should know before their stay.">{textField("safetyNotes", "Safety notes — one per line (optional)", { multiline: true, rows: 6, hint: "One note per line. Plain text only; empty lines are ignored." })}</Section>
                      <Section title="Airbnb details" description="Optional reference information. Keep ratings and review counts accurate.">
                        <label htmlFor="admin-has-airbnb" className="flex cursor-pointer items-center gap-3 text-sm font-medium"><Checkbox id="admin-has-airbnb" checked={form.hasAirbnb} onCheckedChange={(checked) => setField("hasAirbnb", checked === true)} />Include Airbnb details</label>
                        {form.hasAirbnb && <div className="space-y-5">{textField("airbnbUrl", "Airbnb listing URL", { required: true, max: 2048, placeholder: "https://www.airbnb.com/rooms/…" })}<div className="grid gap-4 sm:grid-cols-2">{numberField("rating", "Airbnb rating", 0, 5, 0.01, "A rating from 0 to 5.")}{numberField("reviews", "Airbnb review count", 0, 10000000)}</div><label htmlFor="admin-guest-favourite" className="flex cursor-pointer items-center gap-3 text-sm"><Checkbox id="admin-guest-favourite" checked={form.guestFavourite} onCheckedChange={(checked) => setField("guestFavourite", checked === true)} />Guest favourite on Airbnb</label></div>}
                      </Section>
                    </TabsContent>
                  </Tabs>
                </fieldset>
                <div className="sticky bottom-3 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur">
                  <div><p className="text-sm font-medium">{busy ? ({ saving: "Saving changes…", uploading: "Uploading photo…", reloading: "Reloading record…", deleting: "Removing property…", "logging-out": "Signing out…" })[busy] : dirty ? "You have unsaved changes" : "Your property is up to date"}</p><p className="mt-1 text-xs text-muted-foreground">{mustReload ? "Reload the current record to continue." : "Only saved changes reach the public catalog."}</p></div>
                  <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!!busy || mustReload || !dirty}>{busy === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}{editor.original ? "Save changes" : "Create draft"}</Button>{editor.original && <Button type="button" variant="outline" disabled={!!busy || mustReload} onClick={() => void save(!editor.original!.published)}>{editor.original.published ? (dirty ? "Save & unpublish" : "Unpublish") : (dirty ? "Save & publish" : "Publish")}</Button>}</div>
                </div>
              </form>
              {editor.original && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-card p-4"><div><p className="text-sm font-medium">Remove this property</p><p className="mt-1 text-xs text-muted-foreground">Removes the record and its public listing. This cannot be undone.</p></div><Button type="button" variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive" disabled={!!busy || mustReload} onClick={() => requestAction({ kind: "delete" })}><Trash2 className="size-4" aria-hidden />Remove property</Button></div>}
            </> : <div className="rounded-xl border bg-card px-6 py-16 text-center sm:py-24"><div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="size-8" aria-hidden /></div><h2 className="font-display text-2xl">A workspace for every home</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Choose a property to edit its details and gallery, or create a new private draft. Your changes stay private until you save.</p><Button type="button" className="mt-6" disabled={!loaded || !!listError || !!busy} onClick={() => requestAction({ kind: "new" })}><Plus className="size-4" aria-hidden />Create a new draft</Button></div>}
          </div>
        </div>
      </div>
      <DiscardDialog confirmation={confirmation} dirty={dirty} propertyName={editor?.original?.listing.name ?? "this property"} onClose={() => setConfirmation(null)} onConfirm={() => { const action = confirmation; setConfirmation(null); if (action) void performAction(action); }} />
      <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Form preview</DialogTitle><DialogDescription>This is your current, unsaved form — not a public draft link.</DialogDescription></DialogHeader>{form && <div className="space-y-5"><div><h3 className="font-display text-2xl">{form.name || "Untitled property"}</h3><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden />{form.locality || areas.find((area) => area.id === form.area)?.name} · {form.type}</p><p className="mt-2 text-xs text-muted-foreground">{form.bedrooms || "0"} bedrooms · {form.bathrooms || "0"} bathrooms{form.maxGuests ? ` · up to ${form.maxGuests} guests` : ""}</p></div>{form.summary && <p className="whitespace-pre-wrap text-sm leading-relaxed">{form.summary}</p>}{form.photos.length ? <div className="grid gap-4 sm:grid-cols-2">{form.photos.map((photo, index) => <figure key={`${photo.src}-${index}`} className={cn("overflow-hidden rounded-xl border", index === 0 && "sm:col-span-2")}><img src={photo.src} alt={photo.alt || `Property photo ${index + 1}`} className={cn("w-full object-cover", index === 0 ? "aspect-video" : "aspect-[4/3]")} loading="lazy" /><figcaption className="bg-muted/30 p-3 text-xs text-muted-foreground">{index === 0 && <span className="mr-2 font-medium text-primary">Cover</span>}{photo.caption || photo.alt || `Photo ${index + 1}`}</figcaption></figure>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No photos yet. Save a draft first, then add your gallery.</p>}</div>}</DialogContent></Dialog>
    </main>
  );
}

function DiscardDialog({ confirmation, dirty, propertyName, onClose, onConfirm }: { confirmation: Confirmation | null; dirty: boolean; propertyName: string; onClose: () => void; onConfirm: () => void }) {
  const deleting = confirmation?.kind === "delete";
  const reloading = confirmation?.kind === "reload";
  return <AlertDialog open={!!confirmation} onOpenChange={(open) => { if (!open) onClose(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{deleting ? "Remove this property?" : reloading ? "Reload the current record?" : "Discard unsaved changes?"}</AlertDialogTitle><AlertDialogDescription>{deleting ? `“${propertyName}” will be removed from the property catalog and any public listing. This cannot be undone. Stored photos are not automatically deleted.${dirty ? " Your unsaved changes will also be discarded." : ""}` : reloading ? "This reads the current server record and replaces your form. Any typed changes will be discarded. No write or upload is retried. If the record was removed, the editor will close." : "Your changes have not been saved. Continuing will discard them. Choose Keep editing to return to your form."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={onClose}>Keep editing</AlertDialogCancel><AlertDialogAction variant={deleting ? "destructive" : "default"} onClick={onConfirm}>{deleting ? "Remove property" : reloading ? "Reload current record" : "Discard & continue"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
