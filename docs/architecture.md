# Arquitetura Inicial

## Principio central

O sistema deve registrar fatos operacionais como eventos. Uma entrega nao deve ser apenas uma linha que muda de status; ela deve manter o historico do que aconteceu, quando aconteceu e quem fez.

## Eventos de entrega

- `CRIADA`: gerado automaticamente quando a loja lanca a entrega.
- `AGENDADA`: gerado quando existe janela "a partir de" para despacho.
- `REDIRECIONADA`: gerado quando uma loja envia manualmente para outra.
- `ACEITA`: gerado quando o motoboy aceita.
- `COLETADA`: gerado quando o motoboy confirma coleta na loja.
- `ROTA_RECALCULADA`: gerado quando uma nova parada entra na rota.
- `OCORRENCIA_REGISTRADA`: gerado quando ha problema.
- `ENTREGUE`: gerado ao finalizar.
- `CANCELADA`: gerado quando a entrega e cancelada.

## Rota viva

A rota do motoboy e uma sequencia de paradas. Cada parada pode ser:

- Coleta em loja.
- Entrega ao cliente.

Quando o motoboy aceita nova entrega ou passa em outra loja para coletar, o backend adiciona uma nova parada e recalcula a sequencia.

## Regras iniciais de otimizacao

1. Respeitar entregas agendadas: nao despachar antes da hora minima.
2. Priorizar urgentes e retornos.
3. Reduzir tempo total em rota.
4. Evitar desvio muito grande para buscar nova coleta.
5. Permitir ajuste manual quando estoque, produto ou decisao da loja exigir.

## Stack atual

- API: Fastify + TypeScript.
- Banco: PostgreSQL no Supabase.
- Localizacao: PostGIS quando avancarmos para consultas geograficas mais fortes.
- ORM: Prisma para conexao direta, com fallback Supabase REST server-side.
- Tempo real: Supabase Realtime no painel; FCM previsto para app dos motoboys.
- Frontend: React + TypeScript + Vite + Leaflet.

## Estado operacional

- API e painel passam no build geral.
- Auth e leituras principais funcionam via fallback Supabase REST quando a conexao direta do Prisma falha.
- Para estabilizar Prisma local, configure `DATABASE_URL` com a connection string do Supabase Transaction pooler.
- Scripts SQL devem ser aplicados manualmente no Supabase SQL Editor quando necessario.
