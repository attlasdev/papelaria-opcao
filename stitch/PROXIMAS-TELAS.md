# Próximas telas no mesmo projeto do Stitch

A primeira geração produziu a tela **Início** e a prancha visual. Continue no
mesmo projeto para conservar a linguagem de componentes. Envie **um bloco por
vez**. Primeiro corrija a Início; depois peça cada nova tela. Ao criar uma
tela, peça explicitamente para preservar as já existentes.

## 0. Corrigir a Início existente

> Modifique somente a tela Início existente da Papelaria Opção. Preserve a
> composição, a barra lateral, a logo e os componentes. O botão “Mostrar
> valores” deve controlar **todos** os valores monetários da Início: resumo de
> recebimentos e saídas, média/tíquete, valores totais das linhas e quaisquer
> outros números em R$. Ao abrir, todos ficam ocultos; ao clicar, aparecem
> juntos e podem ser ocultados novamente. A quantidade de fichas pode continuar
> visível. Remova “Status Sincronizado”, pois esta rodada não possui integração
> real. Cada ficha deve estar ligada a um cadastro mínimo de cliente; não use
> “avulso” como atalho sem cadastro. Mantenha “Criar ficha” evidente.

## 1. Criar ficha de venda

> Adicione uma nova tela ou modal largo de **Criar ficha de venda** ao mesmo
> projeto da Papelaria Opção, sem substituir a Início. Reutilize a barra
> lateral, tipografia, cores e controles do DESIGN.md. Dentro do mesmo fluxo,
> permita buscar e selecionar cliente existente ou cadastrar cliente novo com
> dados mínimos; depois de salvar, ele fica selecionado sem fechar a ficha.
> Inclua busca de produto por nome ou leitura de código de barras, lista de
> itens com quantidade, preço e total, e feedback para código não encontrado.
> A leitura repetida do mesmo produto aumenta sua quantidade. Ofereça dinheiro,
> Pix, cartão ou pagamento futuro com vencimento. Dinheiro gera lançamento
> manual no caixa; Pix/cartão apenas registram na ficha um pagamento já
> conferido no balcão e não criam segunda entrada financeira. Mostre revisão
> antes de concluir e ação opcional “Preparar nota”. Use dados fictícios.

## 2. Clientes

> Adicione uma nova tela **Clientes** ao mesmo projeto, sem alterar as telas
> existentes. Use a mesma barra lateral e linguagem visual. Mostre lista
> alfabética por nome, com número de cliente estável, busca visível no topo e
> filtros “Todos”, “Com pendências” e “Com vencidos”. Cada linha exibe a
> quantidade total de compras e pode expandir apenas as três compras mais
> recentes com ID, data e situação; ofereça “Ver histórico completo”. Não
> expanda centenas de registros. Inclua botão de cadastrar cliente e um estado
> vazio legível. Pendência e vencimento descrevem compras, não a pessoa.

## 3. Detalhe do cliente

> Adicione uma nova tela **Detalhe do cliente** no mesmo projeto, ligada à
> ação “Ver histórico completo” de Clientes. Preserve a linguagem visual.
> Mostre cadastro mínimo, edição de dados e histórico de todas as fichas em
> lista paginada ou com carregamento progressivo. Cada compra exibe ID, data,
> itens principais, valor e situação, com ação de abrir o detalhe da compra.
> Separe as visões de compras pagas, pendentes e vencidas com filtros claros.
> Use dados fictícios e um exemplo de cliente com muitas compras; não mostre
> centenas de linhas ao mesmo tempo.

## 4. Financeiro

> Adicione uma nova tela **Financeiro** ao mesmo projeto. Mantenha a barra
> lateral e a paleta neutra, com verde para entrada e vermelho para saída nos
> dados, não na decoração. Ofereça somente quatro períodos: Dia, Semana, Mês
> e Ano. Mostre resumo contido, lista de movimentos com entradas e saídas,
> filtros “Todos”, “Pix”, “Cartão” e “Dinheiro” e botão “Exportar período”. Um
> gráfico simples pode ajudar a comparar os movimentos, com rótulos além da
> cor. Inclua pagamento externo sem ficha vinculada, sem inventar cliente ou
> produtos. Conte cada recebimento apenas uma vez; o Pix ou cartão marcado na
> ficha não duplica a entrada financeira. Não prometa arquivo contábil final.

## 5. Estoque

> Adicione uma nova tela **Estoque** ao mesmo projeto, preservando o sistema
> visual. Crie lista pesquisável de produtos com código interno, nome,
> categoria, unidade, preço de venda e saldo. Nesta seção, sinalize estoque
> baixo de forma legível. Inclua filtros e ações “Cadastrar produto”,
> “Registrar entrada”, “Ajustar estoque” e “Ver movimentações”. Uma entrada
> pode começar pelo botão do topo ou pela linha de um produto. Mostre um
> produto sem código de barras e um nome longo para testar a tabela. Use
> dados fictícios e estados vazio, carregando e erro.

## 6. Cadastro de produto

> Adicione uma nova tela ou painel **Cadastro de produto** ligado a Estoque,
> com o mesmo visual. No grupo principal, mostre nome, código interno gerado,
> categoria, unidade base com padrão “unidade”, preço de venda, quantidade
> inicial e controle de estoque. Num grupo complementar, mostre código de
> barras, marca, características, descrição, custo, estoque mínimo, fornecedor,
> localização e imagem; não obrigue o preenchimento de todos. Deixe campos
> fiscais em grupo separado para definição posterior. Venda por unidade é o
> padrão; apresentação em caixa/pacote é uma opção recolhida. Mostre aviso de
> código de barras duplicado e botões claros de salvar e cancelar.

## 7. Registrar entrada de mercadorias

> Adicione um novo fluxo **Registrar entrada** ligado a Estoque. Preserve o
> visual e as telas existentes. Permita adicionar um produto ou vários no
> mesmo registro, por busca ou código de barras, com quantidade por item.
> Quando aberto a partir da linha de um produto, esse item já vem preenchido;
> quando aberto pelo topo, a lista começa vazia. Mostre data, fornecedor e
> referência da compra como campos opcionais, além de revisão dos itens antes
> de confirmar. Inclua acesso separado a **Ajustar estoque** para correção de
> contagem, sem tratá-la como entrada de mercadoria. Use dados fictícios.

## 8. Notas fiscais

> Adicione uma nova tela **Notas fiscais** ao mesmo projeto, com as abas
> “Entradas” e “Saídas”, listas simples, busca, filtros e estados vazios.
> Preserve a linguagem visual e não afirme que há emissão fiscal real. Inclua
> um rascunho de nota de saída iniciado por “Preparar nota” na ficha de venda,
> com cliente, produtos e valores conhecidos já preenchidos para revisão.
> Identifique-o claramente como **rascunho**, sem número fiscal, autorização
> ou status de nota emitida. Os campos fiscais definitivos serão decididos
> depois com a contabilidade.

## Revisão entre telas

Depois de cada geração, confira se a tela nova aparece no mesmo projeto e se
Início, barra lateral, logo e sistema visual foram preservados. Caso o Stitch
altere uma tela existente, peça para restaurá-la antes de continuar.
