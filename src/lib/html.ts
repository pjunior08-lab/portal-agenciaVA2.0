import "server-only";
import sanitize from "sanitize-html";

/**
 * Limpa HTML vindo do editor de texto rico (escopo de proposta, texto de contrato).
 * Só formatação básica: nada de script, estilo, imagem externa ou atributos de evento.
 * Usado ao salvar (servidor) e de novo ao exibir em páginas públicas.
 */
export function cleanHtml(html: string | null | undefined): string {
  return sanitize(html ?? "", {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr", "a", "span"],
    allowedAttributes: { a: ["href", "target", "rel"], span: ["data-variable"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitize.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  }).trim();
}

/** Texto puro (sem tags), para contar se há conteúdo. */
export function htmlToText(html: string): string {
  return sanitize(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
