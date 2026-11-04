# Suíte de testes

Como os testes estão organizados e o que ainda não tem teste. Decidido com o
Agostinho em `2026-10-27`.

## Como funciona

- **Uma suíte, `npm test`** (vitest, sem Electron). Roda no GitHub em **todo
  push** (`.github/workflows/testes.yml`) e de novo antes de cada versão
  (`release-win.yml`).
- **Testes de tela, `npm run test:tela`** (Playwright, desde `2026-11-03`): as
  telas no Chromium, sobre o mock com o atraso dele, o relógio parado em
  27/10/2026 às 15h e cada teste em 1280x650 (a altura útil do monitor da
  loja, `R-UI-09`) e 1920x1080. Sobe só o Vite, sem o Electron. Também rodam
  em todo push. Uma vez por máquina: `npx playwright install chromium`.
- **Regras têm número** (`R-ÁREA-NN`, em `Memoria.md`, "Regras de produto" e
  "Regras de interface"); item que não é regra começa com "Nota:". **Bugs têm número** (`A1`…`M11` da checagem,
  `B-NNN` depois; em [`bugs.md`](bugs.md)).
- **O teste cita o número no nome**, entre colchetes:
  `it('[R-VENDA-07] bloqueia a venda sem saldo…')`, `it('[B-003] …')`. Um
  teste pode citar mais de um; um número pode ter vários testes.
- **`testes/cobertura.test.ts` confere os outros:** todo número tem teste ou
  está na tabela abaixo, com o motivo. Quebra a suíte se aparecer número sem
  nenhum dos dois, se um item das regras não tiver número nem "Nota:", se um
  pendente já ganhou teste (sai da tabela) ou se um
  teste cita número que não existe.
- **Por grupo:** `npm run test:regras` (só `[R-…]`) e `npm run test:regressao`
  (só bugs).

## Regras de trabalho

1. **Regra nova** entra no `Memoria.md` com número, e com teste no mesmo commit;
   se ainda não der para testar, entra na tabela abaixo com o motivo.
2. **Bug corrigido** entra em `bugs.md` com um teste que **falhava antes da
   correção**: rodar sem a correção, ver falhar, corrigir, ver passar.
3. **Na 1.0**, a regra que sai da tela para o back ganha **teste de contrato**
   (mesmo cenário no mock e no SQLite) no percurso da tela dela; é o passo
   "regras" do ritual de cada tela.
4. Tirar um pendente da tabela é parte de terminar a tela correspondente.

## Onde está cada tipo de teste

| Pasta | O quê |
| --- | --- |
| `src/mock/` | regras e cálculos da 0.1 (store e derivados); dão lugar aos testes de contrato tela a tela |
| `src/dados/`, `src/leitor/` | integrações e formatos: Emitte, Financeiro, comprovante, fiscal, leitor |
| `electron/banco/` | banco da 1.0: o que o schema garante, migrations, semente e as fotos por versão (`fotos.test.ts`: cada migration roda sobre dados no formato antigo) |
| `testes/` | a cobertura e as regras de interface que dá para conferir lendo o código |
| `testes/regras/` | as regras puras de `comum/regras/`, que os dois lados do contrato usam |
| `testes/contrato/` | os testes de contrato da 1.0: cada cenário roda no mock e no SQLite (`testarContrato`), um arquivo por área |
| `testes/tela/` | os testes de tela (`*.tela.ts`, Playwright): o que só a tela mostra; contam na cobertura como os outros |

## Pendentes

Os motivos se repetem em quatro tipos:

- **tela:** só a tela mostra; o teste entra em `testes/tela/` (Playwright).
- **contrato:** a regra vai para o back; o teste de contrato entra no percurso
  da tela indicada.
- **aberto:** o bug ainda não foi corrigido; o teste entra com a correção.
- **0.1 / estrutural:** some com a 1.0; sai da tabela quando a 0.1 sair da loja.
- **revisão:** convenção de código ou de desenho, conferida na revisão; não
  automatizável sem falso alarme.

| Número | Tipo | Quando ganha teste |
| --- | --- | --- |
| R-VENDA-03 | contrato | tela 4.1 |
| R-UI-01 | revisão | — |
| R-UI-02 | revisão | — |
| R-UI-05 | revisão | — |
| R-UI-06 | revisão | — |
| R-UI-08 | revisão | — |
| A2 | 0.1 / estrutural | — |
| A3 | aberto | com a correção, antes da fase 3 do comprovante |
| A5 | 0.1 / estrutural | — |
| M2 | aberto | com a correção (teste de tela) |
| M3 | 0.1 / estrutural | — |
| M4 | 0.1 / estrutural | sai com os testes de contrato |
| M5 | aberto | depois da resposta do contador |
| M6 | contrato | tela 4.1 (troco e cartão do misto) |
| M7 | aberto | tela 5.1 (P5) |
| M8 | 0.1 / estrutural | — |
| M9 | aberto | antes de ligar a exportação de clientes |
| M10 | aberto | fase 3 do comprovante |
| M11 | aberto | enquanto o piloto usar o Supabase como banco |
