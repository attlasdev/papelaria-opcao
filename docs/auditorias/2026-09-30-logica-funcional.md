# Auditoria funcional — Papelaria Opção

**Data:** 30/09/2026 · **branch:** `analise-de-funcao` · **commit examinado:** `c397e1f`

> Este é o diagnóstico histórico da versão examinada. As correções posteriores
> estão no fim do relatório; a revisão de uso de 01/10 está em
> [Revisão com o Victor](../historico/2026-10-01-revisao-com-victor.md).
> O estado atual fica em [Memoria.md](../../Memoria.md).
> **Financeiro continua NÃO VALIDADO pelo Victor**, mesmo após as implementações
> e verificações técnicas.

## Veredito

O aplicativo já sustenta uma **demonstração coerente do balcão**: venda, baixa de estoque, notinha, recebimento, cancelamento e estorno aparecem nas telas relacionadas. **Ainda não está pronto para ser o controle operacional e financeiro único de uma papelaria.** O impedimento é de regra de negócio e rastreabilidade, além da integração futura: há um descompasso reproduzível no estoque, dados de recebimento de mercadoria que desaparecem, e o painel financeiro não reconcilia o dinheiro real nem distingue retirada de despesa no resumo.

Este parecer avalia comportamento e adequação ao trabalho da papelaria. Não é uma revisão de arquitetura, banco ou segurança.

## Método e alcance

1. Li `CLAUDE.md`, `Memoria.md`, `AGENTS.md`, tipos, ações, cálculos e telas. Separei falhas observadas de escolhas já registradas como pendentes.
2. Executei `npm test`: **54/54 testes passaram**. Executei `npm run build`: **concluiu** (aviso de tamanho do bundle, fora deste escopo).
3. Usei Chromium automatizado com contextos isolados, sem alterar os dados do navegador do usuário. Percorri **13 rotas** a 900 px sem exceção de JavaScript nem transbordo horizontal do documento. Exercitei venda, modais, recebimento parcial, estorno, entrada de mercadoria e movimento financeiro.
4. Abri o build em **Electron** por `file://`, naveguei ao Financeiro, abri e fechei a gaveta de movimento com Esc; a janela carregou sem erro de JavaScript. O leitor físico e uma jornada completa no Electron seguem sem teste.
5. Comparei decisões de negócio com repositórios de PDV/ERP no GitHub; não importei código nem instalei dependências no projeto.

O painel **MOCK** da prévia tem `z-index:99999` (`src/mock/painel.ts:18`) e cobre o botão de confirmação de gavetas no canto inferior direito. Para testar esses formulários no Chromium, removi apenas esse painel de desenvolvimento do DOM do contexto isolado. O problema não apareceu no build Electron, onde o painel não é carregado.

## Achados confirmados

### A1 · Crítico · Venda acima do saldo e cancelamento quebram a conta do estoque

**Reprodução pela interface:** produto `EST-0027` começou com saldo **0**; vendi **1** unidade por Pix na ficha `#1130`; o saldo ficou **0**. Ao cancelar a ficha com motivo, o saldo passou a **1**. O histórico registra `Venda 0 → 0` e `Cancelamento 0 → 1`.

**Causa:** a venda usa `Math.max(0, saldo − vendido)` (`src/mock/estado-demonstracao.ts:150`), mas o cancelamento soma toda a quantidade da ficha (`:199–200`). O saldo registrado aumenta após uma venda e seu desfazimento, sem entrada ou ajuste que explique a diferença. Pode coincidir com uma correção física do estoque, mas a trilha não distingue devolução de acerto de contagem.

**Decisão necessária:** definir se a venda sem saldo será bloqueada, confirmada com divergência explícita ou registrada com saldo negativo. O cancelamento deve reverter a mesma quantidade que a venda efetivamente baixou; qualquer diferença física deve passar por ajuste identificado. Este item já aparece como pendência 3 em `Memoria.md`, mas o efeito no cancelamento não estava explicitado.

### A2 · Alto · Dados de entrada de mercadoria somem ao confirmar

**Reprodução pela interface:** na entrada completa, informei fornecedor `Fornecedor auditoria`, referência `NF TESTE 123` e observação `Caixa avariada`, depois lancei 1 unidade de `EST-0022`. O estoque foi de **6 para 7**, mas o movimento salvo contém somente `Recebimento de mercadorias`.

**Causa:** os campos de fornecedor, referência e observação não têm estado nem são lidos em `confirmar` (`src/telas/registrar-entrada/RegistrarEntrada.tsx:250–253`, `:212–223`). A data selecionada também não é usada, como já consta da pendência 8 de `Memoria.md`. O custo total exibido usa o custo do **cadastro do produto** (`:227`), sem capturar o preço efetivo daquela entrega. Não se consegue responder depois qual fornecedor, documento, data ou custo correspondem ao acréscimo de saldo.

**Critério de correção:** uma entrada deve preservar cabeçalho (data real, fornecedor, referência, observação) e linhas (produto, quantidade, custo da compra), ligados aos movimentos de estoque. Se algum campo for meramente ilustrativo, retire-o da tela até existir o comportamento.

### A3 · Alto · O resumo financeiro mistura medidas diferentes

`movimentosFinanceiro` junta pagamentos em dinheiro, Pix e cartão com lançamentos manuais (`src/mock/base/derivados.ts:154–190`). `resumoFinanceiro` soma tudo em **Entradas**, **Saídas** e **Líquido** (`:199–223`). Uma “Retirada do caixa” entra em Saídas e reduz o Líquido (`src/telas/registrar-movimento/RegistrarMovimento.tsx:24`, `src/mock/base/derivados.ts:209`). Assim, o número não representa nem dinheiro físico na gaveta, nem saldo bancário, nem lucro. A nota “Relatório do balcão. Não substitui a contabilidade.” ajuda, mas não explica essa composição ao operador.

**Critério de correção:** dar nomes e cálculos separados para vendas, recebimentos, despesas, transferências/retiradas e saldo de cada meio. Exibir o que entrou pelo balcão sem chamar de saldo do caixa ou resultado econômico. A pendência 4 de `Memoria.md` já pergunta sobre a retirada; esta auditoria recomenda tratá-la como transferência, não despesa da operação.

### A4 · Alto · Não há abertura, contagem e fechamento do caixa

Há movimentos de dinheiro, mas não há fundo inicial, turno, operador responsável pelo caixa, valor esperado em espécie, valor contado nem registro de diferença. A interface permite lançar despesas e retiradas, mas não responder “quanto deveria haver na gaveta agora e quanto há de fato?”. Isso limita o uso como caixa diário, mesmo com todas as vendas digitadas corretamente.

**Critério de correção:** fluxo de abertura com fundo de troco, movimentos de espécie durante o turno, sangria/transferência, contagem de fechamento e diferença justificada. Pix e cartão devem ter conferência própria; não devem ser contados como cédulas na gaveta. A comparação com [Open Source Point of Sale](https://github.com/opensourcepos/opensourcepos) e [ERPNext](https://github.com/frappe/erpnext) mostrou “cash up” e conciliação de fechamento como partes explícitas desses sistemas. O [caso de troco no fechamento do ERPNext](https://github.com/frappe/erpnext/issues/25638) ilustra por que “valor recebido” e “dinheiro que ficou” precisam ser distinguidos.

### A5 · Médio · “Retirada do caixa” aceita Pix e cartão

**Reprodução pela interface:** registrei “Transferência para cofre” como **Retirada do caixa**, meio **Pix**, R$ 10,00. O movimento foi salvo com `categoria: "Retirada de caixa"`, `meio: "pix"`, `valor: -1000`. O formulário não restringe o meio conforme o tipo (`src/telas/registrar-movimento/RegistrarMovimento.tsx:30–58`, `:80–89`). Uma retirada para cofre é movimento de numerário; se a intenção for transferência bancária, precisa de outra descrição e destino.

**Critério de correção:** restringir retirada física a dinheiro ou modelar transferência entre contas/locais com origem e destino explícitos.

### A6 · Médio · Falta autoria nos atos de correção

A ficha guarda `operador`, mas estorno guarda só data, hora e motivo; movimento de caixa e de estoque também não identificam autor (`src/mock/base/tipos.ts:57`, `:78–115`). Em equipe, duas pessoas podem cancelar fichas, ajustar saldo e estornar dinheiro sem que o histórico diga quem fez. O login/multiusuário já é pergunta aberta em `Memoria.md`; a necessidade funcional existe independentemente do mecanismo de autenticação.

**Critério de correção:** registrar responsável em cada movimento, recebimento, ajuste e estorno, e mostrá-lo no histórico. Definir quais ações exigem autorização da dona.

### A7 · Médio · Mesmo documento pode gerar dois clientes

**Reprodução pela interface:** cadastrei `Cliente Auditoria A` com documento `123.456.789-00` e `Cliente Auditoria B` com `12345678900`. Ambos foram aceitos (`CLI-0128` e `CLI-0129`) no contexto isolado. O formulário compara o texto literal (`src/telas/formulario-cliente/JanelaCliente.tsx:72–74`), sem comparar os dígitos. A regra declarada em `Memoria.md` diz que documento repetido é barrado; a validação de CPF em si é uma decisão separada, ainda pendente.

**Critério de correção:** comparar documentos normalizados para dígitos, inclusive na edição, e manter o mesmo formato de apresentação no cadastro e na busca.

## Lacunas de produto já conhecidas, mas decisivas para produção

| Tema | Situação atual | Decisão/ensaio antes de operar |
| --- | --- | --- |
| Pagamento misto | À vista gera um único pagamento (`src/telas/criar-ficha/CriarFicha.tsx:154–156`). | Ensaiar compra paga parte em dinheiro e parte em Pix/cartão. O [pedido de split payment no ERPNext](https://github.com/frappe/erpnext/issues/2733) mostra que é um caso de balcão real; não é requisito automático se a dona disser que não usa. |
| Cartão e Pix | A tela marca “Cartão” sem débito/crédito, parcelas, taxa, prazo de liquidação ou vínculo com extrato; pendência 6 de `Memoria.md`. | Conferir transações reais da maquininha e do banco antes de prometer conciliação ou líquido da conta. |
| Devolução parcial | Só há cancelamento da ficha inteira; pendência 2 de `Memoria.md`. | Simular cliente devolvendo 1 de 3 itens, com reembolso parcial e retorno seletivo ao estoque. |
| Fiscal e comprovantes | Notas são rascunhos simulados; “Comprovante”, exportação e emissão não têm destino (`Memoria.md`, regras de notas; `src/telas/criar-ficha/CriarFicha.tsx:257–259`; `src/telas/financeiro/Financeiro.tsx:88–90`). | Definir com a contabilidade o fluxo documental exigido. Até lá, anunciar a área como preparação, não emissão. |
| Compras e margem | Entrada repõe unidades, sem obrigação com fornecedor ou custo por lote; pendência 5 de `Memoria.md`. | Decidir se o sistema só controla caixa/estoque ou se deve responder custo de mercadoria, contas a pagar e margem. |

## O que funcionou nos cenários exercitados

- Venda sem identificação foi concluída e apareceu em ficha, financeiro e baixa de estoque. A escolha de notinha ficou bloqueada sem cliente identificado.
- Conclusão sem cliente mostrou a validação. Cancelamento e estorno exigiram motivo; o original permaneceu visível.
- No recebimento de Mariana Costa, pagamento parcial de **R$ 70,00** abateu **R$ 62,60** da notinha `#0800` e **R$ 7,40** da `#1044`. Dinheiro entregue de R$ 50,00 bloqueou a confirmação; R$ 100,00 permitiu.
- Lançamento manual de despesa de **R$ 12,50** foi salvo; o estorno criou movimento inverso de **+R$ 12,50** e manteve o original.
- Cadastro de cliente vazio exigiu nome. Ajuste de estoque recusou contagem igual à atual e motivo vazio; ao informar **6 → 9** com motivo, gravou o movimento e o novo saldo.
- As 13 rotas principais abriram a 900 px sem erro de JavaScript e sem transbordo horizontal do documento. O Electron carregou o build e abriu a gaveta do Financeiro por `file://`.

## Referências externas e capacidades úteis

- [Open Source Point of Sale](https://github.com/opensourcepos/opensourcepos): referência mais próxima do balcão pequeno. O README lista estoque, recebimento de mercadorias, despesas, fechamento do caixa, recibos e relatórios. Em 30/09/2026, a [API do GitHub](https://api.github.com/repos/opensourcepos/opensourcepos) mostrou cerca de **4,4 mil estrelas** e atualização no dia.
- [ERPNext](https://github.com/frappe/erpnext): referência de regras entre PDV, contas a receber, estoque e fechamento; não é proposta de adotar sua arquitetura. A [API do GitHub](https://api.github.com/repos/frappe/erpnext) mostrou cerca de **39,7 mil estrelas** e atualização no dia. Problemas recentes de [saldo/lançamento de estoque](https://github.com/frappe/erpnext/issues/56950) e [fechamento de período](https://github.com/frappe/erpnext/issues/57853) são bons cenários adversariais, não prova de falha neste projeto.
- [Odoo](https://github.com/odoo/odoo): referência ampla de fluxos integrados, com cerca de **54,8 mil estrelas** e atualização no dia pela [API do GitHub](https://api.github.com/repos/odoo/odoo). Usar apenas para comparar casos concretos; o escopo integral é grande demais para esta papelaria.
- Skill local `domain-modeling`: útil para nomear “retirada”, “recebimento”, “despesa”, “saldo de caixa” e tornar decisões verificáveis. A pasta `Stack/go` oferece o método de hipótese, cenários adversariais e matriz de cobertura; usei a postura crítica, sem importar o pipeline de crítica de ideias como regra deste projeto.
- Playwright já disponível globalmente nesta máquina: permitiu testar a interface em Chromium e Electron sem adicionar dependência ao repositório.

As estrelas indicam popularidade acumulada; **não verifiquei downloads nem crescimento de estrelas nos últimos meses**. A seleção combina uso conhecido e atividade recente, sem afirmar que algum deles “viralizou” recentemente.

## Sequência recomendada

1. Decidir a política de venda sem saldo e corrigir a reversão de estoque; proteger com teste do ciclo venda → cancelamento.
2. Fazer a entrada de mercadoria preservar o que o operador informou e separar custo efetivo da compra do custo do cadastro. Corrigir a comparação de documentos no cadastro de clientes.
3. Definir os números do Financeiro e modelar turno/fechamento do caixa antes de usá-lo para conferir dinheiro.
4. Validar com a dona quatro cenários: pagamento misto, devolução parcial, Pix/cartão com parcelas e taxas, retirada para cofre.
5. Definir autoria/autorizações dos atos de correção e ensaiar a jornada inteira no Electron com leitor físico e dados de operação.

## Correções aplicadas após a auditoria

- **A1:** após a decisão do Victor, a interface e a ação de dados bloqueiam vendas com saldo insuficiente, sem criar ficha, pagamento ou movimento. A ficha em andamento fica guardada enquanto o operador confere e corrige o estoque. Fichas anteriores ainda preservam a baixa real para cancelamento coerente.
- **A2:** entrada completa e entrada rápida guardam os dados informados sobre a compra no movimento do estoque. A data do recebimento fica separada da data do lançamento; o custo desta entrega é informado por item e não é presumido do cadastro.
- **A3 e A5:** retirada física só aceita dinheiro, aparece separada das despesas no resumo e pode ser estornada sem inflar o total operacional. O resumo explica que não é lucro nem saldo de conta ou gaveta.
- **A4:** foi criada a conferência de dinheiro com abertura por contagem, cálculo dos novos movimentos em espécie, fechamento por contagem e justificativa obrigatória para diferença. Pix e cartão não entram nessa gaveta. Ainda falta testar o procedimento com a dona e decidir se o cofre terá saldo próprio.
- **A6:** novos pagamentos, movimentos e estornos registram o operador da base local e o mostram nos históricos pertinentes. Autenticação e autorização por pessoa continuam fora deste estágio.
- **A7:** cadastro e edição comparam os dígitos de CPF/CNPJ na interface e na ação de dados, recusando duplicação com outra pontuação.

O pagamento misto também foi implementado depois da auditoria: pelo menos dois meios positivos, soma exata do total, troco só sobre a parcela em espécie e um lançamento financeiro por meio. Devolução parcial ficou adiada; destino da retirada e política de custo seguem em aberto. A conferência do dinheiro é opcional e começa pela contagem do valor já na gaveta, inclusive o que veio do dia anterior.

Após essas alterações, `npm test` passou com 60 testes e `npm run build` concluiu. No Chromium, em contextos isolados, foram exercitados bloqueio de venda sem saldo, soma e troco do pagamento misto, ficha e lançamentos separados, abertura e fechamento com diferença, restrição da retirada, cadastro duplicado e entrada completa a 1300 e 900 px, sem erro JavaScript ou transbordo horizontal do documento. O build com a conferência também abriu em `file://` no Electron sem erro JavaScript. A validação física do leitor e a jornada completa no Electron permanecem pendentes.
