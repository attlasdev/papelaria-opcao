# Suíte de testes

Como os testes estão organizados e o que ainda não tem teste. Decidido com o
Agostinho em `2026-10-27`.

## Como funciona

- **Uma suíte, `npm test`** (vitest, sem Electron). Roda no GitHub em **todo
  push** (`.github/workflows/testes.yml`) e de novo antes de cada versão
  (`release-win.yml`).
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
| `src/dados/`, `src/leitor/` | integrações e formatos: Emitte, comprovante, fiscal, sincronia, leitor |
| `electron/banco/` | banco da 1.0: o que o schema garante, migrations, semente e as fotos por versão (`fotos.test.ts`: cada migration roda sobre dados no formato antigo) |
| `testes/` | a cobertura e as regras de interface que dá para conferir lendo o código |
| `testes/contrato/` | os testes de contrato da 1.0: cada cenário roda no mock e no SQLite (`testarContrato`), um arquivo por área |

## Pendentes

Os motivos se repetem em quatro tipos:

- **tela:** só a tela mostra; teste de tela (Playwright) na Fase 3 do plano da
  1.0.
- **contrato:** a regra vai para o back; o teste de contrato entra no percurso
  da tela indicada.
- **aberto:** o bug ainda não foi corrigido; o teste entra com a correção.
- **0.1 / estrutural:** some com a 1.0; sai da tabela quando a 0.1 sair da loja.
- **revisão:** convenção de código ou de desenho, conferida na revisão; não
  automatizável sem falso alarme.

| Número | Tipo | Quando ganha teste |
| --- | --- | --- |
| R-VENDA-01 | tela | Fase 3 |
| R-VENDA-02 | contrato | tela 4.1 (busca do cliente na ficha, venda sem identificação) |
| R-VENDA-03 | contrato | tela 4.1 |
| R-VENDA-05 | contrato | tela 4.1 (rascunho no banco) |
| R-VENDA-06 | contrato | tela 4.1 (cada bloqueio vira recusa do back) |
| R-VENDA-08 | tela | tela 2.1 / Fase 3 |
| R-NOTINHA-04 | tela | Fase 3 |
| R-CORRECAO-05 | contrato | tela 2.5 (ajuste) |
| R-FICHA-01 | tela | Fase 3 |
| R-CLIENTE-07 | contrato | tela 5.3 |
| R-CLIENTE-08 | tela | Fase 3 |
| R-BOLETO-04 | contrato | tela 6.1 |
| R-BOLETO-06 | contrato | tela 6.1 (filtros e busca; excluir vira evento, D7) |
| R-ESTOQUE-03 | contrato | tela 2.3 e 2.4 |
| R-ESTOQUE-05 | contrato | tela 2.1 |
| R-FINANCEIRO-01 | tela | Fase 3 |
| R-FINANCEIRO-03 | contrato | tela 7.2 |
| R-CAIXA-03 | contrato | tela 7.1 (esperado calculado pelo back) |
| R-CAIXA-05 | contrato | tela 7.1 |
| R-CAIXA-09 | contrato | tela 1 (operador por id) |
| R-PAGAMENTO-01 | tela | Fase 3 |
| R-INICIO-02 | tela | Fase 3 |
| R-INICIO-03 | tela | Fase 3 |
| R-INICIO-04 | contrato | tela 8.1 |
| R-UI-01 | revisão | — |
| R-UI-02 | revisão | — |
| R-UI-05 | revisão | — |
| R-UI-06 | revisão | — |
| R-UI-08 | revisão | — |
| R-UI-09 | tela | Fase 3 (1280x720 e 1920x1080) |
| A1 | tela | tela 2.4 (entrega numa operação) e Fase 3 |
| A2 | 0.1 / estrutural | — |
| A3 | aberto | com a correção, antes da fase 3 do comprovante |
| A5 | 0.1 / estrutural | — |
| A6 | contrato | fundação, item 8 (instância única, log, quedas) |
| M1 | tela | Fase 3 (o campo saiu) |
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
| B-001 | tela | Fase 3 |
| B-002 | tela | Fase 3 |
