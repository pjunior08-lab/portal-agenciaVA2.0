-- =====================================================================
-- Fase 5 — Propostas e Contratos
-- Equipe: módulos "propostas" e "contratos" (ver/editar).
-- Cliente sem login: só pelo link (token guardado como hash), através de
-- funções que entregam aquele documento e nada mais.
-- Cliente no portal: seção "servicos" mostra contratos e propostas aceitas.
-- Contrato enviado tem o texto congelado (hash SHA-256); depois da primeira
-- assinatura nada do conteúdo muda.
-- =====================================================================

create type public.proposal_status as enum ('rascunho', 'enviada', 'em_negociacao', 'aceita', 'recusada');
create type public.item_cadence as enum ('unica', 'mensal', 'trimestral', 'semestral', 'anual');
create type public.contract_status as enum ('rascunho', 'aguardando', 'assinado', 'cancelado');
create type public.signer_party as enum ('contratante', 'contratada');

-- ---------- Modelos de proposta ----------
create table public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  title text not null default '' check (char_length(title) <= 200),
  cover text not null default '#FEB800' check (cover ~ '^#[0-9a-fA-F]{6}$'),
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  payment jsonb not null default '{}' check (jsonb_typeof(payment) = 'object'),
  notes text not null default '' check (char_length(notes) <= 10000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index proposal_templates_agency_idx on public.proposal_templates (agency_id, name);
create trigger proposal_templates_updated_at before update on public.proposal_templates
  for each row execute function private.set_updated_at();

-- ---------- Propostas ----------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  number text not null check (char_length(trim(number)) between 1 and 30),
  title text not null check (char_length(trim(title)) between 1 and 200),
  template_id uuid references public.proposal_templates (id) on delete set null,
  cover text not null default '#FEB800' check (cover ~ '^#[0-9a-fA-F]{6}$'),
  status public.proposal_status not null default 'rascunho',
  valid_until date,
  client_id uuid references public.clients (id) on delete restrict,
  contact_name text check (char_length(contact_name) <= 120),
  contact_email text check (char_length(contact_email) <= 200),
  contact_phone text check (char_length(contact_phone) <= 40),
  -- { installments, down_payment, methods[], details }
  payment jsonb not null default '{}' check (jsonb_typeof(payment) = 'object'),
  notes text not null default '' check (char_length(notes) <= 10000),
  share_token_hash text unique,
  sent_at timestamptz,
  decided_at timestamptz,
  decision_name text check (char_length(decision_name) <= 120),
  decision_comment text check (char_length(decision_comment) <= 2000),
  decision_ip text check (char_length(decision_ip) <= 100),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, number)
);
create index proposals_agency_idx on public.proposals (agency_id, status, created_at desc);
create index proposals_client_idx on public.proposals (client_id);
create trigger proposals_updated_at before update on public.proposals
  for each row execute function private.set_updated_at();

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  position smallint not null default 0,
  service text not null check (char_length(trim(service)) between 1 and 200),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  cadence public.item_cadence not null default 'unica',
  scope_html text not null default '' check (char_length(scope_html) <= 20000)
);
create index proposal_items_proposal_idx on public.proposal_items (proposal_id, position);

-- número automático AAAA-NNN quando vier vazio; cliente da mesma agência
create or replace function private.proposals_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  y text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  n int;
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id
  ) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and coalesce(trim(new.number), '') = '' then
    select coalesce(max((regexp_match(p.number, '^' || y || '-(\d+)$'))[1]::int), 0) + 1 into n
      from public.proposals p where p.agency_id = new.agency_id;
    new.number := y || '-' || lpad(n::text, 3, '0');
  end if;
  new.number := trim(new.number);
  -- a decisão do cliente pelo link só é gravada pela função pública
  if coalesce(current_setting('app.public_decision', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.share_token_hash := null; new.decision_name := null; new.decision_comment := null;
      new.decision_ip := null; new.decided_at := null; new.sent_at := null;
    else
      new.share_token_hash := old.share_token_hash;
      new.decision_name := old.decision_name; new.decision_comment := old.decision_comment;
      new.decision_ip := old.decision_ip; new.decided_at := old.decided_at;
      new.sent_at := coalesce(old.sent_at, case when new.status <> 'rascunho' then now() end);
    end if;
  end if;
  return new;
end;
$$;
create trigger proposals_guard before insert or update on public.proposals
  for each row execute function private.proposals_guard();

-- ---------- Modelos de contrato ----------
create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  body_html text not null default '' check (char_length(body_html) <= 200000),
  header_text text not null default '' check (char_length(header_text) <= 300),
  footer_text text not null default '' check (char_length(footer_text) <= 300),
  watermark text not null default '' check (char_length(watermark) <= 40),
  is_default boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contract_templates_default_idx on public.contract_templates (agency_id) where is_default;
create index contract_templates_agency_idx on public.contract_templates (agency_id, name);
create trigger contract_templates_updated_at before update on public.contract_templates
  for each row execute function private.set_updated_at();

-- ---------- Contratos ----------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  template_id uuid references public.contract_templates (id) on delete set null,
  proposal_id uuid references public.proposals (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete restrict,
  service_description text not null default '' check (char_length(service_description) <= 2000),
  -- rascunho editável, com variáveis {{...}}
  body_html text not null default '' check (char_length(body_html) <= 200000),
  header_text text not null default '' check (char_length(header_text) <= 300),
  footer_text text not null default '' check (char_length(footer_text) <= 300),
  watermark text not null default '' check (char_length(watermark) <= 40),
  value numeric(14, 2) check (value is null or value >= 0),
  starts_on date,
  ends_on date,
  renewal_on date,
  status public.contract_status not null default 'rascunho',
  -- cópia congelada no envio (variáveis já trocadas) e seu hash
  rendered_html text,
  document_hash text,
  share_token_hash text unique,
  sent_at timestamptz,
  signed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index contracts_agency_idx on public.contracts (agency_id, status, created_at desc);
create index contracts_client_idx on public.contracts (client_id);
create trigger contracts_updated_at before update on public.contracts
  for each row execute function private.set_updated_at();

create table public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  contract_id uuid not null references public.contracts (id) on delete restrict,
  party public.signer_party not null,
  signer_name text not null check (char_length(trim(signer_name)) between 3 and 120),
  signer_document text not null check (char_length(signer_document) between 11 and 20),
  signer_email text check (char_length(signer_email) <= 200),
  user_id uuid references public.profiles (id) on delete set null,
  ip text check (char_length(ip) <= 100),
  user_agent text check (char_length(user_agent) <= 400),
  document_hash text not null,
  signed_at timestamptz not null default now(),
  unique (contract_id, party)
);

-- Regras do contrato:
--  * cliente da agência e proposta da agência;
--  * "aguardando" e "assinado" só pelas funções de envio e assinatura;
--  * enviado: texto congelado; voltar para rascunho só sem assinaturas;
--  * com assinatura: nada do conteúdo muda (só cancelar, sem apagar o registro).
create or replace function private.contracts_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  signed boolean;
begin
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.agency_id = new.agency_id) then
    raise exception 'Cliente inválido.' using errcode = '23514';
  end if;
  if new.proposal_id is not null and not exists (
    select 1 from public.proposals p where p.id = new.proposal_id and p.agency_id = new.agency_id
  ) then
    raise exception 'Proposta inválida.' using errcode = '23514';
  end if;
  if coalesce(current_setting('app.contract_flow', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'rascunho'; new.rendered_html := null; new.document_hash := null;
    new.share_token_hash := null; new.sent_at := null; new.signed_at := null; new.cancelled_at := null;
    return new;
  end if;

  signed := exists (select 1 from public.contract_signatures s where s.contract_id = old.id);
  new.rendered_html := old.rendered_html; new.document_hash := old.document_hash;
  new.share_token_hash := old.share_token_hash; new.sent_at := old.sent_at; new.signed_at := old.signed_at;

  if new.status is distinct from old.status then
    if new.status = 'cancelado' then
      new.cancelled_at := now();
    elsif new.status = 'rascunho' and old.status in ('aguardando', 'cancelado') and not signed then
      new.rendered_html := null; new.document_hash := null; new.share_token_hash := null;
      new.sent_at := null; new.cancelled_at := null;
    else
      raise exception 'Mudança de status não permitida.' using errcode = '42501';
    end if;
  end if;

  if old.status <> 'rascunho' and new.status <> 'rascunho' and (
       new.body_html is distinct from old.body_html or new.header_text is distinct from old.header_text
    or new.footer_text is distinct from old.footer_text or new.watermark is distinct from old.watermark
    or new.value is distinct from old.value or new.starts_on is distinct from old.starts_on
    or new.ends_on is distinct from old.ends_on or new.client_id is distinct from old.client_id
    or new.service_description is distinct from old.service_description or new.title is distinct from old.title
  ) then
    raise exception 'Contrato enviado não pode ser alterado. Volte para rascunho (se ainda não houver assinatura).' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger contracts_guard before insert or update on public.contracts
  for each row execute function private.contracts_guard();

-- auditoria (contratos e assinaturas)
create trigger contracts_audit after insert or update or delete on public.contracts
  for each row execute function private.audit_generic();
create trigger contract_signatures_audit after insert on public.contract_signatures
  for each row execute function private.audit_generic();
create trigger proposals_audit after delete on public.proposals
  for each row execute function private.audit_generic();

-- =====================================================================
-- Funções
-- =====================================================================
create or replace function private.sha256(t text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(t, ''), 'sha256'), 'hex');
$$;

-- Gera (ou troca) o link da proposta. Devolve o token uma única vez.
create or replace function public.share_proposal(p uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  x public.proposals;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into x from public.proposals where id = p;
  if x.id is null or not private.can_access(x.agency_id, 'propostas', 'editar') then
    raise exception 'Proposta não encontrada.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.proposal_items i where i.proposal_id = p) then
    raise exception 'Adicione ao menos um item antes de enviar.' using errcode = '23514';
  end if;
  perform set_config('app.public_decision', 'on', true);
  update public.proposals
     set share_token_hash = private.sha256(token),
         status = case when status = 'rascunho' then 'enviada' else status end,
         sent_at = coalesce(sent_at, now())
   where id = p;
  perform set_config('app.public_decision', 'off', true);
  return token;
end;
$$;

-- Proposta pelo link: só aquele documento, sem dados internos.
create or replace function public.public_proposal(token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'number', p.number, 'title', p.title, 'cover', p.cover, 'status', p.status,
    'valid_until', p.valid_until, 'sent_at', p.sent_at, 'decided_at', p.decided_at,
    'decision_name', p.decision_name, 'payment', p.payment, 'notes', p.notes,
    'contact_name', p.contact_name, 'client_name', c.name,
    'agency', jsonb_build_object('name', a.name, 'legal_name', a.legal_name, 'email', a.email, 'phone', a.phone),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('service', i.service, 'quantity', i.quantity, 'unit_price', i.unit_price,
                                          'cadence', i.cadence, 'scope_html', i.scope_html) order by i.position)
      from public.proposal_items i where i.proposal_id = p.id), '[]'::jsonb)
  )
  from public.proposals p
  join public.agencies a on a.id = p.agency_id
  left join public.clients c on c.id = p.client_id
  where p.share_token_hash is not null and p.share_token_hash = private.sha256(token);
$$;

create or replace function public.public_proposal_decide(token text, decision public.proposal_status, signer_name text, comment text default null, ip text default null)
returns public.proposal_status language plpgsql security definer set search_path = '' as $$
declare
  x public.proposals;
  nm text := trim(coalesce(signer_name, ''));
begin
  select * into x from public.proposals
   where share_token_hash is not null and share_token_hash = private.sha256(token) for update;
  if x.id is null then raise exception 'Link inválido.' using errcode = '42501'; end if;
  if decision not in ('aceita', 'recusada') then raise exception 'Decisão inválida.' using errcode = '23514'; end if;
  if x.status not in ('enviada', 'em_negociacao') then
    raise exception 'Esta proposta já foi respondida.' using errcode = '23514';
  end if;
  if x.valid_until is not null and x.valid_until < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Esta proposta venceu. Peça uma nova à agência.' using errcode = '23514';
  end if;
  if char_length(nm) < 3 or char_length(nm) > 120 then
    raise exception 'Informe seu nome completo.' using errcode = '23514';
  end if;
  perform set_config('app.public_decision', 'on', true);
  update public.proposals
     set status = decision, decided_at = now(), decision_name = nm,
         decision_comment = nullif(left(trim(coalesce(comment, '')), 2000), ''),
         decision_ip = left(ip, 100)
   where id = x.id;
  perform set_config('app.public_decision', 'off', true);
  if x.created_by is not null then
    insert into public.notifications (agency_id, recipient_id, title, body, link)
    values (x.agency_id, x.created_by,
            case decision when 'aceita' then 'Proposta aceita' else 'Proposta recusada' end,
            x.number || ' · ' || x.title || ' · por ' || nm, '/propostas?proposta=' || x.id);
  end if;
  return decision;
end;
$$;

-- Envia o contrato: congela o texto já com as variáveis trocadas, calcula o hash
-- e gera o link de assinatura. Chamada de novo, só troca o link.
create or replace function public.send_contract(c uuid, rendered text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  x public.contracts;
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  select * into x from public.contracts where id = c for update;
  if x.id is null or not private.can_access(x.agency_id, 'contratos', 'editar') then
    raise exception 'Contrato não encontrado.' using errcode = '42501';
  end if;
  if x.status not in ('rascunho', 'aguardando') then
    raise exception 'Este contrato não pode ser enviado.' using errcode = '23514';
  end if;
  perform set_config('app.contract_flow', 'on', true);
  if x.status = 'rascunho' then
    if char_length(trim(coalesce(rendered, ''))) < 20 then
      raise exception 'Escreva o texto do contrato antes de enviar.' using errcode = '23514';
    end if;
    update public.contracts
       set status = 'aguardando', rendered_html = rendered,
           document_hash = private.sha256(x.header_text || E'\n' || rendered || E'\n' || x.footer_text),
           share_token_hash = private.sha256(token), sent_at = now()
     where id = c;
  else
    update public.contracts set share_token_hash = private.sha256(token) where id = c;
  end if;
  perform set_config('app.contract_flow', 'off', true);
  return token;
end;
$$;

create or replace function private.sign_contract(x public.contracts, who public.signer_party, nm text, doc text, mail text, uid uuid, ip text, ua text)
returns public.contract_status language plpgsql security definer set search_path = '' as $$
declare
  clean_doc text := regexp_replace(coalesce(doc, ''), '\D', '', 'g');
  n int;
begin
  if x.status <> 'aguardando' then raise exception 'Este contrato não está aguardando assinatura.' using errcode = '23514'; end if;
  if char_length(trim(coalesce(nm, ''))) < 3 then raise exception 'Informe o nome completo.' using errcode = '23514'; end if;
  if char_length(clean_doc) not in (11, 14) then raise exception 'Informe um CPF ou CNPJ válido.' using errcode = '23514'; end if;
  if exists (select 1 from public.contract_signatures s where s.contract_id = x.id and s.party = who) then
    raise exception 'Esta parte já assinou.' using errcode = '23514';
  end if;
  insert into public.contract_signatures (agency_id, contract_id, party, signer_name, signer_document, signer_email, user_id, ip, user_agent, document_hash)
  values (x.agency_id, x.id, who, trim(nm), clean_doc, nullif(trim(coalesce(mail, '')), ''), uid, left(ip, 100), left(ua, 400), x.document_hash);
  select count(*) into n from public.contract_signatures s where s.contract_id = x.id;
  if n = 2 then
    perform set_config('app.contract_flow', 'on', true);
    update public.contracts set status = 'assinado', signed_at = now() where id = x.id;
    perform set_config('app.contract_flow', 'off', true);
    return 'assinado';
  end if;
  return 'aguardando';
end;
$$;

-- Assinatura da agência (contratada): só administrador, que responde pela agência.
create or replace function public.sign_contract_as_agency(c uuid, signer_name text, signer_document text, ip text default null, user_agent text default null)
returns public.contract_status language plpgsql security definer set search_path = '' as $$
declare
  x public.contracts;
begin
  select * into x from public.contracts where id = c for update;
  if x.id is null or not private.can_access(x.agency_id, 'contratos', 'ver') then
    raise exception 'Contrato não encontrado.' using errcode = '42501';
  end if;
  if not private.is_admin(x.agency_id) then
    raise exception 'Só um administrador assina pela agência.' using errcode = '42501';
  end if;
  return private.sign_contract(x, 'contratada', signer_name, signer_document,
    (select p.email from public.profiles p where p.id = (select auth.uid())), (select auth.uid()), ip, user_agent);
end;
$$;

-- Contrato pelo link: texto congelado, partes e assinaturas (documento mascarado).
create or replace function public.public_contract(token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', k.title, 'status', k.status, 'rendered_html', k.rendered_html, 'header_text', k.header_text,
    'footer_text', k.footer_text, 'watermark', k.watermark, 'document_hash', k.document_hash,
    'value', k.value, 'starts_on', k.starts_on, 'ends_on', k.ends_on, 'renewal_on', k.renewal_on,
    'sent_at', k.sent_at, 'signed_at', k.signed_at,
    'contratante', jsonb_build_object('name', c.name, 'document', c.document),
    'contratada', jsonb_build_object('name', coalesce(nullif(a.legal_name, ''), a.name), 'document', a.cnpj),
    'signatures', coalesce((
      select jsonb_agg(jsonb_build_object('party', s.party, 'name', s.signer_name,
        'document', '***' || right(s.signer_document, 4), 'signed_at', s.signed_at, 'ip', s.ip) order by s.signed_at)
      from public.contract_signatures s where s.contract_id = k.id), '[]'::jsonb)
  )
  from public.contracts k
  join public.clients c on c.id = k.client_id
  join public.agencies a on a.id = k.agency_id
  where k.share_token_hash is not null and k.share_token_hash = private.sha256(token) and k.status <> 'rascunho';
$$;

-- Assinatura do cliente (contratante) pelo link.
create or replace function public.public_contract_sign(token text, signer_name text, signer_document text, signer_email text default null, ip text default null, user_agent text default null)
returns public.contract_status language plpgsql security definer set search_path = '' as $$
declare
  x public.contracts;
  result public.contract_status;
begin
  select * into x from public.contracts
   where share_token_hash is not null and share_token_hash = private.sha256(token) for update;
  if x.id is null then raise exception 'Link inválido.' using errcode = '42501'; end if;
  result := private.sign_contract(x, 'contratante', signer_name, signer_document, signer_email, null, ip, user_agent);
  if x.created_by is not null then
    insert into public.notifications (agency_id, recipient_id, title, body, link)
    values (x.agency_id, x.created_by,
            case result when 'assinado' then 'Contrato assinado pelas duas partes' else 'Cliente assinou o contrato' end,
            x.title, '/contratos?contrato=' || x.id);
  end if;
  return result;
end;
$$;

revoke execute on function public.share_proposal(uuid), public.send_contract(uuid, text),
  public.sign_contract_as_agency(uuid, text, text, text, text) from public, anon;
grant execute on function public.share_proposal(uuid), public.send_contract(uuid, text),
  public.sign_contract_as_agency(uuid, text, text, text, text) to authenticated;
-- funções do link: o token é a credencial
revoke execute on function public.public_proposal(text), public.public_proposal_decide(text, public.proposal_status, text, text, text),
  public.public_contract(text), public.public_contract_sign(text, text, text, text, text, text) from public;
grant execute on function public.public_proposal(text), public.public_proposal_decide(text, public.proposal_status, text, text, text),
  public.public_contract(text), public.public_contract_sign(text, text, text, text, text, text) to anon, authenticated;
revoke execute on function private.sign_contract(public.contracts, public.signer_party, text, text, text, uuid, text, text) from public, anon, authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.proposal_templates enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_signatures enable row level security;
revoke all on public.proposal_templates, public.proposals, public.proposal_items, public.contract_templates,
  public.contracts, public.contract_signatures from anon;

create policy proposal_templates_select on public.proposal_templates for select to authenticated
  using (private.can_access(agency_id, 'propostas', 'ver'));
create policy proposal_templates_write on public.proposal_templates for all to authenticated
  using (private.can_access(agency_id, 'propostas', 'editar')) with check (private.can_access(agency_id, 'propostas', 'editar'));

-- cliente no portal (seção Serviços) vê só as propostas aceitas dele
create policy proposals_select on public.proposals for select to authenticated
  using (private.can_access(agency_id, 'propostas', 'ver')
         or (status = 'aceita' and client_id is not null and private.portal_section(client_id, 'servicos')));
create policy proposals_insert on public.proposals for insert to authenticated
  with check (private.can_access(agency_id, 'propostas', 'editar') and created_by = (select auth.uid()));
create policy proposals_update on public.proposals for update to authenticated
  using (private.can_access(agency_id, 'propostas', 'editar')) with check (private.can_access(agency_id, 'propostas', 'editar'));
-- excluir: rascunho ou recusada; administrador exclui qualquer uma
create policy proposals_delete on public.proposals for delete to authenticated
  using (private.is_admin(agency_id)
         or (private.can_access(agency_id, 'propostas', 'editar') and status in ('rascunho', 'recusada')));

create policy proposal_items_select on public.proposal_items for select to authenticated
  using (private.can_access(agency_id, 'propostas', 'ver') or exists (
    select 1 from public.proposals p where p.id = proposal_id and p.status = 'aceita'
      and p.client_id is not null and private.portal_section(p.client_id, 'servicos')));
create policy proposal_items_write on public.proposal_items for all to authenticated
  using (private.can_access(agency_id, 'propostas', 'editar'))
  with check (private.can_access(agency_id, 'propostas', 'editar')
              and exists (select 1 from public.proposals p where p.id = proposal_id and p.agency_id = proposal_items.agency_id));

create policy contract_templates_select on public.contract_templates for select to authenticated
  using (private.can_access(agency_id, 'contratos', 'ver'));
create policy contract_templates_write on public.contract_templates for all to authenticated
  using (private.can_access(agency_id, 'contratos', 'editar')) with check (private.can_access(agency_id, 'contratos', 'editar'));

create policy contracts_select on public.contracts for select to authenticated
  using (private.can_access(agency_id, 'contratos', 'ver')
         or (status in ('aguardando', 'assinado') and private.portal_section(client_id, 'servicos')));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (private.can_access(agency_id, 'contratos', 'editar') and created_by = (select auth.uid()));
create policy contracts_update on public.contracts for update to authenticated
  using (private.can_access(agency_id, 'contratos', 'editar')) with check (private.can_access(agency_id, 'contratos', 'editar'));
create policy contracts_delete on public.contracts for delete to authenticated
  using (private.can_access(agency_id, 'contratos', 'editar') and status in ('rascunho', 'cancelado'));

-- assinaturas: só leitura e só a equipe (documento completo de quem assinou);
-- gravadas pelas funções. O link público mostra o documento mascarado.
create policy contract_signatures_select on public.contract_signatures for select to authenticated
  using (private.can_access(agency_id, 'contratos', 'ver'));
