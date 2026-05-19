# README Tecnico - FarmaDelivery

Atualizado em 2026-05-17.

Este documento resume a aplicacao FarmaDelivery em nivel tecnico. Ele deve ser lido junto com:

- `README.md`
- `docs/implementation-checklist.md`
- `docs/codex/01_REGRAS_AGENTE.md`
- `docs/codex/02_ARQUITETURA.md`
- `docs/supabase.md`
- `docs/lgpd.md`
- `docs/operational-contracts.md`
- `C:\Users\bruno\AndroidStudioProjects\governance`

## Regra de trabalho

Antes de implementar qualquer feature:

1. Ler o contexto local.
2. Verificar se ja existe algo parecido.
3. Reutilizar e centralizar logica existente.
4. Implementar somente o solicitado ou o proximo passo aprovado.
5. Preservar seguranca, privacidade, permissao e auditoria.
6. Atualizar docs/checklist quando mudar comportamento, schema, setup ou fluxo.
7. Rodar build, typecheck ou teste aplicavel.

Nao fazer "vibe code". Nao inventar contexto. Nao expor secrets.

## Objetivo do sistema

Digitalizar o controle de entregas da Drogaria Santo Antonio, mantendo historico operacional de:

- cliente e telefone;
- enderecos reutilizaveis;
- loja de origem;
- motoboy responsavel;
- status da entrega;
- horarios de criacao, aceite/despacho, coleta, rota, entrega e cancelamento;
- ocorrencias e auditoria.

## Monorepo

```text
FarmaDelivery/
  apps/
    admin/   Painel web React para admin, loja, balconista/caixa.
    api/     API Fastify com Prisma e fallback Supabase REST.
    motoboy/ Android Kotlin nativo para motoboys.
    motoboy-pwa/ PWA React/Vite para motoboys com iPhone.
  database/  SQL consolidado para bootstrap/referencia.
  docs/      Documentacao tecnica, checklist, LGPD e Supabase.
  env/       Arquivos locais de ambiente, nao publicar secrets.
  scripts/   Geradores de snapshot SQL e SQL consolidado.
  supabase/  Migrations, policies, realtime e seeds.
```

## Stack

- Frontend web: React, TypeScript, Vite, Leaflet, React Leaflet, lucide-react.
- Backend: Fastify, TypeScript, Zod, Prisma.
- Banco: PostgreSQL/Supabase.
- Tempo real: Supabase Realtime.
- Mobile motoboy Android: Android nativo com Kotlin.
- Mobile motoboy iPhone: PWA React/Vite instalavel pela Tela de Inicio.
- Notificacoes mobile planejadas: Firebase Cloud Messaging.

## Identidade visual

- Usar sempre o logo real da Drogaria Santo Antonio Guaruja nos clientes visuais.
- O admin usa `apps/admin/public/assets/drogaria-santo-antonio-logo.png`.
- O PWA motoboy usa o mesmo logo em `apps/motoboy-pwa/public/assets/drogaria-santo-antonio-logo.png` e nos icones do manifest.
- O app Android motoboy usa o mesmo logo em `apps/motoboy/app/src/main/res/drawable-nodpi/drogaria_santo_antonio_logo.png`.
- Nao substituir por desenho, monograma ou placeholder; quando precisar de icone/app icon, derivar a partir do logo real.
- Cores base: azul `#275397` e vermelho `#ed1f2b`/`#EF2B2D`, com neutros claros para fundo e superficies.

Versoes exatas devem ser lidas em `package.json`, `apps/admin/package.json` e `apps/api/package.json`.

## Seguranca

- O frontend usa apenas variaveis publicas `VITE_*`.
- Service role, JWT secret, senha de banco e chaves privadas ficam somente no backend/local env.
- Sessao e assinada pela API.
- Rotas principais exigem token.
- Backend valida role, loja, motoboy e ownership.
- Balconista/caixa opera no escopo da loja vinculada, salvo alocacao temporaria documentada.
- Motoboy opera a propria localizacao, as entregas disponiveis e as entregas aceitas por ele.
- Dados sensiveis devem ser minimizados e mascarados em exportacoes quando possivel.
- Exportacoes CSV devem neutralizar valores iniciados por `=`, `+`, `-`, `@`, tab ou carriage return para evitar interpretacao como formula em planilhas.
- A neutralizacao CSV fica centralizada em `apps/admin/src/csv.ts` no frontend e possui teste unitario direto alem dos testes das exportacoes.
- O mapeamento frontend de status/prioridade entre API e UI fica em `apps/admin/src/apiMappers.ts`, com testes para conversao de status, prioridade e preservacao de rotulos desconhecidos em relatorios.
- O painel admin centraliza a exibicao de paradas de rota em `apps/admin/src/routeStopDisplay.ts`, com fallback para tipo da parada quando a API nao envia contexto de entrega.
- Contratos operacionais compartilhados entre API, admin, PWA e Android ficam documentados em `docs/operational-contracts.md`; novos status, prioridades, tipos de parada, eventos e acoes devem atualizar API, mapeadores/helpers dos clientes e testes antes de entrar em uso.

## Autenticacao

Fluxo atual:

1. Admin cria usuarios.
2. Primeiro admin pode ser criado via bootstrap enquanto nao houver admin ativo.
3. Login retorna token assinado.
4. Frontend valida sessao com `/auth/me`.
5. `401` limpa sessao local.

Reset local de senha admin:

```bash
npm run admin:reset-password -- password=NovaSenhaSegura
npm run admin:reset-password -- password=NovaSenhaSegura email=admin@exemplo.com
```

O reset usa o mesmo hash `scrypt` da API. Se houver mais de um admin ativo e nenhum `email`, `telefone` ou `id` for informado, o script recusa a operacao para evitar trocar a senha da pessoa errada. Ele tenta Prisma primeiro e cai para Supabase REST server-side quando a conexao direta com o Postgres nao estiver acessivel.

Perfis:

- `ADMIN`
- `GERENTE`
- `BALCONISTA_CAIXA`
- `MOTOBOY`

## Banco e migrations

Fonte de verdade local:

- Prisma schema: `apps/api/prisma/schema.prisma`
- Snapshot SQL: `docs/database-schema.sql`
- SQL consolidado: `database/full-setup.sql`
- Migrations incrementais: `supabase/migrations/*.sql`

Comandos:

```bash
npm exec -w apps/api -- prisma validate --schema prisma/schema.prisma
npm exec -w apps/api -- prisma generate --schema prisma/schema.prisma
npm run db:schema:snapshot
npm run db:sql:full
```

SQL deve ser aplicado manualmente no Supabase SQL Editor. Nao rodar migration direto contra producao sem conferencia.

## Migrations atuais

Ordem incremental relevante:

1. `supabase/migrations/20260514011500_init_farmadelivery.sql`
2. `supabase/migrations/20260514013000_store_hours.sql`
3. `supabase/migrations/20260515041000_assignments.sql`
4. `supabase/migrations/20260515052000_courier_device_tokens.sql`
5. `supabase/migrations/20260515054000_delivery_notification_event.sql`
6. `supabase/migrations/20260515193000_delivery_proofs.sql`
7. `supabase/migrations/20260517120000_delivery_deadline_tier.sql`
8. `supabase/store-hours-seed.sql`
9. `supabase/policies.sql`
10. `supabase/realtime.sql`

Para banco zerado, usar `database/full-setup.sql` como referencia consolidada.

## Modelo operacional principal

- `Store`: lojas/unidades.
- `StoreWeeklyHours`: horario padrao semanal.
- `StoreDateOverride`: excecoes por data.
- `User`: usuarios internos.
- `Courier`: dados operacionais do motoboy.
- `CourierDeviceToken`: tokens FCM ativos dos dispositivos dos motoboys.
- `UserStoreAssignment`: alocacao de usuario em loja, incluindo emprestimo temporario.
- `CourierStoreAssignment`: cobertura, rodizio ou dedicacao de motoboy por loja.
- `Customer`: cliente por telefone.
- `CustomerAddress`: multiplos enderecos do cliente.
- `Delivery`: entrega.
- `Delivery.deadlineTier`: prazo operacional manual escolhido no lancamento (`PERTO` 60/90 min, `MEDIO` 90/120 min, `LONGE` 120/180 min). O sistema sinaliza amarelo no primeiro limite e vermelho apos o segundo, sem automatizar por distancia.
- `DeliveryEvent`: historico auditavel da entrega.
- `DeliveryProof`: comprovante fotografico opcional da entrega.
- `CourierRoute`: rota viva do motoboy.
- `RouteStop`: parada de coleta ou entrega.

## Alocacao de lojas e motoboys

Regra atual:

- Asturias e base principal da operacao compartilhada das lojas 1 a 4.
- Pereque possui regra de motoboy dedicado, mas pode receber rodizio/emprestimo.
- Motoboys nao devem ser tratados como fixos de loja, exceto quando houver alocacao `DEDICADA`.
- Balconistas/caixas podem ser emprestados para outra loja via alocacao temporaria.

Tipos:

- `BASE`: vinculo principal.
- `TEMPORARIA`: emprestimo com inicio/fim.
- `COBERTURA`: cobertura operacional.
- `DEDICADA`: dedicacao especifica, caso Pereque.
- `RODIZIO`: escala alternada.

Endpoints administrativos:

- `GET /assignments`: lista alocacoes ativas.
- `GET /assignments?includeInactive=true`: lista alocacoes ativas e encerradas para historico administrativo.
- `POST /assignments/users`: cria alocacao para usuario de loja.
- `POST /assignments/couriers`: cria alocacao para motoboy.
- `PATCH /assignments/:type/:assignmentId/end`: encerra alocacao ativa.
- `GET /notifications/summary`: resumo administrativo de push, tokens e envios recentes auditados. Aceita `limit` de 1 a 100 para controlar a quantidade de eventos recentes.

O painel admin usa esses endpoints na secao "Emprestimo e rodizio".
Quando o historico esta aberto, o painel aplica filtros locais por loja, pessoa, periodo, tipo de pessoa, status e regra da alocacao sobre as alocacoes retornadas.
O historico filtrado pode ser exportado em CSV para conferencia administrativa sem expor dados de senha ou tokens; o arquivo inclui contexto de exportacao com filtros e contagem carregada/visivel.

Escopo operacional:

- Balconista/caixa acessa a loja principal (`User.storeId`) e as lojas com `UserStoreAssignment` ativa no periodo atual.
- O backend aplica esse escopo em lojas, entregas, relatorios, criacao de entregas e alteracoes operacionais.
- O escopo de lojas possui testes para admin irrestrito, motoboy vinculado a loja e balconista/caixa com ou sem lojas ativas.
- Motoboy acessa entregas ja aceitas por ele e entregas aguardando das lojas com `CourierStoreAssignment` ativa.
- A pre-rota do motoboy tambem respeita cobertura, rodizio e dedicacao ativa por loja.
- Motoboy so deve receber notificacao de nova corrida, visualizar fila aguardando e aceitar entrega quando `Courier.available=true`; Android e PWA possuem controle explicito Ativar/Pausar, tentam enviar `available=false` no logout e limpam GPS automatico local quando o motoboy fica indisponivel. Entregas ja vinculadas ao motoboy continuam acessiveis mesmo indisponivel.
- Admin e gerente continuam com escopo amplo no estado atual do projeto.

## Realtime

`supabase/realtime.sql` publica tabelas operacionais. Publicar tabela nao libera acesso por si so: RLS continua controlando leitura.

Antes de expor novos dados no browser/mobile, revisar:

- policies;
- escopo por token;
- risco LGPD;
- necessidade real da feature.

## Frontend admin

Responsabilidades:

- login e primeiro admin;
- dashboard;
- metricas por loja/geral;
- criacao de entrega;
- busca de cliente por telefone;
- mapa Leaflet;
- fila de entregas;
- impressao de comanda termica 80mm/58mm pelo dialogo de impressao do navegador;
- rota/estrategia;
- relatorios;
- painel de gestao.

Regras:

- UI nao decide permissao final.
- UI nao acessa secrets.
- Loading, empty, error e fatal states devem existir em fluxos relevantes.
- Impressora termica de rede deve estar instalada no Windows/maquina da loja para aparecer no dialogo do navegador. Impressao ESC/POS direta por IP exige um servico local seguro e fica fora do browser puro.
- A largura da comanda termica e preferencia local do navegador da loja; a API continua sendo a fonte do codigo real da entrega.
- A numeracao publica da entrega e diaria por loja no formato `LOJA-AAAAMMDD-001`, gravando tambem `storeDailyDate` e `storeDailyNumber` para auditoria e unicidade no banco.
- A fila e a comanda mostram o numero diario separado, por exemplo `N. dia 009`, para uso rapido no balcao e na conferencia de papeis.

## Apps de motoboy

Regra de paridade: toda feature operacional nova criada para o app Kotlin Android deve ter equivalente no PWA iPhone, e vice-versa. Exemplos: entregas, rota, comprovante, ocorrencia, historico, localizacao, notificacoes e fluxos de sessao.

Excecoes so valem quando a plataforma limita tecnicamente o recurso. Hoje as principais limitacoes conhecidas sao o PWA iPhone nao oferecer rastreamento de localizacao em segundo plano com a mesma confiabilidade do Android nativo e o Web Push depender de HTTPS, instalacao/suporte do navegador e `VITE_FIREBASE_WEB_PUSH_VAPID_KEY`. O PWA envia GPS manualmente ou automaticamente enquanto esta aberto, faz atualizacao automatica/local notification em primeiro plano e registra token Web Push quando suportado; diferencas devem ficar documentadas em `docs/implementation-checklist.md`.

Rotas no PWA:

- A URL do Google Maps usa apenas paradas pendentes e limita Android/PWA ao primeiro trecho continuo suportado pelo limite de waypoints, evitando pular paradas quando a rota tem mais de 9 paradas pendentes.
- Android e PWA possuem teste garantindo que a URL direta de Maps e a URL retornada pelo segmento calculado permanecem equivalentes.
- Android e PWA tambem possuem teste direto para a ordenacao centralizada de paradas pendentes antes da montagem da rota.
- Android e PWA fazem `trim` no endereco usado como ponto do Maps quando a parada nao possui coordenadas, evitando URLs com espacos sobrando.
- Android e PWA ignoram na URL do Maps paradas sem coordenadas e sem endereco navegavel, mantendo a parada visivel na tela para correcao operacional sem gerar link quebrado.
- No PWA, `buildRouteMapsSegment` tambem monta a URL a partir do trecho ja calculado, evitando reprocessar filtro/ordenacao depois que as paradas incluidas foram definidas.
- No Android, a tela de rota e a montagem do Maps usam a mesma funcao `pendingStopsInSequence`, evitando divergencia entre lista exibida e paradas enviadas ao Maps.
- A tela Android tambem usa a mesma regra do PWA para renderizar apenas rotas `ABERTA`/`EM_ANDAMENTO` com paradas pendentes.
- Android e PWA exibem status da rota com helper testado, mantendo fallback legivel para status novos.
- Android e PWA exibem tipo da parada de rota com helper testado, mantendo fallback legivel para tipos novos.
- Android e PWA formatam agendamento da parada de rota no fuso `America/Sao_Paulo`, evitando ISO cru nas listas de rota.
- Android e PWA exibem codigo publico, cliente e status da entrega nas paradas de rota quando a API retorna esse contexto, mantendo fallback para tipo da parada.
- A tela Android de rota tambem informa quando o Maps abre apenas o primeiro trecho e quantas paradas continuam pendentes para depois; o texto do aviso fica em funcao testada para manter pluralizacao e exibicao consistentes.
- O PWA usa a mesma abordagem para o aviso de trecho parcial, com helper testado para exibir apenas quando restarem paradas fora do primeiro trecho.
- Android e PWA alternam o label entre `Abrir Maps` e `Abrir trecho no Maps` conforme a rota cabe inteira ou precisa ser dividida em trecho parcial.
- A navegacao Android tambem possui teste para URL segura do Google Maps quando nao ha parada pendente.
- Quando nao ha parada pendente, o PWA abre uma URL segura do Google Maps sem destino.

Comandos:

```bash
npm run dev:motoboy:pwa
npm run build -w apps/motoboy-pwa
npm run deploy:motoboy:pwa
```

O PWA motoboy usa Firebase Web Analytics do projeto `farmadelivery-d40a9` e Firebase Hosting no site `drogstoantonio-motoboy`, mapeado pelo target local `motoboy-pwa`.

## Docker

O projeto possui um ambiente Docker de desenvolvimento para subir API, painel admin e PWA motoboy ao mesmo tempo, usando os arquivos locais de `env/` em runtime. Segredos nao entram na imagem por causa do `.dockerignore`.

Servicos:

- API: `http://localhost:3333`
- Admin/loja: `http://localhost:5173`
- PWA motoboy: `http://localhost:5174`

Comandos:

```bash
npm run docker:up
npm run docker:ps
npm run docker:logs
npm run docker:down
```

O Docker Desktop precisa estar aberto antes de rodar esses comandos. Se aparecer erro de conexao com `dockerDesktopLinuxEngine`, o daemon do Docker ainda nao iniciou.

O compose usa `env/api.env` para a API e `env/admin.env` para os clientes Vite. Para teste local no navegador, `VITE_API_URL` fica como `http://localhost:3333`, porque esse endereco e resolvido pelo navegador da maquina, nao de dentro do container.

Esse ambiente nao substitui o Supabase local completo. No estado atual, ele foi pensado para subir todos os servicos da aplicacao contra o Supabase configurado nos `.env` locais, mantendo o fallback REST server-side da API quando a conexao Prisma direta ainda depender do pooler.

## API

Responsabilidades:

- autenticar e assinar token;
- validar entrada com Zod;
- aplicar permissao e escopo;
- escrever dados no Prisma ou fallback Supabase REST;
- registrar eventos/auditoria;
- proteger regras de negocio do frontend.

Rotas principais documentadas em `docs/codex/02_ARQUITETURA.md`.

## App Kotlin

Modulo inicial criado em `apps/motoboy`. Deve seguir `docs/codex/04_FEATURES_MOTOBOY.md`.

Base esperada:

- package `com.drogsantoantonio.farmadelivery`;
- login com o backend atual;
- lista de entregas disponiveis;
- aceite/coleta/inicio de rota/entrega/problema;
- envio de localizacao durante expediente/rota;
- notificacao de nova entrega e cancelamento;
- armazenamento offline minimo quando necessario.

Estado atual do modulo Android:

- Gradle Kotlin DSL em `apps/motoboy`.
- Gradle Wrapper configurado em `apps/motoboy` com Gradle 9.5.1, compile/target SDK 36 e JBR do Android Studio.
- JDK 26 localizado em `C:\Program Files\Microsoft\jdk-26.0.1`, mas nao adotado no `gradle.properties` porque falhou no `jlink` ao transformar o `core-for-system-modules.jar` do Android 36.
- Tema Compose com cores do logo.
- `google-services.json` em `apps/motoboy/app/google-services.json`.
- Cliente Retrofit com token Bearer.
- DataStore para token local.
- Modelos de auth, entrega, motoboy e rota.
- Repositorios para auth, entregas, motoboy e rotas.
- Use cases iniciais de login, buscar entregas e aceitar entrega.
- Telas Compose iniciais de login e lista de entregas.
- Estados de loading, vazio, erro/retry e atualizacao manual nas telas de entregas e rota.
- Ciclo operacional inicial no app: aceitar, coletar, sair em rota, entregar e registrar problema.
- Android e PWA separam entregas disponiveis e entregas em atendimento pela mesma regra testada: disponivel apenas `AGUARDANDO_MOTOBOY`; em atendimento apenas `ACEITA_PELO_MOTOBOY`, `COLETADA`, `EM_ROTA` e `PROBLEMA`.
- Android e PWA formatam a data exibida no card da entrega no fuso `America/Sao_Paulo`, com helper testado e fallback compacto.
- Android e PWA exibem status de entrega no card com helper testado, mantendo fallback legivel para status novos.
- Android e PWA exibem prioridade de entrega no card com helper testado, mantendo fallback legivel para prioridades novas.
- Conclusao de entrega em rota exige confirmacao textual no app e envia essa observacao para o backend.
- Conclusao de entrega em rota exige apenas confirmacao textual; foto e opcional. Quando anexada, a imagem e enviada ao endpoint `POST /deliveries/:deliveryId/proofs` e vinculada ao evento `ENTREGUE`.
- No PWA, o payload de conclusao fica centralizado em `apps/motoboy-pwa/src/deliveryCompletion.ts` para omitir `proofId` quando nenhuma foto opcional foi enviada.
- App motoboy comprime o comprovante fotografico localmente antes do upload, mantendo limite compativel com a API.
- API valida assinatura real do arquivo de comprovante e rejeita conteudo que nao bata com o `mimeType` declarado.
- API tenta remover o arquivo fisico do comprovante quando nao consegue registrar a linha `DeliveryProof` no banco.
- Upload de comprovante usa limite explicito de body para suportar base64 de foto ate 4 MB sem cair no limite padrao do Fastify.
- Payload de comprovante valida formato base64 antes de decodificar e gravar arquivo.
- API usa `DELIVERY_PROOF_STORAGE_DIR` para definir onde salvar fotos de comprovante; sem configuracao, usa `./uploads/delivery-proofs`.
- `/health` verifica se o armazenamento de comprovantes esta gravavel e retorna apenas status operacional, sem expor caminho local.
- Painel admin/loja consulta `GET /deliveries/:deliveryId/proofs` junto do historico e abre imagens por `GET /deliveries/:deliveryId/proofs/:proofId/file`, sempre com token autenticado.
- Listagem `GET /deliveries` retorna `proofCount`, usado pelo painel para sinalizar entregas com comprovante.
- Resumo `GET /reports/deliveries-summary` retorna `deliveredWithProof` e `deliveredWithoutProof` para auditoria operacional. O endpoint aceita `date` para um dia especifico ou `startsAt`/`endsAt` para intervalo; o painel usa um periodo proprio de relatorio, separado do filtro diario do mapa, com atalhos para hoje, ultimos 7 dias e mes atual.
- A agregacao do resumo operacional fica centralizada em `apps/api/src/deliveryReport.ts`, com testes para periodo, comprovantes e distribuicoes.
- `GET /reports/deliveries-export` gera CSV server-side com o mesmo escopo, periodo e filtros do resumo, telefone mascarado e limite operacional configuravel. O padrao e 5000 entregas, e `exportLimit` aceita ate 20000 linhas. Os filtros aceitos sao `status`, `priority` e `proof` (`com` ou `sem`).
- O fallback Supabase REST dos relatorios preserva escopo de loja e filtros de status/prioridade, com teste unitario cobrindo balconista/caixa e admin.
- O fallback Supabase REST das rotas preserva escopo de pre-rota e listagem por perfil, devolvendo `stops` e `delivery` no mesmo contrato usado pelo Prisma, com testes para motoboy, balconista/caixa e admin.
- O painel de relatorios possui filtros por status, prioridade e comprovante; os cards, listas e CSV respeitam a visao filtrada.
- A visao do relatorio mostra distribuicoes por loja, motoboy, status e prioridade.
- Exportacao CSV de relatorios inclui contexto da exportacao, limite aplicado, filtros aplicados, resumo operacional, distribuicoes por loja/motoboy/status/prioridade, colunas de comprovante e telefone mascarado para auditoria fora do painel. O painel envia os filtros e o limite escolhido para a exportacao server-side e usa exportacao local apenas como contingencia quando a API falha numa visao filtrada ja carregada.
- Download de comprovante usa `Cache-Control: private, no-store` e `X-Content-Type-Options: nosniff`, e a API confere leitura do arquivo antes de iniciar o stream.
- Nome de arquivo no `Content-Disposition` do comprovante e sanitizado antes de ser enviado ao navegador.
- Consulta de historico auditavel da entrega no app motoboy via `GET /deliveries/:deliveryId/events`; no PWA, essa consulta possui loading, erro com retry e vazio por entrega, sem disparar chamadas duplicadas durante o carregamento. Android e PWA invalidam o cache local do historico apos acoes operacionais; no PWA, se o historico estiver aberto, ele recarrega automaticamente.
- Android e PWA exibem o responsavel do evento quando `actor.name` estiver disponivel, com helpers testados para nomes ausentes ou vazios.
- Android e PWA exibem tipos de evento do historico com helpers testados e fallback para eventos novos sem expor underscores crus na interface.
- Android e PWA normalizam observacoes do historico antes de renderizar, ocultando notas vazias e removendo espacos sobrando.
- Android e PWA formatam o horario do historico no fuso `America/Sao_Paulo` por helpers testados e mantem fallback compacto quando a API retornar data fora do formato esperado.
- A montagem da API fica centralizada em `apps/api/src/app.ts` por `createApp()`, permitindo testes HTTP com `fastify.inject` sem subir servidor real; `server.ts` apenas cria o app, escuta a porta e fecha Prisma/Fastify no shutdown.
- Os testes HTTP iniciais cobrem healthcheck, `x-request-id`, rejeicao 401 sem token, rejeicao 403 por perfil sem permissao e validacao de payload antes de acionar banco.
- Os testes HTTP tambem cobrem que motoboy nao consegue atualizar localizacao, disponibilidade, token de dispositivo, aceitar entrega em nome de outro motoboy, criar entrega simples/com cliente, cancelar entrega, acessar relatorios/exportacoes, consultar geocodificacao ou gerenciar lojas/horarios.
- Card de entrega do app motoboy possui acoes nativas para abrir discador e mapa do aparelho; Android e PWA preferem coordenadas no mapa e usam endereco com `trim` apenas quando nao houver coordenadas.
- O telefone enviado ao discador e normalizado por helpers testados para conter apenas digitos em Android e PWA, evitando problemas com mascara visual.
- Tela Compose de rota atual com paradas pendentes vindas de `GET /courier-routes` e atalho para abrir direcoes no app de mapas.
- Painel de localizacao manual com permissao Android e envio para `POST /couriers/location`.
- `LocationTrackingService` em foreground para envio periodico de localizacao a cada 60 segundos, ativado pelo motoboy, com estado local persistido e interrompido no logout.
- Registro automatico do token FCM no login/home do motoboy via `POST /couriers/{courierId}/device-token`.

Notificacoes:

- A API ja armazena o token FCM ativo por motoboy em `CourierDeviceToken`.
- Motoboy so pode registrar token para o proprio `courierId`; admin/gerente tambem podem registrar para suporte operacional.
- O token FCM nao deve aparecer em logs, telas ou documentacao.
- O backend envia push FCM no cancelamento de entrega quando `notifyCourier` esta ativo e a entrega possui motoboy vinculado.
- O backend envia push FCM de nova entrega para motoboys disponiveis com `CourierStoreAssignment` ativa na loja, quando a entrega nao esta agendada para horario futuro.
- Entregas agendadas sao processadas por um worker interno da API quando `earliestDispatchAt` chega; ao enviar, a API registra `DeliveryEvent` do tipo `NOTIFICACAO_ENVIADA` para evitar disparo duplicado.
- Credencial Firebase Admin deve ficar apenas no backend por `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, trio `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`, ou `GOOGLE_APPLICATION_CREDENTIALS`.
- O app Android possui canal `deliveries`, `FirebaseMessagingService` e pedido de permissao `POST_NOTIFICATIONS` em Android 13+.
- O worker pode ser desativado com `SCHEDULED_DELIVERY_NOTIFICATION_WORKER=false` ou ter intervalo ajustado por `SCHEDULED_DELIVERY_NOTIFICATION_INTERVAL_MS`.
- O painel admin consulta `GET /notifications/summary` para monitorar configuracao Firebase Admin, worker, tokens ativos/inativos e falhas recentes sem expor tokens dos dispositivos.
- O painel admin exporta eventos recentes de push em CSV para auditoria, mantendo tokens de dispositivo fora da tela e do arquivo; o arquivo inclui apenas o resumo agregado de tokens por plataforma.
- O seletor de eventos recentes do monitor de push usa `limit` no backend, com trava maxima de 100 eventos por requisicao.
- O monitor de push possui filtro local de problemas, destacando eventos com falha, token inativado ou motoboy sem token; o CSV exporta apenas a visao filtrada.
- O monitor de push tambem permite filtrar eventos por loja quando o evento auditado possui loja associada.
- O monitor de push permite filtrar eventos por periodo usando `createdAt`; a exportacao CSV respeita loja, problema e periodo selecionados.
- O monitor de push permite filtrar eventos por tipo de notificacao auditada.
- O monitor de push mostra a contagem de eventos visiveis versus carregados e possui acao para limpar filtros sem alterar o limite de busca.
- O resumo administrativo de push agrega tokens por plataforma (`android`, `web` ou desconhecida), exibindo apenas contagens ativas/inativas.
- O resumo administrativo de push tambem lista dispositivos por motoboy com identificador interno, plataforma, base, status ativo/inativo e ultimo contato, sem retornar o token FCM/Web Push.
- O CSV de auditoria do monitor de push inclui contexto de exportacao com data/hora, filtros aplicados, contagem de eventos carregados/visiveis e dispositivos por motoboy sem expor tokens.

O build debug local foi validado dentro de `apps/motoboy` com:

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:lintDebug
.\gradlew.bat :app:testDebugUnitTest
```

O lint Android ficou sem issues apos ajustes de FCM token refresh e regras de backup/data extraction.

## Validacao antes de fechar task

Checklist minimo:

- schema valido quando banco mudar;
- Prisma Client regenerado quando schema mudar;
- snapshot e SQL consolidado atualizados quando migration mudar;
- build/testes adequados executados;
- docs/checklist atualizados;
- migration informada ao usuario para rodar no Supabase.
