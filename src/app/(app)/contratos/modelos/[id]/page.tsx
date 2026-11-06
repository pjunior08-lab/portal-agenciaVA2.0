import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { memberCan, requireMember } from "@/lib/auth/session";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Modelo de contrato" };

export default async function ContractTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember();
  if (!memberCan(ctx, "contratos", "editar")) redirect("/contratos?aba=modelos");
  if (id === "novo") {
    return (
      <TemplateEditor
        templateId={null}
        initial={{ name: "", description: "", body_html: "", header_text: "", footer_text: "", watermark: "", is_default: false }}
      />
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: t } = await supabase.from("contract_templates").select("*").eq("id", id).eq("agency_id", ctx.agency.id).maybeSingle();
  if (!t) notFound();
  return (
    <TemplateEditor
      templateId={t.id}
      initial={{
        name: t.name,
        description: t.description,
        body_html: t.body_html,
        header_text: t.header_text,
        footer_text: t.footer_text,
        watermark: t.watermark,
        is_default: t.is_default,
      }}
    />
  );
}
