/** Regras de formato antes de publicar (funções puras, testadas). */

export interface MediaRef {
  path: string;
  mime: string | null;
}
export type PublishPlan =
  | { ok: true; kind: "texto" | "imagem" | "video" | "carrossel"; items: MediaRef[] }
  | { ok: false; error: string };

export const MAX_CAROUSEL = 10;
const isImage = (m: MediaRef) => (m.mime ?? "").startsWith("image/");
const isVideo = (m: MediaRef) => (m.mime ?? "").startsWith("video/");
const IG_IMAGE = ["image/jpeg", "image/jpg"];
const VIDEO_OK = ["video/mp4", "video/quicktime"];

/** Decide o tipo de publicação conforme as mídias do post e a rede. */
export function planPublication(network: string, media: MediaRef[], caption: string): PublishPlan {
  const items = media.filter((m) => isImage(m) || isVideo(m));
  if (network === "instagram") {
    if (!items.length) return { ok: false, error: "O Instagram precisa de ao menos uma imagem ou vídeo no post." };
    if (caption.length > 2200) return { ok: false, error: "A legenda passa do limite de 2.200 caracteres do Instagram." };
    if ((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30) return { ok: false, error: "O Instagram aceita no máximo 30 hashtags." };
    const badImage = items.find((m) => isImage(m) && !IG_IMAGE.includes((m.mime ?? "").toLowerCase()));
    if (badImage) return { ok: false, error: "O Instagram só aceita imagens JPG. Troque as imagens em PNG/WEBP por JPG e mande de novo." };
    const badVideo = items.find((m) => isVideo(m) && !VIDEO_OK.includes((m.mime ?? "").toLowerCase()));
    if (badVideo) return { ok: false, error: "Vídeo em formato não aceito. Use MP4 ou MOV." };
    if (items.length > MAX_CAROUSEL) return { ok: false, error: `O carrossel aceita até ${MAX_CAROUSEL} itens.` };
    if (items.length > 1) return { ok: true, kind: "carrossel", items };
    return { ok: true, kind: isVideo(items[0]) ? "video" : "imagem", items };
  }
  if (network === "facebook") {
    if (!items.length) return caption.trim() ? { ok: true, kind: "texto", items: [] } : { ok: false, error: "Post sem texto e sem mídia." };
    const videos = items.filter(isVideo);
    if (videos.length && items.length > 1) return { ok: false, error: "No Facebook, vídeo vai sozinho (sem outras mídias no mesmo post)." };
    if (videos.length) return { ok: true, kind: "video", items };
    if (items.length > MAX_CAROUSEL) return { ok: false, error: `Até ${MAX_CAROUSEL} imagens por post.` };
    return { ok: true, kind: items.length > 1 ? "carrossel" : "imagem", items };
  }
  return { ok: false, error: "Publicação automática disponível só para Instagram e Facebook." };
}

/** Erro da Meta que não adianta tentar de novo (chave inválida, permissão, formato). */
export function isPermanentMetaError(code: number | undefined, subcode?: number) {
  if (!code) return false;
  // 190 = chave expirada/inválida; 10 e 200-299 = permissão; 100 = parâmetro inválido; 36003 = proporção de mídia
  return code === 190 || code === 10 || (code >= 200 && code < 300) || (code === 100 && subcode !== 2207003) || code === 36003;
}
