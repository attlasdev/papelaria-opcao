# papelaria-opcao

Aplicação de mesa (Electron) da Papelaria Opção. Em uso: o piloto 0.1, ligado
ao Supabase (a base inteira como um documento, com cópia no computador). A 1.0,
aprovada em `2026-10-21`, troca isso por banco local SQLite; o estado e os
próximos passos estão em `Memoria.md`.

Orientacao para agentes e organizacao do projeto: `AGENTS.md` e
`docs/organizacao.md`. Skills locais: `.agents/skills/`.

Referencia do framework e decisoes locais de seguranca: `docs/electron.md`.

Referencia visual de componentes: `recursos/design-system/README.md`.

```bash
npm install
npm run dev     # Vite na porta 5173 + Electron, com atualização automática do front
npm start       # build + Electron, ligado ao banco do conexao.json da máquina
npm run build   # typecheck + build. Tem que passar antes de PR
npm test        # testes da base local e dos cálculos
```

O instalador Windows não é gerado aqui: o GitHub Actions o monta a cada tag
`v*` e publica na Release. Instalar, configurar e publicar uma versão:
[docs/piloto.md](docs/piloto.md).

## Dois donos, uma fronteira

```
comum/contrato.ts   <- A FRONTEIRA. Escrita pelo back; mudanca em commit proprio
src/                <- interface (Victor) e camada de dados local (back)
  estilos/          tokens (cores, fonte, espaco, raio, sombra) e base
  componentes/      moldura, botao, selo, painel, tabela, filtros... (tsx + css)
  telas/            as telas, cada uma com tsx e css (sem dado próprio)
  mock/base/        base local única: tipos, semente, derivados, localStorage
  dados/            sincronia com o banco (0.1), planilhas, regras fiscais
stitch/             <- historico: prototipo HTML do Google Stitch, ja migrado
electron/           <- processo principal: janela, ponte, Supabase, maquininha, impressora
supabase/           <- migrations do piloto 0.1 (a base como um documento)
scripts/            <- ferramentas da Attlas (semente do piloto)
docs/               <- piloto, contrato, auditorias, historico
```

O tipo `Contrato` e implementado tres vezes — a ponte, o real e o mock — e o
compilador confere as tres. Operacao nova no contrato quebra o build dos lados que
ainda nao a implementaram.

Consequencia: a interface e montada inteira contra o mock, no navegador, **sem
credencial nenhuma**, e a mesma chamada fala com o mock ou com o banco. Na 1.0 as
telas passam a chamar `window.api` por operacao (ver `docs/contrato/mudancas.md`,
"Previstas para a 1.0").

## Leia antes de comecar

| Voce e... | Leia |
| --- | --- |
| quem monta a interface | `front-side.md` |
| quem monta o banco | `CLAUDE.md`, `revisao-de-contrato.md` |
| chegando agora | `Memoria.md` ("Onde estamos" e "PENDENTE", no topo) |
| planejando a 1.0 | `docs/auditorias/2026-10-21-checagem-1.0.md` e o PENDENTE de `Memoria.md` |
| mexendo na interface | `AGENTS.md`, secao "Interface: como esta montada" |

## Retomar a revisão com o Victor

Comece por [Memoria.md](Memoria.md). O [registro de 01/10/2026](docs/historico/2026-10-01-revisao-com-victor.md)
marca as tarefas feitas e o roteiro de retomada. **Financeiro e Caixa ainda não
validados pelo Victor**; Início e Clientes tiveram a revisão desta rodada encerrada.
Reutilize a janela do Electron aberta em desenvolvimento.
