import Link from "next/link";
import { Contact, FileText, Globe, StickyNote, Wallet } from "lucide-react";
import { Badge, SectionCard, StatCard } from "@/components/ui";
import { formatBRL } from "@/lib/utils";
import type { ClientRow } from "@/lib/supabase/database.types";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" });

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-36 shrink-0 text-xs text-muted">{label}</dt>
      <dd className="text-sm break-words">{value || <span className="text-muted-2">Não informado</span>}</dd>
    </div>
  );
}

export function Overview({
  client,
  notesCount,
  filesCount,
  portal,
}: {
  client: ClientRow;
  notesCount: number;
  filesCount: number;
  portal: { slug: string; enabled: boolean; sections: string[] } | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
        <StatCard
          label="Mensalidade"
          icon={Wallet}
          value={client.monthly_fee != null ? formatBRL(client.monthly_fee) : "—"}
          hint={client.billing_day ? `Vence todo dia ${client.billing_day}` : "Sem dia de cobrança"}
        />
        <StatCard
          label="Cliente desde"
          icon={Contact}
          value={client.client_since ? new Date(client.client_since).getUTCFullYear() : "—"}
          hint={client.client_since ? dateFmt.format(new Date(client.client_since)) : "Data não informada"}
        />
        <StatCard label="Anotações" icon={StickyNote} value={notesCount} />
        <StatCard label="Arquivos" icon={FileText} value={filesCount} />
      </div>

      <SectionCard title="Contato e cobrança" icon={Contact} className="lg:col-span-2">
        <dl className="divide-y divide-line">
          <Row label="Pessoa de contato" value={client.contact_name} />
          <Row label="Telefone" value={client.phone} />
          <Row label="E-mail" value={client.email && <a className="underline-offset-2 hover:underline" href={`mailto:${client.email}`}>{client.email}</a>} />
          <Row label="CPF ou CNPJ" value={client.document} />
          <Row label="Endereço" value={client.address} />
          <Row label="Lembretes por e-mail" value={client.auto_reminders ? "Ligados" : "Desligados"} />
        </dl>
      </SectionCard>

      <div className="flex flex-col gap-4">
        <SectionCard title="Portal do Cliente" icon={Globe}>
          {portal ? (
            <div className="flex flex-col gap-2 text-sm">
              <Badge tone={portal.enabled ? "success-soft" : "neutral"} className="self-start">
                {portal.enabled ? "Ligado" : "Desligado"}
              </Badge>
              <p className="text-xs text-muted">
                Endereço: <span className="font-mono">/portal/{portal.slug}</span> · {portal.sections.length} seções liberadas
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted">Ainda não configurado.</p>
          )}
          <Link href={`?aba=portal`} className="mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline">
            Configurar portal
          </Link>
        </SectionCard>
        <SectionCard title="Observações internas" icon={StickyNote}>
          <p className="text-sm whitespace-pre-wrap">{client.notes || <span className="text-muted-2">Nenhuma observação.</span>}</p>
        </SectionCard>
      </div>
    </div>
  );
}
