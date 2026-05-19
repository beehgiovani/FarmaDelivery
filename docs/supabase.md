# Supabase

## Projeto

- Project ID real deve ficar apenas em ambiente seguro/local.
- Console: `https://app.supabase.com/project/<PROJECT_REF>`

## Regras de uso

- Nao exponha `SUPABASE_SERVICE_ROLE_JWT` no frontend.
- O frontend usa apenas chave publishable/anon.
- A API pode usar `SUPABASE_SERVICE_ROLE_JWT` como fallback server-side.
- Use valores reais apenas nos `.env` locais; `.env.example` deve manter placeholders.
- O SQL deve ser aplicado manualmente pelo Supabase SQL Editor quando necessario.
- Use `database/schema-full.sql` como arquivo unico para schema, seeds, policies, realtime e comentarios SQL.
- Toda tabela deve ter `COMMENT ON TABLE` dentro de `database/schema-full.sql`, explicando uso no codigo, RLS e cuidados operacionais.

## Connection String

Para desenvolvimento local, prefira:

- `DATABASE_URL`: Transaction pooler do Supabase.
- `DIRECT_URL`: conexao direta, se a rede local conseguir acessar.

No Supabase Console:

1. Abra **Database**.
2. Abra **Connect**.
3. Copie a connection string de **Transaction pooler**.
4. Atualize `apps/api/.env`.
5. Reinicie a API.

## Scripts Manuais

Arquivo canonico unificado para preparar ou realinhar o banco:

1. `database/schema-full.sql`

Ele ja contem schema, migrations, seeds, policies, realtime e comentarios SQL das tabelas. Nao rode os seeds/policies/realtime separados logo depois dele, para evitar trabalho duplicado.

Os antigos scripts auxiliares foram incorporados ao arquivo canonico e removidos para evitar duplicidade.

## Estado Atual

- A API local ja opera contra o Supabase via fallback REST.
- Auth foi validado via fallback REST.
- Prisma direto ainda deve ser estabilizado com o pooler.

## Conferencias Manuais Uteis

Lojas e horarios:

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

Comentarios das tabelas:

```sql
SELECT
  c.relname AS tabela,
  obj_description(c.oid) AS comentario
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
```

## Proximas Conferencias Recomendadas

1. Revisar RLS operacional por perfil antes de producao.
2. Confirmar `DATABASE_URL` da API com Transaction pooler.
3. Configurar credenciais reais do Firebase Admin para push server-side.
4. Configurar VAPID key e testar Web Push real no PWA instalado no iOS.
5. Fazer smoke test completo do app Android com API publicada ou API local acessivel pelo aparelho.
