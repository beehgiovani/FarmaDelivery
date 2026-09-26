# FarmaDelivery

Monorepo de um sistema independente para organizar entregas de farmácias. A mesma base reúne API, painel administrativo, aplicativo Android e PWA para motoboys, com contratos compartilhados para lojas, entregas, rotas e eventos operacionais.

> **Estado atual:** MVP técnico demonstrável. Há testes, builds e verificações de segurança locais, mas ainda faltam homologação contínua em uma operação real, smoke test ponta a ponta no ambiente final e validação das políticas de localização, notificações e retenção de dados.

O projeto não alega adoção comercial nem métricas de resultado.

## Aplicações

| Caminho | Responsabilidade | Stack principal |
| --- | --- | --- |
| `apps/api` | API, autenticação, regras de entrega, eventos e integrações | Fastify, TypeScript, Prisma |
| `apps/admin` | Operação de lojas, cadastros, entregas, rotas e relatórios | React, Vite, Leaflet |
| `apps/motoboy` | Fluxo de campo, GPS, comprovante e notificações | Kotlin, Jetpack Compose |
| `apps/motoboy-pwa` | Alternativa web instalável para o fluxo do entregador | React, Vite, PWA, Firebase |

## Escopo funcional

- cadastro de lojas, usuários, motoboys e áreas de atendimento;
- criação, atribuição e acompanhamento de entregas;
- histórico de eventos em vez de apenas substituição de status;
- rota composta por coletas e entregas, com ajuste quando entram novas paradas;
- painel com mapa, operação e relatórios;
- localização do motoboy durante disponibilidade ou atendimento;
- comprovante opcional e registro de ocorrências;
- notificações via Firebase Cloud Messaging;
- cliente Android e PWA consumindo a mesma API.

## Arquitetura

```text
admin ───────────────┐
motoboy Android ─────┼──► API Fastify ───► PostgreSQL / Supabase
motoboy PWA ─────────┘          │                    │
                                ├── Prisma           ├── RLS / Realtime
                                ├── Supabase REST    └── Storage privado
                                └── Firebase Admin ───► FCM
```

- `database/schema-full.sql` é a referência SQL versionada para schema, seeds, RLS, Realtime e comentários.
- `docs/architecture.md` descreve os fluxos e as decisões vigentes.
- `docs/operational-contracts.md` registra os contratos que precisam permanecer compatíveis entre os quatro clientes.

## Stack

- Node.js, npm workspaces e TypeScript;
- Fastify, Zod, Prisma e PostgreSQL/Supabase;
- React 19, Vite, Leaflet e PWA;
- Kotlin, Jetpack Compose, Retrofit/OkHttp e DataStore;
- Firebase Cloud Messaging;
- Docker Compose, testes automatizados e scripts de preflight.

## Requisitos

- Node.js em versão LTS e npm compatível com o `package-lock.json`; o repositório ainda não declara `engines` e deve fixar a faixa suportada antes de produção;
- Docker e Docker Compose, opcionais para executar os serviços web em conjunto;
- Android Studio, JDK e Android SDK compatíveis com `apps/motoboy`, somente para o cliente Android;
- projetos próprios de Supabase e Firebase para testar integrações externas.

## Instalação

```bash
npm ci
npm run prisma:generate -w apps/api
```

Em ambientes que bloqueiam scripts de instalação de dependências, como a política `allow-scripts` do npm 11, a geração explícita do Prisma Client é necessária antes dos testes da API.

Cada aplicação possui um arquivo `.env.example`. Copie somente o modelo necessário para um arquivo local ignorado pelo Git e substitua os placeholders no seu próprio ambiente. Os READMEs dentro de `apps/` detalham as variáveis de cada cliente.

Execução separada durante o desenvolvimento:

```bash
npm run dev:api
npm run dev:admin
npm run dev:motoboy:pwa
```

Para subir API, painel e PWA com Docker, crie localmente `env/api.env` e `env/admin.env` e então execute:

```bash
npm run docker:up
```

Os arquivos em `env/` não entram no Git.

## Testes e verificações

```bash
npm test
npm run build
npm run repo:sensitive:check
npm run db:rls:check
```

`npm test` agrega autotestes de configuração e segurança às suítes dos workspaces. Um resultado verde comprova somente o que foi automatizado; a operação real continua dependente de banco, Storage, push, dispositivos, rede e permissões.

Na auditoria de 26/09/2026, após `npm ci` e a geração explícita do Prisma Client, `npm test` e `npm run build` passaram com Node.js 24.19.0 e npm 11.17.0. Isso registra o ambiente verificado, mas não substitui a definição formal da versão suportada.

Para o Android:

```powershell
npm run mobile:local-check
```

Ou, dentro de `apps/motoboy`:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:lintDebug
.\gradlew.bat :app:assembleDebug
```

Antes de um deploy, use arquivos de ambiente locais e siga o preflight documentado:

```bash
npm run preflight:production -- file=env/api.env file=env/admin.env
```

## Configuração segura

Variáveis prefixadas por `VITE_` chegam ao navegador e não podem conter segredos. URL do Supabase, chave publicável e VAPID pública só são seguras quando as permissões efetivas continuam no backend e nas políticas de RLS.

Mantenha exclusivamente no backend ou no gerenciador de segredos do deploy:

- `DATABASE_URL`, `DIRECT_URL` e senhas do banco;
- `API_SESSION_SECRET`;
- secret key/service role do Supabase;
- credenciais Firebase Admin e chaves privadas;
- arquivos de assinatura Android.

Não versione `.env`, `google-services.json`, service accounts, tokens, dados reais de clientes, endereços operacionais, fotos de comprovante ou artefatos de build. O repositório contém verificações automáticas para parte desses riscos, mas elas não substituem revisão humana e rotação de credenciais.

## Privacidade e operação

Localização, telefone, endereço e comprovante podem ser dados pessoais. Uma implantação real exige finalidade definida, minimização, retenção, controle de acesso, registro de consentimento quando aplicável e atendimento à LGPD. A política operacional está detalhada em [`docs/lgpd.md`](docs/lgpd.md).

O rastreamento Android deve funcionar apenas no contexto informado ao motoboy, com foreground service visível e encerramento no logout ou na indisponibilidade. A declaração de permissões sensíveis precisa ser revalidada antes de publicação na Play Store.

## Limites conhecidos

- Build aprovado não equivale a homologação com usuários, GPS, push e conectividade reais.
- O `npm audit` de 26/09/2026 reportou 25 ocorrências na árvore instalada (1 crítica, 12 altas, 10 moderadas e 2 baixas), incluindo dependências diretas e transitivas. Elas precisam ser triadas e atualizadas com novos testes antes de qualquer publicação.
- A API pública, o armazenamento de comprovantes e as credenciais Firebase precisam ser validados no ambiente final.
- O fluxo completo — criar, atribuir, coletar, rotear, concluir e auditar — ainda requer smoke test recorrente.
- As versões Android e PWA precisam continuar compatíveis com os contratos da API.

## Roadmap e documentação

- [Status e próximos passos](STATUS_E_PROXIMOS_PASSOS.md)
- [Índice da documentação](docs/README.md)
- [Arquitetura](docs/architecture.md)
- [Prontidão de produção](docs/production-readiness.md)
- [Runbook de produção](docs/production-runbook.md)
- [Checklist operacional](docs/operational-smoke-test-checklist.md)
- [Checklist mobile](docs/mobile-smoke-test-checklist.md)

Esses documentos distinguem automação aprovada de testes manuais ainda pendentes.
