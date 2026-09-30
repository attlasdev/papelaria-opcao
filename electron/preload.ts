import { contextBridge, ipcRenderer } from 'electron'
import type { Contrato } from '../comum/contrato'

/**
 * A ponte. Uma funcao nomeada por operacao permitida — nada generico.
 *
 * Um `invoke(canal, ...args)` exposto ao renderer anularia a separacao: a tela
 * poderia chamar qualquer canal registrado no processo principal, que e justamente
 * quem guarda a chave do banco. Aqui o conjunto de canais e exatamente as chaves
 * de `Contrato`, e `ipcRenderer` nunca chega ao renderer.
 *
 * `const api: Contrato` faz o compilador conferir duas coisas de graca:
 * nenhuma operacao do contrato ficou de fora, e nenhuma assinatura divergiu.
 *
 * Nenhuma funcao daqui devolve chave, segredo ou caminho de arquivo.
 */
const api: Contrato = {
  ping: () => ipcRenderer.invoke('ping'),
}

contextBridge.exposeInMainWorld('api', api)
