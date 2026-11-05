import {
  Briefcase,
  Building2,
  Car,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Home,
  PawPrint,
  Scissors,
  Shirt,
  Sparkles,
  Store,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Ícones de segmento disponíveis no cadastro do cliente. */
export const SEGMENT_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  loja: { label: "Loja / varejo", icon: Store },
  alimentacao: { label: "Alimentação", icon: Utensils },
  moda: { label: "Moda", icon: Shirt },
  saude: { label: "Saúde", icon: HeartPulse },
  educacao: { label: "Educação", icon: GraduationCap },
  empresa: { label: "Empresa / serviços", icon: Briefcase },
  imobiliaria: { label: "Imóveis", icon: Home },
  industria: { label: "Indústria", icon: Building2 },
  automotivo: { label: "Automotivo", icon: Car },
  fitness: { label: "Fitness", icon: Dumbbell },
  beleza: { label: "Beleza", icon: Scissors },
  pet: { label: "Pet", icon: PawPrint },
  outro: { label: "Outro", icon: Sparkles },
};

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Logo do cliente (claro/escuro conforme o tema) ou iniciais sobre a cor de capa. */
export function ClientAvatar({
  name,
  color,
  lightUrl,
  darkUrl,
  size = "md",
  className,
}: {
  name: string;
  color?: string | null;
  lightUrl?: string | null;
  darkUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = { sm: "size-8 text-[11px]", md: "size-12 text-sm", lg: "size-16 text-lg" }[size];
  const light = lightUrl ?? darkUrl;
  const dark = darkUrl ?? lightUrl;
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-semibold", box, className)}
      style={{ background: light ? "var(--surface)" : (color ?? "var(--panel)"), color: "#fff" }}
    >
      {light ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- links temporários do Storage */}
          <img src={light} alt={`Logo de ${name}`} className="size-full object-contain p-1 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dark!} alt={`Logo de ${name}`} className="hidden size-full object-contain p-1 dark:block" />
        </>
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  );
}
