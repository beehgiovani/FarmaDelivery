# Diagnóstico: Erros 400 e 503 do /auth/bootstrap-admin

## Problema Identificado

**Status**: 🟡 Prisma direto não acessível; API validada via fallback Supabase REST  
**Erro**: `PrismaClientInitializationError` + `Can't reach database server`  
**URL do Banco**: `db.kwbcpjqhoowwwbpbihrk.supabase.co:5432`

---

## Causa Raiz

1. **Conexão recusada** ao servidor PostgreSQL do Supabase
   - Possíveis causas:
     - Supabase project suspenso ou inativo
     - Firewall bloqueando conexão
     - Credenciais de banco inválidas
     - Database não criado/vazio

2. **Erro 400** (Bad Request): Payload inválido ou validação do schema Zod falhando

3. **Erro 503** (Service Unavailable): Prisma não consegue conectar ao banco

---

## Checklist de Diagnóstico

### ✅ 1. Validar .env (Já feito)
- [x] `DATABASE_URL` configurada
- [x] `DIRECT_URL` configurada  
- [x] `API_SESSION_SECRET` adicionada
- [x] Prisma schema válido (`npm exec prisma validate`)

### ⏳ 2. Verificar Supabase (FAÇA AGORA)

Abra https://app.supabase.com/project/kwbcpjqhoowwwbpbihrk e:

1. Vá em **Settings** → **Database**
2. Verifique:
   - [ ] Project está ativo (não suspenso)
   - [ ] Connection string está correta
   - [ ] Database `postgres` existe
   - [ ] User `postgres` tem acesso

3. Teste no SQL Editor:
   ```bash
   # Supabase Console -> SQL Editor
   SELECT now();
   ```

### 3. Se Supabase Está OK, Testar Prisma

```bash
cd apps/api

# Valida schema (já feito - passou ✅)
npm exec prisma validate

# Verifica schema local
npm exec prisma validate
```

### 4. Se Ainda Não Conectar

Possíveis soluções:

**A) Recriar conexão Supabase**
- Supabase console → Salve nova DATABASE_URL
- Atualize `.env`
- Reinicie API

**B) Usar Supabase REST como fallback** (já programado e validado)
- Configurar `SUPABASE_SERVICE_ROLE_JWT` em .env
- API automaticamente usa REST quando Prisma falha
- Auth (`bootstrap-admin`, `login`, `/auth/me`) já foi validado nesse modo

**C) Verificar Firewall/VPN**
- Se está em VPN corporativa, pode bloquear conexão
- Teste com tethering de celular

---

## Scripts SQL para Rodar Manualmente no Supabase

Se precisar preparar o banco, execute estes scripts manualmente no SQL Editor do Supabase:

### 1. Criar Tabelas Base

```sql
-- Copy do conteúdo em: database/full-setup.sql
-- Vá em Supabase Console → SQL Editor → Novo Query
-- Cole e execute
```

### 2. Criar Policies de RLS

```sql
-- Copy do conteúdo em: supabase/policies.sql
```

### 3. Ativar Realtime

```sql
-- Copy do conteúdo em: supabase/realtime.sql
```

### 4. Seed de Dados

```sql
-- Copy do conteúdo em: supabase/store-hours-seed.sql
```

---

## Próximos Passos (Prioridade)

### 🔴 CRÍTICO - Fazer agora:
1. [ ] Verificar se Supabase project está ativo
2. [ ] Configurar `DATABASE_URL` com Transaction pooler
3. [ ] Rodar scripts necessários manualmente no SQL Editor

### 🟡 IMPORTANTE - Depois:
1. [x] Testar bootstrap-admin via fallback REST
2. [x] Criar primeiro admin
3. [x] Testar login e `/auth/me`

### 🟢 DEPOIS:
1. [ ] Implementar app Kotlin para motoboys
2. [ ] Testes de integração
3. [ ] Deploy produção

---

## Arquivo com Scripts de Migração Completos

Veja: `database/full-setup.sql`  
(Gerado automaticamente via `npm run db:sql:full`)

Este arquivo contém:
- Todas as tabelas (User, Store, Delivery, Courier, etc)
- Todos os índices
- Todas as constraints
- Seed de lojas e horários

### Como usar:

```
1. Supabase Console → SQL Editor
2. Upload file: database/full-setup.sql
3. Execute
4. Pronto!
```

---

## Resumo Técnico do Erro

```
Fluxo de execução:
1. Browser → POST /auth/bootstrap-admin
2. API → app.log.error("auth bootstrap admin error")
3. Prisma → try prisma.user.count()
4. Prisma Client → initializationError
5. Connection Pool → Can't reach database (timeout 5s)
6. API tenta fallback REST; se REST estiver configurado, auth segue funcionando

Causa: `DATABASE_URL` direto não alcança o Postgres na rede local
Solução: usar Supabase Transaction pooler no `DATABASE_URL`
```

---

## Logs Relevantes

```json
{
  "level": 50,
  "time": 1778822378141,
  "pid": 12088,
  "hostname": "Bruno",
  "error": {
    "clientVersion": "6.19.3",
    "name": "PrismaClientInitializationError"
  },
  "msg": "auth bootstrap admin error"
}
```

---

## Contato para Suporte

Se ainda não funcionar:
1. Compartilhe logs completos: `api-dev.log`
2. Verifique: `DATABASE_URL` e `DIRECT_URL`
3. Teste manualmente no SQL Editor do Supabase
4. Considere recrear Supabase project
