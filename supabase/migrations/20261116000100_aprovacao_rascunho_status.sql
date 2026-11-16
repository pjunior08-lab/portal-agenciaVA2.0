-- Rascunho em Aprovações: o post existe para a equipe, mas o cliente ainda não vê.
-- (valor novo de enum fica numa migração separada: não pode ser usado na mesma transação)
alter type public.approval_status add value if not exists 'rascunho' before 'enviado';
