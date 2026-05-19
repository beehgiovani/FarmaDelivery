# Diretrizes de Engenharia

Estas regras orientam qualquer alteracao no FarmaDelivery. Elas complementam as regras universais em `C:\Users\bruno\AndroidStudioProjects\governance` e devem ser lidas junto com `../README.md`, `architecture.md` e `implementation-checklist.md`.

## Heranca Universal

O projeto herda as regras gerais de `C:\Users\bruno\AndroidStudioProjects\governance`, principalmente:

- 01_PRINCIPIOS_UNIVERSAIS: entender antes de implementar, nenhum agente e uma ilha, nao inventar arquitetura, trabalhar com o que existe e controlar escopo.
- 02_ENGENHARIA: separar responsabilidades, manter estrutura previsivel, centralizar logica e preservar compatibilidade com legado.
- 03_SEGURANCA: proteger secrets, separar ambientes, aplicar menor privilegio, tratar privacidade como padrao e manter auditoria.
- 04_QUALIDADE_DE_CODIGO: priorizar legibilidade, comentarios uteis, remocao de codigo morto e validacao de entradas.
- 06_BANCO_DE_DADOS: documentar mudancas estruturais, preservar integridade, usar constraints e evitar queries inseguras ou sem indice.
- 07_APIS_E_INTEGRACOES: manter contratos claros, erros consistentes, resiliencia e compatibilidade de consumidores.
- 08_FRONTEND_MOBILE_UX: nao colocar regras criticas na UI, respeitar acessibilidade e manter consistencia visual.
- 09_IA_E_AGENTES: validar saidas de IA, evitar acoes criticas sem verificacao e preservar seguranca do contexto.
- 11_DOCUMENTACAO: manter documentacao viva, organizada e proporcional ao projeto.
- 12_TESTES_E_VALIDACAO: validar mudancas com build, testes, typecheck, smoke ou revisao manual conforme risco.
- 14_ANTI_PADROES: evitar services gigantes, SQL espalhado, permissao so no frontend, logs sensiveis, codigo sem ownership e arquivos orfaos.
- 17_CHECKLIST: usar o checklist universal antes de concluir tarefas relevantes.

Se houver conflito entre `governance`, regras locais, seguranca, privacidade ou pedido explicito do usuario, vale a regra mais restritiva.

## Principios

- Trabalhar com o estado real do repositorio antes de criar codigo, docs ou scripts.
- Pesquisar se ja existe funcao, helper, componente, contrato ou documento equivalente antes de criar outro.
- Centralizar logicas similares; evitar duplicidade silenciosa entre API, admin, Android e PWA.
- Respeitar os nomes e contratos usados pelo Prisma, Supabase, API e clientes.
- Fazer mudancas pequenas, verificaveis e alinhadas ao escopo pedido.
- Remover arquivos obsoletos quando um fluxo for consolidado em uma fonte canonica.

## Arquitetura

- Backend: Fastify, TypeScript, Prisma e fallback Supabase REST server-side.
- Admin e PWA: React, Vite e TypeScript.
- Android: Kotlin/Compose.
- Banco: Supabase/PostgreSQL, com SQL canonico em `database/schema-full.sql`.
- Clean Architecture deve guiar novas areas, sem inventar camadas quando o modulo atual ja tem um padrao simples e claro.

## Seguranca e Privacidade

- Nunca expor `.env`, JWT secrets, service role keys, tokens Firebase, chaves privadas ou credenciais reais.
- Variaveis `VITE_*` sao publicas; segredos ficam apenas no backend ou em ambiente seguro.
- Mascarar dados pessoais em logs, exports e telas quando o detalhe nao for necessario para a operacao.
- Operacoes relevantes devem preservar ator, escopo, horario e trilha auditavel.
- Mudancas que afetem cliente, telefone, endereco, localizacao, comprovantes ou auditoria devem ser conferidas contra `lgpd.md`.

## Supabase e SQL

- Nao rodar SQL diretamente pelo terminal neste projeto; preparar o arquivo e orientar execucao manual no SQL Editor do Supabase.
- `database/schema-full.sql` e a fonte canonica para schema, seeds, RLS, realtime e comentarios SQL.
- Toda tabela deve ter `COMMENT ON TABLE` explicando finalidade, uso no codigo, RLS e cuidados operacionais.
- O SQL canonico deve prevenir duplicidades e erros por existencia com `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE` ou blocos `DO $$`.
- Nao recriar seeds, policies, realtime ou migrations em arquivos separados sem decisao explicita.

## Paridade Operacional

- Features de motoboy devem manter paridade entre `apps/motoboy` e `apps/motoboy-pwa`, salvo limitacao real documentada.
- Textos operacionais devem ser curtos, claros e consistentes entre superficies.
- Nao usar dados mockados para substituir estado real quando a tela representa operacao.

## Validacao

- Rodar testes e build quando a mudanca afetar codigo, contratos, banco ou comportamento.
- Atualizar `implementation-checklist.md` quando um item for concluido, bloqueado ou reclassificado.
- Atualizar `README.md` quando um documento canonico novo for criado.
