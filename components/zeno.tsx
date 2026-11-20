import * as React from "react";
import { ArrowUp, Bot, ChevronRight, LoaderCircle, Pause, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppIcon } from "@/components/icons";
import { business } from "@/functions/catalog";
import { asset } from "@/lib/assets";
import { whatsappLink } from "@/lib/format";
import { Link, useRouter } from "@/lib/router";
import { useCatalog } from "@/lib/catalog";
import { createConversationStream } from "@/lib/conversation-stream.mjs";
import { cn } from "@/lib/utils";

type State = "idle" | "running" | "pending" | "completed" | "failed" | "interrupted";
type Message = { id: string; role: "user" | "assistant"; text: string; state: State };
type Conversation = { id: string; title: string; revision: number; state: State; messages: Message[]; runId?: string; requestId?: string };
const states: State[] = ["idle", "running", "pending", "completed", "failed", "interrupted"];
const terminal = (state: State) => ["completed", "failed", "interrupted"].includes(state);
const BASE = "/functions/v1/app/api/chat/conversations";
const storage = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} },
  remove(key: string) { try { localStorage.removeItem(key); } catch {} },
};
function visitorKey() {
  const stored = storage.get("zen:visitor");
  if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
  const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  storage.set("zen:visitor", value);
  return value;
}
function validConversation(value: unknown): value is Conversation {
  const c = value as Conversation;
  return !!c && typeof c.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(c.id) && Number.isSafeInteger(c.revision)
    && states.includes(c.state) && Array.isArray(c.messages) && c.messages.length <= 100
    && c.messages.every(m => typeof m.id === "string" && ["user", "assistant"].includes(m.role) && typeof m.text === "string" && m.text.length <= 32000 && states.includes(m.state));
}

export function Zeno() {
  const { path, search } = useRouter();
  const { listings } = useCatalog();
  const [open, setOpen] = React.useState(search.get("chat") === "open");
  const [conversation, setConversation] = React.useState<Conversation>();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const visitor = React.useRef<string>("");
  const generation = React.useRef(0);
  const inFlight = React.useRef(false);
  const current = React.useRef<Conversation | undefined>(undefined);
  const bottom = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLTextAreaElement>(null);
  const reader = React.useRef<ReturnType<typeof createConversationStream> | null>(null);
  const ready = React.useRef<(() => void) | undefined>(undefined);
  if (!visitor.current) visitor.current = visitorKey();

  const apply = React.useCallback((c: Conversation) => {
    if (current.current && (current.current.id !== c.id || current.current.revision > c.revision)) return;
    current.current = c;
    setConversation(c);
    if (terminal(c.state)) setBusy(false);
  }, []);

  const api = React.useCallback(async (url: string, method = "GET", body?: object, requestId?: string) => {
    const response = await fetch(url, {
      method, credentials: "same-origin", signal: AbortSignal.timeout(25000),
      headers: { "x-zen-visitor": visitor.current, ...(body ? { "content-type": "application/json" } : {}), ...(requestId ? { "idempotency-key": requestId } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.code ?? "service_unavailable");
    if (!validConversation(result.conversation)) throw new Error("service_unavailable");
    return result.conversation as Conversation;
  }, []);

  const connect = React.useCallback((id: string, version: number) => {
    reader.current?.cancel();
    let resolveReady!: () => void;
    const handshake = new Promise<void>(resolve => { resolveReady = resolve; });
    ready.current = resolveReady;
    const stream = createConversationStream(frame => {
      if (generation.current !== version) return true;
      if (frame.event === "stream-error") throw new Error("service_unavailable");
      const data = JSON.parse(frame.data);
      if (!validConversation(data.conversation) || data.conversation.id !== id) throw new Error("service_unavailable");
      apply(data.conversation);
      if (frame.event === "ready") { resolveReady(); return false; }
      return terminal(data.conversation.state);
    });
    reader.current = stream;
    void stream.read(signal => fetch(`${BASE}/${id}/events`, { credentials: "same-origin", signal, headers: { "x-zen-visitor": visitor.current } }))
      .catch(() => { if (generation.current === version) { setError("Connection paused. Recover the reply without sending your message again."); setBusy(false); } });
    return handshake;
  }, [apply]);

  const recover = React.useCallback(async () => {
    const id = current.current?.id ?? storage.get("zen:conversation");
    if (!id) return;
    const version = ++generation.current;
    reader.current?.cancel();
    setBusy(true); setError("");
    try {
      const c = await api(`${BASE}/${id}`);
      if (generation.current !== version) return;
      current.current = c; apply(c);
      if (c.state === "running" || c.state === "pending") { connect(id, version); }
      else setBusy(false);
    } catch {
      if (generation.current === version) { setBusy(false); setError("Zeno is temporarily unavailable. Your host can help on WhatsApp."); }
    }
  }, [api, apply, connect]);

  React.useEffect(() => {
    if (open && (current.current || storage.get("zen:conversation"))) void recover();
    return () => { reader.current?.cancel(); generation.current++; };
  }, [open, recover]);
  React.useEffect(() => { bottom.current?.scrollIntoView({ block: "end", behavior: "instant" }); }, [conversation?.revision, error, open]);

  async function send(value: string) {
    const prompt = value.trim();
    if (!prompt || prompt.length > 1000 || inFlight.current || busy || ["running", "pending"].includes(current.current?.state ?? "")) return;
    inFlight.current = true;
    const version = ++generation.current;
    setBusy(true); setError("");
    let attemptedSend = false;
    try {
      let c = current.current;
      if (!c) {
        const createId = storage.get("zen:create-pending") ?? crypto.randomUUID();
        storage.set("zen:create-pending", createId);
        c = await api(BASE, "POST", {}, createId);
        storage.remove("zen:create-pending");
        if (generation.current !== version) return;
        storage.set("zen:conversation", c.id); current.current = c; apply(c);
      }
      await Promise.race([connect(c.id, version), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("stream_not_ready")), 20000))]);
      if (generation.current !== version) return;
      const requestId = crypto.randomUUID();
      attemptedSend = true;
      const optimistic: Conversation = { ...current.current!, state: "pending", requestId, messages: [...current.current!.messages, { id: requestId, role: "user", text: prompt, state: "pending" }] };
      current.current = optimistic; setConversation(optimistic);
      const accepted = await api(`${BASE}/${c.id}/messages`, "POST", { text: prompt }, requestId);
      if (generation.current !== version) return;
      apply(accepted); setText("");
      if (terminal(accepted.state)) { reader.current?.cancel(); setBusy(false); }
    } catch (failure) {
      if (generation.current !== version) return;
      setBusy(false);
      const code = failure instanceof Error ? failure.message : "service_unavailable";
      setError(attemptedSend ? "The reply is pending or unavailable. Recover its status; your message will not be resent." : code === "conversation_busy" ? "Please wait for your current reply." : "Zeno is temporarily unavailable. Keep your question here or contact your host on WhatsApp.");
    } finally { inFlight.current = false; }
  }

  function newConversation() {
    ++generation.current; reader.current?.cancel(); current.current = undefined;
    storage.remove("zen:conversation"); setConversation(undefined); setText(""); setError(""); setBusy(false);
  }
  const awaiting = busy || ["running", "pending"].includes(conversation?.state ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={cn("fixed right-5 z-40 flex items-center gap-2 rounded-full border border-white/15 bg-(--site-fg) py-3 pr-5 pl-3 text-sm font-semibold text-(--site-bg) shadow-xl transition hover:-translate-y-0.5", path.startsWith("/homes/") ? "bottom-24 md:bottom-6" : "bottom-6")}>
          <span className="grid size-8 place-items-center rounded-full bg-background"><img src={asset("/brand/zen-logo.png")} alt="" className="h-6 w-auto" /></span> Ask Zeno
        </button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="inset-0 top-0 left-0 flex h-dvh max-h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:inset-auto sm:right-6 sm:bottom-6 sm:top-auto sm:left-auto sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[400px] sm:max-w-[400px] sm:rounded-2xl sm:border">
        <header className="flex shrink-0 items-center gap-3 border-b px-5 py-4">
          <span className="grid size-11 place-items-center rounded-full bg-secondary"><Bot className="size-6 text-primary" /></span>
          <div className="flex-1"><DialogTitle className="font-display text-xl font-medium">Zeno</DialogTitle><DialogDescription className="text-xs">Your Zen homes guide · AI assistant</DialogDescription></div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={newConversation} aria-label="New conversation"><Plus /></Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close Zeno"><X /></Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" role="log" aria-label="Conversation with Zeno" aria-live="polite" aria-relevant="additions text">
          <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-secondary p-4 text-sm leading-relaxed">Hello, I’m Zeno. Looking for a calm stay in Karachi? Tell me your neighbourhood, group size or preferred amenities and I’ll help you find a home. Your host will quote the price for your dates.</div>
          {!conversation?.messages.length && <div className="mt-4 grid gap-2">{["A family home in DHA", "Compare penthouses with terraces", "What are the house rules?"].map(chip => <button key={chip} type="button" disabled={busy} onClick={() => { setText(chip); void send(chip); }} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs hover:bg-muted disabled:opacity-50">{chip}<ChevronRight className="size-3.5 shrink-0" /></button>)}</div>}
          {conversation?.messages.map(m => {
            const paths = new Set(m.role === "assistant" ? m.text.match(/\/homes\/[a-z0-9]+(?:-[a-z0-9]+)*/g) : []);
            const recommendations = listings.filter(home => paths.has(`/homes/${home.slug}`)).slice(0, 3);
            return <div key={m.id} className="mt-4">
              <div className={cn("w-fit max-w-[95%] whitespace-pre-wrap rounded-2xl p-3.5 text-sm leading-relaxed break-words", m.role === "user" ? "ml-auto rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-secondary")}>{m.text}</div>
              {recommendations.length > 0 && <div className="mt-2 grid max-w-[95%] gap-2">{recommendations.map(home => <Link key={home.slug} to={`/homes/${home.slug}`} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl border p-2 text-xs transition hover:bg-muted">
                <img src={home.photos[0].src} alt="" loading="lazy" className="size-12 rounded-lg object-cover" />
                <span className="min-w-0 flex-1"><span className="block font-semibold">{home.name}</span><span className="text-muted-foreground">{home.locality} · {home.bedrooms} bedrooms</span></span><ChevronRight className="size-4 shrink-0" />
              </Link>)}</div>}
            </div>;
          })}
          {busy && <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" /> Zeno is thinking…</p>}
          {error && <div className="mt-4 rounded-xl border p-3 text-xs" role="status"><p>{error}</p>{current.current && <Button type="button" variant="ghost" size="sm" onClick={() => void recover()} disabled={busy} className="mt-2"><RefreshCw className="size-3" /> Recover reply</Button>}</div>}
          <div ref={bottom} />
        </div>
        <div className="shrink-0 border-t px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {busy && <button type="button" onClick={() => { reader.current?.cancel(); setBusy(false); setError("Updates paused. Zeno may finish in the background; recover the reply to reconnect."); }} className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><Pause className="size-3" /> Pause updates</button>}
          <form onSubmit={e => { e.preventDefault(); void send(text); }} className="relative">
            <Textarea ref={input} aria-label="Ask Zeno a question" placeholder="Ask about a home…" value={text} maxLength={1000} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(text); } }} rows={2} className="min-h-16 max-h-28 resize-none rounded-xl pr-12 text-sm" />
            <Button type="submit" size="icon-sm" disabled={awaiting || !text.trim()} aria-label="Send question" className="absolute right-2 bottom-2 rounded-full"><ArrowUp /></Button>
          </form>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Questions are sent to our AI service. Avoid sharing ID or payment details. Up to 12 questions per day; your host confirms rates and availability.</p>
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-whatsapp"><WhatsAppIcon className="size-3.5" /> Talk to {business.host.firstName} on WhatsApp</a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
