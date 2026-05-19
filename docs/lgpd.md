# Politicas LGPD - FarmaDelivery

Atualizado em 2026-05-15.

Este documento define as politicas iniciais de privacidade para dados pessoais usados pelo FarmaDelivery. Ele complementa `engineering-guidelines.md` e deve ser revisado antes de novas features que exponham cliente, telefone, endereco, localizacao ou auditoria operacional.

## Dados pessoais tratados

- Cliente: nome, telefone e endereco de entrega.
- Usuario interno: nome, email, telefone, perfil, loja vinculada e status.
- Motoboy: usuario vinculado, disponibilidade, localizacao atual e horario da ultima localizacao.
- Entrega: cliente, telefone, endereco, loja, motoboy, status, horarios e historico de eventos.

## Base operacional

O uso dos dados deve ficar limitado a:

- criar e acompanhar entregas;
- localizar endereco e loja de atendimento;
- rotear motoboy e registrar ocorrencias;
- auditar operacoes internas;
- emitir relatorios operacionais necessarios.

## Minimizacao e exibicao

- Exibir dados completos somente quando forem necessarios para a operacao da entrega.
- Relatorios e exportacoes devem mascarar telefone por padrao.
- Exportacoes CSV devem neutralizar valores iniciados por `=`, `+`, `-`, `@`, tab ou carriage return para reduzir risco de formula injection em planilhas.
- Dados server-only e credenciais nunca devem aparecer no frontend, logs, docs ou arquivos de exemplo.
- `.env.example` deve manter apenas placeholders.

## Retencao inicial

- Entregas e eventos devem ser mantidos enquanto forem necessarios para auditoria operacional, suporte e conferencia financeira.
- Localizacao do motoboy deve representar estado operacional atual; historico detalhado de localizacao nao deve ser criado sem finalidade documentada.
- Uma rotina final de retencao deve ser definida antes de producao, incluindo prazos por tipo de dado e processo de exclusao/anonimizacao.

### Matriz operacional de retencao

Esta matriz e uma politica inicial para orientar produto, API e scripts futuros. Os prazos devem ser confirmados com responsavel juridico/operacional antes de producao.

| Dado | Modelos/tabelas | Prazo inicial | Acao apos prazo | Observacoes |
| --- | --- | --- | --- | --- |
| Sessao operacional de entrega | `Delivery`, `DeliveryEvent`, `RouteStop`, `CourierRoute` | 24 meses apos conclusao/cancelamento | Anonimizar cliente, telefone, endereco livre e notas; manter status, loja, motoboy, datas e agregados operacionais | Preserva historico para conferencia, SLA, ocorrencias e suporte sem expor dados pessoais desnecessarios. |
| Comprovantes de entrega | `DeliveryProof` e arquivo em storage local/Supabase | 180 dias apos `deliveredAt` | Excluir arquivo binario e manter apenas metadados minimos de auditoria (`sha256`, tamanho, data, ator, entrega) se ainda houver base operacional | O arquivo pode conter imagem de ambiente, documento, assinatura ou outro dado pessoal sensivel. |
| Cliente e enderecos cadastrados | `Customer`, `CustomerAddress` | 24 meses sem nova entrega vinculada | Anonimizar nome, telefone e complemento/referencia; desativar endereco quando aplicavel | Antes de anonimizar, verificar se ainda existe entrega aberta ou pendencia de suporte. |
| Localizacao atual do motoboy | `Courier.currentLat`, `Courier.currentLng`, `Courier.lastLocationAt` | Enquanto houver disponibilidade/operacao ativa | Limpar coordenadas quando motoboy ficar indisponivel por periodo prolongado ou encerrar sessao operacional | Nao criar historico detalhado sem nova justificativa documentada neste arquivo. |
| Tokens de notificacao | `CourierDeviceToken` | Enquanto ativo e associado ao aparelho do motoboy | Desativar/remover token inativo, revogado ou sem `lastSeenAt` recente | Nunca exportar valor de token em relatorios ou logs. |
| Usuarios internos e alocacoes | `User`, `Courier`, `UserStoreAssignment`, `CourierStoreAssignment` | Enquanto houver vinculo ativo e necessidade trabalhista/operacional | Desativar usuario; manter trilha minima de alocacoes e ator de eventos | Nao remover usuarios referenciados por auditoria sem estrategia de pseudonimizacao. |
| Logs e eventos tecnicos | logs da API, `DeliveryNotificationEvent` quando presente | 90 dias para logs detalhados; 12 meses para agregados operacionais | Expurgar payload detalhado e manter apenas metricas agregadas | Logs nao devem conter telefone completo, endereco completo, token ou segredo. |

### Regras para anonimizacao

- Nao anonimizar entregas abertas, em rota, com ocorrencia pendente ou dentro de uma solicitacao de suporte ativa.
- Substituir identificadores pessoais por valores deterministas e nao reversiveis quando a relacao historica ainda for necessaria, por exemplo `cliente_anonimizado_<hash_curto>`.
- Remover ou generalizar campos livres antes de campos estruturados, porque `notes`, `reference`, `complement` e `metadata` podem carregar dados pessoais inesperados.
- Preservar chaves tecnicas necessarias para integridade referencial, auditoria minima e relatorios agregados.
- Registrar toda execucao de rotina LGPD com data, criterio, quantidade afetada, ator responsavel e amostra de validacao sem dados pessoais.
- Usar patches deterministas para anonimizar cliente, telefone, endereco, token e localizacao, sem reaproveitar o valor pessoal original no novo campo.

## Acesso minimo

- Admin e gerente acessam dados operacionais dentro das responsabilidades da gestao.
- Balconista/caixa acessa apenas o escopo da loja vinculada, salvo regra documentada de emprestimo.
- Motoboy acessa apenas entregas disponiveis, aceitas por ele, rota propria e localizacao propria.
- Fallback Supabase REST deve manter as mesmas regras de escopo da rota principal.

## Auditoria

- Mudancas relevantes devem registrar ator, acao, alvo e horario.
- Logs da API devem conter `request_id` e `timestamp_utc`.
- Eventos de entrega devem preservar `actorUserId` quando houver usuario autenticado.

## Dry-run local

Antes de conectar a rotina LGPD ao banco, a API oferece uma ferramenta local para validar um plano a partir de JSON, sem executar alteracoes:

```powershell
npm --workspace apps/api run lgpd:dry-run -- input=lgpd-input.json format=json requestedBy=admin@example.com
npm --workspace apps/api run lgpd:dry-run -- input=lgpd-input.json format=csv out=lgpd-impact.csv
```

O JSON de entrada segue o formato de `LgpdRetentionPlanInput` em `apps/api/src/lgpdRetention.ts`, com listas opcionais de `deliveries`, `proofs`, `customers`, `courierLocations` e `deviceTokens`. A saida e agregada por categoria, acao e motivo; nao lista IDs nem dados pessoais dos registros afetados.

## Estado implementado

- Exportacao CSV do painel usa telefone mascarado.
- Exportacoes CSV do painel e relatorio server-side neutralizam entradas que planilhas poderiam interpretar como formulas.
- Exportacoes CSV de relatorio registram contexto de escopo, periodo, filtros, limite de exportacao e resumo operacional.
- API usa sessao por token e escopo por perfil nas rotas operacionais principais.
- Eventos de entrega e recalculo de rota registram ator quando disponivel.
- Logs da API incluem `request_id`, `timestamp_utc`, status e tempo de resposta.
- API possui planejador LGPD puro em `apps/api/src/lgpdRetention.ts` para identificar candidatos a anonimizacao, exclusao de binario de comprovante, limpeza de localizacao e desativacao de token antes de uma rotina destrutiva.
- Planejador LGPD gera resumo e CSV de impacto por categoria, acao e motivo, sem expor IDs ou dados pessoais dos registros afetados.
- API possui builders puros de patches LGPD para anonimizar cliente/endereco, limpar localizacao, revogar token e preparar exclusao de binario de comprovante preservando metadados.
- API possui CLI local `lgpd:dry-run` para gerar relatorio agregado JSON/CSV a partir de arquivo ou stdin, sem conectar ao banco e sem executar alteracoes.

## Pendencias antes de producao

- Validar juridicamente os prazos iniciais da matriz de retencao.
- Conectar o planejador LGPD a uma rotina automatizada de anonimizacao/exclusao para dados antigos, mantendo modo `dry-run`, relatorio de impacto e execucao manual aprovada.
- Criar rotina para excluir arquivos de comprovante vencidos no storage e reconciliar metadados orfaos.
- Revisar RLS final no Supabase com o modelo de autenticacao consolidado.
- Criar procedimento administrativo para solicitacao de acesso, correcao e exclusao de dados.
