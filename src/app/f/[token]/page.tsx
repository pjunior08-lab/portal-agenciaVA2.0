import type { Metadata } from "next";
import Image from "next/image";
import { LinkIcon } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { FormFieldKey } from "@/features/comercial/automations";
import { PublicForm } from "./public-form";

export const metadata: Metadata = { title: "Fale com a gente", robots: { index: false, follow: false } };

interface PublicFormData {
  title: string;
  description: string | null;
  fields: { key: FormFieldKey; required: boolean }[];
  success_message: string | null;
  agency: string;
}

/** Formulário público de captura de leads (sem login). */
export default async function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("crm_form_public", { form_token: token });
  const f = data as PublicFormData | null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      {!f ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            icon={LinkIcon}
            title="Formulário indisponível"
            description="Este link foi desativado ou não existe."
          />
        </div>
      ) : (
        <article className="rounded-card bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <Image
              src="/brand/simbolo-amarelo.png"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-xl"
            />
            <p className="text-sm font-medium">{f.agency}</p>
          </div>
          <h1 className="text-2xl font-normal tracking-tight">{f.title}</h1>
          {f.description && <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{f.description}</p>}
          <PublicForm token={token} fields={f.fields ?? []} successMessage={f.success_message} />
        </article>
      )}
    </div>
  );
}
