"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Alert, Button, Input, Modal } from "@/components/ui";
import type { ClientRow } from "@/lib/supabase/database.types";
import { ClientFormModal } from "@/features/clientes/client-form";
import { deleteClientAction } from "@/features/clientes/actions";

export function ClientActions({
  client,
  logoUrls,
  isAdmin,
}: {
  client: ClientRow;
  logoUrls: { light: string | null; dark: string | null };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <Pencil /> Editar
      </Button>
      {isAdmin && (
        <Button variant="danger-outline" size="sm" onClick={() => setDeleting(true)}>
          <Trash2 /> Excluir
        </Button>
      )}
      <ClientFormModal open={editing} onOpenChange={setEditing} client={client} logoUrls={logoUrls} />
      <Modal
        open={deleting}
        onOpenChange={(v) => {
          setDeleting(v);
          setConfirm("");
          setError("");
        }}
        title="Excluir"
        accent="cliente"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={confirm.trim() !== client.name}
              onClick={() =>
                start(async () => {
                  const res = await deleteClientAction(client.id);
                  if (!res.ok) return setError(res.error);
                  router.replace("/clientes");
                })
              }
            >
              Excluir para sempre
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          {error && <Alert>{error}</Alert>}
          <p>
            Isso apaga <strong>{client.name}</strong> com anotações, arquivos, Central Estratégica e acessos ao portal. Não dá para desfazer.
          </p>
          <p className="text-xs text-muted">Prefere guardar o histórico? Mude o status para &quot;Arquivado&quot;.</p>
          <label htmlFor="confirm-delete" className="text-xs text-muted">
            Digite o nome do cliente para confirmar
          </label>
          <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </div>
  );
}
