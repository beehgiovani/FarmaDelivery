# FarmaDelivery

Monorepo de um sistema independente para gestão de entregas em farmácias. O projeto reúne painel administrativo, API, aplicativo Android e PWA para motoboys.

## Estado do projeto

- Fluxos, testes e builds locais: implementados no repositório.
- Integrações de banco, autenticação, localização e notificações: documentadas e configuráveis por ambiente.
- Homologação contínua em uma operação real: ainda necessária.
- Adoção comercial e métricas de resultado: não alegadas.

## Aplicações

- `apps/api`: API Fastify/TypeScript, regras de negócio e integrações.
- `apps/admin`: painel React/Vite para cadastros, entregas e relatórios.
- `apps/motoboy`: cliente Android em Kotlin.
- `apps/motoboy-pwa`: cliente web para o fluxo do entregador.

## Stack confirmada

- TypeScript, Node.js, Fastify e Prisma.
- React, Vite e PWA.
- PostgreSQL/Supabase, SQL versionado e regras de acesso.
- Kotlin/Android e Firebase Cloud Messaging.
- Docker Compose, testes automatizados e scripts de preflight.

## O que o projeto demonstra

- Modelagem de perfis, unidades, entregas e eventos operacionais.
- Contratos mantidos entre API, painel, Android e PWA.
- Configuração de ambientes sem versionar credenciais.
- Separação entre validação automatizada e teste operacional.

## Executar e validar

```bash
npm install
npm test
npm run build
```

Valide o cliente Android dentro de `apps/motoboy` com o Gradle Wrapper. Consulte `docs/README.md` para arquitetura, Supabase, segurança, smoke tests e preparação de produção.

## Segurança e dados

Não versione `.env`, `google-services.json`, chaves, dados reais de clientes, endereços operacionais ou artefatos de build. Use apenas arquivos de exemplo para documentar variáveis.

## Limites

Este repositório é uma demonstração técnica independente. Build aprovado não substitui homologação com usuários, dispositivos, permissões, push, GPS, banco e armazenamento do ambiente final.
