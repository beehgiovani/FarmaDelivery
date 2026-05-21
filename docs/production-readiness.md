# Prontidao de Producao

Este resumo mostra o que ja esta coberto por automacao/localmente e o que ainda depende de validacao real antes de publicar. Nao registre aqui chaves, tokens, project IDs, enderecos reais, nomes reais de lojas ou credenciais.

## Pronto Localmente

- Testes automatizados do monorepo via `npm test`.
- Build web/API/PWA via `npm run build`.
- Checagem segura de arquivos sensiveis via `npm run repo:sensitive:check`.
- Auditoria estatica de RLS via `npm run db:rls:check`.
- Preflight de producao orquestrado por `npm run preflight:production -- file=env/api.env file=env/admin.env`.
- Preflight de producao validado localmente com arquivos `env/*.env` ignorados pelo Git, sem falhas bloqueantes.
- Probe do runner via `npm run preflight:production -- --probe-runner` para validar execucao de Node/npm no Windows antes do preflight completo.
- Preflight mobile local via `npm run mobile:local-check`.
- Conferencia isolada do alvo da API Android via `npm run mobile:local-check -- --api-config`.
- APK debug gerado pelo runner mobile em `apps\motoboy\app\build\outputs\apk\debug\app-debug.apk`.
- Checklists preenchiveis para smoke test operacional e mobile.

## Depende de Ambiente Real

- Ajustar os warnings do preflight que dependem do deploy real: URL publica da API, storage persistente de comprovantes, credencial Firebase Admin e configuracao Firebase Web completa.
- Conferir no Supabase SQL Editor se o banco aplicado esta alinhado ao `database/schema-full.sql` e ao resultado de `npm run db:rls:check`.
- Validar API publicada, armazenamento persistente de comprovantes e credencial Firebase Admin.
- Testar admin, login de loja, criacao de entrega, comanda, relatorios e notificacoes usando `docs/operational-smoke-test-checklist.md`.
- Testar Android em emulador/aparelho com API acessivel usando `docs/mobile-smoke-test-checklist.md`.
- Testar PWA iOS instalado pela Tela de Inicio com HTTPS, Firebase Web e VAPID configurados.
- Revalidar politica final de localizacao no Play Console antes de publicacao externa.

## Ordem Recomendada

1. Configurar os arquivos locais ignorados pelo Git com valores reais de ambiente.
2. Rodar `npm run preflight:production -- --probe-runner`.
3. Rodar `npm run preflight:production -- file=env/api.env file=env/admin.env`.
4. Revisar Supabase no SQL Editor.
5. Rodar `npm run mobile:local-check -- --api-config`.
6. Rodar `npm run mobile:local-check`.
7. Preencher `docs/operational-smoke-test-checklist.md`.
8. Preencher `docs/mobile-smoke-test-checklist.md`.
9. Publicar somente se os dois checklists ficarem aprovados sem exposicao de dados sensiveis.
