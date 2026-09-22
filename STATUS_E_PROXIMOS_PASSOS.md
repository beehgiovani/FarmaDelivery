# Status e próximos passos — FarmaDelivery

> Auditoria de 22/09/2026. Esta é uma fotografia baseada em arquivos, Git, artefatos e endpoints observáveis. Nenhum build completo foi executado nesta classificação.

## Classificação

- **Estado:** MVP técnico maduro e publicado; evolução local não consolidada
- **Confiança:** alta
- **Natureza:** monorepo operacional de entregas farmacêuticas

## Evidências observadas

- Admin e PWA respondem HTTP 200 em `drogstoantonio.web.app` e `drogstoantonio-motoboy.web.app`.
- Existe APK debug Android e documentação extensa de preflight.
- O repositório possui 49 mudanças locais, com trabalho em rotas, mapas, alertas e app Android.

## Diagnóstico franco

Está concretizado como sistema demonstrável, mas ainda não há comprovação de operação comercial estável. O maior risco imediato é perder ou misturar o trabalho local.

## Upgrades previstos

### P0 — preservar e tornar retomável

- Preservar as 49 mudanças em backup e commits temáticos, sem reset.
- Executar a suíte de admin, PWA, API e Android e registrar o que realmente passa.
- Separar ambiente de demonstração de qualquer dado operacional real.

### P1 — estabilizar

- Fechar autenticação, RLS, geolocalização, retenção e consentimento.
- Gerar release Android assinada e testar instalação/atualização.
- Criar smoke test ponta a ponta: criar entrega, atribuir, atualizar rota e concluir.

### P2 — evoluir

- Adicionar observabilidade e recuperação offline.
- Validar com uma operação piloto antes de alegar uso produtivo.

## Critério para considerar retomado

O projeto será considerado retomado quando um ambiente de homologação executar o fluxo completo com testes, segurança revisada e releases reproduzíveis.

## Prompt de retomada para o Codex

> Retome o projeto **FarmaDelivery** nesta pasta. Leia este arquivo e o README, inspecione o Git e preserve todo trabalho local. Comece somente pelo P0, valide com evidências e não implemente P1/P2 antes de apresentar o diagnóstico atualizado.

