-- Segurança: funções de conexão de contas só para quem está logado (antes o papel anon
-- recebia EXECUTE pelo padrão do Supabase; as funções já recusavam, mas agora nem chegam a rodar).
revoke execute on function public.social_store_pending(uuid, jsonb), public.social_pending_list(uuid),
  public.social_link_accounts(uuid, jsonb), public.social_disconnect(uuid) from anon;
-- as funções do robô são chamadas só pelo agendador (sem login); quem está logado não precisa delas
revoke execute on function public.social_claim(text), public.social_report(text, uuid, text, text, text, text, text) from authenticated;
-- a checagem do storage para o robô só é usada sem login
revoke execute on function public.social_media_is_publishing(text) from authenticated;
