-- Complemento: o Postgres dá EXECUTE a PUBLIC em toda função nova (regra global, que a regra por
-- schema não consegue tirar). Remove essa regra para as funções criadas daqui em diante.
-- Em public, "authenticated" continua recebendo pelo padrão do schema; anon só com grant explícito.
-- Em private, função usada dentro de política precisa de "grant execute ... to authenticated".
alter default privileges for role postgres revoke execute on functions from public;
