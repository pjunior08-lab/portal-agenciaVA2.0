/** Cálculos do painel Início (funções puras, testadas). */

export interface HealthClient {
  id: string;
  name: string;
}
export interface HealthTask {
  client_id: string | null;
  due_date: string | null;
}
export interface HealthPost {
  client_id: string;
  status: string;
  sent_at: string | null;
}
export interface HealthInvoice {
  client_id: string | null;
  due_date: string;
  amount: number;
}

export type HealthStatus = "saudavel" | "atencao" | "critico";
export const HEALTH: Record<HealthStatus, { label: string; tone: "success-soft" | "brand" | "danger" }> = {
  saudavel: { label: "Em dia", tone: "success-soft" },
  atencao: { label: "Atenção", tone: "brand" },
  critico: { label: "Crítico", tone: "danger" },
};

/** Aprovação parada há mais de N dias esperando o cliente. */
export const APPROVAL_STALE_DAYS = 3;

const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000,
  );

/**
 * Saúde de cada cliente ativo a partir de três sinais:
 * demandas atrasadas, aprovações esperando o cliente há mais de 3 dias e mensalidades vencidas.
 * Crítico: mensalidade vencida ou 3+ demandas atrasadas. Atenção: qualquer outro sinal.
 */
export function portfolioHealth(
  clients: HealthClient[],
  tasks: HealthTask[],
  posts: HealthPost[],
  invoices: HealthInvoice[],
  today: string,
) {
  return clients
    .map((c) => {
      const lateTasks = tasks.filter((t) => t.client_id === c.id && t.due_date && t.due_date < today).length;
      const waiting = posts.filter(
        (p) =>
          p.client_id === c.id &&
          ["enviado", "em_analise"].includes(p.status) &&
          p.sent_at &&
          dayDiff(p.sent_at, today) > APPROVAL_STALE_DAYS,
      ).length;
      const overdue = invoices.filter((i) => i.client_id === c.id && i.due_date < today);
      const overdueAmount = Math.round(overdue.reduce((s, i) => s + i.amount, 0) * 100) / 100;
      const status: HealthStatus =
        overdue.length || lateTasks >= 3 ? "critico" : lateTasks || waiting ? "atencao" : "saudavel";
      return { ...c, lateTasks, waiting, overdueCount: overdue.length, overdueAmount, status };
    })
    .sort(
      (a, b) =>
        order(b.status) - order(a.status) ||
        b.lateTasks + b.waiting - (a.lateTasks + a.waiting) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
}
const order = (s: HealthStatus) => (s === "critico" ? 2 : s === "atencao" ? 1 : 0);

export interface Deadline {
  kind: "demanda" | "contrato" | "proposta" | "financeiro" | "comercial";
  title: string;
  date: string;
  href: string;
}

/** Prazos dos próximos dias (inclui os atrasados), em ordem de data. */
export function upcomingDeadlines(items: Deadline[], today: string, days: number, limit = 12) {
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const until = end.toISOString().slice(0, 10);
  return items
    .filter((d) => d.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, limit)
    .map((d) => ({ ...d, late: d.date < today, inDays: dayDiff(today, d.date) }));
}

export interface StepState {
  agencyData: boolean;
  team: boolean;
  client: boolean;
  task: boolean;
  portal: boolean;
}
export const STEPS: {
  key: keyof StepState;
  title: string;
  description: string;
  href: string;
  adminOnly?: boolean;
}[] = [
  {
    key: "agencyData",
    title: "Complete os dados da agência",
    description: "CNPJ, contato e logo aparecem em propostas e contratos.",
    href: "/configuracoes?aba=agencia",
    adminOnly: true,
  },
  {
    key: "team",
    title: "Convide a equipe",
    description: "Chame quem trabalha com você e defina os acessos de cada um.",
    href: "/configuracoes?aba=equipe",
    adminOnly: true,
  },
  {
    key: "client",
    title: "Cadastre o primeiro cliente",
    description: "Clientes ligam demandas, aprovações, contratos e financeiro.",
    href: "/clientes",
  },
  {
    key: "task",
    title: "Crie a primeira demanda",
    description: "Organize o trabalho nos quadros de Demandas.",
    href: "/demandas",
  },
  {
    key: "portal",
    title: "Ative o Portal de um cliente",
    description: "O cliente aprova posts, vê arquivos e conversa com a agência.",
    href: "/clientes",
  },
];

/** Passos que faltam (some quando tudo estiver feito). */
export function pendingSteps(state: StepState, isAdmin: boolean) {
  const visible = STEPS.filter((s) => isAdmin || !s.adminOnly);
  const done = visible.filter((s) => state[s.key]).length;
  return {
    steps: visible.map((s) => ({ ...s, done: state[s.key] })),
    done,
    total: visible.length,
    complete: done === visible.length,
  };
}

/** Saudação conforme a hora em Brasília. */
export function greeting(nowIso: string) {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(nowIso)),
  );
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
