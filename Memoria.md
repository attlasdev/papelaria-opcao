# Memoria — papelaria-opcao

Estado vivo do projeto: onde estamos, o que falta e as regras que valem hoje,
com o porquê. O que o código faz está no código e no git. O passado sessão a
sessão (ideias descartadas, números antigos) está em
`docs/historico/memoria-ate-2026-09-30.md`.

**Como manter este arquivo:** uma lista de pendentes só, no topo. Decisão nova
entra na seção da área, substituindo a antiga (não empilhar "atualizado em").
Relato de sessão longo vai para `docs/historico/`.

---

## Onde estamos — `2026-09-30`

Só a interface existe, rodando contra uma **base local** (`src/mock/base/`,
`localStorage`). Tudo o que se faz nas telas grava e aparece igual em todas.
Ainda não há contrato de verdade, banco nem `supabase/`; `comum/contrato.ts` tem
só a operação de exemplo `ping`.

- Rodar: `npm run dev` (navegador, porta 5173) ou `npm start` (Electron).
- Conferir: `npm test` (54 testes da camada de dados) e `npm run build`.
- Última rodada: análise de função do app inteiro e correções (cancelar ficha,
  estornos, ficha que se guarda sozinha, validações), calendário padronizado e
  organização de pastas e documentos. Testado no navegador; **não testado no
  Electron**.
- Branch de trabalho: `analise-de-funcao` (ainda não juntada à `main`).
- "Restaurar dados de exemplo" (botão do operador, rodapé da barra lateral)
  refaz a amostra de 90 dias até hoje.

---

## PENDENTE

*Decidir com a dona:*
1. Cancelar ficha: hoje liberado em qualquer data. Limitar a "só no mesmo dia"?
2. Devolução parcial de itens: hoje só se cancela a ficha inteira.
3. Venda com saldo zerado no sistema: hoje passa, o saldo para em zero e o
   movimento avisa. Passar, pedir confirmação ou bloquear?
4. "Retirada do caixa" (dinheiro levado ao cofre) ainda conta como saída no
   líquido do Financeiro. Separar ou não?
5. Custo por lote na entrada. Proposta a levar: um produto só; cada entrada
   guarda o custo do lote; o produto mostra "10 un a R$ 8,00 (lote 03/09) · 30 un
   a R$ 10,00 (lote 29/09)"; a venda consome o mais antigo. Perguntar se ela
   usaria ou se o último custo basta. Hoje o custo da entrada fica só no motivo
   do movimento e não altera o cadastro. (Descartado: cadastrar o produto duas
   vezes, um por lote — o código de barras não diz o lote e o saldo se parte.)
6. Pix e cartão em produção: de onde vem o registro (maquininha, banco ou
   lançamento manual), incluindo crédito/débito e parcelas, que a venda hoje não
   registra (a amostra tem "Cartão crédito (2x)"). Ver "Pagamentos" abaixo.

*Decidir com o Victor:*
7. Regras de CPF e aviso de nome repetido no cadastro de cliente (adiado).
8. Registrar entrada: a "Data do recebimento" não é gravada; o movimento sai com
   a data de agora. Gravar exige decidir a ordem do histórico quando a data for
   passada (o saldo "antes → depois" encadeia).
9. `docs/materiais-recebidos/attlas-cobranca-automatica.txt` trata de outra
   empresa (Attlas), não da papelaria. Mover para o Atlas Victor ou apagar daqui?

*Visual, a conferir (anotados em 2026-09-25):*
10. Painel "Cadastro" do detalhe do cliente estica até a altura dos três cartões
    e sobra espaço embaixo.
11. A Revisão da nova ficha repete o total do painel Valores.

*Testar:*
12. Leitor de código físico no Electron.
13. A versão atual inteira no Electron.

*Antes de distribuir:*
14. Licença do pacote de ícones do acervo; ícone do aplicativo
    (`electron-builder.json` não aponta nenhum).

*Próximos passos de arquitetura (em ordem):*
15. Contrato de verdade em PR próprio (regra 7): o formato de
    `src/mock/base/tipos.ts` é a proposta de vocabulário. Nessa etapa as telas
    ganham estados de carregando e falha (regra 6), que hoje não aparecem porque
    a base local é síncrona.
16. Entregar `front-side.md` ao parceiro; esperar o primeiro corte do contrato;
    aplicar `revisao-de-contrato.md`.
17. Só depois: banco de **teste**, `supabase/migrations/0001` e
    `electron/operacoes.ts` de verdade.

---

## Regras de produto que valem hoje

### Venda (ficha)
- **Uma tela só:** cliente, itens, pagamento e revisão. A ficha abre vazia.
- **Cliente:** buscar cadastrado (ignora acento, acha pelos dígitos do
  documento), cadastrar novo em janela sem sair da venda, ou **vender sem
  identificação** — a ficha fica sem cliente (`clienteId: null`), rótulo "Não
  identificado", consulta própria em Clientes › Vendas sem identificação. Não
  existe cliente genérico (apareceria na lista com milhares de compras).
- **Quem já deve aparece ao escolher o cliente:** atraso em vermelho, em aberto
  no prazo em laranja. Só avisa; vender ou não é do balcão.
- **Itens:** bipe (leitura contínua pelo ícone), busca por nome ou código;
  vários resultados pedem escolha. Quantidade digitável e com + e −. Código sem
  cadastro oferece **cadastro rápido** em janela: o produto nasce com saldo 0 e
  marcado `cadastroRapido` até alguém completar e contar no Estoque.
- **A venda em andamento se guarda sozinha** (rascunho único na base); o Início
  oferece "Retomar ficha". "Limpar ficha" zera tudo, inclusive cliente e forma.
- **Bloqueios ao concluir:** sem cliente, sem item, desconto maior que o
  subtotal, dinheiro recebido menor que o total, notinha sem vencimento ou com
  vencimento antes de hoje, entrada que cobre o total.
- Concluir dá baixa no estoque (movimento "Venda"); com saldo menor que o
  vendido, a venda passa e o saldo para em zero (pendente 3).

### Notinha (compra fiada)
- Rótulo na tela: "Notinha". Situação calculada: pendente, vencida, paga,
  cancelada. O identificador interno antigo era `futuro`.
- Vencimento padrão hoje + 30 dias; **não muda depois** (decisão do Victor): se a
  dona der mais prazo, a notinha continua vencida — é o controle. O combinado vai
  numa **anotação** na ficha (só se acrescenta, com data).
- Entrada na hora (valor + meio) e pagamento parcial valem. Receber: janela que
  lista todas as notinhas abertas do cliente, com caixa por notinha; o valor
  abate da mais antiga para a mais nova; cada notinha segue separada (juntar =
  marcar mais caixas, não fundir fichas). Data do pagamento entre a notinha mais
  antiga marcada e hoje.
- Ficha pendente mostra faixa com as outras notinhas do cliente e "Receber todas".

### Corrigir sem apagar
- Nada lançado se apaga ou se edita livremente. Três desfazeres, todos com
  **motivo obrigatório** (`ModalMotivo`), e o registro original fica visível:
  - **Cancelar ficha** (página e janela da ficha): itens voltam ao estoque
    (movimento "Cancelamento"), o pago sai do Financeiro **no dia do
    cancelamento** (dias fechados não mudam), a ficha fica marcada "Cancelada" e
    sai das compras do cliente, das vendas do dia e da cobrança.
  - **Estornar recebimento de notinha:** pagamento riscado com o motivo; a
    notinha volta a dever.
  - **Estornar lançamento manual** do Financeiro: entra um lançamento de sinal
    contrário; o original fica "Estornado".
- Entrada ou ajuste de estoque errado se corrige com outro ajuste.

### Ficha consultada
- Qualquer "Ver ficha" abre **janela** por cima da tela; fechar devolve filtro,
  página e rolagem. A página `/fichas/:id` fica só para depois de concluir a
  venda. Janela sobre janela: Esc fecha só a de cima.

### Clientes
- Lista alfabética com número estável (`CLI-0104`), busca no topo, filtros
  "Notinhas a vencer" e "Notinhas em atraso" (contam clientes). Linha expande
  com as três compras recentes; "Ver histórico completo" abre o cliente.
- Cadastro e edição num formulário só, em gaveta (ou janela na ficha): só o nome
  é obrigatório; documento repetido é barrado; endereço gravado como
  "Rua, nº - Bairro - Cidade/UF".
- Detalhe do cliente: cartões Total comprado, Notinhas em aberto (clicar recebe)
  e Ticket médio; histórico com filtros e "Receber" por linha.

### Estoque
- Saldo só muda por **entrada, ajuste, venda ou cancelamento**, para o histórico
  bater. Editar produto não mexe no saldo. A quantidade informada ao cadastrar
  vira a primeira entrada ("Saldo inicial do cadastro").
- **Excluir x desativar:** apaga só produto sem histórico (cadastro por engano).
  Com histórico, desativa: some da venda, da entrada, do ajuste, das contas e dos
  avisos; aba "Desativados" para reativar. Bipado, avisa que está desativado.
- **Cadastro rápido** fica pendente até ser completado: card, aba "A completar",
  selo "Sem contagem", aviso no sino. "Completar" exige a contagem da
  prateleira. Sem contagem, o zero dele não é falta e ele não entra no Ajustar.
- "+ Entrada" da linha abre a gaveta Entrada rápida (um produto). Entrega com
  vários itens vai pela página Registrar entrada, com bloco "Bipados" (bipar de
  novo não duplica; produto novo precisa de cadastro antes de ir à tabela).
- Cadastrar produto (topo do Estoque) aceita bipe; código já cadastrado mostra o
  produto existente em vez de duplicar.

### Financeiro
- Dia, Semana, Mês, Ano; filtro por meio. Cada pagamento registrado numa ficha
  (venda, entrada ou recebimento de notinha, **em qualquer meio**) vira uma
  linha; lançamento manual também (saída separa Despesa de Retirada do caixa).
- **Estorno abate do próprio lado:** desfazer venda reduz Entradas, desfazer
  despesa reduz Saídas; selo "Estorno".
- Comparação com o período anterior **até o mesmo ponto** ("vs ontem, até esta
  hora"), senão toda manhã parece queda.
- Exportar período para a contabilidade: previsto, formato a combinar.

### Pagamentos (Pix e cartão)
- A funcionária marca Pix ou cartão **depois de conferir** no balcão; não há
  etapa "aguardando conferência".
- Na base local todo pagamento marcado entra no Financeiro. Em produção a tela
  não muda; muda **de onde** vem o registro (pendente 6). Não assumir que a API
  do Mercado Pago cobre Pix de outro banco nem cobranças feitas fora do app;
  não prometer caixa completo antes de testar com transações reais. Separar
  total recebido do saldo líquido da conta (taxas e prazo de liberação).
  Referências: [busca de pagamentos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/search-payments/get),
  [dinheiro em conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/introduction).

### Início e sino
- Início: resumo do dia (recebimentos, vendas, saídas) com **valores ocultos por
  padrão** (tela virada para o cliente); histórico de fichas com filtro por data e
  pagamento. Estoque baixo e contas vencidas ficam nas seções delas e no sino.
- Sino: notinha em atraso, notinha que vence em até 3 dias, produto zerado,
  estoque baixo, cadastro rápido a completar, rascunho de nota; do mais grave ao
  menos grave. Lido volta a ser novo se o texto mudar.

### Notas fiscais (fora do escopo atual)
- Área mínima: Entradas e Saídas simuladas; "Preparar nota" cria rascunho para
  revisão. Emissor provável: Focus NFe (~98%). Tipo fiscal e campos dependem da
  contabilidade. Rascunho nunca aparece como nota emitida. Impressão, extrato e
  exportação mostram "Ainda sem destino" até existir o programa fiscal.

---

## Regras de interface

Detalhe de como a interface está montada: `AGENTS.md`, "Interface: como está
montada". O que é decisão (e o porquê):

- **CSS por componente** (escolha do Victor): `.css` ao lado do `.tsx`, classes
  `bloco__parte--variante`; Tailwind só para preflight e tokens. Por quê: achar e
  mudar um estilo num lugar só.
- **Tokens só em `src/estilos/tokens/`.** Situação na família pastel: ok,
  atencao, critico, neutro. Vermelho forte só para saída de dinheiro e erro.
- **Ícones do acervo** (`Icons.pdf`), nunca Lucide/Material; fonte Inter local;
  nenhum link externo.
- **Calendário do app em toda data** (`SeletorData`; em formulário, `CampoData`).
  Nenhum `type="date"` do Windows.
- **Movimento mínimo:** GSAP só em microinterações úteis (160 ms; barra lateral
  280 ms), respeitando `prefers-reduced-motion`. Ao animar a barra lateral,
  ícones e logo ficam ancorados à esquerda (centralizar pela largura instantânea
  fazia tudo saltar).
- **Só o essencial:** campo e função que fazem sentido para a papelaria; nada de
  enfeite. Um texto por informação.
- Rotas em modo hash (`#/clientes`): funciona em `file://` no Electron; o
  usuário não vê endereço.
- A barra de menu padrão do Electron (File/Edit/View/Window) fica como está, por
  decisão do Victor.

---

## Decisões de arquitetura

### `2026-09-22` — Repo único, dono por pasta
Um repo, dono por pasta (`src/` do parceiro; `electron/` e `supabase/` do
Victor). **Por quê:** no mesmo repo o contrato é o mesmo arquivo para os dois,
sem pacote npm para sincronizar. Descartado: dois repos + pacote de contrato; o
parceiro entregar React solto e integrar no fim.

### `2026-09-22` — O front escreve o contrato; o back revisa num portão
O contrato é o vocabulário do domínio, e quem faz a reunião com o cliente é o
parceiro. Com o back ficam atomicidade, catálogo de falhas e gestos
irreversíveis (`revisao-de-contrato.md`). Portão: depois da primeira ou segunda
tela, antes da terceira.

### `2026-09-22` — Um tipo, três implementações
`Contrato` existe uma vez; ponte, real e mock se declaram `: Contrato`, e o
compilador cobra a sincronia (no `upload-sys` era espelho mantido à mão).

### `2026-09-22` — Canal de IPC = nome da operação
`main.ts:registrar` percorre as chaves de um objeto tipado. Conjunto de canais
fixo em build; `ipcRenderer` nunca chega ao renderer. Renomear operação é mudança
de contrato de verdade.

### `2026-09-22` — Erro por retorno tipado, não por exceção
Toda operação devolve `Resultado<T>`; exceção vira `Falha` com o texto cru só no
log (mensagem de driver carrega URL de conexão).

### `2026-09-22` — O mock falha e demora por padrão
220 ms em toda resposta e painel para forçar cada falha: mock que só acerta
esconde dois terços da tela.

### `2026-09-25` — Base local única: fatos guardados, consequências calculadas
Uma base no `localStorage` só com fatos; situação e totais são funções puras
testadas (`derivados.ts`). Semente relativa a hoje. Camada local do front, fora
do contrato; sai quando o mock do contrato entrar. Fato novo entra em
`mock/base/tipos.ts` e na semente, nunca em arquivo da tela.

### `2026-09-23` — Segurança do Electron
Bloqueio de novas janelas e navegação externa; remetente de cada IPC validado.
Referências em `docs/electron.md`.

---

## Perguntas em aberto (antes do contrato fechar)

- **Login / multiusuário?** Muda o sentido de `permissao` e pede sessão.
- **Funciona sem internet?** Muda o contrato inteiro (cache, fila, conflito).
- **Duas pessoas na mesma tela?** Define se existe `conflito` de verdade.
- **Impressão / exportação / PDF?** Se sai do processo principal, é operação.
- **Qual provedor de banco?** Supabase por inércia do `upload-sys`; nada depende.

---

## Aprendizados reaplicáveis

- **Contrato como tipo único com N implementações** vale para qualquer separação
  front/back em TypeScript; a ponte pode ser IPC, HTTP ou nada.
- **O mock é o contrato, escrito de forma implícita.** Dar nome de arquivo ao que
  já existe é a intervenção mais barata num trabalho a dois.
- **"Quem escreve o contrato" é a pergunta errada.** A certa: quais partes só um
  dos dois consegue ver.
- **Desfazer sem apagar:** estorno na data do estorno mantém os dias fechados
  intactos; estorno que conta como entrada infla os dois totais — abater do
  próprio lado.
- O formatador de moeda usa espaço não separável depois de "R$": teste com
  valor monta o esperado com `reais()`.
