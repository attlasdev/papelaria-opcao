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

## Onde estamos — `2026-10-21`

**Rumo atual: a 1.0 foi aprovada pelo cliente em `2026-10-21`.** Antes de
planejar a execução foi feita uma checagem completa do projeto (commit
`000cb47`, v0.1.7): `docs/auditorias/2026-10-21-checagem-1.0.md`. Ela traz os
defeitos da 0.1, os riscos da 1.0 e as decisões em aberto, resumidas no
PENDENTE. O desenho da 1.0 segue o de `2026-10-05` (banco local) e o de
`2026-10-06` (contrato por operação); até ela chegar, a 0.1 é o piloto.

**Estado da 0.1 (`2026-10-06`; tudo no `main`, que está à frente do branch `piloto-0.1`):** app ligado ao Supabase
(login, base como documento único com revisão e 200 versões anteriores, cópia
local e envio quando a internet volta), semente de 20 produtos sob pedido, nome
"Papelaria Opção" com ícone da marca, Notas fiscais oculta e exportação para a
Emitte bloqueada (interruptores em `src/funcoes.ts`; dados fiscais do produto
comentados no cadastro). Instalador Windows gerado pelo GitHub Actions a cada
tag `v*` (`.github/workflows/release-win.yml`), publicado como Release.
Exercitado no Electron contra Supabase local e contra o projeto de **teste**
(`papelaria-dev`, migration aplicada, semente carregada). Release **v0.1.0**
gerada pelo Actions (confirmado pelo Agostinho); **v0.1.1** acrescenta a
maquininha Mercado Pago em demonstração, exportação para a Emitte preparada
(desligada), logo sem o selo, "restaurar" desligado e `conexao.json` tolerante
(BOM, espaços; recusa chave secreta); **v0.1.2** (`2026-10-07`) acrescenta
o "Exportar período" do Financeiro em planilha e o atalho "Mês passado".
Em `2026-10-21` (v0.1.7): 163 testes, typecheck e build ok. O projeto
**piloto** (a produção da loja, conta da Attlas) já está criado e migrado: ver
o parágrafo abaixo.
**Em teste na loja (confirmado pelo Agostinho em `2026-10-23`):** a 0.1 está
instalada e funcionando conforme o esperado; uso só para teste, com dados
inventados (decisão de `2026-10-23`, no PENDENTE). Passo a passo de instalação:
`docs/piloto.md`.

**Banco da loja (produção `kjntvpksckmkfqjznatx`) em `2026-10-19`:** migration
aplicada (RLS ligado, cadastro público desligado, usuário `papelaria@loja.com`).
Está **PREENCHIDO COM DADOS DE EXEMPLO**, regravado na **revisão 37** no
formato de serviços sem cadastro: semente de demonstração (24 clientes, 16
produtos, 90 dias até 19/10, caixa com turnos de exemplo, 2 rascunhos de nota)
mais 16 fichas de serviço (4 com produtos, 6 perdas), operador "Loja". A
revisão 36 ficou em `base_loja_anteriores`. **É a base que a loja está usando
no teste, a pedido dela** (Agostinho, `2026-10-23`): não limpar. Se um dia for
preciso limpar, fazer **pelo `salvar_base` ou limpando `base_loja` e
`base_loja_anteriores` juntas.** Apagar só a linha de `base_loja` faz a revisão
recomeçar em 1: a segunda gravação colide com a revisão 1 antiga guardada e o
app trava em "Sem conexão" (checagem `2026-10-21`, A2; passo a passo em
`docs/piloto.md`, seção 4). Instalada na loja: **v0.1.7**; a **v0.1.9** (`2026-10-23`: correções da 0.1.8, NCM/CEST no produto, cadastro pela ficha, ficha em uma coluna, filtros do Estoque e Boletos) vai substituir.

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
  nunca é sobrescrito. Nenhum dado fiscal de produto no app. **Revisto em
  `2026-10-23`** (pedido da loja): NCM e CEST voltaram ao cadastro do produto
  **só como anotação** — ver "Regras de produto > Estoque".
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
- **Adiado para a 1.0 (`2026-10-06`, Agostinho):** testar o fluxo completo na
  Emitte (exportar → importar → "Já importei" → só novos na próxima vez;
  cliente com Praça fica de fora; conferir o telefone do cliente B). A exportação
  **não entra na 0.1**: no instalador os botões continuam desabilitados.

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

- Rodar: `npm run dev` (Vite na porta 5173 e Electron com atualização
  automática). No terminal do VS Code, rodar com `env -u ELECTRON_RUN_AS_NODE`:
  o VS Code repassa essa variável e o Electron sobe como Node puro e cai.
  Sem `conexao.json` em `~/.config/papelaria-opcao/` (nome **sem** acento) o
  app mostra "não configurado"; no navegador roda sobre o mock, com a amostra
  de 90 dias.
- Conferir: `npm test` e `npm run build`.
- O histórico da revisão por telas com o Victor (até `2026-10-01`) está em
  `docs/historico/2026-10-01-revisao-com-victor.md`.

---

## Como retomar com o Victor

**Superado em `2026-10-27`:** a validação das telas passa a ser o percurso tela
a tela da 1.0, feito pelo Agostinho sem o Victor (plano da 1.0, "O ritual de
cada tela"). A tabela abaixo fica como registro da rodada de `2026-10-01`.

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
- [ ] **Executar a 1.0:** plano em
  `docs/superpowers/plans/2026-10-23-versao-1.0.md` (rascunho de `2026-10-23`,
  reescrito em `2026-10-27` no processo **linear, tela a tela**: fundação com o
  schema inteiro, depois cada tela percorrida e validada pelo Agostinho e
  deixada pronta, na ordem do plano). **Branches (D1, `2026-10-24`):** a 1.0 no `main`; o
  piloto commita e tira versão (tag `v0.1.x`) do `piloto-0.1`, que vai para o
  `main` por merge quando preciso, nunca o contrário. **Cada branch na sua
  pasta** (worktree do git): o piloto em
  `/home/agostinho/Desktop/projetos/papelaria-opcao-piloto`, a 1.0 em
  `/home/agostinho/Desktop/projetos/papelaria-opcao`. Nunca trocar de branch
  com `checkout` numa das pastas: a outra conversa perde o chão. **Piloto e 1.0
  em conversas separadas desde `2026-10-23`;** recurso novo no piloto entra com
  linha no inventário e no plano (plano, "Processo enquanto o piloto evolui").
- [x] ~~**Antes de ligar a exportação de produtos para a Emitte:** testar na
  importação um produto com NCM e CEST anotados (`2026-10-23`). A planilha leva
  o CEST junto com CSOSN 102 (Simples), combinação nunca testada; conferir se a
  Emitte aceita, ignora ou recusa. O texto do diálogo ("complete o NCM de cada
  produto novo") também precisa mudar para "o NCM que faltar".~~ Descartado em
  `2026-10-29`: a exportação foi desligada.
- [ ] **Boletos: confirmação do operador ao marcar como pago** (`2026-10-23`,
  pedido do Agostinho). Desenhada **para a 1.0**, junto com o seletor de
  operador: plano da 1.0, "Confirmação do operador" (`2026-10-24`). No piloto
  fica o segundo clique provisório de "Marcar como pago" e "Desfazer pagamento"
  (`AcaoPagar` em `src/telas/boletos/Boletos.tsx`); não fazer outra confirmação
  no piloto. Hoje o boleto já guarda `pagoPor` com o nome do operador da base.
- [ ] **Validar Financeiro e Caixa** (Agostinho; o Victor não participa da
  validação das telas desde `2026-10-27`): é o percurso da tela 7 do plano da
  1.0. No Caixa, o cenário de fechamentos e a rotina de
  abrir/adicionar/retirar/fechar; no Financeiro, filtro de datas, resumo,
  movimentos e estornos. Não marcar como validadas só porque testes e build
  passam.

*Decidido para a 1.0 (Agostinho, `2026-10-23`, sobre a checagem `2026-10-21`):*
- **Piloto 0.1 fica na loja só para teste**, com dados inventados. O
  importador da 0.1 para o SQLite **não** é obrigatório; tudo do piloto se perde
  na 1.0, como já combinado. A semente da 1.0 sai da base de exemplo, com as
  patologias acrescentadas de propósito (regra 8).
- **Nota fiscal: Emitte manual.** Comprovante não fiscal na térmica em toda
  venda; a nota segue montada à mão na Emitte quando precisar (mantém a decisão
  de `2026-10-07`). Emissor com API fica fora da 1.0.
- ~~**Operador: seletor sem PIN, preparado para PIN futuro.**~~ Trocado em
  `2026-10-28`: PIN de 4 dígitos pedido em cada gesto, sem operador fixo (ver
  "Decisões de arquitetura" e "Operadores e login").
- **Licença e bloqueio por inadimplência entram na 1.0, como última etapa**, se
  possível. Não bloqueia o resto do plano.
- **`2026-10-27`:** a migração das telas é nossa (D2); excluir boleto vira
  "excluído" com motivo (D7); **Notas fiscais fica fora da 1.0** (D8) e a área
  sai do código da 1.0.

*Ainda a decidir (não travam o schema):*
- **Infraestrutura:** atualização manual ou automática; assinar o instalador;
  impressão no Windows (ESC/POS cru pelo spooler, ou driver da Elgin com a
  impressão silenciosa do Electron); tirar as ferramentas de desenvolvedor do
  instalador, mantendo a barra de menu.
- **Mercado Pago real:** quando ficam disponíveis a conta, a credencial de
  produção e a maquininha física.

*Piloto 0.1 (checagem `2026-10-21`):* A1 e M1 corrigidos na **v0.1.8**
(`2026-10-23`, etapa 0 do plano), junto com as telas para o monitor de 1280x720.
Fica para a 1.0: comprovante com as colunas desalinhadas no papel (A3; a
impressão não está no piloto).

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
12. Licença do pacote de ícones do acervo. (O ícone do aplicativo já está
    configurado: `recursos/icone/icone.png`.)

*Mercado Pago — comprovantes (para a 1.0, `2026-10-07`):* não há comprovante em
PDF pela API. Ao aprovar, consultar `GET /v1/payments/{reference_id}` e guardar
no pagamento da ficha autorização, final do cartão, bandeira, parcelas, bruto,
taxa, líquido e data de liberação; a exportação do Financeiro ganha uma aba
"Mercado Pago" com isso; opcional: baixar o relatório oficial de liberações do
período pela API junto com a planilha; decidir se a maquininha imprime a via
do cliente (`print_on_terminal`). No teste o `reference_id` é fictício
(`1234567890`, consulta dá 404): só se prova com maquininha real.

*Emitte (para a 1.0):* ~~testar o fluxo de exportação "vai uma vez" na conta de
teste e liberar os botões~~ (exportação desligada em `2026-10-29`); SINTEGRA com
o contador.

*Contador:* mandar uma planilha de exemplo do "Exportar período" do Financeiro
e perguntar o que falta ou sobra (colunas, plano de contas, um arquivo por mês?).
Perguntar também se precisa do valor de serviço e de produto separados: hoje o
recebimento de notinha e a "Venda e serviço" não separam (checagem
`2026-10-21`, M5). Levar junto as perguntas do SINTEGRA.

*Back — próximos passos (Agostinho), em ordem:*
13. **Responder as perguntas que ainda travam** (seção "Perguntas em aberto" e
    as decisões da checagem, no topo desta lista): login/operadores, dados
    iniciais da loja, atualização do app, impressão. Máquina, internet e banco
    já estão decididos (`2026-10-05`).
14. **Mock do contrato sobre a base local:** `src/mock/api.ts` implementa o
    `Contrato` usando a base que já existe, com o atraso e as falhas do
    `simular`. As telas migram de `useEstadoDemonstracao()` para `window.api`
    **uma área por vez** (Clientes → Estoque → Ficha/Notinha → Financeiro/Caixa),
    e cada uma ganha os estados de carregando e falha (regra 6).
15. **Em paralelo:** banco local SQLite (`node:sqlite`) no processo principal:
    schema e migrations do SQLite, escritas atômicas em transação, seed com as
    patologias da base local, e os testes de regra de `src/mock/` portados como
    especificação do back. Migration testada numa cópia com dados no formato
    antigo antes de chegar à máquina da loja (regra 8).
16. `electron/operacoes.ts` real, área por área, na mesma ordem do 14.
17. Backup: cópia do arquivo para o Supabase (no máximo a cada 5 min com
    mudança + ao fechar), cópias locais diárias, e restauração testada.

*Recomendação da checagem de `2026-10-21` para o 14–16 (a decidir no plano):*
não escrever as regras duas vezes, no mock e no SQLite. As regras viram funções
puras em `comum/`, chamadas pelos dois; os mesmos testes de contrato rodam
contra o mock e contra o SQLite (o Node 24 já tem `node:sqlite`, então rodam
no vitest); e um importador da 0.1 para o SQLite entra desde o começo.

---

## Regras de produto que valem hoje

Cada regra tem um número (`R-ÁREA-NN`) que o teste dela cita; a suíte confere
que toda regra numerada tem teste ou está nos pendentes de `docs/testes.md`
(`2026-10-27`). Regra nova entra com número; item que não é regra começa
com "Nota:". Item sem um dos dois quebra a suíte.

### Venda (ficha)
- `R-VENDA-01` **Uma tela só:** cliente, itens, pagamento e revisão. A ficha abre vazia.
- `R-VENDA-02` **Cliente:** buscar cadastrado (ignora acento, acha pelos dígitos do
  documento), cadastrar novo em janela sem sair da venda, ou **vender sem
  identificação** — a ficha fica sem cliente (`clienteId: null`), rótulo "Não
  identificado", consulta própria em Clientes › Vendas sem identificação. Não
  existe cliente genérico (apareceria na lista com milhares de compras).
- `R-VENDA-03` **Quem já deve aparece ao escolher o cliente:** atraso em vermelho, em aberto
  no prazo em laranja. Só avisa; vender ou não é do balcão.
- `R-VENDA-04` **Itens:** bipe (leitura contínua pelo ícone), busca por nome ou código;
  vários resultados pedem escolha. Quantidade digitável e com + e −. Código sem
  cadastro leva ao Estoque para cadastrar e contar antes de vender; a ficha em
  andamento fica guardada para ser retomada.
- `R-VENDA-05` **A venda em andamento se guarda sozinha** (rascunho único na base); o Início
  oferece "Retomar ficha". "Limpar ficha" zera tudo, inclusive cliente e forma.
- `R-VENDA-06` **Bloqueios ao concluir:** sem cliente, sem item, desconto maior que o
  subtotal, dinheiro recebido menor que o total, notinha sem vencimento ou com
  vencimento antes de hoje, entrada que cobre o total, produto sem saldo
  suficiente e pagamento misto cuja soma não fecha ou cujo dinheiro entregue
  é menor que a parcela em espécie.
- `R-VENDA-07` **Sem saldo, sem venda:** conferir a prateleira e registrar entrada ou ajuste
  no Estoque antes de concluir. A ação de dados também recusa a venda sem
  alterar ficha, financeiro ou estoque.
- `R-VENDA-08` **Produto que a ficha não acha (`2026-10-23`, pedido da loja):** o link
  "Cadastrar produto" abre o cadastro completo (com quantidade inicial) **por
  cima da ficha**, com o código bipado já preenchido. Cancelar volta à ficha;
  salvar volta à ficha **com o produto já inserido, quantidade 1** (decisão do
  Agostinho). Antes o link ia para o Estoque e ficava lá.
- `R-VENDA-09` **Pagamento misto à vista:** distribuir exatamente o total entre pelo menos
  dois meios, cada um com valor positivo. Cada parcela aparece separada no
  Financeiro; o troco é calculado só sobre a parte em dinheiro.

### Notinha (compra fiada)
- `R-NOTINHA-01` Rótulo na tela: "Notinha". Situação calculada: pendente, vencida, paga,
  cancelada. O identificador interno antigo era `futuro`.
- `R-NOTINHA-02` Vencimento padrão hoje + 30 dias; **não muda depois** (decisão do Victor): se a
  dona der mais prazo, a notinha continua vencida — é o controle. O combinado vai
  numa **anotação** na ficha (só se acrescenta, com data).
- `R-NOTINHA-03` Entrada na hora (valor + meio) e pagamento parcial valem. Receber: janela que
  lista todas as notinhas abertas do cliente, com caixa por notinha; o valor
  abate da mais antiga para a mais nova; cada notinha segue separada (juntar =
  marcar mais caixas, não fundir fichas). Data do pagamento entre a notinha mais
  antiga marcada e hoje.
- `R-NOTINHA-04` Ficha pendente mostra faixa com as outras notinhas do cliente e "Receber todas".

### Corrigir sem apagar
- `R-CORRECAO-01` Nada lançado se apaga ou se edita livremente. Três desfazeres, todos com
  **motivo obrigatório** (`ModalMotivo`), e o registro original fica visível:
  - `R-CORRECAO-02` **Cancelar ficha** (página e janela da ficha): a baixa registrada volta ao estoque
    (movimento "Cancelamento"), o pago sai do Financeiro **no dia do
    cancelamento** (dias fechados não mudam), a ficha fica marcada "Cancelada" e
    sai das compras do cliente, das vendas do dia e da cobrança. **Também pelo
    "Estornar" da venda à vista no Financeiro** (Agostinho, `2026-10-19`): o
    mesmo diálogo, avisando que a ficha é cancelada inteira (ficha mista tem
    uma linha por pagamento; qualquer uma cancela tudo). Linhas de notinha
    continuam sem o botão no Financeiro: corrigem-se na ficha (decidido pelo
    Agostinho; descartado o "Estornar" do recebimento direto no Financeiro).
  - `R-CORRECAO-03` **Estornar recebimento de notinha:** pagamento riscado com o motivo; a
    notinha volta a dever.
  - `R-CORRECAO-04` **Estornar lançamento manual** do Financeiro: entra um lançamento de sinal
    contrário; o original fica "Estornado".
- `R-CORRECAO-05` Entrada ou ajuste de estoque errado se corrige com outro ajuste.

### Ficha consultada
- `R-FICHA-01` Qualquer "Ver ficha" abre **janela** por cima da tela; fechar devolve filtro,
  página e rolagem. A página `/fichas/:id` fica só para depois de concluir a
  venda. Janela sobre janela: Esc fecha só a de cima.

### Clientes
- `R-CLIENTE-01` Os cartões de notinhas contam **clientes**, não a quantidade de notinhas:
  quarenta notinhas em atraso de quatro clientes correspondem a "4 clientes".
  Hoje a classificação dá prioridade ao atraso: quem tem notinha atrasada aparece
  em atraso mesmo se também tiver outra a vencer; não é contado nas duas situações.
- `R-CLIENTE-02` Lista alfabética com número estável (`CLI-0104`), busca no topo, filtros
  "Notinhas a vencer" e "Notinhas em atraso" (contam clientes). Linha expande
  com as três compras recentes; "Ver histórico completo" abre o cliente. A
  linha mostra só o nome, sem a descrição embaixo (`2026-10-30`). Notinha que
  vence hoje ainda está a vencer; cancelada não deve nada; pagamento estornado
  não conta como pago.
- `R-CLIENTE-03` A busca de clientes aceita CPF/CNPJ e telefone com ou sem pontuação e nomes
  sem acento. A mesma regra vale no cabeçalho e na identificação da nova ficha.
- `R-CLIENTE-04` Cadastro e edição num formulário só, em gaveta (ou janela na ficha): só o nome
  é obrigatório; documento repetido é barrado (pelos dígitos, no banco).
  Endereço em partes: rua, número, complemento, bairro, cidade, estado e CEP
  (na 0.1 era uma frase só, "Rua, nº - Bairro - Cidade/UF"). Não se cadastra e-mail (decisão do Victor):
  o contato é por telefone/WhatsApp, sem esse campo nos formulários ou detalhes.
- `R-CLIENTE-05` Detalhe do cliente: cartões Total comprado, Notinhas em aberto (clicar recebe)
  e Ticket médio; histórico com filtros e "Receber" por linha.
- `R-CLIENTE-06` Receber notinhas permite Dinheiro, Pix, Cartão ou Misto, inclusive em pagamento
  parcial e com várias notinhas selecionadas. No Misto, duas ou três formas
  somam exatamente o valor a pagar agora; só a parte em dinheiro calcula troco
  e entra na gaveta. O recebimento abate as notinhas da mais antiga para a mais
  nova, conserva cada meio no histórico/Financeiro e grava tudo junto.
- `R-CLIENTE-07` Vendas sem identificação: filtros Todos, Dinheiro, Pix e Cartão, sem filtro
  exclusivo para Misto. Vendas mistas aparecem em cada meio usado e conservam
  a divisão dos pagamentos no detalhe da ficha, como no Início.
- `R-CLIENTE-08` O calendário de vendas sem identificação permite hoje e qualquer dia passado;
  datas futuras são bloqueadas também na digitação e na navegação por teclado.
- `R-CLIENTE-09` **CPF/CNPJ válido** (`2026-10-30`): 11 ou 14 dígitos com os dígitos
  verificadores certos; pontuação livre. Um dígito trocado faria o mesmo cliente
  virar "outro", com as notinhas separadas.
- `R-CLIENTE-10` **Telefone com DDD** (`2026-10-30`): 10 ou 11 dígitos (fixo ou celular),
  pontuação livre; continua opcional. Sem DDD não serve para o WhatsApp.
- Nota: Endereço com **"Cidade" e "Estado"** separados; o estado pelo nome completo,
  numa lista, e o banco guarda a sigla. Os dois começam **vazios** no cliente
  novo (`2026-10-30`, Agostinho; o padrão Simonésia / Minas Gerais foi tirado ao
  validar a tela). CPF/CNPJ e telefone com **máscara** enquanto se digita.

### Boletos (`2026-10-23`)
- `R-BOLETO-01` Pedido da dona: **só anotar** os boletos da loja e ser avisada perto do
  vencimento. Campos: descrição, valor, **número do boleto** (organização dela
  no arquivo físico: texto livre, obrigatório) e vencimento, mais a **data de
  cadastro**, gravada sozinha ao salvar e que a edição não muda (acréscimo do
  Agostinho).
- `R-BOLETO-02` **Número repetido é aceito**, só com aviso no campo ("Já existe o boleto Nº
  12: ...").
- `R-BOLETO-03` **Marcar como pago** grava o dia e o operador; dá para desfazer. Hoje pede um
  segundo clique; vai pedir a confirmação do operador (PENDENTE).
- `R-BOLETO-04` **Pagar não lança nada no Financeiro** (Agostinho): é anotação, e lançar
  sozinho duplicaria a despesa que ela já registra à mão.
- `R-BOLETO-05` **Sino:** "N boletos vencidos" (crítico) e "N boletos vencem em breve"
  (atenção) para os que vencem em até **5 dias** (`DIAS_AVISO_BOLETO`; as
  notinhas usam 3). Pago sai do aviso.
- `R-BOLETO-06` Tela no menu, abaixo de Serviços: resumo (vencidos, vencem em até 5 dias, a
  pagar), filtros A pagar/Vencidos/Pagos/Todos e busca por descrição ou número.
  Excluir fica em Editar, para boleto lançado por engano.
- Nota: Piloto: os boletos vão no documento da base; base antiga abre com a lista
  vazia. Nada mudou no Supabase.

### Serviços (`2026-10-19`)
- `R-SERVICO-01` **Sem cadastro** (Agostinho, `2026-10-19`, no mesmo dia da primeira versão):
  na nova ficha, **"Inserir serviço"** pede **Serviço** em texto livre (o que
  foi feito, ex.: "10 cópias coloridas"), **valor cobrado**, **unidades
  perdidas** (opcional, sem motivo) e **observação**. Ficha só de serviço vale.
  Descartados: o cadastro (código `SRV-`, valor sugerido, desativar) e o motivo
  da perda.
- `R-SERVICO-02` A tela **Serviços** tem, no mesmo período, o **histórico de serviços feitos**
  (cada serviço com o número da ficha, que abre o detalhe; "com produtos"
  quando a ficha tem os dois; cliente, perdas e valor) e, abaixo, as
  **perdas** (data, ficha, serviço, unidades e observação). **Ficha cancelada
  some do histórico** (Agostinho), mas a perda dela continua nas perdas.
- `R-SERVICO-03` **Perdas são só conferência:** nada mexe no estoque (decisão do Agostinho).
  Cancelar a ficha não apaga a perda (o material se perdeu do mesmo jeito).
- `R-SERVICO-04` **Financeiro:** ficha só de serviço é "Serviço"; com produto, "Venda e
  serviço" — serviço paga ISS e produto ICMS, o contador precisa separar.
- Nota: Base gravada no formato anterior abre convertida (`normalizarBase`): o
  catálogo é descartado, as fichas perdem código e motivo.
- Nota: Fora por enquanto: material vinculado ao estoque, quantidade/preço por
  unidade, NFS-e.

### Estoque
- `R-ESTOQUE-01` Saldo só muda por **entrada, ajuste, venda ou cancelamento**, para o histórico
  bater. Editar produto não mexe no saldo. A quantidade informada ao cadastrar
  vira a primeira entrada ("Saldo inicial do cadastro").
- `R-ESTOQUE-02` **Excluir x desativar:** apaga só produto sem histórico (cadastro por engano).
  Com histórico, desativa: some da venda, da entrada, do ajuste, das contas e dos
  avisos; aba "Desativados" para reativar. Bipado, avisa que está desativado.
- Nota: **Cadastro rápido: sai na 1.0** (`2026-10-28`, Agostinho). Estava oculto
  desde `2026-10-20` (`funcoes.cadastroRapido`): o produto nasceria com saldo 0
  e, com "sem saldo, sem venda" no banco, a venda travaria. Saem o "Completar
  cadastro", o filtro e o card "A completar" e o aviso do sino. Produto novo
  no balcão é cadastrado pelo Estoque, com a quantidade contada.
- `R-ESTOQUE-03` "+ Entrada" da linha abre a gaveta Entrada rápida (um produto). Entrega com
  vários itens vai pela página Registrar entrada, com bloco "Bipados" (bipar de
  novo não duplica; produto novo precisa de cadastro antes de ir à tabela).
- `R-ESTOQUE-04` Entrada completa preserva data física do recebimento, fornecedor, referência,
  observações e custo informado por item no histórico. A data do lançamento
  continua sendo a data atual, mantendo a ordem dos saldos antes/depois.
- `R-ESTOQUE-05` Cadastrar produto (topo do Estoque) aceita bipe; código já cadastrado mostra o
  produto existente em vez de duplicar.
- `R-ESTOQUE-06` **NCM e CEST no cadastro, como anotação (`2026-10-23`, pedido da loja):** dois
  campos opcionais em "Dados complementares", para a dona cadastrar na Emitte
  sem procurar a nota. Só o formato é conferido (8 e 7 números; pontos aceitos);
  CEST sem substituição tributária é aceito. Tributação, origem e CFOP continuam
  fora da tela; guardados em `fiscal` com o padrão (Simples, 0, 5102/6102) ou o
  que o produto já tinha. A dona cadastra na Emitte à mão: a exportação foi
  desligada em `2026-10-29` (ver a decisão do dia).

- `R-ESTOQUE-07` **Quantidade inicial pede quem está fazendo** (`2026-10-28`): o
  cadastro não pede PIN, mas a quantidade inicial grava um fato (o movimento
  "Saldo inicial do cadastro"). Com quantidade maior que 0, a pessoa e o PIN
  (`R-OPERADOR-02`); com 0 não há movimento e o cadastro grava direto. Excluir
  produto que tem esse movimento também pede a pessoa e o PIN (não é gesto da
  dona). Editar, desativar e reativar não pedem.
- `R-ESTOQUE-08` **Código do produto nasce no banco ao salvar** (`2026-10-28`): a tela
  não mostra previsão do próximo código (com duas máquinas, erraria); mostra o
  código depois de salvar.
- `R-ESTOQUE-09` **O custo da entrega fica na entrega** (`2026-10-29`): o custo por unidade
  informado na entrada vai para o movimento, como histórico da compra; o custo
  do cadastro é o de referência e não muda com a entrada (uma promoção de
  atacado não mexe nele). Exceção: o produto que **nasce na entrega** recebe o
  custo desta compra como custo do cadastro, porque ainda não tinha nenhum.
- Nota: Produto com código desconhecido na Registrar entrada nasce **dentro da
  entrega** (`2026-10-29`): o cadastro fica preparado na linha e o produto só é
  criado ao confirmar, na mesma transação da entrada. Cancelou, não sobra
  produto. Depois de confirmar, abrem as Movimentações (conferência da entrega
  inteira; a Entrada rápida volta ao Estoque).
- Nota: Código **digitado** na Registrar entrada que não existe e parece código de
  barras (8 a 14 números) oferece "Cadastrar como produto novo", que o leva aos
  bipados como se tivesse sido lido (`2026-10-30`, Agostinho): etiqueta que o
  leitor não pega não deixa a funcionária sem saída. Nome digitado errado não
  vira produto.
- `R-ESTOQUE-10` **Ajuste confere o saldo que a pessoa viu** (`2026-10-30`): a tela manda a
  contagem e o saldo que mostrou ao abrir; se mudou no meio (venda na outra
  máquina enquanto ela contava a prateleira), o back recusa com o saldo de
  agora e ela confere de novo. Sem isso, a contagem gravaria por cima e a venda
  sumiria da conta. Confirmado, volta ao Estoque, como a Entrada rápida.
- `R-ESTOQUE-11` **Ajuste com conferência depois** (`2026-10-30`): qualquer pessoa ajusta só
  com o próprio PIN, e o ajuste grava na hora. O de funcionário fica
  "aguardando conferência" até a dona conferir com o PIN dela (um por um, ou
  todos os que ela está vendo de uma vez); o da própria dona já nasce
  conferido. Conferir é só o visto: discordou, faz outro ajuste
  (`R-CORRECAO-05`). A marca, o "Conferir" e o aviso no sino ficam nas
  Movimentações (tela 2.6).
- Nota: Entrada rápida confirmada volta ao Estoque, com o saldo novo na linha
  (`2026-10-29`): quem repõe faz vários produtos em sequência. O histórico fica
  no ícone da linha.

### Financeiro
**Situação de validação: NÃO VALIDADO pelo Victor.** As regras abaixo descrevem
o que foi discutido e implementado; a avaliação de uso continua na próxima sessão.

- `R-FINANCEIRO-01` Tela e item próprios no menu. Não apresenta prévia do Caixa nem transferências
  físicas da gaveta. "Registrar movimento" oferece Entrada e Despesa em janela
  central compacta; vendas e recebimentos de notinhas vêm das fichas.
- `R-FINANCEIRO-02` Atalhos Hoje, Esta semana, Este mês, Mês passado, Este ano e consulta livre De/Até,
  inclusive de um único dia antigo. Cartões, gráfico, contagens e tabela usam
  o mesmo intervalo; "Todos os meios" reúne Pix, cartão e dinheiro dentro dele.
  A tabela mostra até 15 registros por página, com rolagem da tela quando
  necessário, sem reduzir a lista a uma linha pelo espaço restante.
  Cada pagamento registrado numa ficha (venda, entrada ou recebimento de
  notinha, **em qualquer meio**) vira uma linha; lançamento manual também.
- `R-FINANCEIRO-03` **Estorno abate do próprio lado:** desfazer venda reduz Entradas, desfazer
  despesa reduz Saídas; selo "Estorno". O original desfeito (venda, recebimento
  ou lançamento) fica "Estornado". O filtro **"Estornos"**, ao lado dos meios,
  mostra só as linhas de estorno (`2026-10-19`).
- `R-FINANCEIRO-04` Os três cartões resumem somente o período selecionado. Entradas menos
  despesas não representa lucro nem saldo bancário; não há comparação com o
  período anterior. A tabela "Movimentações financeiras" contém somente fatos
  financeiros e seus estornos.
- `R-FINANCEIRO-05` Transferências físicas e seus estornos ficam na seção Caixa. As categorias
  antigas "Troco" e "Saída de caixa" são classificadas como registros físicos
  para consulta, sem alterar seus valores, sinais ou datas persistidos.
- `R-FINANCEIRO-06` **Exportar período (`2026-10-07`, Agostinho):** planilha `.xlsx` do período
  consultado (abas Resumo, Por dia — por mês acima de 92 dias — e Movimentos,
  com as cores dos tokens do app e totais em fórmula), gerada das mesmas funções da tela,
  então o total do arquivo é o dos cartões. Vai o **período inteiro em todos os
  meios** (arquivo parcial na contabilidade é armadilha) e **sem a gaveta**
  (adição/retirada não é receita nem despesa). Dinheiro vai como número, para o
  contador somar. Formato escolhido por nós, **ainda não visto pelo contador**:
  ajustar depois da resposta dele (pendente). Atalho "Mês passado" para o
  fechamento mensal.

### Caixa
**Situação de validação: NÃO VALIDADO pelo Victor.** A gaveta tem tela e item
próprios no menu, sem filtro Dia/Semana/Mês/Ano do Financeiro.

- `R-CAIXA-01` Retirada física só aceita dinheiro, fica fora das despesas financeiras e
  reduz o esperado na conferência da gaveta.
- `R-CAIXA-02` Conferência em espécie: abertura com contagem, somente movimentos lançados
  durante aquele turno, fechamento com valor contado e justificativa obrigatória
  para diferença. Pix/cartão não entram. A abertura é opcional e informa todo
  dinheiro já na gaveta, inclusive troco vindo do dia anterior. Movimentos
  antigos entram nessa contagem inicial, sem recalcular períodos fechados.
- `R-CAIXA-03` "Caixa atual" acompanha o turno aberto e mostra "Esperado na gaveta". Sem
  caixa aberto, orienta a contar o dinheiro e oferece "Abrir caixa".
- `R-CAIXA-04` Abertura, retirada e fechamento usam janelas centrais compactas. "Cancelar"
  apenas sai da janela; "Fechar caixa" registra a contagem final. Diferenças são
  explicadas como falta ou sobra e exigem "Motivo da diferença". Abertura não
  lança receita e fechamento não cria despesa. Só um caixa permanece aberto;
  não há abertura ou fechamento automático na virada do dia.
- `R-CAIXA-05` "Abrir caixa" aparece no lugar das ações do caixa aberto quando não existe
  turno aberto. Pode ser usado em qualquer horário; depois de confirmar um
  fechamento, reaparece. A rotina de abrir ao chegar e fechar ao sair depende da
  pessoa. Vendas e recebimentos não são bloqueados pela falta de conferência.
- `R-CAIXA-06` O Caixa atual identifica a abertura com ícone de dinheiro, data/horário e
  operador em linhas separadas. "Adicionar dinheiro" pede valor e "Origem ou
  motivo"; "Retirar dinheiro" pede valor e "Destino ou motivo". As duas ações
  exigem caixa aberto, conservam operador/vínculo e alteram só o esperado da
  gaveta. Reforço de troco não é receita, retirada não é despesa; seus estornos
  também ficam fora dos totais financeiros. Compra/conta continua sendo despesa.
  Registros antigos sem turno vinculado seguem consultáveis com seus valores
  e sinais originais. O histórico também mostra estornos físicos e seu motivo.
- `R-CAIXA-07` Fechamentos dos últimos sete dias corridos (hoje e seis anteriores) aparecem
  abaixo do Caixa atual, com data do fechamento, dinheiro contado, situação e
  "Ver". Cada fechamento é individual, sem somar saldos entre dias.
- `R-CAIXA-08` "Consultar outro período" abre o histórico com datas De/Até, atalhos Últimos
  7 dias e Este mês; nenhuma data futura. Fechados são filtrados pelo dia do
  fechamento em São Paulo, inclusive quando abertos em outro dia; abertos pela
  abertura. O histórico separa Aberturas e fechamentos / Adições e retiradas.
  Conserva contagens, esperado, diferenças, motivos, operadores e estornos;
  "Ver" abre os movimentos em dinheiro e as fichas do caixa escolhido.
  Fechamentos anteriores são preservados.
- `R-CAIXA-09` Novos movimentos, pagamentos e estornos guardam quem fez, escolhido com
  PIN no gesto (`R-OPERADOR-02`). Na 0.1 era o operador fixo da base, sem
  autenticar quem estava na máquina.

### Pagamentos (Pix e cartão)
- `R-PAGAMENTO-01` A funcionária marca Pix ou cartão **depois de conferir** no balcão; não há
  etapa "aguardando conferência".
- Nota: Na base local todo pagamento marcado entra no Financeiro. Em produção a tela
  não muda; muda **de onde** vem o registro (pendente 5). Não assumir que a API
  do Mercado Pago cobre Pix de outro banco nem cobranças feitas fora do app;
  não prometer caixa completo antes de testar com transações reais. Separar
  total recebido do saldo líquido da conta (taxas e prazo de liberação).
  Referências: [busca de pagamentos](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/search-payments/get),
  [dinheiro em conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/introduction).

### Início e sino
- `R-INICIO-01` Início: resumo do dia (recebimentos, vendas, saídas) com **valores ocultos por
  padrão** (tela virada para o cliente); histórico de fichas com filtro por data e
  pagamento. Estoque baixo e contas vencidas ficam nas seções delas e no sino.
- `R-INICIO-02` O Início se concentra no dia atual, com informação essencial para o balcão.
  O cartão Recebimentos do dia mostra só o título e o valor, sem comparação com
  ontem, percentual de variação ou frase sobre o movimento anterior (decisão do Victor).
- `R-INICIO-03` O filtro de data do histórico permite consultar qualquer dia passado e hoje,
  inclusive meses e anos anteriores, sem limite mínimo. Datas futuras ficam
  bloqueadas no calendário, nas setas e na digitação; o filtro afeta só as fichas.
- `R-INICIO-04` Os filtros de pagamento são Todos, Pix, Cartão, Dinheiro e Notinha. Não há
  filtro exclusivo para Misto (decisão do Victor): uma venda mista aparece em
  Todos e em cada meio usado no pagamento. O detalhe da ficha conserva a divisão
  dos valores; nas notinhas, mostra a entrada e os recebimentos registrados.
- Nota: Revisão com o Victor: manter uma única janela do Electron em desenvolvimento
  (`npm run dev`), aproveitando a atualização automática da interface. Reutilizar
  essa janela nas alterações do front, sem abrir outra instância a cada conferência.
- `R-INICIO-05` Sino: notinha em atraso, notinha que vence em até 3 dias, produto zerado,
  estoque baixo, cadastro rápido a completar, rascunho de nota; do mais grave ao
  menos grave. Lido volta a ser novo se o texto mudar.

### Operadores e login (`2026-10-28`, 1.0)
- `R-OPERADOR-01` Cada pessoa da loja é um operador, com nome único (sem diferenciar
  maiúscula e minúscula) e **PIN de 4 dígitos**, só números. Não existe operador
  sem PIN.
- `R-OPERADOR-02` **Não há operador fixo.** Todo gesto que grava um fato (concluir venda,
  receber, abrir e fechar caixa, gaveta, lançamento, entrada de mercadoria,
  boleto pago) pede quem está fazendo: escolher a pessoa e digitar o PIN. O
  último a usar fica marcado, e o PIN é pedido do mesmo jeito. Não pedem: os
  cadastros editáveis (cliente, produto), consultar, montar a ficha.
- `R-OPERADOR-03` **Uma administradora, a dona.** Cadastrar, renomear, desativar ou
  reativar uma pessoa e redefinir PIN só com o PIN dela. Ela não pode ser
  desativada. PIN esquecido: a dona redefine; o dela, só o suporte.
- `R-OPERADOR-04` **5 PINs errados seguidos** para a mesma pessoa: 30 segundos de espera
  antes de tentar de novo. Acertar zera a conta.
- `R-OPERADOR-05` **Primeira abertura:** sem administradora cadastrada, o app pede o
  cadastro dela (nome e PIN digitado duas vezes) antes de abrir a loja. Esse
  cadastro só vale enquanto não houver administradora.
- `R-OPERADOR-06` **Gesto sensível pede também o PIN da dona**, gravado como quem
  autorizou; se é a própria dona que faz, um PIN basta. Lista provisória, a
  confirmar com ela (D3): cancelar ficha, estornar recebimento e lançamento,
  ajustar estoque, marcar e desfazer pagamento de boleto, fechar caixa com
  diferença. **Dois jeitos** (`2026-10-30`): com o PIN da dona **na hora**, ou
  com **conferência depois** (quem faz assina sozinho, o registro fica
  "aguardando conferência" e a dona dá o visto com o PIN dela). A dona escolhe
  o jeito de cada gesto (D3). **Ligados:** ajustar estoque, com conferência
  depois (`R-ESTOQUE-11`).
- `R-OPERADOR-07` Pessoa desativada some da escolha, não assina nem autoriza, e continua
  no histórico com o nome.
- `R-OPERADOR-08` O PIN só existe no back, guardado com hash (scrypt, com sal); nunca
  volta para a tela nem vai para o log.
- `R-LOGIN-01` **Login da loja:** um usuário por loja, criado por nós; a loja recebe
  e-mail e senha e entra uma vez, na primeira abertura. Depois o app abre
  conectado. O login serve só ao backup: sem sessão, a loja não para; o sino
  avisa que a cópia na nuvem está parada.

### Notas fiscais (fora do escopo atual)
- Nota: Área mínima: Entradas e Saídas simuladas; "Preparar nota" cria rascunho para
  revisão. Emissor: hoje a Emitte, com a nota montada à mão (sem API); o da 1.0
  está em aberto (PENDENTE). Tipo fiscal e campos dependem da
  contabilidade. Rascunho nunca aparece como nota emitida. Impressão, extrato e
  exportação mostram "Ainda sem destino" até existir o programa fiscal.

---

## Regras de interface

Detalhe de como a interface está montada: `AGENTS.md`, "Interface: como está
montada". O que é decisão (e o porquê):

- `R-UI-01` **CSS por componente** (escolha do Victor): `.css` ao lado do `.tsx`, classes
  `bloco__parte--variante`; Tailwind só para preflight e tokens. Por quê: achar e
  mudar um estilo num lugar só.
- `R-UI-02` **Tokens só em `src/estilos/tokens/`.** Situação na família pastel: ok,
  atencao, critico, neutro. Vermelho forte só para saída de dinheiro e erro.
- `R-UI-03` **Ícones do acervo** (`Icons.pdf`), nunca Lucide/Material; fonte Inter local;
  nenhum link externo.
- `R-UI-04` **Calendário do app em toda data** (`SeletorData`; em formulário, `CampoData`).
  Nenhum `type="date"` do Windows.
- `R-UI-05` **Movimento mínimo:** GSAP só em microinterações úteis (160 ms; barra lateral
  280 ms), respeitando `prefers-reduced-motion`. Ao animar a barra lateral,
  ícones e logo ficam ancorados à esquerda (centralizar pela largura instantânea
  fazia tudo saltar).
- `R-UI-06` **Só o essencial:** campo e função que fazem sentido para a papelaria; nada de
  enfeite. Um texto por informação.
- `R-UI-07` Rotas em modo hash (`#/clientes`): funciona em `file://` no Electron; o
  usuário não vê endereço.
- `R-UI-08` A barra de menu padrão do Electron (File/Edit/View/Window) fica como está, por
  decisão do Victor.
- `R-UI-09` **Monitor da loja: 1280x720 (`2026-10-23`, provável, não confirmado).** Toda
  tela tem que funcionar ali, descontando barra de tarefas e menu do Electron
  (~650 px de altura útil). Tabela paginada mostra no mínimo 8 linhas e a página
  rola; nunca encolher até caber. Conferir 1280x720 e 1920x1080 a cada mudança
  de tela.

---

## Decisões de arquitetura

### `2026-10-30` — Lista de clientes pelo back, sem a descrição
Decisão do Agostinho, no percurso da tela 3.2. A lista, a busca, os cartões e
a situação de cada cliente vêm de `listarClientes`, paginada; as compras da
linha vêm de `listarComprasDoCliente`, a mesma que o histórico da 3.3 vai usar.
A conta da notinha (em aberto e situação) fica em `comum/regras/notinha.ts`,
uma vez para o mock e o SQLite. A linha perde a descrição embaixo do nome
("Cliente frequente").

**Por quê:** os cartões precisam da situação de todos os clientes, então a
conta é feita no back sobre a lista inteira (centenas de clientes, não
milhões) e só a página desce para a tela. A descrição não tinha campo no
cadastro da 1.0 nem quem a preenchesse. Descartado: "Cliente desde" e a cidade
no lugar dela (não ajudam a achar o cliente na lista).

### `2026-10-30` — Cadastro de cliente: documento e telefone conferidos
Decisão do Agostinho, no percurso da tela 3.1. O back confere o CPF/CNPJ pelos
dígitos verificadores (`R-CLIENTE-09`) e o telefone com DDD (`R-CLIENTE-10`);
documento repetido é restrição do banco, pelos dígitos. O endereço passa a ter
"Cidade" e "Estado" (nome completo na tela, sigla no banco). Ao validar, o
Agostinho tirou o padrão Simonésia / Minas Gerais (os campos começam vazios) e
pediu máscara no CPF/CNPJ e no telefone.

**Por quê:** o documento é o que acha o cliente e impede o cadastro em dobro; um
número que passa sem conferência cria um cliente duplicado. A cidade junto com
a UF num campo só obrigaria o back a adivinhar a divisão. Descartado: "UF" no
rótulo (pedido do Agostinho: "Estado", por extenso).

### `2026-10-30` — Sem importação de produtos por planilha na 1.0
Decisão do Agostinho, com a loja de acordo. A tela 2.7 saiu do plano: a 0.1 em
teste só tem dado fictício (nada a levar) e a loja cadastra o catálogo à mão
pelo Estoque no primeiro dia da 1.0.

**Por quê:** a importação existia para a loja não digitar o catálogo inteiro;
com a loja aceitando o cadastro manual, ela vira trabalho (formato, prévia,
erros por linha) sem uso. Volta como pedido novo se, depois da 1.0, aparecer
uma linha de fornecedor grande de uma vez.

### `2026-10-30` — Ajuste com conferência depois, não com o PIN da dona na hora
Decisão do Agostinho ao validar a tela 2.5, **trocando a de cima do mesmo dia**.
Com o PIN da dona na hora, o funcionário ficava parado na tela esperando por
ela, e o ajuste costuma ser feito justamente quando ela não está. Agora quem faz
assina sozinho e o ajuste grava; a dona confere depois (`R-ESTOQUE-11`). A
conferência é um registro à parte (`conferencia_ajuste`, migration 0003): o
movimento é fato e não se edita. O passo "PIN da administradora" da janela e a
regra `autorizar` ficam prontos para os gestos que a dona quiser na hora.

### `2026-10-30` — Ajuste de estoque com o PIN da dona (substituída no mesmo dia)
Decisão do Agostinho, no percurso da tela 2.5. O ajuste é o primeiro gesto
sensível ligado (`R-OPERADOR-06`): quem faz assina, e a dona autoriza com o PIN
dela (`autorizado_por`); se é ela que ajusta, um PIN basta. A dona ainda
confirma a lista (D3); desligar é uma linha no back. Junto: o ajuste manda o
saldo que a pessoa viu (`R-ESTOQUE-10`) e volta ao Estoque ao confirmar.

**Por quê:** ajuste é por onde some mercadoria sem venda; a lista de gestos
sensíveis existe para isso. Descartado: só o PIN de quem faz até a dona
confirmar (deixaria o gesto mais aberto da tela sem conferência).

### `2026-10-29` — Registrar entrada: produto novo nasce na entrega
Decisão do Agostinho, no percurso da tela 2.4. O item de `registrarEntrada`
pode ser um produto existente ou um cadastro novo; o back cria o produto e dá a
entrada na mesma transação. Código de barras repetido (no catálogo ou na
própria entrega) recusa tudo. O custo do produto novo vem da compra
(`R-ESTOQUE-09`).

**Por quê:** é o que a tela já fazia (o cadastro preparado só vira produto no
"Confirmar"), agora sem gravar pela metade (A1). Descartado: cadastrar com saldo
0 no "Completar cadastro" e a entrega só com existentes (sobraria produto se a
entrega fosse abandonada).

### `2026-10-29` — Entrada de mercadoria: uma operação por entrega
Decisão do Agostinho, no percurso da tela 2.3. A Entrada rápida e a Registrar
entrada (2.4) gravam pela mesma operação, `registrarEntrada`: cabeçalho (data
de recebimento, fornecedor, referência, observações) e um movimento por item,
numa transação, com quem está fazendo (`R-OPERADOR-02`). Cada item manda a
**quantidade a somar**, nunca o saldo final. Regra nova `R-ESTOQUE-09`.

**Por quê:** a tela antiga calculava `saldo + quantidade` e gravava o resultado
(com duas máquinas, uma venda no meio sumiria) e gravava item a item (falhar
no terceiro deixava os dois primeiros). Descartado: uma operação para a rápida
e outra para a completa (o contrato mudaria de forma na 2.4); voltar para o
histórico depois de confirmar (atrapalha a reposição em sequência).

### `2026-10-29` — Exportação para a Emitte desligada
Decisão do Agostinho, com a loja de acordo, no percurso da tela 2.2. Os botões
"Exportar produtos" (Estoque) e "Exportar clientes" (Clientes) e as chaves em
`src/funcoes.ts` ficam **comentados**, não apagados; o gerador das planilhas
(`src/dados/emitte.ts`), a marca "Já importei" e a coluna `emitte_enviado_em`
continuam, com os testes, para voltar funcionando se um dia mudar.

**Por quê:** ao importar um produto que já existe, a Emitte cria outro, com id
diferente, e duplica. Não achamos como evitar (o "vai uma vez" só protegia de
reenviar pelo app, não do que já estava lá). A dona cadastra na Emitte à mão;
NCM e CEST seguem no app como anotação (`R-ESTOQUE-06`).

### `2026-10-28` — Produto na 1.0: sem cadastro rápido, PIN só com quantidade
Decisão do Agostinho, no percurso da tela 2.1. Regras `R-ESTOQUE-07` e `08`, e a
nota do cadastro rápido em "Estoque".

- **Cadastro rápido sai:** não convive com "sem saldo, sem venda" no banco, e o
  schema da 1.0 já não tem a coluna de pendente.
- **PIN só quando há fato:** quantidade inicial maior que 0, ou excluir produto
  que tem o movimento do saldo inicial. O resto do cadastro grava sem PIN.
- **Código só depois de salvar.**

**Por quê:** o movimento de estoque exige quem fez; sem a assinatura, o saldo
inicial ficaria sem autor. Descartado: PIN em todo cadastro (cadastro é
editável, `R-OPERADOR-02`); cadastrar sempre com 0 e dar entrada à parte (dois
passos para o caso mais comum).
**Em observação:** o Agostinho acha que o PIN no cadastro pode atrapalhar
(cadastrar o catálogo em sequência). Fica assim; revemos se virar problema na
loja. A importação por planilha (tela 2.7) é o caminho para o catálogo inteiro.

### `2026-10-28` — Operador com PIN em cada gesto, administradora com PIN
Decisão do Agostinho, no percurso da tela 1 da 1.0. Troca a de `2026-10-23`
("seletor sem PIN, preparado para PIN futuro"). Regras em "Operadores e
login" (`R-OPERADOR-*`, `R-LOGIN-01`).

- **PIN de 4 dígitos por pessoa, pedido no fim de cada gesto que grava**, sem
  operador fixo na máquina. A operação recebe a assinatura (pessoa e PIN) e o
  back confere dentro da mesma chamada: a tela não tem como dizer "fui eu" sem
  o PIN.
- **A dona é a administradora:** o PIN dela cadastra as pessoas e autoriza os
  gestos sensíveis (D3 vira a lista desses gestos).
- **Login da loja criado por nós**, usado uma vez na primeira abertura; depois
  o app abre conectado.

**Por quê:** com duas pessoas no balcão, operador fixo grava a pessoa errada
sempre que alguém esquece de trocar, e o registro de quem fez perde o valor.
O custo é um PIN por recebimento, aceito. 4 dígitos são 10 mil combinações:
a proteção é a espera depois de 5 erros, não o hash.
Descartado: PIN só nos gestos sensíveis (de volta ao operador fixo no resto);
só o PIN, sem escolher a pessoa (um palpite errado acerta o PIN de outra).

### `2026-10-27` — Suíte de testes: regras e bugs numerados, cobertura conferida
Regra tem número (`R-ÁREA-NN`, nas "Regras de produto" e "de interface"), bug
tem número (`docs/bugs.md`), e o teste cita o número no nome. Um teste
(`testes/cobertura.test.ts`) quebra a suíte se um número ficar sem teste e sem
pendência declarada (`docs/testes.md`, com o motivo). Bug corrigido entra com
teste que falhava antes da correção. Testes em todo push (Ubuntu); teste de
tela (Playwright) fica para a Fase 3 da 1.0.

**Por quê:** a cobertura dependia de lembrar. A checagem de `2026-10-21` achou
17 defeitos e só um ganhou teste; A1 e M1 foram corrigidos sem nenhum. Com o
número, "esta regra tem teste?" vira pergunta que o código responde.
Descartado: rodar só na versão (a regressão aparecia dias depois, no Windows
do GitHub) e teste de tela agora (quebraria a cada mudança de leiaute antes de
as telas assentarem).

### `2026-10-07` — Comprovante não fiscal na térmica (alvo da 1.0)
A loja **não emite nota em toda venda**. Então, por padrão, **toda venda
finalizada imprime um comprovante não fiscal** (opção "Imprimir comprovante"
marcada por padrão, com reimpressão). A NFC-e pela Emitte fica como opção para
quando for necessária, **e por enquanto está de lado**. Não discutir com a loja
quando ela emite ou não emite nota.
- O comprovante leva "NÃO É DOCUMENTO FISCAL" e não imita a NFC-e (sem DANFE,
  chave de acesso, QR da SEFAZ ou tributos).
- **A 0.1 fica como está**: a impressão é da 1.0. Desenvolvimento e teste
  começam **no Linux**, com a impressora daqui: Elgin i8 (USB `1fc9:2016`),
  fila CUPS `POS-80`.
- Achado de `2026-10-07`: a fila `POS-80` foi criada com o driver **HP Designjet
  T920** (errado), e o Ubuntu não tem driver ESC/POS empacotado.
- A loja usa **Windows**: o caminho escolhido tem que funcionar lá também.
- **Abordagem: ESC/POS cru.** O processo principal monta os bytes (função pura,
  testável) e envia: no Linux, `lp -d POS-80 -o raw` (fila CUPS raw); no
  Windows, envio cru pelo spooler (a provar numa máquina Windows **antes** de
  investir na tela). **Por quê:** o Ubuntu não tem driver ESC/POS empacotado,
  então o caminho HTML + driver travava já no Linux; e bytes se testam no vitest.
- **Escopo inicial:** sem gaveta, sem notinha. Cabeçalho completo: nome,
  endereço, telefone e CNPJ da loja.
- **Fase 0 feita (`2026-10-07`):** fila `POS-80` recriada como **raw** (CUPS
  2.4 avisa que raw é "deprecated"; funciona, vigiar em upgrade do CUPS).
  Teste no papel: **48 colunas** na fonte padrão; acentos e "R$" certos em
  **CP850 (`ESC t 2`) e CP860 (`ESC t 3`)** — usar CP850; centralizar, negrito e
  **corte** (`GS V 66 0`) funcionam. Node não traz codificador CP850: tabela
  própria em TS (sem dependência).
- **Fase 1 feita (`2026-10-07`):** operação `imprimirComprovante` no contrato,
  montagem e envio no processo principal (`comum/comprovante.ts`,
  `electron/escpos.ts`, `electron/impressora.ts`), cupom completo impresso de
  verdade pelo mesmo código; o teste no papel foi registrado como igual à
  prévia em texto (confirmado pelo Agostinho). **Mas o código atual não
  sustenta isso:** `codificarCp850` passa cada linha por `limpar()`, que junta
  os espaços do alinhamento, e as colunas saem desalinhadas (checagem
  `2026-10-21`, A3). Corrigir e testar o cupom inteiro antes de confiar na
  prévia para ajustar layout. Config da máquina em `userData/comprovante.json`
  (modelo com dado inventado em `recursos/comprovante.exemplo.json`; na máquina
  de desenvolvimento já existe, com o exemplo).
- **PAUSADO até o teste da loja** (Agostinho, `2026-10-07`): o objetivo era
  provar que funciona. Se a loja aprovar, segue direto para a produção (1.0).
  **Nenhuma tela chama a operação**, então o instalador da 0.1 não oferece
  impressão. Falta, na volta: fase 3 (provar o envio cru no **Windows**) e
  fase 4 (tela: "Imprimir comprovante" marcado por padrão + "Reimprimir", título
  para a falha `impressora` em `src/falhas.ts`, interruptor em `src/funcoes.ts`
  se ainda sair release da 0.1 pelo `main`).

### `2026-09-22` — Repo único
Um repo para os dois lados. **Por quê:** no mesmo repo o contrato é o mesmo
arquivo para os dois, sem pacote npm para sincronizar. Descartado: dois repos +
pacote de contrato; o front entregar React solto e integrar no fim.

### `2026-10-06` — Maquininhas: Mercado Pago integrada, Sicoob manual
A loja tem **duas maquininhas**. A do **Mercado Pago** é a integrada ao sistema
(Orders API + Point em modo PDV: o sistema manda o valor, a maquininha cobra, o
sistema vê o "pago" e conclui a venda). A do **Sicoob** fica **manual**: venda
**parcelada** (parcelamento fora do sistema por enquanto) e **plano B quando o
sistema ou a internet caem**. Por isso a forma de pagamento da ficha precisa
dizer **qual maquininha**. Cartão: a **dona escolhe crédito ou débito no
sistema**. Pix: QR Code na própria maquininha (para o teste, considerar modelo
com QR — Point Pro 2/3; a Point Smart não tem Pix na máquina).
- **0.1 (demonstração):** o fluxo aparece no app, **simulado** (sem credencial
  na máquina da loja, sem depender do Mercado Pago na hora). Contrato com três
  operações — iniciar, consultar e cancelar cobrança — que na 1.0 passam a falar
  com o Mercado Pago sem mudar a tela.
- **Prova real (`2026-10-06`)** com a credencial de teste e a maquininha virtual
  `NEWLAND_N950__SBX0000001` (`POST /v1/orders` type `point`; simulação em
  `POST /v1/orders/{id}/events`): crédito e débito aprovados, recusa, expiração
  — tudo visto pela consulta `GET /v1/orders/{id}` em 2–10 s. Aprendizados: **só
  uma cobrança aberta por maquininha** (`already_queued_order_on_terminal`); o
  simulador **não aceita Pix** (só bandeiras de cartão) e **cancelar pela API**
  dá `forbidden_checking_device_owner` na maquininha virtual — Pix e cancelamento
  só se provam com maquininha real. No débito a simulação não aceita parcelas.
  Sem webhook (app de mesa não tem endereço público): o processo principal
  consulta o status da order.
- **Feito na 0.1:** na nova ficha, Cartão escolhe **crédito/débito** e
  **Mercado Pago/Sicoob**; Pix escolhe **QR na maquininha** ou **Pix manual**
  (manual fica sempre disponível: plano B). Mercado Pago abre a janela de
  cobrança (enviando → na maquininha → aprovado, ou recusado com "tentar de
  novo"/"usar outra forma"; "simular recusa" só na demonstração) e a venda se
  registra sozinha ao aprovar, com rótulo "Cartão crédito Visa · Mercado Pago".
  Sicoob e Pix manual seguem como antes (conferir e concluir). Fora: misto e
  recebimento de notinha pela maquininha, parcelamento (Sicoob).

### `2026-10-06` — Duas versões: 0.1 (piloto online) e 1.0 (produção)
A loja **ainda não fechou** contrato. A Attlas monta o sistema para a loja
testar no dia a dia, com **simulações** (produtos e clientes fictícios), gerar
interesse e só então combinar valores — método de conquistar cliente.
- **Versão 0.1 — piloto:** tudo **online**, app ligado a um **Supabase free**;
  **login único da loja** só por consciência (dona + funcionária, sem
  restrição por pessoa); emissão de **NF-e e NFC-e pela Emitte** já no piloto,
  com **cupom em impressora térmica**; instalação e atualização **manuais**,
  com a Attlas monitorando.
- **Versão 1.0 — produção:** começa quando a loja aceitar (**aceita em
  `2026-10-21`**). Aí entra o desenho
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
- **Teste de formato compara a saída inteira com a referência.** O teste dos
  bytes do comprovante conferia só o começo, o fim e uma linha centralizada, e
  o desalinhamento das colunas passou (checagem `2026-10-21`).
- **Recusa silenciosa mais retorno ignorado é perda silenciosa.** A ação da
  base recusava a entrada fracionada com `false` e a tela seguia em frente. O
  `Resultado<T>` do contrato da 1.0 obriga a tratar a recusa.
