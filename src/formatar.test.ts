import { describe, expect, it } from 'vitest'
import { centavosDeTexto, centavosDigitados, moedaDigitada, reais } from './formatar'

describe('máscara de dinheiro', () => {
  it('interpreta os dois últimos dígitos como centavos', () => {
    expect(centavosDigitados('2333')).toBe(2333)
    expect(moedaDigitada(2333)).toBe(reais(2333))
  })

  it('lê o valor formatado sem perder os centavos', () => {
    expect(centavosDeTexto(moedaDigitada(2333))).toBe(2333)
    expect(centavosDeTexto('R$ 1.234,56')).toBe(123456)
    expect(centavosDigitados('')).toBeNull()
  })
})
