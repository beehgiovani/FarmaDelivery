# 🎯 LEIA-ME PRIMEIRO

**⏱️ Tempo de leitura: 3 minutos**

---

## Estado do Projeto (Maio 2026)

✅ **Painel Admin/Loja** — React/Vite/TypeScript funcional com mapa, entregas, relatorios, alocacoes e monitoramento push.
✅ **API Backend** — Fastify/TypeScript com Prisma, fallback Supabase REST, escopo por perfil, auditoria e LGPD dry-run.
✅ **App Motoboy Android** — Kotlin 2.2.21/Compose com login, entregas, rota, GPS foreground, FCM, comprovante e disponibilidade.
✅ **PWA Motoboy iPhone** — React/Vite instalavel com login, entregas, rota, GPS, Web Push, comprovante e notificacoes locais.
✅ **Banco de Dados** — PostgreSQL/Supabase com 14 tabelas, 10 enums, seeds, policies e Realtime aplicados.
✅ **Testes Automatizados** — Cobertura extensa da API (HTTP, escopo, upload, auth, LGPD), admin (helpers, SLA, CSV) e motoboys (helpers, navegacao, labels).

---

## 📋 Proximos Passos

### 1️⃣ Higiene e Seguranca

- Consolidar policies RLS para tabelas operacionais (Delivery, Customer, Courier, etc.).
- Conectar planejador LGPD a rotina automatizada de retencao/anonimizacao.
- Adicionar `COMMENT ON TABLE`/`COMMENT ON COLUMN` no banco (obrigatorio pelo protocolo).

### 2️⃣ Mobile

- Smoke test visual do app Android em emulador/aparelho.
- Definir necessidade real de Room/Offline para o app Android.
- Testar Web Push real no PWA iOS apos configurar VAPID key e deploy HTTPS.
- Preparar background location policy para Play Store, se necessario.

### 3️⃣ Producao

- Deploy da API (Railway/Render/VPS).
- Deploy do admin e PWA via Firebase Hosting.
- Configurar `API_SESSION_SECRET` de producao e SSL.

---

## 📚 Documentos Essenciais

| Doc | Leia quando | Tempo |
|-----|------------|-------|
| **01_REGRAS_AGENTE.md** | Antes de codar | 5 min |
| **02_ARQUITETURA.md** | Ao alterar backend/frontend/mobile | 30 min |
| **04_FEATURES_MOTOBOY.md** | Ao evoluir app motoboy | 45 min |
| `docs/implementation-checklist.md` | Para ver status detalhado | 10 min |
| `docs/operational-contracts.md` | Para entender contratos entre apps | 5 min |
| `docs/lgpd.md` | Para privacidade e retencao | 10 min |

---

## ⚡ Quick Start

```bash
# Terminal 1: API
npm run dev:api

# Terminal 2: Admin Web
npm run dev:admin

# Terminal 3: PWA Motoboy
npm run dev:motoboy:pwa

# App Android: abrir apps/motoboy no Android Studio
```

---

## 📊 Status Atual

```
Backend (Fastify)       ✅ Operacional
Frontend Admin (React)  ✅ Operacional
App Motoboy (Kotlin)    ✅ Funcional (falta smoke test em device)
PWA Motoboy (iPhone)    ✅ Funcional (falta Web Push real em HTTPS)
Banco (PostgreSQL)      ✅ Operacional (todos os SQLs aplicados)
Testes Automatizados    ✅ API, admin e motoboys cobertos
Push Notifications      ✅ FCM server-side implementado
LGPD                    ⏳ Dry-run pronto, falta rotina automatizada
RLS Policies            ⏳ Parcial (Store e horarios ok, falta operacional)
Deploy Producao         ❌ Pendente
```

---

## 🔴 Regras Inviolaveis

1. **Clean Architecture**: Domain → Data → Presentation
2. **Sem "vibe code"**: Codigo desorganizado e proibido
3. **Escopo exato**: Fazer SOMENTE o pedido, nao inventar contextos
4. **Token-based auth**: JWT assinado pela API
5. **Auditoria total**: actorUserId em eventos de entrega e operacoes
6. **Paridade motoboy**: Toda feature nova deve funcionar no Android E no PWA

Leia `01_REGRAS_AGENTE.md` para todas as regras.

---

## 🗺️ Mapa Mental do Projeto

```
FarmaDelivery/
├── 📱 apps/admin/         Painel web React (admin + loja)
├── ⚙️ apps/api/           API Fastify + Prisma + fallback REST
├── 📲 apps/motoboy/       App Android Kotlin/Compose
├── 🌐 apps/motoboy-pwa/   PWA iPhone React/Vite
├── 🗄️ database/           SQL consolidado
├── 📄 docs/               Documentacao viva
├── 🔧 scripts/            Utilidades (snapshot, build SQL)
└── ☁️ supabase/            Migrations, seeds, policies, realtime
```

---

## ❓ Se Algo der Errado

| Problema | Solucao |
|----------|---------|
| "Can't reach database" | `08_DIAGNOSTICO_AUTH.md` |
| "Bootstrap locked" | Banco ja tem admin, faca login normalmente |
| "Nao entendo a arquitetura" | `02_ARQUITETURA.md` secao 1-3 |
| Deploy PWA nao encontra site | Verificar `.firebaserc` target `motoboy-pwa` → site `drogstoantonio-motoboy` |
