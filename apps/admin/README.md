# FarmaDelivery Admin

Painel web usado por administradores e logins operacionais de loja para acompanhar entregas, cadastrar acessos, gerenciar unidades, consultar relatorios e operar o despacho.

Este app nao deve documentar nomes reais de lojas, enderecos, coordenadas, chaves ou dados de ambiente. Esses dados pertencem ao banco, ao ambiente seguro ou a documentacao interna controlada.

## Stack

- React 19.
- Vite.
- TypeScript.
- Leaflet e React Leaflet para mapas.
- Lucide React para icones.
- Supabase client para realtime autenticado.
- Testes com `tsx --test`.

## Escopo atual

- Login, primeiro acesso admin, sessao salva e logout automatico em `401`.
- Fila operacional de entregas por status e escopo de loja.
- Criacao de entrega com cliente, telefone, endereco, loja origem, prioridade, prazo manual, agendamento, atendente/balconista e impressao de comanda.
- Busca de cliente por telefone e reaproveitamento de enderecos.
- Mascara de telefone que preserva digitacao parcial e valida por digitos.
- Geocodificacao automatica pelo backend, escolha entre alternativas e criacao explicita sem ponto no mapa quando necessario.
- Ajuste manual de latitude/longitude por modal Leaflet antes de lancar entrega.
- Mapa operacional com lojas, motoboys, entregas, rotas ativas e indicadores de entregas sem ponto.
- Despacho, historico, comprovantes, cancelamento, problemas e acoes operacionais.
- Cadastros administrativos de lojas/unidades, acessos, horarios, alocacoes e equipe operacional.
- `BALCONISTA_CAIXA` tratado como referencia operacional/autocomplete, sem login individual de loja.
- Login de loja tratado como acesso da unidade, limitado ao seu escopo.
- Relatorios por periodo, loja, motoboy, balconista/atendente, status, prioridade, comprovante e ponto de mapa.
- Exportacoes CSV com telefone mascarado e protecao contra formulas de planilha.
- Monitoramento de notificacoes sem expor tokens de dispositivo.

## Estrutura

```text
src/
  App.tsx                  Composicao principal e navegacao do painel
  api.ts                   Cliente HTTP e tratamento de sessao
  apiMappers.ts            Conversao de labels/status/prioridades
  components/              Telas e blocos visuais do painel
  deliveryPhone.ts         Normalizacao e validacao de telefone
  deliverySchedule.ts      Regras de agendamento
  deliverySla.ts           Regras de atraso/SLA visual
  managementAccess.ts      Helpers do painel de acessos/lojas
  report*.ts               Filtros, exportacao e resumo de relatorios
  route*.ts                Labels e helpers de rotas/paradas
  thermalReceipt.ts        Impressao de comanda termica
  types.ts                 Tipos consumidos pela UI
```

## Variaveis

As variaveis devem ser configuradas fora do repositorio em arquivos locais ignorados ou no ambiente de deploy.

- `VITE_API_URL`: URL base da API.
- Variaveis Supabase/Firebase web, quando o recurso correspondente estiver ativo.

Use exemplos sem valores reais quando precisar documentar ambiente.

## Comandos

Rodar em desenvolvimento:

```bash
npm run dev -w apps/admin
```

Testar:

```bash
npm run test -w apps/admin
```

Build:

```bash
npm run build -w apps/admin
```

Preview do build:

```bash
npm run preview -w apps/admin
```

## Cuidados

- Nao expor dados reais de clientes, lojas, coordenadas, tokens ou senhas.
- Preservar os textos de usuario final sem termos tecnicos desnecessarios.
- Manter o escopo por perfil alinhado ao backend.
- Ao mexer em mapa/geocodificacao, validar entregas com ponto, sem ponto e ajuste manual.
- Ao mexer em relatorios/CSV, manter mascaramento de telefone e protecao contra formulas.
