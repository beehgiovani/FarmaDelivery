# FarmaDelivery API

API HTTP do FarmaDelivery. Ela concentra autenticacao, permissoes, entregas, lojas, usuarios, motoboys, rotas, geocodificacao, relatorios, comprovantes, notificacoes e fallbacks de acesso ao Supabase.

Este app nao deve documentar nomes reais de lojas, enderecos, coordenadas, chaves, tokens, credenciais Firebase ou valores de ambiente.

## Stack

- Node.js.
- TypeScript.
- Fastify.
- Prisma.
- Supabase/PostgreSQL, com fallback REST onde a conexao direta nao estiver disponivel.
- Firebase Admin SDK para notificacoes push server-side.
- Zod para validacoes de entrada.
- Testes com `tsx --test` e `fastify.inject`.

## Escopo atual

- Healthcheck com validacao de armazenamento local de comprovantes.
- Login por email/telefone e senha.
- Sessao assinada pela API e validacao em `/auth/me`.
- Criacao do primeiro admin.
- Reset local de senha admin por CLI.
- Permissoes por perfil:
  - `ADMIN`: acesso geral.
  - `GERENTE`: login operacional de loja/unidade.
  - `MOTOBOY`: fluxo de entrega e localizacao.
  - `BALCONISTA_CAIXA`: referencia operacional/autocomplete, sem acesso autenticado operacional.
- Cadastro de usuarios via admin separa os fluxos:
  - `ADMIN`: login geral, sem loja vinculada.
  - `GERENTE`: login operacional da loja, com `storeId` obrigatorio.
  - `MOTOBOY`: login dedicado do app/campo, com `storeId` obrigatorio para criar motoboy e vinculo base inicial.
  - `BALCONISTA_CAIXA`: referencia de conferencia/autocomplete, sem senha operacional obrigatoria e sem loja obrigatoria.
- Criacao de entregas com cliente, endereco, prioridade, prazo manual, agendamento, atendente/balconista e numeracao diaria por loja.
- Cliente e enderecos sao reaproveitados pelo telefone; a criacao com cliente evita duplicar endereco igual para o mesmo cliente nos caminhos Prisma e Supabase REST.
- Geocodificacao via backend com cache e consultas progressivas.
- Entregas com e sem ponto de mapa.
- Transicoes operacionais: aceitar, coletar, sair em rota, entregar, problema e cancelar.
- Comprovante fotografico opcional com validacao de imagem, limite de tamanho, armazenamento local configuravel e download autenticado.
- Relatorios server-side, exportacao CSV e distribuicoes por loja, motoboy, balconista, status e prioridade.
- Rotas persistidas por motoboy, paradas e recalculo.
- Disponibilidade de motoboy e escopo de entregas conforme alocacao ativa.
- Cadastro e monitoramento de tokens FCM/Web Push sem expor tokens.
- Scheduler interno de notificacoes para entregas agendadas.
- Plano LGPD de dry-run e rotina Prisma segura para retencao/anonimizacao.

## Rotas principais

```text
src/routes/
  health.ts         Healthcheck
  deliveries.ts    Entregas, eventos, comprovantes e relatorios
  geocoding.ts     Geocodificacao autenticada
  notifications.ts Monitoramento administrativo de notificacoes
  routes.ts        Pre-rota, rotas de motoboy e paradas
  stores.ts        Lojas, horarios e escopo de unidades
  users.ts         Usuarios, motoboys, alocacoes e dispositivos
```

## Dados e persistencia

- Prisma usa `prisma/schema.prisma`.
- Seeds ficam em `prisma/seed.ts`.
- O SQL canonico do Supabase fica em `database/schema-full.sql`.
- Arquivos de comprovante ficam em diretorio configuravel por ambiente.

Quando houver alteracao de schema ou setup do banco, atualizar `database/schema-full.sql` e o snapshot de schema do projeto.

## Variaveis

Configurar em `.env` local, `env/*.env` ou no provedor de deploy, sem versionar valores reais.

- `DATABASE_URL`: conexao Prisma, preferencialmente pooler em producao/Supabase.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e variaveis relacionadas ao fallback REST.
- `API_SESSION_SECRET`: segredo de assinatura da sessao, com pelo menos 43 caracteres em producao.
- `DELIVERY_PROOF_STORAGE_DIR`: diretorio local de comprovantes.
- Variaveis Firebase Admin para push server-side.

Gerar segredo de sessao:

```bash
npm run secret:session
```

Antes de publicar, rode a checagem de ambiente na raiz do monorepo com os arquivos locais ignorados pelo Git:

```bash
npm run env:production:check -- file=env/api.env file=env/admin.env
```

## Comandos

Rodar em desenvolvimento:

```bash
npm run dev -w apps/api
```

Testar:

```bash
npm run test -w apps/api
```

Build/typecheck:

```bash
npm run build -w apps/api
```

Preflight completo de producao, a partir da raiz do monorepo:

```bash
npm run preflight:production -- file=env/api.env file=env/admin.env
```

Reset local de senha admin:

```bash
npm run admin:reset-password -w apps/api --
```

Dry-run LGPD:

```bash
npm run lgpd:dry-run -w apps/api --
```

Rotina LGPD conectada ao banco, em dry-run por padrao:

```bash
npm run lgpd:retention -w apps/api --
npm run lgpd:retention -w apps/api -- --apply
```

Prisma:

```bash
npm run prisma:generate -w apps/api
npm run prisma:migrate -w apps/api
npm run db:seed -w apps/api
```

## Cuidados

- Nao rodar SQL direto pelo terminal quando a manutencao exigir execucao manual no Supabase.
- Validar entradas antes de acessar banco, storage ou servicos externos.
- Manter testes de permissao com `fastify.inject` para impedir regressao de escopo.
- Nao retornar tokens, senhas, chaves ou caminhos absolutos em respostas publicas.
- Preservar fallback REST alinhado ao contrato Prisma quando novos endpoints surgirem.
