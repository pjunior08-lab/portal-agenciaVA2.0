import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Cog,
  FileSignature,
  FileText,
  Filter,
  FolderOpen,
  Home,
  KanbanSquare,
  ListChecks,
  MessageCircle,
  Network,
  NotebookPen,
  Rocket,
  Share2,
  Sparkles,
  Sun,
  Tags,
  Target,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "operacao" | "gestao" | "mais";

export interface ModuleDef {
  slug: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Fase do plano em que o módulo é entregue. */
  phase: number;
  /** "confirmado" = telas levantadas; "a-levantar" = só o nome no menu da referência. */
  status: "confirmado" | "a-levantar";
  summary: string;
  features: string[];
}

export const MODULES: ModuleDef[] = [
  {
    slug: "inicio",
    label: "Início",
    icon: Home,
    group: "operacao",
    phase: 8,
    status: "confirmado",
    summary: "Painel geral da agência com indicadores de todos os módulos.",
    features: [
      "Primeiros passos da agência",
      "Indicadores: clientes, equipe, demandas, aprovações, propostas, contratos, resultado e horas",
      "Cards de financeiro, demandas, desempenho, comercial, clientes e prazos",
      "Saúde da carteira de clientes",
    ],
  },
  {
    slug: "meu-dia",
    label: "Meu Dia",
    icon: Sun,
    group: "operacao",
    phase: 3,
    status: "confirmado",
    summary: "O que o usuário logado precisa fazer hoje.",
    features: [
      "Tarefas de hoje e dos próximos 7 dias",
      "Filtros por data, prioridade e cliente",
      "Resumo de agenda, checklist e aprovações",
    ],
  },
  {
    slug: "maestro",
    label: "Assistente IA",
    icon: Sparkles,
    group: "operacao",
    phase: 9,
    status: "a-levantar",
    summary: "Assistente de IA da agência. Telas ainda precisam ser levantadas.",
    features: [],
  },
  {
    slug: "agenda",
    label: "Agenda",
    icon: CalendarDays,
    group: "operacao",
    phase: 3,
    status: "confirmado",
    summary: "Calendário pessoal e da agência.",
    features: [
      "Visões mês, semana, dia e lista",
      "Minha agenda e agenda da agência",
      "Nova atividade e disponibilidade",
      "Datas comemorativas",
    ],
  },
  {
    slug: "demandas",
    label: "Demandas",
    icon: KanbanSquare,
    group: "operacao",
    phase: 3,
    status: "confirmado",
    summary: "Quadros de demandas da equipe.",
    features: [
      "Quadros e colunas personalizáveis",
      "Visões quadro, lista, calendário, Gantt e arquivadas",
      "Filtros por cliente, prioridade, responsável e tipo",
      "Nova demanda com descrição, legenda, anexos e datas",
    ],
  },
  {
    slug: "aprovacoes",
    label: "Aprovação",
    icon: CheckCircle2,
    group: "operacao",
    phase: 4,
    status: "confirmado",
    summary: "Envio de posts e demandas para o cliente aprovar.",
    features: [
      "Aprovação rápida ou detalhada (tema, mídias e legenda)",
      "Histórico de aprovação",
      "Visões grade, quadro, feed, lista, calendário e Gantt",
    ],
  },
  {
    slug: "social",
    label: "Social",
    icon: Share2,
    group: "operacao",
    phase: 4,
    status: "confirmado",
    summary: "Agendamentos, métricas e contas de redes sociais dos clientes.",
    features: [
      "Calendário de agendamentos",
      "Cadastro das contas de cada cliente",
      "Conexão oficial, publicação automática e métricas na Fase 9",
    ],
  },
  {
    slug: "clientes",
    label: "Clientes",
    icon: Users,
    group: "operacao",
    phase: 2,
    status: "confirmado",
    summary: "Carteira de clientes, ficha completa e Portal do Cliente.",
    features: [
      "Cadastro com identidade visual, contato e cobrança",
      "Ficha com visão geral e abas",
      "Central Estratégica compartilhável",
      "Acesso ao Portal do Cliente por convite",
    ],
  },
  {
    slug: "propostas",
    label: "Propostas",
    icon: FileText,
    group: "gestao",
    phase: 5,
    status: "confirmado",
    summary: "Propostas comerciais com itens, valores e condições.",
    features: [
      "Indicadores de propostas",
      "Modelos próprios",
      "Itens, investimento, condições de pagamento e observações",
      "Link do cliente com aceite ou recusa",
    ],
  },
  {
    slug: "contratos",
    label: "Contratos",
    icon: FileSignature,
    group: "gestao",
    phase: 5,
    status: "confirmado",
    summary: "Contratos a partir de modelos, com assinatura eletrônica.",
    features: [
      "Modelos com variáveis, cabeçalho, rodapé e marca d'água",
      "Pré-visualização do contrato digital",
      "Assinatura eletrônica das duas partes pelo link (cliente) e no sistema (administrador)",
    ],
  },
  {
    slug: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    group: "gestao",
    phase: 6,
    status: "confirmado",
    summary: "Receitas, despesas, contas e visão geral do caixa.",
    features: [
      "Visão geral com saldo, resultado, fluxo de caixa e metas",
      "Lançamentos por mês e por tipo",
      "Recorrência e mensalidades dos clientes",
      "Contas, categorias e metas mensais",
      "Faturas do cliente no portal",
    ],
  },
  {
    slug: "plano-de-midia",
    label: "Plano de Mídia",
    icon: Megaphone,
    group: "gestao",
    phase: 9,
    status: "a-levantar",
    summary: "Telas ainda precisam ser levantadas.",
    features: [],
  },
  {
    slug: "mapa-mental",
    label: "Mapa Mental",
    icon: Network,
    group: "gestao",
    phase: 8,
    status: "confirmado",
    summary: "Mapas mentais por cliente a partir de modelos.",
    features: ["Mapas por cliente com salvamento automático", "Modelos: em branco, planejamento de campanha, briefing de cliente, pilares de conteúdo"],
  },
  {
    slug: "funil",
    label: "Funil",
    icon: Filter,
    group: "gestao",
    phase: 8,
    status: "confirmado",
    summary: "Desenho de funis de venda e marketing.",
    features: ["Editor de etapas e ligações com salvamento automático", "Pastas e lixeira", "Modelos de funil"],
  },
  {
    slug: "comercial",
    label: "Comercial",
    icon: Target,
    group: "gestao",
    phase: 7,
    status: "confirmado",
    summary: "CRM: funil de vendas, relatórios e automações.",
    features: [
      "Funil com arrastar e soltar, meta e resumo do mês",
      "Lista, visão Hoje e ficha com histórico de contatos e etapas",
      "Relatórios de conversão com CSV e PDF",
      "Importação CSV/XLSX, campos personalizados, modelos de mensagem e cadência",
      "Automações: regras, execuções e distribuição em rodízio",
      "Integrações: formulários públicos, API de entrada, webhooks e leads da Meta via Make",
    ],
  },
  {
    slug: "comunicacao",
    label: "Comunicação",
    icon: MessageCircle,
    group: "gestao",
    phase: 8,
    status: "confirmado",
    summary: "Chat interno e chat com clientes.",
    features: ["Conversas diretas e grupos com mensagens em tempo real e não lidas", "Chat com clientes pela seção Mensagens do Portal"],
  },
  {
    slug: "configuracoes",
    label: "Configurações",
    icon: Cog,
    group: "gestao",
    phase: 1,
    status: "confirmado",
    summary: "Perfil, agência, equipe, permissões e segurança.",
    features: [
      "Seus dados e dados da empresa",
      "Equipe: administradores e colaboradores com acessos concedidos",
      "Verificação em duas etapas e sessões",
      "Menu lateral personalizável",
    ],
  },
  // Mais áreas — só o nome existe na referência; telas a levantar.
  ...(
    [
      ["projetos", "Projetos", Briefcase],
      ["servicos", "Tabela de Serviços", Tags],
      ["squads", "Squads", UsersRound],
      ["onboarding", "Onboarding", Rocket],
      ["desempenho", "Desempenho", BarChart3],
      ["notas", "Notas", NotebookPen],
      ["checklist", "Checklist", ListChecks],
      ["timesheet", "Timesheet", Clock],
      ["drive", "Drive", FolderOpen],
      ["ferramentas", "Ferramentas", Wrench],
    ] as const
  ).map(
    ([slug, label, icon]): ModuleDef => ({
      slug,
      label,
      icon,
      group: "mais",
      phase: 9,
      status: "a-levantar",
      summary: "Telas ainda precisam ser levantadas.",
      features: [],
    }),
  ),
];

export const GROUP_LABELS: Record<NavGroup, string> = {
  operacao: "Operação",
  gestao: "Gestão e vendas",
  mais: "Mais áreas",
};

export function getModule(slug: string) {
  return MODULES.find((m) => m.slug === slug);
}
