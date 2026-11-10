import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseCanvas } from "@/features/canvas/schemas";
import { FunnelEditor } from "./funnel-editor";

export const metadata: Metadata = { title: "Funil" };

export default async function FunilEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember();
  if (!memberCan(ctx, "funil") || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: f } = await supabase
    .from("funnels")
    .select("id, name, client_id, folder_id, nodes, edges, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!f) notFound();
  const [client, folder] = await Promise.all([
    f.client_id
      ? supabase.from("clients").select("name").eq("id", f.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    f.folder_id
      ? supabase.from("funnel_folders").select("name").eq("id", f.folder_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return (
    <FunnelEditor
      id={f.id}
      name={f.name}
      subtitle={[folder.data?.name, client.data?.name].filter(Boolean).join(" · ") || null}
      canvas={parseCanvas(f.nodes, f.edges)}
      canEdit={memberCan(ctx, "funil", "editar") && !f.deleted_at}
      trashed={!!f.deleted_at}
    />
  );
}
