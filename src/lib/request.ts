import "server-only";
import { headers } from "next/headers";

/** Endereço do site a partir da requisição (para montar links públicos). */
export async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** IP de quem fez a requisição (Netlify informa em x-nf-client-connection-ip). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 100) || null;
}

export async function userAgent() {
  return ((await headers()).get("user-agent") ?? "").slice(0, 400) || null;
}
