# Revisão com o Victor — 01/10/2026

Registro consolidado por Codex a pedido do Victor, com base nas decisões desta
conversa, nos prints e no código. O estado vivo continua em [Memoria.md](../../Memoria.md).

**Ponto de parada: Financeiro NÃO VALIDADO pelo Victor. Retomar essa tela na próxima sessão.**
As autorizações de implementação não encerraram a validação da experiência de uso.

## Objetivo e modo de trabalho

A dona da papelaria não é profissional de tecnologia. O Victor está simulando o
usuário para entender cada componente, conferir se faz sentido e lapidar a
interface. Preservar as regras do projeto, reduzir escolhas e apresentar só as
informações úteis para a rotina. A revisão acontece por setor, seguindo os prints
ou componentes que ele indicar. Explicar a regra real do código e sugerir mudanças
concretas; não iniciar uma nova revisão geral ao retomar.

## Tarefas concluídas nesta rodada

### Início — revisão desta rodada encerrada

- [x] Remover comparação com ontem e a frase "Sem movimento ontem até esta hora"
  de Recebimentos do dia. O cartão se concentra no total de hoje.
- [x] Confirmar que recebimentos são pagamentos registrados em dinheiro, Pix e
  cartão, inclusive notinhas recebidas hoje; venda fiada ainda não paga não entra.
- [x] Preservar Vendas concluídas: número de fichas concluídas no dia e média por
  venda. Não confundir com quantidade de pagamentos recebidos de fichas antigas.
- [x] Separar despesas das retiradas físicas. Levar dinheiro da gaveta ao cofre
  muda o esperado físico, sem criar uma despesa.
- [x] Corrigir a trepidação do histórico ao trocar de página, com colunas estáveis
  e descrição limitada a duas linhas, mantendo o texto completo no `title`.
- [x] Permitir consulta a qualquer dia passado e hoje; bloquear datas futuras
  no calendário, nas setas e na digitação. O filtro altera o histórico, não os cartões.
- [x] Remover o filtro exclusivo Misto. Uma ficha mista aparece em Todos e em cada
  meio usado; o detalhe conserva os valores da divisão. Notinha mantém filtro próprio.

### Clientes — revisão desta rodada encerrada

- [x] Manter os cartões de notinhas contando clientes. Várias notinhas do mesmo
  cliente não aumentam a quantidade de clientes do cartão. A classificação atual
  prioriza atraso quando o cliente também tem notinhas ainda no prazo.
- [x] Clarificar o acesso às vendas sem identificação: descrição do atalho
  "consultar histórico" e da página "Vendas realizadas sem identificar o cliente".
  É uma consulta a fichas sem cliente, não um cadastro de cliente genérico.
- [x] Remover Misto também dos filtros das vendas sem identificação e incluir
  essas vendas nos filtros dos meios usados. Bloquear datas futuras nessa consulta.
- [x] Abolir e-mail do cadastro, edição e detalhe do cliente, dos tipos, semente
  e validações. A leitura da base antiga descarta esse campo sem resetar os dados.
- [x] Permitir recebimento misto de notinhas: duas ou três formas somam o valor
  informado, inclusive para pagamento parcial ou de várias notinhas. O abatimento
  segue da mais antiga para a mais nova; cada meio é preservado no Financeiro.
- [x] Calcular troco só na parcela em dinheiro; gravar o recebimento completo de
  forma atômica, recusando valor inválido, soma divergente e pagamento acima do aberto.
- [x] Corrigir busca de cliente por nome sem acento, código, CPF/CNPJ e telefone,
  com ou sem pontuação. Reutilizar a mesma regra em Clientes, busca global e nova ficha.

### Financeiro — implementações feitas; validação de uso pendente

- [x] Manter três cartões do período: Entradas, Despesas e outras saídas, Entradas
  menos despesas. Remover comparação com o período anterior.
- [x] Separar Caixa atual desses cartões. O esperado da gaveta pertence ao turno
  aberto e não muda porque o usuário selecionou Dia, Semana, Mês ou Ano.
- [x] Reforçar a identificação à esquerda com ícone de dinheiro, data/horário de
  abertura e operador em linhas separadas.
- [x] Criar janelas centrais compactas para abertura, adição, retirada e fechamento.
  Contagem de abertura não é receita; fechamento não cria despesa. Cancelar uma
  janela não fecha o caixa. Só existe um turno aberto e não há virada automática diária.
- [x] Exigir motivo quando a contagem final difere do esperado; explicar falta
  ou sobra em reais. Preservar contagem, esperado e motivo de fechamentos anteriores.
- [x] Simplificar Registrar movimento para Entrada / Despesa e Forma de pagamento.
  Remover a retirada duplicada desse formulário; vendas e notinhas usam suas fichas.
- [x] Concentrar Adicionar dinheiro e Retirar dinheiro no Caixa atual. Exigem
  turno aberto e origem/destino ou motivo. Afetam a gaveta; essas transferências e
  seus estornos ficam fora de entradas e despesas operacionais.
- [x] Renomear a tabela para Movimentações financeiras, pois também inclui Pix e cartão.
- [x] Exibir fechamentos dos últimos sete dias corridos (hoje e seis anteriores),
  com data do fechamento, dinheiro contado, situação e Ver. Não somar saldos de dias.
- [x] Criar consulta por De/Até e atalhos Últimos 7 dias / Este mês, sem datas futuras.
  Um caixa fechado é filtrado pelo fechamento em São Paulo, mesmo se abriu em outro dia.
- [x] Manter no histórico Aberturas e fechamentos / Adições e retiradas, incluindo
  estornados. No detalhe, mostrar os movimentos do turno e acesso às fichas vinculadas.
- [x] Preparar exemplos: três fechamentos recentes e um antigo, com contagens
  coerentes e uma falta de R$ 10,00 justificada. A prévia local acrescenta os exemplos
  antes do turno aberto, sem substituí-lo ou duplicar exemplos ao recarregar. Os
  movimentos de exemplo são transferências físicas identificadas pela descrição;
  não representam uma amostra completa de vendas. Só são criados em desenvolvimento.

## Retomada do Financeiro

Estes itens estão **não validados**, por orientação expressa do Victor:

- [ ] Percorrer os fechamentos de exemplo e decidir se o histórico compacto está claro.
- [ ] Consultar dia antigo e intervalo de semana/mês, abrir detalhes e voltar sem perder a consulta.
- [ ] Simular chegada: contar a gaveta e abrir. Abrir caixa aparece quando não há
  turno aberto, em qualquer horário; não é um botão automático de início de dia.
- [ ] Simular reforço de troco, retirada para o cofre e pagamento de despesa;
  conferir onde cada ação aparece e quais totais altera.
- [ ] Receber uma venda/notinha em dinheiro, Pix, cartão e misto; conferir a
  separação entre Financeiro e dinheiro físico na gaveta.
- [ ] Fechar com contagem exata, falta e sobra; consultar o resultado no histórico.
- [ ] Revisar o caso de esquecer o fechamento: um caixa aberto ontem continua
  aberto hoje. A rotina diária é manual; não foi aprovada uma imposição de fechamento.
- [ ] Conferir estornos e os lançamentos antigos da semente chamados Troco e
  Saída de caixa. Eles antecedem as categorias novas; não presumir que foram migrados.
- [ ] Decidir se haverá controle de saldo do cofre. Hoje há origem/destino textual
  e histórico, sem saldo próprio do cofre.
- [ ] Continuar os demais blocos do Financeiro que o Victor apontar. Depois dessa
  validação, avançar aos outros setores; não tratá-los como já revisados nesta rodada.

## Verificação técnica e ambiente ao encerrar

- [x] 72 testes passaram e o build foi concluído após o cenário de fechamentos.
- [x] Telas afetadas exercitadas em contextos isolados no Chromium, a 1300 e 900 px,
  sem erros de JavaScript nem transbordamento horizontal do documento.
- [x] Fluxos de adição/retirada, despesa, fechamento, histórico por período,
  bloqueio de data futura, persistência e ausência de duplicação dos exemplos conferidos.
- [x] Reutilizada uma única janela visível do Electron. Não abrir outra a cada alteração.

Esses resultados técnicos não significam validação do Financeiro pelo Victor ou
teste operacional com a dona. Leitor físico e jornada completa continuam pendentes.

Branch: `analise-de-funcao`. Alterações locais incluem também a auditoria e correções
anteriores; não descartá-las na próxima sessão. Banco online e contrato real ainda
não foram integrados. Os dados vivem no `localStorage`, separados por origem.

`npm run dev` inicia Vite na porta 5173 e Electron pelo plugin do projeto, com
atualização automática do front. Antes de iniciar, verificar se já estão rodando.
`npm start` faz build e abre Electron; não usá-lo repetidamente durante a revisão.
Os prints de verificação ficaram na pasta temporária do Windows, fora do repositório.
As decisões estão descritas em texto aqui, sem depender dos prints ou desta conversa.
