import { ok, type Contrato } from '../comum/contrato'

/**
 * O lado real do contrato: e aqui que se fala com o banco.
 *
 * Pode lancar excecao a vontade — o registro em `main.ts` embrulha toda chamada e
 * converte em `Falha`. O que nao pode e deixar uma excecao chegar ao front, e isso
 * esta garantido la, nao aqui.
 *
 * `const operacoes: Contrato` faz o compilador exigir uma implementacao por
 * operacao do contrato.
 */
export const operacoes: Contrato = {
  ping: async () => ok({ ambiente: 'electron', quando: new Date().toISOString() }),
}
