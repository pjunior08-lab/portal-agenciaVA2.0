# Convenções do projeto

- Interface em português do Brasil; código (nomes de variáveis, funções) em inglês, comentários em português.
- Cores só por tokens de `src/app/globals.css` (`bg-surface`, `text-muted`, `bg-brand`...). Nada de hex solto em componentes.
- Componentes novos reutilizáveis vão em `src/components/ui` e são exportados em `index.ts`.
- Módulo implementado ganha pasta própria em `src/app/(app)/<slug>/`, que substitui a página provisória `[modulo]`.
- Formulários: react-hook-form + Zod; o mesmo esquema valida no servidor (Server Action).
- Todo módulo: estados de carregamento, vazio e erro; teste de unidade e teste de fluxo em `e2e/`.
- Dados de demonstração só em script de seed, marcados como "Demonstração". Nunca em produção.
- Nunca usar a chave secreta do Supabase em código que roda no navegador.
- Não inventar funcionalidades: o escopo de cada módulo está em `src/lib/navigation.ts` e no documento de planejamento.
- Antes de commitar: `npm run lint && npm run typecheck && npm test && npm run build`.
