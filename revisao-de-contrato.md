# Revisao de contrato — a lista do passo 2

Para mim (back), quando o front entregar o primeiro corte de `comum/contrato.ts`.

**Quando:** depois da primeira ou segunda tela dele, antes da terceira. Mais cedo ele
ainda nao sabe do que precisa; mais tarde ja tem tela montada em cima da forma errada.

**O que isto nao e:** nao e revisao de codigo nem de gosto. O vocabulario e dele — se
o cliente chama de "pedido", nao renomear para "ordem" porque soa melhor. Eu olho
sete coisas que ele nao tem como ver de onde esta.

---

## 1. Atomicidade — onde a operacao comeca e termina

Para cada operacao de escrita, contar **quantas escritas no banco ela vira**.

- [ ] Alguma operacao vira 2+ escritas que tem que valer juntas? Entao ela e uma
      transacao, e precisa ser **uma** chamada.
- [ ] Ha duas ou tres operacoes que a tela SEMPRE chama em sequencia? Provavel
      candidata a fundir numa so. Pergunta decisiva: *se a segunda falhar, o estado
      que sobrou faz sentido?* Se nao, funde.
- [ ] Ha uma operacao gorda que a tela chama em pedacos diferentes, em momentos
      diferentes? Candidata a separar.

Este e o unico item da lista que **nao tem conserto depois**: a forma errada ja vazou
para o front e mexer nela mexe nas telas.

## 2. Catalogo de falhas

Para cada operacao, escrever a lista de causas que ela pode devolver.

- [ ] A causa existe porque a tela **oferece acao diferente** por causa dela. Se duas
      causas levam a mesma tela, sao uma.
- [ ] Toda operacao pode dar `rede` e `desconhecida`. Confirmar quais das outras.
- [ ] `validacao`: o banco valida o que a tela ja validou? Onde a regra mora de
      verdade? (Regra que existe so na tela e regra que nao existe.)
- [ ] `conflito`: duas pessoas podem estar na mesma tela? Se sim, quem escreve por
      ultimo ganha, ou o segundo leva `conflito`? Isso e decisao, nao detalhe.
- [ ] A mensagem de erro que eu devolvo pode carregar URL de conexao, nome de tabela
      ou pedaco de credencial? Generica para a tela, completa no log.

## 3. Gestos irreversiveis

- [ ] Listar todo botao que **escreve**. Marcar os que destroem dado sem volta.
- [ ] Para cada um: confirmacao digitada, ou basta um "tem certeza?"
- [ ] Ha algo que **sobrescreve** em silencio? Substituir arquivo, reimportar
      planilha, salvar formulario sobre versao mais nova? Sobrescrita silenciosa e
      onde dado de cliente morre.
- [ ] O que deveria ser arquivar/desativar em vez de apagar de verdade?

## 4. Custo

- [ ] Algum campo que a lista pede exige uma consulta por linha? (N+1.) Ou vem do
      banco em agregacao, ou sai da lista.
- [ ] Lista sem limite: quantos itens no pior caso? Acima de ~200, paginacao entra no
      contrato **agora**, nao depois — paginacao retroativa muda a tela.
- [ ] Alguma operacao carrega blob/arquivo grande por IPC? Tamanho tipico e maximo.
- [ ] Algo que a tela pede a cada tecla digitada (busca)? Precisa de debounce dela e
      de indice meu.

## 5. Tipos que enganam

- [ ] **Dinheiro**: inteiro em centavos, nunca `number` decimal. `19.90` em float da
      `19.899999`, e isso vira reclamacao de cliente.
- [ ] **Data**: string ISO 8601 em UTC no contrato; formatacao e da tela. Nunca
      `Date` (nao sobrevive ao IPC como Date), nunca "dd/mm/aaaa" no dado.
- [ ] **Id**: string sempre, mesmo se no banco for inteiro. Se um dia virar uuid, o
      front nao muda.
- [ ] **Enum**: uniao fechada de string (`'pago' | 'aberto'`), nunca `string` solta —
      senao a tela nao tem como saber o que desenhar.
- [ ] **Opcional**: `campo?: T` (pode nao vir) e `campo: T | null` (vem vazio) sao
      coisas diferentes na tela. Escolher de proposito.

## 6. Derivado x armazenado

- [ ] Que campos do contrato eu **calculo** em vez de guardar (total, contagem,
      status)? Se a tela edita um campo derivado, alguem entendeu errado.
- [ ] Algum campo que a tela manda e que eu deveria ignorar e recalcular? (Total de
      pedido vindo da tela e convite a divergencia.)

## 7. O que falta

- [ ] Ha login? Entao falta o vocabulario de sessao no contrato, e `permissao` muda
      de sentido.
- [ ] Ha algo que precisa funcionar **sem internet**? Isso muda o contrato inteiro —
      decidir antes, nao depois.
- [ ] Impressao, exportacao, PDF, planilha: quem gera? Se for eu, e operacao no
      contrato e devolve bytes ou caminho salvo pelo processo principal.

---

## O que eu devolvo para ele

Um comentario por operacao, em PR no proprio `comum/contrato.ts`:

1. as operacoes que viram uma so, com o motivo (item 1);
2. o catalogo de falhas de cada uma, para ele forcar no mock (item 2);
3. os gestos que precisam de confirmacao de verdade (item 3);
4. o que sai do contrato por ser caro, e o que entra no lugar (item 4).

Depois disso, mudanca de contrato vem em PR proprio, separado de tela.
