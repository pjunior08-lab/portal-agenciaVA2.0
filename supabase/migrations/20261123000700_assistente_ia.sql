-- Assistente IA: "Tom de voz" na Central Estratégica (usado para escrever no jeito de cada cliente)
-- e registro de uso (limite por pessoa e acompanhamento de custo).

alter table public.client_strategy
  add column voice_tone text not null default '' check (char_length(voice_tone) <= 10000);

-- link compartilhado da Central Estratégica passa a mostrar o tom de voz também
drop function public.shared_client_strategy(text);
create function public.shared_client_strategy(token text)
returns table (client_name text, agency_name text, persona text, profile_audit text, competitors text,
               positioning text, visual_identity text, voice_tone text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.name, a.name, s.persona, s.profile_audit, s.competitors, s.positioning, s.visual_identity, s.voice_tone, s.updated_at
  from public.client_strategy s
  join public.clients c on c.id = s.client_id
  join public.agencies a on a.id = s.agency_id
  where s.share_token_hash is not null
    and s.share_token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;
revoke all on function public.shared_client_strategy(text) from public;
grant execute on function public.shared_client_strategy(text) to anon, authenticated;

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  mode text not null check (mode in ('legenda', 'pauta', 'resumo', 'livre')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_agency_idx on public.ai_usage (agency_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
-- cada pessoa vê o próprio uso; administrador vê o da agência
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(agency_id));
create policy ai_usage_insert on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_access(agency_id, 'maestro', 'ver'));
