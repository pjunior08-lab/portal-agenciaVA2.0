"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, FileText, Lightbulb, MessageCircle, Send, Sparkles, Trash2, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Alert, Button, Card, EmptyState, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MODES, type Mode } from "@/features/assistente/schemas";
import { askAssistant, createDraftFromCaption } from "@/features/assistente/actions";

const ICONS: Record<Mode, typeof Wand2> = { legenda: Wand2, pauta: Lightbulb, resumo: FileText, livre: MessageCircle };

interface Msg {
  role: "user" | "assistant";
  content: string;
  options?: string[];
  mode: Mode;
}

export function AssistantApp({
  clients,
  initialClient,
  configured,
  canDraft,
}: {
  clients: { id: string; name: string }[];
  initialClient: string;
  configured: boolean;
  canDraft: boolean;
}) {
  const [client, setClient] = useState(initialClient);
  const [mode, setMode] = useState<Mode>("legenda");
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const clientName = clients.find((c) => c.id === client)?.name;

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs.length, pending]);

  const send = () => {
    const message = text.trim();
    if (!message) return;
    setError("");
    if (MODES[mode].needsClient && !client) return setError("Escolha o cliente primeiro.");
    const history = msgs.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: message, mode }]);
    setText("");
    start(async () => {
      const r = await askAssistant({ mode, client_id: client, message, history });
      if (!r.ok) {
        setError(r.error);
        setText(message);
        setMsgs((m) => m.slice(0, -1));
        return;
      }
      setMsgs((m) => [...m, { role: "assistant", content: r.data!.text, options: r.data!.options, mode }]);
    });
  };

  return (
    <>
      <PageHeader
        title="Assistente IA"
        icon={Sparkles}
        actions={
          msgs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMsgs([])}>
              <Trash2 /> Nova conversa
            </Button>
          )
        }
      />
      {!configured && (
        <Alert tone="info" className="mb-4">
          O Assistente ainda não está ligado: falta a chave da Anthropic (ANTHROPIC_API_KEY) no Netlify. A tela já está pronta e passa a responder assim que a chave entrar.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] [&>*]:min-w-0">
        <section className="flex min-h-[60vh] flex-col rounded-card bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
            <span className="text-xs text-muted">Cliente</span>
            <div className="w-full sm:w-64">
              <Select aria-label="Cliente" value={client} onChange={(e) => setClient(e.target.value)}>
                <option value="">Nenhum (geral)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pt-4" role="radiogroup" aria-label="O que você quer">
            {(Object.keys(MODES) as Mode[]).map((m) => {
              const Icon = ICONS[m];
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
                    mode === m ? "bg-panel text-panel-ink" : "bg-surface-2 hover:bg-surface-3",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden /> {MODES[m].label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.length === 0 && !pending && (
              <Card className="m-auto max-w-md bg-surface-2">
                <EmptyState
                  icon={Sparkles}
                  title="Como posso ajudar?"
                  description={
                    client
                      ? `Vou escrever no tom de ${clientName}, usando a Central Estratégica e as legendas já aprovadas.`
                      : "Escolha um cliente para legendas e pautas no tom dele, ou faça uma pergunta geral."
                  }
                />
              </Card>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-panel px-4 py-2.5 text-sm whitespace-pre-wrap text-panel-ink">
                  {m.content}
                </div>
              ) : (
                <Answer key={i} msg={m} clientId={client} canDraft={canDraft} />
              ),
            )}
            {pending && <div className="max-w-[85%] animate-pulse rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 text-sm text-muted">Pensando…</div>}
            <div ref={end} />
          </div>

          {error && <Alert className="mx-4 mb-2">{error}</Alert>}
          <form
            className="flex items-end gap-2 border-t border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Textarea
              aria-label="Seu pedido"
              rows={2}
              className="min-h-11 flex-1 resize-none"
              placeholder={MODES[mode].hint}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={!configured}
            />
            <Button type="submit" size="icon" aria-label="Enviar" loading={pending} disabled={!configured || !text.trim()}>
              <Send />
            </Button>
          </form>
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="p-4 text-xs">
            <p className="mb-2 text-sm font-semibold">O que ele usa</p>
            <ul className="flex flex-col gap-1.5 text-muted">
              <li>• Tom de voz e regras de legenda do cliente (Central Estratégica)</li>
              <li>• Persona e posicionamento</li>
              <li>• As últimas legendas enviadas ou aprovadas</li>
              <li>• Suas demandas e aprovações da semana (no resumo)</li>
              <li>• Só o que você tem permissão de ver</li>
            </ul>
            {client && (
              <Link href={`/clientes/${client}?aba=estrategia`} className="mt-3 inline-block text-xs underline-offset-2 hover:underline">
                Editar o tom de voz de {clientName}
              </Link>
            )}
          </Card>
          <Card className="p-4 text-xs text-muted">
            A conversa não fica salva. Confira sempre o texto antes de usar: a IA pode errar preço, horário ou endereço.
          </Card>
        </aside>
      </div>
    </>
  );
}

function Answer({ msg, clientId, canDraft }: { msg: Msg; clientId: string; canDraft: boolean }) {
  const options = msg.options?.length ? msg.options : [msg.content];
  return (
    <div className="flex max-w-[90%] flex-col gap-2">
      {options.map((o, i) => (
        <Option key={i} text={o} clientId={clientId} canDraft={canDraft && msg.mode === "legenda"} />
      ))}
    </div>
  );
}

function Option({ text, clientId, canDraft }: { text: string; clientId: string; canDraft: boolean }) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl rounded-bl-sm bg-surface-2 p-4 text-sm">
      <p className="whitespace-pre-wrap">{text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
        </Button>
        {canDraft && clientId && !draft && (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await createDraftFromCaption(clientId, text);
                if (!r.ok) return setError(r.error);
                setDraft(r.data!.id);
              })
            }
          >
            Criar rascunho em Aprovações
          </Button>
        )}
        {draft && (
          <Link href="/aprovacoes" className="text-xs font-medium text-success underline-offset-2 hover:underline">
            Rascunho criado · abrir Aprovações
          </Link>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
