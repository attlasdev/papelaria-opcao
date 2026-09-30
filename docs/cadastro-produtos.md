# Cadastro de produtos — primeiro desenho do front

Esta é a proposta de campos para a primeira rodada da interface. Ela cobre a
venda comum por unidade e deixa espaço para outros formatos sem exigir uma
ficha extensa para cada item. Ainda não define banco nem contrato de IPC.

## Campos principais

| Campo | Preenchimento | Uso na interface |
| --- | --- | --- |
| Nome do produto | Obrigatório | Nome que aparece na busca, na venda e na ficha. |
| Código interno | Gerado pelo sistema | Identificador estável e pesquisável; não depende de código de barras. |
| Categoria | Obrigatória | Organização e filtro simples do estoque. Sem árvore de subcategorias na primeira rodada. |
| Unidade base | Obrigatória, padrão `unidade` | Como o saldo é contado: unidade, pacote, resma, folha, metro etc. A quantidade aceita casas decimais somente quando a unidade permitir. |
| Preço de venda | Obrigatório | Valor inicial ao adicionar o item a uma venda. Descontos pertencem à venda. |
| Quantidade inicial | Padrão zero | Saldo no primeiro cadastro. Ajustes posteriores aparecem no histórico de movimentações. |
| Controla estoque | Padrão sim | Permite cadastrar um item vendido sem saldo físico, caso haja essa necessidade. |

## Campos complementares, visíveis sem serem obrigatórios

| Campo | Uso |
| --- | --- |
| Código de barras | Busca rápida ou leitor; se informado, identificar apenas um item ou apresentação. |
| Marca | Ajuda a distinguir produtos semelhantes. |
| Características | Texto curto para cor, tamanho, formato, gramatura, quantidade de folhas ou outra característica relevante. Evita criar um campo fixo para cada família de papelaria. |
| Descrição | Detalhes que não cabem no nome. |
| Custo unitário | Consulta de compra e futura análise de margem; não aparece na venda ao cliente. |
| Estoque mínimo | Base para alerta de reposição, se a loja quiser usá-lo. |
| Fornecedor | Referência de compra, quando conhecida. |
| Localização | Prateleira ou setor da loja, quando útil. |
| Imagem | Reconhecimento visual, sem ser necessária para cadastrar. |
| Situação | Ativo por padrão; inativo continua no histórico, mas sai da busca de venda. |

## Leitor de código de barras

A loja já possui um leitor. Muitos modelos enviam o código como se fossem um
teclado USB; o modo real do equipamento será confirmado num teste físico.

- **No cadastro:** deixar o campo Código de barras pronto para receber a leitura.
  Avisar quando o código já pertencer a outro item ou apresentação.
- **Na venda:** manter um campo de busca/leitura evidente. Escanear um código
  conhecido adiciona o produto à ficha; nova leitura do mesmo código aumenta
  sua quantidade. Mostrar uma confirmação breve com nome e quantidade.
- **Código desconhecido:** mostrar "Produto não encontrado" e oferecer busca
  por nome ou cadastro rápido, mantendo a venda em andamento.
- **Segurança de uso:** a leitura atua no campo de busca/leitura em foco; não
  intercepta teclas enquanto a funcionária digita nome, valor ou observações
  em outro campo. Verificar se o leitor envia Enter ao final da leitura.

## Entrada de mercadorias

Uma única ação **Registrar entrada** cobre reposição de um produto e entrega
com vários produtos:

- Pela linha de um produto, a ação abre a entrada com o item preenchido.
- Pelo topo do Estoque, a ação abre uma lista vazia; a funcionária adiciona
  produtos por busca ou leitura de código de barras e informa a quantidade de
  cada um.
- Data, fornecedor e referência da nota de compra podem aparecer como dados
  opcionais do recebimento. A escolha final dos campos vem do uso real.
- Antes de confirmar, mostrar os itens e quantidades em um resumo. Depois,
  manter o registro no histórico de movimentações.
- Uma correção de contagem usa a ação **Ajustar estoque**, separada de
  **Registrar entrada**, para não parecer compra ou recebimento de mercadoria.

## Variações e caixas fechadas

- Cada variação vendida separadamente pode ter sua própria apresentação: por
  exemplo, `Caneta azul` e `Caneta preta`, cada uma com código, preço e saldo.
- Se a **mesma mercadoria** puder ser vendida avulsa e em caixa, a ficha pode
  oferecer uma apresentação adicional com nome, unidades contidas e preço:
  `Caixa com 50`, por exemplo. O saldo continua contado na unidade base, evitando
  tratar caixa e unidades retiradas dela como estoques independentes.
- A apresentação adicional fica recolhida por padrão. A maioria dos cadastros
  usará apenas a apresentação unitária.

## Dados fiscais reservados

Uma seção separada da ficha poderá guardar dados fiscais por produto, como
NCM e CEST quando aplicável. A [referência de itens da Focus NFe](https://campos.focusnfe.com.br/nfe/ItemNotaFiscalXML.html)
inclui também unidade, descrição, código e campos que dependem da operação.
Os campos obrigatórios de emissão serão definidos com a contabilidade e com
o fluxo escolhido de NF-e/NFC-e. CFOP não deve ser presumido como um valor
fixo universal do produto, pois descreve a operação fiscal.

## Fora do formulário inicial

Lote, validade, número de série, múltiplos preços e grades complexas ficam
fora da primeira rodada. Se aparecer um caso concreto, a ficha pode ser
ampliada sem trocar a identificação, a unidade base ou o histórico do produto.
