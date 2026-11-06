import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Rotas que não exigem login. */
const PUBLIC_PREFIXES = ["/login", "/cadastro", "/recuperar-senha", "/convite", "/portal-convite", "/e", "/proposta", "/contrato", "/auth"];
/** Rotas de login: quem já está logado é mandado para o sistema. */
const GUEST_ONLY = ["/login", "/cadastro"];

function isPublic(path: string) {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * 1) Renova a sessão do Supabase. 2) Exige login fora das rotas públicas.
 * 3) Exige o segundo fator (2FA) de quem o ativou.
 * Papel e acessos por módulo são verificados nas páginas e, de verdade, no banco (RLS).
 */
export async function middleware(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const redirectTo = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = keepNext ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) {
    if (isPublic(path)) return response;
    return redirectTo("/login", path !== "/" && path !== "/inicio");
  }

  // segundo fator pendente
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needs2fa = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  if (needs2fa && path !== "/verificar-2fa" && !path.startsWith("/auth")) {
    return redirectTo("/verificar-2fa");
  }

  if (GUEST_ONLY.some((p) => path === p)) return redirectTo("/inicio");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
