"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Download, Eye, EyeOff, FileText, Trash2, Upload } from "lucide-react";
import { Alert, Badge, Button, EmptyState, SectionCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteFile, registerFile, setFileShared } from "@/features/clientes/actions";
import { MAX_FILE_BYTES, safeFileName } from "@/features/clientes/schemas";
import { formatBytes } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  shared: boolean;
  createdAt: string;
  url: string | null;
}

const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function FilesPanel({
  clientId,
  agencyId,
  files,
  canEdit,
}: {
  clientId: string;
  agencyId: string;
  files: FileItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [pending, start] = useTransition();

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    const supabase = createClient();
    const all = Array.from(list);
    for (const [i, file] of all.entries()) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" passa de 50 MB e não foi enviado.`);
        continue;
      }
      setProgress(`Enviando ${i + 1} de ${all.length}: ${file.name}`);
      const path = `${agencyId}/${clientId}/arquivos/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("clientes").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`Não foi possível enviar "${file.name}".`);
        continue;
      }
      const res = await registerFile({ clientId, path, name: file.name.slice(0, 255), size: file.size, mime: file.type || null });
      if (!res.ok) setError(res.error);
    }
    setProgress("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError("");
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Não foi possível salvar.");
    });
  };

  return (
    <SectionCard
      title="Arquivos"
      icon={FileText}
      description="Contratos, briefings, logos e materiais. Até 50 MB por arquivo."
      action={
        canEdit && (
          <>
            <input ref={input} type="file" multiple className="sr-only" id="enviar-arquivos" onChange={(e) => upload(e.target.files)} />
            <Button size="sm" onClick={() => input.current?.click()} loading={!!progress}>
              <Upload /> Enviar arquivos
            </Button>
          </>
        )
      }
    >
      {error && <Alert className="mb-3">{error}</Alert>}
      {progress && (
        <Alert tone="info" className="mb-3">
          {progress}
        </Alert>
      )}
      {files.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum arquivo ainda" />
      ) : (
        <ul className="flex flex-col divide-y divide-line" aria-busy={pending}>
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{f.name}</p>
                <p className="text-[11px] text-muted">
                  {formatBytes(f.size)} · {when.format(new Date(f.createdAt))}
                </p>
              </div>
              {f.shared ? <Badge tone="info">Visível no portal</Badge> : <Badge>Só equipe</Badge>}
              {f.url && (
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2" aria-label={`Baixar ${f.name}`}>
                  <Download className="size-4" />
                </a>
              )}
              {canEdit && (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={f.shared ? "Esconder do cliente" : "Mostrar ao cliente"}
                    title={f.shared ? "Esconder do cliente" : "Mostrar ao cliente"}
                    disabled={pending}
                    onClick={() => run(() => setFileShared(f.id, clientId, !f.shared))}
                  >
                    {f.shared ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Excluir ${f.name}`}
                    disabled={pending}
                    onClick={() => run(() => deleteFile(f.id, clientId))}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
