# FarmaDelivery Motoboy Android

Aplicativo Android nativo para motoboys. Ele consome a mesma API do painel e do PWA, com foco em operacao de campo, entregas, rotas, localizacao, comprovante e notificacoes.

Este app nao deve documentar nomes reais de lojas, enderecos, coordenadas, chaves Firebase, tokens ou dados de ambiente.

## Stack

- Kotlin.
- Android Gradle Plugin.
- Gradle Kotlin DSL.
- Jetpack Compose.
- DataStore para sessao/preferencias locais.
- Retrofit/OkHttp para HTTP.
- Firebase Cloud Messaging.
- Foreground Service para localizacao periodica.
- Testes unitarios Kotlin/JUnit.

## Package

```text
Configurado no projeto Android local.
```

## Escopo atual

- Login usando a API.
- Persistencia local da sessao com DataStore.
- Logout com tentativa de marcar motoboy como indisponivel.
- Escolha da praca de atendimento configurada no app na tela de entregas para filtrar corridas disponiveis.
- Lista de entregas disponiveis e entregas em atendimento.
- Loading, vazio, erro/retry e refresh manual.
- Disponibilidade operacional antes de receber/aceitar novas corridas.
- Acoes de entrega: aceitar, coletar, sair em rota, concluir e registrar problema.
- Confirmacao textual obrigatoria antes de concluir entrega em rota.
- Foto opcional como comprovante antes de concluir entrega.
- Compressao local da foto de comprovante antes do upload.
- Historico auditavel da entrega, incluindo ator, tipo, horario e observacoes.
- Atalhos para ligar para o cliente e abrir endereco/rota no app de mapas.
- Tela de rota atual consumindo `GET /courier-routes`, com paradas pendentes agrupadas e ordenadas.
- Protecao para rotas sem parada navegavel, omitindo botao de mapas e mostrando aviso.
- Envio manual da localizacao atual para `POST /couriers/location`.
- Envio automatico de localizacao por `ForegroundService` a cada 60 segundos enquanto ativado.
- Registro automatico do token FCM em `POST /couriers/{courierId}/device-token`.
- Atualizacao do token FCM quando o Firebase gera um novo token.
- Canal Android `deliveries` e `FirebaseMessagingService` para notificacoes de nova entrega, cancelamento e atualizacoes.
- Regras XML bloqueando backup/transferencia de dados locais sensiveis.
- Exibicao de numero diario da loja quando a API enviar `storeDailyNumber`.

## Estrutura

```text
app/src/main/kotlin/.../farmadelivery/
  data/
    api/          Servicos HTTP
    location/     Provedor de localizacao do aparelho
    models/       Modelos da API
    preferences/  Sessao e preferencias locais
    repository/   Repositorios do app
  domain/usecase/ Casos de uso principais
  location/       Foreground service de GPS
  notifications/  FirebaseMessagingService
  presentation/   Navegacao, telas e tema Compose
```

## API local

No emulador Android, `localhost` aponta para o proprio emulador. Use a URL especial do host:

```properties
farmadelivery.apiUrl=http://10.0.2.2:3333
```

Esse valor deve ficar em `local.properties`, que e arquivo local ignorado pelo Git.

## Firebase

O arquivo local do Firebase deve ficar em:

```text
apps/motoboy/app/google-services.json
```

Esse arquivo e sensivel ao ambiente e nao deve ser versionado.

## Build local

Entrar na pasta do app Android:

```powershell
cd apps\motoboy
```

Build debug:

```powershell
.\gradlew.bat :app:assembleDebug
```

Lint:

```powershell
.\gradlew.bat :app:lintDebug
```

Testes unitarios:

```powershell
.\gradlew.bat :app:testDebugUnitTest
```

## Smoke test manual

Use este roteiro quando houver API publicada ou API local acessivel pelo emulador/aparelho:

1. Configurar `farmadelivery.apiUrl` em `local.properties`; no emulador use `http://10.0.2.2:3333`, em aparelho fisico use uma URL HTTPS publicada ou um host da rede local acessivel pelo celular.
2. Conferir se `app/google-services.json` existe localmente para validar FCM; o arquivo nao deve ser versionado.
3. Rodar `.\gradlew.bat :app:assembleDebug` e instalar o APK no emulador/aparelho.
4. Abrir o app, fazer login com um usuario `MOTOBOY` e confirmar que usuarios de loja ou balconista/caixa nao entram no fluxo de campo.
5. Escolher a praca de atendimento e conferir se a lista de entregas livres muda conforme a praca selecionada.
6. Ativar disponibilidade e permitir notificacoes no Android 13+ quando o sistema solicitar.
7. Permitir localizacao, enviar localizacao manualmente e confirmar no painel que o motoboy aparece atualizado.
8. Aceitar uma entrega, coletar, sair em rota e abrir o app de mapas por rota/parada navegavel.
9. Conferir na tela da entrega os dados operacionais de pagamento, valor, telefone, endereco, observacoes e numero diario quando a API enviar.
10. Concluir entrega com confirmacao textual; quando aplicavel, anexar foto de comprovante e confirmar que o historico no painel mostra o evento.
11. Registrar um problema em outra entrega de teste e confirmar que o status e o historico aparecem no painel.
12. Enviar uma notificacao FCM de teste pelo backend ou por uma entrega elegivel e confirmar recebimento no canal `deliveries`.
13. Fazer logout e confirmar que o app tenta marcar o motoboy como indisponivel e interrompe o servico de localizacao.

## Ambiente Android

- `compileSdk` e `targetSdk` seguem a configuracao atual do Gradle.
- O build local foi validado usando o JBR do Android Studio.
- `local.properties` deve apontar para o Android SDK da maquina.
- `google-services.json`, `local.properties`, `.gradle/`, `.kotlin/` e `build/` ficam fora do versionamento.

## Politica de localizacao

Estado atual do app Android:

- O Manifest declara `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE` e `FOREGROUND_SERVICE_LOCATION`.
- O Manifest nao declara `ACCESS_BACKGROUND_LOCATION`.
- O rastreamento automatico roda em `ForegroundService` do tipo `location`, com notificacao persistente, iniciado pelo fluxo do motoboy logado e parado no logout/parada manual.
- A localizacao e usada para atualizar a posicao operacional do motoboy durante atendimento/disponibilidade, nao para rastreamento invisivel fora do fluxo de campo.

Para publicacao externa na Play Store:

1. Declarar no Play Console o tipo de foreground service `location` quando exigido pelo target SDK.
2. Manter texto de permissao e tela de contexto explicando que a localizacao atualiza a posicao do motoboy durante a operacao de entrega.
3. Nao adicionar `ACCESS_BACKGROUND_LOCATION` enquanto o produto nao exigir localizacao com o app fechado ou iniciado a partir do background.
4. Se `ACCESS_BACKGROUND_LOCATION` virar requisito, preparar disclosure especifico, declaracao de permissao sensivel no Play Console, revisao de LGPD e teste em Android 10+ antes do envio.
5. Revalidar no aparelho que o servico so permanece ativo com notificacao visivel e que o logout/parada encerra o envio de localizacao.

## Cuidados

- Nao colocar secrets no app.
- O app usa apenas token recebido da API.
- A permissao final continua no backend.
- Token FCM e dado sensivel: nao registrar em log, tela ou documentacao.
- Android 13+ exige permissao `POST_NOTIFICATIONS`.
- O servico automatico usa notificacao persistente e para no logout.
- Nao solicitar localizacao em background sem decisao explicita de produto, justificativa de core feature e preparacao de declaracao na Play Store.
- Foto de comprovante e enviada ao backend somente quando o motoboy confirma a entrega.
- Manter paridade de contrato com `apps/motoboy-pwa` e com os tipos/respostas da API.
