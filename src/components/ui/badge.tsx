import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-3 text-muted",
        brand: "bg-brand-soft text-ink",
        success: "bg-success text-white",
        "success-soft": "bg-success-soft text-success",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        dark: "bg-panel text-panel-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Prioridades usadas em demandas e posts. */
export const PRIORITY = {
  alta: { label: "Alta", dot: "bg-danger" },
  media: { label: "Média", dot: "bg-warning" },
  baixa: { label: "Baixa", dot: "bg-success" },
} as const;

export function PriorityBadge({ priority }: { priority: keyof typeof PRIORITY | null }) {
  if (!priority) return <Badge>Sem prioridade</Badge>;
  const p = PRIORITY[priority];
  return (
    <Badge>
      <span className={cn("size-2 rounded-full", p.dot)} aria-hidden />
      {p.label}
    </Badge>
  );
}
