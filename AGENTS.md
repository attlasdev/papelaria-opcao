# Papelaria Opção — orientação para agentes

Este projeto é um aplicativo desktop em estágio inicial. Antes de alterar código, leia
`CLAUDE.md` para as regras de fronteira e `Memoria.md` para decisões e pendências.
`front-side.md` orienta o trabalho da interface; `revisao-de-contrato.md` orienta
a revisão do contrato. A organização adaptada da Stack está em
`docs/organizacao.md`. Para trabalho visual, consulte primeiro
`recursos/design-system/README.md` e a ficha da família de componente.

## Stack efetiva

- Electron + electron-builder; Vite + React 19 + TypeScript + Tailwind CSS v4.
- `npm run dev` abre o front com mock no navegador; `npm start` abre o Electron.
- O banco online ainda não está integrado. Supabase é uma hipótese registrada em
  `Memoria.md`, não uma dependência instalada.
- GSAP e `@gsap/react` estão instalados para as microinterações aprovadas.
  Consulte `Memoria.md` antes de ampliar o uso: o usuário quer movimento mínimo.

## Fronteiras que devem sobreviver à organização

- `comum/contrato.ts` define a única interface entre front, preload e operações.
  Mudanças nele precisam ser isoladas para revisão dos dois responsáveis.
- `src/` contém interface e mock. Credenciais, cliente de banco, acesso ao disco e
  módulos Node ficam fora do renderer.
- `electron/` contém janela, preload e operações reais. Toda chamada do front
  retorna `Resultado<T>`; exceções não atravessam o IPC.
- Em `electron/main.ts`, mantenha a validação do remetente de IPC e o bloqueio
  de navegação e novas janelas; consulte `docs/electron.md` antes de abrir
  links externos ou conceder permissões.
- Preserve nomes de código em português sem acento, dinheiro em centavos, IDs
  como string e datas ISO 8601 UTC no contrato.
- Não substitua Vite/Electron por Next.js nem introduza deploy Vercel por causa
  do material de origem da Stack. Uma mudança dessas exige pedido do usuário.

## Organização e habilidades

- Agrupe arquivos de uma funcionalidade pelo que muda junto. Crie pastas só
  quando houver arquivos reais para elas; mantenha funções e componentes com
  papéis claros. Respeite a divisão de responsabilidade descrita acima.
- Em Tailwind v4, os tokens ficam em `@theme` no CSS (ver seção abaixo). Não
  copie cores de exemplo da Stack como se fossem decisões da Papelaria Opção.
- As 14 pranchas em `recursos/design-system/` são a referência visual de
  componentes, tipografia e hierarquia. Os dois PDFs de paletas foram excluídos
  a pedido do usuário; cores ilustrativas das demais pranchas não viram tokens
  de marca. Medidas não declaradas no acervo precisam ser definidas na
  implementação, sem atribuí-las ao PDF.
- Se usar GSAP com React, centralize registro de plugins, use `useGSAP` com
  escopo e limpeza, respeite `prefers-reduced-motion` e deixe o conteúdo visível
  sem animação. Não amplie as animações só pela existência das skills.
- Skills locais ficam em `.agents/skills/`. Consulte a skill pertinente antes
  de executar trabalhos de Tailwind, GSAP, modelagem de domínio ou arquitetura.
- `web-design-guidelines` fica em `.agents/skills/web-design-guidelines/` para
  revisão de acessibilidade e interação; o mapa está em `docs/organizacao.md`.
- Antes de uma entrega de código, rode `npm run build` quando as dependências
  estiverem instaladas. Não presuma que o esqueleto já foi validado.

## Interface: como está montada

As nove telas vieram do Google Stitch e foram migradas para React em
2026-09-23. `stitch/` agora é só histórico: não edite lá, edite em `src/`.
Decisões e porquês em `Memoria.md`; desenho aprovado em
`docs/superpowers/specs/2026-09-23-migracao-telas-stitch-design.md`.

```
src/
  estilos/tokens/     cores, tipografia, espacos, raios, sombras (@theme static)
  estilos/base/       fonte Inter local, reset, elementos soltos
  estilos/index.css   só importa; não escreva regra aqui
  componentes/<nome>/ Nome.tsx + nome.css
    layout/barra-lateral, layout/tela, layout/moldura
    botao, selo, painel (Painel + CartaoResumo), tabela, filtros, paginacao,
    campo, modal, aviso, icone
  telas/<tela>/       Tela.tsx + tela.css + dados-exemplo.ts
    inicio, criar-ficha (blocos cliente/, itens/, pagamento/), clientes,
    detalhe-cliente, financeiro, estoque, cadastrar-produto, registrar-entrada,
    notas-fiscais
    detalhe-ficha, formulario-cliente, ajustar-estoque, movimentacoes-estoque,
    registrar-movimento, rascunhos-notas, detalhe-fiscal, resultados-busca,
    vendas-sem-identificacao (fichas sem cliente; nao e um cadastro)
    formulario-cliente/JanelaCliente: o formulario de cliente, gaveta em Clientes e janela na nova ficha
  mock/base/          base local única: tipos (fatos), semente, derivados, persistência
  mock/estado-demonstracao.ts  store (useEstadoDemonstracao) e ações sobre a base
  rotas.tsx           rotas (react-router, modo hash)
  rotas-caminhos.ts   endereços das telas; botões usam estas constantes
  formatar.ts         dinheiro: centavos -> "R$ 1.234,56"
```

Regras para mexer na interface:

- **Tela não guarda dado próprio.** Lê `useEstadoDemonstracao()` e as funções de
  `src/mock/base/derivados.ts`; grava pelas ações de `estado-demonstracao.ts`.
  Fato novo entra em `mock/base/tipos.ts` e na semente; número ou situação
  calculada vira função em `derivados.ts`, com teste (`npm test`).

- **CSS por componente**, decisão do usuário. Estilo vai no `.css` ao lado do
  `.tsx`, com classes `bloco__parte--variante`. Tailwind só dá o preflight e
  gera os tokens; não espalhe utilitários no JSX.
- **Nenhuma cor, fonte ou sombra solta fora de `src/estilos/tokens/`.** Use
  `var(--color-*)`, `var(--espaco-*)`, `var(--radius-*)`, `var(--text-*)`.
  Precisa de valor novo? Crie o token primeiro. Conferência:
  `grep -rnE "#[0-9a-fA-F]{3,6}|rgb\(" src --include=*.css` só pode achar tokens.
- **Situação usa a família pastel** (`ok`, `atencao`, `critico`, `neutro`):
  `SeloSituacao` (largura única, uma ou duas linhas centradas), `SeloCompacto`
  (uma linha, ao lado de número), `Etiqueta` (neutra, se ajusta ao texto).
  Vermelho forte só para saída de dinheiro, erro e alerta.
- **Ícone só onde ajuda a achar.** Título de seção e nome de campo de consulta
  (cliente, data, documento, telefone, e-mail, endereço) levam `ComIcone`
  (`componentes/icone/Icone.tsx`): ícone solto, 16 px, cinza suave, sem fundo.
  Forma de pagamento usa o ícone do meio. Não leva ícone: campo de formulário
  curto, valores, situação que já tem selo colorido, linha a linha de tabela.
  Cor no ícone só no sino (gravidade). Ícone novo sai do `Icons.pdf` pelo script
  `extrair_icones.py`, nunca desenhado à mão.
- **Selo tem largura fixa: texto curto.** A segunda linha do `SeloSituacao` cabe
  em ~24 caracteres; valor em aberto e outros números vão numa célula ao lado,
  não no selo. O componente corta com reticências como proteção, não como regra.
- **Rótulo não quebra no meio.** Selos, etiquetas, títulos de coluna e botões
  usam `nowrap`; linhas de tabela têm a mesma altura (texto longo em uma ou duas
  linhas com o texto inteiro no `title`).
- **Uma moldura só.** Toda tela usa `<Tela titulo busca acaoCabecalho
  acoesTitulo>`; barra lateral e cabeçalho não são redesenhados por tela.
  "Criar ficha" fica só na barra lateral.
- **Dados de exemplo** vêm de `dados-exemplo.ts` da própria tela, em centavos.
  Podem divergir entre telas de propósito nesta fase; o contrato ainda não mudou.
- **Botão sem tela pronta** chama `useSemDestino()('nome da ação')`, que mostra
  "Ainda sem destino". Quando a tela existir, troque por `navegar(rotas.x)`.
- **Ícones** são os do acervo (`Icons.pdf`), em `<Icone nome="..." />`. Para
  acrescentar: ache a posição no PDF, inclua em `ICONES` de
  `recursos/design-system/componentes/icones/biblioteca/extrair_icones.py` e
  rode o script (`pip install pymupdf`). Não edite `desenhos.ts` à mão.
- **Verificação antes de entregar:** `npm run build`; abrir as telas afetadas em
  `npm run dev` (prévia configurada em `.claude/launch.json`, porta 5173) na
  largura de 1300 px e na mínima de 900 px, conferindo que nada transborda e que
  o console não tem erro.

As instruções do usuário e as decisões específicas deste projeto prevalecem sobre
os exemplos e padrões genéricos copiados da Stack.
