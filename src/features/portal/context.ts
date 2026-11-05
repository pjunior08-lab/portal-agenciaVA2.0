import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberContext, getUser, memberCan } from "@/lib/auth/session";
import { signedUrls } from "@/lib/storage";

export interface PortalContext {
  slug: string;
  clientId: string;
  clientName: string;
  coverColor: string | null;
  logoUrl: string | null;
  sections: string[];
  /** "cliente" = login do cliente; "equipe" = alguém da agência vendo como o cliente vê */
  viewer: "cliente" | "equipe";
  userName: string;
}

/** Carrega o portal pelo endereço e confere quem pode ver. Cliente: só o próprio; equipe: com acesso a Clientes. */
export const getPortal = cache(async (slug: string): Promise<PortalContext> => {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/portal/${slug}`)}`);
  const supabase = await createClient();

  const { data: mine } = await supabase.rpc("my_client_portals");
  const asClient = mine?.find((p) => p.slug === slug);

  let viewer: PortalContext["viewer"];
  if (asClient) viewer = "cliente";
  else {
    const member = await getMemberContext();
    if (!member || !memberCan(member, "clientes")) notFound();
    viewer = "equipe";
  }

  const { data: portal } = await supabase.from("client_portal").select("client_id, sections, enabled").eq("slug", slug).maybeSingle();
  if (!portal || (viewer === "cliente" && !portal.enabled)) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("name, cover_color, logo_light_path")
    .eq("id", portal.client_id)
    .maybeSingle();
  if (!client) notFound();

  const urls = await signedUrls("clientes", [client.logo_light_path]);
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();

  return {
    slug,
    clientId: portal.client_id,
    clientName: client.name,
    coverColor: client.cover_color,
    logoUrl: client.logo_light_path ? (urls[client.logo_light_path] ?? null) : null,
    sections: portal.sections,
    viewer,
    userName: profile?.full_name || profile?.email || user.email || "",
  };
});
