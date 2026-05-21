# Documentacao FarmaDelivery

Este diretorio contem a documentacao tecnica canonica do projeto. A regra e manter poucos arquivos, cada um com uma responsabilidade clara, evitando duplicidade entre READMEs, guias temporarios e historicos de sessao.

## Documentos Canonicos

| Arquivo | Finalidade |
| --- | --- |
| `../README.md` | Visao geral publica do produto, stack, estrutura e comandos principais. |
| `engineering-guidelines.md` | Regras de engenharia, seguranca, documentacao, Supabase e fluxo de trabalho. |
| `architecture.md` | Arquitetura atual, apps, backend, banco, realtime, mobile e fluxos principais. |
| `supabase.md` | Uso do Supabase, SQL canonico, connection string, RLS, realtime e checks manuais. |
| `production-runbook.md` | Roteiro de preflight, deploy e smoke tests finais sem expor dados sensiveis. |
| `mobile-smoke-test-checklist.md` | Checklist preenchivel para teste real Android/PWA iOS sem registrar dados sensiveis. |
| `implementation-checklist.md` | Estado detalhado de implementacao e validacoes ja realizadas. |
| `operational-contracts.md` | Contratos compartilhados entre API, admin, Android e PWA. |
| `lgpd.md` | Politicas de privacidade, retencao, anonimizacao e cuidados com dados pessoais. |
| `database-schema.sql` | Snapshot SQL do schema Prisma para referencia tecnica. |

## Documentacao por Aplicacao

| Arquivo | Finalidade |
| --- | --- |
| `../apps/api/README.md` | API Fastify, rotas, testes, ambiente e banco. |
| `../apps/admin/README.md` | Painel web admin/loja. |
| `../apps/motoboy/README.md` | App Android do motoboy. |
| `../apps/motoboy-pwa/README.md` | PWA do motoboy para iPhone/browser. |

## Regras de Manutencao

- As regras universais ficam em `C:\Users\bruno\AndroidStudioProjects\governance` e devem ser aplicadas tambem neste projeto.
- Nao criar docs temporarios, legados ou de sessao sem necessidade real.
- Antes de adicionar um novo `.md`, verificar se o conteudo pertence a um documento canonico existente.
- Atualizar `implementation-checklist.md` quando uma entrega mudar de estado.
- Atualizar `supabase.md` e `database/schema-full.sql` quando houver mudanca de schema, seed, RLS, realtime ou comentario SQL.
- Manter exemplos sem secrets, dados reais sensiveis, chaves, tokens ou credenciais.
