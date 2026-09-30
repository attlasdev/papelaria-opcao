---
version: alpha
name: Papelaria Opção — operação de balcão
description: Direção visual inicial para o aplicativo desktop de vendas, clientes, financeiro e estoque.
colors:
  primary: "#000000"
  brand-accent: "#FEF003"
  danger: "#EA0B11"
  ink: "#000000"
  canvas: "#F9F9F9"
  surface: "#FFFFFF"
  border: "#E8E8E8"
  muted: "#4B4B4B"
  success: "#176B4D"
  warning: "#8A5A00"
typography:
  heading:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.2
  section:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 10px
  lg: 14px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  primary-button:
    background: "{colors.primary}"
    foreground: "{colors.surface}"
    radius: "{rounded.md}"
  panel:
    background: "{colors.surface}"
    border: "{colors.border}"
    radius: "{rounded.lg}"
---

# Papelaria Opção — linguagem visual inicial

## Overview

Aplicativo de mesa para a rotina de uma papelaria brasileira. A aparência deve
ser clara, organizada e rápida de ler no balcão. O gesto central é criar uma
ficha de venda; a interface também permite acompanhar clientes, caixa e estoque.
O produto não é uma landing page nem um painel executivo cheio de gráficos.
Projetar para janela desktop a partir de 900 × 600 px, com composição confortável
em 1100 × 760 px. Usar textos de interface em português do Brasil.

A logo anexada (`logo-original.svg`) é o elemento visual da marca. O
amarelo e o vermelho acima foram extraídos dela. A base em branco, preto e
cinzas foi observada nas pranchas de componentes do acervo, especialmente
menu lateral, botões, tabelas e campos. Os códigos hexadecimais neutros são
amostras dos PNGs dessas pranchas, não um contrato oficial de tokens. Tamanhos,
espaços e raios são propostas para a primeira rodada. A logo pode aparecer de
modo compacto na barra lateral, preservando proporção e cores originais.

## Colors

- **Base visual:** aproximadamente 85% da interface em branco, preto e cinzas.
  Ações principais, inclusive “Criar ficha”, podem ter fundo preto e texto
  branco. Navegação ativa usa contraste neutro claro, peso tipográfico ou um
  pequeno indicador amarelo.
- **Amarelo da marca (`#FEF003`)**: destaque pontual de identidade, até cerca
  de 15% da composição visual; usar com texto preto. Evitar painéis amarelos
  extensos e múltiplos destaques concorrentes.
- **Vermelho da logo (`#EA0B11`)**: preservar na logo original. Fora dela,
  reservar para erro, ação destrutiva, alerta crítico ou saída financeira.
  Não usar para prestigiar a marca, ação primária comum ou navegação ativa.
- **Preto (`#000000`)**: títulos e texto principal; **branco (`#FFFFFF`)**:
  superfícies de trabalho.
- **Canvas (`#F9F9F9`)**, borda (`#E8E8E8`) e texto secundário (`#4B4B4B`):
  neutros amostrados das pranchas de componentes. Outros cinzas do mesmo
  acervo podem ser usados conforme o estado do componente. Não usar os PDFs
  de paletas de cor que foram excluídos da seleção.
- **Gráficos e estados financeiros:** verde pode representar entrada ou
  resultado positivo; vermelho, saída ou queda. Essas cores são semânticas,
  não decoração geral do layout. Rotular séries e valores, além da cor.
- Estados de sucesso e atenção usam cor junto de palavra ou ícone; a cor sozinha
  não deve carregar a informação. Erros precisam de mensagem clara.

## Typography

Usar Inter, família mostrada na prancha de tipografia do acervo. A referência
mostra vários tamanhos; aqui a escala foi reduzida para uma ferramenta desktop
de uso frequente. Título de página 28 px, título de seção 20 px, corpo 14 px,
rótulos 12 px. Números de dinheiro devem ser tabulares ou alinhados à direita
em tabelas. Evitar texto em caixa alta como padrão. Se Inter não estiver
disponível, usar uma fonte de sistema legível, sem depender de download remoto.

## Layout

Navegação lateral fixa à esquerda, conteúdo à direita e cabeçalho compacto.
Seções: **Início, Clientes, Financeiro, Estoque, Notas fiscais**. Um ícone de
notificações pode ficar no cabeçalho. A página deve preservar espaço para
listas e ações; não usar cartões enormes.

Na **Início**, colocar um resumo financeiro de tamanho confortável, mas contido,
com valores **ocultos ao abrir** e botão de olho para revelar. Mostrar apenas
recebimentos, vendas e saídas do dia. O botão **Criar ficha** fica evidente no
canto superior direito. Abaixo, lista de fichas recentes com ID, cliente,
horário, pagamento e ação de abrir a compra. Estoque baixo e contas vencidas
pertencem às seções específicas e às notificações.

Em tabelas, favorecer busca e filtros visíveis, cabeçalhos claros, linhas
legíveis e ações próximas do item. Os estados vazios e de carregamento devem
ocupar o lugar do conteúdo, sem desorganizar o quadro.

## Elevation & Depth

Superfícies brancas sobre canvas levemente diferente; bordas finas separam
áreas. Usar sombra sutil só em modal, menu flutuante e sobreposição. Evitar
sombras pesadas, brilho, vidro fosco e gradientes decorativos.

## Shapes

Cantos levemente arredondados, de 6 a 14 px. Controles compactos, com área
clicável confortável. Badges podem ser arredondados, mas a interface não deve
parecer formada apenas por pílulas. Ícones simples, consistentes e sempre
acompanhados de rótulo quando a ação não for óbvia.

## Components

- **Botões:** primário preto para a ação dominante da tela; amarelo só quando
  um destaque de marca pontual fizer sentido; secundário e discreto
  para ações de apoio; destrutivo separado e rotulado. Mostrar foco de teclado.
- **Busca e filtros:** campo de busca aberto no topo das listas, sem modal
  obrigatório. Filtros visíveis e claramente selecionados.
- **Tabelas e listas:** largura destinada ao conteúdo real; IDs estáveis;
  status em texto; ações por linha. A lista de Clientes pode expandir apenas
  três compras recentes e oferecer “Ver histórico completo”.
- **Formulários:** rótulos acima dos campos, obrigatórios evidentes, grupos
  curtos. Cadastro rápido de cliente dentro da nova venda preserva o progresso.
  Cadastro de produto separa campos principais de complementares e fiscais.
- **Sobreposições:** modal ou painel largo para criar ficha e detalhes rápidos;
  rolagem interna apenas quando inevitável. Um fluxo longo pode usar passos
  claros dentro do mesmo contexto, sem trocar de janela.
- **Resumo financeiro:** valores ocultos por padrão na abertura. O botão de
  olho revela e volta a ocultar sem alterar os dados.
- **Gráficos:** reservados ao Financeiro quando ajudarem a comparar períodos
  ou meios de pagamento; nunca como decoração da página inicial.

## Do's and Don'ts

- Usar as imagens de componentes anexadas como fonte da base visual neutra,
  hierarquia, botões, campos, tabelas, navegação e modais. Adaptar o conteúdo
  ao trabalho da papelaria.
- Usar a logo como referência da marca. As pranchas de cor do acervo original
  foram excluídas por decisão do proprietário; não importar cores delas.
- Manter os valores do resumo da Início ocultos ao abrir, pois clientes podem
  enxergar a tela no balcão.
- Diferenciar ficha de venda, cadastro do cliente e recebimento financeiro.
  Marcar Pix/cartão na ficha não cria uma segunda entrada de dinheiro.
- Mostrar estados de vazio, carregamento, erro e sucesso no protótipo.
- Não colocar alertas de estoque ou contas vencidas como cartões na Início.
- Não inventar emissão fiscal real, integração de maquininha, credenciais ou
  valores de clientes reais nesta primeira rodada visual.
