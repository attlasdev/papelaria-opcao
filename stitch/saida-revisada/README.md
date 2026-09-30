> **Histórico.** Estas telas já foram migradas para o aplicativo em `src/telas/`
> (ver `Memoria.md`, 2026-09-23). Elas ficam aqui só como referência; alterações
> novas vão no React, não aqui.

# Telas revisadas do Stitch

Os nove `index.html` desta pasta são cópias revisadas da exportação do Stitch.
Abra qualquer arquivo no navegador para comparar o conteúdo. O ZIP original
permanece intacto. `stitch/revisar_saida.py` reproduz as alterações a partir do
arquivo entregue pelo usuário.

Esta rodada valida **escopo, nomes, dados de exemplo e relações entre telas**.
Não é a implementação React, não define o contrato IPC e não comprova que os
botões, atalhos ou integrações funcionem.

## Segunda rodada — apresentação

- O SVG original da Papelaria Opção aparece sem moldura no bloco de marca das
  telas. Os símbolos alternativos produzidos pelo Stitch foram substituídos.
- A navegação ativa usa cinza claro com indicador escuro; “Criar ficha” na barra
  lateral usa preto. O amarelo intenso fica apenas no desenho da marca.
- Badges e botões de pagamento usam largura adequada ao texto. Tabelas largas
  rolam horizontalmente quando a janela é estreita.
- O cabeçalho de cadastro de produto não repete os botões do rodapé. A entrada
  de mercadorias, a venda, o detalhe do cliente e o Financeiro reorganizam seus
  grupos na largura mínima de 900 px.

Os ajustes compartilhados ficam em `ajustes.css` e são aplicados por
`stitch/revisar_saida.py` a todas as telas geradas.

## Navegação entre telas

As nove telas estão ligadas por clique. O mapa fica em `LIGACOES` e `MENU`, em
`stitch/revisar_saida.py`; `navegacao.js` segue os links e, num controle ainda
sem destino, mostra o aviso "Sem destino neste protótipo" em vez de não fazer
nada. Controles com comportamento próprio da tela (mostrar valores, gaveta de
cliente, meios de pagamento) não são afetados. Ao rodar o script, ele lista no
terminal os controles sem destino de cada tela. Os dados continuam fictícios e
podem divergir entre telas.

| Tela | Critério do projeto aplicado |
| --- | --- |
| Início | Resumo e fichas recentes; valores mascarados; venda vinculada a cliente; sem alerta de estoque ou contas vencidas. IDs e valores das fichas principais foram alinhados aos exemplos das outras telas. |
| Criar ficha | Cliente cadastrado dentro do fluxo, itens, pagamento em dinheiro/Pix/cartão ou futuro, revisão e opção de preparar rascunho fiscal. Limite de crédito não definido foi retirado. |
| Clientes | Lista alfabética, busca, filtros por situação das compras, ID estável e até três compras na expansão. Termos de convênio foram retirados. |
| Detalhe do cliente | Histórico de fichas e seus estados. O bloco de limite de crédito e o painel de convênio foram retirados. |
| Financeiro | Dia/Semana/Mês/Ano, meios de pagamento e movimentos. Valor da ficha #1043 foi alinhado à venda; exportação segue como ação a definir. |
| Estoque | Catálogo, saldos, busca, alerta de estoque baixo, cadastro, entrada e ajuste. O cartão de valor financeiro do estoque foi retirado. |
| Cadastrar produto | Nome, categoria, unidade base, preço e quantidade inicial como núcleo; dados complementares opcionais. Margem automática, geração de EAN e tributação presumida foram retiradas. |
| Registrar entrada | Lista com múltiplos itens e saldo projetado; fornecedor e referência opcionais; ajuste de contagem separado. |
| Notas fiscais | Somente Entradas, Saídas e rascunho em revisão. Emissão, autorização, XML, contingência e transmissão foram retirados, pois dependem de definições e integração futuras. |

As datas, nomes e valores continuam fictícios. O texto “Protótipo local” indica
isso nos pontos em que a exportação original anunciava sincronização ou loja
online. Nenhuma dessas telas representa estado real do aplicativo ou da SEFAZ.
