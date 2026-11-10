"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FlowEditor } from "@/components/ui";
import type { CanvasData } from "@/features/canvas/schemas";
import { saveMapCanvas } from "@/features/mapa-mental/actions";

export function MapEditor({
  id,
  title,
  clientName,
  canvas,
  canEdit,
}: {
  id: string;
  title: string;
  clientName: string | null;
  canvas: CanvasData;
  canEdit: boolean;
}) {
  return (
    <div className="h-[calc(100dvh-8rem)] min-h-[420px] overflow-hidden rounded-card lg:h-[calc(100dvh-4rem)]">
      <FlowEditor
        variant="mapa"
        initial={canvas}
        readOnly={!canEdit}
        onSave={(d) => saveMapCanvas(id, d)}
        header={
          <div className="flex min-w-0 items-center gap-2 pr-2">
            <Link
              href="/mapa-mental"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-2"
              aria-label="Voltar para os mapas"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{title}</h1>
              {clientName && <p className="truncate text-[11px] text-muted">{clientName}</p>}
            </div>
          </div>
        }
      />
    </div>
  );
}
