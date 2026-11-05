import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Gera links temporários (1 hora) para arquivos privados do Storage.
 * Usa a sessão de quem pede: só sai link do que as políticas permitem ver.
 */
export async function signedUrls(bucket: string, paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, 3600);
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}
