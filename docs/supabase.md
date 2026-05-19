# Supabase

## Projeto

- Project ID: `kwbcpjqhoowwwbpbihrk`
- Console: https://app.supabase.com/project/kwbcpjqhoowwwbpbihrk

## Regras de uso

- Nao exponha `SUPABASE_SERVICE_ROLE_JWT` no frontend.
- O frontend usa apenas chave publishable/anon.
- A API pode usar `SUPABASE_SERVICE_ROLE_JWT` como fallback server-side.
- Use valores reais apenas nos `.env` locais; `.env.example` deve manter placeholders.
- SQL, seed, policies e realtime devem ser aplicados manualmente pelo Supabase SQL Editor quando necessario.

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

Ordem recomendada quando o banco precisar ser preparado do zero:

1. `database/full-setup.sql`
2. `supabase/seed.sql`
3. `supabase/store-hours-seed.sql`
4. `supabase/policies.sql`
5. `supabase/realtime.sql`

## Estado Atual

- A API local ja opera contra o Supabase via fallback REST.
- Auth foi validado via fallback REST.
- Prisma direto ainda deve ser estabilizado com o pooler.
