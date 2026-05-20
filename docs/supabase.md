# Supabase

## Projeto

- Project ID real deve ficar apenas em ambiente seguro/local.
- Console: `https://app.supabase.com/project/<PROJECT_REF>`

## Regras de uso

- Nao exponha `SUPABASE_SERVICE_ROLE_JWT` nem `SUPABASE_SECRET_KEY` no frontend.
- O frontend usa apenas chave publishable/anon.
- A API pode usar `SUPABASE_SERVICE_ROLE_JWT` ou `SUPABASE_SECRET_KEY` como fallback server-side.
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
- Policies e verificacao de realtime foram executadas manualmente no Supabase antes da consolidacao do SQL canonico, com sucesso reportado.
- `database/schema-full.sql` substitui os scripts separados antigos e deve ser usado como fonte unica para novos realinhamentos.
- `Courier.preferredServiceArea` persiste a praca escolhida pelo motoboy (`ASTURIAS` ou `PEREQUE`) e deve existir antes de validar push server-side por praca.
- Os comentarios SQL das tabelas estao no arquivo canonico e devem documentar finalidade, uso no codigo, RLS e cuidados operacionais.
- Arquivos locais com secrets, como `.env`, `google-services.json`, `local.properties`, logs e caches, devem permanecer ignorados e fora do Git.

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

Auditoria estatica do SQL canonico:

```powershell
npm run db:rls:check
```

Essa checagem valida se toda tabela criada em `database/schema-full.sql` tem RLS habilitada, `COMMENT ON TABLE` e se apenas as tabelas publicas de catalogo possuem policy `TO anon`.

## Proximas Conferencias Recomendadas

1. Confirmar `DATABASE_URL` da API com Transaction pooler.
2. Configurar credenciais reais do Firebase Admin para push server-side.
3. Configurar VAPID key e testar Web Push real no PWA instalado no iOS.
4. Rodar `npm run preflight:production -- file=env/api.env file=env/admin.env` antes do deploy final; ele executa checagem de ambiente, auditoria RLS, testes e build sem imprimir valores sensiveis.
5. Revisar no Supabase SQL Editor se o resultado de `npm run db:rls:check` tambem confere com o banco aplicado antes de producao.
6. Fazer smoke test completo do app Android com API publicada ou API local acessivel pelo aparelho.

## Checklist de Banco para Producao

Antes do deploy final, trate `database/schema-full.sql` como fonte unica:

1. Rodar `npm run db:rls:check` localmente para validar RLS, comentarios e policies publicas no arquivo canonico.
2. Aplicar ou revisar manualmente o SQL no Supabase SQL Editor, sem usar terminal para execucao direta.
3. Confirmar que tabelas sensiveis nao possuem policy `TO anon`.
4. Confirmar que `Realtime` esta habilitado apenas para as tabelas esperadas pelo painel, PWA e apps de campo.
5. Confirmar que o backend usa service role/secret key apenas server-side e que o frontend usa somente publishable/anon key.
6. Validar login admin, login operacional de loja, autocomplete de balconista/caixa e login de motoboy depois da aplicacao do SQL.

## Preflight de Producao

Use o preflight completo como conferencia final antes de publicar:

```powershell
npm run preflight:production -- file=env/api.env file=env/admin.env
```

Esse comando deve ser rodado com os arquivos locais de ambiente ja preparados e ignorados pelo Git. Ele para no primeiro erro e executa, nesta ordem:

1. `npm run env:production:check -- file=...`
2. `npm run repo:sensitive:check`
3. `npm run db:rls:check`
4. `npm test`
5. `npm run build`

Para investigar uma falha especifica, rode o comando individual correspondente. Para testar apenas a interface do runner sem executar todo o preflight, use:

```powershell
npm run preflight:production:self-test
```
