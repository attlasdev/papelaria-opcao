# Schema da 1.0

**Estado:** revisado em `2026-10-27` (P1–P6 decididos, no fim) e escrito como a
primeira migration: `electron/banco/migracoes/0001-inicial.sql`, com os testes
em `electron/banco/banco.test.ts`. Mudança no schema daqui em diante é uma
migration nova, e este documento acompanha.

Fontes: tipos da 0.1 (`src/mock/base/tipos.ts`), regras e cálculos
(`src/mock/estado-demonstracao.ts`, `src/mock/base/derivados.ts`), o que cada
tela lê e grava (`docs/contrato/inventario.md`) e as decisões do plano
(`docs/superpowers/plans/2026-10-23-versao-1.0.md`).

O banco é o **SQLite local** da máquina da loja, aberto só pelo processo
principal. Uma máquina, um escritor: as restrições abaixo valem dentro de uma
transação, sem disputa entre máquinas.

---

## Princípios

1. **Cadastro se edita; fato só se insere.** Produto, cliente, operador e
   boleto (os dados dele) são cadastros: editáveis. Venda, pagamento, movimento
   de estoque, lançamento, caixa e qualquer correção são fatos: nunca recebem
   `update` nem `delete`. Corrigir um fato é inserir outro (cancelamento,
   estorno, ajuste). É o "corrigir sem apagar" da 0.1, agora garantido pelo
   banco e não pela tela.
2. **Dois identificadores.** Todo registro tem `id` (UUID, texto), que nunca
   aparece na tela, e os que a loja vê ganham um **número de exibição** por
   sequência (`#1131`, `CLI-0104`, `EST-0021`, `BOL-0001`). O número nasce no
   banco, na mesma transação, nunca na tela.
3. **Tempo.** Todo fato guarda `registrado_em`: instante ISO 8601 em UTC, do
   relógio do processo principal. Quando a regra depende do **dia** (vendas do
   dia, vencimento, fechamento), o fato guarda também `dia` (`AAAA-MM-DD`) no
   fuso de **São Paulo**, calculado pelo back no momento de gravar. Data que a
   pessoa escolhe (vencimento, dia do recebimento, data da entrega) é só `dia`.
   Acaba com os dois relógios da 0.1 (checagem, baixa).
4. **Quem fez.** Todo fato guarda `operador_id`; toda correção guarda também
   `autorizado_por_id`, vazio até existir o PIN (decisões de `2026-10-23`).
5. **Dinheiro em centavos, inteiro.** Valor negativo só onde o sinal tem
   sentido (lançamento), e a coluna diz isso.
6. **O que se calcula não se guarda**, salvo **retrato** de um fato que não
   pode mudar depois (preço da venda, total da ficha, esperado no fechamento):
   se a regra mudar, o fato antigo continua contando o que aconteceu.
7. **Nomes** em português, sem acento, `snake_case` (regra do projeto). Valores
   fechados (`tipo`, `meio`, `situacao`) com `check` no banco.

---

## Tabelas

Legenda: **PK** chave primária · **FK** chave estrangeira · **único** restrição
de unicidade · *opcional* aceita vazio (`null`).

### Operador e máquina

**`operador`** — quem usa o balcão (cadastro).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK, UUID |
| `nome` | texto | único (sem diferenciar maiúscula) |
| `ativo` | inteiro 0/1 | desativado some do seletor; o histórico continua citando |
| `pin_hash` | texto | *opcional*; vazio até ligar o PIN (sem migration para ligar) |
| `criado_em` | texto | instante UTC |

**`preferencia`** — estado da máquina que não é fato: operador atual, rascunho
da ficha, avisos lidos.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `chave` | texto | PK (`operador_atual`, `rascunho_ficha`, `avisos_lidos`) |
| `valor` | texto | JSON |

O rascunho da ficha e os avisos lidos são estado de tela, guardados como JSON
de propósito: não há consulta sobre eles, e o formato muda junto com a tela sem
migration.

**`sequencia`** — o próximo número de exibição de cada série.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `serie` | texto | PK: `ficha`, `cliente`, `produto`, `boleto` |
| `ultimo` | inteiro | lido e incrementado na transação que cria o registro |

### Estoque

**`produto`** (cadastro)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `numero` | inteiro | único; exibido `EST-0021` |
| `codigo_barras` | texto | *opcional*; único quando preenchido |
| `descricao` | texto | |
| `categoria` | texto | texto livre; a tela já evita duplicar por maiúscula/acento |
| `unidade` | texto | `un`, `pct`, `cx` |
| `preco` | inteiro | centavos; o preço **atual** (a venda guarda o dela) |
| `custo` | inteiro | *opcional*; centavos; custo de referência do cadastro |
| `saldo` | inteiro | ≥ 0; ver "Saldo guardado" abaixo |
| `minimo` | inteiro | ≥ 0 |
| `marca`, `caracteristicas`, `descricao_adicional`, `localizacao` | texto | *opcionais* |
| `embalagem`, `pacotes_por_caixa`, `unidades_por_pacote` | texto/inteiro | *opcionais*; "como vem do fornecedor", só informativo |
| `ncm` | texto | *opcional*; 8 dígitos; só anotação |
| `cest` | texto | *opcional*; 7 dígitos; só anotação |
| `ativo` | inteiro 0/1 | desativado: some da venda, entrada, ajuste e avisos |
| `emitte_enviado_em` | texto | *opcional*; instante; "vai uma vez" para a Emitte |
| `criado_em` | texto | instante UTC |

Sai da 0.1: `grupo` (derivado, ninguém lê) e o bloco `fiscal` (tributação,
origem, CFOP): o padrão fiscal é aplicado só ao gerar a planilha da Emitte.

**Saldo guardado, mantido pelo banco** (P4, `2026-10-27`). O código **nunca**
escreve `produto.saldo`: só insere `movimento_estoque`. Três gatilhos fecham o
laço:

1. *antes de inserir o movimento:* recusa se `saldo_antes` não for o `saldo`
   atual do produto (e um `check` recusa `saldo_depois ≠ saldo_antes +
   quantidade`);
2. *depois de inserir:* copia `saldo_depois` para `produto.saldo`;
3. *antes de mudar `produto.saldo`:* recusa valor diferente do `saldo_depois`
   do último movimento do produto (fecha a atualização direta por engano).

Com `CHECK (saldo >= 0)`, "sem saldo, sem venda" é regra do banco: a venda que
deixaria saldo negativo falha inteira. Velocidade não foi o critério (somar os
movimentos seria rápido nesta escala); foi pôr a regra no banco e manter o
retrato "tinha 36, ficou 37". Descartadas: (A) saldo mantido pelo código, que
diverge se um caminho esquecer; (B) saldo sempre calculado, que deixa o "não
vender o que não tem" só no código. Os gatilhos são testados nos testes de
contrato, inclusive a recusa de cada um; conferir no `node:sqlite` na
migration.

**`entrada_mercadoria`** — o cabeçalho de uma entrega (fato). Uma por
"Confirmar entrada", com todos os itens na mesma transação (corrige A1 de vez).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `recebida_em` | texto | `dia` informado pela pessoa (≤ hoje) |
| `fornecedor`, `referencia`, `observacoes` | texto | *opcionais* |
| `operador_id` | texto | FK `operador` |
| `registrado_em` | texto | instante UTC |

**`movimento_estoque`** (fato)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `produto_id` | texto | FK `produto` |
| `tipo` | texto | `entrada`, `ajuste`, `venda`, `cancelamento` |
| `quantidade` | inteiro | variação com sinal (+ entra, − sai); ajuste é a diferença da contagem |
| `saldo_antes`, `saldo_depois` | inteiro | retrato |
| `motivo` | texto | obrigatório no ajuste |
| `custo_unitario` | inteiro | *opcional*; centavos desta entrega |
| `entrada_id` | texto | *opcional*; FK `entrada_mercadoria` |
| `ficha_id` | texto | *opcional*; FK `ficha` (venda e cancelamento) |
| `operador_id`, `autorizado_por_id` | texto | FK `operador`; o segundo *opcional* |
| `registrado_em` | texto | instante UTC |

O "saldo inicial do cadastro" vira uma entrada sem `entrada_id`, com o motivo
de hoje. Produto **sem histórico** (só esse movimento) ainda pode ser excluído
de verdade, com o movimento junto: é cadastro por engano (regra da 0.1).

### Clientes

**`cliente`** (cadastro)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `numero` | inteiro | único; exibido `CLI-0104` |
| `nome` | texto | único obrigatório do cadastro |
| `documento` | texto | *opcional*; **só dígitos** (CPF 11, CNPJ 14); **único quando preenchido** |
| `telefone` | texto | *opcional*; só dígitos |
| `logradouro`, `numero_endereco`, `complemento`, `bairro`, `cidade`, `uf`, `cep` | texto | *opcionais*; endereço em campos (a Emitte pede assim) |
| `tipo_contribuinte` | texto | *opcional*; `nao-contribuinte`, `contribuinte`, `isento` |
| `tipo_cliente` | texto | *opcional*; `consumidor`, `revenda` |
| `inscricao_estadual` | texto | *opcional* |
| `emitte_enviado_em` | texto | *opcional*; instante |
| `criado_em` | texto | instante UTC (o "cliente desde") |

Sai da 0.1: `descricao` ("Cliente frequente", "Cadastro novo"): ver P2. A
máscara do documento (`***.452.198-**`) é da tela, não do dado.

### Venda

**`ficha`** (fato)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `numero` | inteiro | único; exibido `#1131`; nasce ao concluir |
| `cliente_id` | texto | *opcional*; FK `cliente`; vazio = venda sem identificação |
| `forma` | texto | `dinheiro`, `pix`, `cartao`, `misto`, `notinha` |
| `subtotal` | inteiro | retrato: itens + serviços, recalculado pelo back |
| `desconto` | inteiro | ≥ 0, ≤ subtotal |
| `total` | inteiro | retrato: subtotal − desconto |
| `vencimento` | texto | *opcional*; `dia`; só notinha, nunca muda |
| `dia` | texto | dia da venda em São Paulo |
| `operador_id` | texto | FK `operador` |
| `registrado_em` | texto | instante UTC |

**`ficha_item`** (fato)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `ficha_id` | texto | FK `ficha` |
| `produto_id` | texto | FK `produto` |
| `descricao` | texto | retrato do nome na hora da venda |
| `quantidade` | inteiro | ≥ 1; um produto por ficha (único `ficha_id + produto_id`) |
| `preco` | inteiro | retrato do preço do cadastro na hora; o back não aceita o da tela |

**`ficha_servico`** (fato) — serviço sem cadastro (`2026-10-19`).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `ficha_id` | texto | FK `ficha` |
| `nome` | texto | o que foi feito, texto livre |
| `valor` | inteiro | ≥ 0 |
| `perdas` | inteiro | *opcional*; ≥ 1; só conferência, não mexe no estoque |
| `observacao` | texto | *opcional* |

**`ficha_anotacao`** (fato) — só se acrescenta.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id`, `ficha_id`, `texto`, `operador_id`, `registrado_em` | | |

**`ficha_cancelamento`** (fato) — no máximo um por ficha (`ficha_id` único).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id`, `ficha_id` | texto | |
| `motivo` | texto | obrigatório |
| `dia` | texto | o pago sai do Financeiro **neste** dia |
| `caixa_id` | texto | *opcional*; caixa aberto no momento |
| `operador_id`, `autorizado_por_id`, `registrado_em` | | |

Cancelar insere esta linha e um `movimento_estoque` de `cancelamento` por item,
devolvendo a mesma quantidade que a venda baixou. Nada da ficha é alterado.

### Dinheiro que entra pela ficha

**`recebimento`** (fato) — um gesto de "Receber" (uma ou várias notinhas, um ou
vários meios). A venda à vista e a entrada da notinha não precisam dele.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `cliente_id` | texto | FK `cliente` |
| `dia` | texto | dia informado pela pessoa (entre a notinha mais antiga e hoje) |
| `operador_id`, `registrado_em` | | |

**`pagamento`** (fato) — cada dinheiro que entrou por causa de uma ficha, por
meio. É o que vira linha no Financeiro.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `ficha_id` | texto | FK `ficha` |
| `recebimento_id` | texto | *opcional*; FK `recebimento` (só recebimento de notinha) |
| `tipo` | texto | `venda` (à vista), `entrada` (da notinha), `recebimento` |
| `meio` | texto | `dinheiro`, `pix`, `cartao` |
| `valor` | inteiro | > 0 |
| `recebido` | inteiro | *opcional*; só dinheiro: quanto a pessoa entregou |
| `troco` | inteiro | *opcional*; só dinheiro (M6: a 2ª via precisa) |
| `maquininha` | texto | *opcional*; `mercado-pago`, `sicoob`; vazio no dinheiro e no Pix manual |
| `cartao` | texto | *opcional*; `credito`, `debito` (também no misto, M6) |
| `rotulo` | texto | *opcional*; "Cartão crédito Visa · Mercado Pago" |
| `cobranca_id` | texto | *opcional*; FK `cobranca`; **único**: a mesma cobrança aprovada nunca vira duas vendas (A4) |
| `dia` | texto | dia em que o dinheiro conta |
| `caixa_id` | texto | *opcional*; caixa aberto no momento (M7: ver P5) |
| `operador_id`, `registrado_em` | | |

**`pagamento_estorno`** (fato) — recebimento de notinha lançado por engano; no
máximo um por pagamento (`pagamento_id` único). A notinha volta a dever.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id`, `pagamento_id`, `motivo`, `dia`, `caixa_id`, `operador_id`, `autorizado_por_id`, `registrado_em` | | |

**`cobranca`** (estado espelhado do Mercado Pago) — registrada **antes** de ir à
maquininha (A4). É a única tabela de fato que recebe `update`: ela espelha a
situação de fora (enviando → na maquininha → aprovada/recusada/…).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK; vai como `referencia` externa |
| `externo_id` | texto | *opcional*; id da order no Mercado Pago |
| `meio` | texto | `credito`, `debito`, `pix` |
| `valor` | inteiro | |
| `situacao` | texto | `enviando`, `na-maquininha`, `aprovada`, `recusada`, `cancelada`, `expirada` |
| `bandeira`, `motivo` | texto | *opcionais* |
| `demonstracao` | inteiro 0/1 | |
| `criada_em`, `atualizada_em` | texto | instantes UTC |

Ao abrir o app, as cobranças não finais são consultadas de novo pela referência
(reconciliação, A4).

### Caixa (a gaveta)

**`caixa`** (fato) — a abertura. Fechar não altera esta linha.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `dinheiro_abertura` | inteiro | ≥ 0 |
| `operador_id`, `registrado_em` | | |

**`caixa_fechamento`** (fato) — um por caixa (`caixa_id` único).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id`, `caixa_id` | texto | |
| `esperado` | inteiro | retrato calculado pelo back no fechamento |
| `contado` | inteiro | ≥ 0 |
| `justificativa` | texto | obrigatória se `contado ≠ esperado` |
| `operador_id`, `autorizado_por_id`, `registrado_em` | | |

**Um caixa aberto por vez:** caixa sem fechamento. Garantido na transação de
`abrirCaixa` (não há disputa: um escritor).

**`movimento_gaveta`** (fato) — dinheiro mudando de lugar (nome decidido no
inventário). Não é receita nem despesa.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id`, `caixa_id` | texto | o caixa tem que estar aberto |
| `tipo` | texto | `adicao`, `retirada` |
| `valor` | inteiro | > 0 (o tipo dá o sinal) |
| `motivo` | texto | "Origem ou motivo" / "Destino ou motivo" |
| `estorno_de` | texto | *opcional*; FK `movimento_gaveta`; único |
| `operador_id`, `registrado_em` | | |

### Financeiro

**`lancamento`** (fato) — entrada ou despesa manual.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `tipo` | texto | `entrada`, `despesa` |
| `descricao`, `origem` | texto | |
| `meio` | texto | `dinheiro`, `pix`, `cartao` |
| `valor` | inteiro | **com sinal**: + entrada, − despesa; o estorno tem o sinal oposto |
| `estorno_de` | texto | *opcional*; FK `lancamento`; único (um estorno por lançamento) |
| `motivo` | texto | *opcional*; obrigatório no estorno |
| `dia` | texto | |
| `caixa_id` | texto | *opcional*; dinheiro conta na gaveta aberta |
| `operador_id`, `autorizado_por_id`, `registrado_em` | | |

O Financeiro é uma **consulta** sobre `pagamento` (+ estornos e cancelamentos)
e `lancamento`, por período e paginada. Sem tabela própria de "movimento
financeiro": as linhas de hoje (`movimentosFinanceiro`) viram uma visão.

### Boletos

**`boleto`** (cadastro) — anotação dos boletos da loja (`2026-10-23`).

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | texto | PK |
| `numero_exibicao` | inteiro | único; `BOL-0001` |
| `descricao` | texto | |
| `valor` | inteiro | > 0 |
| `numero` | texto | o número do arquivo da dona; pode repetir (só aviso) |
| `vencimento` | texto | `dia` |
| `criado_em` | texto | instante UTC; editar não muda |

**`boleto_evento`** (fato) — o que acontece com o boleto. A situação é o último
evento.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id`, `boleto_id` | texto | |
| `tipo` | texto | `pago`, `pagamento-desfeito`, `excluido` |
| `dia` | texto | no `pago`: o dia do pagamento |
| `motivo` | texto | obrigatório em `pagamento-desfeito` e `excluido` (D7) |
| `operador_id`, `autorizado_por_id`, `registrado_em` | | |

Pagar não lança no Financeiro (decisão de `2026-10-23`).

---

## O que o banco garante (além das colunas)

Escritas na migration como `check` ou gatilho, cada uma com teste. A tela e o
back continuam conferindo antes, para responder com a mensagem certa; o banco
é a última porta.

- **Fato não recebe `update` nem `delete`** (gatilhos `*_sem_update` e
  `*_sem_delete`). Exceções: `cobranca` muda de situação; o produto sem
  histórico sai levando o movimento do saldo inicial.
- **Saldo:** os três gatilhos de P4; produto nasce com saldo 0.
- **Movimento de estoque:** venda tira, entrada e cancelamento põem, ajuste
  tem motivo; venda e cancelamento apontam a ficha.
- **Ficha:** `total = subtotal − desconto`; notinha tem vencimento (≥ o dia) e
  cliente.
- **Caixa:** um aberto por vez; caixa fechado não recebe pagamento,
  lançamento, estorno, cancelamento nem movimento da gaveta (o esperado do
  fechamento depende disso); diferença no fechamento exige justificativa.
- **Estorno** (lançamento e gaveta): inverte o original (mesmo valor, sinal ou
  tipo oposto), um por original, e estorno não se estorna. Só recebimento de
  notinha tem `pagamento_estorno`.
- **Cobrança (A4):** só a aprovada vira pagamento, uma vez; aprovada não volta
  atrás; meio, valor e data não mudam.
- **Boleto:** eventos seguem a situação (não paga duas vezes, só desfaz o
  pago, excluído é final); boleto nunca é apagado (D7).
- **Formatos:** documento, telefone, CEP, NCM e CEST só dígitos; `dia` e
  instante no formato certo; valores fechados por `check`; tabelas `strict`.

O que **não** está no banco, e fica com o back: `subtotal` igual à soma de
itens e serviços (os itens entram depois da ficha), datas "até hoje" (o banco
não sabe o dia de São Paulo) e os números de exibição (lidos da `sequencia`).

---

## O que é calculado (não vira coluna)

| Informação | De onde sai |
| --- | --- |
| Situação da notinha (pendente, vencida, paga, cancelada) e o valor em aberto | `ficha.total` − pagamentos válidos, `vencimento`, hoje |
| Resumo do cliente (total comprado, compras, ticket médio, situação) | fichas e pagamentos do cliente |
| Situação do saldo (normal, baixo, zerado) | `saldo`, `minimo` |
| Esperado da gaveta com o caixa aberto | `dinheiro_abertura` + pagamentos e lançamentos em dinheiro + movimentos da gaveta do caixa |
| Totais do Financeiro, resumo do dia, serviços e perdas do período | consultas por `dia` |
| Situação do boleto (a vencer, vencendo, vencido, pago, excluído) | último `boleto_evento`, `vencimento`, hoje |
| Avisos do sino | consultas acima; "lido" vem de `preferencia.avisos_lidos` |
| Categoria do Financeiro (Venda, Serviço, Venda e serviço, Recebimento de notinha) | a ficha e o tipo do pagamento |

---

## O que muda em relação à 0.1

| Na 0.1 | Na 1.0 | Por quê |
| --- | --- | --- |
| Base inteira num documento (`localStorage` + `jsonb` no Supabase) | Tabelas no SQLite; o Supabase guarda a cópia do arquivo | decisão de `2026-10-05` |
| Código `CLI-`, `EST-`, `#` gerado por "maior + 1" na tela | `id` UUID + número por `sequencia`, no banco | inventário; checagem |
| `data` + `horario` locais e às vezes ISO | `registrado_em` UTC + `dia` de São Paulo | dois relógios (checagem) |
| `operador: 'Loja'` (nome) | `operador_id` + tabela `operador` | decisão de `2026-10-23` |
| Cancelamento e estorno **dentro** da ficha e do pagamento (campo editado) | linhas próprias, só inseridas | fato não se edita |
| Fechar caixa edita o turno | `caixa_fechamento` à parte | idem |
| `MovimentoCaixa` mistura despesa e gaveta, com categorias em texto | `lancamento` e `movimento_gaveta` | nomes decididos no inventário |
| Boleto pago e desfeito apagando `pagoEm`/`pagoPor`; excluir apaga | `boleto_evento` | D7; fato não se edita |
| Preço e total da ficha vindos da tela | recalculados pelo back e guardados como retrato | M4 |
| Endereço num texto só | campos separados | Emitte; inventário |
| Documento mascarado e comparado na tela | só dígitos, único no banco | auditoria de 30/09, A7 |
| Troco e cartão do misto não guardados | colunas no `pagamento` | M6 |
| Cobrança da maquininha só na memória | tabela `cobranca`, antes de cobrar | A4 |
| Entrada de mercadoria = várias gravações em laço | `entrada_mercadoria` + movimentos, uma transação | A1; inventário |
| Bloco `fiscal` do produto com padrões; `grupo` | `ncm` e `cest`; o resto sai | decisões de `2026-10-23` e `2026-10-24` |
| Rascunhos de nota fiscal | saem | D8 |
| Categorias legadas "Troco", "Saída de caixa" | não existem | sem importador da 0.1 |

---

## Perguntas para a revisão

- **P1 — Cadastro rápido volta na 1.0?** *Decidido (`2026-10-27`): não volta; sai `a_completar`.* Hoje está oculto (`2026-10-20`) e a
  regra "sem saldo, sem venda" o tornou inútil na ficha. Se não voltar, sai a
  coluna `a_completar` e o código dele. Proposta: **não volta**; o cadastro pela
  ficha (`2026-10-23`) cobre o caso.
- **P2 — `descricao` do cliente** *Decidido (`2026-10-27`): sai.* ("Cliente frequente"): ninguém digita; a semente
  inventa e o cadastro grava "Cadastro novo". Proposta: **sai**; se a loja
  quiser uma classificação, ela vira cálculo (ex.: frequente = N compras em 90
  dias).
- **P3 — Categoria do produto como texto livre** *Decidido (`2026-10-27`): texto.* (como hoje) ou tabela própria
  (renomear uma categoria mudaria todos os produtos de uma vez). Proposta:
  **texto** na 1.0; tabela só se renomear virar pedido.
- **P4 — Saldo guardado com invariante** *Decidido (`2026-10-27`): guardado e mantido por gatilhos do banco (opção C; ver "Saldo guardado").* A pergunta era: guardado ou sempre calculado pela
  soma dos movimentos.
- **P5 — M7: recebimento com dia passado** *Decidido (`2026-10-27`): no percurso da tela.* entra na gaveta de hoje? Hoje entra
  no caixa aberto no momento do lançamento. O schema guarda `dia` e `caixa_id`
  separados, então aceita as duas regras; decide-se no percurso da tela
  "Receber notinhas".
- **P6 — Devolução parcial (D5, da dona).** *Decidido (`2026-10-27`): fora por ora.* Sem resposta, fica fora; entraria
  depois como acréscimo (`ficha_devolucao` + movimento de estoque), sem mudar o
  que está aqui.
