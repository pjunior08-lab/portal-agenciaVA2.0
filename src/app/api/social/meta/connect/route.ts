import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMemberContext, memberCan } from "@/lib/auth/session";
import { siteUrl } from "@/lib/request";
import { metaConfigured, oauthUrl } from "@/features/social/meta/graph";

/**
 * Começa a conexão com a Meta: manda a pessoa para a tela oficial de autorização.
 * Com ?cliente=<id>, a conexão é feita a partir do perfil do cliente e as contas só podem ir para ele.
 */
export async function GET(req: NextRequest) {
  const site = await siteUrl();
  const clientParam = req.nextUrl.searchParams.get("cliente");
  const clientId = clientParam && /^[0-9a-f-]{36}$/i.test(clientParam) ? clientParam : null;
  const home = clientId ? `${site}/clientes/${clientId}?aba=redes&` : `${site}/social?`;
  const ctx = await getMemberContext();
  if (!ctx) return NextResponse.redirect(`${site}/login?next=/social`);
  if (!memberCan(ctx, "social", "editar")) return NextResponse.redirect(`${home}meta=sem-permissao`);
  if (!metaConfigured()) return NextResponse.redirect(`${home}meta=nao-configurado`);
  if (clientId) {
    // o cliente precisa ser desta agência (a leitura passa pelas regras de acesso do banco)
    const supabase = await createClient();
    const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("agency_id", ctx.agency.id).maybeSingle();
    if (!data) return NextResponse.redirect(`${site}/social?meta=erro`);
  }
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(oauthUrl(state, `${site}/api/social/meta/callback`));
  const cookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/api/social/meta", maxAge: 600 };
  // confere na volta que a resposta é desta conexão
  res.cookies.set("meta_oauth_state", state, cookie);
  if (clientId) res.cookies.set("meta_oauth_client", clientId, cookie);
  else res.cookies.delete({ name: "meta_oauth_client", path: "/api/social/meta" });
  return res;
}
