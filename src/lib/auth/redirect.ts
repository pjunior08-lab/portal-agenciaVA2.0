/** Aceita só caminhos internos no parâmetro ?next= (evita redirecionar para outro site). */
export function safeNext(next: string | null | undefined, fallback = "/inicio"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
