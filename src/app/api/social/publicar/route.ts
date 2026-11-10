import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import { decryptToken } from "@/features/social/meta/crypto";
import { metaConfigured, publishFacebook, publishInstagram, type PublishResult } from "@/features/social/meta/graph";
import { planPublication, type MediaRef } from "@/features/social/meta/plan";

// chamada pelo agendador do banco a cada 5 minutos
export const maxDuration = 26;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(req: NextRequest) {
  const secret = process.env.SOCIAL_CRON_SECRET ?? "";
  const got = req.headers.get("x-cron-secret") ?? "";
  if (secret.length < 32 || !same(got, secret)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!metaConfigured()) return NextResponse.json({ ok: false, erro: "Meta não configurada" }, { status: 503 });

  const env = requireSupabaseEnv();
  // sem sessão: as funções do banco conferem o mesmo segredo
  const supabase = createClient<Database>(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: due, error } = await supabase.rpc("social_claim", { secret });
  if (error) return NextResponse.json({ ok: false, erro: "claim" }, { status: 500 });

  const results: { id: string; outcome: string }[] = [];
  for (const p of due ?? []) {
    let r: PublishResult;
    if (!p.account_id || !p.token_encrypted || !p.external_id) {
      r = { outcome: "definitivo", error: `Cliente sem conta do ${p.network === "instagram" ? "Instagram" : "Facebook"} conectada. Conecte em Social › Contas e mande de novo.` };
    } else {
      try {
        const token = decryptToken(p.token_encrypted);
        const media = (Array.isArray(p.media) ? p.media : []) as unknown as MediaRef[];
        const plan = planPublication(p.network, media, p.caption);
        let urls: string[] = [];
        if (plan.ok && plan.items.length && !p.container_id) {
          const signed = await supabase.storage.from("aprovacoes").createSignedUrls(plan.items.map((m) => m.path), 3600);
          urls = (signed.data ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u);
          if (urls.length !== plan.items.length) throw new Error("Não foi possível preparar as mídias para a Meta.");
        }
        r =
          p.network === "instagram"
            ? await publishInstagram(p.external_id, token, plan, p.caption, urls, p.container_id)
            : await publishFacebook(p.page_id ?? p.external_id, token, plan, p.caption, urls);
      } catch (e) {
        r = { outcome: "erro", error: e instanceof Error ? e.message : "Falha inesperada." };
      }
    }
    await supabase.rpc("social_report", {
      secret,
      pub: p.id,
      outcome: r.outcome,
      container: r.outcome === "processando" ? r.container : null,
      media_id: r.outcome === "publicado" ? r.mediaId : null,
      link: r.outcome === "publicado" ? r.link : null,
      error: r.outcome === "erro" || r.outcome === "definitivo" ? r.error : null,
    });
    results.push({ id: p.id, outcome: r.outcome });
  }
  return NextResponse.json({ ok: true, processadas: results.length, results }, { headers: { "Cache-Control": "no-store" } });
}
