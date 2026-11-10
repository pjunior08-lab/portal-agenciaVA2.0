"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUp, Loader2, Trash2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { deleteMessage, loadOlder, markRead, sendMessage } from "./actions";
import {
  MESSAGE_MAX,
  groupMessages,
  initials,
  mergeMessages,
  messageSchema,
  timeOf,
  type ChatMessage,
} from "./schemas";

interface Props {
  conversationId: string;
  me: string;
  initial: ChatMessage[];
  hasMore: boolean;
  canPost: boolean;
  /** Texto quando não pode escrever. */
  readOnlyHint?: string;
  /** Nome para mostrar no lugar do autor (ex.: "Equipe da agência" no Portal). */
  nameOf?: (m: ChatMessage) => string;
  placeholder?: string;
  className?: string;
}

/** Conversa com mensagens em tempo real. Usada pela equipe (Comunicação) e pelo cliente (Portal). */
export function ChatThread({
  conversationId,
  me,
  initial,
  hasMore: initialHasMore,
  canPost,
  readOnlyHint,
  nameOf,
  placeholder = "Escreva uma mensagem…",
  className,
}: Props) {
  const [messages, setMessages] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState<"conectando" | "ok" | "erro">("conectando");
  const [now, setNow] = useState(() => new Date().toISOString());
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);

  useEffect(() => {
    setMessages(initial);
    setHasMore(initialHasMore);
    stickToBottom.current = true;
  }, [conversationId, initial, initialHasMore]);

  // mensagens novas, apagadas e de outras pessoas chegam pelo canal em tempo real (com as mesmas regras de acesso)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (!m?.id) return;
          setMessages((cur) => mergeMessages(cur, [m]));
          if (m.author_id !== me && document.visibilityState === "visible") markRead(conversationId);
        },
      )
      .subscribe((status) =>
        setLive(
          status === "SUBSCRIBED"
            ? "ok"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "erro"
              : "conectando",
        ),
      );
    markRead(conversationId);
    const onVisible = () => document.visibilityState === "visible" && markRead(conversationId);
    document.addEventListener("visibilitychange", onVisible);
    const tick = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [conversationId, me]);

  // mantém a rolagem no fim quando chega mensagem (se a pessoa já estava no fim)
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const older = useCallback(async () => {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const r = await loadOlder(conversationId, messages[0].created_at);
    setLoadingOlder(false);
    if (!r.ok) return setError(r.error);
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    setMessages((cur) => mergeMessages(cur, r.data!));
    if (r.data!.length < 50) setHasMore(false);
  }, [conversationId, messages, loadingOlder]);

  const days = groupMessages(messages, now);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-label="Mensagens"
      >
        {hasMore && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={older} loading={loadingOlder}>
              Ver mensagens anteriores
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="m-auto text-center text-sm text-muted">Nenhuma mensagem ainda. Comece a conversa.</p>
        )}
        {days.map((d) => (
          <section key={d.label} aria-label={d.label} className="flex flex-col gap-3">
            <p className="sticky top-0 z-[1] mx-auto rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-muted">
              {d.label}
            </p>
            {d.blocks.map((b) => {
              const mine = b.author_id === me;
              const name = nameOf ? nameOf(b.items[0]) : (b.author_name ?? "Ex-membro");
              return (
                <div key={b.items[0].id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                  {!mine && (
                    <span
                      className="mt-5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold"
                      aria-hidden
                    >
                      {initials(name)}
                    </span>
                  )}
                  <div className={cn("flex max-w-[78%] flex-col gap-1", mine && "items-end")}>
                    {!mine && <p className="px-1 text-[11px] font-medium text-muted">{name}</p>}
                    {b.items.map((m) => (
                      <Bubble key={m.id} m={m} mine={mine} onError={setError} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {error && (
        <div className="px-4 pb-2">
          <Alert>{error}</Alert>
        </div>
      )}
      {live === "erro" && (
        <p className="px-4 pb-1 text-[11px] text-muted">
          Sem conexão em tempo real. Novas mensagens aparecem ao recarregar a página.
        </p>
      )}
      {canPost ? (
        <Composer
          conversationId={conversationId}
          placeholder={placeholder}
          onSent={(m) => {
            stickToBottom.current = true;
            setMessages((cur) => mergeMessages(cur, [m]));
          }}
          onError={setError}
        />
      ) : (
        <p className="border-t border-line px-4 py-3 text-center text-xs text-muted">
          {readOnlyHint ?? "Você pode ler, mas não escrever nesta conversa."}
        </p>
      )}
    </div>
  );
}

function Bubble({ m, mine, onError }: { m: ChatMessage; mine: boolean; onError: (e: string) => void }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (m.deleted_at)
    return (
      <p
        className={cn("rounded-2xl border border-dashed border-line px-3 py-1.5 text-xs text-muted-2 italic")}
      >
        Mensagem apagada
      </p>
    );
  return (
    <div className={cn("group flex items-end gap-1", mine && "flex-row-reverse")}>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
          mine ? "rounded-br-md bg-brand-soft" : "rounded-bl-md bg-surface-2",
        )}
      >
        {m.body}
        <span className="ml-2 align-bottom text-[10px] text-muted">{timeOf(m.created_at)}</span>
      </div>
      {mine &&
        (confirm ? (
          <span className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              className="font-medium text-danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteMessage(m.id);
                  if (!r.ok) onError(r.error);
                  setConfirm(false);
                })
              }
            >
              Apagar
            </button>
            <button type="button" className="text-muted" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="rounded-full p-1 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Apagar mensagem"
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="size-3.5" />
          </button>
        ))}
    </div>
  );
}

function Composer({
  conversationId,
  placeholder,
  onSent,
  onError,
}: {
  conversationId: string;
  placeholder: string;
  onSent: (m: ChatMessage) => void;
  onError: (e: string) => void;
}) {
  const [pending, start] = useTransition();
  const { register, handleSubmit, reset, watch } = useForm<{ body: string }>({
    resolver: zodResolver(messageSchema),
    defaultValues: { body: "" },
  });
  const body = watch("body");
  const submit = handleSubmit(
    (v) =>
      start(async () => {
        onError("");
        const r = await sendMessage(conversationId, v);
        if (!r.ok) return onError(r.error);
        reset({ body: "" });
        onSent(r.data!);
      }),
    (errs) => errs.body?.message && body.trim() && onError(errs.body.message),
  );
  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
      <label htmlFor={`composer-${conversationId}`} className="sr-only">
        Mensagem
      </label>
      <textarea
        id={`composer-${conversationId}`}
        {...register("body")}
        rows={1}
        maxLength={MESSAGE_MAX}
        placeholder={placeholder}
        className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none rounded-2xl bg-surface-2 px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button type="submit" size="icon" aria-label="Enviar" disabled={pending || !body.trim()}>
        {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
      </Button>
    </form>
  );
}
