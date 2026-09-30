# Briefing de telas — Papelaria Opção

Este documento descreve **o que desenhar**. `DESIGN.md` descreve **como deve
parecer**. A primeira rodada é um protótipo de interface com dados fictícios,
sem conexão real com pagamentos, banco, leitor ou emissor fiscal.

## Produto e público

Aplicativo desktop para uma papelaria brasileira. A funcionária registra
vendas e movimenta estoque; a dona acompanha clientes e financeiro. O sistema
deve parecer uma ferramenta de trabalho simples, com navegação lateral e
terminologia em português: “ficha” é o registro de **uma venda**, enquanto
“cadastro do cliente” permanece para compras futuras.

A base visual de preto, branco e cinzas vem das pranchas de componentes
fornecidas. Ela ocupa aproximadamente 85% da interface; o amarelo da logo é
um destaque pontual da marca. Fora da logo, o vermelho fica reservado para
erro, alerta, ação destrutiva ou saída/queda financeira. Entradas podem usar
verde em gráficos. Não usar vermelho em botões ou navegação comuns.

Stack existente para posterior implementação: Electron, Vite, React 19,
TypeScript e Tailwind CSS v4. Desenhar telas de aplicativo desktop; não
converter o projeto para um site de marketing, PWA ou Next.js.

## Navegação

Barra lateral: Início, Clientes, Financeiro, Estoque, Notas fiscais. Cabeçalho
com título da seção e ícone de notificações. A entrada fiscal é mínima nesta
rodada. Os alertas de estoque baixo e contas vencidas podem aparecer no painel
de notificações e nas seções correspondentes.

## 1. Início

Esta é a mesa de trabalho diária. Exibir um resumo discreto, de tamanho
confortável, de recebimentos, vendas e saídas do dia. **Valores monetários
começam ocultos** e são revelados pelo ícone de olho. Colocar “Criar ficha”
em destaque no alto, preferencialmente à direita. A área principal mostra
fichas recentes em lista: ID, cliente, horário, forma de pagamento, situação e
ação “Ver compra”. Cada ficha abre seus itens e valores. Evitar gráficos,
estoque baixo e contas vencidas nessa tela.

## 2. Criar ficha de venda

No mesmo fluxo, buscar um cliente existente ou cadastrar um novo rapidamente,
sem fechar a ficha. O cliente novo fica selecionado automaticamente. Adicionar
produtos por nome ou código de barras; leituras repetidas do mesmo produto
aumentam a quantidade. Mostrar itens, quantidades, preços e total antes de
registrar a forma de pagamento. Permitir dinheiro, Pix, cartão e compra com
pagamento futuro. Dinheiro gera lançamento manual no caixa. Marcar Pix ou
cartão significa que a funcionária conferiu o pagamento no balcão, mas não
cria outra entrada financeira. A ficha pode oferecer “Preparar nota”, que
abre apenas um rascunho visual.

## 3. Clientes

Lista alfabética com número estável, nome, busca visível no topo e filtros
Todos / Com pendências / Com vencidos. Cada linha mostra a quantidade total
de compras e pode expandir um resumo das **três mais recentes**: ID da ficha,
data e situação. “Ver histórico completo” abre o cliente, com compras e
detalhes de cada ficha. A lista não expande centenas de compras.

## 4. Financeiro

Selecionar somente **Dia, Semana, Mês ou Ano**. Filtrar Todos / Pix / Cartão /
Dinheiro e consultar a lista de movimentos, incluindo entradas e saídas.
Prever ação “Exportar período” para o futuro relatório da contabilidade; o
formato e os campos do arquivo ainda não foram definidos. Um gráfico simples
pode aparecer se ajudar a comparar períodos ou meios de pagamento. Usar
exemplos fictícios coerentes e contar cada recebimento uma única vez. Um
recebimento externo pode existir sem ficha vinculada; não inventar cliente ou
produtos para ele.

## 5. Estoque

Lista pesquisável de produtos com código, nome, categoria, preço, saldo e
sinalização de estoque baixo nesta própria seção. Ações: cadastrar produto,
registrar entrada, ajustar estoque e consultar movimentações. O formulário
principal pede nome, categoria, unidade base, preço e quantidade inicial;
gera código interno. Código de barras, marca, características, custo, mínimo,
fornecedor, localização e imagem são complementares. Dados fiscais ficam em
grupo separado. Venda unitária é o padrão; uma apresentação em caixa/pacote
é opcional. “Registrar entrada” atende um item ou vários itens no mesmo fluxo.
Uma leitura de código desconhecido deve oferecer busca ou cadastro sem perder
a tarefa em andamento.

## 6. Notas fiscais

Área mínima com **Entradas** e **Saídas**. Mostrar listas e estados simulados.
Da ficha de venda, “Preparar nota” preenche um rascunho com cliente, produtos
e valores já conhecidos, para revisão. Não indicar que um rascunho foi
fiscalmente emitido. A Focus NFe é a provedora provável, ainda sem decisão
final; tipo de nota, campos fiscais e processo de entrada serão definidos
depois com a contabilidade.

## Estados e dados para o protótipo

Mostrar pelo menos um caso normal, lista vazia, carregamento e falha legível.
Usar nomes, produtos e números **inteiramente fictícios**. Incluir nomes longos,
cliente com muitas compras, produto sem código de barras e pagamento em
dinheiro/Pix/cartão para que a interface não dependa só do caso ideal.

## Entrega desejada do Stitch

Criar um conjunto consistente de telas desktop e os estados principais do
fluxo de venda. Preservar a linguagem visual definida em `DESIGN.md` e a logo
em `assets/marca/`. A primeira revisão deve permitir avaliar principalmente:
clareza da Início, velocidade para criar ficha, navegação entre cliente e
compra, leitura das listas e organização do estoque.
