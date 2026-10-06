import type { Maquininha, Meio, ModalidadeCartao } from '../mock/base/tipos'

const MAQUININHA: Record<Maquininha, string> = { 'mercado-pago': 'Mercado Pago', sicoob: 'Sicoob' }
const MODALIDADE: Record<ModalidadeCartao, string> = { credito: 'crédito', debito: 'débito' }

/**
 * O rótulo que aparece no detalhe da ficha, no Início e no Financeiro:
 * "Cartão crédito Visa · Mercado Pago", "Cartão débito · Sicoob", "Pix ·
 * Mercado Pago", "Pix manual". Dinheiro não tem rótulo próprio.
 */
export function rotuloPagamento(p: { meio: Meio; cartao?: ModalidadeCartao; maquininha?: Maquininha; bandeira?: string }): string | undefined {
  if (p.meio === 'cartao') {
    const tipo = ['Cartão', p.cartao && MODALIDADE[p.cartao], p.bandeira].filter(Boolean).join(' ')
    return p.maquininha ? `${tipo} · ${MAQUININHA[p.maquininha]}` : tipo
  }
  if (p.meio === 'pix') return p.maquininha ? `Pix · ${MAQUININHA[p.maquininha]}` : 'Pix manual'
  return undefined
}
