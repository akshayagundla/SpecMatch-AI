import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSessions,
  createSession,
  getSessionMessages,
  deleteSession,
} from "@/lib/sessions.functions";
import { sendChat, type ChatRecommendation } from "@/lib/chat.functions";
import { AppShell } from "@/components/app-shell";
import { SpecDropzone } from "@/components/spec-dropzone";
import { ChatMarkdown } from "@/components/chat-markdown";
import { RecommendationGrid } from "@/components/recommendation-grid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Sparkles,
  MessageSquare,
  Trash2,
  Image as ImageIcon,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ClientMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
  recommendations?: ChatRecommendation[];
  extracted_specs?: unknown;
  streaming?: boolean;
};

export const Route = createFileRoute("/_authenticated/workspace")({
  validateSearch: (search: Record<string, unknown>) => ({
    s: typeof search.s === "string" ? search.s : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Workspace — SpecMatch AI" },
      { name: "description", content: "Your compatibility analysis workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const search = Route.useSearch() as { s?: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeId = search.s ?? null;

  const listSessionsFn = useServerFn(listSessions);
  const getMessagesFn = useServerFn(getSessionMessages);
  const createSessionFn = useServerFn(createSession);
  const deleteSessionFn = useServerFn(deleteSession);
  const sendChatFn = useServerFn(sendChat);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => listSessionsFn(),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => (activeId ? getMessagesFn({ data: { sessionId: activeId } }) : Promise.resolve([])),
    enabled: !!activeId,
  });

  const [draftMessages, setDraftMessages] = useState<ClientMessage[]>([]);
  const [input, setInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset client-side drafts when session changes
  useEffect(() => {
    setDraftMessages([]);
    setPendingAnswer(null);
  }, [activeId]);

  const persistedMessages: ClientMessage[] = (messagesQuery.data ?? []).map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    image_url: m.image_url,
    recommendations: (m.recommendations as ChatRecommendation[] | null) ?? undefined,
    extracted_specs: m.extracted_specs,
  }));

  const allMessages: ClientMessage[] = [
    ...persistedMessages,
    ...draftMessages.filter((d) => !persistedMessages.find((p) => p.id === d.id)),
  ];

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [allMessages.length, pendingAnswer]);

  const chatMutation = useMutation({
    mutationFn: async (vars: { message: string; imageDataUrl: string | null; sessionId: string | null }) => {
      return sendChatFn({
        data: {
          message: vars.message,
          imageDataUrl: vars.imageDataUrl ?? undefined,
          sessionId: vars.sessionId ?? undefined,
        },
      });
    },
    onSuccess: async (res, vars) => {
      // typewriter simulation
      const full = res.content;
      let i = 0;
      const tick = () => {
        i = Math.min(full.length, i + Math.max(2, Math.floor(full.length / 80)));
        setPendingAnswer(full.slice(0, i));
        if (i < full.length) {
          setTimeout(tick, 18);
        } else {
          setPendingAnswer(null);
          // finalize
          setDraftMessages((prev) => [
            ...prev.filter((m) => m.id !== "pending-user" && m.id !== "pending-assistant"),
            {
              id: `local-user-${Date.now()}`,
              role: "user",
              content: vars.message,
              image_url: vars.imageDataUrl ? "(attached image)" : null,
            },
            {
              id: res.assistantMessageId,
              role: "assistant",
              content: res.content,
              recommendations: res.recommendations,
              extracted_specs: res.extractedSpecs,
            },
          ]);
          queryClient.invalidateQueries({ queryKey: ["sessions"] });
          queryClient.invalidateQueries({ queryKey: ["messages", res.sessionId] });
          if (!activeId) navigate({ to: "/workspace", search: { s: res.sessionId } });
        }
      };
      tick();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Something went wrong");
      setDraftMessages((prev) => prev.filter((m) => m.id !== "pending-user"));
      setPendingAnswer(null);
    },
  });

  function doSend(text: string, img: string | null) {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;
    setDraftMessages((prev) => [
      ...prev,
      { id: "pending-user", role: "user", content: trimmed, image_url: img ? "(attached image)" : null },
    ]);
    setPendingAnswer("");
    const payload = { message: trimmed, imageDataUrl: img, sessionId: activeId };
    setInput("");
    setImageDataUrl(null);
    chatMutation.mutate(payload);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSend(input, imageDataUrl);
  }

  async function handleNewSession() {
    const s = await createSessionFn({ data: {} });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    navigate({ to: "/workspace", search: { s: s.id } });
  }

  async function handleDeleteSession(id: string) {
    await deleteSessionFn({ data: { sessionId: id } });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    if (activeId === id) navigate({ to: "/workspace", search: {} });
  }

  const sidebar = (
    <>
      <div className="p-3 border-b border-border/60">
        <Button size="sm" variant="violet" className="w-full h-8 text-xs" onClick={handleNewSession}>
          <Plus className="h-3.5 w-3.5" /> New analysis
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            History
          </p>
          {sessionsQuery.data?.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">No analyses yet.</p>
          )}
          {sessionsQuery.data?.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors",
                activeId === s.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/60 text-muted-foreground hover:text-foreground",
              )}
              onClick={() => navigate({ to: "/workspace", search: { s: s.id } })}
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate">{s.title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background"
                aria-label="Delete session"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <AppShell sidebar={sidebar}>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">
            {allMessages.length === 0 && pendingAnswer === null ? (
              <EmptyState onSelect={(text) => doSend(text, imageDataUrl)} />
            ) : (
              <div className="space-y-5">
                {allMessages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {pendingAnswer !== null && <PendingAssistant text={pendingAnswer} />}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 bg-background/80 backdrop-blur">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 sm:px-6 py-3 space-y-2">
            <SpecDropzone imageDataUrl={imageDataUrl} onImage={setImageDataUrl} />
            <div className="relative rounded-lg border border-border bg-surface focus-within:border-violet/60 focus-within:shadow-[var(--shadow-glow)] transition-shadow">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything — e.g. Will this laptop drive an external 4K 144Hz monitor?"
                rows={2}
                className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm pr-12"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                variant="violet"
                className="absolute right-2 bottom-2 h-7 w-7"
                disabled={chatMutation.isPending || !input.trim()}
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              Multimodal RAG · vision extraction · semantic retrieval · grounded LLM reasoning
            </p>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  const examples = [
    "Will a MacBook Pro M3 Max drive an external 4K 144Hz monitor over a single cable?",
    "I have a Samsung Galaxy S26 — recommend a smartwatch that fully syncs its health ecosystem.",
    "Which mouse works seamlessly across my Mac, iPad, and Windows desktop?",
  ];
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--gradient-violet)] shadow-[var(--shadow-glow)] mb-5">
        <Cpu className="h-5 w-5 text-violet-foreground" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Compatibility Workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        Drop a spec image, ask a hardware question, and SpecMatch AI returns a grounded
        compatibility analysis with ranked product matches.
      </p>
      <div className="mt-7 w-full max-w-xl grid gap-2">
        {examples.map((ex) => (
          <ExamplePrompt key={ex} text={ex} onClick={() => onSelect(ex)} />
        ))}
      </div>
    </div>
  );
}

function ExamplePrompt({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group cursor-pointer rounded-md border border-border bg-card/60 px-3 py-2.5 text-left text-xs text-muted-foreground hover:border-violet/50 hover:text-foreground transition-colors flex items-start gap-2"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Sparkles className="h-3 w-3 text-violet mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function MessageBubble({ message }: { message: ClientMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex gap-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 border border-border text-[10px] font-mono shrink-0">
          YOU
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          {message.image_url && (
            <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-surface">
              <ImageIcon className="h-2.5 w-2.5" /> image attached
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--gradient-violet)] shadow-[var(--shadow-glow)] shrink-0">
        <Cpu className="h-3 w-3 text-violet-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {!!message.extracted_specs && typeof message.extracted_specs === "object" && !("error" in (message.extracted_specs as object)) && (
          <ExtractedSpecsBlock specs={message.extracted_specs} />
        )}
        <ChatMarkdown content={message.content} />
        {message.recommendations && <RecommendationGrid recommendations={message.recommendations} />}
      </div>
    </div>
  );
}

function PendingAssistant({ text }: { text: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--gradient-violet)] shadow-[var(--shadow-glow)] shrink-0">
        <Cpu className="h-3 w-3 text-violet-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {text.length === 0 ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="shimmer-text font-medium">Analyzing compatibility</span>
            <span className="flex gap-1">
              <span className="thinking-dot h-1 w-1 rounded-full bg-violet" />
              <span className="thinking-dot h-1 w-1 rounded-full bg-violet" />
              <span className="thinking-dot h-1 w-1 rounded-full bg-violet" />
            </span>
          </div>
        ) : (
          <ChatMarkdown content={text} />
        )}
      </div>
    </div>
  );
}

function ExtractedSpecsBlock({ specs }: { specs: unknown }) {
  return (
    <details className="mb-3 rounded-md border border-border bg-surface-2/60 overflow-hidden">
      <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground select-none">
        Vision-extracted device profile
      </summary>
      <pre className="px-3 pb-2.5 text-[11px] font-mono text-muted-foreground overflow-x-auto">
        {JSON.stringify(specs, null, 2)}
      </pre>
    </details>
  );
}
