# Inventário do contrato — o que cada tela lê e grava

Levantado em `2026-10-01` a partir do código (commit `fe08494`). É o ponto de
partida para escrever `comum/contrato.ts`: mostra o que as telas usam hoje da
base local (`src/mock/estado-demonstracao.ts`) e em que operação isso vira.
O que entrou depois (serviços, login e sincronia do piloto, arquivos, maquininha
e comprovante) foi acrescentado em `2026-10-21` (commit `000cb47`), no fim de
"Por área".

Os nomes de operação abaixo são **propostas**: o nome definitivo é o que entrar
no contrato. Quem decide é o back (ver `Memoria.md`, decisão de `2026-10-01`).

**"Banco", neste documento, é o SQLite local** aberto pelo processo principal
(decisão de `2026-10-05` em `Memoria.md`). Há uma máquina só, então as regras
abaixo ("restrição no banco", "nasce no banco") são garantidas ali, numa
transação; a nuvem guarda só a cópia do arquivo.

---

## Como a tela fala com os dados hoje

- **Leitura:** toda tela chama `useEstadoDemonstracao()` e recebe a **base
  inteira** (clientes, produtos, fichas, movimentos), calculando o que precisa com
  `derivados.ts`. Com banco isso não se sustenta: cada tela passa a pedir só o que
  mostra, com filtro e limite, e o cálculo (situação da notinha, totais, resumo do
  dia) passa a vir pronto do back.
- **Escrita:** 22 funções em `estado-demonstracao.ts`, síncronas, que devolvem
  `null`/`false`/`[]` quando recusam, sem dizer o motivo. No contrato viram
  operações `async` com `Resultado<T>` e causa de falha.
- **Regras:** todas as validações (saldo, documento repetido, um caixa aberto, soma
  do pagamento misto) estão só no front. No back elas passam a valer **no banco**;
  a tela continua validando para responder rápido, mas deixa de ser a autoridade.

---

## Por área

Ordem de migração proposta: Clientes → Estoque → Ficha/Notinha →
Financeiro/Caixa → Início, sino, busca e notas.

### Clientes

| Tela | Lê | Grava |
| --- | --- | --- |
| `clientes/Clientes` | lista de clientes com resumo (total, notinhas, situação) e as 3 compras recentes | — |
| `detalhe-cliente/DetalheCliente` | cliente, resumo, histórico de fichas | — |
| `detalhe-cliente/receber/ReceberNotinhas` | notinhas abertas do cliente | `receberNotinhas` |
| `formulario-cliente/JanelaCliente` | lista de clientes (só para checar documento repetido) | `cadastrarCliente`, `editarCliente` |
| `vendas-sem-identificacao/VendasSemIdentificacao` | fichas sem cliente | — |

Operações propostas: `listarClientes(filtro)`, `obterCliente(id)` (cadastro +
resumo + histórico paginado), `listarNotinhasAbertas(clienteId)`,
`cadastrarCliente`, `editarCliente`, `receberNotinhas`, `listarVendasSemIdentificacao(periodo, meio)`.

Para o back: documento repetido vira restrição única nos **dígitos** do documento;
a tela deixa de baixar todos os clientes só para conferir isso. `receberNotinhas`
já é uma escrita só (abate da mais antiga para a mais nova) — vira uma função do
banco.

### Estoque

| Tela | Lê | Grava |
| --- | --- | --- |
| `estoque/Estoque` | página de produtos, resumo dos cartões, categorias — **`listarProdutos`, no contrato desde `2026-10-29` (tela 2.2)** | `ativarProduto` (reativar) |
| `cadastrar-produto/CadastrarProduto` | produto (com `temHistorico`), categorias, bipe | `cadastrarProduto`, `editarProduto`, `excluirProduto`, `ativarProduto` — **no contrato desde `2026-10-28` (tela 2.1)** |
| `ajustar-estoque/AjustarEstoque` | produtos ativos e completos | `alterarSaldo` (ajuste) |
| `entrada-rapida/EntradaRapida` | produto (`obterProduto`) | `registrarEntrada` com um item — **no contrato desde `2026-10-29` (tela 2.3)** |
| `registrar-entrada/RegistrarEntrada` | produtos | `cadastrarProduto` + `alterarSaldo`, **um par por item, em laço** |
| `movimentacoes-estoque/MovimentacoesEstoque` | todos os movimentos de estoque | — |

Já no contrato (tela 2.1): `obterProduto`, `buscarProdutoPorCodigoBarras`,
`listarCategorias`, `cadastrarProduto`, `editarProduto`, `excluirProduto`,
`ativarProduto`. O cadastro rápido saiu (`completarProduto` não existe mais).
Na tela 2.2: `listarProdutos(filtro, busca, pagina, porPagina)`.
Na tela 2.3: `registrarEntrada(entrega, quem)`.
Faltam: `ajustarEstoque(codigo, contagem, motivo)`, `listarMovimentosEstoque(filtro, pagina)`.

Para o back:
- **`registrarEntrada` precisa ser UMA operação para a entrega inteira.** Hoje a
  tela chama cadastrar + alterar saldo item a item: se o terceiro falhar, os dois
  primeiros já entraram.
- **Entrada manda quantidade a somar, não o saldo final.** Hoje a tela calcula
  `saldo + quantidade` e manda o resultado; com duas máquinas, uma venda no meio
  some. Ajuste continua mandando a contagem (é o que ele é).
- Código do produto (`EST-0031`) nasce no banco ao salvar (`R-ESTOQUE-08`);
  a tela não mostra mais a previsão — ver `mudancas.md`.

### Ficha e Notinha

| Tela | Lê | Grava |
| --- | --- | --- |
| `criar-ficha/CriarFicha` | base inteira, rascunho, **próximo número de ficha** | `concluirFicha`, depois `prepararRascunho` (nota); `salvarRascunhoFicha` a cada mudança |
| `criar-ficha/cliente/ClienteFicha` | clientes + resumo (busca e aviso de quem deve) | — |
| `criar-ficha/itens/ItensFicha` | produtos (bipe e busca) | — |
| `detalhe-ficha/*` | ficha, notinha, outras notinhas do cliente | `cancelarFicha`, `estornarPagamento`, `anotarFicha` |

Operações propostas: `concluirFicha(dados)` (com a opção "preparar nota" dentro
dela), `obterFicha(id)`, `cancelarFicha`, `estornarRecebimento`, `anotarFicha`.

Para o back:
- **`concluirFicha` + `prepararRascunho` viram uma só.** Hoje são duas chamadas;
  se a segunda falha, a venda existe sem o rascunho de nota pedido.
- **O back recalcula o total.** Hoje a tela manda `total` e `preco` de cada item;
  o banco passa a usar o preço do cadastro e conferir o total, senão a tela
  decide quanto custa a venda.
- Número da ficha nasce no banco (sequência), não em "maior + 1".
- Venda sem saldo já é recusada; no banco a baixa e a conferência acontecem na
  mesma transação, para duas vendas simultâneas não passarem as duas.

### Financeiro e Caixa

| Tela | Lê | Grava |
| --- | --- | --- |
| `financeiro/Financeiro` | **todos** os movimentos financeiros, filtrados na tela por intervalo | `estornarMovimentoCaixa` |
| `registrar-movimento/RegistrarMovimento` | — | `registrarMovimentoCaixa` |
| `caixa/CaixaAtual`, `ConferenciaCaixa` | turno aberto e resumo | `abrirTurnoCaixa`, `fecharTurnoCaixa` |
| `caixa/MovimentarDinheiro` | — | `movimentarDinheiroCaixa` |
| `caixa/FechamentosRecentes`, `HistoricoCaixa` | turnos e movimentos físicos do período | — |

Operações propostas: `consultarFinanceiro(de, ate, meio)` (resumo + linhas
paginadas), `registrarLancamento`, `estornarLancamento`, `obterCaixaAtual`,
`abrirCaixa`, `fecharCaixa`, `movimentarGaveta`, `listarCaixas(de, ate)`,
`obterCaixa(id)`.

Para o back: "um caixa aberto por vez" vira restrição no banco. O esperado no
fechamento é calculado pelo back, não pela tela. Esta área ainda está em
validação com o Victor: migrar por último, porque a regra pode mudar.

### Início, sino, busca, notas fiscais, barra lateral

| Tela | Lê | Grava |
| --- | --- | --- |
| `inicio/Inicio` | resumo do dia, fichas do dia filtradas | — |
| `layout/tela/Tela` (sino) | notificações calculadas da base | `marcarAvisosLidos` |
| `resultados-busca/ResultadosBusca` | busca em clientes, fichas e produtos | — |
| `notas-fiscais/*`, `detalhe-fiscal` | rascunhos de nota, fichas | — |
| `layout/barra-lateral/BarraLateral` | operador | `restaurarDemonstracao` |

Operações propostas: `resumoDoDia(dia)`, `listarFichas(filtro, pagina)`,
`listarAvisos`, `marcarAvisosLidos`, `buscar(termo)`, `listarRascunhosNota`.

`restaurarDemonstracao` **não entra no contrato**: é ferramenta da base local.
Com banco, restaurar dados é seed do ambiente de teste, nunca botão no app.

### Acréscimos depois do levantamento (`2026-10-21`, commit `000cb47`)

| Tela ou peça | Lê | Grava / chama |
| --- | --- | --- |
| `servicos/Servicos` | serviços feitos e perdas do período (das fichas) | — |
| `criar-ficha/servicos/*` | — | serviços entram na ficha (`ServicoVenda`) e são gravados por `concluirFicha` |
| `criar-ficha/cobranca/JanelaCobranca` | — | `iniciarCobranca`, `consultarCobranca`, `cancelarCobranca`, `simularCobranca` (já no contrato) |
| `entrar/Entrar` e `src/dados/sincronia.ts` | sessão e a base inteira | `sessaoAtual`, `entrar`, `carregarBase`, `salvarBase` (já no contrato; do piloto) |
| `estoque/ExportarEmitte`, `clientes/ExportarClientesEmitte`, `financeiro/ExportarPeriodo` | produtos, clientes, movimentos do período | `salvarArquivo` (já no contrato); `marcarEnviadosEmitte` (base local). **As duas da Emitte estão desligadas desde `2026-10-29`** (comentadas); só o `ExportarPeriodo` segue em uso |
| comprovante (ainda sem tela) | — | `imprimirComprovante` (já no contrato) |
| `boletos/Boletos`, `boletos/JanelaBoleto` (`2026-10-23`) | boletos da loja; avisos de vencimento no sino | `cadastrarBoleto`, `editarBoleto`, `marcarBoletoPago`, `excluirBoleto` (base local; no piloto vão no documento) |

Para o back:
- **Serviços fazem parte da ficha:** `concluirFicha` recebe e confere os
  serviços (nome, valor, perdas) junto com os itens. Histórico de serviços e
  perdas são leituras por período; nada mexe no estoque.
- **Login e documento único são do piloto.** `carregarBase` e `salvarBase` saem
  na 1.0; o login fica, porque o backup no Supabase usa a chave pública com
  login (decisão de `2026-10-05`).
- **Exportações** continuam gerando o arquivo na tela e salvando por
  `salvarArquivo`; `marcarEnviadosEmitte` vira operação.
- **Cobrança na maquininha:** guardar a cobrança antes de mandá-la, consultar
  com nova tentativa, nunca abrir outra sem resolver a anterior, reconciliar
  pela referência ao abrir o app e registrar a venda de forma idempotente pelo
  id da cobrança (checagem `2026-10-21`, A4).
- **O pagamento guarda o troco e, no misto, a maquininha e a modalidade do
  cartão** (checagem `2026-10-21`, M6).
- **Boletos da loja (`2026-10-23`):** na 1.0, tabela própria e as operações
  `listarBoletos`, `cadastrarBoleto`, `editarBoleto`, `marcarBoletoPago` e
  `excluirBoleto`. `cadastradoEm` nasce no back (instante UTC), nunca vem da
  tela; `marcarBoletoPago` grava dia e operador e vai receber a confirmação do
  operador em desenho à parte. Nenhuma delas toca o Financeiro.

---

## Problemas que atravessam todas as áreas

1. **Data e hora.** Os dados guardam `data` (`AAAA-MM-DD`) e `horario` (`HH:MM`)
   locais separados; algumas partes usam ISO completo (`abertoEm`, `registradoEm`).
   O contrato usa um instante ISO 8601 em UTC; o dia de referência é o de São
   Paulo, calculado pelo back. Data informada pelo usuário (vencimento, dia do
   recebimento, data da entrega) continua como data simples.
2. **"Hoje" vem do relógio da máquina.** A tela usa `hojeISO()` para decidir o que
   está vencido e para datar o que grava. Com banco, quem grava a data é o back;
   a tela só manda a data quando o usuário a escolheu.
3. **Operador** era um nome fixo na base. Desde `2026-10-28`: pessoa com PIN, escolhida em cada gesto (`R-OPERADOR-*`); contrato da tela 1 em `comum/contrato.ts`.
4. **Ids gerados na tela** (`CLI-`, `EST-`, número da ficha, id de movimento a
   partir da hora). Passam a nascer no processo principal: um id interno único
   (UUID) em todo registro, e o número para exibir (`#1131`, `CLI-0104`,
   `EST-0021`) como sequência do banco local.
5. **Rascunho da ficha e avisos lidos** ficam no banco local, como o resto: com
   uma máquina só, "na máquina" e "no banco" são o mesmo lugar.

---

## Nomes decididos

| Hoje | No contrato | Por quê |
| --- | --- | --- |
| `MovimentoCaixa` (despesa, entrada manual **e** adição/retirada da gaveta) | `Lancamento` (Financeiro) e `MovimentoGaveta` (Caixa) | depois da separação das telas, um tipo só misturava o que é dinheiro do negócio e o que é dinheiro mudando de lugar |
| `TurnoCaixa`, `abrirTurnoCaixa`, `fecharTurnoCaixa` | `Caixa`, `abrirCaixa`, `fecharCaixa` | a tela sempre diz "caixa" |
| `fundoInicial` | `dinheiroAbertura` | é o que a tela mostra ("Dinheiro na abertura") |
| `cancelamento?: Estorno` | `cancelamento?: Correcao` e `estorno?: Correcao` | cancelar e estornar são gestos diferentes na tela; o formato (quando, motivo, operador) é o mesmo |
| `alterarSaldo(tipo: 'Entrada' \| 'Ajuste')` | `registrarEntrada` e `ajustarEstoque` | uma soma quantidade, a outra registra contagem; regras diferentes |
| `inativo?: true`, `cadastroRapido?: true` | `ativo: boolean`, `aCompletar: boolean` | como a tela chama ("Desativados", "A completar"); booleano explícito em vez de campo ausente |
| `estornarPagamento` | `estornarRecebimento` | só vale para recebimento de notinha |
| `Produto.grupo` | **sai** | é derivado da categoria na hora de gravar e nenhuma tela lê |
| `Cliente.descricao` | **em aberto** | o usuário nunca digita: o cadastro grava "Cadastro novo" e a semente traz "Cliente frequente". Ou vira classificação calculada pelo back, ou sai |
| `Ficha`, `Notinha`, `Cliente`, `Produto`, `Meio`, `FormaVenda` | iguais | já são o vocabulário da loja |
