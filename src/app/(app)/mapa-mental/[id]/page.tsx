import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { memberCan, requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseCanvas } from "@/features/canvas/schemas";
import { MapEditor } from "./map-editor";

export const metadata: Metadata = { title: "Mapa Mental" };

export default async function MapaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember();
  if (!memberCan(ctx, "mapa-mental") || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("mind_maps")
    .select("id, title, client_id, nodes, edges")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();
  const { data: client } = await supabase.from("clients").select("name").eq("id", m.client_id).maybeSingle();
  return (
    <MapEditor
      id={m.id}
      title={m.title}
      clientName={client?.name ?? null}
      canvas={parseCanvas(m.nodes, m.edges)}
      canEdit={memberCan(ctx, "mapa-mental", "editar")}
    />
  );
}
