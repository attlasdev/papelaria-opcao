import { ok, type Contrato } from '../../comum/contrato'
import { montarPainel } from './painel'
import { simular } from './simular'

/**
 * O mock do contrato. E o que permite montar tela inteira no navegador, com
 * `npm run dev`, sem Electron, sem banco e sem credencial nenhuma.
 *
 * `const mock: Contrato` faz o compilador exigir uma entrada por operacao. Quando o
 * back adiciona uma operacao ao contrato, o build daqui quebra ate o mock ganhar
 * uma resposta falsa para ela — e e assim que o front descobre que tem tela nova
 * para fazer, sem ninguem avisar por mensagem.
 *
 * Dado falso mora aqui, em memoria. Se uma tela precisar que a lista mude quando
 * ela cria um item, guarde um array neste modulo e mexa nele: o mock pode ter
 * estado, e ter estado e o que faz a tela parecer viva.
 */
const mock: Contrato = {
  ping: () => simular(() => ok({ ambiente: 'mock', quando: new Date().toISOString() })),
}

window.api = mock
montarPainel()
