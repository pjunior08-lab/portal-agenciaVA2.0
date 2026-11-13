import "server-only";
import { isPermanentMetaError, type PublishPlan } from "./plan";

/** Versão da API da Meta (pode trocar pela variável META_GRAPH_VERSION). */
export const graphVersion = () => process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH = () => `https://graph.facebook.com/${graphVersion()}`;

/** Permissões pedidas na conexão: ler Páginas/Instagram e publicar nos dois. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

export function metaConfigured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.SOCIAL_TOKEN_KEY);
}

export class MetaError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
  ) {
    super(message);
  }
  get permanent() {
    return isPermanentMetaError(this.code, this.subcode);
  }
}

async function call<T>(method: "GET" | "POST", path: string, params: Record<string, string>, token?: string): Promise<T> {
  const url = new URL(path.startsWith("https://") ? path : `${GRAPH()}${path}`);
  const body = new URLSearchParams(params);
  if (token) body.set("access_token", token);
  const init: RequestInit = { method, signal: AbortSignal.timeout(8000), cache: "no-store" };
  if (method === "GET") body.forEach((v, k) => url.searchParams.set(k, v));
  else init.body = body;
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } } & T;
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new MetaError(e.error_user_msg || e.message || `Erro ${res.status} da Meta`, e.code, e.error_subcode);
  }
  return json;
}

// ---------- conexão ----------
export function oauthUrl(state: string, redirectUri: string) {
  const u = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
  u.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  // "Login do Facebook para Empresas" usa uma configuração (META_CONFIG_ID) com as permissões escolhidas no painel da Meta;
  // sem ela, pede as permissões direto (login clássico)
  const configId = process.env.META_CONFIG_ID;
  if (configId) u.searchParams.set("config_id", configId);
  else u.searchParams.set("scope", META_SCOPES.join(","));
  return u.toString();
}

/** Troca o código da conexão por uma chave de longa duração da pessoa. */
export async function userTokenFromCode(code: string, redirectUri: string) {
  const short = await call<{ access_token: string }>("GET", "/oauth/access_token", {
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: redirectUri,
    code,
  });
  const long = await call<{ access_token: string }>("GET", "/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: short.access_token,
  });
  return long.access_token;
}

export interface FoundAccount {
  network: "instagram" | "facebook";
  external_id: string;
  page_id: string | null;
  username: string;
  picture_url: string | null;
  token: string;
}

/**
 * Páginas que a pessoa gerencia e o Instagram profissional ligado a cada uma.
 * A chave da Página (gerada a partir da chave de longa duração) serve para publicar nos dois.
 */
export async function listAccounts(userToken: string): Promise<FoundAccount[]> {
  type Page = {
    id: string;
    name: string;
    access_token?: string;
    picture?: { data?: { url?: string } };
    instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
  };
  const out: FoundAccount[] = [];
  let next: string | null = `${GRAPH()}/me/accounts`;
  let params: Record<string, string> = { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}", limit: "100" };
  for (let i = 0; next && i < 5; i++) {
    const page: { data: Page[]; paging?: { next?: string } } = await call("GET", next, params, i === 0 ? userToken : undefined);
    for (const p of page.data ?? []) {
      if (!p.access_token) continue;
      out.push({ network: "facebook", external_id: p.id, page_id: p.id, username: p.name, picture_url: p.picture?.data?.url ?? null, token: p.access_token });
      const ig = p.instagram_business_account;
      if (ig?.id) out.push({ network: "instagram", external_id: ig.id, page_id: p.id, username: ig.username ?? p.name, picture_url: ig.profile_picture_url ?? null, token: p.access_token });
    }
    next = page.paging?.next ?? null;
    params = {};
  }
  return out;
}

// ---------- publicação ----------
export type PublishResult =
  | { outcome: "publicado"; mediaId: string; link: string | null }
  | { outcome: "processando"; container: string }
  | { outcome: "erro" | "definitivo"; error: string };

const fail = (e: unknown): PublishResult =>
  e instanceof MetaError
    ? { outcome: e.permanent ? "definitivo" : "erro", error: e.code === 190 ? `Chave de acesso (token) inválida ou expirada: reconecte a conta. ${e.message}` : e.message }
    : { outcome: "erro", error: e instanceof Error ? e.message : "Falha inesperada ao publicar." };

async function igPublish(igId: string, token: string, container: string): Promise<PublishResult> {
  const st = await call<{ status_code?: string; status?: string }>("GET", `/${container}`, { fields: "status_code,status" }, token);
  if (st.status_code === "IN_PROGRESS") return { outcome: "processando", container };
  if (st.status_code === "ERROR" || st.status_code === "EXPIRED") return { outcome: "erro", error: `A Meta não processou a mídia (${st.status ?? st.status_code}).` };
  const done = await call<{ id: string }>("POST", `/${igId}/media_publish`, { creation_id: container }, token);
  const info = await call<{ permalink?: string }>("GET", `/${done.id}`, { fields: "permalink" }, token).catch(() => ({ permalink: undefined }));
  return { outcome: "publicado", mediaId: done.id, link: info.permalink ?? null };
}

/** Instagram: cria o contêiner (foto, Reels ou carrossel) e publica quando a Meta terminar de processar. */
export async function publishInstagram(igId: string, token: string, plan: PublishPlan, caption: string, urls: string[], container: string | null): Promise<PublishResult> {
  try {
    if (container) return await igPublish(igId, token, container);
    if (!plan.ok) return { outcome: "definitivo", error: plan.error };
    let id: string;
    if (plan.kind === "imagem") {
      id = (await call<{ id: string }>("POST", `/${igId}/media`, { image_url: urls[0], caption }, token)).id;
    } else if (plan.kind === "video") {
      id = (await call<{ id: string }>("POST", `/${igId}/media`, { media_type: "REELS", video_url: urls[0], caption, share_to_feed: "true" }, token)).id;
      // vídeo sempre leva um tempo para processar: publica na próxima rodada
      return { outcome: "processando", container: id };
    } else if (plan.kind === "carrossel") {
      if (plan.items.some((m) => (m.mime ?? "").startsWith("video/")))
        return { outcome: "definitivo", error: "Carrossel com vídeo ainda não é publicado automaticamente. Use só imagens JPG no carrossel." };
      const children: string[] = [];
      for (const u of urls) children.push((await call<{ id: string }>("POST", `/${igId}/media`, { image_url: u, is_carousel_item: "true" }, token)).id);
      id = (await call<{ id: string }>("POST", `/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, token)).id;
    } else {
      return { outcome: "definitivo", error: "O Instagram não publica post só com texto." };
    }
    return await igPublish(igId, token, id);
  } catch (e) {
    return fail(e);
  }
}

/** Facebook (Página): texto, foto, várias fotos ou vídeo. */
export async function publishFacebook(pageId: string, token: string, plan: PublishPlan, caption: string, urls: string[]): Promise<PublishResult> {
  if (!plan.ok) return { outcome: "definitivo", error: plan.error };
  try {
    const link = (id: string) => `https://www.facebook.com/${id}`;
    if (plan.kind === "texto") {
      const r = await call<{ id: string }>("POST", `/${pageId}/feed`, { message: caption }, token);
      return { outcome: "publicado", mediaId: r.id, link: link(r.id) };
    }
    if (plan.kind === "imagem") {
      const r = await call<{ id: string; post_id?: string }>("POST", `/${pageId}/photos`, { url: urls[0], message: caption, published: "true" }, token);
      return { outcome: "publicado", mediaId: r.post_id ?? r.id, link: link(r.post_id ?? r.id) };
    }
    if (plan.kind === "video") {
      const r = await call<{ id: string }>("POST", `/${pageId}/videos`, { file_url: urls[0], description: caption }, token);
      return { outcome: "publicado", mediaId: r.id, link: link(r.id) };
    }
    const ids: string[] = [];
    for (const u of urls) ids.push((await call<{ id: string }>("POST", `/${pageId}/photos`, { url: u, published: "false" }, token)).id);
    const params: Record<string, string> = { message: caption };
    ids.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
    const r = await call<{ id: string }>("POST", `/${pageId}/feed`, params, token);
    return { outcome: "publicado", mediaId: r.id, link: link(r.id) };
  } catch (e) {
    return fail(e);
  }
}
