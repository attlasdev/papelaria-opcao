Crie a primeira proposta visual de um aplicativo **desktop** para a Papelaria
Opção, em português do Brasil. O estilo deve ser claro, profissional e rápido
de usar no balcão, com barra lateral à esquerda. Priorize a consistência entre
as telas. Aplique o DESIGN.md configurado no projeto e use a logo e os PNGs
enviados como referência de marca, componentes e tons neutros.

Use a base de preto, branco e cinzas das pranchas anexas em aproximadamente
85% da interface. Reserve o amarelo da logo para poucos destaques da marca.
Fora da logo, use vermelho somente para erro, alerta, ação destrutiva ou
saída/queda financeira; em gráficos, verde pode representar entrada. O botão
principal pode ser preto.

Desenhe as telas **Início, Criar ficha de venda, Clientes, Detalhe do cliente,
Financeiro, Estoque, Cadastro de produto e Notas fiscais**. Na Início, mostre
recebimentos, vendas e saídas do dia em um resumo de tamanho moderado, com
**valores ocultos por padrão e botão de olho**; destaque “Criar ficha” no alto
à direita e mostre as fichas recentes em lista. Na venda, permita cadastrar
cliente novo sem sair da ficha, adicionar produtos por busca/código de barras
e registrar dinheiro, Pix ou cartão. Na lista de Clientes, use ordem alfabética,
número estável, busca visível, filtros e expansão limitada às três compras
recentes. No Financeiro, use Dia/Semana/Mês/Ano, filtros por meio e ação de
exportar período. Uma ficha marcada como paga por Pix ou cartão não cria uma
segunda entrada financeira; dinheiro informado na ficha conta no caixa. No
Estoque, preveja cadastro, entrada de um ou vários
produtos, ajuste de saldo e leitura de código de barras. Em Notas fiscais,
mostre Entradas/Saídas e um rascunho iniciado pela venda, sem sugerir emissão
real nesta rodada.

Use dados fictícios e estados vazios, de carregamento e erro. Não coloque
estoque baixo ou contas vencidas como cartões na Início. Não crie site de
marketing, experiência mobile nem integração real de API. A implementação
posterior usará Electron, Vite, React 19, TypeScript e Tailwind CSS v4.
