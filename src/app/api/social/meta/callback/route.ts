import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getMemberContext, memberCan } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/request";
import type { Json } from "@/lib/supabase/database.types";
import { encryptToken } from "@/features/social/meta/crypto";
import { listAccounts, metaConfigured, userTokenFromCode } from "@/features/social/meta/graph";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Volta da Meta: troca o código pela chave, lista Páginas e Instagrams e guarda para a pessoa escolher o cliente de cada um. */
export async function GET(req: NextRequest) {
  const site = await siteUrl();
  const back = (q: string) => {
    const res = NextResponse.redirect(`${site}/social?${q}`);
    res.cookies.delete({ name: "meta_oauth_state", path: "/api/social/meta" });
    return res;
  };
  const ctx = await getMemberContext();
  if (!ctx) return NextResponse.redirect(`${site}/login?next=/social`);
  if (!memberCan(ctx, "social", "editar") || !metaConfigured()) return back("meta=sem-permissao");

  const p = req.nextUrl.searchParams;
  if (p.get("error")) return back("meta=cancelado");
  const state = p.get("state") ?? "";
  const saved = req.cookies.get("meta_oauth_state")?.value ?? "";
  const code = p.get("code") ?? "";
  if (!state || !saved || !same(state, saved) || !code) return back("meta=erro&motivo=sessao");

  try {
    const userToken = await userTokenFromCode(code, `${site}/api/social/meta/callback`);
    const found = await listAccounts(userToken);
    if (!found.length) return back("meta=sem-contas");
    const items = found.map(({ token, ...a }) => ({ ...a, token_encrypted: encryptToken(token) }));
    const supabase = await createClient();
    const { error } = await supabase.rpc("social_store_pending", { a: ctx.agency.id, items: items as unknown as Json });
    if (error) return back("meta=erro&motivo=banco");
    return back("conectar=1");
  } catch {
    return back("meta=erro&motivo=meta");
  }
}
