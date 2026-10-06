# Memoria — papelaria-opcao

Estado vivo do projeto: onde estamos, o que falta e as regras que valem hoje,
com o porquê. O que o código faz está no código e no git. O passado sessão a
sessão (ideias descartadas, números antigos) está em
`docs/historico/`. A sessão mais recente está em
`docs/historico/2026-10-01-revisao-com-victor.md`.

**Como manter este arquivo:** uma lista de pendentes só, no topo. Decisão nova
entra na seção da área, substituindo a antiga (não empilhar "atualizado em").
Relato de sessão longo vai para `docs/historico/`.

---

## Onde estamos — `2026-10-06`

**Rumo atual: versão 0.1 (piloto online) para a loja testar.** Ver "Decisões de
arquitetura", `2026-10-06`. O banco local de `2026-10-05` é o alvo da 1.0.

**Estado da 0.1 (`2026-10-06`, branch `piloto-0.1`):** app ligado ao Supabase
(login, base como documento único com revisão e 200 versões anteriores, cópia
local e envio quando a internet volta), semente de 20 produtos sob pedido, nome
"Papelaria Opção" com ícone da marca, Notas fiscais oculta e exportação para a
Emitte bloqueada (interruptores em `src/funcoes.ts`; dados fiscais do produto
comentados no cadastro). Instalador Windows gerado pelo GitHub Actions a cada
tag `v*` (`.github/workflows/release-win.yml`), publicado como Release.
Exercitado no Electron contra Supabase local e contra o projeto de **teste**
(`papelaria-dev`, migration aplicada, semente carregada). 101 testes; build ok.
**Falta:** testar o instalador numa máquina Windows, criar e migrar o projeto
**piloto** (conta da Attlas), instalar na loja. Passo a passo: `docs/piloto.md`.

**Prazo da 0.1 (`2026-10-06`): no máximo 2 dias.** Emitte e formato do piloto
ficam para reunião do Agostinho mais tarde; materiais em `docs/materiais-recebidos/emitte/` (sem API: a
integração é por arquivos e a nota é montada à mão na Emitte). Notas do piloto
em **homologação**. Supabase: piloto na conta da Attlas, dev na conta pessoal do
Agostinho.

**Emitte fora da 0.1 (`2026-10-06`, reunião):** o piloto não integra com a
Emitte; as notas da loja seguem como hoje. Deixar o ambiente preparado e o fluxo
explicado para o cliente; a integração (por arquivos — ver `docs/materiais-recebidos/emitte/`) vem depois.
"Ambiente preparado" = **os campos fiscais já existem no cadastro** (produto:
NCM, origem, CFOP, CEST, grupo de tributação, código de barras com dígito
verificador; cliente: dados que a Emitte exige para NF-e), sem exportação ainda.
Operador do piloto: **"Loja"**.

**Dados fiscais na Emitte, não no app (`2026-10-06`, Agostinho):** a seção
"Dados fiscais" saiu do cadastro de produto (código comentado, não apagado). A
dona cadastra o produto normal no app, o app exporta o XML de produtos e ela
completa NCM/tributação/CFOP **na própria Emitte**. **Por quê:** se a Emitte
mudar regras, o app não precisa mudar; e o campo ela teria de preencher de
qualquer jeito, tanto faz onde. O XML leva NCM em branco.

**Teste na Emitte (`2026-10-06`):** a importação aceitou os 20 produtos (0
erros); o NCM em branco vira `00000000` (a IA da Emitte avisa que não é
permitido); tributação e CFOP vêm da tela de importação (na primeira vez foi
1101/2101, de compra — o certo para revenda é 5102/6102). **Reimportar o mesmo
XML DUPLICA os produtos**, embora a Emitte diga que atualiza; motivo não
descoberto. Por isso o botão **"Exportar produtos para a Emitte" está bloqueado
no piloto**. Ele fica no **Estoque**; a área de **Notas fiscais está oculta** (menu
e "Preparar rascunho" na ficha) enquanto a loja emite pela Emitte. Os dois
interruptores ficam em `src/funcoes.ts`. Pendente: achar
como a Emitte reconhece um produto já cadastrado (código de barras? código na
nota? nome?) e decidir se o NCM fica no app (por categoria) ou só na Emitte.

**Planilhas da Emitte (`2026-10-06`):** os modelos v2 de importação por XLS
(clientes e produtos) estão em `recursos/emitte/` (cópia dos recebidos). O app
gera as duas planilhas preenchendo o próprio modelo, com textos compartilhados
(nunca "inline strings"), via `fflate` (`src/dados/planilha.ts`, `emitte.ts`).
- **Clientes:** só vão os completos (CPF/CNPJ, CEP, rua, bairro, cidade/UF —
  cidade conferida contra a lista do modelo); os outros voltam com o que falta.
  Tipo de contribuinte e tipo de cliente são obrigatórios — por isso o bloco
  "Para nota fiscal" do cliente **fica**. Botão em Clientes, **desligado** até o
  teste de importação passar (`funcoes.exportarClientesEmitte`).
- **Produtos:** na planilha, NCM e CFOP vão por produto (CFOP 5102/6102); NCM em
  branco. **A testar:** se a planilha aceita NCM em branco e se reimportar por
  planilha **atualiza** em vez de duplicar (o XML duplicou). Ainda sem botão.
- Arquivos de teste gerados fora do app: `release/emitte-teste/` (não versionado).

**Testes na Emitte e decisão (`2026-10-06`):**
- **A importação da Emitte só CRIA, nunca atualiza.** Reimportar o mesmo produto
  (mesmo código de barras e código na nota) gerou outro com novo ID interno.
  A planilha não tem coluna de ID: não há atualização por arquivo.
- **Decisão (Agostinho): cada produto e cada cliente vai para a Emitte UMA vez.**
  O app exporta só os ainda não enviados e marca `emitteEnviadoEm` **só quando a
  dona confirma** "Já importei na Emitte". Editar não apaga a marca. Mudança de
  preço/nome depois do envio: alterar também na Emitte, à mão.
- **NCM fica só na Emitte, de vez:** como nada é reenviado, o que ela preenche lá
  nunca é sobrescrito. Nenhum dado fiscal de produto no app.
- **Produtos vão pela planilha, não pelo XML:** a planilha trouxe CFOP 5102/6102
  e NCM em branco ("SELECIONE", obrigatório lá); o XML trazia `00000000` em
  silêncio e CFOP da tela de importação.
- **Clientes:** "Isento" aceito em SP; CNPJ repetido é aceito (duplica);
  **sem tipo de logradouro a Emitte recusa** — e a lista dela não tem Praça,
  Alameda, Estrada, Largo. Esses clientes ficam de fora com aviso para cadastrar
  direto na Emitte. A observar: o telefone celular do cliente B apareceu com um
  dígito a menos na Emitte.
- Botões ligados só em `npm run dev` (`funcoes.ts`); no instalador, desligados
  até o Agostinho liberar.

**SINTEGRA (`2026-10-06`, para depois):** o contador perguntou. Pesquisa: em SP,
empresa do Simples gera e guarda o arquivo (Convênio ICMS 57/95) e só entrega
se notificada; as notas (registros 50/54) o contador gera dos XMLs da Emitte; o
que só o app tem é o **inventário** (registros 74/75), que pede NCM e custo.
Perguntas para o contador: arquivo ou consulta de IE? só inventário? formato
(planilha ou 74/75)? estado da loja e se vende para fora?

**Desenho da 0.1 (`2026-10-06`, aceito):** a base inteira vira **um documento só**
numa tabela do Supabase (`jsonb`), lido e gravado pelo processo principal
(`carregarBase`/`salvarBase`); regras e telas continuam as da base local, com
cópia no computador para abrir sem internet. **Descartável** — a 1.0 faz o
contrato por operação. A loja usa **Windows** (há como testar antes). Começa
**vazia**; uma semente de ~20 produtos existe, mas só é carregada se a loja
pedir. O botão "Restaurar dados de exemplo" **sai** do piloto. Dados do piloto
se perdem na 1.0 (a loja já sabe); reforçar "só dados inventados".


Só a interface existe, rodando contra uma **base local** (`src/mock/base/`,
`localStorage`). Tudo o que se faz nas telas grava e aparece igual em todas.
Ainda não há contrato de verdade, banco nem `supabase/`; `comum/contrato.ts` tem
só a operação de exemplo `ping`.

- Rodar: `npm run dev` (Vite na porta 5173 e Electron com atualização automática)
  ou `npm start` (build e Electron). Reutilizar a instância aberta durante a revisão.
- Conferir: `npm test` (75 testes da camada de dados) e `npm run build`.
- Última rodada: revisão por telas com o Victor, usando prints e o Electron.
  Início e Clientes tiveram a revisão desta rodada encerrada e as correções
  pedidas implementadas. **Financeiro e Caixa NÃO VALIDADOS pelo Victor:** agora
  são telas independentes, prontas para continuar a avaliação.
- Verificação técnica mais recente: 75 testes passam; build concluído; telas
  separadas conferidas no Chromium a 1300 e 900 px, sem erro de JavaScript ou
  transbordamento do documento, e abertas pelo menu no Electron. Isso não
  substitui a validação de uso do Financeiro e do Caixa.
- Branch: `main`, que já contém tudo de `analise-de-funcao` (mesmo commit, `fe08494`).
- **Virada de `2026-10-01`:** o Agostinho (back) assume o contrato e toda a parte
  interna, inclusive a camada de dados de `src/`. Ponto de partida: o mapa tela a
  tela em `docs/contrato/inventario.md`. O que afetar o Victor vai em
  `docs/contrato/mudancas.md`.
- "Restaurar dados de exemplo" (botão do operador, rodapé da barra lateral)
  refaz a amostra de 90 dias até hoje.
- Na prévia de desenvolvimento, o cenário pedido pelo Victor acrescenta três
  fechamentos recentes e um mais antigo, incluindo uma falta de R$ 10,00 com
  motivo. Os movimentos físicos trazem "Exemplo" na descrição; as contagens
  conferem com esses movimentos. Preserva o caixa atual, não sobrepõe turnos
  existentes e não duplica exemplos ao recarregar. Não cria dados na versão
  de produção nem altera receitas/despesas.

---

## Como retomar com o Victor

O objetivo é manter as regras robustas e tornar a interface simples para a dona,
que não trabalha com tecnologia. O Victor simula o usuário e aponta telas,
componentes e mensagens; explicar o que o código realmente faz antes de sugerir
mudanças. Prosseguir pela área indicada, sem ampliar a rodada por conta própria.

| Área | Situação desta rodada |
| --- | --- |
| Início | Revisão encerrada; ajustes solicitados feitos. |
| Clientes, detalhe e vendas sem identificação | Revisão encerrada; ajustes solicitados feitos. |
| Financeiro e Caixa | Separados em duas telas e itens do menu conforme `docs/superpowers/plans/2026-10-01-separar-financeiro-caixa.md`. **NÃO VALIDADOS pelo Victor**. Retomar aqui. |
| Estoque, nova ficha e demais áreas | Ainda não percorridas nesta rodada por telas; há verificações técnicas anteriores. |

Tarefas feitas e roteiro detalhado: `docs/historico/2026-10-01-revisao-com-victor.md`.

---

## PENDENTE

*Retomar na próxima sessão — prioridade:*
- [ ] **Validar Financeiro e Caixa com o Victor** após a separação: no Caixa,
  percorrer o cenário de fechamentos e a rotina de abrir/adicionar/retirar/fechar;
  no Financeiro, revisar filtro de datas, resumo, movimentos e estornos. Não
  marcar as áreas como validadas apenas porque os testes e o build passam.

*Decidir com a dona:*
1. Cancelar ficha: hoje liberado em qualquer data. Limitar a "só no mesmo dia"?
2. Devolução parcial de itens: adiada pelo Victor; hoje só se cancela a ficha inteira.
3. A retirada física fica separada das despesas no Financeiro e reduz o
   esperado da gaveta. O histórico agora está na seção Caixa, com
   destino/motivo em texto. Controle do saldo de cofre segue em aberto.
4. Custo por lote na entrada. Proposta a levar: um produto só; cada entrada
   guarda o custo do lote; o produto mostra "10 un a R$ 8,00 (lote 03/09) · 30 un
   a R$ 10,00 (lote 29/09)"; a venda consome o mais antigo. Perguntar se ela
   usaria ou se o último custo basta. Hoje cada entrada guarda seu custo no
   movimento, sem alterar o cadastro nem criar fila de lotes. (Descartado: cadastrar o produto duas
   vezes, um por lote — o código de barras não diz o lote e o saldo se parte.)
5. Pix e cartão: o fluxo interno já registra o meio informado; uma camada
   futura integrará maquininha/banco e tratará crédito/débito, parcelas, taxas
   e liquidação. Isso não bloqueia o teste funcional atual.

*Decidir com o Victor:*
6. Regras de CPF e aviso de nome repetido no cadastro de cliente (adiado).
7. ~~`attlas-cobranca-automatica.txt` fica ou sai?~~ Fica (`2026-10-06`): é a
   cobrança da Attlas, que o estudo de licença prevê ler. Ver
   `docs/materiais-recebidos/README.md`.

*Visual, a conferir (anotados em 2026-09-25):*
8. Painel "Cadastro" do detalhe do cliente estica até a altura dos três cartões
    e sobra espaço embaixo.
9. A Revisão da nova ficha repete o total do painel Valores.

*Testar:*
10. Leitor de código físico no Electron.
11. A versão atual inteira no Electron.

*Antes de distribuir:*
12. Licença do pacote de ícones do acervo; ícone do aplicativo
    (`electron-builder.json` não aponta nenhum).

*Back — próximos passos (Agostinho), em ordem:*
13. **Responder as perguntas que ainda travam** (seção "Perguntas em aberto"):
    login/operadores, dados iniciais da loja, atualização do app, impressão.
    Máquina, internet e banco já estão decididos (`2026-10-05`).
14. **Mock do contrato sobre a base local:** `src/mock/api.ts` implementa o
    `Contrato` usando a base que já existe, com o atraso e as falhas do
    `simular`. As telas migram de `useEstadoDemonstracao()` para `window.api`
    **uma área por vez** (Clientes → Estoque → Ficha/Notinha → Financeiro/Caixa),
    e cada uma ganha os estados de carregando e falha (regra 6).
15. **Em paralelo:** banco local SQLite (`node:sqlite`) no processo principal:
    schema e migrations do SQLite, escritas atômicas em transação, seed com as
    patologias da base local, e os 75 testes de regra portados como
    especificação do back. Migration testada numa cópia com dados no formato
    antigo antes de chegar à máquina da loja (regra 8).
16. `electron/operacoes.ts` real, área por área, na mesma ordem do 14.
17. Backup: cópia do arquivo para o Supabase (no máximo a cada 5 min com
    mudança + ao fechar), cópias locais diárias, e restauração testada.

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
  cadastro leva ao Estoque para cadastrar e contar antes de vender; a ficha em
  andamento fica guardada para ser retomada.
- **A venda em andamento se guarda sozinha** (rascunho único na base); o Início
  oferece "Retomar ficha". "Limpar ficha" zera tudo, inclusive cliente e forma.
- **Bloqueios ao concluir:** sem cliente, sem item, desconto maior que o
  subtotal, dinheiro recebido menor que o total, notinha sem vencimento ou com
  vencimento antes de hoje, entrada que cobre o total, produto sem saldo
  suficiente e pagamento misto cuja soma não fecha ou cujo dinheiro entregue
  é menor que a parcela em espécie.
- **Sem saldo, sem venda:** conferir a prateleira e registrar entrada ou ajuste
  no Estoque antes de concluir. A ação de dados também recusa a venda sem
  alterar ficha, financeiro ou estoque.
- **Pagamento misto à vista:** distribuir exatamente o total entre pelo menos
  dois meios, cada um com valor positivo. Cada parcela aparece separada no
  Financeiro; o troco é calculado só sobre a parte em dinheiro.

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
  - **Cancelar ficha** (página e janela da ficha): a baixa registrada volta ao estoque
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
- Os cartões de notinhas contam **clientes**, não a quantidade de notinhas:
  quarenta notinhas em atraso de quatro clientes correspondem a "4 clientes".
  Hoje a classificação dá prioridade ao atraso: quem tem notinha atrasada aparece
  em atraso mesmo se também tiver outra a vencer; não é contado nas duas situações.
- Lista alfabética com número estável (`CLI-0104`), busca no topo, filtros
  "Notinhas a vencer" e "Notinhas em atraso" (contam clientes). Linha expande
  com as três compras recentes; "Ver histórico completo" abre o cliente.
- A busca de clientes aceita CPF/CNPJ e telefone com ou sem pontuação e nomes
  sem acento. A mesma regra vale no cabeçalho e na identificação da nova ficha.
- Cadastro e edição num formulário só, em gaveta (ou janela na ficha): só o nome
  é obrigatório; documento repetido é barrado; endereço gravado como
  "Rua, nº - Bairro - Cidade/UF". Não se cadastra e-mail (decisão do Victor):
  o contato é por telefone/WhatsApp, sem esse campo nos formulários ou detalhes.
- Detalhe do cliente: cartões Total comprado, Notinhas em aberto (clicar recebe)
  e Ticket médio; histórico com filtros e "Receber" por linha.
- Receber notinhas permite Dinheiro, Pix, Cartão ou Misto, inclusive em pagamento
  parcial e com várias notinhas selecionadas. No Misto, duas ou três formas
  somam exatamente o valor a pagar agora; só a parte em dinheiro calcula troco
  e entra na gaveta. O recebimento abate as notinhas da mais antiga para a mais
  nova, conserva cada meio no histórico/Financeiro e grava tudo junto.
- Vendas sem identificação: filtros Todos, Dinheiro, Pix e Cartão, sem filtro
  exclusivo para Misto. Vendas mistas aparecem em cada meio usado e conservam
  a divisão dos pagamentos no detalhe da ficha, como no Início.
- O calendário de vendas sem identificação permite hoje e qualquer dia passado;
  datas futuras são bloqueadas também na digitação e na navegação por teclado.

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
- Entrada completa preserva data física do recebimento, fornecedor, referência,
  observações e custo informado por item no histórico. A data do lançamento
  continua sendo a data atual, mantendo a ordem dos saldos antes/depois.
- Cadastrar produto (topo do Estoque) aceita bipe; código já cadastrado mostra o
  produto existente em vez de duplicar.

### Financeiro
**Situação de validação: NÃO VALIDADO pelo Victor.** As regras abaixo descrevem
o que foi discutido e implementado; a avaliação de uso continua na próxima sessão.

- Tela e item próprios no menu. Não apresenta prévia do Caixa nem transferências
  físicas da gaveta. "Registrar movimento" oferece Entrada e Despesa em janela
  central compacta; vendas e recebimentos de notinhas vêm das fichas.
- Atalhos Hoje, Esta semana, Este mês, Este ano e consulta livre De/Até,
  inclusive de um único dia antigo. Cartões, gráfico, contagens e tabela usam
  o mesmo intervalo; "Todos os meios" reúne Pix, cartão e dinheiro dentro dele.
  A tabela mostra até 15 registros por página, com rolagem da tela quando
  necessário, sem reduzir a lista a uma linha pelo espaço restante.
  Cada pagamento registrado numa ficha (venda, entrada ou recebimento de
  notinha, **em qualquer meio**) vira uma linha; lançamento manual também.
- **Estorno abate do próprio lado:** desfazer venda reduz Entradas, desfazer
  despesa reduz Saídas; selo "Estorno".
- Os três cartões resumem somente o período selecionado. Entradas menos
  despesas não representa lucro nem saldo bancário; não há comparação com o
  período anterior. A tabela "Movimentações financeiras" contém somente fatos
  financeiros e seus estornos.
- Transferências físicas e seus estornos ficam na seção Caixa. As categorias
  antigas "Troco" e "Saída de caixa" são classificadas como registros físicos
  para consulta, sem alterar seus valores, sinais ou datas persistidos.
- Exportar período para a contabilidade: botão ainda sem destino; formato a combinar.

### Caixa
**Situação de validação: NÃO VALIDADO pelo Victor.** A gaveta tem tela e item
próprios no menu, sem filtro Dia/Semana/Mês/Ano do Financeiro.

- Retirada física só aceita dinheiro, fica fora das despesas financeiras e
  reduz o esperado na conferência da gaveta.
- Conferência em espécie: abertura com contagem, somente movimentos lançados
  durante aquele turno, fechamento com valor contado e justificativa obrigatória
  para diferença. Pix/cartão não entram. A abertura é opcional e informa todo
  dinheiro já na gaveta, inclusive troco vindo do dia anterior. Movimentos
  antigos entram nessa contagem inicial, sem recalcular períodos fechados.
- "Caixa atual" acompanha o turno aberto e mostra "Esperado na gaveta". Sem
  caixa aberto, orienta a contar o dinheiro e oferece "Abrir caixa".
- Abertura, retirada e fechamento usam janelas centrais compactas. "Cancelar"
  apenas sai da janela; "Fechar caixa" registra a contagem final. Diferenças são
  explicadas como falta ou sobra e exigem "Motivo da diferença". Abertura não
  lança receita e fechamento não cria despesa. Só um caixa permanece aberto;
  não há abertura ou fechamento automático na virada do dia.
- "Abrir caixa" aparece no lugar das ações do caixa aberto quando não existe
  turno aberto. Pode ser usado em qualquer horário; depois de confirmar um
  fechamento, reaparece. A rotina de abrir ao chegar e fechar ao sair depende da
  pessoa. Vendas e recebimentos não são bloqueados pela falta de conferência.
- O Caixa atual identifica a abertura com ícone de dinheiro, data/horário e
  operador em linhas separadas. "Adicionar dinheiro" pede valor e "Origem ou
  motivo"; "Retirar dinheiro" pede valor e "Destino ou motivo". As duas ações
  exigem caixa aberto, conservam operador/vínculo e alteram só o esperado da
  gaveta. Reforço de troco não é receita, retirada não é despesa; seus estornos
  também ficam fora dos totais financeiros. Compra/conta continua sendo despesa.
  Registros antigos sem turno vinculado seguem consultáveis com seus valores
  e sinais originais. O histórico também mostra estornos físicos e seu motivo.
- Fechamentos dos últimos sete dias corridos (hoje e seis anteriores) aparecem
  abaixo do Caixa atual, com data do fechamento, dinheiro contado, situação e
  "Ver". Cada fechamento é individual, sem somar saldos entre dias.
- "Consultar outro período" abre o histórico com datas De/Até, atalhos Últimos
  7 dias e Este mês; nenhuma data futura. Fechados são filtrados pelo dia do
  fechamento em São Paulo, inclusive quando abertos em outro dia; abertos pela
  abertura. O histórico separa Aberturas e fechamentos / Adições e retiradas.
  Conserva contagens, esperado, diferenças, motivos, operadores e estornos;
  "Ver" abre os movimentos em dinheiro e as fichas do caixa escolhido.
  Fechamentos anteriores são preservados.
- Novos movimentos, pagamentos e estornos guardam o operador da base local;
  isto identifica o operador configurado, sem autenticar quem está na máquina.

### Pagamentos (Pix e cartão)
- A funcionária marca Pix ou cartão **depois de conferir** no balcão; não há
  etapa "aguardando conferência".
- Na base local todo pagamento marcado entra no Financeiro. Em produção a tela
  não muda; muda **de onde** vem o registro (pendente 5). Não assumir que a API
  do Mercado Pago cobre Pix de outro banco nem cobranças feitas fora do app;
  não prometer caixa completo antes de testar com transações reais. Separar
  total recebido do saldo líquido da conta (taxas e prazo de liberação).
  Referências: [busca de pagamentos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/search-payments/get),
  [dinheiro em conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/introduction).

### Início e sino
- Início: resumo do dia (recebimentos, vendas, saídas) com **valores ocultos por
  padrão** (tela virada para o cliente); histórico de fichas com filtro por data e
  pagamento. Estoque baixo e contas vencidas ficam nas seções delas e no sino.
- O Início se concentra no dia atual, com informação essencial para o balcão.
  O cartão Recebimentos do dia mostra só o título e o valor, sem comparação com
  ontem, percentual de variação ou frase sobre o movimento anterior (decisão do Victor).
- O filtro de data do histórico permite consultar qualquer dia passado e hoje,
  inclusive meses e anos anteriores, sem limite mínimo. Datas futuras ficam
  bloqueadas no calendário, nas setas e na digitação; o filtro afeta só as fichas.
- Os filtros de pagamento são Todos, Pix, Cartão, Dinheiro e Notinha. Não há
  filtro exclusivo para Misto (decisão do Victor): uma venda mista aparece em
  Todos e em cada meio usado no pagamento. O detalhe da ficha conserva a divisão
  dos valores; nas notinhas, mostra a entrada e os recebimentos registrados.
- Revisão com o Victor: manter uma única janela do Electron em desenvolvimento
  (`npm run dev`), aproveitando a atualização automática da interface. Reutilizar
  essa janela nas alterações do front, sem abrir outra instância a cada conferência.
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

### `2026-09-22` — Repo único
Um repo para os dois lados. **Por quê:** no mesmo repo o contrato é o mesmo
arquivo para os dois, sem pacote npm para sincronizar. Descartado: dois repos +
pacote de contrato; o front entregar React solto e integrar no fim.

### `2026-10-06` — Duas versões: 0.1 (piloto online) e 1.0 (produção)
A loja **ainda não fechou** contrato. A Attlas monta o sistema para a loja
testar no dia a dia, com **simulações** (produtos e clientes fictícios), gerar
interesse e só então combinar valores — método de conquistar cliente.
- **Versão 0.1 — piloto:** tudo **online**, app ligado a um **Supabase free**;
  **login único da loja** só por consciência (dona + funcionária, sem
  restrição por pessoa); emissão de **NF-e e NFC-e pela Emitte** já no piloto,
  com **cupom em impressora térmica**; instalação e atualização **manuais**,
  com a Attlas monitorando.
- **Versão 1.0 — produção:** começa quando a loja aceitar. Aí entra o desenho
  de `2026-10-05` (banco local, backup, sem criptografia consciente) e a
  segurança completa. Supabase pago.
- Respostas que valem para a 1.0: dados entram do zero (de começo só produtos;
  clientes e notinhas conforme a demanda); 2 pessoas, um usuário na máquina,
  sem restrição por pessoa; uma máquina só.

**Por quê:** a 0.1 precisa estar funcionando rápido e ser fácil de testar na
loja; o investimento pesado só se justifica com o acordo fechado. O que liga as
duas é o **contrato**: as telas falam com `window.api` nas duas, e a troca de
online para local fica só em `electron/operacoes.ts`.

### `2026-10-05` — Banco local (SQLite) e cópia do arquivo na nuvem (alvo da 1.0)
Uma máquina só, sem acesso aos dados fora da loja, e a venda precisa continuar
quando a internet cai (a nota fiscal fica pendente). Então:
- **Fonte da verdade: SQLite na máquina**, aberto pelo processo principal com
  `node:sqlite` (já vem no Electron; nenhum módulo nativo).
- **Nuvem = backup:** uma cópia do arquivo sobe para o armazenamento do
  Supabase no máximo a cada 5 minutos quando houve mudança, e ao fechar o app.
  Perda máxima aceita se o disco morrer: esses minutos. Sem schema de negócio
  no Postgres. Credencial: chave `anon` + login, nunca `service_role`.
- **Nota fiscal:** fila local; sem internet fica pendente e sai quando volta.
- **Modelo preparado para crescer:** id interno único (UUID) com o número da
  ficha só para exibir; movimentações só inseridas. Se um dia vier segunda
  máquina ou acesso remoto, o passo seguinte é o espelho linha a linha.
- **Sem criptografia do banco no app**, de propósito. Ela só cobre o disco fora
  do lugar (roubo, conserto, descarte), e isso a criptografia do Windows cobre
  melhor e de graça. O custo no app seria módulo nativo permanente
  (`better-sqlite3-multiple-ciphers`). No lugar: senha na conta do Windows da
  loja, BitLocker/"Criptografia do dispositivo" se a máquina tiver, bucket de
  backup privado. **Revisitar** se virar produto para várias lojas.

**Por quê:** só na nuvem, a internet caída para o balcão — e "nota pendente" só
existe se a venda acontece. Descartados: espelho linha a linha no Postgres
(dois schemas para manter sem ninguém consultando de fora) e sync nos dois
sentidos/PowerSync (só se paga com mais de um escritor). Origem: estudo
`docs/materiais-recebidos/estoque-electron-licenca-e-banco.docx`; a parte de licença e vários clientes
continua só estudo.

### `2026-10-01` — O back escreve o contrato e cuida de toda a parte interna
Victor: o que o usuário vê (telas, textos, visual). Agostinho: `electron/`,
`supabase/`, `comum/contrato.ts` e a camada de dados dentro de `src/`. O
Agostinho também pode mexer na tela, com aval do Victor: o mínimo possível, só
o que acrescenta ou se torna obrigatório (estado de carregando, de falha), no
padrão visual existente. Sem revisão do Victor; o que o afeta vai em
`docs/contrato/mudancas.md`.
**Por quê:** o processo anterior ("o front escreve o contrato, o back revisa
antes da terceira tela") não aconteceu — as telas foram todas feitas direto sobre
a base local, com o contrato só com `ping`. O vocabulário já existe em
`src/mock/base/tipos.ts`; esperar um corte do front só atrasaria.
Substitui: `2026-09-22` "O front escreve o contrato; o back revisa num portão" e
`2026-09-22` "dono por pasta" (`src/` do front; `electron/` e `supabase/` do back).

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

**Respondido em `2026-10-03`:** o sistema da Papelaria Opção roda em **uma máquina
só** (Agostinho). Com um único escritor não há conflito de edição nem numeração
repetida entre máquinas. O documento `docs/materiais-recebidos/estoque-electron-licenca-e-banco.docx`
(banco local + sync, licença por inadimplência, vários clientes) é **estudo**,
ainda em discussão, não decisão.

- **Login / multiusuário?** Muda o sentido de `permissao` e pede sessão.
- ~~Funciona sem internet?~~ Decidido em `2026-10-05`: sim, banco local (ver
  "Decisões de arquitetura").
- **Impressão / exportação / PDF?** Se sai do processo principal, é operação.
- ~~Qual provedor? Que credencial?~~ Decidido em `2026-10-05`: Supabase só para
  backup (e depois a nota), com chave `anon` + login.
- **Rascunho da ficha e avisos lidos:** ficam na máquina ou no banco? Com uma
  máquina só, ficar na máquina basta.

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
