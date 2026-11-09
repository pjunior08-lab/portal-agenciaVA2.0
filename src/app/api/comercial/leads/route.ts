import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

// Entrada de leads por API (Make, Zapier, n8n, site próprio…). A chave é conferida no banco.
const MAX_BYTES = 32 * 1024;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, erro: error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const key = (
    auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : (req.headers.get("x-api-key") ?? "")
  ).trim();
  if (!key) return fail(401, "Envie a chave no cabeçalho Authorization: Bearer <chave>.");
  if (!(req.headers.get("content-type") ?? "").includes("application/json"))
    return fail(415, "Envie o corpo em JSON (Content-Type: application/json).");

  const text = await req.text();
  if (text.length > MAX_BYTES) return fail(413, "Corpo grande demais (máximo 32 KB).");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return fail(400, "JSON inválido.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return fail(400, "Envie um objeto JSON com os dados do lead.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_api_create_lead", {
    api_key: key,
    payload: payload as Json,
  });
  if (error) {
    if (error.code === "28000") return fail(401, error.message);
    if (error.code === "54000") return fail(429, error.message);
    if (error.code === "22023") return fail(422, error.message);
    return fail(500, "Erro ao gravar o lead. Tente de novo.");
  }
  const r = data as { id: string; criado: boolean };
  return NextResponse.json(
    { ok: true, id: r.id, criado: r.criado },
    { status: r.criado ? 201 : 200, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  return fail(405, "Use POST.");
}
