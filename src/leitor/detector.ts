/**
 * Reconhece a leitura do leitor de código de barras USB.
 *
 * O leitor se apresenta como teclado: "digita" o código e aperta Enter. O que o
 * separa de uma pessoa é a pressa — as teclas chegam com poucos milissegundos
 * entre si. Uma pessoa rápida fica perto de 100 ms; o leitor, abaixo de 30.
 *
 * Função pura, sem DOM, para dar para testar com instantes inventados.
 */

export type OpcoesDetector = {
  /** Maior intervalo (ms) entre duas teclas para ainda contar como leitura. */
  intervaloMaximo: number
  /** Menor código aceito. Evita que duas teclas apertadas juntas virem leitura. */
  tamanhoMinimo: number
}

export type Resposta =
  /** Tecla que não interessa (Shift, setas...). */
  | { tipo: 'ignorar' }
  /** Caractere guardado. `inicio` diz que abriu uma sequência nova. */
  | { tipo: 'caractere'; inicio: boolean }
  /** Enter que não fecha leitura: é da pessoa. */
  | { tipo: 'enter' }
  | { tipo: 'leitura'; codigo: string }

export const padraoDetector: OpcoesDetector = { intervaloMaximo: 40, tamanhoMinimo: 4 }

export function criarDetector(opcoes: OpcoesDetector = padraoDetector) {
  let sequencia = ''
  let ultima = -Infinity

  return function tecla(nome: string, instante: number): Resposta {
    const rapida = instante - ultima <= opcoes.intervaloMaximo

    if (nome === 'Enter') {
      const codigo = sequencia
      sequencia = ''
      ultima = -Infinity
      return rapida && codigo.length >= opcoes.tamanhoMinimo ? { tipo: 'leitura', codigo } : { tipo: 'enter' }
    }

    if (nome.length !== 1) return { tipo: 'ignorar' }

    const inicio = !rapida || sequencia === ''
    sequencia = inicio ? nome : sequencia + nome
    ultima = instante
    return { tipo: 'caractere', inicio }
  }
}
