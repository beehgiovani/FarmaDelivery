# Contratos operacionais entre apps

Atualizado em 2026-05-19.

Este documento registra a "lingua comum" entre API, painel admin/loja, PWA motoboy e app Android motoboy. A API continua sendo a fonte do dado operacional; os clientes devem somente traduzir valores tecnicos para exibicao, mantendo fallback seguro para valores novos.

## Fonte de verdade

- API valida payloads, filtros e transicoes em `apps/api/src/contracts.ts` e nas rotas de `apps/api/src/routes`.
- Painel admin centraliza conversoes em `apps/admin/src/apiMappers.ts`.
- PWA motoboy centraliza exibicao em helpers `apps/motoboy-pwa/src/*Labels.ts`, `deliverySections.ts` e `routeNavigation.ts`.
- Android motoboy centraliza exibicao em helpers de `apps/motoboy/app/src/main/kotlin/.../presentation/ui/screens/*Labels.kt`, `DeliverySections.kt` e `RouteNavigation.kt`, sem depender de nomes de pacote em documentacao publica.

## Valores compartilhados

Status de entrega:

- `RASCUNHO`
- `AGUARDANDO_MOTOBOY`
- `ACEITA_PELO_MOTOBOY`
- `COLETADA`
- `EM_ROTA`
- `ENTREGUE`
- `PROBLEMA`
- `CANCELADA`

Prioridade de entrega:

- `NORMAL`
- `URGENTE`
- `RETORNO`

Prazo manual da entrega:

- `PERTO`: amarelo aos 60 min, vermelho apos 90 min.
- `MEDIO`: amarelo aos 90 min, vermelho apos 120 min.
- `LONGE`: amarelo aos 120 min, vermelho apos 180 min.

Status de rota:

- `ABERTA`
- `EM_ANDAMENTO`
- `FINALIZADA`
- `CANCELADA`

Status de parada:

- `PENDENTE`
- `CONCLUIDA`
- `PULADA`
- `CANCELADA`

Tipo de parada:

- `COLETA`
- `ENTREGA`

Contexto opcional de entrega em parada de rota:

Quando `GET /courier-routes` ou `POST /courier-routes/recalculate` retornarem uma parada vinculada a entrega, `stop.delivery` deve usar o mesmo formato em Prisma e fallback Supabase REST:

```json
{
  "id": "delivery-id",
  "publicCode": "AST-20260517-001",
  "customer": "Nome do cliente",
  "status": "EM_ROTA"
}
```

Clientes devem usar esse contexto apenas para exibicao. Quando `delivery` vier `null` ou ausente, admin, PWA e Android devem manter fallback legivel pelo tipo da parada (`COLETA`/`ENTREGA`) e nunca quebrar a tela.

Numeracao diaria da entrega:

- `publicCode` segue o formato `LOJA-AAAAMMDD-001`, usando o codigo da loja, a data operacional em `America/Sao_Paulo` e o numero sequencial do dia naquela loja.
- `storeDailyDate` deve trafegar como `YYYY-MM-DD`.
- `storeDailyNumber` deve trafegar como numero inteiro; clientes formatam para exibicao com 3 digitos (`001`, `002`, `003`).
- Listagem, criacao, relatorio/exportacao e respostas de transicao de entrega devem preservar `publicCode`, `storeDailyDate` e `storeDailyNumber` para evitar perda visual do "N. dia" apos aceitar, coletar, sair em rota, entregar, registrar problema ou cancelar.

Detalhes operacionais de pagamento:

- Enquanto nao houver campo/tabela propria de pagamento, a criacao de entrega envia os detalhes em `notes`.
- O painel deve montar `notes` com linhas padronizadas: `Valor: R$ 00,00`, `Pagamento: Cartao|QR Code|Pix pago|Conta` ou `Pagamento: Dinheiro - sem troco|troco para R$ 00,00`.
- API, admin, PWA motoboy, Android motoboy e comanda termica devem preservar e exibir `notes` como texto operacional de conferencia, mantendo quebras de linha.
- O motoboy deve conseguir ver valor, forma de pagamento e troco antes e durante o atendimento da entrega.
- Quando o schema evoluir, esses dados devem migrar para campos estruturados sem quebrar a leitura de entregas antigas que ainda tenham pagamento em `notes`.

Praca de atendimento do motoboy:

- Emprestimos ocasionais de motoboy nao dependem de UI administrativa nem de nova tabela.
- O motoboy escolhe a praca no app/PWA ao operar: `ASTURIAS` ou `PEREQUE`.
- `ASTURIAS` lista entregas aguardando de todas as lojas exceto lojas cujo nome normalize para `pereque`; `PEREQUE` lista apenas essas lojas.
- A API aceita `serviceArea` em `GET /deliveries`, `POST /deliveries/accept`, historico e comprovantes para manter listagem, aceite e leitura alinhados.
- Entregas ja aceitas pelo proprio motoboy continuam visiveis independentemente da praca escolhida.
- A escolha de praca persiste em `Courier.preferredServiceArea` via PWA, app Android e API, mantendo o direcionamento de push server-side mesmo apos reinicio da API.

Conclusao de entrega e comprovante:

- Para concluir uma entrega em rota, o app deve enviar `deliveryId` e uma confirmacao textual em `notes`.
- Foto e opcional. Quando existir, o app envia primeiro `POST /deliveries/:deliveryId/proofs` e depois manda o `proofId` em `POST /deliveries/deliver`.
- Quando nao houver foto, o cliente deve omitir `proofId`; a API deve concluir a entrega normalmente e registrar o evento `ENTREGUE`.
- O painel admin deve tratar entregas com e sem comprovante como estados validos para relatorio e auditoria.

Eventos de entrega exibidos no historico:

- `CRIADA`
- `AGENDADA`
- `REDIRECIONADA`
- `ACEITA`
- `COLETADA`
- `ROTA_RECALCULADA`
- `OCORRENCIA_REGISTRADA`
- `ENTREGUE`
- `CANCELADA`
- `NOTIFICACAO_ENVIADA`

## Regra de evolucao

Quando adicionar novo status, prioridade, evento, tipo de parada ou acao operacional:

1. Atualizar validacao/contrato da API quando o valor entrar por payload ou filtro.
2. Atualizar mapeadores do admin em `apps/admin/src/apiMappers.ts`.
3. Atualizar helpers equivalentes do PWA e do Android quando o valor aparecer para motoboy.
4. Adicionar ou ajustar testes de contrato nos tres clientes afetados.
5. Atualizar este documento e `implementation-checklist.md`.
6. Se houver mudanca de schema, criar migration/SQL e entregar para aplicacao manual no Supabase SQL Editor.

## Observacao sobre banco

A feature de prazo manual altera banco de dados com a coluna `Delivery.deadlineTier`. O bloco correspondente fica incorporado em `database/schema-full.sql`, que e o arquivo canonico para aplicacao manual no Supabase SQL Editor.
