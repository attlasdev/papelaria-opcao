import { describe, expect, it } from 'vitest'
import { criarDetector } from './detector'

/** Digita `texto` com `passo` ms entre as teclas e fecha com Enter. */
function digitar(texto: string, passo: number, inicio = 1000) {
  const tecla = criarDetector()
  let instante = inicio
  for (const letra of texto) { tecla(letra, instante); instante += passo }
  return tecla('Enter', instante)
}

describe('[R-VENDA-04] detector do leitor', () => {
  it('reconhece o código que chega depressa e termina em Enter', () => {
    expect(digitar('7891360650233', 5)).toEqual({ tipo: 'leitura', codigo: '7891360650233' })
  })

  it('não confunde a pessoa digitando com o leitor', () => {
    expect(digitar('7891360650233', 110)).toEqual({ tipo: 'enter' })
  })

  it('ignora rajada curta demais', () => {
    expect(digitar('12', 5)).toEqual({ tipo: 'enter' })
  })

  it('não deixa o que a pessoa digitou antes grudar no código', () => {
    const tecla = criarDetector()
    tecla('4', 0)
    tecla('2', 150)
    let instante = 1000
    for (const letra of '789102711') { tecla(letra, instante); instante += 4 }
    expect(tecla('Enter', instante)).toEqual({ tipo: 'leitura', codigo: '789102711' })
  })

  it('não conta Shift e outras teclas de controle', () => {
    const tecla = criarDetector()
    tecla('Shift', 0)
    expect(tecla('A', 2)).toEqual({ tipo: 'caractere', inicio: true })
    tecla('Shift', 4)
    expect(tecla('B', 6)).toEqual({ tipo: 'caractere', inicio: false })
  })

  it('Enter demorado depois do código não é leitura', () => {
    const tecla = criarDetector()
    let instante = 0
    for (const letra of '789102711') { tecla(letra, instante); instante += 4 }
    expect(tecla('Enter', instante + 500)).toEqual({ tipo: 'enter' })
  })
})
