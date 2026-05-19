# Proximos Passos do Banco

## Feito

- Schema inicial criado.
- Snapshot local em `docs/database-schema.sql`.
- Migration SQL em `supabase/migrations/20260514011500_init_farmadelivery.sql`.
- Migration SQL de horarios por loja em `supabase/migrations/20260514013000_store_hours.sql`.
- Migration SQL de alocacoes em `supabase/migrations/20260515041000_assignments.sql`.
- Migration SQL de tokens de dispositivo em `supabase/migrations/20260515052000_courier_device_tokens.sql`.
- Migration SQL de eventos de notificacao em `supabase/migrations/20260515054000_delivery_notification_event.sql`.
- Migration SQL de comprovantes fotograficos opcionais em `supabase/migrations/20260515193000_delivery_proofs.sql`.
- Migration SQL de prazo manual por entrega em `supabase/migrations/20260517120000_delivery_deadline_tier.sql`.
- Migration SQL de numeracao diaria por loja em `supabase/migrations/20260517143000_delivery_daily_sequence.sql`.
- Seed SQL das lojas em `supabase/seed.sql`.
- Seed SQL dos horarios das lojas em `supabase/store-hours-seed.sql`.
- SQL consolidado geral em `database/full-setup.sql`.
- Snapshot local atual do Prisma em `docs/database-schema.sql`.

## Controle dos SQLs

Manter dois niveis:

- Arquivos incrementais em `supabase/`: historico por etapa.
- Arquivo consolidado em `database/full-setup.sql`: referencia geral/bootstrap completo.

Sempre que alterar migrations, seeds, policies ou realtime, rode:

```bash
npm run db:sql:full
```

## Horarios das lojas

Modelo criado:

- `StoreWeeklyHours`: horario padrao por loja e dia da semana.
- `StoreDateOverride`: excecao por data especifica, como festas de fim de ano, feriados, inventario ou confraternizacao.

Regra inicial:

- Todas as lojas abrem segunda a domingo as 08:00.
- Asturias fecha as 23:00.
- Morrinhos, Santa Rosa, Santo Antonio e Pereque fecham as 22:00.

Para aplicar no Supabase, rode nesta ordem:

1. `supabase/migrations/20260514011500_init_farmadelivery.sql`
2. `supabase/migrations/20260514013000_store_hours.sql`
3. `supabase/migrations/20260515041000_assignments.sql`
4. `supabase/migrations/20260515052000_courier_device_tokens.sql`
5. `supabase/migrations/20260515054000_delivery_notification_event.sql`
6. `supabase/migrations/20260515193000_delivery_proofs.sql`
7. `supabase/migrations/20260517120000_delivery_deadline_tier.sql`
8. `supabase/migrations/20260517143000_delivery_daily_sequence.sql`
9. `supabase/seed.sql`
10. `supabase/store-hours-seed.sql`
11. `supabase/policies.sql`
12. `supabase/realtime.sql`

Conferencia:

```sql
SELECT
  s."code",
  s."name",
  COUNT(h."id") AS dias_configurados,
  MIN(h."opensAt") AS abre,
  MAX(h."closesAt") AS fecha
FROM "Store" s
LEFT JOIN "StoreWeeklyHours" h ON h."storeId" = s."id"
GROUP BY s."code", s."name"
ORDER BY s."code";
```

## Rodar seed das lojas no Supabase

Cole o conteudo de `supabase/seed.sql` no SQL Editor do Supabase e execute.

Depois confira:

```sql
SELECT "code", "name", "address", "latitude", "longitude", "baseType"
FROM "Store"
ORDER BY "code";
```

Devem aparecer 5 linhas.

## Proxima etapa recomendada

1. Consolidar as policies de RLS por perfil antes de producao.
2. Configurar `DATABASE_URL` da API com a connection string do Supabase Transaction pooler.
3. Configurar credenciais reais do Firebase Admin para envio push server-side.
4. Configurar VAPID key e testar Web Push real no PWA instalado no iOS.
5. Fazer smoke test completo do app Kotlin com API publicada ou API local acessivel pelo aparelho.

## Criacao de entrega

O frontend ja chama `POST /deliveries/create-with-customer`.

Esse endpoint cria, em uma transacao:

- Cliente por telefone, atualizando nome se ja existir.
- Endereco do cliente.
- Entrega com hora de criacao automatica.
- Codigo publico no formato `LOJA-AAAAMMDD-001`, com numeracao diaria por loja.
- Evento `CRIADA`.
- Evento `AGENDADA` quando existir horario "a partir de".

Enquanto `DATABASE_URL` da API estiver apontando para o host direto IPv6, a escrita local pode retornar `DATABASE_UNAVAILABLE`. Troque para a connection string do Supabase Pooler para gravar localmente pela API.

Como ponte de desenvolvimento, a API tambem possui fallback server-only via Supabase REST usando `SUPABASE_SERVICE_ROLE_JWT`. Esse fallback fica apenas no backend e permite:

- `POST /auth/bootstrap-admin`, `POST /auth/login` e `GET /auth/me` mesmo quando o Prisma nao alcanca o Postgres direto.
- `GET /stores` lendo lojas reais.
- `POST /deliveries/create-with-customer` criando cliente, endereco, entrega e eventos.
- Criacao direta de cliente, endereco e entrega por IDs existentes.
- Acoes operacionais principais de entrega com validacao de permissao por perfil.

O frontend nao recebe nem usa chave server-only.

Observacao: como o SQL atual deixa `id` e `updatedAt` sem default no banco, os inserts pelo fallback REST preenchem esses campos na API, replicando o comportamento que o Prisma faria no cliente.

## Connection string local

O host direto `db.kwbcpjqhoowwwbpbihrk.supabase.co:5432` pode resolver apenas IPv6 em algumas redes. Se a API local retornar `DATABASE_UNAVAILABLE`, use a connection string do Supabase Pooler no `DATABASE_URL` dentro de `env/supabase.env` e `apps/api/.env`.

No Supabase, procure em:

Database > Connect > Connection string > Transaction pooler

Depois mantenha `DIRECT_URL` com a conexao direta, se disponivel, e `DATABASE_URL` com o pooler.
