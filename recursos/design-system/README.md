# Referência visual de componentes

Material recebido no ZIP `Comprehensive Design System for Dashboard, Landing Pages,
CRM, and Various Apps (Community).zip`. Foram mantidas **14 pranchas**. Cada pasta
contém o PDF original, `visao-geral.png`, `texto-extraido.txt` e uma ficha de
consulta. O PDF e a imagem preservam a aparência; o texto extraído ajuda na busca,
mas pode ter espaços indevidos por causa da exportação.

Este é o **repertório visual canônico de referência** para a interface desktop.
As pranchas são exemplos, não componentes React executáveis. Ao implementar uma
tela, consultar a ficha e a imagem da família pertinente, adequar o conteúdo ao
domínio real e conferir os estados de carregamento e falha já exigidos pelo projeto.

## Índice

| Família | Componentes |
| --- | --- |
| Fundamentos | [Tipografia](componentes/fundamentos/tipografia/ficha.md) |
| Controles | [Botões](componentes/controles/botoes/ficha.md) · [Campos de texto](componentes/controles/campos-de-texto/ficha.md) · [Seletores](componentes/controles/seletores/ficha.md) · [Controles pequenos](componentes/controles/controles-pequenos/ficha.md) |
| Navegação | [Menu lateral](componentes/navegacao/menu-lateral/ficha.md) · [Cabeçalho](componentes/navegacao/cabecalho/ficha.md) |
| Dados e telas | [Cartões](componentes/dados/cartoes/ficha.md) · [Tabelas](componentes/dados/tabelas/ficha.md) · [Dashboard](componentes/dados/dashboard/ficha.md) · [Calendário](componentes/dados/calendario/ficha.md) · [E-mails](componentes/dados/emails/ficha.md) |
| Sobreposições | [Modais](componentes/sobreposicoes/modais/ficha.md) |
| Iconografia | [Biblioteca de ícones](componentes/icones/biblioteca/ficha.md) |

## Limites do material

- `Global Colors.pdf` e `Color Tokens.pdf` foram excluídos desta referência a
  pedido do usuário. As cores de exemplo nas demais pranchas mostram contraste,
  hierarquia e estado; **não definem a paleta da Papelaria Opção**.
- Não há prancha de escala de espaçamento, raio, borda ou altura de controles.
  Essas medidas devem ser conferidas visualmente e definidas ao implementar o
  sistema no aplicativo; não há valor numérico canônico para elas neste acervo.
- A tipografia nomeia Inter e seus tamanhos/pesos, mas não inclui arquivos de
  fonte nem especifica line-height ou letter-spacing.
- O PDF de ícones mostra uma biblioteca extensa em grade, sem nomes individuais
  nem arquivos SVG separados. Consulte a prancha como referência; não assuma
  que os ícones já são assets importáveis.
