import { describe, expect, it } from 'vitest'
import { dataPorExtenso, diasEntre, noPeriodo, periodoAnterior, somarDias } from './datas'

describe('datas', () => {
  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-09-25', 10)).toBe('2026-10-05')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('conta dias entre duas datas', () => {
    expect(diasEntre('2026-09-25', '2026-10-25')).toBe(30)
    expect(diasEntre('2026-09-25', '2026-09-20')).toBe(-5)
  })
  it('recorta por período com semana de domingo a sábado', () => {
    // 25/09/2026 é sexta; a semana vai de 20/09 a 26/09
    expect(noPeriodo('2026-09-20', 'semana', '2026-09-25')).toBe(true)
    expect(noPeriodo('2026-09-19', 'semana', '2026-09-25')).toBe(false)
    expect(noPeriodo('2026-09-01', 'mes', '2026-09-25')).toBe(true)
    expect(noPeriodo('2025-09-25', 'ano', '2026-09-25')).toBe(false)
  })
  it('dá a referência do período anterior', () => {
    expect(periodoAnterior('dia', '2026-09-25')).toBe('2026-09-24')
    expect(periodoAnterior('semana', '2026-09-25')).toBe('2026-09-18')
    expect(periodoAnterior('mes', '2026-03-31')).toBe('2026-02-28')
    expect(periodoAnterior('ano', '2026-09-25')).toBe('2025-09-25')
  })
  it('escreve a data por extenso', () => {
    expect(dataPorExtenso('2026-09-25')).toBe('Sexta-feira, 25 de setembro')
  })
})
