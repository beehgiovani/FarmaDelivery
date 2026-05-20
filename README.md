# FarmaDelivery

FarmaDelivery e um monorepo para gestao operacional de entregas em uma rede de farmacias. O projeto centraliza o cadastro de entregas, o acompanhamento por unidade, a conferencia de balconistas/caixas, a operacao de motoboys, relatorios administrativos e integracoes de geolocalizacao, push e backend.

Este README descreve o produto, a stack, a estrutura do repositorio e os fluxos principais. Dados sensiveis, nomes reais de lojas, enderecos, coordenadas, chaves e arquivos locais de ambiente nao devem ser documentados aqui.

## Produto

O sistema foi desenhado para separar tres responsabilidades:

- Administracao geral: visualizacao ampla, cadastros, relatorios, configuracoes e auditoria operacional.
- Operacao de loja: login por unidade para lancar e acompanhar entregas daquela loja.
- Conferencia operacional: identificacao de quem criou/conferiu a entrega e de quem realizou a entrega.

No fluxo operacional, o computador da loja usa um login da propria unidade. Ao criar uma entrega, o usuario informa o balconista/caixa responsavel por autocomplete a partir dos profissionais cadastrados. Esse cadastro funciona como referencia operacional e pode ser usado entre unidades quando houver apoio temporario de funcionarios.

## Stack

- Monorepo: npm workspaces.
- Backend API: Node.js, TypeScript, Fastify, Prisma e Supabase.
- Admin web: React, Vite, TypeScript e CSS modularizado por componentes.
- Mobile Android: Kotlin, Gradle e integracoes Firebase.
- Banco e autenticacao operacional: Supabase/PostgreSQL.
- Push e servicos mobile: Firebase Cloud Messaging.
- Testes: `tsx --test` nos workspaces TypeScript e Kotlin/JUnit no app Android.
- Qualidade: TypeScript, builds por workspace, testes automatizados e scripts auxiliares.

## Aplicacoes

- `apps/api`: API HTTP, autenticacao, permissoes, entregas, relatorios, geocodificacao, rotas e integracoes com Supabase.
- `apps/admin`: painel administrativo web para operacao, cadastros, relatorios, lojas, usuarios e acompanhamento.
- `apps/motoboy`: aplicativo Android/Gradle para fluxo do motoboy, entregas, eventos de localizacao e push.
- `apps/motoboy-pwa`: PWA React/Vite para fluxo do motoboy em iPhone/browser.

## Perfis e permissoes

- `ADMIN`: acesso geral para visualizacao, gestao, cadastros e relatorios.
- `GERENTE`: login operacional da loja/unidade, usado nos computadores da unidade.
- `MOTOBOY`: usuario de entrega, vinculado ao fluxo mobile e a execucao das entregas.
- `BALCONISTA_CAIXA`: referencia operacional para conferencia; nao e tratado como login de loja.

O cadastro de balconistas/caixas serve para registrar quem criou ou conferiu uma entrega. O cadastro nao deve limitar a pessoa a uma unica loja durante o lancamento, pois funcionarios podem apoiar outras unidades.

## Fluxo operacional

1. A unidade acessa o sistema com o login da loja.
2. A entrega e criada com dados do cliente, telefone, endereco, forma de pagamento e observacoes.
3. O balconista/caixa responsavel e informado por autocomplete.
4. A entrega entra no fluxo de separacao, despacho, acompanhamento e conclusao.
5. O motoboy responsavel registra o andamento e a finalizacao.
6. O admin acompanha a operacao por status, unidade, responsavel, periodo e indicadores.

## Banco e dados

O projeto usa Supabase/PostgreSQL com Prisma como camada de schema e acesso. O SQL canonico para preparar ou realinhar o banco fica em `database/schema-full.sql`; dados reais de lojas, coordenadas, enderecos, chaves e credenciais devem permanecer fora do README.

Coordenadas de loja, quando necessarias, devem ser tratadas como dados de cadastro ou ambiente operacional, nao como informacao publica de documentacao.

## Ambiente e segredos

Arquivos sensiveis e artefatos locais nao devem ser versionados:

- `.env` e variantes locais.
- `env/`.
- `google-services.json`.
- builds como `dist/`, `build/`, APKs e AABs.
- `node_modules/`.
- logs e arquivos temporarios.
- cache local do Supabase e Gradle.

Use `.env.example` e documentacao tecnica para indicar variaveis esperadas sem expor valores reais.

O arquivo `.firebaserc` versionado e um template seguro. Antes de publicar no Firebase Hosting, configure localmente o Project ID e os targets reais com a CLI do Firebase, mantendo esses valores fora da documentacao publica quando identificarem ambiente real.

Para uso com Docker Compose local, crie arquivos ignorados pelo Git em `env/api.env` e `env/admin.env` a partir dos exemplos versionados:

- `apps/api/.env.example` para `env/api.env`.
- `apps/admin/.env.example` para `env/admin.env`.
- `apps/motoboy-pwa/.env.example` tambem pode complementar `env/admin.env` quando o PWA usar Firebase/Web Push no compose.

## Estrutura do repositorio

```text
FarmaDelivery/
  apps/
    api/        API Fastify, Prisma, Supabase e regras de negocio
    admin/      Painel web React/Vite para administracao e operacao
    motoboy/    Aplicativo Android/Kotlin do motoboy
    motoboy-pwa/ PWA React/Vite do motoboy
  docs/         Documentacao tecnica, checklists e guias de implementacao
  database/     SQL canonico e referencias de banco
  scripts/      Automacoes e utilitarios do projeto
```

## Comandos principais

Os comandos npm cobrem os workspaces JavaScript/TypeScript: `apps/admin`, `apps/api` e `apps/motoboy-pwa`. O app `apps/motoboy` e Android/Kotlin e deve ser executado pelos comandos Gradle dentro da propria pasta do app.

Instalar dependencias:

```bash
npm install
```

Rodar todos os testes:

```bash
npm test
```

Build completo:

```bash
npm run build
```

Checar variaveis antes de deploy, sem imprimir valores sensiveis:

```bash
npm run env:production:check -- file=env/api.env file=env/admin.env
```

Essa checagem falha se o `API_SESSION_SECRET` estiver ausente, for placeholder ou tiver menos de 43 caracteres.
Arquivos informados com `file=` que nao existirem aparecem como warning para evitar typo silencioso no preflight.
URLs de Supabase/API tambem sao validadas para evitar valores sem formato de URL ou frontend apontando para endereco local em producao.
`DATABASE_URL` gera warning quando nao for PostgreSQL com usuario, senha, host e `sslmode=require`.
A checagem tambem evita confundir chave server-side do Supabase com chave publishable do frontend.
O diretorio de comprovantes gera warning quando parece caminho local/efemero, pois em producao precisa ser persistente.
Quando a VAPID key do PWA estiver configurada, a checagem tambem avisa se a configuracao Firebase Web minima para Messaging estiver incompleta.
A credencial Firebase Admin tambem e revisada sem exibir valores, aceitando JSON, base64 do JSON, trio de variaveis ou `GOOGLE_APPLICATION_CREDENTIALS`.

Autotestar o precheck de producao com cenarios falsos:

```bash
npm run env:production:check:self-test
```

Gerar um `API_SESSION_SECRET` seguro para ambiente local/deploy:

```bash
npm run secret:session
```

Rodar testes do admin:

```bash
npm run test -w apps/admin
```

Build do admin:

```bash
npm run build -w apps/admin
```

## Preflight de producao

Antes de publicar uma versao, confira nesta ordem:

1. Gerar um `API_SESSION_SECRET` novo com `npm run secret:session` e configurar o valor apenas no ambiente da API.
2. Configurar `DATABASE_URL` com pooler do Supabase e manter service role/secret key somente no backend.
3. Configurar `DELIVERY_PROOF_STORAGE_DIR` em armazenamento persistente ou migrar comprovantes para storage externo antes de depender de containers efemeros.
4. Configurar uma credencial Firebase Admin no backend para FCM HTTP v1; a VAPID/Web Push key do frontend nao substitui essa credencial.
5. Configurar `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e, no PWA, `VITE_FIREBASE_WEB_PUSH_VAPID_KEY`.
6. Rodar `npm run env:production:check -- file=env/api.env file=env/admin.env` sem imprimir valores sensiveis.
7. Rodar `npm run db:rls:check`, `npm test` e `npm run build`.
8. Conferir no Supabase SQL Editor se o banco aplicado esta alinhado ao `database/schema-full.sql`.

## Documentacao complementar

- `docs/README.md`: indice canonico da documentacao tecnica.
- `docs/engineering-guidelines.md`: regras de engenharia, seguranca, Supabase e manutencao.
- `docs/architecture.md`: arquitetura atual do monorepo.
- `docs/supabase.md`: setup Supabase e uso do SQL canonico.
- `docs/implementation-checklist.md`: checklist de implementacao e validacao.
- `docs/operational-contracts.md`: contratos entre API, admin, Android e PWA.
- `docs/lgpd.md`: privacidade, retencao e cuidados com dados pessoais.

Ao atualizar a documentacao, mantenha o README como visao publica e objetiva do projeto. Detalhes sensiveis ou operacionais devem ficar em arquivos locais, ambiente seguro ou documentacao interna controlada.
