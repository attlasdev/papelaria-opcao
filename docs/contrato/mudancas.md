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
- **Código do produto no cadastro.** Mesmo caso: o próximo `EST-` deixa de aparecer
  antes de salvar e é mostrado depois de gravar.

## Feitas

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
