# papelaria-opcao

Aplicacao de mesa (Electron) em estágio inicial, com interface e base local de
demonstração. A integração com banco online ainda está pendente.

Orientacao para agentes e organizacao do projeto: `AGENTS.md` e
`docs/organizacao.md`. Skills locais: `.agents/skills/`.

Referencia do framework e decisoes locais de seguranca: `docs/electron.md`.

Referencia visual de componentes: `recursos/design-system/README.md`.

```bash
npm install
npm run dev     # Vite na porta 5173 + Electron, com atualização automática do front
npm start       # build + Electron; ainda usa a base local, sem banco integrado
npm run build   # typecheck + build. Tem que passar antes de PR
npm test        # testes da base local e dos cálculos
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

## Retomar a revisão com o Victor

Comece por [Memoria.md](Memoria.md). O [registro de 01/10/2026](docs/historico/2026-10-01-revisao-com-victor.md)
marca as tarefas feitas e o roteiro de retomada. **Financeiro e Caixa ainda não
validados pelo Victor**; Início e Clientes tiveram a revisão desta rodada encerrada.
Reutilize a janela do Electron aberta em desenvolvimento.
