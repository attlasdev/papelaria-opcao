# Memoria — papelaria-opcao

Estado vivo do projeto: o PORQUE das decisoes, o que esta em aberto, o que
aprendemos. O que o codigo faz esta no codigo e no git.

---

## Análise de função e correções — `2026-09-30` (ler primeiro)

Análise do app como se estivesse em produção (Notas fiscais e impressão fora).
Victor aprovou corrigir os furos achados; feito, testado no navegador, `npm test`
(54) e build passam. Commitado em 2026-09-30.

**Feito:**
- **Ficha em andamento se guarda sozinha** (`CriarFicha`, efeito que grava o
  rascunho a cada mudança). Sair pelo menu, busca ou sino não perde a venda; o
  Início oferece "Retomar ficha". Saiu o botão "Salvar rascunho" (redundante).
- **Limpar ficha limpa tudo**, inclusive cliente e forma de pagamento (antes a
  próxima venda herdava o cliente e a Notinha).
- **Quantidade digitável** na ficha, além do + e −.
- **Aviso de dívida no bloco Cliente da ficha:** "R$ X em atraso (N notinhas)"
  em vermelho, ou "R$ X em aberto" em laranja. Só avisa; não bloqueia.
- **Desfazer sem apagar, um padrão só** (`ModalMotivo`, motivo obrigatório):
  - *Cancelar ficha* (página e janela): estoque volta (movimento "Cancelamento"),
    o que foi pago sai do Financeiro **no dia do cancelamento** (dias passados não
    mudam), a ficha fica no histórico marcada "Cancelada" e sai das compras do
    cliente, das vendas do dia e da cobrança. Permitido em qualquer data.
  - *Estornar recebimento de notinha* (link na lista de pagamentos): o pagamento
    fica riscado com o motivo e a notinha volta a dever.
  - *Estornar lançamento manual* (coluna Ações do Financeiro): entra um lançamento
    de sinal contrário; o original fica marcado "Estornado".
  - No Financeiro, **estorno abate do próprio lado** (desfazer venda reduz
    Entradas, desfazer despesa reduz Saídas) e aparece com selo "Estorno".
- **Anotação na notinha** (página e janela): só se acrescenta, com data. O
  vencimento **não muda** (decisão do Victor): a anotação lembra o combinado, a
  notinha continua vencida.
- **"vs ontem" compara até a mesma hora** (e semana/mês/ano até o mesmo ponto).
- **Saldo informado no Cadastrar produto vira entrada** "Saldo inicial do
  cadastro"; esse movimento sozinho não impede excluir cadastro feito por engano.

**Ajustes lógicos (mesma data, pedido do Victor: "tem que funcionar"):**
- Nova ficha: desconto maior que o subtotal bloqueia (aviso na hora, ao lado do
  total); vencimento da notinha antes de hoje bloqueia; plurais ("1 unidade");
  Revisão só mostra troco quando há valor recebido; rascunho não traz de volta
  produto desativado depois.
- Receber notinha: data do pagamento entre a notinha mais antiga marcada e hoje.
- Produto desativado: sai da busca da entrada e do ajuste; bipado ou digitado na
  entrada, avisa "está desativado" (antes podia virar produto novo com código repetido).
- Cadastro rápido: sai do Ajustar estoque (ícone some da linha); a contagem é pelo
  Completar, que tira a marca. Antes o ajuste contava mas deixava "Sem contagem".

**PENDENTE (em aberto, não feito):**

*Decidir com a dona:*
1. Cancelar ficha: hoje liberado em qualquer data. Limitar a "só no mesmo dia"?
2. Devolução parcial de itens: hoje só cancela a ficha inteira.
3. Venda com saldo zerado no sistema: hoje passa, o saldo para em zero e o
   movimento avisa. Passar, pedir confirmação ou bloquear?
4. "Retirada do caixa" (levar ao cofre) ainda conta como saída no líquido do
   Financeiro. Separar ou não?
5. Custo por lote na entrada de mercadorias (proposta na seção de 2026-09-29).
6. Pix e cartão em produção: de onde vem o registro (maquininha, banco ou
   lançamento manual), incluindo crédito/débito e parcelas, que a venda hoje não
   registra (a amostra tem "Cartão crédito (2x)").

*Decidir com o Victor (adiado):*
7. Regras de CPF e aviso de nome repetido no cadastro de cliente.

*Testar:*
8. Leitor de código físico no Electron.
9. Esta versão no Electron (tudo foi testado no navegador).

---

## Nova ficha de venda — leitura e produto não cadastrado (`2026-09-30`)

O ícone de código de barras na ficha ativa leitura contínua para bipar vários
produtos. Cada leitura procura código exato: produto conhecido entra na ficha (ou
soma uma unidade); código desconhecido mostra aviso sem incluir item. Esc ou sair
do campo encerra a leitura. O modo de leitura tem a animação discreta do ícone.

Para um código desconhecido, a ficha diz "Código … sem cadastro" e oferece **Fazer
cadastro rápido**: modal sobre a própria venda (não navega, para não perder a venda),
pedindo nome, categoria, unidade, preço e **quantidade na ficha**. O produto nasce
com saldo 0 e marcado `cadastroRapido`.

---

## Check-up geral de fluxo e textos — decisões de `2026-09-30`

- **Ficha sempre em janela** (`useAbrirFicha`, em `telas/detalhe-ficha/AbrirFicha.tsx`):
  qualquer "Ver ficha"/"Ficha #…" abre por cima da tela; fechar devolve filtro,
  página e rolagem. Motivo: a página da ficha voltava sempre ao Início (vindo do
  Financeiro, perdia o período). Ficha = uma venda → janela basta; **cliente** =
  várias fichas → página inteira. A página `/fichas/:id` fica só para depois de
  concluir a venda; a janela não tem mais "Abrir página da ficha".
- Modal empilha: Esc fecha só a janela de cima (ficha sobre a gaveta de Movimentações).
- Sino e busca de cliente da ficha fecham com clique fora e Esc; busca de cliente
  ignora acento e acha pelos dígitos do documento.
- "Inserir item" na ficha: campo vazio avisa; vários resultados pedem escolha
  (antes inseria o primeiro às cegas).
- Registrar movimento virou gaveta; saída separa **Despesa** de **Retirada do
  caixa** (só categoria; o líquido ainda conta a retirada como saída — em aberto).
- Busca do topo com um texto só ("Buscar cliente, ficha ou produto...").
- Vendas sem identificação: card e página no mesmo período (hoje).
- Textos de apoio enxugados; `text-wrap: pretty` em `p` e ajuda de campo.

**Fora por decisão do Victor:** impressão, exportação e Notas fiscais (dependem do
programa fiscal terceirizado; os botões seguem "Ainda sem destino").

---

## Cadastro rápido, edição e entrada rápida — decisões de `2026-09-30`

- **Cadastro rápido fica pendente até ser completado.** A venda nunca trava, mas o
  produto fica marcado: card "Cadastro a completar", aba fixa "A completar" no
  Estoque, etiqueta na linha, selo "Sem contagem" e aviso no sino. O botão
  "Completar" abre o cadastro inteiro e **exige a contagem da prateleira**, que entra
  como Ajuste. Sem contagem, o saldo dele não é falta: fica fora de zerado/baixo.
- **Marca explícita, não dedução:** custo vazio ou mínimo 0 também existem em
  produto completo; por isso o flag `cadastroRapido`.
- **Editar produto:** lápis na linha. Não mexe no saldo — saldo só muda por entrada
  ou ajuste, para o histórico bater.
- **Excluir x desativar:** apagar só produto sem venda/movimentação/ficha em
  andamento (cadastro por engano). Com histórico, **desativar** (`inativo`): some da
  venda, das contas e dos avisos; aba "Desativados" para reativar. Bipado na ficha,
  avisa que está desativado em vez de oferecer cadastro novo.
- **"+ Entrada" da linha = gaveta Entrada rápida** (um produto: quantidade, custo,
  fornecedor). Entrega com vários itens continua na página "Registrar entrada";
  a gaveta tem link para ela.

**Em aberto:**
- O custo informado na entrada (rápida ou completa) fica só no motivo do movimento;
  **não altera o custo do cadastro**. Depende da decisão com a dona (item do custo
  na entrada, abaixo).
- Registrar entrada e Ajustar estoque ainda listam produtos desativados.
- Botões "+ Entrada" pretos em estoque baixo pesam a coluna; Victor pediu manter
  por enquanto.
- Falta testar a ficha com o leitor físico no Electron.

---

## Próxima sessão — tarefas anotadas em `2026-09-29` (ler primeiro)

Victor encerrou o dia. Começar por aqui:

1. **Bipe na tela "Cadastrar produto" avulsa** (botão do topo do Estoque, janela
   própria, fora da entrada). Definir o comportamento:
   - bipar com o cursor em qualquer campo deve preencher o "Código de barras" (hoje
     o `useLeitorCodigo` só está ligado na entrada);
   - código já cadastrado: avisar e oferecer abrir o produto existente, em vez de
     deixar duplicar;
   - bipar de novo com a janela aberta: trocar o código ou ignorar? Decidir.
2. **Dados já preenchidos na janela Cadastrar produto:** no print dela aberta pelo
   topo do Estoque, apareceram nome "Caderno Espiral Tilibra…", preço 24,90, custo
   15,56, "Prateleira B-03, gaveta 2", quantidade 50 e mínimo 15. Conferir se são
   valores de exemplo esquecidos (cadastro novo deveria abrir vazio) ou só
   placeholders.
3. **Custo que muda no lote do fornecedor** (pedido do Victor). Produto chega mais
   barato ou mais caro que o custo cadastrado: como registrar por cima na entrada.
   Ideia de partida: o "Custo unit." da tabela da entrada vira editável, vindo
   preenchido com o custo do cadastro. A decidir (com a dona, se preciso):
   - o custo novo substitui o do cadastro, ou fica só nesta entrada?
   - vale o último custo ou uma média com o estoque que já havia?
   - custo mudou: avisar para rever o preço de venda, ou não mexer?
   **Proposta do Victor (2026-09-29):** a dona precisa enxergar o custo de cada
   lote para decidir preço e desconto (lote mais caro: quem paga é o cliente; mais
   barato: ela dificilmente baixa o preço). Ele sugeriu cadastrar o mesmo produto
   duas vezes, um por lote. **Criticado:** mesmo código de barras não diz de qual
   lote é na venda, e o saldo fica partido (estoque baixo erra). **Alternativa
   combinada para levar à dona:** um produto só; cada entrada guarda o custo do
   lote; o produto mostra "10 un a R$ 8,00 (lote 03/09) · 30 un a R$ 10,00 (lote
   29/09)"; a venda consome o lote mais antigo primeiro. É a parte mais cara de
   fazer do estoque: confirmar com ela se usaria, ou se o último custo basta.
   Relacionado: não pôr botão "ver cadastro" nos bipados (conversado em
   2026-09-29: desvio no meio da conferência); o ajuste de custo fica na tabela.

4. **Tudo gravando de verdade, para teste prático** (pedido do Victor). Ele vai
   usar o app como a dona: cadastrar cliente, fazer fichas, criar categoria e
   produto, dar entrada, conferir o Financeiro. Tudo tem que ficar na base local
   (`src/mock/base/`, localStorage) e aparecer igual em todas as telas. Fazer:
   - varrer telas e formulários atrás do que ainda não grava ou vem de exemplo
     fixo: os cinco `dados-exemplo.ts` restantes (cadastrar-produto, criar-ficha,
     estoque, notas-fiscais, registrar-entrada) e valores já preenchidos em
     formulário (ver tarefa 2);
   - já achado: **categoria nova** criada no `CampoCategoria` vive só no estado do
     componente e some ao fechar; tem que ir para a base;
   - trocar valores preenchidos por placeholders ("Ex.: …") onde o campo deve
     abrir vazio;
   - roteiro de teste de ponta a ponta: cliente novo → ficha (à vista e notinha)
     → Financeiro bate → estoque baixa → entrada repõe → categoria e produto novos
     aparecem nas listas e na busca.

## Em andamento — `2026-09-29`: leitor de código na entrada de mercadorias

Sessão anterior foi resetada sem registro; isto foi reconstruído do código.

- `src/leitor/`: `detector.ts` (+ teste) separa leitura do leitor de digitação pela
  velocidade das teclas; `useLeitorCodigo` escuta a tela toda e desfaz no campo em
  foco o que o leitor digitou; `PainelLeitor` é o visor "Pronto para ler" (laser,
  última leitura, Parar/Esc) que toma o lugar da busca enquanto lê.
- Registrar entrada: cada bipe vai para o bloco **"Bipados"**
  (`registrar-entrada/bipados/BlocoBipados.tsx`). Bipar de novo não duplica, sobe a
  linha. Produto cadastrado: pede só quantidade (unidade fixa). Produto novo: nome,
  unidade (Unidade/Pacote/Caixa), quantidade e **Completar cadastro** (mesmo
  formulário do Estoque, `ModalProduto`), sem o qual não vai para a tabela.
  "Lançar prontos" move para a tabela; Confirmar entrada fica bloqueado enquanto
  houver bipados. Produto novo só é gravado ao confirmar.
- Textos enxugados (pedido do Victor, cada informação uma vez): cabeçalho só
  "Bipados · N"; o leitor mostra "Produto novo · código", sem instrução; saiu o
  "N lidos". O que falta fica só na linha (selo "Novo" + "Falta o nome").
- O aviso "Lance ou tire da lista antes de confirmar a entrada" saiu do rodapé
  (ficava colado no Cancelar) e foi para o cabeçalho dos bipados; o Confirmar
  bloqueado mostra a mesma frase como dica ao passar o mouse.
- Na tabela da entrada, produto novo não fica vermelho nem "Zerado": saldo atual
  "—" (nunca teve estoque; vermelho sugeria que já existia). Produto já
  cadastrado e zerado continua vermelho, por decisão do Victor.
- Pelo botão do topo do Estoque a entrada abre vazia; pela linha de um produto,
  já com ele.

## Estado atual — `2026-09-25`

**Fechamento do dia 2026-09-25 (ler primeiro).** Sessão encerrada pelo Victor. O
app roda com a **base local única** (`src/mock/base/`, localStorage): todas as
telas leem dela, e o que é situação ou total é calculado. Feito hoje, na ordem:
venda sem identificação; cadastro de cliente em janela na ficha (depois unificado
com Clientes em `JanelaCliente`, gaveta lateral); coluna direita da ficha sem
rolagem; notinha com vencimento, entrada, pagamento parcial e recebimento de
várias; baixa de estoque na venda; base sincronizada (plano em
`docs/superpowers/plans/2026-09-25-base-local-sincronizada.md`, executado); sino
com tipos, ícones e "marcar como lidas"; selos sem vazar; ficha em janela no
Início; ícones soltos na ficha e no cadastro do cliente (3 ícones novos do
acervo); recebimento de notinhas com a escolha dentro da janela e aviso de outras
notinhas na ficha pendente; Ajustar estoque em gaveta; ajustes de layout no
Estoque e em "Criar ficha". `npm test` (34), `tsc` e build passam.

**Pendências para a próxima sessão:**
1. **Pix e cartão em produção** — de onde vem o registro (API da maquininha/banco
   ou lançamento manual). Depende da conversa do Victor com a dona. Na base local,
   todo pagamento registrado na ficha já entra no Financeiro.
2. **Venda com saldo zerado no sistema** — hoje passa, o saldo para em zero e o
   movimento avisa. Bloquear ou pedir confirmação é decisão do Victor/dona.
3. **Painel "Cadastro" do detalhe do cliente** estica até a altura dos três
   cartões e sobra espaço vazio embaixo; reorganizar o topo (não virar gaveta).
4. **Revisão da nova ficha** repete o total do painel Valores; pode enxugar.
5. **Barra de menu do Electron** (File/Edit/View/Window): o Victor decidiu deixar
   como está por enquanto.
6. Seguem valendo os próximos passos do fim deste arquivo (contrato em PR próprio,
   primeiro commit, banco de teste).

**Aviso sobre as notas abaixo:** as entradas de 2026-09-24 e anteriores descrevem
a fase de dados de exemplo por tela. Números como "148 clientes", "1.420
produtos", "40 fichas de 24/10/2024", "seis itens fictícios" na entrada de
mercadorias e "estado restrito à sessão" **não valem mais**: a base local
substituiu tudo isso. Ficam como histórico do porquê de cada tela.

**Cliente: um formulário só, em gaveta (2026-09-25):** "Cadastrar cliente" e "Editar dados" deixaram de ser página inteira (cinco campos numa tela vazia) e abrem como gaveta lateral por cima da lista (`/clientes/novo`) ou do detalhe (`/clientes/:id/editar`), rotas filhas com `Outlet`, como Ajustar estoque. O formulário é um componente só (`formulario-cliente/JanelaCliente.tsx`), usado também em janela central na nova ficha: nome obrigatório; documento, celular e e-mail opcionais; endereço em rua, número, bairro e cidade/UF, gravado como "Rua, nº - Bairro - Cidade/UF" e separado de volta na edição (sem bairro, a parte com "/UF" é a cidade). Documento repetido é barrado nos dois lugares. Antes, a página exigia CPF e telefone e só mostrava endereço na edição. A barra de menu do Electron fica como está, por decisão do Victor.

**Receber notinhas: a escolha fica na janela (2026-09-25):** saiu a caixa de seleção do histórico do cliente (obrigava a garimpar notinhas entre páginas e compras pagas) e o botão que mudava de sentido ("Receber em aberto" / "Receber N selecionadas"). Agora a janela Receber notinhas **sempre lista todas as notinhas abertas do cliente**, cada uma com caixa; marcar ou desmarcar leva o valor a pagar ao total marcado. Entradas: botão fixo "Receber notinhas (N)" e o cartão "Notinhas em aberto" do detalhe (todas marcadas); "Receber" da linha ou da ficha (só aquela marcada, as outras visíveis como "Ainda pendente"). A prévia usa futuro — "Será quitada", "Ficará R$ X em aberto" — porque nada muda antes de confirmar. Ficha pendente (página e janela do Início) mostra faixa "Fulano tem mais N notinhas em aberto · R$ X. Total devido: R$ Y" com "Receber todas" — laranja, ou vermelha se alguma outra estiver em atraso. Proposta do Victor de "juntar notinhas" foi atendida sem fundir fichas: juntar é marcar mais caixas na mesma janela; fundir apagaria o histórico separado, decidido antes.

**Ficha em janela no Início (2026-09-25):** no histórico do Início, clicar na linha (ou no ícone de abrir) abre a ficha numa janela central (`detalhe-ficha/JanelaFicha.tsx`), sem sair da lista: dados em uma linha, itens, pagamentos e total; rodapé com Imprimir 2ª via, Abrir página da ficha e Receber notinha (quando há valor em aberto — a janela de recebimento substitui a da ficha e volta a ela ao fechar, para não empilhar duas janelas no mesmo Esc). Link do cliente e botões da linha mantêm a própria ação. Clientes, busca, Financeiro e sino continuam abrindo a página `/fichas/:id`. Página e janela usam os mesmos blocos de `detalhe-ficha/ConteudoFicha.tsx`. Ícones soltos, sem fundo (pedido do Victor), em cinza suave: pessoa (cliente), calendário (data), meio de pagamento (pagamento e cada linha de pagamento), relógio (vencimento), pacote (itens), dinheiro (pagamentos), recibo (total), info (dados, na página). A caixa do total na janela tem borda tracejada. O mesmo padrão foi para o Cadastro do detalhe do cliente (pessoa, documento, telefone, e-mail, endereço); o formulário Ajustar estoque ficou sem ícones de propósito (formulário curto, a lupa do campo basta). Critério registrado no `AGENTS.md`.

**Base local sincronizada (2026-09-25):** todas as telas leem **uma base só**, em `src/mock/base/`, gravada no `localStorage` (chave `papelaria-opcao:base`). Os nove `dados-exemplo.ts` independentes saíram; os que sobraram guardam só constantes de tela (grupos, categorias, unidades, tipos da ficha, documento de fornecedor, custo sugerido). A base guarda **fatos** (clientes, produtos, fichas com itens e pagamentos, lançamentos manuais do caixa, movimentos do estoque, rascunhos de nota, avisos lidos); situação de notinha e de cliente, totais, resumo do dia, entradas do Financeiro, contagens, busca e sino são **calculados** em `derivados.ts`, então não há cópia para divergir. A semente (`semente.ts`) gera 24 clientes, 16 produtos e cerca de 430 fichas em 90 dias **até hoje**, com cenários fixos: Mariana (notinha a vencer em 12 dias com entrada de R$ 50), Colégio Monteiro Lobato (a vencer), Carlos Eduardo e Associação Girassol (em atraso), Ana Beatriz (sempre em dia). O saldo de cada produto encadeia com os movimentos até o valor atual. "Restaurar dados de exemplo" fica no botão do operador (rodapé da barra lateral) e refaz a amostra para a data do dia. Testes: `npm test` (Vitest, 34 testes da camada de dados). Plano executado: `docs/superpowers/plans/2026-09-25-base-local-sincronizada.md`.
- *Financeiro:* Dia, Semana, Mês e Ano funcionam com datas reais; cada pagamento de ficha (venda à vista, entrada ou recebimento de notinha, **em qualquer meio**) vira uma entrada, e o lançamento manual também. Isso substitui a regra "Pix e cartão ficam só na ficha" da rodada anterior (ver pergunta em aberto: continua em aberto *de onde* esse registro virá em produção).
- *Sino:* avisos com ícone por tipo — notinha em atraso (alerta, vermelho), notinha que vence em até 3 dias (relógio, laranja), produto zerado (pacote, vermelho), estoque baixo (pacote, laranja), rascunho de nota (nota, neutro) —, do mais grave ao menos grave, com divisórias. "Marcar todas como lidas" e clicar num aviso o marcam como lido; o número do sino conta só os novos; lidos ficam apagados no fim da lista até a pendência sumir, e voltam a ser novos se o texto mudar (valor ou quantidade).
- *Nova ficha* abre vazia (sem cliente e sem itens); o número e a hora de abertura vêm da base. *Detalhe da ficha* mostra a tabela de itens e os pagamentos. *Detalhe do cliente* tem "Receber em aberto (N)", que leva todas as notinhas abertas para a janela mesmo se estiverem em outra página do histórico.
- *Selos sem vazar:* a segunda linha do `SeloSituacao` (150 px) leva só o prazo ("Vence em 12 dias", "Venceu há 38 dias", "Quitada em …"); o valor em aberto de notinha parcial vai sob o total na coluna Valor, e na lista de Clientes o selo diz "R$ X em aberto". O componente corta com reticências e mostra o texto inteiro na dica se algo ainda passar. Varredura em 14 telas, 1300 e 1920 px: 192 selos, nenhum vazamento nem corte.
- *Layout (mesma rodada):* no Estoque a descrição vai até 560 px e o selo de situação fica centralizado no espaço entre saldo e ações, alinhado em todas as linhas; "Criar ficha" com ícone e texto centralizados quando a barra está aberta; Ajustar estoque abre como gaveta lateral, igual a Movimentações.

**Recebimento de notinha e baixa de estoque (2026-09-25):**
- *Na venda:* a notinha guarda o vencimento (padrão hoje + 30 dias) e aceita **entrada** paga na hora (valor + Dinheiro/Pix/Cartão); o resto fica em aberto. Entrada que cobre o total é recusada ("escolha outra forma").
- *Depois:* em **Clientes › cliente › Histórico**, as notinhas em aberto ganham caixa de seleção; "Receber N notinhas" ou "Receber" na linha abre a janela **Receber notinha** (`detalhe-cliente/receber/ReceberNotinhas.tsx`). A tela da ficha tem o mesmo botão. A janela pede valor (parcial ou total), data (hoje por padrão) e forma; no dinheiro, mostra troco. O valor abate **da notinha mais antiga para a mais nova** e a janela mostra antes o que cada uma vai ficar ("Quitada", "Fica R$ X").
- *Cada notinha segue separada*, com a lista de pagamentos visível na tela da ficha (entrada, recebimentos, forma, data) e "Pago / Em aberto".
- *Situação:* calculada, não guardada — pago quando nada falta; "em atraso" quando o vencimento passou; o cliente mostra "N notinhas · R$ X". Cartão "Notinhas em aberto" no detalhe do cliente.
- *Financeiro (substituído pela base local, acima):* nesta rodada só dinheiro entrava no caixa; depois, todo pagamento registrado passou a entrar.
- *Estoque:* concluir qualquer ficha agora dá baixa nos produtos (casados pelo código de barras) e registra movimento "Venda" em Movimentações. Se o saldo do sistema for menor que o vendido, a venda acontece, o saldo para em zero e o movimento avisa. Antes disso, nenhuma venda mexia no estoque (defeito do mock).
- `comprasBaixadas` e `baixarCompra` saíram; o estado guarda `pagamentosNotinha` por ficha.

**Coluna direita da ficha sem rolagem (2026-09-25):** em janela de 1920×1030 a coluna Valores + Revisão passava ~70 px da altura. Compactado: saiu a frase "Dinheiro recebido entra no caixa…"; valor recebido e troco na mesma linha ("Faltam" no lugar de "Troco" quando falta); botões de pagamento de 44 para 40 px; avisos em uma linha ("Conclua só depois de conferir o recebimento.", "Fica pendente no cliente até a baixa.", "Falta escolher o cliente."); na venda sem identificação o aviso da notinha foi para dentro do botão, com cadeado. Conferido sem rolagem em Dinheiro, Pix, Notinha e venda sem identificação.

**Cadastro de cliente na ficha em janela (2026-09-25):** "Cadastrar novo cliente" abre um modal central estreito (`ModalNovoCliente`, prop `estreito` do `Modal`) em vez do formulário dentro do bloco, que empurrava os itens da venda. Campos: nome (único obrigatório), CPF/documento, celular e endereço opcional (rua, número, bairro, cidade/UF), gravado no cadastro como "Rua, nº - Bairro - Cidade/UF". Documento repetido é barrado com aviso. A busca de cliente só lista resultados depois de digitar, no máximo 6; sem resultado, oferece "Cadastrar “nome digitado”", que abre o modal já preenchido. O `Modal` deixou de roubar o foco de um campo com `autoFocus`.

**Venda sem identificação (2026-09-25):** a nova ficha de venda abre sem cliente escolhido (antes vinha Mariana Costa, que era só exemplo). O bloco Cliente oferece três caminhos: buscar cadastrado, cadastrar novo ou **Vender sem identificação**. A venda sem identificação dá baixa no estoque e entra no financeiro como qualquer outra; a **Notinha fica bloqueada** (sem cliente não há de quem cobrar) e, se estava escolhida, a forma volta para Dinheiro. O rascunho de nota fiscal continua permitido. O rótulo exibido é “Não identificado”. As vendas aparecem em **Clientes › Vendas sem identificação** (`#/clientes/sem-identificacao`, atalho tracejado acima da tabela), com total e divisão por Dinheiro/Pix/Cartão por dia, semana (domingo a sábado), mês ou tudo, e filtro por pagamento. Na base local, cerca de 1 em cada 4 fichas da amostra é sem identificação.


**Vocabulário da compra fiada:** o rótulo visível é “Notinha”, conforme o uso da papelaria para a compra feita agora e paga depois. A situação da compra continua separada: pendente, vencida ou paga. “Pagamento futuro” foi retirado das telas; o identificador interno `futuro` permanece nesta etapa, sem mudança de contrato.

**Rótulos de prazo em Clientes:** “Notinhas a vencer” indica compras ainda não pagas cujo prazo não terminou, independentemente de quão próximo está o vencimento. “Notinhas em atraso” indica compras não pagas cujo prazo já passou. Os cartões e filtros da lista contam clientes nessa situação; os filtros do histórico de um cliente contam compras. As datas ainda vêm dos exemplos, sem cálculo automático de vencimento.

Nos cartões da lista de Clientes, a unidade aparece junto do valor (“12 clientes”, por exemplo). Isso evita sugerir que o número represente a quantidade de notinhas; a linha explicativa repetida foi removida.

**Prévia de paginação em Clientes:** a amostra local passou a ter 20 clientes. A quantidade por página acompanha a altura disponível da janela; busca e filtro paginam os resultados encontrados e retornam à primeira página ao mudar. A amostra serve para visualizar a navegação sem alongar a tabela; o total de 148 clientes continua sendo apenas o número de exemplo do resumo, sem uma base completa por trás. As fichas de exemplo adicionadas depois podem aparecer no histórico desses clientes, mas não representam um cadastro completo de compras.

**Histórico de fichas na tela Início:** a lista antes chamada “Fichas recentes do dia” agora reúne 40 fichas fictícias, em ordem da mais nova para a mais antiga. O número de linhas por página aproveita a altura disponível da janela, até 12, sem transformar o histórico em uma lista longa; a paginação permanece. Data aparece na tabela e pode ser filtrada por um dia; os meios incluem Notinha. A busca global continua encontrando fichas por número ou nome e mostra a data nos resultados, e o detalhe do cliente reúne as fichas de exemplo desse cliente. Os 34 registros de 24/10/2024 ilustram o resumo diário de 34 fichas; seis registros mostram dias anteriores. Valores e outras métricas do resumo continuam dados de exemplo independentes. A paginação e os filtros são locais, sem banco.

**Altura das listas em 2026-09-24:** Início, Clientes, Financeiro, Estoque, histórico do cliente e Notas fiscais usam a mesma medição de linhas por página. Ela reserva o rodapé da tabela, o espaçamento inferior e as notas abaixo do painel. Financeiro passou a paginar as movimentações e Estoque passou de paginação ilustrativa a funcional, com 16 produtos de exemplo (8 por página na janela do print). A regra de 900 × 600 px ainda permite rolagem vertical quando os cartões e outros blocos acima da tabela ocupam a altura inteira; as tabelas deixam de alongar a página com todas as linhas.

**Controle de data do histórico:** o filtro da tela Início usa um calendário do aplicativo, com estilo dos tokens, navegação por mês e escolha por dia. O campo também aceita digitação com máscara `dd/mm/aaaa`; datas inválidas não filtram a lista. O botão à direita usa a seta do acervo em vez do ícone nativo do Windows. O calendário abre no mês da ficha mais recente quando ainda não há filtro.

**Navegação do estoque em 2026-09-24:** (atualizado em 2026-09-25: Ajustar estoque também virou gaveta lateral) Ajustar estoque abre em modal sobre a lista e Movimentações abre em painel lateral, tanto pelos botões do topo quanto pelas ações da linha. As rotas são filhas de Estoque para preservar filtro e posição da lista ao fechar. Confirmar um ajuste abre o histórico daquele produto no painel. Registrar entrada permanece como página por comportar vários itens e dados da compra. O estado continua restrito à sessão de demonstração.

**Busca local do estoque:** a busca entre filtros e tabela encontra descrição, categoria, código interno e código de barras, ignorando acentos e maiúsculas. Os filtros de categoria são montados a partir dos produtos presentes na sessão e ocupam até três linhas; se houver mais opções, essa área rola. A busca combina com o filtro escolhido e retorna à primeira página. A contagem de categorias no cartão explicita que se refere à amostra, enquanto os 1.420 produtos continuam um total ilustrativo sem base completa cadastrada.

**Ajustar estoque:** o modal usa busca de produto por descrição, código interno ou código de barras, com sugestões limitadas. Ao abrir pelo botão geral, nenhum produto é escolhido automaticamente; ao abrir pela linha, o produto e o saldo continuam preenchidos. Digitar uma busca sem escolher um resultado impede a confirmação de ajuste no produto anterior.

**Prévia de recebimento de mercadorias:** o formulário aberto pelo botão geral mostra seis itens fictícios já presentes no catálogo do Estoque. Essa quantidade aproveita a altura da janela ampla sem cobrir o resumo ou a confirmação. A tela é um rascunho de demonstração; abrir pela linha de um produto continua começando apenas com aquele produto.

**Adicionar item na entrada:** o campo do recebimento aceita código interno, código de barras ou nome e oferece resultados do catálogo. O botão adiciona correspondência exata ou única; resultados ambíguos exigem escolher o produto. Código lido novamente soma uma unidade ao item existente. Produto sem custo cadastrado entra com custo em branco, e o resumo explicita que soma apenas o custo informado.

**Barra lateral e movimento em 2026-09-24:** a barra lateral pode ser recolhida para 80 px, mantendo logo, ícones e acesso a Criar ficha; a preferência fica salva localmente. GSAP e `@gsap/react` foram instalados para entradas discretas (160 ms) em seleção, filtro ativo, modal/painel lateral e compras recentes expandidas. A abertura e a compressão da barra usam 280 ms com GSAP, e os rótulos entram apenas no fim da abertura para não quebrar durante a mudança de largura. Logo e ícones ficam ancorados à esquerda durante todo o percurso; só a borda, o fundo selecionado e o conteúdo da tela acompanham a largura. As animações respeitam `prefers-reduced-motion`; não há animação de tabelas ou navegação entre telas.

**Rodapé da barra em 2026-09-24:** a logo mantém 34 × 52 px nos dois estados. Foi removida a indicação de protótipo e o operador ganhou uma área de 48 px de altura, ícone de 24 px e texto maior; o controle já pode ser acionado, com aviso de destino pendente até existir a tela de configurações.

**Lições da revisão visual desta sessão:** ao animar a coluna do menu de 256 para 80 px, nunca centralizar os filhos com base na largura instantânea da coluna. Isso fez a logo e os ícones saltarem para o meio da barra ainda larga durante a contração. Deixe logo, ícones do menu, botão Criar ficha e operador ancorados à esquerda; a coluna e o fundo do item ativo podem mudar de largura. Confira capturas no meio da abertura **e** da contração, além dos dois estados finais, em 900 e 1300 px. A logo também precisa de espaço interno suficiente na barra compacta para não parecer menor por recorte. O usuário prefere animações discretas, apenas nas microinterações úteis, com respeito a `prefers-reduced-motion`.

**Correção do recolhimento:** o controle saiu da marca e foi para o cabeçalho, à esquerda da busca; usa um ícone de painel do acervo. A marca e o menu mantêm a mesma altura nos dois estados, e a busca fica alinhada à direita. Conferido em 900 e 1300 px: o menu começa em y=112 nos dois estados, o controle em y=14 e não há rolagem horizontal da página. A tabela pode continuar com rolagem própria na largura mínima.

**Continuação das interações:** os acessos "Abrir ficha" e "Ver ficha" agora
abrem a ficha correspondente aos dados de exemplo. Telas internas têm retorno
visível com seta. Foram criadas telas para cadastro/edição de cliente, detalhe
da ficha, ajuste e movimentações do estoque, registro de movimento do caixa,
busca global e revisão de rascunhos/documentos fiscais. O sino mostra avisos
dos exemplos. Cadastro, baixa, entrada, ajuste, movimento e conclusão de ficha
alteram apenas o estado da sessão aberta; não há gravação em banco. O rascunho
da ficha pode ser retomado na página inicial. A paginação fictícia foi ocultada
onde só existe uma amostra de registros. Impressão, extrato e exportação continuam
sem implementação, conforme pedido do usuário.

Os dados antigos ainda podem divergir entre telas. A tela da ficha usa a origem
da navegação para mostrar o mesmo exemplo que a pessoa abriu. A skill local
`web-design-guidelines` foi catalogada em `docs/organizacao.md`.

**Ajuste visual da navegação:** a marca na barra lateral mostra "Papelaria" e
"Opção" em duas linhas, sem a indicação de terminal. O retorno das telas
internas ganhou seta maior e área de clique destacada para facilitar a leitura.

**Seletores dos formulários:** os menus de escolha em Cadastro de produto,
Ajustar estoque e Registrar movimento usam um componente visual compartilhado,
com teclado e lista posicionada conforme o espaço no modal. O menu nativo do
Windows foi retirado desses formulários para manter alinhamento e aparência
coerentes. No Cadastro de produto, o aviso de sessão ganhou espaço próprio
abaixo dos dados fiscais.

**Itens da nova ficha:** o campo de leitura também busca produtos já cadastrados
no estoque pelo nome, código interno ou código de barras, sem perder a leitura
direta do código exato. As sugestões mostram descrição, estoque e preço;
escolher uma inclui o item ou soma uma unidade se ele já estiver na ficha.
O ícone e o espaço interno das opções de pagamento foram reduzidos levemente
para acomodar melhor “Dinheiro” na coluna lateral.

**Ponto de parada de 2026-09-23 (histórico):** o usuario encerrou a rodada de melhorias de interface
em 2026-09-23 e pretende fazer outra revisao visual na proxima conversa. Nesta
rodada ficaram prontos a comparacao diaria de entradas e saidas no Financeiro,
Clientes com compras recentes recolhidas por padrao, seletores consistentes nos
formularios e busca por nome/codigo dos produtos na nova ficha. Semana, Mes e
Ano no Financeiro mostram estado vazio porque os exemplos representam apenas
um dia. A busca da ficha foi conferida com um nome sem acento e com codigo de
barras exato: a primeira incluiu um produto e a segunda aumentou a quantidade
do item existente. `npm run build` passou e o Electron foi reaberto com a versao
mais recente. Retomar ouvindo os proximos ajustes que o usuario identificar;
nenhuma nova melhoria especifica foi definida para a proxima rodada.

As nove telas do Stitch foram migradas para React em `src/` e navegam entre si.
Os dados vêm da base local única (ver o topo desta seção); o contrato ainda não
mudou. O que existe:

- `src/telas/<tela>/`: Inicio, Criar ficha, Clientes, Detalhe do cliente,
  Financeiro, Estoque, Cadastrar produto (janela sobre o Estoque), Registrar
  entrada e Notas fiscais, mais as telas internas (detalhe da ficha, formulário
  de cliente em gaveta, ajustar estoque, movimentações, registrar movimento,
  rascunhos de nota, detalhe fiscal, busca, vendas sem identificação). Cada uma
  com `.tsx` e `.css`; dados vêm de `src/mock/base/`.
- `src/componentes/`: moldura (barra lateral unica), `Tela` (cabecalho, titulo e
  rolagem padronizados), botao, selo, painel, tabela, filtros, paginacao, campo,
  modal, aviso e icone.
- `src/estilos/`: tokens em arquivos por familia e base. Ver decisao abaixo.
- Icones proprios recortados do `Icons.pdf` do acervo (66 pecas; documento, email e endereco entraram em 2026-09-25), gerados por
  `recursos/design-system/componentes/icones/biblioteca/extrair_icones.py`.
- `comum/contrato.ts` ainda com a operacao de exemplo `ping`; o mock responde.
- `stitch/` fica como referencia historica; nada no app depende dele.

**Ainda nao existe:** `supabase/`, projeto de banco, contrato de verdade e dados
sincronizados em banco. Impressão, extrato e exportação seguem sem destino.

**Verificado em 2026-09-23:** `npm run build` passa; as nove telas sem erro no
console, sem rolagem horizontal da pagina e sem texto transbordando em 1300 px e
na janela minima de 900 px. `npm start` abriu a janela do Electron com as telas
novas (conferido pelo usuario). A janela ainda mostra a barra de menu padrao do
Electron (File, Edit, View, Window); tirar ou nao e decisao pendente.

**Como retomar (para quem chega agora, humano ou LLM):**
1. Ler `AGENTS.md`, secao "Interface: como esta montada", antes de mexer em `src/`.
2. `npm run dev` e abrir `localhost:5173`; `npm start` abre o Electron.
3. Alteracao visual vai no `.css` ao lado do componente ou da tela, usando so as
   variaveis de `src/estilos/tokens/`. Nao editar `stitch/` (historico).
4. Pedidos do usuario nesta fase: ajustes visuais pontuais, um por vez, dizendo
   antes se e viavel e o que envolve, e so executando com o "pode fazer" dele.
   Dado novo nunca vai num `dados-exemplo.ts` da tela: fato entra em
   `src/mock/base/tipos.ts` e na semente; consequência vira função em
   `derivados.ts`, com teste. `npm test` antes de terminar.

## Decisoes tomadas

### `2026-09-23` — Telas do Stitch migradas para o stack; CSS por componente

Desenho aprovado em `docs/superpowers/specs/2026-09-23-migracao-telas-stitch-design.md`.

- **CSS por componente**, escolha do usuario: cada componente e tela tem seu
  `.css` ao lado do `.tsx`, com classes nomeadas (`bloco__parte--variante`).
  Tailwind v4 fica para preflight e tokens. **Por que:** facilitar achar e mudar
  um estilo num lugar so; o JSX do Stitch com dezenas de utilitarios por
  elemento era o que tornava as telas incoerentes entre si.
- **Tokens so em `src/estilos/tokens/`**, declarados em `@theme static`. Nenhum
  `.css` fora dali tem cor solta (conferido por busca). Cores de situacao na
  familia pastel validada na tela Clientes: ok (verde), atencao (laranja),
  critico (vermelho), neutro.
- **Dados de exemplo locais por tela**, sem mexer no contrato (regra 7). Na etapa
  de sincronizar dados, eles viram o mock oficial por `window.api`.
- **Navegacao com `react-router` em modo hash** (`#/clientes`). O `front-side.md`
  diz "nao existe URL": continua verdade para o usuario, que nao ve barra de
  endereco no Electron. O hash e so o mecanismo interno, que funciona em
  `file://` e da voltar/avancar e a rota do cliente por id.
- **Icones proprios** do acervo, nao Material Symbols nem Lucide, a pedido do
  usuario. Tudo local: Inter por `@fontsource-variable/inter`, nenhum link externo.
  **Pendente:** confirmar a licenca do pacote de icones antes de distribuir.
- **Cartoes de resumo com icone** (pedido do usuario, depois da migracao): icone
  grande (36 px) a esquerda, sem fundo, na cor do tom (verde entrada, vermelho
  saida/vencido, laranja pendencia/estoque baixo, cinza neutro); informacoes a
  direita. Comparacao com ontem num selo pequeno com seta ("+14,2%" vs ontem).
  O usuario pediu explicitamente tirar o quadrado colorido atras do icone e
  aprovou manter o fundinho verde da variacao. O cartao se compacta sozinho
  (container query) quando estreito, como no Financeiro com quatro cartoes.
- **Barra de rolagem com espaco reservado** (`scrollbar-gutter: stable`) na area
  de conteudo e no corpo do modal: abrir a expansao de Clientes nao desloca mais
  o layout. Vale para todas as telas.
- **Ajustes de coerencia feitos na migracao:** "Criar ficha" so na barra lateral
  (o cabecalho mostra a acao propria de cada tela); coluna Unid. e coluna de
  codigo de barras do Estoque juntadas a outras; coluna "#" de Registrar entrada
  e caixas de selecao de Clientes retiradas; itens longos em uma ou duas linhas
  com o texto inteiro na dica, para as linhas terem a mesma altura.

### `2026-09-23` — Descoberta e construcao do front primeiro

Nesta etapa, concentrar as decisoes no uso do aplicativo: navegacao, telas,
fluxos, estados e dados simulados no mock. Representar recebimentos de Pix e
cartao como se a integracao financeira ja os fornecesse, para desenhar uma
interface completa. Nao interromper a definicao do front para resolver agora
credenciais, cobertura de API ou infraestrutura de notificacoes. A integracao
real e o back-end serao investigados e implementados depois; as hipoteses
tecnicas permanecem registradas como pendencias, sem serem apresentadas como
capacidades ja verificadas.

### `2026-09-23` — Pagina inicial operacional e discreta

A abertura mostra apenas o essencial para a rotina da papelaria: resumo
compacto de recebimentos, vendas e saidas do dia; acao de criar ficha de venda
com grande destaque; lista de fichas/vendas com ID, nome do cliente e acesso
direto aos detalhes da compra. O resumo financeiro deve ter tamanho confortavel
para leitura, sem dominar a pagina. Seus valores aparecem ocultos por padrao
ao abrir a tela; um controle com icone de olho permite revela-los quando a
funcionaria desejar. Isso reduz a exposicao a clientes que veem a tela no
balcao; nao substitui controle de acesso. Estoque
baixo e contas vencidas pertencem as respectivas secoes; um icone de
notificacoes pode sinalizar eventos sem disputar espaco com o fluxo principal.
O cadastro do cliente e separado da ficha de venda no dominio, embora o cliente
novo possa ser cadastrado dentro do fluxo de criacao da venda, sem sair dele.

### `2026-09-25` — Base local única: fatos guardados, consequências calculadas

Pedido do Victor: sincronizar tudo (busca, filtros, pendências, financeiro) e
permitir registrar localmente para testar campos. Antes, cada tela tinha o seu
`dados-exemplo.ts` e um estado em memória com somas de compensação ("148
clientes + novos − exemplos"), e a mesma ficha tinha pagamento diferente em
cada tela. Decidido: uma base em `localStorage`, com só fatos; tudo o que é
situação ou total é função pura testada. Semente determinística relativa a hoje,
para os períodos e prazos funcionarem sem data fixa de 2024. Sem mexer no
contrato (regra 7) nem em `window.api`: é camada local do front, que sai quando o
mock do contrato entrar. Vitest entrou como `devDependency` (sem módulo nativo),
com `vitest.config.mts` próprio para não subir o Electron. Aprendizado: o
formatador de moeda usa espaço não separável depois de "R$"; teste de texto com
valor monta o esperado com `reais()`.

### `2026-09-25` — Venda sem identificação: ficha sem cliente, não cliente genérico

Para quem compra um lápis e não quer se cadastrar. Descartado: pedir só o
primeiro nome (gera duplicatas e confunde a base com o tempo) e criar um
registro fixo "Cliente não identificado" (apareceria na lista de Clientes com
milhares de compras, distorceria rankings e poderia ser editado por engano).
Decidido: a ficha fica **sem cliente** (`clienteId: null`) e o histórico dessas
vendas é uma consulta própria, não um cadastro. Notinha exige cliente
identificado. Isso substitui a regra anterior da tela ("toda ficha tem
cliente"). **Para o contrato:** o cliente da ficha passa a ser opcional; entra
no primeiro corte do contrato, em PR próprio (regra 7).

### `2026-09-23` — Lista de clientes como entrada da secao

A secao Clientes abre em uma lista alfabetica com numero de cliente estavel,
nome e acao de abrir a ficha. A busca por nome fica visivel no topo da tela,
sem exigir um modal para a tarefa mais comum. Filtros de situacao ficam junto
da busca; "com pendencias" e "com vencidos" se referem a compras/valores a
receber, sem rotular a pessoa inteira como "paga" ou "vencida". A ficha do
cliente mostra suas compras e permite abrir cada compra. A numeracao exibida
deve continuar identificando o mesmo cliente mesmo quando a lista for filtrada
ou reordenada; nao usar a posicao momentanea da linha como identidade. Cada
linha pode ser expandida para mostrar a quantidade total de compras e um
resumo curto das compras mais recentes (por exemplo, as tres ultimas), com
numero da ficha, data e situacao. Um comando "Ver historico completo" abre a
ficha do cliente; a expansao nunca tenta mostrar centenas ou milhares de
compras nem cria uma rolagem longa dentro da lista.
Ao entrar em Clientes, todas as expansoes com compras recentes ficam recolhidas;
o operador abre a linha que quiser pela seta de acoes.

### `2026-09-23` — Financeiro por periodo e meio de pagamento

A tela Financeiro deve permitir acompanhar os movimentos em apenas quatro
recortes: Dia, Semana, Mes e Ano. Deve ser possivel ver todos os meios juntos
ou filtrar Pix, cartao e dinheiro, e consultar as
entradas em uma lista detalhada. O resumo visual de exemplo compara o total
de entradas e saidas do dia em duas barras, com o liquido abaixo. A divisao
anterior em abertura, pico do balcao e tarde foi retirada por nao apoiar uma
decisao operacional definida. Os dados ficticios so representam Dia: Semana,
Mes e Ano mostram estado vazio, sem reaproveitar valores diarios como totais
desses periodos. Prever uma acao de exportar
o periodo selecionado para consulta historica e envio a contabilidade, inclusive
fechamento mensal e anual. O formato, os campos e os criterios
contabeis do arquivo dependem de conversa com a papelaria e a contabilidade.
Na visao ideal, o relatorio reune recebimentos de dinheiro, Pix e cartao sem
duplicar vendas. Pagamentos externos sem vinculo com uma ficha de venda podem
aparecer como recebimentos, mas nao devem ganhar cliente ou produtos por
suposicao.

### `2026-09-23` — Area fiscal minima no primeiro desenho

A navegacao inclui Notas Fiscais. No primeiro desenho do front, a area pode
separar "Entradas" (documentos relacionados a compras de fornecedores) e
"Saidas" (documentos relacionados a vendas), com listagens e estados de
interface simulados. Uma ficha de venda tera a acao "Preparar nota", que
inicia um rascunho com cliente, produtos e valores ja conhecidos no aplicativo;
o operador revisa os dados antes de qualquer emissao futura. A escolha do
emissor esta quase definida: o usuario indica cerca de 98% de chance de usar
Focus NFe, ainda sem decisao final. Sua documentacao oficial cobre
[emissao de NF-e e NFC-e](https://doc.focusnfe.com.br/reference/introducao) e
[NF-e recebidas contra o CNPJ](https://doc.focusnfe.com.br/reference/nfe-recebidas).
Mesmo assim, o tipo fiscal correto, os campos fiscais necessarios e se
"entrada" significara consultar notas de fornecedores ou emitir NF-e propria
de entrada dependem de definicao com a contabilidade. Nao apresentar o
rascunho do front como nota fiscal emitida.

### `2026-09-23` — Pagamento confirmado no balcao e contagem financeira unica

Na venda, a funcionaria registra Pix ou cartao somente depois de conferir o
recebimento no balcao. A compra aparece como paga no historico do cliente; nao
ha uma etapa adicional de "aguardando conferencia" para a dona. Esse registro
da venda nao cria uma entrada financeira. O financeiro deve contar uma unica
entrada vinda da fonte do recebimento, quando a integracao dessa fonte estiver
disponivel. Dinheiro recebido e lancado manualmente na venda e conta no caixa
e no financeiro. A integracao completa para enviar cobrancas a Point continua
mapeada como possibilidade futura, condicionada ao modelo do terminal.

### `2026-09-23` — Repositório oficial do Electron como referência

O código-fonte em `electron/electron` não foi importado. O esqueleto existente já
usa a estrutura necessária para este aplicativo. A revisão da documentação de
segurança levou ao bloqueio de novas janelas e navegações externas e à validação
do remetente de cada chamada IPC em `electron/main.ts`. Referências e pontos para
revisar antes da distribuição estão em `docs/electron.md`.

### `2026-09-22` — Repo unico, dono por pasta

Um repo na Org compartilhada, com dono por pasta em vez de dois repos ligados por
pacote de contrato.

**Por que:** com dois repos o contrato vira pacote npm, e pacote npm vira versao para
sincronizar a cada mudanca. No mesmo repo o contrato e **o mesmo arquivo** para os
dois — nao existe estado em que as duas metades leiam versoes diferentes dele.

**Descartado:** (a) dois repos + pacote de contrato — isolamento que nao precisamos,
custo de sincronizacao que precisariamos pagar sempre; (b) o parceiro entregar React
standalone e eu integrar depois — joga a integracao inteira para o fim, que e quando
ela custa mais.

### `2026-09-22` — Quem escreve o contrato e o FRONT; o back revisa num portao

O primeiro corte de `comum/contrato.ts` e do parceiro.

**Por que:** o contrato e o vocabulario do dominio, e quem faz a reuniao com o cliente
e ele. Back escrevendo sozinho inventa nome que nao bate com o que o cliente falou, e
alguem traduz para sempre. Alem disso ele **ja** escreve esse contrato hoje, implicito
no formato do dado falso das telas; a mudanca e so dar nome de arquivo ao que ja existe.

**O que fica com o back, e por que:** tres coisas nao sao visiveis de quem desenha
tela — atomicidade (um botao pode ser tres escritas que tem que valer juntas), o
catalogo de falhas, e quais gestos sao irreversiveis. As tres estao em
`revisao-de-contrato.md`.

**O portao:** revisao depois da primeira ou segunda tela, antes da terceira. Mais cedo
ele ainda nao sabe do que precisa; mais tarde ja tem tela em cima da forma errada.
Atomicidade e o unico item sem conserto posterior.

### `2026-09-22` — Um tipo, tres implementacoes

`Contrato` existe uma vez; ponte, real e mock se declaram `: Contrato`.

**Por que:** no `upload-sys` a superficie estava escrita quatro vezes, e o
`src/tipos/api.d.ts` era espelho mantido a mao — o comentario dele dizia "se uma
funcao entrar la, entra aqui". Com um dono so, funcionou. Com dois donos, obrigacao de
sincronia manual e exatamente por onde vaza. Agora o compilador cobra.

**Efeito colateral bom:** operacao nova no contrato quebra o build do mock ate o front
implementar uma resposta falsa. E assim que ele descobre que tem tela nova, sem
ninguem mandar mensagem.

### `2026-09-22` — Canal de IPC = nome da operacao

Sem namespace tipo `'clientes:listar'`. `main.ts:registrar` percorre as chaves de um
objeto tipado como `Contrato` e registra um handler por chave.

**Por que:** tira a terceira lista de nomes que desatualizaria. Nao afrouxa a regra do
canal nao-generico: o conjunto de canais e fixo em tempo de build, e `ipcRenderer`
nunca chega ao renderer.

**Custo aceito:** renomear operacao passa a ser mudanca de contrato de verdade (muda o
canal). Isso e bom — nome de operacao devia ser estavel mesmo.

### `2026-09-22` — Erro por retorno tipado, nao por excecao

Toda operacao devolve `Resultado<T>`; `registrar` embrulha e converte excecao em
`Falha`.

**Por que:** com excecao, o caminho de erro fica invisivel no tipo e a tela enche de
`try/catch` — ou, mais comum, nao enche, e o erro chega como tela branca. Com uniao
discriminada, o front nao consegue esquecer o caso de falha: o TypeScript nao deixa
ler `dado` sem checar `ok` antes.

**Detalhe de seguranca:** o texto cru da excecao fica no log do processo principal. Para
a tela vai mensagem generica — mensagem de erro de driver de banco carrega URL de
conexao.

### `2026-09-22` — O mock falha e demora por padrao

220ms de atraso em toda resposta mesmo sem pedir, e painel para forcar cada causa.

**Por que:** e o mesmo erro do seed limpo, um andar acima. A regra global diz que o
seed tem que reproduzir as patologias da producao, porque ambiente que so testa o caso
feliz da confianca falsa. Um mock instantaneo e infalivel esconde o estado de
carregando e o estado de erro — dois tercos de cada tela — e eles voltam como
retrabalho na metade do back, ou nao voltam nunca.

## Perguntas em aberto

- **Escopo inicial em descoberta:** aplicativo desktop para papelaria, com vendas,
  clientes, estoque, caixa e financeiro. Notas fiscais entram como area minima
  de interface, ainda sem emissao real. O vocabulario detalhado continua em
  definicao.
- **Fluxo de venda proposto pelo usuario:** na mesma interface, selecionar um cliente
  existente ou cadastrar um novo sem perder a venda em andamento; adicionar produtos
  do estoque; registrar a forma de pagamento. O cliente cadastrado e reutilizado em
  compras futuras. Confirmar posteriormente os dados minimos obrigatorios.
- **Recebimentos externos:** a compra marcada como paga por Pix ou cartao
  representa a conferencia ja feita pela funcionaria no balcao. Essa marcacao
  nao alimenta o total financeiro. Sem acesso a fonte externa, o financeiro
  nao tera um total completo desses meios; nao inventar integracao nem somar
  a marcacao da venda como substituto silencioso.
- **Caixa diario completo desde a primeira versao:** proposta de contar uma vez
  os recebimentos de Pix e cartao obtidos da fonte financeira, mais dinheiro
  lancado manualmente, e registrar saidas separadamente. Validar com transacoes
  reais se a API da conta retorna pagamentos feitos diretamente na maquininha
  e o Pix usado pela loja. Se nao retornar, definir importacao de extrato ou
  lancamento identificado antes de prometer um caixa completo. Separar o total
  de vendas/recebimentos do dia do saldo liquido disponivel na conta, pois
  taxas e prazo de liberacao podem diferir.
- **Integracao em aberto:** manter mapeado o fluxo futuro em que a venda envia a
  cobranca a uma maquininha Point compativel e recebe sua confirmacao. O modelo da
  maquininha e a conta de destino do Pix ainda nao foram identificados. Nao assumir
  que a API do Mercado Pago mostra Pix recebido em outro banco ou permite vincular
  automaticamente cobranças iniciadas fora do aplicativo. O Mercado Pago documenta
  [busca de pagamentos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/search-payments/get)
  e [relatorio de dinheiro em conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/introduction),
  mas a cobertura dos recebimentos reais desta papelaria precisa ser testada.
- **Fiado / prazo:** definido em 2026-09-25 — pagamento parcial vale (na venda e
  depois), várias notinhas podem ser recebidas juntas e continuam separadas.
  **Em aberto:** como Pix e cartão (entrada ou recebimento de notinha, e também as
  vendas comuns) chegam ao financeiro. Depende de o Victor confirmar com a dona
  como funcionam a maquininha e o Pix, e se a integração por API cobre 100% ou se
  haverá lançamento manual. Na base local, todo pagamento registrado na ficha
  entra no Financeiro, com o meio anotado; o que muda em produção é a origem do
  registro, não a tela.
- **Cadastro de produto em desenho:** campos e comportamento propostos em
  `docs/cadastro-produtos.md`. A loja possui leitor de codigo de barras;
  prever leitura no cadastro e na venda, com retorno claro para codigo nao
  encontrado ou duplicado. Venda por unidade e o padrao; a apresentacao em
  caixa/pacote e uma excecao opcional. Testar o modo de funcionamento do leitor
  fisico e confirmar outros formatos de venda antes de fechar o contrato.
  Uma unica tela de "Registrar entrada" cobre um item (aberta a partir da linha
  do produto) e varios itens (aberta do topo do Estoque). Ajuste de contagem
  aparece como acao distinta de entrada de mercadoria.
- **Tem login / multiusuario?** Muda o sentido de `permissao` no contrato e obriga
  vocabulario de sessao. Decidir antes do contrato fechar.
- **Precisa funcionar sem internet?** Isso muda o contrato inteiro — cache local, fila
  de escrita, resolucao de conflito. Decidir antes, nunca depois.
- **Duas pessoas na mesma tela ao mesmo tempo?** Define se existe `conflito` de
  verdade ou se o ultimo a salvar ganha.
- **Impressao / exportacao / PDF?** Se sai do processo principal, e operacao no
  contrato.
- **Qual provedor de banco?** O esqueleto assume Supabase por inercia do `upload-sys`;
  nada no codigo depende disso ainda.

## Aprendizados reaplicaveis

- **Contrato como tipo unico com N implementacoes** vale para qualquer separacao
  front/back em TypeScript, nao so Electron. A ponte pode ser IPC, HTTP ou nada.
- **O mock e o contrato, escrito de forma implicita.** Onde alguem monta tela com dado
  falso, ja existe um contrato; ele so nao tem nome de arquivo. Dar o nome e a
  intervencao mais barata que existe num trabalho a dois.
- **"Quem escreve o contrato" e a pergunta errada.** A certa e "quais partes do
  contrato so um dos dois consegue ver": vocabulario e da reuniao, atomicidade e falha
  sao do banco.

## Problemas conhecidos

- Referência visual recebida em `recursos/design-system/`: 14 PDFs preservados
  por família, com prévia, texto extraído e ficha. Os dois PDFs de paletas
  (`Global Colors` e `Color Tokens`) foram excluídos por decisão do usuário.
  A paleta e as escalas de espaço, raio e tipografia em uso estão em
  `src/estilos/tokens/`, vindas do `stitch/DESIGN.md` e dos ajustes aprovados em
  conversa. São a referência do app; mudar um valor ali muda todas as telas.

- Ainda nao ha icone de aplicativo; `electron-builder.json` nao aponta icone nenhum.
  Empacotar vai sair com icone padrao do Electron.
- Sem `.github/workflows/`. O `upload-sys` tem release para Windows; se este projeto
  precisar, copiar de la.

## Proximos passos

1. Usuario navega pelas telas e pede melhorias visuais pontuais (fase atual).
2. Decidir se tira a barra de menu padrao do Electron (`electron/main.ts`).
3. As telas internas solicitadas nesta rodada ja existem. As acoes de impressao,
   extrato e exportacao continuam com aviso "Ainda sem destino", conforme escopo
   combinado; definir formato e operacao antes de implementa-las.
4. Dados já sincronizados na base local (2026-09-25). Falta levá-los ao mock
   (`window.api`) com o contrato em PR próprio; o formato de `src/mock/base/tipos.ts`
   é a proposta de vocabulário. Nessa etapa as telas ganham estados de
   carregando e falha (regra 6), que hoje não aparecem porque a base é síncrona.
5. Confirmar a licenca do pacote de icones do acervo antes de distribuir.
6. Primeiro commit e repo na Org (o repositorio local ainda nao tem commit).
7. Entregar `front-side.md` ao parceiro; esperar o primeiro corte do contrato;
   aplicar `revisao-de-contrato.md`.
8. So depois: projeto de banco de **teste**, `supabase/migrations/0001`, e
   `electron/operacoes.ts` de verdade.
