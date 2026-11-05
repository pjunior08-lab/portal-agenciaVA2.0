"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Globe, MailPlus, UserRound } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Field, Input, SectionCard, Switch } from "@/components/ui";
import type { Database } from "@/lib/supabase/database.types";
import { inviteClientUser, revokeClientInvitation, savePortal, setClientUserStatus } from "@/features/clientes/actions";
import { PORTAL_SECTIONS, slugify } from "@/features/clientes/schemas";

type Portal = Database["public"]["Tables"]["client_portal"]["Row"];

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function PortalPanel({
  clientId,
  clientName,
  portal,
  users,
  invites,
  canEdit,
}: {
  clientId: string;
  clientName: string;
  portal: Portal | null;
  users: { userId: string; status: "ativo" | "desativado"; name: string; email: string }[];
  invites: { id: string; email: string; expires_at: string }[];
  canEdit: boolean;
}) {
  const [slug, setSlug] = useState(portal?.slug ?? slugify(clientName));
  const [enabled, setEnabled] = useState(portal?.enabled ?? true);
  const [sections, setSections] = useState<string[]>(portal?.sections ?? ["arquivos", "anotacoes"]);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [slugError, setSlugError] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const toggle = (id: string) => setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Configuração do portal"
        icon={Globe}
        description="O que o cliente vê quando entra com o login dele."
        action={<Badge tone={portal?.enabled ? "success-soft" : "neutral"}>{portal ? (portal.enabled ? "Ligado" : "Desligado") : "Não configurado"}</Badge>}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            setSlugError("");
            start(async () => {
              const r = await savePortal({ clientId, slug, enabled, sections });
              if (r.ok) setMessage({ tone: "success", text: "Portal salvo." });
              else {
                setMessage({ tone: "danger", text: r.error });
                if (r.fieldErrors?.slug?.[0]) setSlugError(r.fieldErrors.slug[0]);
              }
            });
          }}
        >
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
          <Field label="Endereço do portal" htmlFor="portal-slug" error={slugError} hint={`${origin}/portal/${slug || "..."}`}>
            <Input id="portal-slug" value={slug} disabled={!canEdit} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          </Field>
          <div className="flex items-center gap-3">
            <Switch id="portal-on" checked={enabled} disabled={!canEdit} onCheckedChange={setEnabled} />
            <label htmlFor="portal-on" className="text-sm">
              Portal ligado
              <span className="block text-xs text-muted">Desligado, nenhum login deste cliente consegue entrar.</span>
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted">Seções liberadas (Início e Conta ficam sempre visíveis)</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PORTAL_SECTIONS.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={sections.includes(s.id)}
                    disabled={!canEdit}
                    onChange={() => toggle(s.id)}
                    className="size-4 accent-[var(--brand)]"
                  />
                  <span className="flex-1">{s.label}</span>
                  {s.phase > 2 && <span className="text-[10px] text-muted-2">Fase {s.phase}</span>}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-2">
              Seções marcadas com fase mostram o conteúdo quando o módulo correspondente estiver pronto.
            </p>
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {portal && (
              <a href={`/portal/${portal.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium underline-offset-2 hover:underline">
                Ver como o cliente vê
              </a>
            )}
            {canEdit && (
              <Button type="submit" loading={pending}>
                Salvar portal
              </Button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Logins do cliente" icon={UserRound} description="Pessoas do cliente que acessam o portal.">
        <div className="flex flex-col gap-4">
          {users.length === 0 ? (
            <EmptyState icon={UserRound} title="Nenhum login ainda" description="Convide alguém do cliente pelo e-mail." />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {users.map((u) => (
                <li key={u.userId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{u.name}</p>
                    <p className="truncate text-xs text-muted">{u.email}</p>
                  </div>
                  {u.status === "desativado" && <Badge tone="danger">Desativado</Badge>}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant={u.status === "ativo" ? "danger-outline" : "secondary"}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await setClientUserStatus(clientId, u.userId, u.status === "ativo" ? "desativado" : "ativo");
                          if (!r.ok) setMessage({ tone: "danger", text: r.error });
                        })
                      }
                    >
                      {u.status === "ativo" ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {invites.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Convites pendentes</p>
              <ul className="flex flex-col divide-y divide-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {i.email} <span className="text-xs text-muted">· vence {date.format(new Date(i.expires_at))}</span>
                    </span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await revokeClientInvitation(i.id, clientId)))}>
                        Cancelar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canEdit && (
            <form
              className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                setMessage(null);
                setCopied(false);
                start(async () => {
                  const r = await inviteClientUser({ clientId, email });
                  if (r.ok && r.data) {
                    setLink(r.data.link);
                    setEmail("");
                  } else if (!r.ok) setMessage({ tone: "danger", text: r.error });
                });
              }}
            >
              <Field label="Convidar pelo e-mail" htmlFor="convite-cliente">
                <Input id="convite-cliente" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@cliente.com" />
              </Field>
              <Button type="submit" size="sm" loading={pending} disabled={!portal} className="self-start">
                <MailPlus /> Gerar convite
              </Button>
              {!portal && <p className="text-[11px] text-muted">Salve a configuração do portal antes de convidar.</p>}
              {link && (
                <div className="flex flex-col gap-1.5">
                  <Alert tone="success">Convite criado. Envie o link (vale 7 dias e só para esse e-mail).</Alert>
                  <div className="flex gap-2">
                    <Input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
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
                </div>
              )}
            </form>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
