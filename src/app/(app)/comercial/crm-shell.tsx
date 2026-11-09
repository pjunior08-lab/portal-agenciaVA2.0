"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { BarChart3, CalendarCheck, Columns3, List, Plus, Settings2, Target, Upload } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CrmStageT } from "@/lib/supabase/database.types";
import type { CrmBase, OppView } from "@/features/comercial/data";
import { OpportunityModal } from "./opportunity-modal";

interface CrmCtx {
  base: CrmBase;
  canEdit: boolean;
  userId: string;
  today: string;
  personName: (id: string | null) => string;
  openOpp: (o: OppView) => void;
  openNew: (stage?: CrmStageT) => void;
}
const Ctx = createContext<CrmCtx | null>(null);

export function useCrm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCrm fora do Comercial");
  return c;
}

// abas da referência que entram na Fase 7B
const NEXT_PHASE = ["Automações", "Integrações"];

export function CrmShell({
  base,
  canEdit,
  userId,
  today,
  children,
}: {
  base: CrmBase;
  canEdit: boolean;
  userId: string;
  today: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [modal, setModal] = useState<{ id: string | null; stage?: CrmStageT } | null>(null);
  const names = useMemo(() => new Map(base.people.map((p) => [p.id, p.name])), [base.people]);

  const value: CrmCtx = {
    base,
    canEdit,
    userId,
    today,
    personName: (id) => (id ? (names.get(id) ?? "Ex-membro") : "Sem responsável"),
    openOpp: (o) => setModal({ id: o.id }),
    openNew: (stage) => setModal({ id: null, stage }),
  };
  // a ficha aberta acompanha os dados novos do servidor
  const current = modal?.id ? (base.opps.find((o) => o.id === modal.id) ?? null) : null;

  const tabs = [
    { href: "/comercial", label: "Funil", icon: Columns3, active: path === "/comercial" },
    { href: "/comercial/lista", label: "Lista", icon: List, active: path.startsWith("/comercial/lista") },
    {
      href: "/comercial/hoje",
      label: "Hoje",
      icon: CalendarCheck,
      active: path.startsWith("/comercial/hoje"),
    },
    {
      href: "/comercial/relatorios",
      label: "Relatórios",
      icon: BarChart3,
      active: path.startsWith("/comercial/relatorios"),
    },
    ...(canEdit
      ? [
          {
            href: "/comercial/importar",
            label: "Importar",
            icon: Upload,
            active: path.startsWith("/comercial/importar"),
          },
        ]
      : []),
    {
      href: "/comercial/configuracoes",
      label: "Configurações",
      icon: Settings2,
      active: path.startsWith("/comercial/configuracoes"),
    },
  ];

  return (
    <Ctx.Provider value={value}>
      <div className="print:hidden">
        <PageHeader
          title="Comercial"
          icon={Target}
          actions={
            canEdit && (
              <Button onClick={() => value.openNew()}>
                <Plus /> Nova oportunidade
              </Button>
            )
          }
        >
          <nav
            aria-label="Seções do Comercial"
            className="flex max-w-[calc(100vw-2rem)] gap-1 lg:max-w-[calc(100vw-20rem)] overflow-x-auto rounded-full bg-surface p-1"
          >
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium whitespace-nowrap",
                  t.active ? "bg-brand text-brand-ink" : "text-muted hover:text-ink",
                )}
              >
                <t.icon className="size-3.5" aria-hidden /> {t.label}
              </Link>
            ))}
            {NEXT_PHASE.map((t) => (
              <span
                key={t}
                className="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-full px-3.5 text-xs whitespace-nowrap text-muted-2"
                title="Chega na próxima etapa (7B)"
              >
                {t} <span className="text-[10px]">em breve</span>
              </span>
            ))}
          </nav>
        </PageHeader>
      </div>

      {children}

      {modal && (modal.id === null || current) && (
        <OpportunityModal
          key={modal.id ?? "nova"}
          opp={current}
          stage={modal.stage}
          onClose={() => setModal(null)}
        />
      )}
    </Ctx.Provider>
  );
}
