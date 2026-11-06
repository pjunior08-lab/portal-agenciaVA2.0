/** Traduz mensagens de erro do Supabase Auth e do banco para o usuário. */
export function authErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "";
  const m = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  if (code === "invalid_credentials" || m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed" || m.includes("email not confirmed"))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (code === "user_already_exists" || m.includes("already registered"))
    return "Já existe uma conta com este e-mail. Entre com sua senha.";
  if (code === "weak_password" || m.includes("password should be"))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (code === "over_email_send_rate_limit" || m.includes("rate limit"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (code === "same_password") return "A nova senha precisa ser diferente da atual.";
  if (m.includes("invalid totp") || m.includes("invalid mfa") || code === "mfa_verification_failed")
    return "Código inválido ou vencido. Confira o app autenticador.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com o servidor. Tente de novo.";
  if (m.includes("row-level security") || m.includes("permission denied")) return "Você não tem permissão para esta ação.";
  // mensagens já escritas em português pelas funções do banco (raise exception com nossos códigos)
  if (error.message && !m.includes("violates") && ["23514", "42501", "P0001"].includes(code)) return error.message;
  if (error.message && /[áéíóúãõç]/i.test(error.message)) return error.message;
  return "Algo deu errado. Tente de novo.";
}
