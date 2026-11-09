"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Download,
  Filter,
  Hourglass,
  MessageSquare,
  PhoneCall,
  Printer,
  Reply,
  TrendingDown,
  UserPlus,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { BarRows, Button, GroupedBars, Input, SectionCard, Select, StatCard } from "@/components/ui";
import { cn, formatBRL } from "@/lib/utils";
import { addDays, addMonths, shortDate } from "@/lib/dates";
import {
  STAGES,
  byLostReason,
  byWeek,
  cutBy,
  formatHours,
  funnelReport,
  reportKpis,
  sellersReport,
  staleLeads,
  toCsv,
  type ActivityRow,
  type HistoryRow,
  type Period,
} from "@/features/comercial/schemas";
import { useCrm } from "../crm-shell";
import { StageDot } from "../opportunity-modal";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const fmtDay = (d: string) => `${shortDate(d)} ${d.slice(0, 4)}`;

export function ReportsApp({
  period,
  history,
  acts,
}: {
  period: Period;
  history: HistoryRow[];
  acts: ActivityRow[];
}) {
  const router = useRouter();
  const path = usePathname();
  const { base, today, personName, openOpp } = useCrm();
  const [navigating, start] = useTransition();
  const [owner, setOwner] = useState("");
  const [segment, setSegment] = useState("");
  const [origin, setOrigin] = useState("");
  const [reason, setReason] = useState("");
  const [staleDays, setStaleDays] = useState(base.settings.stale_days);
  const [custom, setCustom] = useState(period);

  const go = (p: Period) => start(() => router.push(`${path}?de=${p.from}&ate=${p.to}`));
  const month = today.slice(0, 7);
  const presets: { label: string; p: Period }[] = [
    { label: "Este mês", p: { from: `${month}-01`, to: today } },
    { label: "Mês passado", p: { from: addMonths(`${month}-01`, -1), to: addDays(`${month}-01`, -1) } },
    { label: "Últimos 30 dias", p: { from: addDays(today, -29), to: today } },
    { label: "Últimos 90 dias", p: { from: addDays(today, -89), to: today } },
    { label: "Este ano", p: { from: `${today.slice(0, 4)}-01-01`, to: today } },
  ];

  // filtros valem para as oportunidades; contatos e histórico seguem as oportunidades filtradas
  const opps = useMemo(
    () =>
      base.opps.filter(
        (o) =>
          (!owner || (owner === "none" ? !o.owner_id : o.owner_id === owner)) &&
          (!segment || o.segment === segment) &&
          (!origin || o.origin === origin) &&
          (!reason || (o.lost_reason ?? "") === reason),
      ),
    [base.opps, owner, segment, origin, reason],
  );
  const ids = useMemo(() => new Set(opps.map((o) => o.id)), [opps]);
  const h = useMemo(() => history.filter((x) => ids.has(x.opportunity_id)), [history, ids]);
  const a = useMemo(() => acts.filter((x) => ids.has(x.opportunity_id)), [acts, ids]);

  const kpis = useMemo(() => reportKpis(opps, a, period), [opps, a, period]);
  const funnel = useMemo(() => funnelReport(opps, h, period, new Date().toISOString()), [opps, h, period]);
  const sellers = useMemo(
    () =>
      sellersReport(opps, a, h, period).sort(
        (x, y) => y.closedValue - x.closedValue || y.contacts - x.contacts,
      ),
    [opps, a, h, period],
  );
  const segments = useMemo(() => cutBy(opps, period, "segment"), [opps, period]);
  const origins = useMemo(() => cutBy(opps, period, "origin"), [opps, period]);
  const weeks = useMemo(() => byWeek(opps, period), [opps, period]);
  const reasons = useMemo(() => byLostReason(opps, period), [opps, period]);
  const stale = useMemo(() => staleLeads(opps, staleDays, today), [opps, staleDays, today]);

  const segOptions = [...new Set(base.opps.map((o) => o.segment ?? "").filter(Boolean))].sort();
  const originOptions = [...new Set(base.opps.map((o) => o.origin ?? "").filter(Boolean))].sort();
  const reasonOptions = [...new Set(base.opps.map((o) => o.lost_reason ?? "").filter(Boolean))].sort();
  const sellerName = (id: string) => (id ? personName(id) : "Sem responsável");

  function exportCsv() {
    const rows: (string | number | null)[][] = [
      ["Relatório comercial", `${fmtDay(period.from)} a ${fmtDay(period.to)}`],
      [],
      ["Indicadores"],
      ["Leads criados", kpis.created],
      ["Contatos", kpis.contacts],
      ["Respostas", kpis.answers],
      ["Reuniões marcadas", kpis.meetings],
      ["Fechados", kpis.closed, kpis.closedValue],
      ["Perdidos", kpis.lost, kpis.lostValue],
      [],
      [
        "Funil",
        "Na etapa agora",
        "Entraram",
        "Avançaram",
        "Fecharam",
        "Perderam",
        "Conversão",
        "Tempo médio (h)",
        "Tempo dos abertos (h)",
      ],
      ...funnel.map((r) => [
        STAGES[r.stage].label,
        r.now,
        r.entered,
        r.advanced,
        r.closed,
        r.lost,
        pct(r.conversion),
        r.avgHours?.toFixed(1) ?? null,
        r.openHours?.toFixed(1) ?? null,
      ]),
      [],
      [
        "Vendedor",
        "Contatos",
        "Respostas",
        "Taxa de resposta",
        "Reuniões",
        "Fechamentos",
        "Valor fechado",
        "Em aberto",
      ],
      ...sellers.map((s) => [
        sellerName(s.id),
        s.contacts,
        s.answers,
        pct(s.answerRate),
        s.meetings,
        s.closed,
        s.closedValue,
        s.open,
      ]),
      [],
      ["Segmento", "Leads", "Fechados", "Perdidos", "Taxa de fechamento", "Valor fechado"],
      ...segments.map((s) => [s.name, s.leads, s.closed, s.lost, pct(s.closeRate), s.closedValue]),
      [],
      ["Origem", "Leads", "Fechados", "Perdidos", "Taxa de fechamento", "Valor fechado"],
      ...origins.map((s) => [s.name, s.leads, s.closed, s.lost, pct(s.closeRate), s.closedValue]),
      [],
      ["Semana (início)", "Criados", "Fechados", "Perdidos"],
      ...weeks.map((w) => [w.week, w.created, w.closed, w.lost]),
      [],
      ["Motivo da perda", "Quantidade", "Valor"],
      ...reasons.map((r) => [r.reason, r.count, r.value]),
    ];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), {
      href: url,
      download: `relatorio-comercial-${period.from}-a-${period.to}.csv`,
    }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn("flex flex-col gap-4", navigating && "opacity-60")}>
      <h1 className="hidden text-xl print:block">
        Relatório comercial · {fmtDay(period.from)} a {fmtDay(period.to)}
      </h1>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <CalendarRange className="size-4 text-muted" aria-hidden />
        {presets.map((x) => (
          <button
            key={x.label}
            type="button"
            onClick={() => go(x.p)}
            aria-pressed={x.p.from === period.from && x.p.to === period.to}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              x.p.from === period.from && x.p.to === period.to
                ? "bg-brand text-brand-ink"
                : "bg-surface text-muted hover:text-ink",
            )}
          >
            {x.label}
          </button>
        ))}
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.from && custom.to) go(custom);
          }}
        >
          <Input
            type="date"
            aria-label="De"
            className="h-8 w-auto text-xs"
            value={custom.from}
            onChange={(e) => setCustom({ ...custom, from: e.target.value })}
          />
          <span className="text-xs text-muted">a</span>
          <Input
            type="date"
            aria-label="Até"
            className="h-8 w-auto text-xs"
            value={custom.to}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })}
          />
          <Button type="submit" variant="secondary" size="sm">
            Aplicar
          </Button>
        </form>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer /> PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Filter className="size-4 text-muted" aria-hidden />
        <Select
          aria-label="Responsável"
          className="h-9 w-auto"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          <option value="none">Sem responsável</option>
          {base.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Segmento"
          className="h-9 w-auto"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
        >
          <option value="">Todos os segmentos</option>
          {segOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select
          aria-label="Origem"
          className="h-9 w-auto"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        >
          <option value="">Todas as origens</option>
          {originOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select
          aria-label="Motivo da perda"
          className="h-9 w-auto"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value="">Todos os motivos de perda</option>
          {reasonOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Leads criados" value={kpis.created} icon={UserPlus} />
        <StatCard label="Contatos" value={kpis.contacts} icon={PhoneCall} />
        <StatCard
          label="Respostas"
          value={kpis.answers}
          icon={Reply}
          hint={kpis.contacts ? `${pct(kpis.answers / kpis.contacts)} dos contatos` : undefined}
        />
        <StatCard label="Reuniões" value={kpis.meetings} icon={Video} />
        <StatCard
          label="Fechados"
          value={kpis.closed}
          icon={CheckCircle2}
          hint={`${formatBRL(kpis.closedValue)}/mês`}
        />
        <StatCard
          label="Perdidos"
          value={kpis.lost}
          icon={XCircle}
          hint={`${formatBRL(kpis.lostValue)}/mês`}
        />
      </div>

      <SectionCard
        title="Funil por etapa"
        icon={TrendingDown}
        description="Quem entrou em cada etapa no período e o que aconteceu depois."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line text-right">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Etapa
                </th>
                {[
                  "Na etapa agora",
                  "Entraram",
                  "Avançaram",
                  "Fecharam",
                  "Perderam",
                  "Conversão",
                  "Tempo médio",
                  "Tempo dos abertos",
                ].map((t) => (
                  <th key={t} scope="col" className="px-2 py-2 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {funnel.map((r) => (
                <tr key={r.stage} className="border-b border-line text-right last:border-0">
                  <td className="py-2 pr-3 text-left">
                    <StageDot stage={r.stage} />
                  </td>
                  <td className="px-2 py-2">{r.now}</td>
                  <td className="px-2 py-2">{r.entered}</td>
                  <td className="px-2 py-2">{r.advanced ?? "—"}</td>
                  <td className="px-2 py-2">{r.closed ?? "—"}</td>
                  <td className="px-2 py-2">{r.lost ?? "—"}</td>
                  <td className="px-2 py-2 font-medium">{pct(r.conversion)}</td>
                  <td
                    className="px-2 py-2"
                    title={r.medianHours !== null ? `Mediana: ${formatHours(r.medianHours)}` : undefined}
                  >
                    {formatHours(r.avgHours)}
                  </td>
                  <td className="px-2 py-2">{formatHours(r.openHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <SectionCard
          title="Leads parados"
          icon={Hourglass}
          description="Abertos sem contato há mais dias que o limite."
          action={
            <Select
              aria-label="Dias sem contato"
              className="h-8 w-auto text-xs print:hidden"
              value={staleDays}
              onChange={(e) => setStaleDays(Number(e.target.value))}
            >
              {[...new Set([7, 14, 30, base.settings.stale_days])]
                .sort((x, y) => x - y)
                .map((d) => (
                  <option key={d} value={d}>
                    {d}+ dias
                  </option>
                ))}
            </Select>
          }
        >
          {stale.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Nenhum lead parado.</p>
          ) : (
            <ul className="flex max-h-80 flex-col overflow-y-auto">
              {stale.slice(0, 100).map(({ o, idle }) => (
                <li key={o.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => openOpp(o)}
                    className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{o.company || o.name}</span>
                    <StageDot stage={o.stage} />
                    <span className="w-16 text-right text-xs font-medium text-danger tabular-nums">
                      {idle} dias
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Motivos de perda"
          icon={XCircle}
          description="Perdas no período, pela quantidade."
        >
          <BarRows
            rows={reasons.map((r) => ({
              id: r.reason,
              label: r.reason,
              value: r.count,
              hint: formatBRL(r.value),
            }))}
            format={(n) => String(n)}
            color="var(--danger)"
            empty="Nenhuma perda no período."
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Vendedores"
        icon={Users}
        description="Contatos contam para quem registrou; o fechamento, para quem moveu para Fechado."
      >
        <Table
          head={[
            "Pessoa",
            "Contatos",
            "Respostas",
            "Taxa de resposta",
            "Reuniões",
            "Fechamentos",
            "Valor fechado",
            "Em aberto",
          ]}
          rows={sellers.map((s) => [
            sellerName(s.id),
            s.contacts,
            s.answers,
            pct(s.answerRate),
            s.meetings,
            s.closed,
            formatBRL(s.closedValue),
            s.open,
          ])}
          empty="Sem atividade no período."
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <SectionCard title="Por segmento" icon={MessageSquare}>
          <Table
            head={["Segmento", "Leads", "Fechados", "Perdidos", "Taxa", "Valor"]}
            rows={segments.map((s) => [
              s.name,
              s.leads,
              s.closed,
              s.lost,
              pct(s.closeRate),
              formatBRL(s.closedValue),
            ])}
            empty="Sem dados no período."
          />
        </SectionCard>
        <SectionCard title="Por origem" icon={MessageSquare}>
          <Table
            head={["Origem", "Leads", "Fechados", "Perdidos", "Taxa", "Valor"]}
            rows={origins.map((s) => [
              s.name,
              s.leads,
              s.closed,
              s.lost,
              pct(s.closeRate),
              formatBRL(s.closedValue),
            ])}
            empty="Sem dados no período."
          />
        </SectionCard>
      </div>

      <SectionCard title="Por semana" icon={CalendarRange}>
        {weeks.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Sem movimento no período.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr] [&>*]:min-w-0">
            <GroupedBars
              groups={weeks.map((w) => ({
                key: w.week,
                label: shortDate(w.week),
                values: [w.created, w.closed, w.lost],
              }))}
              series={[
                { name: "Criados", color: "var(--muted-2)" },
                { name: "Fechados", color: "var(--info)" },
                { name: "Perdidos", color: "var(--danger)" },
              ]}
              format={(n) => String(n)}
            />
            <Table
              head={["Semana de", "Criados", "Fechados", "Perdidos"]}
              rows={weeks.map((w) => [shortDate(w.week), w.created, w.closed, w.lost])}
              empty=""
            />
          </div>
        )}
      </SectionCard>

      <SectionCard title="Como ler este relatório" icon={BookOpen} className="print:break-before-page">
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          {[
            [
              "Período",
              "Datas no horário de Brasília. Leads criados, contatos, fechamentos e perdas contam pela data em que aconteceram.",
            ],
            ["Respostas", "Contatos com resultado Respondeu, Pediu retorno ou Reunião marcada."],
            [
              "Entraram",
              "Quantas oportunidades chegaram à etapa dentro do período (inclui quem já nasceu nela).",
            ],
            [
              "Avançaram",
              "Das que entraram, quantas depois chegaram a uma etapa mais à frente, incluindo Fechado.",
            ],
            ["Conversão", "Avançaram dividido por Entraram."],
            [
              "Tempo médio",
              "Média de permanência na etapa das saídas ocorridas no período. Passe o mouse para ver a mediana.",
            ],
            ["Tempo dos abertos", "Há quanto tempo, em média, quem está na etapa hoje chegou nela."],
            [
              "Leads parados",
              "Oportunidades abertas sem contato registrado (ou, sem contato nenhum, desde a criação) há mais dias que o limite escolhido.",
            ],
            [
              "Vendedores",
              "Contatos e respostas contam para quem registrou; fechamento conta para quem moveu para Fechado (ou para o responsável, se não houver registro).",
            ],
            ["Valores", "Sempre o valor mensal da conta."],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-medium">{t}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (!rows.length) return empty ? <p className="py-6 text-center text-xs text-muted">{empty}</p> : null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            {head.map((t, i) => (
              <th key={t} scope="col" className={cn("px-2 py-2 font-medium", i ? "text-right" : "text-left")}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line last:border-0">
              {r.map((c, i) => (
                <td key={i} className={cn("px-2 py-2", i ? "text-right" : "text-left")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
