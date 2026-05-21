# Runbook de Producao

Este roteiro concentra a conferencia final antes de publicar ou validar o FarmaDelivery em ambiente real. Nao registre aqui chaves, tokens, project IDs, enderecos reais, nomes reais de lojas ou credenciais.

## Preparacao

1. Gerar um `API_SESSION_SECRET` novo:

```powershell
npm run secret:session
```

2. Configurar os arquivos locais ignorados pelo Git, como `env/api.env` e `env/admin.env`, usando apenas valores reais no ambiente seguro.
3. Conferir `DATABASE_URL` com Transaction pooler do Supabase e `sslmode=require`.
4. Manter `SUPABASE_SERVICE_ROLE_JWT` ou `SUPABASE_SECRET_KEY` somente no backend.
5. Configurar `DELIVERY_PROOF_STORAGE_DIR` em armazenamento persistente ou definir storage externo antes de depender de container efemero.
6. Configurar credencial Firebase Admin na API para FCM HTTP v1.
7. Configurar variaveis publicas do frontend/PWA, incluindo `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e, quando Web Push estiver ativo, `VITE_FIREBASE_WEB_PUSH_VAPID_KEY`.

## Preflight Local

Rodar o preflight completo na raiz do monorepo:

```powershell
npm run preflight:production -- file=env/api.env file=env/admin.env
```

Para conferir a ordem das etapas sem executar o preflight:

```powershell
npm run preflight:production -- --list
```

O comando para no primeiro erro e executa:

1. Autoteste do gerador de `API_SESSION_SECRET`.
2. Checagem segura de ambiente.
3. Autoteste da checagem de arquivos sensiveis.
4. Checagem de arquivos sensiveis rastreados pelo Git.
5. Autoteste da auditoria estatica de RLS.
6. Auditoria estatica de RLS do SQL canonico.
7. Testes automatizados dos workspaces.
8. Build completo.

Se precisar isolar uma falha:

```powershell
npm run secret:session:self-test
npm run env:production:check -- file=env/api.env file=env/admin.env
npm run repo:sensitive:check:self-test
npm run repo:sensitive:check
npm run db:rls:check:self-test
npm run db:rls:check
npm test
npm run build
```

## Supabase

1. Revisar manualmente no Supabase SQL Editor se o banco aplicado esta alinhado a `database/schema-full.sql`.
2. Confirmar que tabelas sensiveis nao possuem policy `TO anon`.
3. Confirmar que Realtime esta habilitado apenas para as tabelas esperadas pelo painel, PWA e apps de campo.
4. Validar login admin, login operacional da loja, autocomplete de balconista/caixa e login de motoboy apos a aplicacao do SQL.

## Smoke Test Android

Use este bloco com emulador ou aparelho que consiga acessar a API.

1. Configurar `farmadelivery.apiUrl` em `apps/motoboy/local.properties`.
2. Conferir se `apps/motoboy/app/google-services.json` existe localmente e segue fora do Git.
3. Rodar:

```powershell
cd apps\motoboy
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
```

4. Instalar o APK no emulador/aparelho.
5. Entrar com usuario `MOTOBOY` e confirmar bloqueio de perfis de loja/balconista no fluxo de campo.
6. Escolher praca de atendimento e validar a lista de entregas livres.
7. Ativar disponibilidade, permitir notificacoes quando solicitado e enviar localizacao manual.
8. Aceitar entrega, coletar, sair em rota, abrir mapa, conferir pagamento/valor/telefone/endereco/numero diario e concluir com observacao.
9. Testar comprovante fotografico opcional e ocorrencia.
10. Confirmar recebimento de FCM no canal `deliveries`.
11. Fazer logout e confirmar parada do envio de localizacao.

## Smoke Test PWA iOS

Use este bloco apenas com HTTPS e Firebase Web Push configurado.

1. Publicar o PWA em HTTPS com as variaveis Firebase Web e VAPID configuradas no ambiente.
2. Abrir a URL no Safari do iPhone e adicionar pela Tela de Inicio.
3. Abrir o app instalado, entrar com usuario `MOTOBOY` e escolher praca de atendimento.
4. Permitir notificacoes e confirmar no backend que o token foi registrado sem aparecer em tela, log ou CSV.
5. Criar ou atualizar uma entrega elegivel para a praca do motoboy.
6. Confirmar notificacao fora da aba do Safari e atualizacao da lista ao abrir a notificacao.
7. Repetir com app aberto para validar os sinais locais de nova entrega ou mudanca de status.
8. Fazer logout e confirmar limpeza de dados operacionais do aparelho.

## Criterio de Publicacao

Considere a publicacao pronta somente quando:

1. `npm run preflight:production -- file=env/api.env file=env/admin.env` passar.
2. Supabase estiver revisado manualmente no SQL Editor.
3. Admin, login de loja, cadastro de entrega, relatorios e comanda forem testados com dados operacionais reais.
4. Android passar no smoke test em aparelho/emulador.
5. PWA iOS passar no smoke test instalado pela Tela de Inicio, quando Web Push for requisito da publicacao.
