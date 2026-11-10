-- Fase 9: publicação automática — novos status (em migração separada: valores novos de enum
-- só podem ser usados depois que esta transação termina).
alter type public.publication_status add value if not exists 'publicando';
alter type public.publication_status add value if not exists 'erro';
