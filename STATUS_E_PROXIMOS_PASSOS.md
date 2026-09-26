# Status e próximos passos — FarmaDelivery

> Atualizado em 26/09/2026 após consolidação da árvore, testes e build local.

## Classificação

- **Estado:** MVP técnico publicado; árvore consolidada, ainda sem validação comercial
- **Confiança:** alta
- **Natureza:** monorepo operacional de entregas farmacêuticas

## Evidências observadas

- Admin e PWA respondem HTTP 200 em `drogstoantonio.web.app` e `drogstoantonio-motoboy.web.app`.
- Testes e build web passaram na validação local de 26/09/2026.
- A auditoria npm ainda aponta 25 vulnerabilidades conhecidas (1 crítica, 12 altas, 10 moderadas e 2 baixas), registradas no README.
- Builds, segredos e configurações pessoais não fazem parte da árvore rastreada.

## Diagnóstico franco

Está concretizado como sistema demonstrável, mas ainda não há comprovação de operação comercial estável. O maior risco imediato é perder ou misturar o trabalho local.

## Upgrades previstos

### P0 — preservar e tornar retomável

- [x] Preservar e consolidar as mudanças locais sem reset destrutivo.
- [x] Executar os testes e o build disponíveis e registrar o resultado real.
- Corrigir as vulnerabilidades por etapas, com testes de regressão, sem atualizações cegas de dependências.
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

