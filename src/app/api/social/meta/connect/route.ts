import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getMemberContext, memberCan } from "@/lib/auth/session";
import { siteUrl } from "@/lib/request";
import { metaConfigured, oauthUrl } from "@/features/social/meta/graph";

/** Começa a conexão com a Meta: manda a pessoa para a tela oficial de autorização. */
export async function GET() {
  const site = await siteUrl();
  const ctx = await getMemberContext();
  if (!ctx) return NextResponse.redirect(`${site}/login?next=/social`);
  if (!memberCan(ctx, "social", "editar")) return NextResponse.redirect(`${site}/social?meta=sem-permissao`);
  if (!metaConfigured()) return NextResponse.redirect(`${site}/social?meta=nao-configurado`);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(oauthUrl(state, `${site}/api/social/meta/callback`));
  // confere na volta que a resposta é desta conexão
  res.cookies.set("meta_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/social/meta", maxAge: 600 });
  return res;
}
