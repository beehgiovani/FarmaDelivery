# 01_REGRAS_AGENTE.md - Regras Gerais FarmaDelivery (V7.0)

Leitura obrigatoria em cada inicio de sessao. Este documento define as regras universais de engenharia para agentes no projeto FarmaDelivery e complementa as instrucoes locais do repositorio.

> [!IMPORTANT]
> Heranca de regras: este protocolo herda as diretrizes do GuaruGeo GIS e FarmaDelivery. Se houver conflito entre regras globais, regras locais, seguranca, privacidade ou pedido do usuario, a regra mais restritiva prevalece.

## 1. Principios de Interacao

- Nenhum agente e uma ilha: antes de codificar, buscar arquivos de regras locais como `docs/codex/*.md`, `README.md`, `docs/architecture.md`, `docs/implementation-checklist.md`, `docs/supabase.md`, `Agent.Ia.md`, `CLAUDE.md`, `ARCHITECTURE.md` ou equivalentes existentes.
- Respeitar legado e contexto: nao alterar padroes estabelecidos sem justificativa tecnica documentada.
- Comunicacao senior: respostas concisas, focadas em solucao, arquitetura e estado real do projeto.
- Sem vibe code: nao gerar codigo sem estrutura, sem padrao ou fora do escopo pedido.
- Trabalhar com o que existe: preferir padroes, helpers, contratos e arquitetura ja presentes no repositorio.
- antes de criar qualquer coisa, fazer uma pesquisa no repositorios e ver se ja existe algo parecido.
- antes de criar qualquer função, verificar no codigo se ja não existe função parecido.
- nunca deixar funções/logicas similares em locais diferentes. sempre centralizar a lógica.
- se precisar criar um script, uma função ou qualquer outra coisa, verifica se não existe no codebase primeiro. se nao existir, cria e documenta de forma clara eobjetiva.
- preservar a limpeza do codigo e a organização não deixando arquivos desnecessarios, functions sem uso ou arquivos duplicados.
- antes de começar qualquer tarefa verificar se a mesma ja não existe em outro contexto
- verificar se o contexto que você tem é o mais atualizado possivel
- verificar se a freature foi requisitada em outro contexto. se tiver sido, reutilizar a logica de la.
- verificar se a freature foi cancelada em outro contexto. se tiver sido, nao criar a freature.
- verificar se a freature foi duplicada.
- verificar se a freature não viola alguma regra do projeto.
- verificar se a freature não viola alguma regra de arquitetura.
- verificar se a freature não viola alguma regra de segurança.
- verificar se a freature não viola alguma regra de privacidade.
- verificar se a freature não viola alguma regra de negocio.
- verificar se a freature não viola alguma regra de usabilidade.
- verificar se a freature não viola alguma regra de performance.
- verificar se a freature não viola alguma regra de acessibilidade.


## 2. Arquitetura e Estrutura

- Clean Architecture obrigatoria, com separacao clara entre `Domain`, `Application/Data`, `Infrastructure` e `Presentation`.
- Em apps existentes, respeitar a estrutura real do projeto antes de criar novas pastas ou abstracoes.
- Projetos e modulos devem viver em subpastas claras, como `apps/admin`, `apps/api` e futuro `apps/motoboy`.
- Scripts de utilidade devem ficar fora do core da aplicacao, em area propria como `scripts` ou equivalente local.
- Documentacao viva deve ser mantida atualizada quando a mudanca alterar comportamento, setup, banco, deploy ou roadmap.

## 3. Stack Tecnologica

- Backend: Fastify/NestJS em Node.js quando aplicavel; Java/Kotlin modernos para novos modulos JVM.
- Frontend: TypeScript strict, React e Vite/Next.js conforme o app existente.
- Mobile: Kotlin/Compose moderno para o app de motoboys; Kotlin Multiplatform apenas se fizer sentido tecnico no escopo.
- Banco: PostgreSQL/Supabase, com PostGIS quando necessario para geolocalizacao.
- Estilizacao: seguir o design system existente; Tailwind somente se solicitado ou se o projeto ja usar.

## 4. Seguranca e Privacidade

- Zero leak: nunca expor `.env`, secrets, service role keys, JWT secrets ou credenciais reais em docs, exemplos, frontend ou logs.
- Usar sempre envs reais locais para rodar o projeto; arquivos `.env.example` devem conter apenas exemplos e placeholders.
- Server-only secrets nunca entram no frontend. Variaveis `VITE_*` devem ser tratadas como publicas.
- Privacy first: mascarar dados sensiveis por padrao quando forem exibidos, exportados ou logados sem necessidade operacional.
- Autenticacao por token assinada pela API, com validacao forte de role, loja e motoboy.
- Auditoria obrigatoria em operacoes relevantes: ator, acao, alvo e timestamp UTC.
- Logs estruturados devem incluir `request_id` e `timestamp UTC` quando a infraestrutura de logging estiver sendo alterada.

## 5. Banco, Supabase e SQL

- Nao rodar SQL diretamente pelo terminal neste projeto. Se SQL for necessario, preparar o script e orientar o usuario a executar manualmente no SQL Editor do Supabase.
- Documentar cada mudanca de schema, migration, RLS ou policy.
- RLS policies devem acompanhar o modelo final de autenticacao e realtime.
- A conexao direta Prisma deve preferir o Supabase pooler no `DATABASE_URL`.
- O fallback Supabase REST deve preservar escopo, permissao e ator sempre que for usado.

## 6. Regras Especificas FarmaDelivery

- Admin cria e gerencia logins de usuarios: administradores, gerentes, balconistas/caixas e motoboys.
- Recuperacao de senha tambem deve passar pelo fluxo administrativo definido.
- Balconista/caixa so pode operar dentro do escopo da loja vinculada, salvo regra explicita de emprestimo documentada.
- Motoboy nao e fixo de loja, exceto regra operacional especifica do Pereque.
- Asturias e base principal dos motoboys das lojas 1-4; Pereque tem motoboy dedicado.
- Alocacao de motoboys deve considerar disponibilidade, proximidade, rodizio e regras dinamicas do negocio.
- Entregas, rotas, eventos e recalculos devem manter historico auditavel.

## 7. Escopo e Implementacao

- Fazer somente o que foi solicitado ou o que o checklist/documentacao local define como proximo passo direto.
- Nao adicionar features auxiliares por intuicao.
- Evitar abstracoes prematuras; duplicacao pequena e clara pode ser melhor que generalizacao fragil.
- Comentarios no codigo so quando explicam um "por que" nao obvio.
- Validar entradas em fronteiras do sistema: usuario, API externa, banco, realtime e integrações.
- Toda mudanca significativa deve passar por build, typecheck ou teste equivalente.

## 8. Organizacao de Documentacao Local

A hierarquia preferida para docs de agentes e:

1. `00_LEIA_ME_PRIMEIRO.md`: status atual e bloqueadores.
2. `01_REGRAS_AGENTE.md`: regras especificas e universais do projeto.
3. `02_ARQUITETURA.md`: detalhes tecnicos, camadas e fluxos.
4. `03_BANCO_DE_DADOS.md` ou `docs/supabase.md`: schema, migrations, RLS e scripts SQL manuais.
5. `04_FEATURES.md` ou documentos especificos como `04_FEATURES_MOTOBOY.md`: roadmap e especificacoes.

Tambem manter atualizados:

- `README.md`: visao geral, setup e comandos principais.
- `docs/implementation-checklist.md`: estado de implementacao e proximos itens.
- Snapshot SQL real do banco, quando o schema mudar e o projeto tiver gerador consolidado.

## 9. Checklist de Cada Task

- Respeitou Clean Architecture e estrutura local?
- Leu os docs/regras relevantes antes de alterar codigo?
- A funcionalidade esta dentro do escopo pedido?
- Nao inventou contexto, feature ou abstracao desnecessaria?
- Protegeu secrets, envs reais e dados sensiveis?
- Validou permissao, role, loja, motoboy e ator?
- Manteve auditoria quando a operacao altera estado operacional?
- Atualizou docs/checklist quando o estado do projeto mudou?
- Rodou build/typecheck/testes adequados?
- Preparou SQL para execucao manual quando houve mudanca de banco?

## 10. Estado Operacional Importante

- `/auth/bootstrap-admin`, `/auth/login` e `/auth/me` ja foram validados via fallback Supabase REST.
- A API local pode operar via fallback REST quando Prisma direto nao alcanca o Postgres.
- Nunca assumir que uma falha de Prisma autoriza relaxar permissoes no fallback.
- O futuro app Kotlin deve usar o mesmo backend, token e modelo de permissoes.
- Toda feature operacional nova de motoboy deve ser planejada e mantida em paridade entre o app Kotlin Android (`apps/motoboy`) e o PWA para iPhone (`apps/motoboy-pwa`). Se houver limitacao real do iOS/PWA, documentar a diferenca explicitamente no checklist.
