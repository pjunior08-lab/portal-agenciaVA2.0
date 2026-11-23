-- Segurança por padrão: funções novas em public não ficam executáveis por quem não está logado.
-- Função pública (formulário, proposta, contrato…) precisa de "grant execute ... to anon" explícito.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
