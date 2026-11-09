-- Recomendação do Supabase: extensões fora do schema public. As funções continuam em net.*.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
