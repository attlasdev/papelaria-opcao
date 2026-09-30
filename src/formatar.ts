/** Dinheiro anda em centavos (inteiro) e só vira texto aqui, na hora de mostrar. */
const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function reais(centavos: number): string {
  return real.format(centavos / 100)
}

/** Com sinal explícito: "+ R$ 152,20" / "- R$ 300,00". */
export function reaisComSinal(centavos: number): string {
  return `${centavos < 0 ? '-' : '+'} ${reais(Math.abs(centavos))}`
}

/** Valor mascarado, para quando os valores estão ocultos no balcão. */
export const reaisOcultos = 'R$ ••••••'

/** Data ISO local dos exemplos → data curta para a interface. */
export function dataCurta(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

/** Data curta produzida pelo formulário da ficha → chave de filtro YYYY-MM-DD. */
export function dataISODeCurta(data: string): string {
  const [dia, mes, ano] = data.split('/')
  return `${ano.length === 2 ? `20${ano}` : ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

/** Texto em reais ("12,50" ou "R$ 1.234,50") → centavos. Vazio ou inválido vale zero. */
export function centavosDeTexto(texto: string): number {
  const numero = Number(texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0
}

/** Máscara de digitação: só os algarismos contam, os dois últimos são centavos. */
export function centavosDigitados(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '').slice(0, 15)
  return digitos ? Number(digitos) : null
}

export function moedaDigitada(centavos: number | null): string {
  return centavos === null ? '' : reais(centavos)
}

/** Centavos → texto para campo de valor ("12,50"), sem o "R$". */
export function textoDeCentavos(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}
