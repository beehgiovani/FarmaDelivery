# FarmaDelivery Motoboy

Aplicativo Android nativo para motoboys da Drogaria Santo Antonio.

## Escopo inicial

- Login usando a API existente.
- Persistencia local do token com DataStore.
- Listagem de entregas disponiveis/aceitas pelo motoboy autenticado.
- Loading, empty, retry e atualizacao manual nas telas principais.
- Aceite de entrega via `POST /deliveries/accept`.
- Coleta, inicio de rota, entrega e registro de problema usando os endpoints existentes.
- Confirmacao textual obrigatoria antes de concluir entrega em rota.
- Foto opcional como comprovante antes de concluir entrega em rota.
- Compressao local da foto de comprovante antes do upload para respeitar o limite de tamanho da API.
- Consulta do historico auditavel da entrega, incluindo problemas, cancelamentos e observacoes.
- Acoes rapidas no card para abrir o discador do cliente e o endereco no app de mapas do aparelho.
- Tela de rota atual consumindo `GET /courier-routes`, exibindo paradas pendentes e abrindo a sequencia no app de mapas do aparelho, com fallback visual se nao houver app compativel.
- Envio manual da localizacao atual para `POST /couriers/location`.
- Envio automatico de localizacao por `ForegroundService` a cada 60 segundos enquanto ativado pelo motoboy, com estado persistido localmente.
- Registro automatico do token Firebase Cloud Messaging em `POST /couriers/{courierId}/device-token`.
- Canal Android `deliveries` e `FirebaseMessagingService` para exibir notificacoes de nova entrega, cancelamento e atualizacoes operacionais.
- Base pronta para localizacao, mapa, notificacoes e offline.

## Package

`com.drogsantoantonio.farmadelivery`

## API local

No emulador Android, `localhost` aponta para o proprio emulador. Use:

```properties
farmadelivery.apiUrl=http://10.0.2.2:3333
```

em `local.properties`.

## Build local

O modulo possui Gradle Wrapper com Gradle 9.5.1, compile/target SDK 36 e JBR do Android Studio:

```powershell
.\gradlew.bat :app:assembleDebug
```

O `gradle.properties` aponta para o JBR do Android Studio. O JDK 26 esta instalado na maquina, mas falhou no `jlink` ao transformar o `core-for-system-modules.jar` do Android 36; por isso o build local permanece no runtime Java embarcado e compativel do Android Studio.

Validacoes usadas:

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:lintDebug
.\gradlew.bat :app:testDebugUnitTest
```

## Firebase

O arquivo `google-services.json` deve ficar em:

```text
apps/motoboy/app/google-services.json
```

## Regras

- Nao colocar secrets no app.
- O app usa apenas token recebido da API.
- Permissao final continua no backend.
- Token FCM e dado sensivel: nao registrar em log, tela ou documentacao.
- Rotacao de token FCM e reenviada ao backend quando ha sessao de motoboy salva.
- Backup e transferencia de dados locais estao bloqueados por regras XML.
- Android 13+ exige permissao `POST_NOTIFICATIONS`; a home do motoboy solicita essa permissao.
- O servico automatico usa notificacao persistente e para no logout.
- Foto de comprovante e enviada ao backend somente quando o motoboy confirma a entrega; nao fica documentada em logs.
