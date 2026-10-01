# Separar Financeiro e Caixa — plano de transição

> **Situação: implementado, validação de uso com o Victor pendente.** Decisão em 01/10/2026:
> duas seções independentes no menu lateral, sem prévia do Caixa no Financeiro.
> A exportação do período fica para outra etapa.

## Ajuste pontual da nova ficha solicitado na revisão

Na venda sem identificação, “Notinha” continua indisponível porque não há
cliente a quem cobrar. A mensagem “só com cliente identificado” estava dentro
do botão de largura restrita e ultrapassava o painel de Valores. **Ajuste
feito:** o botão mantém somente ícone e rótulo, e a orientação aparece abaixo
das formas de pagamento, no espaço do próprio painel. Conferido com cliente
identificado e sem identificação nas larguras de 1300 e 900 px. Esse ajuste é
independente da separação Financeiro/Caixa, que continua planejada.

## Objetivo e leitura da tela atual

O Financeiro mistura dois trabalhos: consultar receitas/despesas para acompanhar
o negócio e conferir as notas e moedas da gaveta. No print da prévia a 1300 px,
a ordem é: período financeiro → três cartões → Caixa atual e fechamentos →
entradas/saídas financeiras → movimentações financeiras. Para chegar à tabela,
a pessoa atravessa todo o bloco do caixa.

A separação precisa alcançar também os dados mostrados. Hoje
`movimentosFinanceiro(base)` reúne pagamentos, lançamentos manuais e transferências
físicas da gaveta. Os cartões excluem as categorias físicas de seus totais, mas
as linhas e a contagem de “Todos os meios” ainda as incluem. O estorno de uma
transferência física usa a categoria genérica “Estorno”; classificá-lo exige
consultar o lançamento original, não apenas a categoria da linha.

## Resultado desejado

```text
Menu lateral                 Financeiro                     Caixa
Início                       Consultar período              Caixa atual
Clientes                     Três cartões                  Abrir / adicionar / retirar / fechar
Financeiro                   Entradas e despesas           Fechamentos recentes
Caixa                        Movimentações financeiras     Consultar histórico
Estoque
Notas fiscais
```

- **Financeiro** reúne vendas pagas, recebimentos de notinhas, entradas e
  despesas manuais e seus estornos. Mantém o filtro De/Até, os atalhos, os três
  cartões, a comparação e a tabela de 15 linhas por página. “Registrar movimento”
  continua aqui. O botão de exportação permanece no estado atual.
- **Caixa** reúne a situação do turno, abertura, adição e retirada de dinheiro,
  fechamento com conferência, fechamentos recentes e histórico por datas. Não
  recebe filtro Dia/Semana/Mês/Ano do Financeiro.
- Uma venda ou despesa em **dinheiro** aparece no Financeiro como fato econômico
  e no detalhe do turno do Caixa como movimento da gaveta. É o mesmo registro,
  lido sob duas perspectivas; não se cria cópia nem lançamento adicional.
- Adição e retirada física de dinheiro, com seus estornos, ficam consultáveis
  no Caixa. Não entram na tabela nem na contagem do Financeiro. Os totais
  financeiros já as excluem e devem continuar batendo com a lista exibida.

## Mapa da implementação

| Área | Alteração executada |
| --- | --- |
| `src/rotas-caminhos.ts`, `src/rotas.tsx` | Criar `rotas.caixa` e rota `/caixa`, irmã de `/financeiro`. Preservar `/financeiro/movimento/novo`. |
| `src/componentes/layout/barra-lateral/BarraLateral.tsx` | Inserir “Caixa” após “Financeiro”, com o ícone `dinheiro` já extraído do acervo. Conferir seleção nas rotas e na barra compacta. |
| `src/telas/caixa/` | Criar `Caixa.tsx` com a moldura `<Tela>` e mover para esta pasta `CaixaAtual`, `ConferenciaCaixa`, `MovimentarDinheiro`, `FechamentosRecentes`, `HistoricoCaixa` e seus três CSS. Ajustar apenas imports relativos e a composição necessária para a nova página. |
| `src/telas/financeiro/Financeiro.tsx` e `financeiro.css` | Retirar `CaixaAtual`, a linha “Retiradas físicas do caixa” da comparação e as notas de cartão/rodapé que descrevem a gaveta. Manter a consulta financeira já implementada. |
| `src/mock/base/derivados.ts` | Centralizar a classificação “financeiro ou transferência física” em função pura, incluindo estorno pelo `estornoDe`. Usá-la na tabela e nas contagens, mantendo resumo e registros coerentes. Preservar `resumoDoDia` e os dados da base. |
| `src/telas/registrar-movimento/RegistrarMovimento.tsx` | Trocar a orientação “use o Caixa atual” por referência clara à seção “Caixa”. Entrada avulsa e despesa permanecem nesse formulário. |
| `AGENTS.md`, `Memoria.md` | Atualizar o mapa de pastas e registrar a nova organização quando o código estiver concluído. Manter a validação de uso de Financeiro e Caixa como pendente até o Victor percorrer as duas telas. |

`ProvedorAbrirFicha` envolve toda a moldura em `Moldura.tsx`, então “Ver ficha”
no detalhe de um turno continua funcionando depois da mudança de rota.
As ações do caixa já ficam em `src/mock/estado-demonstracao.ts` e os fatos na
base única; a mudança de tela não requer migrar ou duplicar estado.

## Ordem de execução

1. Registrar a situação inicial com `npm test` e `npm run build`. Usar prévia
   isolada para ensaiar ações, preservando os dados locais do operador.
2. Criar rota e menu de Caixa; montar a página com `CaixaAtual` e mover seus
   componentes/CSS como um conjunto. Conferir primeiro que todos os modais e o
   histórico continuam funcionando sem mudança de regra.
3. Limpar o Financeiro: retirar o bloco e as referências visuais ao caixa;
   filtrar as transferências físicas e seus estornos na camada de derivados.
   Garantir que contagens dos meios somem exatamente as linhas da tabela antes
   da paginação e que os cartões usem o mesmo conjunto financeiro.
4. Revisar os registros antigos da semente chamados “Troco” e “Saída de caixa”.
   Eles precedem as categorias atuais; o código da semente confirma que ambos
   representam movimentos físicos. Classificá-los para consulta no Caixa sem
   alterar categoria, valor, sinal ou data dos registros persistidos.
5. Ajustar textos locais e documentação. Não aproveitar a transição para
   redesenhar cartões, tabela, modal, calendário, cores ou animações já usados.
6. Rodar testes e build; conferir as duas telas no navegador e no Electron.

## Verificação de conclusão

- Menu com “Financeiro” e “Caixa” independentes, inclusive recolhido; acesso
  direto a `#/caixa` funciona no Electron e não altera a seleção de Financeiro.
- Financeiro apresenta período → cartões → comparação → movimentações, sem
  bloco de turno nem transferências físicas na tabela. Pix, cartão e dinheiro
  de vendas/recebimentos continuam na consulta por um dia antigo e por intervalo.
- Caixa apresenta estado aberto/fechado, valor esperado, abertura, adição,
  retirada, fechamento com diferença e motivo, fechamentos recentes e histórico
  De/Até; “Ver” abre detalhes e fichas e retorna ao mesmo histórico.
- Despesa em dinheiro afeta Financeiro e o turno aberto; reforço de troco e
  retirada física afetam somente o esperado da gaveta. Estornos preservam os
  registros originais e aparecem na consulta apropriada.
- Testes de derivados cobrem classificação de transferência e de seu estorno,
  contagens do filtro e total financeiro. `npm test` e `npm run build` passam.
- Em 1300 e 900 px, sem transbordamento horizontal do documento, quebra de
  rótulos ou erro no console. Exercitar caixa aberto e fechado, menu compacto,
  modal sobre ficha, filtro de datas e paginação.

## Pontos de atenção

- Os itens “Troco” e “Saída de caixa” da semente antiga têm valores e sinais
  preservados, inclusive o “Troco” negativo; o histórico os identifica como
  registros antigos sem turno vinculado. Nenhuma migração foi feita.
- `movimentosFinanceiro()` serve também ao resumo do Início e ao detalhe do
  turno. Filtrar somente a apresentação do Financeiro ou criar uma derivação
  explícita, sem mudar a fonte compartilhada de pagamentos.
- Esta mudança organiza a experiência, mas não encerra a validação funcional
  do Financeiro e do Caixa pelo Victor. A exportação segue fora deste plano.

## Verificação da execução

- `npm test`: 75 testes passaram, incluindo separação de transferências físicas,
  estorno em outro dia, categorias antigas e contagens coerentes com a lista.
- `npm run build`: concluído.
- Prévia em 1300 e 900 px: navegação independente, Caixa fechado, histórico,
  detalhe de turno, formulário de abertura e Financeiro conferidos. Nenhum
  transbordamento horizontal do documento nem erro no console.
- Janela Electron em execução: as duas seções abriram pelo menu lateral, com
  a situação do Caixa e a consulta do Financeiro visíveis sem bloco misturado.
  A validação de uso com o Victor continua pendente.
