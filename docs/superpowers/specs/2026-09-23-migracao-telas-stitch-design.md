# Migração das telas do Stitch para o aplicativo

Data: 2026-09-23. Aprovado pelo usuário em conversa.

**Situação: implementado em 2026-09-23.** Os cinco passos da ordem de execução
foram concluídos e verificados (build, nove telas em 1300 e 900 px, console sem
erro). Ajustes posteriores pedidos pelo usuário (cartões de resumo com ícone,
barra de rolagem reservada) estão em `Memoria.md`.

## Objetivo

As nove telas revisadas em `stitch/saida-revisada/` passam a existir como React
em `src/`, no stack do projeto (Electron + Vite + React 19 + TypeScript +
Tailwind v4). Depois disso, nada do aplicativo depende de `stitch/`, que fica
só como referência histórica.

Fora do escopo: sincronizar dados entre telas, mudar o contrato
(`comum/contrato.ts`), criar telas que ainda não existem (detalhe da ficha,
ajuste de estoque etc.).

## Decisões

- **CSS por componente.** Cada componente e cada tela têm seu `.css` ao lado do
  `.tsx`. Os tokens ficam em `src/estilos/tokens/`, um arquivo por família,
  declarados em `@theme` do Tailwind v4, que os expõe como variáveis CSS
  (`--color-*`, `--text-*`, `--spacing-*`, `--radius-*`). Os `.css` usam só
  essas variáveis, nunca um valor de cor solto. Tailwind continua disponível
  para utilitários, sem ser o meio principal de estilo.
- **Dados de exemplo locais.** Cada tela tem `dados-exemplo.ts` com os dados do
  Stitch, mesmo incoerentes. O contrato não muda nesta etapa (regra 7 do
  `CLAUDE.md`); na etapa de dados, esses arquivos viram o mock oficial.
- **Ícones próprios.** Recortados em SVG do `recursos/.../icones/biblioteca/Icons.pdf`
  (vetorial), só os usados, com nome em português, servidos por `<Icone nome />`.
  Lucide apenas para peça que faltar. Licença do pacote a confirmar antes de
  distribuir.
- **Tudo local.** Inter por `@fontsource-variable/inter`; nenhum link externo.
- **Navegação.** `react-router` em modo hash (funciona em `file://` no Electron).
- **Moldura única.** Barra lateral, cabeçalho e rodapé da barra são um só
  componente usado por todas as telas, o que elimina as diferenças de tamanho
  entre telas vindas do Stitch.
- **Acertos da revisão preservados.** Selos pastel de largura única, "Criar
  ficha" no rodapé da barra, estoque com saldo em duas linhas, sem "sangria",
  sem boleto, sem coluna Tipo em Clientes.

## Estrutura

```
src/
  estilos/tokens/   cores · tipografia · espacos · raios · sombras
  estilos/base/     reset · fontes · elementos
  estilos/index.css (só importa)
  componentes/<nome>/Nome.tsx + nome.css
  telas/<tela>/Tela.tsx + tela.css + dados-exemplo.ts
  rotas.tsx
```

## Ordem de execução

1. Fundação: dependências, tokens, base, fonte.
2. Ícones recortados do PDF.
3. Moldura (barra lateral + cabeçalho) e rotas com as nove telas vazias.
4. Componentes compartilhados (botão, selo, campo, tabela, cartão, abas,
   paginação, aviso de ação sem destino).
5. Telas, uma de cada vez: Início, Clientes, Detalhe do cliente, Estoque,
   Registrar entrada, Cadastrar produto, Financeiro, Notas fiscais, Criar ficha.

Cada passo termina com `npm run build` passando e conferência no navegador.
