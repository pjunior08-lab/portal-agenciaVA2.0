"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Link2Off, Unplug } from "lucide-react";
import { Alert, Badge, Button, Modal, SectionCard, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NETWORKS } from "@/features/aprovacoes/schemas";
import { disconnectAccount, linkClientAccounts } from "@/features/social/actions";
import type { SocialNetworkT } from "@/lib/supabase/database.types";

interface Account {
  id: string;
  network: SocialNetworkT;
  username: string;
  profile_url: string | null;
  picture_url: string | null;
  connection: string;
  connected_at: string | null;
  last_error: string | null;
}

interface Pending {
  key: string;
  network: SocialNetworkT;
  username: string;
  picture_url: string | null;
  suggested_client: string | null;
  /** nome do cliente a quem a conta já pertence (não pode ser escolhida aqui) */
  otherClient: string | null;
}

const META_ERRORS: Record<string, string> = {
  erro: "Não foi possível concluir a conexão com a Meta. Tente de novo.",
  cancelado: "A conexão com a Meta foi cancelada.",
  "sem-contas": "A Meta não devolveu nenhuma Página. Na conexão, marque a Página (e o Instagram ligado a ela) deste cliente.",
  "sem-permissao": "Só quem pode editar o Social conecta contas.",
  "nao-configurado": "A conexão com a Meta ainda não está configurada no servidor.",
};

const AUTO: SocialNetworkT[] = ["instagram", "facebook"];
const handle = (network: SocialNetworkT, name: string) => (network === "facebook" ? name : `@${name}`);

function Avatar({ url }: { url: string | null }) {
  return url ? (
    // foto de perfil vem do CDN da Meta; sem otimização do Next
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    <span className="size-10 shrink-0 rounded-full bg-surface-3" aria-hidden />
  );
}

/** Aba "Redes sociais" do perfil: a conta de cada rede fica salva no cliente e é usada em toda publicação dele. */
export function RedesPanel({
  clientId,
  clientName,
  canEdit,
  metaReady,
  accounts,
  pending,
  connectReturned,
  metaError,
}: {
  clientId: string;
  clientName: string;
  canEdit: boolean;
  metaReady: boolean;
  accounts: Account[];
  pending: Pending[];
  connectReturned: boolean;
  metaError: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [pickOpen, setPickOpen] = useState(pending.length > 0);
  const connected = (n: SocialNetworkT) => accounts.find((a) => a.network === n && a.connection !== "manual") ?? null;
  const others = accounts.filter((a) => !AUTO.includes(a.network) || a.connection === "manual");

  return (
    <div className="flex flex-col gap-4">
      {metaError && <Alert>{META_ERRORS[metaError] ?? META_ERRORS.erro}</Alert>}
      {connectReturned && !pending.length && !metaError && (
        <Alert tone="info">Nenhuma conta esperando confirmação. Se acabou de conectar, ela já aparece abaixo.</Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <SectionCard
        title="Publicação automática"
        icon={Link2}
        description={`As contas abaixo ficam salvas em ${clientName}. Todo post aprovado deste cliente sai só nelas.`}
        action={
          canEdit && metaReady ? (
            // rota do servidor que redireciona para a Meta: precisa de navegação completa
            <a href={`/api/social/meta/connect?cliente=${clientId}`} className={buttonVariants({ size: "sm" })}>
              <Link2 /> {connected("instagram") || connected("facebook") ? "Trocar conta" : "Conectar Instagram/Facebook"}
            </a>
          ) : null
        }
      >
        {!metaReady && (
          <Alert tone="info" className="mb-3">
            A conexão com a Meta ainda não está configurada no servidor (falta o aplicativo da Meta).
          </Alert>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {AUTO.map((n) => {
            const a = connected(n);
            return (
              <li key={n} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                <Avatar url={a?.picture_url ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{NETWORKS[n]}</p>
                  {a ? (
                    <p className="truncate text-sm font-medium">
                      {a.profile_url ? (
                        <a href={a.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          {handle(n, a.username)} <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        handle(n, a.username)
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Não conectada</p>
                  )}
                </div>
                {a ? (
                  a.connection === "erro" ? (
                    <Badge tone="danger" title={a.last_error ?? undefined}>
                      <AlertTriangle className="size-3" aria-hidden /> Reconecte
                    </Badge>
                  ) : (
                    <Badge tone="success-soft">
                      <CheckCircle2 className="size-3" aria-hidden /> Conectada
                    </Badge>
                  )
                ) : (
                  <Badge>
                    <Link2Off className="size-3" aria-hidden /> Sem conta
                  </Badge>
                )}
                {a && canEdit && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Desconectar ${NETWORKS[n]} de ${clientName}`}
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const r = await disconnectAccount(a.id);
                        if (!r.ok) return setError(r.error);
                        router.refresh();
                      })
                    }
                  >
                    <Unplug />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </SectionCard>

      {others.length > 0 && (
        <SectionCard title="Outras redes (publicação manual)" icon={Link2Off} description="Cadastradas no Social; a equipe publica e marca como publicado.">
          <ul className="flex flex-col divide-y divide-line">
            {others.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-20 shrink-0 text-xs font-medium">{NETWORKS[a.network]}</span>
                <span className="truncate">@{a.username}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {pickOpen && pending.length > 0 && (
        <PickModal
          clientId={clientId}
          clientName={clientName}
          pending={pending}
          onClose={() => {
            setPickOpen(false);
            router.replace(`/clientes/${clientId}?aba=redes`);
          }}
        />
      )}
    </div>
  );
}

/** Na volta da Meta: escolhe qual Instagram e qual Página são DESTE cliente (no máximo um de cada). */
function PickModal({ clientId, clientName, pending, onClose }: { clientId: string; clientName: string; pending: Pending[]; onClose: () => void }) {
  const router = useRouter();
  const initial = (n: SocialNetworkT) => pending.find((p) => p.network === n && p.suggested_client === clientId)?.key ?? "";
  const [choice, setChoice] = useState<Record<"instagram" | "facebook", string>>({ instagram: initial("instagram"), facebook: initial("facebook") });
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Contas de"
      accent={clientName}
      description="Escolha o Instagram e a Página que são deste cliente. As outras ficam de fora."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={!choice.instagram && !choice.facebook}
            onClick={() =>
              start(async () => {
                const r = await linkClientAccounts({ client_id: clientId, ...choice });
                if (!r.ok) return setError(r.error);
                onClose();
                router.refresh();
              })
            }
          >
            Salvar em {clientName}
          </Button>
        </>
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      <div className="flex flex-col gap-5">
        {(["instagram", "facebook"] as const).map((n) => {
          const list = pending.filter((p) => p.network === n);
          return (
            <fieldset key={n}>
              <legend className="mb-2 text-sm font-semibold">{n === "instagram" ? "Instagram" : "Página do Facebook"}</legend>
              <div className="flex flex-col gap-1.5">
                {[{ key: "", username: "", picture_url: null, otherClient: null } as Pick<Pending, "key" | "username" | "picture_url" | "otherClient">, ...list].map((p) => {
                  const disabled = !!p.otherClient;
                  const on = choice[n] === p.key;
                  return (
                    <label
                      key={p.key || "nenhum"}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 ring-line",
                        on && "bg-brand-soft ring-brand",
                        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="radio"
                        name={`pick-${n}`}
                        className="accent-brand"
                        checked={on}
                        disabled={disabled}
                        onChange={() => setChoice((c) => ({ ...c, [n]: p.key }))}
                      />
                      {p.key ? (
                        <>
                          <Avatar url={p.picture_url} />
                          <span className="min-w-0 flex-1 truncate">{handle(n, p.username)}</span>
                          {p.otherClient && <Badge>já é de {p.otherClient}</Badge>}
                        </>
                      ) : (
                        <span className="text-muted">Não conectar {n === "instagram" ? "Instagram" : "Facebook"} agora</span>
                      )}
                    </label>
                  );
                })}
                {!list.length && <p className="text-xs text-muted">A Meta não devolveu nenhuma conta desta rede.</p>}
              </div>
            </fieldset>
          );
        })}
      </div>
    </Modal>
  );
}
