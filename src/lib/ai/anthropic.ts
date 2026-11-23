import "server-only";

/** Modelo padrão (troque pela variável ANTHROPIC_MODEL). */
export const aiModel = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export interface AiReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Chamada à API de mensagens da Anthropic. A chave só existe no servidor. */
export async function complete(system: string, messages: { role: "user" | "assistant"; content: string }[], maxTokens = 1200): Promise<AiReply> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("O Assistente IA ainda não está configurado (falta a chave da Anthropic no servidor).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: aiModel(), max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "A chave da Anthropic foi recusada. Confira a variável ANTHROPIC_API_KEY."
        : res.status === 429
          ? "Muitos pedidos ao mesmo tempo. Tente de novo em um minuto."
          : res.status >= 500
            ? "O serviço de IA está instável agora. Tente de novo em instantes."
            : (json.error?.message ?? `Erro ${res.status} no serviço de IA.`);
    throw new AiError(msg, res.status);
  }
  const text = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  return { text, inputTokens: json.usage?.input_tokens ?? 0, outputTokens: json.usage?.output_tokens ?? 0 };
}
