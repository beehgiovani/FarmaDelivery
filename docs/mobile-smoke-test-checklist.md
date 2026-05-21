# Checklist de Smoke Test Mobile

Use este arquivo para registrar o teste real dos apps de campo antes de liberar uso operacional. Nao registre telefones completos, enderecos completos, tokens, chaves, project IDs, nomes reais de lojas ou credenciais.

## Evidencia Segura

- Commit testado:
- Data/hora aproximada:
- Ambiente da API: local, rede local ou HTTPS publicado
- Dispositivo Android/emulador:
- Dispositivo iOS/PWA:
- Perfil usado: motoboy de teste
- Praca selecionada:
- Resultado geral: pendente, aprovado ou reprovado

## Preflight

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| `npm run mobile:local-check -- --api-config` conferido | Pendente |  |
| `npm run mobile:local-check` passou | Pendente |  |
| APK instalado no Android/emulador | Pendente |  |
| PWA publicado em HTTPS quando Web Push for testado | Pendente |  |
| Firebase Admin configurado na API para FCM HTTP v1 | Pendente |  |
| Variaveis Firebase Web e VAPID configuradas no PWA | Pendente |  |

## Android

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| Login de motoboy funciona | Pendente |  |
| Login de loja/balconista nao entra no fluxo de campo | Pendente |  |
| Escolha de praca filtra entregas livres | Pendente |  |
| Estados de carregando, vazio, erro/retry e lista preenchida estao legiveis | Pendente |  |
| Disponibilidade bloqueia/libera aceite corretamente | Pendente |  |
| GPS manual atualiza a posicao no painel | Pendente |  |
| GPS automatico mostra notificacao persistente e para no logout | Pendente |  |
| Aceitar, coletar e sair em rota refletem no painel | Pendente |  |
| Atalho de mapa abre rota/parada navegavel | Pendente |  |
| Valor, pagamento, troco/conta, telefone, endereco, observacoes e numero diario aparecem no card | Pendente |  |
| Conclusao com observacao grava historico | Pendente |  |
| Foto opcional de comprovante comprime/envia e abre no painel | Pendente |  |
| Problema operacional muda status e aparece no historico | Pendente |  |
| Push FCM chega no canal `deliveries` sem expor token | Pendente |  |
| Logout limpa sessao e tenta marcar indisponivel | Pendente |  |

## PWA iOS

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| PWA abre instalado pela Tela de Inicio | Pendente |  |
| Login de motoboy funciona | Pendente |  |
| Escolha de praca filtra entregas livres | Pendente |  |
| Estados de carregando, vazio, erro/retry e lista preenchida estao legiveis | Pendente |  |
| Disponibilidade bloqueia/libera aceite corretamente | Pendente |  |
| GPS manual atualiza a posicao no painel | Pendente |  |
| GPS automatico funciona enquanto o PWA esta aberto | Pendente |  |
| Notificacao Web Push chega fora da aba do Safari | Pendente |  |
| Notificacao local aparece com app aberto quando ha nova entrega/mudanca | Pendente |  |
| Aceitar, coletar, sair em rota, concluir e problema refletem no painel | Pendente |  |
| Atalho de mapa abre rota/parada navegavel | Pendente |  |
| Valor, pagamento, troco/conta, telefone, endereco, observacoes e numero diario aparecem no card | Pendente |  |
| Foto opcional de comprovante comprime/envia e abre no painel | Pendente |  |
| Logout limpa dados operacionais e token local | Pendente |  |

## Criterio Final

Marque como aprovado somente quando Android e PWA iOS passarem sem exposicao de token, segredo, telefone completo ou endereco completo em tela de monitoramento, CSV, log, print ou documentacao.
