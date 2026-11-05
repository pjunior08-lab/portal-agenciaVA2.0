"use client";

import { useState, useTransition } from "react";
import { Check, Compass, Copy, Link2, Link2Off } from "lucide-react";
import { Alert, Badge, Button, Field, Input, SectionCard, Textarea } from "@/components/ui";
import type { Database } from "@/lib/supabase/database.types";
import { saveStrategy, shareStrategy, unshareStrategy } from "@/features/clientes/actions";
import { STRATEGY_FIELDS } from "@/features/clientes/schemas";

type Strategy = Database["public"]["Tables"]["client_strategy"]["Row"];
type Key = (typeof STRATEGY_FIELDS)[number]["key"];

export function StrategyPanel({ clientId, strategy, canEdit }: { clientId: string; strategy: Strategy | null; canEdit: boolean }) {
  const initial = Object.fromEntries(STRATEGY_FIELDS.map((f) => [f.key, strategy?.[f.key] ?? ""])) as Record<Key, string>;
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const dirty = STRATEGY_FIELDS.some((f) => values[f.key] !== saved[f.key]);
  const isShared = !!strategy?.share_token_hash || !!link;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <SectionCard title="Central Estratégica" icon={Compass} description="A base do planejamento de conteúdo do cliente.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            start(async () => {
              const r = await saveStrategy({ clientId, ...values });
              if (r.ok) {
                setSaved(values);
                setMessage({ tone: "success", text: "Central Estratégica salva." });
              } else setMessage({ tone: "danger", text: r.error });
            });
          }}
        >
          {STRATEGY_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`est-${f.key}`} hint={f.hint}>
              <Textarea
                id={`est-${f.key}`}
                rows={4}
                maxLength={10000}
                readOnly={!canEdit}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-h-5 flex-1">{message && <Alert tone={message.tone}>{message.text}</Alert>}</div>
              <Button type="submit" loading={pending} disabled={!dirty}>
                Salvar
              </Button>
            </div>
          )}
        </form>
      </SectionCard>

      <SectionCard
        title="Compartilhar"
        icon={Link2}
        className="self-start"
        action={<Badge tone={isShared ? "info" : "neutral"}>{isShared ? "Link ativo" : "Privado"}</Badge>}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted">
            Gera um link de leitura para o cliente ou parceiros, sem precisar de login. Gerar de novo invalida o link anterior.
          </p>
          {link && (
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Link da Central Estratégica" onFocus={(e) => e.currentTarget.select()} />
              <Button
                size="icon"
                variant="dark"
                aria-label="Copiar link"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                }}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    setCopied(false);
                    const r = await shareStrategy(clientId);
                    if (r.ok && r.data) setLink(r.data.link);
                    else if (!r.ok) setMessage({ tone: "danger", text: r.error });
                  })
                }
              >
                <Link2 /> {isShared ? "Gerar novo link" : "Gerar link"}
              </Button>
              {isShared && (
                <Button
                  size="sm"
                  variant="danger-outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await unshareStrategy(clientId);
                      if (r.ok) setLink("");
                    })
                  }
                >
                  <Link2Off /> Desativar link
                </Button>
              )}
            </div>
          )}
          {isShared && !link && (
            <p className="text-[11px] text-muted-2">Por segurança o link só aparece quando é gerado. Gere outro para copiar.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
