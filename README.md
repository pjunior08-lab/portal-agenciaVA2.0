# Vai Aonde Capixaba? — Sistema de gestão da agência

Sistema web interno da agência: clientes, demandas, aprovação de posts, agenda, propostas, contratos, financeiro, CRM e comunicação.

**Pilha:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage, Realtime) · Netlify · GitHub Actions.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha a URL e a chave pública do Supabase
npm install
npm run dev                  # http://localhost:3000
```

Sem `.env.local` o app abre normalmente; só as partes que usam o banco (a partir da Fase 1) ficam indisponíveis.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run lint` | ESLint |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes de unidade (Vitest) |
| `npm run build && npm run test:e2e` | testes de fluxo (Playwright, desktop e celular) |

## Estrutura

```
src/app/(app)/            telas do sistema (com barra lateral)
src/app/(app)/[modulo]    página provisória de cada módulo ainda não implementado
src/app/(app)/componentes vitrine interna dos componentes (aprovação visual)
src/components/ui         componentes reutilizáveis
src/components/shell      barra lateral, menu no celular, cabeçalho, tema
src/lib/navigation.ts     lista de módulos, grupos do menu e fase de cada um
src/lib/supabase          clientes do Supabase (navegador e servidor)
e2e/                      testes de fluxo
```

## Supabase

- Migrações em `supabase/migrations/` (aplicadas em ordem). Testes de permissões em `supabase/tests/` (`rls_nucleo.sql`, `rls_clientes.sql`) (roda numa transação e desfaz tudo).
- Papéis: **Administrador** (acesso total) e **Colaborador** (acesso por módulo: ver ou ver e editar, liberado em Configurações › Equipe).
- Primeiro acesso: `/cadastro` cria a agência e o primeiro administrador. Depois disso, só entra quem recebe convite.
- Convites: o administrador gera um link (vale 7 dias, só para o e-mail convidado) e envia por WhatsApp ou e-mail.
- Em Supabase › Authentication › URL Configuration, o **Site URL** e os **Redirect URLs** devem apontar para o endereço do Netlify (`https://SEU-SITE.netlify.app/**`), senão os links de confirmação e de recuperação de senha não voltam para o sistema.

## Segurança

- Só a URL e a chave **pública** do Supabase vão ao navegador. A chave secreta fica apenas no servidor (variável `SUPABASE_SECRET_KEY` no Netlify, nunca com prefixo `NEXT_PUBLIC_`).
- Todo acesso a dados passa por políticas RLS no banco.
- `.env.local` nunca é versionado.

## Fases

0. Fundação ✅ · 1. Autenticação e núcleo ✅ · 2. Clientes e Portal ✅ · 3. Demandas, Agenda e Meu Dia ✅ · 4. Aprovação e Social ✅ · 5. Propostas e Contratos ✅ · 6. Financeiro ✅ · 7. Comercial ✅ (funil, relatórios, importação, automações e integrações) · 8. Comunicação, Mapa Mental, Funil e Início · 9. Integrações e módulos a levantar.
