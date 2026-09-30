# papelaria-opcao

Aplicacao de mesa (Electron) que fala com um banco online.

Orientacao para agentes e organizacao do projeto: `AGENTS.md` e
`docs/organizacao.md`. Skills locais: `.agents/skills/`.

Referencia do framework e decisoes locais de seguranca: `docs/electron.md`.

Referencia visual de componentes: `recursos/design-system/README.md`.

```bash
npm install
npm run dev     # interface no navegador, contra o mock. Sem Electron, sem banco
npm start       # o aplicativo de verdade
npm run build   # typecheck + build. Tem que passar antes de PR
```

## Dois donos, uma fronteira

```
comum/contrato.ts   <- A FRONTEIRA. PR proprio, os dois aprovam
src/                <- interface: React, telas, componentes, tokens, mock
  estilos/          tokens (cores, fonte, espaco, raio, sombra) e base
  componentes/      moldura, botao, selo, painel, tabela, filtros... (tsx + css)
  telas/            as telas, cada uma com tsx e css (sem dado próprio)
  mock/base/        base local única: tipos, semente, derivados, localStorage
stitch/             <- historico: prototipo HTML do Google Stitch, ja migrado
electron/           <- processo principal: janela, ponte, banco
supabase/           <- schema e migrations (ainda nao existe)
```

O tipo `Contrato` e implementado tres vezes — a ponte, o real e o mock — e o
compilador confere as tres. Operacao nova no contrato quebra o build dos lados que
ainda nao a implementaram.

Consequencia: a interface e montada inteira contra o mock, no navegador, **sem
credencial nenhuma**; quando o lado real entra, nada em `src/` muda.

## Leia antes de comecar

| Voce e... | Leia |
| --- | --- |
| quem monta a interface | `front-side.md` |
| quem monta o banco | `CLAUDE.md`, `revisao-de-contrato.md` |
| chegando agora | `Memoria.md` ("Onde estamos" e "PENDENTE", no topo) |
| mexendo na interface | `AGENTS.md`, secao "Interface: como esta montada" |
