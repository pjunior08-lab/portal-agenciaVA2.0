"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/request";
import type { Json } from "@/lib/supabase/database.types";
import { publicSubmissionSchema, type FormFieldKey } from "./automations";

export type PublicFormResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

// envio rápido demais (menos de 2,5 s depois de abrir a página) costuma ser robô
const MIN_FILL_MS = 2500;

/** Envio do formulário público. O banco confere o formulário, os obrigatórios e o limite de envios. */
export async function submitPublicForm(
  token: string,
  input: { values: Record<string, string>; website: string; startedAt: number },
): Promise<PublicFormResult> {
  if (typeof token !== "string" || !/^[a-z0-9-]{6,64}$/i.test(token))
    return { ok: false, error: "Formulário indisponível." };
  // campo invisível preenchido ou envio instantâneo: responde como se tivesse dado certo e não grava
  if (input?.website || !Number.isFinite(input?.startedAt) || Date.now() - input.startedAt < MIN_FILL_MS)
    return { ok: true };

  const supabase = await createClient();
  const { data: form } = await supabase.rpc("crm_form_public", { form_token: token });
  if (!form) return { ok: false, error: "Este formulário não está mais disponível." };
  const fields = ((form as { fields?: { key: FormFieldKey; required: boolean }[] }).fields ?? []).filter(
    (f) => f && typeof f.key === "string",
  );
  const parsed = publicSubmissionSchema(fields).safeParse(input.values ?? {});
  if (!parsed.success)
    return {
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };

  const ip = await clientIp();
  const ipHash = ip ? createHash("sha256").update(`${token}:${ip}`).digest("hex") : null;
  const { error } = await supabase.rpc("crm_form_submit", {
    form_token: token,
    payload: parsed.data as Json,
    ip_hash: ipHash,
  });
  if (error) {
    if (error.code === "54000" || error.code === "22023" || error.code === "P0002")
      return { ok: false, error: error.message };
    return { ok: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };
  }
  return { ok: true };
}
