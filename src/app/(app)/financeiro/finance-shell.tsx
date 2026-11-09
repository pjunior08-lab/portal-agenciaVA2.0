"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { ChevronDown, LayoutGrid, LayoutList, Minus, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FinBase } from "@/features/financeiro/data";
import type { TxView } from "@/features/financeiro/data";
import { TransactionModal } from "./transaction-modal";
import { AccountsModal, CategoriesModal } from "./registry-modals";

type NewKind = "receita" | "despesa" | "transferencia";
interface FinanceCtx {
  base: FinBase;
  canEdit: boolean;
  openNew: (kind: NewKind, preset?: { subtype?: "fixa" | "variavel" | "imposto" | "pessoa"; due_date?: string }) => void;
  openEdit: (tx: TxView) => void;
  openAccounts: () => void;
  openCategories: () => void;
}
const Ctx = createContext<FinanceCtx | null>(null);

export function useFinance() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFinance fora do Financeiro");
  return c;
}

// áreas identificadas na referência que ainda não têm regras levantadas
const PENDING = ["Agenda", "Cartões", "Conciliação", "Relatórios", "Cobranças", "Folha da equipe"];
const PENDING_REG = ["Contatos", "Integrações"];

export function FinanceShell({ base, canEdit, children }: { base: FinBase; canEdit: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const [modal, setModal] = useState<
    | { type: "new"; kind: NewKind; preset?: { subtype?: "fixa" | "variavel" | "imposto" | "pessoa"; due_date?: string } }
    | { type: "edit"; tx: TxView }
    | { type: "accounts" }
    | { type: "categories" }
    | null
  >(null);

  const value: FinanceCtx = {
    base,
    canEdit,
    openNew: (kind, preset) => setModal({ type: "new", kind, preset }),
    openEdit: (tx) => setModal({ type: "edit", tx }),
    openAccounts: () => setModal({ type: "accounts" }),
    openCategories: () => setModal({ type: "categories" }),
  };
  const tabs = [
    { href: "/financeiro", label: "Visão geral", icon: LayoutGrid, active: path === "/financeiro" },
    { href: "/financeiro/lancamentos", label: "Lançamentos", icon: LayoutList, active: path.startsWith("/financeiro/lancamentos") },
  ];

  return (
    <Ctx.Provider value={value}>
      <PageHeader
        title="Financeiro"
        icon={Wallet}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => value.openNew("receita")} className="text-success">
                <Plus /> Recebimento
              </Button>
              <Button variant="secondary" onClick={() => value.openNew("despesa")} className="text-danger">
                <Minus /> Despesa
              </Button>
            </>
          )
        }
      >
        <nav aria-label="Seções do Financeiro" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium whitespace-nowrap", t.active ? "bg-brand text-brand-ink" : "text-muted hover:text-ink")}
            >
              <t.icon className="size-3.5" aria-hidden /> {t.label}
            </Link>
          ))}
          <Menu>
            <MenuTrigger asChild>
              <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-xs font-medium whitespace-nowrap text-muted hover:text-ink">
                Mais áreas <ChevronDown className="size-3.5" aria-hidden />
              </button>
            </MenuTrigger>
            <MenuContent align="start" className="w-64">
              <MenuLabel>Financeiro</MenuLabel>
              <MenuItem asChild>
                <Link href="/financeiro/lancamentos?status=aberto">A pagar e receber</Link>
              </MenuItem>
              <MenuItem onSelect={value.openAccounts}>Contas</MenuItem>
              {PENDING.map((p) => (
                <MenuItem key={p} disabled>
                  <span className="flex w-full justify-between gap-2">
                    {p} <span className="text-[10px] text-muted-2">em levantamento</span>
                  </span>
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuLabel>Cadastros</MenuLabel>
              <MenuItem onSelect={value.openCategories}>Categorias e metas</MenuItem>
              {PENDING_REG.map((p) => (
                <MenuItem key={p} disabled>
                  <span className="flex w-full justify-between gap-2">
                    {p} <span className="text-[10px] text-muted-2">em levantamento</span>
                  </span>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </nav>
      </PageHeader>

      {children}

      {modal?.type === "new" && <TransactionModal tx={null} kind={modal.kind} preset={modal.preset} onClose={() => setModal(null)} />}
      {modal?.type === "edit" && <TransactionModal tx={modal.tx} kind={modal.tx.kind} onClose={() => setModal(null)} />}
      {modal?.type === "accounts" && <AccountsModal onClose={() => setModal(null)} />}
      {modal?.type === "categories" && <CategoriesModal onClose={() => setModal(null)} />}
    </Ctx.Provider>
  );
}
