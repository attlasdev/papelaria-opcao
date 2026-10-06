import { describe, expect, it } from 'vitest'
import { rotuloPagamento } from './pagamento'

describe('rotuloPagamento', () => {
  it('cartão com modalidade, bandeira e maquininha', () => {
    expect(rotuloPagamento({ meio: 'cartao', cartao: 'credito', maquininha: 'mercado-pago', bandeira: 'Visa' })).toBe('Cartão crédito Visa · Mercado Pago')
    expect(rotuloPagamento({ meio: 'cartao', cartao: 'debito', maquininha: 'sicoob' })).toBe('Cartão débito · Sicoob')
  })
  it('Pix pela maquininha ou manual; dinheiro sem rótulo', () => {
    expect(rotuloPagamento({ meio: 'pix', maquininha: 'mercado-pago' })).toBe('Pix · Mercado Pago')
    expect(rotuloPagamento({ meio: 'pix' })).toBe('Pix manual')
    expect(rotuloPagamento({ meio: 'dinheiro' })).toBeUndefined()
  })
})
