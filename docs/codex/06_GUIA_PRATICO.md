# 🚀 PRÓXIMOS PASSOS - Guia Prático

**Leia isto primeiro antes de proceder!**

---

## 1️⃣ ATIVAR O BANCO (Supabase) - CRÍTICO

### Passo 1: Verificar Status Supabase

```
1. Abra: https://app.supabase.com/project/kwbcpjqhoowwwbpbihrk
2. Login com suas credenciais
3. Vá em: "Settings" → "Database"
4. Verifique:
   ✅ Project está "Active" (não suspenso)
   ✅ Connection string é acessível
   ✅ PostgreSQL version > 12
```

### Passo 2: Conferir Conexão Banco

> Preferência atual do projeto: não rodar SQL nem migrações direto pelo terminal. Use o Supabase Console e o SQL Editor quando for necessário aplicar scripts manualmente.

```bash
# No Supabase Console:
# 1. Abra SQL Editor
# 2. Rode uma consulta simples, por exemplo:
#    SELECT now();
# 3. Se a consulta responder, o banco está ativo.
```

### Passo 3: Rodar Migrações do Banco

**Se banco está vazio:**

```bash
# Manualmente no Supabase:
# 1. Supabase Console → SQL Editor (lado esquerdo)
# 2. Clique em "New Query"
# 3. Cole TODO o conteúdo de: database/full-setup.sql
# 4. Clique "Run" ou Ctrl+Enter
# 5. Pronto! Tabelas criadas
```

### Passo 4: Seed de Dados (Lojas)

```bash
# Seed SQL já está em supabase/seed.sql
# Opção: Cole em SQL Editor do Supabase (igual passo anterior)
# Isso insere as 5 lojas reais

# Nao rode seed pelo terminal neste fluxo.
```

---

## 2️⃣ TESTAR AUTENTICAÇÃO

### Teste 1: Bootstrap Admin (Criar Primeiro Admin)

```bash
# Terminal 1: Inicie API
npm run dev:api

# Terminal 2: Abra outro terminal, faça POST:
curl -X POST http://localhost:3333/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin Master",
    "phone": "11999999999",
    "email": "admin@farmadelivery.com",
    "password": "SenhaSegura123!"
  }'

# Resposta esperada:
# 201 Created com { user: {...}, token: "..." }
```

### Teste 2: Login

```bash
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@farmadelivery.com",
    "password": "SenhaSegura123!"
  }'

# Resposta: 200 OK com token
```

### Teste 3: Validar Sessão

```bash
# Guarde o TOKEN da resposta anterior e use aqui:

curl -X GET http://localhost:3333/auth/me \
  -H "Authorization: Bearer <TOKEN_AQUI>"

# Resposta: 200 OK com dados do usuário
```

---

## 3️⃣ TESTAR FRONTEND ADMIN

```bash
# Terminal 1: API já rodando
npm run dev:api

# Terminal 2: Inicie Frontend
npm run dev:admin

# Abre navegador: http://localhost:5173
# 1. Clique "Novo Admin"
# 2. Preencha:
#    - Nome: Admin Master
#    - Telefone: 11999999999
#    - Email: admin@farmadelivery.com
#    - Senha: SenhaSegura123!
# 3. Clique "Criar"
# 4. Se tudo OK → Redireciona para Dashboard
# 5. Veja entregas, motoboys, mapa!
```

---

## 4️⃣ CRIAR USUÁRIOS ADICIONAIS (Balconista, Motoboy)

### Via Admin Panel (Futuro - se implementado)

Ou manualmente:

```bash
# POST /users (só admin pode)
curl -X POST http://localhost:3333/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Balconista",
    "email": "joao@store.com",
    "phone": "11988888888",
    "password": "Senha456",
    "role": "BALCONISTA_CAIXA",
    "storeId": "<ASTURIAS_STORE_ID>"
  }'

# Para Motoboy:
# role: "MOTOBOY"
# storeId: null (motoboys não têm loja fixa)
```

---

## 5️⃣ APP KOTLIN (JA EXISTENTE)

**O app Android ja existe em `apps/motoboy`:**

```bash
# 1. Abra o Android Studio
# 2. File → Open → selecione apps/motoboy
# 3. Aguarde o Gradle sync
# 4. Run no emulador ou dispositivo
# 5. Login com as credenciais do backend
```

Para evolucoes, consulte `04_FEATURES_MOTOBOY.md`.

**Stack Kotlin Inicial:**
```gradle
dependencies {
  // Networking
  implementation 'com.squareup.retrofit2:retrofit:2.11.0'
  implementation 'com.squareup.okhttp3:okhttp:4.12.0'
  
  // Async
  implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0'
  
  // UI
  implementation 'androidx.compose.ui:ui:1.6.0'
  
  // Data
  implementation 'androidx.room:room-runtime:2.6.1'
  
  // Location
  implementation 'com.google.android.gms:play-services-location:21.1.0'
  
  // Notifications
  implementation 'com.google.firebase:firebase-messaging:23.4.1'
}
```

---

## 6️⃣ SE ALGO FALHAR

### ❌ "Can't reach database"

```
→ Verificar .env (DATABASE_URL, DIRECT_URL)
→ Supabase Console: Database → Connection pooler
→ Se ainda não funcionar: Supabase → Reset Database
→ Testar conexão pelo SQL Editor do Supabase
```

### ❌ "UNAUTHENTICATED" em qualquer endpoint

```
→ Revisar token JWT
→ POST /auth/login novamente
→ Usar novo token em Authorization: Bearer
```

### ❌ "BOOTSTRAP_LOCKED" ao criar admin

```
→ Significa que já existe admin criado
→ Procure no banco:
   SELECT * FROM "User" WHERE role = 'ADMIN';
→ Ou faça login com credenciais existentes
```

### ❌ "PORT 3333 already in use"

```
# Encontre processo na porta:
lsof -i :3333

# Mate processo:
kill -9 <PID>

# Ou mude porta em .env:
API_PORT=3334
```

---

## 📋 Checklist de Saude

- [x] Banco Supabase ativo e conectado
- [x] npm run dev:api funciona sem erros
- [x] POST /auth/bootstrap-admin retorna 201
- [x] GET /auth/me retorna usuário autenticado
- [x] npm run dev:admin abre painel sem erros
- [x] GET /deliveries retorna lista
- [x] GET /couriers retorna lista
- [x] App Kotlin roda no emulador

Se tudo ✅, o sistema esta operacional!

---

## 🎯 Resumo da Situação

| Item | Status | Acao |
|------|--------|------|
| Backend API | ✅ Operacional | `npm run dev:api` |
| Frontend Web | ✅ Operacional | `npm run dev:admin` |
| Database | ✅ Todos SQLs aplicados | Pooler configurado |
| Bootstrap Admin | ✅ Validado | Login funcional |
| App Kotlin | ✅ Funcional | Abrir `apps/motoboy` no Android Studio |
| PWA iPhone | ✅ Funcional | `npm run dev:motoboy:pwa` |

---

## 🔗 Links Importantes

- **Documentação Técnica**: 02_ARQUITETURA.md
- **Troubleshooting**: 08_DIAGNOSTICO_AUTH.md
- **Motoboy Feature**: 04_FEATURES_MOTOBOY.md
- **Regras do Projeto**: 01_REGRAS_AGENTE.md
- **Supabase Console**: https://app.supabase.com/project/kwbcpjqhoowwwbpbihrk

---

## 💬 Dúvidas?

1. Leia os documentos acima primeiro
2. Consulte `api-dev.log` para erros
3. Teste com `curl` manualmente
4. Se ainda não funcionar, compartilhe:
   - Logs completos (api-dev.log)
   - Resultado da consulta no SQL Editor do Supabase
   - Resultado do curl POST /auth/bootstrap-admin

---

**Boa sorte! 🚀**
