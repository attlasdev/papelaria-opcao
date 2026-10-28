import { useSyncExternalStore } from 'react'
import type { CausaFalha, Operadores } from '../../comum/contrato'
import { api } from './api'

/**
 * As pessoas da loja, lidas uma vez e relidas depois de cada mudança no
 * cadastro. Quem decide se a loja abre (há administradora?) e quem lista na
 * janela "Quem está fazendo?" leem daqui.
 */
export type EstadoOperadores =
  | { fase: 'carregando' }
  | { fase: 'erro'; causa: CausaFalha; mensagem: string }
  | { fase: 'pronto'; dado: Operadores }

let estado: EstadoOperadores = { fase: 'carregando' }
let pedido: Promise<void> | null = null
const ouvintes = new Set<() => void>()

function definir(novo: EstadoOperadores) {
  estado = novo
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function recarregarOperadores() {
  pedido ??= api().listarOperadores().then((r) => {
    pedido = null
    definir(r.ok ? { fase: 'pronto', dado: r.dado } : { fase: 'erro', causa: r.causa, mensagem: r.erro })
  })
  return pedido
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  if (estado.fase === 'carregando') void recarregarOperadores()
  return () => { ouvintes.delete(ouvinte) }
}

export function useOperadores() {
  return useSyncExternalStore(inscrever, () => estado)
}
