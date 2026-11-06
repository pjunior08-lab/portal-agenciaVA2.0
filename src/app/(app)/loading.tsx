import { Skeleton } from "@/components/ui";

/** Aparece na hora em que se clica no menu, enquanto o servidor monta a página. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-7 w-48" />
        <span className="flex-1" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-card" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
