# FarmaDelivery

FarmaDelivery e um monorepo para gestao operacional de entregas em uma rede de farmacias. O projeto centraliza o cadastro de entregas, o acompanhamento por unidade, a conferencia de balconistas/caixas, a operacao de motoboys, relatórios administrativos e integrações de geolocalizacao, push e backend.

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
- Testes: Vitest para API/admin e testes Kotlin/JUnit no app Android.
- Qualidade: TypeScript, lint por workspace, testes automatizados e scripts auxiliares.

## Aplicacoes

- `apps/api`: API HTTP, autenticacao, permissoes, entregas, relatorios, geocodificacao, rotas e integracoes com Supabase.
- `apps/admin`: painel administrativo web para operacao, cadastros, relatorios, lojas, usuarios e acompanhamento.
- `apps/motoboy`: aplicativo Android/Gradle para fluxo do motoboy, entregas, eventos de localizacao e push.
- `packages/shared`: tipos, schemas, validacoes e contratos compartilhados entre API, admin e mobile.

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

O projeto usa Supabase/PostgreSQL com Prisma como camada de schema e acesso. Migrations, scripts e documentacao tecnica ficam no repositorio, mas dados reais de lojas, coordenadas, enderecos, chaves e credenciais devem permanecer fora do README.

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

## Estrutura do repositorio

```text
FarmaDelivery/
  apps/
    api/        API Fastify, Prisma, Supabase e regras de negocio
    admin/      Painel web React/Vite para administracao e operacao
    motoboy/    Aplicativo Android/Kotlin do motoboy
  packages/
    shared/     Tipos, schemas e contratos compartilhados
  docs/         Documentacao tecnica, checklists e guias de implementacao
  database/     Scripts SQL e referencias de banco
  scripts/      Automacoes e utilitarios do projeto
  supabase/     Configuracao local e migrations do Supabase
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

Rodar testes do admin:

```bash
npm run test -w apps/admin
```

Build do admin:

```bash
npm run build -w apps/admin
```

## Documentacao complementar

- `docs/implementation-checklist.md`: checklist de implementacao e validacao.
- `README_TECNICO.md`: detalhes tecnicos e operacionais.
- `ESTRUTURA.md`: mapa expandido do repositorio.
- `MOBILE_SUMMARY.md`: resumo do aplicativo Android.
- `SUPABASE_REST.md`: notas de integracao Supabase REST.

Ao atualizar a documentacao, mantenha o README como visao publica e objetiva do projeto. Detalhes sensiveis ou operacionais devem ficar em arquivos locais, ambiente seguro ou documentacao interna controlada.
