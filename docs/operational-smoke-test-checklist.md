# Checklist de Smoke Test Operacional

Use este arquivo para registrar o teste real do painel admin, login de loja, API e fluxo de entrega antes de liberar producao. Nao registre telefones completos, enderecos completos, tokens, chaves, project IDs, nomes reais de lojas ou credenciais.

## Evidencia Segura

- Commit testado:
- Data/hora aproximada: 2026-05-27
- Ambiente da API: local via Docker em `localhost:3433`
- Ambiente do admin: local via Docker em `localhost:5173`
- Perfil admin usado: admin de teste
- Perfil loja usado: login operacional de teste
- Resultado geral: pendente; preflight local aprovado, smoke operacional manual ainda pendente

## Preflight

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| `npm run preflight:production -- file=env/api.env file=env/admin.env` passou | Aprovado | Passou com warnings apenas de deploy real: storage persistente, Firebase Admin, URL publica da API e Firebase Web config. |
| `npm run repo:sensitive:check` passou | Aprovado | Nenhum arquivo sensivel rastreado encontrado. |
| `npm run db:rls:check` passou | Aprovado | Auditoria estatica validou RLS e comentarios no SQL canonico. |
| Supabase revisado no SQL Editor conforme runbook | Pendente |  |
| API responde `/health` no ambiente testado | Aprovado | API local Docker respondeu 200. |
| Admin abre apontando para a API correta | Parcial | Container admin local esta healthy; conferencia visual com login ainda pendente. |

## Admin

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| Login admin funciona | Pendente |  |
| Sessao expirada redireciona para login sem tela branca | Pendente |  |
| Dashboard carrega lojas, entregas, mapa e indicadores sem dados falsos | Pendente |  |
| Estados de carregando, vazio, erro e retry estao legiveis | Pendente |  |
| Cadastro de loja cria unidade e prepara login operacional | Pendente |  |
| Cadastro de login da loja fica restrito a unidade | Pendente |  |
| Cadastro de balconista/caixa fica como referencia sem login | Pendente |  |
| Cadastro de motoboy cria acesso dedicado com senha inicial | Pendente |  |
| Redefinicao de senha admin mostra confirmacao inline e novo acesso copiavel | Pendente |  |
| Painel de notificacoes nao exibe token de dispositivo | Pendente |  |

## Login de Loja e Entrega

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| Login operacional da loja visualiza apenas a propria unidade | Pendente |  |
| Criacao de entrega busca/reutiliza cliente por telefone | Pendente |  |
| Mascara de telefone permite digitacao completa sem travar | Pendente |  |
| Autocomplete de balconista aceita codigo/nome como referencia | Pendente |  |
| Valor em BRL e forma de pagamento entram nas observacoes operacionais | Pendente |  |
| Troco/conta aparece corretamente quando aplicavel | Pendente |  |
| Geocodificacao sugere ponto ou permite lancar sem ponto por acao explicita | Pendente |  |
| Ponto manual no mapa salva coordenada escolhida | Pendente |  |
| Numero diario da loja aparece apos criar entrega | Pendente |  |
| Comanda 80mm imprime com blocos, pagamento e margem inferior | Pendente |  |

## Operacao e Relatorios

| Item | Resultado | Observacao sem dado sensivel |
| --- | --- | --- |
| Fila atualiza status apos aceite/coleta/rota/conclusao/problema | Pendente |  |
| Historico da entrega mostra ator, horario e observacoes | Pendente |  |
| Comprovante abre no painel com feedback inline se falhar | Pendente |  |
| Relatorio filtra por periodo, status, prioridade, comprovante e ponto no mapa | Pendente |  |
| Relatorio filtra por balconista e motoboy | Pendente |  |
| CSV de relatorio nao expoe telefone completo nem formula insegura | Pendente |  |
| CSV de notificacoes nao expoe token de dispositivo | Pendente |  |
| Alertas/avisos de push mostram falhas operacionais sem detalhes tecnicos | Pendente |  |

## Criterio Final

Marque como aprovado somente quando admin, login de loja, criacao de entrega, comanda, relatorios e monitor de notificacoes funcionarem sem expor token, segredo, telefone completo ou endereco completo em tela de monitoramento, CSV, log, print ou documentacao.
