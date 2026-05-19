# FarmaDelivery

Sistema para controle online de entregas da Drogaria Santo Antonio, com painel web para administradores e loja, aplicativo Kotlin para motoboys Android e PWA para motoboys com iPhone.

## Objetivo

Substituir o controle manuscrito por um fluxo digital que registre clientes, enderecos, entregas, lojas, motoboys, status em tempo real, ocorrencias e historico operacional.

## Unidades

- Loja 1: Asturias, base principal dos motoboys das lojas 1 a 4
- Loja 2: Morrinhos
- Loja 3: Santa Rosa
- Loja 4: Santo Antonio
- Loja 5: Pereque, com motoboy dedicado

## Enderecos das unidades

- Asturias: Av. dos Caicaras, 1171 - Asturias
- Santa Rosa: Rua Jose Vaz Porto, 588 - proximo a Praca do Povo, Santa Rosa
- Morrinhos: Rua Poeta Augusto Frederico Schimidt, 10 - Jardim Brasil, Morrinhos
- Pereque: Av. Rio Amazonas, 151 - Praia do Pereque, Pereque
- Santo Antonio: Alameda das Tulipas, 660 - Santo Antonio

## Coordenadas das unidades

- Asturias: -24.003825377135037, -46.27390399967142
- Santa Rosa: -23.997109238797034, -46.281454771363265
- Morrinhos: -23.964168794468087, -46.248774250478476
- Pereque: -23.936657123533344, -46.18317681991032
- Santo Antonio: -23.988665940641404, -46.27191884702851

## Perfis de acesso

- Admin: acesso total, cadastro de lojas, usuarios, motoboys, relatorios, auditoria e configuracoes.
- Login de loja: acompanha e opera a propria unidade nos computadores da loja.
- Balconista/Caixa: cadastro de referencia operacional para informar quem conferiu/criou a entrega, sem login individual obrigatorio.
- Motoboy: recebe notificacoes, aceita/coleta entregas, envia localizacao, atualiza status e registra ocorrencias.

## Fluxo principal

1. Loja cria uma entrega informando telefone do cliente.
2. Sistema busca o cliente e seus enderecos cadastrados.
3. Atendente confirma ou cadastra endereco e informa seu nome na entrega para conferencia posterior.
4. Entrega entra na fila da loja.
5. Motoboys disponiveis da base correta recebem aviso.
6. Entregas ainda nao aceitas entram no quadro de despacho dos motoboys.
7. Motoboy escolhe a entrega levando em conta proximidade, horario, destino e rota.
8. Sistema registra hora de despacho quando o motoboy aceita.
9. Motoboy coleta na loja e muda status para "em rota".
10. Localizacao aparece no mapa para admins e lojas autorizadas.
11. Ao finalizar, motoboy marca como entregue ou registra problema.
12. Sistema registra hora de entrega e guarda historico por cliente, loja, motoboy e data.
13. Se a entrega for cancelada, o sistema registra motivo, muda status para cancelada e notifica o motoboy via Realtime/app.

Mesmo com o sistema online, as comandas/papeis preenchidos manualmente podem continuar existindo no balcão. O sistema passa a ser o controle operacional auditavel: quem criou, quem aceitou, quem cancelou, horarios, ocorrencias e historico.

## Campos iniciais da entrega

- Nome do cliente
- Telefone
- Endereco
- Numero
- Complemento: apartamento, casa, bloco, referencia
- Bairro
- Loja de origem
- Atendente/balconista que conferiu ou lancou a entrega
- Motoboy responsavel pela entrega quando aceitar/finalizar o pedido
- Observacoes internas
- Forma de pagamento, quando necessario para controle da loja
- Prioridade: normal, urgente, retorno/problema
- Agendamento: agora, hoje com horario, ou dia futuro com data e hora
- Hora de criacao
- Hora de despacho/aceite do motoboy
- Hora de entrega/finalizacao
- Loja sugerida para redirecionamento manual, quando o endereco estiver mais proximo de outra unidade

## Status sugeridos

- Rascunho
- Aguardando motoboy
- Aceita pelo motoboy
- Coletada
- Em rota
- Entregue
- Problema na entrega
- Cancelada

## Cancelamento

- Loja/admin pode cancelar entrega informando motivo.
- Sistema registra `canceledAt` automaticamente.
- Sistema cria evento `CANCELADA`.
- Se ja houver motoboy vinculado, o app deve receber notificacao e remover/atualizar a entrega da rota.
- A comanda fisica deve ser marcada manualmente conforme rotina da loja, mas o historico digital fica preservado.

## Recursos do painel web

- Criacao rapida de entrega
- Busca de cliente por telefone
- Cadastro de multiplos enderecos por cliente
- Quadro de entregas por status
- Mapa com lojas e motoboys
- Historico de entregas
- Relatorio por loja, motoboy, periodo e status
- Painel de ocorrencias
- Controle de usuarios e permissoes
- Roteiro das entregas ainda nao aceitas, agrupadas por regiao e horario
- Redirecionamento manual de loja, por exemplo mandar para Pereque quando fizer sentido operacional e houver produto

## Visao por perfil

- Admin: enxerga metricas gerais e separadas por loja, mapa geral, filas de todas as unidades, cadastros e permissoes.
- Loja: enxerga metricas, entregas, mapa e historico da propria unidade; esse e o login usado nos computadores da loja, como Asturias.
- Balconista/Caixa: aparece como nome de referencia na entrega para conferencia e auditoria, podendo ser selecionado mesmo quando estiver emprestado em outra loja; o motoboy continua registrado separadamente como responsavel pela entrega.
- Motoboy: enxerga entregas disponiveis para aceite, rota atual, coletas pendentes e entregas em andamento.
- Motoboy so recebe, visualiza na fila e aceita novas corridas quando esta disponivel; ao pausar para almoco ou sair do expediente deve marcar indisponivel. Logout tambem tenta desligar a disponibilidade. Entregas ja aceitas continuam visiveis para conclusao/ocorrencia.

## Cadastros do admin

- Lojas: nome, codigo, endereco, coordenadas, base compartilhada/dedicada e status operacional.
- Motoboys: nome, telefone, base, documentos internos, status, disponibilidade e permissao de localizacao.
- Acessos de loja: login/senha por unidade operacional, usado nos computadores da loja.
- Balconistas/Caixas: nome e loja de referencia para autocomplete na criacao da entrega e conferencia posterior.
- Gerentes/Responsaveis: acesso de leitura e controle operacional da loja ou grupo de lojas, sem visao geral de admin.

## Alocacao operacional de equipe

- O campo `User.storeId` continua representando a loja principal do usuario.
- O campo `Courier.baseStoreName` continua representando a base simples exibida para o motoboy.
- A tabela `UserStoreAssignment` registra vinculos de balconistas/caixas/gerentes com lojas, incluindo emprestimos temporarios.
- A tabela `CourierStoreAssignment` registra cobertura, rodizio e dedicacao de motoboys por loja.
- Tipos de alocacao: `BASE`, `TEMPORARIA`, `COBERTURA`, `DEDICADA` e `RODIZIO`.
- Ao criar um usuario com loja pelo admin, a API registra automaticamente a alocacao base.
- Ao criar um motoboy, a API registra automaticamente a cobertura inicial; lojas dedicadas, como Pereque, geram alocacao `DEDICADA`.

## Roteirizacao dinamica

A rota deve ser tratada como uma lista viva de paradas, nao como um trajeto fixo.

1. Entrega e criada com hora de criacao automatica.
2. Se for agendada, o sistema tambem salva a janela "a partir de" definida manualmente.
3. Motoboy aceita entregas disponiveis.
4. Ao aceitar, o sistema registra a hora de despacho automaticamente.
5. A rota inicial e calculada com coletas e entregas ja aceitas.
6. Se o motoboy passa por outra loja e aceita/coleta nova entrega, essa parada entra na rota atual.
7. O sistema recalcula a sequencia considerando tempo, proximidade, prioridade, horario agendado e seguranca.
8. O motoboy finaliza cada entrega; o sistema registra hora de entrega automaticamente.

Para funcionar bem, o backend deve guardar eventos em vez de sobrescrever tudo: entrega criada, aceita, coletada, rota recalculada, problema registrado e entrega finalizada. Isso cria auditoria e permite entender atrasos.

## Sugestao tecnica para rotas

- No MVP, usar OSRM ou GraphHopper para calcular tempo e distancia por vias reais.
- Para otimizar varias paradas, usar uma heuristica simples primeiro: horarios obrigatorios, prioridade, menor tempo ate a proxima parada e limite de atraso.
- Depois evoluir para um solver de VRP quando houver volume maior.
- Nunca inserir automaticamente uma coleta em outra loja se depender de estoque; o sistema pode sugerir, mas o humano confirma.

## Recursos dos apps de motoboy

Toda feature operacional nova de motoboy deve ser mantida em paridade entre:

- Android nativo Kotlin: `apps/motoboy`
- PWA iPhone: `apps/motoboy-pwa`

Quando o iOS/PWA tiver limitacao real, como geolocalizacao em segundo plano, a diferenca deve ficar documentada no checklist antes de seguir.

## Recursos do app Kotlin para motoboy

- Package Android: `com.drogsantoantonio.farmadelivery`
- Firebase Project ID: `farmadelivery-d40a9`
- Modulo inicial criado em `apps/motoboy`.
- `google-services.json` copiado para `apps/motoboy/app/google-services.json`.
- Login
- Status de disponibilidade
- Lista de entregas disponiveis
- Lista por rota/proximidade e horario agendado
- Aceitar entrega
- Check-in na loja
- Iniciar rota
- Confirmar entrega
- Registrar problema com observacao e foto opcional
- Compartilhamento de localizacao durante expediente/rota
- Pausa operacional para almoco/fim de expediente, bloqueando novas corridas ate reativar disponibilidade.
- Registro de token FCM do dispositivo para notificacoes futuras

## Recursos do PWA iPhone para motoboy

- Modulo criado em `apps/motoboy-pwa`.
- Instalavel no iPhone via Safari: Compartilhar -> Adicionar a Tela de Inicio.
- Login com o mesmo backend e sessao local.
- Lista de entregas disponiveis e entregas em atendimento.
- Aceitar, coletar, sair em rota, concluir e registrar problema.
- Foto opcional de comprovante via camera/galeria do iPhone.
- Envio manual de localizacao quando o PWA esta aberto.
- Toggle de envio automatico de localizacao enquanto o PWA esta aberto.
- Atualizacao automatica enquanto aberto, com notificacao local para novas entregas/alteracoes.
- Registro de token Web Push Firebase quando `VITE_FIREBASE_WEB_PUSH_VAPID_KEY` estiver configurada e o navegador suportar.
- Controle Ativar/Pausar disponibilidade, bloqueando aceite/GPS automatico quando indisponivel.
- Abertura de telefone e rota no app de mapas.
- Service worker e manifest configurados para instalacao.

## Mapa

Leaflet e gratuito como biblioteca open-source. O ponto de atencao sao os tiles do mapa: em prototipo pode usar OpenStreetMap, mas em producao e melhor escolher um provedor com termos adequados ao volume da farmacia.

## Stack inicial sugerida

- Web admin/loja: React, TypeScript, Vite
- Mapa web: Leaflet + React Leaflet
- Mobile motoboy: Kotlin Android nativo
- Motoboy iPhone: PWA React/Vite instalavel pela Tela de Inicio
- Backend: Fastify + TypeScript
- Banco: PostgreSQL com PostGIS para localizacao
- Autenticacao: JWT com perfis e permissoes
- Tempo real: Supabase Realtime no painel e Firebase Cloud Messaging no app mobile

## Estado atual

- Painel admin React/Vite implementado e validado com `npm run build`.
- API Fastify/TypeScript implementada e validada com `npm run build`.
- Autenticacao por token implementada.
- `POST /auth/bootstrap-admin`, `POST /auth/login` e `GET /auth/me` funcionam via fallback Supabase REST quando o Prisma nao alcanca o Postgres direto.
- Banco remoto esta acessivel pela API via Supabase REST server-side.
- A conexao direta do Prisma ainda deve usar a connection string do Supabase Transaction pooler em `DATABASE_URL`.
- Firebase Hosting web preparado para o target `drogstoantonio` no projeto `farmadelivery-d40a9`.
- App Kotlin dos motoboys iniciado em `apps/motoboy`, com login, fila de entregas, rota atual com abertura no app de mapas, envio manual/automatico de localizacao, cadastro de token FCM e recebimento de notificacoes operacionais.
- PWA iPhone dos motoboys iniciado em `apps/motoboy-pwa`, com login, fila de entregas, rota atual, acoes operacionais, GPS manual e comprovante fotografico opcional.
- Build debug, lint e teste unitario do app motoboy validados via Gradle Wrapper em `apps/motoboy`.
- Backend preparado com Firebase Admin SDK para enviar push de nova entrega disponivel, entrega agendada liberada por horario e cancelamento.
- Comprovantes fotograficos opcionais de entrega ficam associados a entrega e podem ser consultados no historico autenticado do painel.
- Healthcheck da API informa se o armazenamento local de comprovantes esta gravavel.

## Comandos de desenvolvimento

- Admin web: `npm run dev:admin`
- API: `npm run dev:api`
- PWA motoboy iPhone: `npm run dev:motoboy:pwa`
- Build geral: `npm run build`
- Testes automatizados iniciais de admin e API: `npm test`
- Deploy admin Firebase Hosting: `npm run deploy:admin`
- Deploy PWA motoboy Firebase Hosting: `npm run deploy:motoboy:pwa`
- O target `motoboy-pwa` aponta para o site Firebase Hosting `drogstoantonio-motoboy`; criar esse site uma vez no console ou com Firebase CLI antes do primeiro deploy, se ainda nao existir.
- Validar schema Prisma: `npm exec -w apps/api -- prisma validate --schema prisma/schema.prisma`
- Atualizar snapshot local do schema: `npm run db:schema:snapshot`
- Atualizar SQL consolidado: `npm run db:sql:full`
- Seed SQL para Supabase: `supabase/seed.sql`
- Seed dos horarios das lojas: `supabase/store-hours-seed.sql`
- Policies iniciais de RLS: `supabase/policies.sql`
- Ativar Realtime nas tabelas operacionais: `supabase/realtime.sql`
- Diagnosticar Realtime: `supabase/realtime-check.sql`
- SQL consolidado geral: `database/full-setup.sql`

Aplicacao de SQL, seed e policies deve ser feita manualmente no Supabase SQL Editor quando necessario.

## Variaveis de ambiente

- Use sempre os arquivos `.env` reais locais para rodar o projeto.
- `.env.example` deve conter apenas placeholders e exemplos.
- Nao copie chaves reais para `.env.example`.
- O frontend le apenas variaveis `VITE_*`.
- Chaves server-only, como service role do Supabase, ficam apenas no ambiente da API.

## Horario das lojas

- Todas as lojas abrem todos os dias, segunda a domingo.
- Asturias: 08:00 as 23:00.
- Morrinhos, Santa Rosa, Santo Antonio e Pereque: 08:00 as 22:00.
- Excecoes por data especifica ficam em `StoreDateOverride`, para datas comemorativas, festas de fim de ano, confraternizacao ou outros ajustes manuais.

## Supabase

Configuracao e cuidados com chaves estao em `docs/architecture.md` e `docs/supabase.md`.

## Firebase

- Projeto Firebase: `farmadelivery-d40a9`.
- Hosting target do painel web: `drogstoantonio`.
- Configuracao do hosting: `firebase.json` e `.firebaserc`.
- Deploy do painel web, quando estiver pronto: `firebase deploy --only hosting:drogstoantonio`.
- O snippet Firebase Web deve ser configurado por variaveis `VITE_FIREBASE_*` quando o painel passar a usar Analytics/Messaging no browser.

## Documentacao Tecnica

- **docs/codex/02_ARQUITETURA.md**: Documentacao tecnica completa com arquitetura, endpoints, models, autenticacao, etc.
- **README_TECNICO.md**: Resumo tecnico operacional do monorepo, banco, seguranca, migrations e regras de trabalho.
- **docs/codex/01_REGRAS_AGENTE.md**: Regras gerais inviolaveis do projeto
- **docs/codex/08_DIAGNOSTICO_AUTH.md**: Troubleshooting para erros 400/503 da autenticacao
- **docs/implementation-checklist.md**: Status detalhado de implementação
- **docs/architecture.md**: Decisões arquiteturais
- **docs/supabase.md**: Configuração e setup do Supabase
- **docs/lgpd.md**: Politicas iniciais de privacidade, minimizacao, auditoria e retencao

## Fases

### Fase 1: MVP operacional ✅

- ✅ Painel web para criar entrega
- ✅ Cadastro e busca de clientes por telefone
- ✅ Fila de entregas por loja
- ✅ Agendamento de entrega para mesmo dia ou dia seguinte
- ✅ Registro de hora de criacao, despacho e entrega
- ✅ Cadastro de motoboys
- ✅ Status manual das entregas
- ✅ Historico simples

### Fase 2: Tempo real e app motoboy ✅

- ✅ App Android para motoboys (Kotlin/Compose)
- ✅ PWA iPhone para motoboys
- ✅ Notificacoes de novas entregas (FCM)
- ✅ Status de disponibilidade
- ✅ Atualizacao de status pelo motoboy
- ✅ Aceite de entregas pelo proprio motoboy
- ✅ Sugestao de rotas com pre-rota e recalculo
- ✅ Mapa com localizacao em rota

### Fase 3: Controle e gestao ✅

- ✅ Relatorios operacionais com filtros e exportacao CSV
- ✅ Auditoria de alteracoes (actorUserId em eventos)
- ✅ Indicadores por loja e motoboy
- ✅ Alocacoes operacionais (emprestimo, cobertura, rodizio, dedicacao)
- ✅ Alertas visuais de atraso/SLA por prazo manual
- ✅ Comprovantes fotograficos de entrega

### Fase 4: Refinamento (em andamento)

- ✅ Exportacao de relatorios (local e server-side)
- ✅ Geocodificacao de enderecos com cache
- ⏳ Consolidar RLS para tabelas operacionais
- ⏳ Conectar rotina LGPD automatizada
- ❌ Deploy de producao (API, admin, PWA)
- ❌ Offline-first no app Android (avaliar necessidade)

## Estrutura atual

```text
FarmaDelivery/
  README.md
  README_TECNICO.md
  package.json               Monorepo root (workspaces: admin, api, motoboy-pwa)
  firebase.json              Hosting config (admin + motoboy-pwa)
  .firebaserc                Targets: drogstoantonio, drogstoantonio-motoboy
  google-services.json       Firebase Android config
  docs/
    codex/                   Regras, arquitetura, features, guia pratico
    implementation-checklist.md
    operational-contracts.md
    lgpd.md
    architecture.md
    supabase.md
    database-schema.sql
    database-next-steps.md
  apps/
    api/                     Fastify/TypeScript + Prisma + fallback REST
    admin/                   React/Vite/TypeScript painel admin/loja
    motoboy/                 Kotlin 2.2.21/Compose app Android
    motoboy-pwa/             React/Vite PWA para iPhone
  database/
    full-setup.sql           SQL consolidado (npm run db:sql:full)
  supabase/
    migrations/              7 migrations incrementais
    seed.sql                 Seed das 5 lojas
    store-hours-seed.sql     Horarios semanais
    policies.sql             RLS policies
    realtime.sql             Realtime config
  scripts/
    snapshot-db-schema.mjs
    build-full-sql.mjs
```
