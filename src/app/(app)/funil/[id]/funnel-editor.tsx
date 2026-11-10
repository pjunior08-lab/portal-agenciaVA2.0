"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, FlowEditor } from "@/components/ui";
import type { CanvasData } from "@/features/canvas/schemas";
import { saveFunnelCanvas } from "@/features/funil/actions";

export function FunnelEditor({
  id,
  name,
  subtitle,
  canvas,
  canEdit,
  trashed,
}: {
  id: string;
  name: string;
  subtitle: string | null;
  canvas: CanvasData;
  canEdit: boolean;
  trashed: boolean;
}) {
  return (
    <div className="h-[calc(100dvh-8rem)] min-h-[420px] overflow-hidden rounded-card lg:h-[calc(100dvh-4rem)]">
      <FlowEditor
        variant="funil"
        initial={canvas}
        readOnly={!canEdit}
        onSave={(d) => saveFunnelCanvas(id, d)}
        header={
          <div className="flex min-w-0 items-center gap-2 pr-2">
            <Link
              href="/funil"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-2"
              aria-label="Voltar para os funis"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{name}</h1>
              {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}
            </div>
            {trashed && <Badge tone="danger">Na lixeira</Badge>}
          </div>
        }
      />
    </div>
  );
}
