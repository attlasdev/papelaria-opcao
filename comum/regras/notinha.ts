/**
 * A conta da notinha (Memoria.md, "Clientes", `R-CLIENTE-01`), uma vez só para
 * o mock e o SQLite. Funções puras: quem chama traz a ficha com o que já foi
 * pago, sem os pagamentos estornados.
 */
import type { FormaFicha, SituacaoCliente, SituacaoCompra } from '../contrato'

export type FichaDaConta = {
  forma: FormaFicha
  total: number
  /** Só a notinha tem; `AAAA-MM-DD`. */
  vencimento: string | null
  cancelada: boolean
  /** Soma dos pagamentos que valem: entrada e recebimentos não estornados. */
  pago: number
}

/** O que falta pagar. À vista e cancelada não devem nada. */
export function emAberto(f: FichaDaConta) {
  if (f.forma !== 'notinha' || f.cancelada) return 0
  return Math.max(0, f.total - f.pago)
}

/** `hoje` em `AAAA-MM-DD`, dia de São Paulo. Vence hoje ainda está a vencer. */
export function situacaoCompra(f: FichaDaConta, hoje: string): SituacaoCompra {
  if (f.cancelada) return 'cancelada'
  if (emAberto(f) === 0) return 'paga'
  return (f.vencimento ?? hoje) < hoje ? 'em-atraso' : 'a-vencer'
}

/** O atraso vence: o cliente não é contado nas duas situações (`R-CLIENTE-01`). */
export function situacaoCliente(compras: SituacaoCompra[]): SituacaoCliente {
  if (compras.includes('em-atraso')) return 'em-atraso'
  return compras.includes('a-vencer') ? 'a-vencer' : 'em-dia'
}
