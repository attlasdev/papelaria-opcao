# Organização do projeto

Adaptação do conhecimento de `C:\Users\victo\Desktop\AGENTES\Stack\stack-inicial`
para este aplicativo. O material de origem é uma referência de trabalho; a stack
efetiva e as decisões do projeto ficam em `AGENTS.md`, `CLAUDE.md` e `Memoria.md`.

## O que já existe

| Local | Papel |
| --- | --- |
| `comum/contrato.ts` | Tipos e operações da fronteira entre interface e Electron. |
| `src/` | React: telas (`telas/`), componentes (`componentes/`), tokens e base de CSS (`estilos/`), rotas e mock. Detalhes em `AGENTS.md`. |
| `electron/` | Janela, preload, IPC e futuras operações com o banco. |
| `recursos/` | Marca (logo) e acervo de referência visual (`design-system/`), incluindo o script que recorta os ícones do app. |
| `stitch/` | Histórico: protótipo HTML do Google Stitch, já migrado para `src/`. |
| `Memoria.md` | Estado atual, pendentes, regras de produto e decisões. |
| `docs/contrato/` | Inventário do que cada tela lê e grava, e registro das mudanças que afetam a interface. |
| `docs/auditorias/` | Achados técnicos datados e correções posteriores; conferir o estado atual em `Memoria.md`. |
| `docs/historico/` | Memória antiga sessão a sessão; não é o estado atual. |
| `docs/superpowers/` | Planos e especificações de rodadas já executadas. |

As regras de negócio que valem hoje estão em `Memoria.md`; o vocabulário em
código, em `src/mock/base/tipos.ts`. A identidade visual em uso está nos tokens de
`src/estilos/tokens/`. `supabase/` só entra
quando houver banco de teste e migrations reais.

A retomada da revisão por telas está no topo de `Memoria.md`. O registro de
`docs/historico/2026-10-01-revisao-com-victor.md` distingue tarefas implementadas
de validação pelo usuário; Financeiro e Caixa permanecem não validados.

As pranchas recebidas para a interface desktop estão catalogadas em
`recursos/design-system/README.md`. Elas fornecem repertório de componentes e
tipografia; as duas pranchas de paletas foram excluídas a pedido do usuário.

## Princípios aproveitados da Stack

1. Cada pasta tem um papel claro. Agrupe por funcionalidade quando o código crescer,
   sem criar diretórios especulativos. Para o front, `src/features/<funcionalidade>/`
   é uma opção quando nascer a primeira funcionalidade real; `src/mock/` continua
   responsável pelo comportamento falso da API.
2. Mantenha textos e dados extensos fora do JSX quando isso melhorar a leitura.
   Não fragmente componentes apenas para cumprir um limite de linhas.
3. Em Tailwind v4, prefira tokens semânticos no CSS (`@theme`) a cores repetidas
   em componentes. Defina os valores a partir da marca, quando conhecida.
4. Animação é opcional. Se GSAP entrar, use `@gsap/react` para ciclo de vida e
   limpeza, centralize plugins e respeite movimento reduzido. O conteúdo deve
   permanecer completo e visível sem animação.
5. Verifique mudanças de interface nos estados de carregamento, sucesso e falha
   que o mock já expõe. Rode o build antes de entregar código quando possível.

## Habilidades trazidas

As skills foram copiadas para `.agents/skills/` com seus arquivos de apoio:

- Design e interface: `tailwind-design-system` e `web-design-guidelines`.
- Animação: `gsap-core`, `gsap-react`, `gsap-timeline`, `gsap-scrolltrigger`,
  `gsap-performance`, `gsap-plugins` e `gsap-utils`.
- Arquitetura e contexto: `codebase-design`, `domain-modeling`,
  `agent-memory-engineering` e `grilling`.

Não havia uma skill geral de React na pasta de origem. `gsap-react` cobre
especificamente a integração de animações com React. GSAP e `@gsap/react` estão
instalados, só para as microinterações aprovadas (ver `Memoria.md`).

`web-design-guidelines` fica em `.agents/skills/web-design-guidelines/` e serve
para revisar acessibilidade, navegação e estados da interface existente. Antes
de cada revisão, sua instrução pede consultar a versão atual das diretrizes na
fonte indicada pelo próprio `SKILL.md`.

## Itens da Stack não aplicados

- Next.js, App Router, `next/font`, `next/image`, AGENTS gerado pelo Next e
  Vercel: são para projetos web e não cabem na base Electron + Vite atual.
- O script `verify-structure.mjs` e os moldes de CSS da Stack presumem a árvore
  do Next e fontes via `next/font`; copiá-los aqui produziria regras falsas.
- A skill de Vue/Svelte e a de deploy Vercel não foram trazidas. A rotina de
  revisão de arquitetura que exige subagentes e relatório HTML também ficou fora.

Nenhum arquivo de código foi movido e nenhuma dependência foi adicionada nesta
adaptação. A estrutura de código será aprofundada conforme o domínio nascer.
