# FarmaDelivery Motoboy PWA

Aplicativo web instalavel para motoboys, pensado especialmente para uso em celulares quando o app Android nativo nao for a melhor opcao. Ele consome a mesma API e segue o mesmo contrato operacional do app Android.

Este app nao deve documentar nomes reais de lojas, enderecos, coordenadas, chaves Firebase, VAPID keys, tokens ou dados de ambiente.

## Stack

- React 19.
- Vite.
- TypeScript.
- Firebase Web Messaging para Web Push quando configurado e suportado pelo navegador.
- Lucide React para icones.
- Service Worker e manifest web.
- Testes com `tsx --test`.

## Escopo atual

- Login de motoboy usando a API.
- Sessao local e limpeza no logout ou expiracao.
- Escolha local da praca de atendimento configurada no app para filtrar entregas disponiveis sem fluxo administrativo de emprestimo ocasional.
- Lista de entregas disponiveis e entregas em atendimento.
- Disponibilidade do motoboy antes de receber/aceitar novas corridas.
- Envio manual de localizacao.
- GPS automatico enquanto o PWA estiver aberto, com limites por tempo/deslocamento.
- Acoes de entrega: aceitar, coletar, sair em rota, concluir, problema e cancelamento conforme permissao da API.
- Confirmacao textual obrigatoria ao concluir entrega.
- Foto opcional de comprovante, com compressao/redimensionamento local antes do upload.
- Historico auditavel da entrega.
- Atalhos para ligar para o cliente e abrir endereco/rota no app de mapas.
- Tela de rota com paradas pendentes agrupadas por rota ativa.
- URL do Google Maps com origem na localizacao atual, destino e waypoints limitados.
- Aviso quando rota/parada nao possui endereco ou coordenada navegavel.
- Notificacao local de nova entrega ou mudanca de entrega em atendimento.
- Preparacao para Web Push quando `VITE_FIREBASE_WEB_PUSH_VAPID_KEY` estiver configurada e o navegador suportar.
- Exibicao de numero diario da loja quando a API enviar `storeDailyNumber`.

## Estrutura

```text
src/
  App.tsx                         Tela principal e fluxo operacional
  api.ts                          Cliente HTTP da API
  firebase.ts                     Registro Web Push quando suportado
  delivery*.ts                    Helpers de entrega, status, historico e comprovante
  route*.ts                       Helpers de rota, paradas e Google Maps
  operationalSignals.ts           Notificacoes locais e sinais operacionais
  motoboyOperationalStatus.ts     Texto de disponibilidade/GPS
  serviceAreas.ts                 Contrato local das pracas de atendimento
  locationActionLabels.ts         Labels das acoes de localizacao
  types.ts                        Tipos usados pelo PWA
```

## Variaveis

Configurar fora do repositorio.

- `VITE_API_URL`: URL base da API.
- Variaveis Firebase Web, quando Web Push estiver ativo.
- `VITE_FIREBASE_WEB_PUSH_VAPID_KEY`: VAPID key publica para Web Push.

O PWA so tenta registrar Web Push quando a VAPID key e a configuracao Firebase Web minima estao presentes: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` e `VITE_FIREBASE_APP_ID`.

## Comandos

Rodar em desenvolvimento:

```bash
npm run dev -w apps/motoboy-pwa
```

Testar:

```bash
npm run test -w apps/motoboy-pwa
```

Build:

```bash
npm run build -w apps/motoboy-pwa
```

Preview do build:

```bash
npm run preview -w apps/motoboy-pwa
```

## Cuidados

- iOS exige HTTPS e instalacao pela Tela de Inicio para recursos mais proximos de app.
- Web Push depende de suporte do navegador, configuracao Firebase e VAPID key.
- A configuracao Firebase Web deve ficar em `.env` local ou no ambiente de deploy; nao colocar chaves reais em `src/` ou `public/`.
- O GPS automatico do PWA funciona enquanto o app estiver aberto; background real depende das limitacoes do navegador.
- Nao expor tokens Web Push, chaves privadas, dados de cliente ou dados reais de lojas.
- Manter paridade de contrato com `apps/motoboy` e com os tipos da API.
