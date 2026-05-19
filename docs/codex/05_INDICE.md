# Indice de Documentacao - FarmaDelivery

Atualizado em 2026-05-17.

## Comece Aqui

1. `docs/codex/00_LEIA_ME_PRIMEIRO.md`: status atual, bloqueadores e proximos passos.
2. `docs/codex/01_REGRAS_AGENTE.md`: regras gerais e especificas do projeto.
3. `docs/implementation-checklist.md`: progresso real de implementacao.
4. `README.md`: visao geral, setup e comandos principais.

## Documentacao Principal

| Doc | Funcao | Quando usar |
| --- | --- | --- |
| `docs/codex/00_LEIA_ME_PRIMEIRO.md` | Status operacional | Ao iniciar uma sessao |
| `docs/codex/01_REGRAS_AGENTE.md` | Regras universais e locais | Antes de codificar |
| `docs/codex/02_ARQUITETURA.md` | Arquitetura tecnica | Ao alterar backend, frontend ou mobile |
| `docs/codex/04_FEATURES_MOTOBOY.md` | Roadmap do app Kotlin | Ao iniciar o modulo motoboy |
| `docs/codex/06_GUIA_PRATICO.md` | Setup e troubleshooting | Ao rodar localmente |
| `docs/codex/07_RESUMO_SESSAO.md` | Resumo de sessoes | Para recuperar contexto |
| `docs/codex/08_DIAGNOSTICO_AUTH.md` | Auth e banco | Quando login/bootstrap falhar |

## Referencias Gerais

| Doc | Funcao |
| --- | --- |
| `README.md` | Visao geral do produto, comandos, Firebase e deploy |
| `README_TECNICO.md` | Resumo tecnico operacional do monorepo, banco, seguranca e migrations |
| `ESTRUTURA.md` | Organizacao sistemica, localizacao de arquivos e fluxo arquitetural |
| `docs/architecture.md` | Decisoes arquiteturais consolidadas |
| `docs/supabase.md` | Configuracao Supabase, pooler e scripts manuais |
| `docs/database-next-steps.md` | Proximos passos de banco |
| `docs/database-schema.sql` | Snapshot SQL do schema |
| `docs/implementation-checklist.md` | Checklist de implementacao |
| `docs/operational-contracts.md` | Contratos entre apps (status, prioridades, eventos) |
| `docs/lgpd.md` | Politicas iniciais LGPD |

## Fluxos de Leitura

### Backend/API

1. `docs/codex/01_REGRAS_AGENTE.md`
2. `docs/codex/02_ARQUITETURA.md`
3. `docs/supabase.md`
4. `docs/implementation-checklist.md`

### Frontend Admin

1. `docs/codex/01_REGRAS_AGENTE.md`
2. `docs/codex/02_ARQUITETURA.md`
3. `README.md`
4. `docs/lgpd.md`

### Mobile Motoboy (Android)

1. `docs/codex/01_REGRAS_AGENTE.md`
2. `docs/codex/04_FEATURES_MOTOBOY.md`
3. `docs/codex/02_ARQUITETURA.md`
4. `docs/supabase.md`

### PWA Motoboy (iPhone)

1. `docs/codex/01_REGRAS_AGENTE.md`
2. `docs/codex/04_FEATURES_MOTOBOY.md` (paridade de features)
3. `docs/operational-contracts.md`

### Banco/Supabase

1. `docs/supabase.md`
2. `docs/database-next-steps.md`
3. `docs/database-schema.sql`
4. `database/full-setup.sql`

## Regras Rapidas

- Nao rodar SQL pelo terminal; preparar scripts para execucao manual no SQL Editor do Supabase.
- Usar envs reais locais para rodar; `.env.example` deve conter apenas placeholders.
- Nao expor secrets no frontend, docs ou logs.
- Atualizar o checklist quando um item mudar de estado.
- Rodar build/typecheck depois de mudancas relevantes.

## Proximas Atualizacoes Esperadas

- Consolidar policies RLS para tabelas operacionais.
- Conectar rotina LGPD automatizada de retencao/anonimizacao.
- Adicionar `COMMENT ON TABLE`/`COMMENT ON COLUMN` no banco.
- Deploy de producao da API, admin e PWA.
- Smoke test visual do app Android em device real.
- Web Push real no PWA iOS apos VAPID key e HTTPS.
