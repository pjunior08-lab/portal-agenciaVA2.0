-- Correção: dentro da consulta, "secret" era lido como a coluna do cofre (vault.decrypted_secrets.secret)
-- e não como o parâmetro; a conferência nunca passava. Usa o parâmetro posicional.
create or replace function private.social_robot_ok(secret text)
returns boolean language sql stable security definer set search_path = '' as $$
  select length($1) >= 32
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'social_cron_secret' and s.decrypted_secret = $1);
$$;
