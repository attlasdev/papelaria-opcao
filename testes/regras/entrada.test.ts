/** As regras puras da entrada de mercadoria (`comum/regras/entrada.ts`). */
import { describe, expect, it } from 'vitest'
import { diaValido, hojeEmSaoPaulo } from '../../comum/regras/entrada'

describe('entrada de mercadoria', () => {
  it('[R-ESTOQUE-04] "hoje" é o dia da loja: às 23h em São Paulo já é amanhã em UTC', () => {
    expect(hojeEmSaoPaulo(new Date('2026-10-28T02:00:00Z'))).toBe('2026-10-27')
    expect(hojeEmSaoPaulo(new Date('2026-10-28T03:00:00Z'))).toBe('2026-10-28')
  })

  it('dia de calendário que existe, no formato AAAA-MM-DD', () => {
    expect(['2026-10-27', '2028-02-29'].map(diaValido)).toEqual([true, true])
    expect(['2026-02-29', '2026-13-01', '27/10/2026', '', 20261027].map(diaValido)).toEqual([false, false, false, false, false])
  })
})
