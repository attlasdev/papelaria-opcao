# Mudanças que afetam a interface

Para o Victor. Cada linha diz o que mudou, onde e por quê. Mudança só interna
(nome de tipo, banco, camada de dados) não entra aqui, a menos que mude como se
escreve uma tela. O detalhe do contrato está em `comum/contrato.ts` e o mapa
tela a tela em `docs/contrato/inventario.md`.

Regra combinada em `2026-10-01`: na tela, mudar o mínimo possível, só o que
acrescenta ou se torna obrigatório, sempre no padrão visual existente (tokens,
componentes, CSS por componente).

---

## Previstas para a 1.0 (contrato por operação)

- **Estados de carregando e de falha em toda tela que lê ou grava.** Com banco, a
  resposta demora e pode falhar; hoje a base local responde na hora e nunca
  falha. Plano: botão desabilitado enquanto espera e mensagem com o componente
  `Aviso`, sem desenho novo.
- **Número da ficha na nova ficha.** Hoje o subtítulo mostra `Ficha #1131` antes de
  concluir. Com duas máquinas, o número só é garantido quando a venda é gravada.
  A tela deixa de mostrar o número durante a venda e ele aparece ao concluir.
- **Comprovante não fiscal na térmica (`2026-10-07`).** A operação já existe:
  `imprimirComprovante(dados)`, com `DadosComprovante` em `comum/contrato.ts`
  (centavos; a tela manda o que foi vendido, o cabeçalho da loja vem da
  configuração da máquina). Nova causa de falha **`impressora`** (desligada,
  fila parada): hoje cai no título genérico de `src/falhas.ts`. No mock, o papel
  aparece no console do navegador. **Falta a tela:** "Imprimir comprovante"
  marcado por padrão ao concluir a venda e "Reimprimir" na ficha (com
  `segundaVia: true`); a venda nunca espera nem depende da impressão.

## Feitas

### `2026-10-29` — Exportação para a Emitte desligada

- **Estoque e Clientes:** saem os botões "Exportar produtos/clientes para a
  Emitte". Os componentes (`ExportarEmitte.tsx`, `ExportarClientesEmitte.tsx`)
  e as chaves de `funcoes.ts` ficam comentados, não apagados. Motivo em
  `Memoria.md`, `2026-10-29`: a Emitte duplica o produto que já existe.

### `2026-10-28` — Cadastro de produto (1.0, tela 2.1)

- **Contrato:** tipos `Produto`, `DadosProduto`, `ConteudoProduto` e
  `UnidadeProduto`; operações `obterProduto`, `buscarProdutoPorCodigoBarras`,
  `listarCategorias`, `cadastrarProduto`, `editarProduto`, `excluirProduto` e
  `ativarProduto`. O produto tem `id` e `codigo` (`EST-0031`, só exibição).
  Vazio é `null`, dinheiro em centavos.
- **Código do produto:** deixa de aparecer antes de salvar (`R-ESTOQUE-08`);
  nasce no banco e a tela mostra depois de gravar.
- **Quantidade inicial pede quem está fazendo** (`R-ESTOQUE-07`): com
  quantidade maior que 0, salvar abre a `JanelaAssinatura`. Excluir produto que
  tem saldo também. Editar, desativar e reativar não pedem.
- **Sai o cadastro rápido** (já oculto): rota de completar, filtro e card "A
  completar", aviso do sino e a prop `naFicha` do `ModalProduto`. O cadastro
  completo aberto pela ficha continua.
- **Mensagens de erro do produto** vêm de `comum/regras/produto.ts`
  (`conferirProduto`), as mesmas do back: a tela aponta o campo antes de mandar.

### `2026-10-28` — Operadores com PIN (1.0, tela 1)

- **Contrato:** tipos `Operador`, `Operadores` e `Assinatura`; operações
  `listarOperadores`, `cadastrarAdministradora`, `cadastrarOperador`,
  `renomearOperador`, `ativarOperador` e `redefinirPin`. As da pessoa recebem a
  assinatura da dona (`{ operadorId, pin }`) e o back confere na mesma chamada.
- **Como chamar na Fase 2:** pelas telas migradas, `api()` de
  `src/dados/api.ts`, não `window.api`: até a Fase 3 elas respondem pela base da
  demonstração.
- **Na tela:** sai o "Operador: ..." fixo da barra lateral; entra a janela
  "Quem está fazendo?" (pessoa e PIN), o cadastro das pessoas com o PIN da dona
  e, na primeira abertura, o cadastro da administradora. Regras em
  `Memoria.md`, "Operadores e login".
- **Barra lateral:** o botão do operador vira "Pessoas" e abre o cadastro. O
  "Restaurar dados de exemplo" (já desligado em `funcoes.ts`) saiu junto.
- **Componentes novos:** `JanelaAssinatura` e `CampoPin`, em
  `src/componentes/assinatura/`; todo gesto que grava usa a janela no fim.

### `2026-10-23` — Tela nova: Boletos

- **Menu:** item "Boletos" abaixo de Serviços (ícone `documento`), rota
  `/boletos` (`rotas.boletos`).
- **Tela** `src/telas/boletos/`: `Boletos.tsx` (resumo, filtros, busca, tabela)
  e `JanelaBoleto.tsx` (cadastrar/editar no `Modal estreito`, excluir com
  segundo clique). Só componentes existentes (`CartaoResumo`, `Filtros`,
  `Tabela`, `SeloCompacto`, `Campo`, `CampoMoeda`, `CampoData`); CSS em `boletos.css`.
- **Sino:** dois tipos novos de aviso, `boleto-vencido` e `boleto-vencendo`,
  com ícone `documento` em `Tela.tsx`.
- "Marcar como pago" ainda usa segundo clique; vai trocar pela confirmação do
  operador quando ela for desenhada.

### `2026-10-23` — Filtros de categoria do Estoque até a metade da linha

- **Estoque:** `.estoque__categorias` ficou com no máximo 50% da linha, à
  direita dos filtros de estado; as categorias que não cabem quebram dentro
  dessa metade. Abaixo de 900px, linha inteira. Pedido da loja: em 720p a lista
  descia e se espalhava por baixo dos filtros de estado.

### `2026-10-23` — Nova ficha numa coluna só

- **Nova ficha:** Valores e Revisão saíram da coluna lateral fixa e foram para
  baixo dos itens, lado a lado (`criar-ficha__fechamento`, duas metades; uma só
  abaixo de 900px). Pedido da loja: no monitor de 1280px a lateral espremia a
  ficha. Sai o `position: sticky`: com muitos itens, rola-se até o Concluir.

### `2026-10-23` — Cadastrar produto pela ficha volta para a ficha

- **Nova ficha:** o link do aviso "sem cadastro" virou "Cadastrar produto" e
  abre a rota nova `/ficha/nova/produto/novo` (`rotas.cadastrarProdutoNaFicha`),
  que mostra a ficha atrás do `ModalProduto`, com o código bipado no campo.
  Cancelar volta à ficha; salvar volta com o produto inserido (quantidade 1),
  passado por `state: { inserir }` da navegação. Texto do aviso: "Cadastre e
  conte o produto antes de vender." (sem "no Estoque").

### `2026-10-23` — NCM e CEST no cadastro de produto

- **Cadastrar/Editar produto:** dois campos opcionais, **NCM** e **CEST**, no fim
  de "Dados complementares", com a ajuda "Anotação para o cadastro na Emitte".
  Mesmo componente `Campo` dos vizinhos; erro de tamanho aparece no próprio
  campo. O resto do bloco "Dados fiscais" continua comentado.

### `2026-10-23` — Correções do piloto (v0.1.8)

- **Registrar entrada:** a quantidade só aceita inteiro (`1.5` vira `1`), como na
  Entrada rápida. Se a base recusar algum item, ele fica na tabela com um aviso
  vermelho acima dos botões, em vez de sumir (`registrar-entrada__recusa`).
- **Cadastrar produto:** sai o campo **"Fornecedor"** de "Dados complementares".
  Ele não era guardado; o fornecedor fica em cada entrada de mercadoria.

### `2026-10-23` — Telas no monitor da loja (1280x720)

O monitor da loja é (provavelmente) 1280x720; a interface foi feita em 1920x1080.
Em 1280, Clientes mostrava **1 cliente por página** (24 páginas).

- **`useLinhasPorPagina` ganhou um mínimo (8 linhas).** Antes ele encolhia a
  tabela até caber sem rolar, e em tela baixa chegava a 1 linha. Agora, se não
  couberem 8, a página rola. Em 1920 continua enchendo até 12. Vale para Início,
  Clientes, detalhe do cliente, Vendas sem identificação, Estoque e Notas fiscais.
- **Tabelas em até 1440 px de largura** (`@media (max-width: 1440px)`): Início,
  Estoque e histórico do detalhe do cliente estreitam as colunas fixas, para
  "Valor"/"Ações" não saírem da tela. Em 1920 nada muda.
- **Início, coluna Pagamento:** rótulo real ("Cartão crédito Mastercard · Mercado
  Pago") passava por cima do valor. A coluna foi de 184 para 320 px e "Cliente"
  ficou fixa em 220 px (em % ela engolia a sobra). Em 1280, o rótulo corta com
  reticências e aparece inteiro na dica.
- **Tela baixa** (`@media (max-height: 800px)`, em `tela.css` e `painel.css`):
  menos espaço em volta do título, cartões de resumo e topo dos painéis mais
  rasos. Em 1080 de altura nada muda.

### `2026-10-20` — Filtros do Estoque

- Filtro novo **"Sem código de barras"** (produtos ativos sem código, mesma
  conta do cartão), no grupo da esquerda: Todos, Estoque baixo, Sem código de
  barras (e Desativados, quando houver).
- **Cadastro rápido oculto até a 1.0** (`funcoes.cadastroRapido`): saem o cartão
  "Cadastro a completar", o filtro "A completar" e o aviso do sino.
- As **categorias** saem do resto da linha e ficam **encostadas à direita**; sem
  espaço ao lado, descem inteiras para a linha de baixo, ainda à direita
  (`estoque.css`).

### `2026-10-19` — Clientes, Financeiro e avisos de nota

- **Detalhe do cliente:** saem os botões **"Extrato"** e **"Exportar"** do
  histórico de compras (não faziam nada; `useSemDestino` saiu da tela).
- **Financeiro:** venda à vista ganha **"Estornar"**, que abre o diálogo de
  cancelar a ficha (`ModalCancelarFicha`, tirado de `BotaoCancelarFicha` em
  `detalhe-ficha/ConteudoFicha.tsx` e usado nos dois lugares). Venda ou
  recebimento desfeito mostra "Estornado", como o lançamento manual. Filtro
  novo **"Estornos"** (só as linhas de estorno). `LinhaFinanceiro` ganha
  `vendaEstornavel`.
- **Sino:** o aviso "rascunhos de nota em revisão" só aparece com
  `funcoes.notasFiscais` ligado.

### `2026-10-19` — Histórico de serviços

- **Tela Serviços:** painel novo **"Serviços feitos"** acima das perdas, com
  cartão (valor e quantidade no período) e tabela Data, Ficha (número clicável;
  "com produtos" embaixo quando a ficha tem produtos), Cliente, Serviço (com a
  observação embaixo), Perdas e Valor. Ficha cancelada não entra.
- O filtro de período saiu do painel de perdas e foi para o lado do título
  (`acoesTitulo`), valendo para os dois painéis. Subtítulo novo.

### `2026-10-19` — Serviços sem cadastro

- **Sai o cadastro de serviços:** a tela **Serviços** fica só com o painel
  **"Perdas anotadas nos serviços"** (subtítulo novo; `JanelaServico.tsx`
  apagado). Saem os cartões por motivo e a coluna Motivo; a coluna **Serviço**
  fica e mostra o nome digitado na ficha.
- **"Inserir serviço" na ficha:** campo **Serviço** em texto livre
  (obrigatório), **Valor cobrado** (obrigatório, sem valor sugerido),
  **Unidades perdidas** (opcional, sem motivo) e **Observação**.
- **Tipos:** `ServicoVenda` vira `{ nome, valor, perdas?: { quantidade },
  observacao? }`; somem `Servico`, `MotivoPerda`, `ROTULO_MOTIVO_PERDA` e
  `base.servicos`. Base gravada no formato antigo abre convertida.

### `2026-10-19` — Serviços

- **Menu:** item **Serviços** abaixo do Estoque (`telas/servicos/`): tabela dos
  serviços cadastrados (código, nome, descrição, valor; editar, desativar,
  reativar) e o painel **"Perdas anotadas nos serviços"** com período (últimos
  7 dias, este mês, mês passado), cartões por motivo e a lista, com a ficha
  clicável.
- **Nova ficha:** botão **"Inserir serviço"** ao lado de "Inserir item"; abre
  `criar-ficha/servicos/JanelaServicoFicha.tsx` (serviço, valor cobrado,
  perdas + motivo, observação). Os serviços aparecem numa tabela abaixo dos
  produtos, com editar e tirar. Ficha só de serviço esconde o "Nenhum item
  ainda". A revisão conta os serviços.
- **Detalhe da ficha:** os serviços entram na tabela ("Produto ou serviço"), com
  perdas e observação na linha de baixo.
- **Comprovante (quando a tela dele existir):** serviço vai como item de
  quantidade 1 e preço = valor cobrado.

### `2026-10-19` — Cadastro de cliente sem o bloco "Para nota fiscal"

- O bloco **"Para nota fiscal"** (tipo de contribuinte, tipo de cliente,
  inscrição estadual) **saiu da tela** do cadastro de cliente. Liga e desliga em
  `src/funcoes.ts` (`dadosFiscaisCliente`). Oculto, salvar mantém o que o
  cliente já tinha nesses campos. **CEP e Complemento continuam** no endereço.

### `2026-10-07` — Financeiro: "Exportar período" funciona; atalho "Mês passado"

- **"Exportar período"** (ao lado do título) agora gera uma **planilha .xlsx** do
  período consultado e abre a janela do sistema para salvar
  (`financeiro/ExportarPeriodo.tsx`). Abas **Resumo** (cartões, totais por meio
  e por categoria), **Por dia** (por mês acima de 92 dias, com barras) e
  **Movimentos** (uma linha por registro, com filtro). Cores dos tokens do app;
  totais com fórmula. Vai o **período
  inteiro, em todos os meios**, mesmo com a tabela filtrada; adições e
  retiradas da gaveta não vão. Desabilitado com período inválido ou sem
  movimentação; "Gerando…" enquanto prepara; janela com o resultado ou o erro.
- **Atalho "Mês passado"** entre "Este mês" e "Este ano": do dia 1 ao último dia
  do mês anterior, o fechamento que vai ao contador.

### `2026-10-06` — Maquininha Mercado Pago na nova ficha (demonstração)

- **Forma de pagamento:** Cartão ganhou **Crédito/Débito** e **Mercado
  Pago/Sicoob**; Pix ganhou **QR na maquininha/Pix manual**, com uma nota curta
  explicando cada caminho.
- **Mercado Pago** (cartão ou Pix na maquininha): "Concluir" abre a **janela de
  cobrança** (`criar-ficha/cobranca/JanelaCobranca.tsx`) com as etapas; ao
  aprovar, a venda se registra sozinha. Recusa mostra o motivo, com "Tentar de
  novo" e "Usar outra forma". O subtítulo avisa que é demonstração e há um
  "Simular recusa" discreto.
- **Sicoob** e **Pix manual**: como antes.
- O rótulo do pagamento (ficha, Início, Financeiro) diz por onde passou:
  "Cartão crédito Visa · Mercado Pago", "Cartão débito · Sicoob", "Pix manual".

### `2026-10-06` — Exportação para a Emitte: cada item vai uma vez

- **Estoque** e **Clientes**: os botões mostram quantos itens **novos** vão
  ("Exportar 3 produtos novos para a Emitte"); quem já foi não vai de novo (a
  Emitte duplicaria). Os produtos agora saem em **planilha**, não XML.
- Depois de salvar, a janela pergunta **"Já importei na Emitte"** / **"Ainda não
  importei"**; só a confirmação marca os itens como enviados.
- Clientes com rua sem tipo que a Emitte conheça (Praça, Alameda…) ficam de
  fora, com o motivo na janela.
- Ligado só em desenvolvimento por enquanto; no instalador, desabilitado.

### `2026-10-06` — Exportar clientes para a Emitte (desligado)

- **Clientes** ganhou o botão **"Exportar clientes para a Emitte"** ao lado do
  título, **desabilitado** no piloto ("Indisponível no período de teste") até a
  importação ser testada. Ligado, ele gera a planilha no modelo da Emitte e uma
  janela lista quem ficou de fora e o que falta.
- O bloco **"Para nota fiscal"** do cadastro de cliente **continua**: tipo de
  contribuinte e tipo de cliente são obrigatórios na planilha da Emitte.

### `2026-10-06` — Notas fiscais oculta; exportação no Estoque

- O botão **"Exportar produtos para a Emitte"** mudou para o **Estoque**, ao lado
  de "Registrar entrada" (continua desabilitado no piloto).
- A área de **Notas fiscais saiu do menu**, e a nova ficha não mostra mais
  "Preparar rascunho de nota fiscal para revisão": a loja emite pela Emitte. As
  telas e rotas continuam no código; liga e desliga em `src/funcoes.ts`.

### `2026-10-06` — Exportar produtos para a Emitte; dados fiscais fora do cadastro

- **Notas fiscais** ganhou o botão **"Exportar produtos para a Emitte"** no
  cabeçalho: gera o XML de produtos e abre a janela do sistema para salvar; ao
  fim, uma janela diz quantos produtos foram e o que completar na Emitte.
  **No piloto ele aparece desabilitado** ("Indisponível no período de teste"):
  reimportar na Emitte duplicava os produtos.
- A seção **"Dados fiscais" saiu do cadastro de produto** (decisão do
  Agostinho: a dona preenche isso na Emitte). O código está comentado em
  `CadastrarProduto.tsx`. O bloco "Para nota fiscal" do cliente continua.

### `2026-10-06` — Campos fiscais no cadastro (preparo para a Emitte)

- **Produto** ganhou a seção **"Dados fiscais"** (fora do cadastro rápido da
  ficha): tributação, origem, NCM, CEST e CFOP dentro/fora do estado. Vem
  preenchida com o padrão (Simples 102, origem 0, 5102/6102); NCM e CEST ficam
  em branco até o contador definir. Formato conferido ao salvar.
- Código de barras que não é GTIN válido **não bloqueia** o cadastro: aparece um
  lembrete de que na nota ele vai como "SEM GTIN".
- **Cliente** ganhou **Complemento** e **CEP** no endereço, e o bloco **"Para nota
  fiscal"** (tipo de contribuinte, tipo de cliente, inscrição estadual).
- Ainda **sem exportação** para a Emitte; regras em `src/dados/fiscal.ts`.

### `2026-10-06` — Piloto 0.1: dados no Supabase

- **Tela de login** (`src/telas/entrar/`): aparece antes da loja abrir, na primeira
  vez e se a sessão vencer. A mesma tela mostra "Carregando os dados da loja…" e,
  se o app não conseguir abrir, o motivo com "Tentar de novo".
- **Indicador de gravação** no rodapé da barra lateral, abaixo do operador:
  "Salvo às 14:10", "Salvando…", "Sem conexão" (vermelho; os dados ficam no
  computador e sobem quando a internet volta) ou "Não salvo" (conflito). Na
  barra recolhida, só o ícone.
- **"Restaurar dados de exemplo"** está **desligado em todo lugar**, inclusive
  em `npm run dev` (`funcoes.restaurarExemplo` em `src/funcoes.ts`): com o app
  ligado a um banco, a amostra ia para o banco por cima dos dados. Clicar no
  operador não faz nada. No navegador, a amostra continua vindo do mock na
  primeira abertura.
- **A loja começa vazia** no app instalado. No navegador (mock), a amostra de 90
  dias continua igual para o trabalho nas telas.
- Para o código das telas: `useEstadoDemonstracao()` e as funções de gravação
  continuam iguais. Nada nas telas precisou mudar além da barra lateral.
- **No navegador, a primeira abertura depois desta versão volta à amostra de 90
  dias**: a cópia guardada antes da sincronia existir não é reaproveitada (ela é
  sempre a demonstração antiga, e no app instalado subiria como se fosse a loja).
  Daí em diante, o que se fizer no navegador fica guardado como antes.
