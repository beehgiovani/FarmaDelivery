# Prontidao de Producao

Este resumo mostra o que ja esta coberto por automacao/localmente e o que ainda depende de validacao real antes de publicar. Nao registre aqui chaves, tokens, project IDs, enderecos reais, nomes reais de lojas ou credenciais.

## Pronto Localmente

- Testes automatizados do monorepo via `npm test`.
- Build web/API/PWA via `npm run build`.
- Checagem segura de arquivos sensiveis via `npm run repo:sensitive:check`.
- Auditoria estatica de RLS via `npm run db:rls:check`.
- Preflight de producao orquestrado por `npm run preflight:production -- file=env/api.env file=env/admin.env`.
- Preflight mobile local via `npm run mobile:local-check`.
- Conferencia isolada do alvo da API Android via `npm run mobile:local-check -- --api-config`.
- APK debug gerado pelo runner mobile em `apps\motoboy\app\build\outputs\apk\debug\app-debug.apk`.
- Checklists preenchiveis para smoke test operacional e mobile.

## Depende de Ambiente Real

- Rodar o preflight com `env/api.env` e `env/admin.env` reais do deploy.
- Conferir no Supabase SQL Editor se o banco aplicado esta alinhado ao `database/schema-full.sql` e ao resultado de `npm run db:rls:check`.
- Validar API publicada, armazenamento persistente de comprovantes e credencial Firebase Admin.
- Testar admin, login de loja, criacao de entrega, comanda, relatorios e notificacoes usando `docs/operational-smoke-test-checklist.md`.
- Testar Android em emulador/aparelho com API acessivel usando `docs/mobile-smoke-test-checklist.md`.
- Testar PWA iOS instalado pela Tela de Inicio com HTTPS, Firebase Web e VAPID configurados.
- Revalidar politica final de localizacao no Play Console antes de publicacao externa.

## Ordem Recomendada

1. Configurar os arquivos locais ignorados pelo Git com valores reais de ambiente.
2. Rodar `npm run preflight:production -- file=env/api.env file=env/admin.env`.
3. Revisar Supabase no SQL Editor.
4. Rodar `npm run mobile:local-check -- --api-config`.
5. Rodar `npm run mobile:local-check`.
6. Preencher `docs/operational-smoke-test-checklist.md`.
7. Preencher `docs/mobile-smoke-test-checklist.md`.
8. Publicar somente se os dois checklists ficarem aprovados sem exposicao de dados sensiveis.
