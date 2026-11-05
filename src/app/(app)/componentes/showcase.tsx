"use client";

import { useState } from "react";
import {
  CheckCircle2,
  FileText,
  Inbox,
  KanbanSquare,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterMenu,
  HeroStatCard,
  Input,
  Modal,
  PriorityBadge,
  SectionCard,
  SegmentedControl,
  Select,
  Skeleton,
  StatCard,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { formatBRL } from "@/lib/utils";

/*
 * Todos os números e nomes desta página são EXEMPLOS para visualizar os componentes.
 * Nada aqui é lido ou gravado no banco.
 */

export function Showcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [priority, setPriority] = useState("todas");
  const [mode, setMode] = useState<"rapida" | "detalhada">("rapida");
  const [kind, setKind] = useState<"despesa" | "receita">("despesa");
  const [reminders, setReminders] = useState(true);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="t-indicadores" className="flex flex-col gap-3">
        <h2 id="t-indicadores" className="text-sm font-semibold">Indicadores</h2>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <HeroStatCard label="Valor em aberto (exemplo)" value={formatBRL(12500)} icon={FileText} hint="3 propostas" />
          <StatCard label="Clientes ativos" value={8} icon={Users} hint="exemplo" />
          <StatCard label="Demandas abertas" value={14} icon={KanbanSquare} hint="exemplo" />
          <StatCard label="Resultado do mês" value={formatBRL(4200)} icon={Wallet} hint="exemplo" />
        </div>
      </section>

      <section aria-labelledby="t-botoes" className="flex flex-col gap-3">
        <h2 id="t-botoes" className="text-sm font-semibold">Botões, selos e filtros</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-card bg-surface p-5">
          <Button>
            <Plus /> Novo cliente
          </Button>
          <Button variant="dark">Escuro</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger-outline">Excluir</Button>
          <Button variant="danger">
            <Plus /> Despesa
          </Button>
          <Button variant="success">
            <Plus /> Receita
          </Button>
          <Button loading>Salvando</Button>
          <span className="mx-2 h-6 w-px bg-line" aria-hidden />
          <Badge tone="success" dot>
            Ativo
          </Badge>
          <Badge tone="brand">Pendente</Badge>
          <Badge tone="danger">Atrasada</Badge>
          <Badge tone="info">Enviada</Badge>
          <PriorityBadge priority="alta" />
          <PriorityBadge priority="media" />
          <PriorityBadge priority="baixa" />
          <span className="mx-2 h-6 w-px bg-line" aria-hidden />
          <FilterMenu
            label="Prioridade"
            value={priority}
            onChange={setPriority}
            icon={<SlidersHorizontal className="size-3.5 text-muted" aria-hidden />}
            options={[
              { value: "todas", label: "Toda prioridade" },
              { value: "alta", label: "Alta", leading: <span className="size-2 rounded-full bg-danger" /> },
              { value: "media", label: "Média", leading: <span className="size-2 rounded-full bg-warning" /> },
              { value: "baixa", label: "Baixa", leading: <span className="size-2 rounded-full bg-success" /> },
            ]}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Formulário"
          icon={FileText}
          description="Campos com rótulo, dica e erro"
          action={<Button size="sm" onClick={() => setModalOpen(true)}>Abrir modal</Button>}
        >
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <Field label="Nome do cliente" htmlFor="ex-nome" required className="sm:col-span-2">
              <Input id="ex-nome" placeholder="Ex.: Loja Aurora" />
            </Field>
            <Field label="Status" htmlFor="ex-status">
              <Select id="ex-status" defaultValue="ativo">
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="inativo">Inativo</option>
              </Select>
            </Field>
            <Field label="E-mail" htmlFor="ex-email" error="Informe um e-mail válido.">
              <Input id="ex-email" type="email" defaultValue="contato@" />
            </Field>
            <Field label="Observações" htmlFor="ex-obs" hint="Só a equipe vê." className="sm:col-span-2">
              <Textarea id="ex-obs" rows={3} placeholder="Notas internas sobre o cliente..." />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="ex-lembretes" checked={reminders} onCheckedChange={setReminders} />
              <label htmlFor="ex-lembretes" className="text-sm">
                Lembretes automáticos por e-mail
              </label>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Escolhas e abas" icon={CheckCircle2}>
          <div className="flex flex-col gap-4">
            <SegmentedControl
              label="Forma de aprovação"
              value={mode}
              onChange={setMode}
              options={[
                { value: "rapida", label: "Rápida" },
                { value: "detalhada", label: "Detalhada" },
              ]}
            />
            <SegmentedControl
              label="Tipo de lançamento"
              value={kind}
              onChange={setKind}
              options={[
                { value: "despesa", label: "Despesa", tone: "danger" },
                { value: "receita", label: "Receita", tone: "success" },
              ]}
            />
            <Tabs defaultValue="agendamentos">
              <TabsList className="bg-surface-2">
                <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
                <TabsTrigger value="metricas">Métricas</TabsTrigger>
                <TabsTrigger value="contas">Contas</TabsTrigger>
              </TabsList>
              <TabsContent value="agendamentos" className="pt-3 text-xs text-muted">
                Conteúdo da aba Agendamentos.
              </TabsContent>
              <TabsContent value="metricas" className="pt-3 text-xs text-muted">
                Conteúdo da aba Métricas.
              </TabsContent>
              <TabsContent value="contas" className="pt-3 text-xs text-muted">
                Conteúdo da aba Contas.
              </TabsContent>
            </Tabs>
          </div>
        </SectionCard>

        <SectionCard title="Estados" icon={Inbox} description="Vazio, carregando e erro">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-dashed border-line">
              <EmptyState
                icon={Search}
                title="Nenhuma proposta ainda"
                description="Crie a primeira proposta para acompanhar valores e prazos."
                action={
                  <Button size="sm">
                    <Plus /> Nova proposta
                  </Button>
                }
              />
            </div>
            <div className="flex flex-col gap-2" aria-label="Carregando">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
            <ErrorState
              description="Verifique sua conexão e tente de novo."
              action={
                <Button size="sm" variant="secondary">
                  Tentar de novo
                </Button>
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Kanban (prévia visual)" icon={KanbanSquare}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "A fazer", bar: "bg-info", soft: "bg-info-soft" },
              { name: "Fazendo", bar: "bg-brand", soft: "bg-brand-soft" },
              { name: "Feito", bar: "bg-success", soft: "bg-success-soft" },
            ].map((c) => (
              <div key={c.name} className={`flex flex-col gap-2 rounded-xl p-2 ${c.soft}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className={`size-2 rounded-full ${c.bar}`} aria-hidden />
                  {c.name}
                </div>
                <div className="stripes flex h-14 items-center justify-center rounded-lg text-[11px] text-muted-2">
                  Nenhuma demanda
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Novo"
        accent="lançamento"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModalOpen(false)}>Fechar exemplo</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            label="Tipo de lançamento"
            value={kind}
            onChange={setKind}
            options={[
              { value: "despesa", label: "Despesa", tone: "danger" },
              { value: "receita", label: "Receita", tone: "success" },
            ]}
          />
          <Field label="Valor" htmlFor="ex-valor">
            <Input id="ex-valor" inputMode="decimal" placeholder="R$ 0,00" />
          </Field>
          <p className="text-xs text-muted">
            Modal de exemplo: nada é gravado. O formulário real chega com o Financeiro (Fase 6).
          </p>
        </div>
      </Modal>
    </div>
  );
}
