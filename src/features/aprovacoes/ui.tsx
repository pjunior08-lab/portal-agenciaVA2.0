import { Badge } from "@/components/ui";
import type { ApprovalDecisionT, ApprovalStatusT } from "@/lib/supabase/database.types";
import { STATUS } from "./schemas";

export function ApprovalStatusBadge({ status }: { status: ApprovalStatusT }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const DECISION_TONE: Record<ApprovalDecisionT, "success-soft" | "neutral" | "danger"> = {
  aprovado: "success-soft",
  alteracoes: "neutral",
  reprovado: "danger",
};
const DECISION_LABEL: Record<ApprovalDecisionT, string> = { aprovado: "Aprovado", alteracoes: "Alterações", reprovado: "Reprovado" };

export function DecisionBadge({ decision }: { decision: ApprovalDecisionT | null }) {
  if (!decision) return <Badge>Aguardando</Badge>;
  return <Badge tone={DECISION_TONE[decision]}>{DECISION_LABEL[decision]}</Badge>;
}

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export const formatDateTime = (iso: string) => dt.format(new Date(iso));
