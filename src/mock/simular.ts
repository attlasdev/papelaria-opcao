import { falha, type CausaFalha, type Resultado } from '../../comum/contrato'

/**
 * O mock precisa FALHAR e precisa DEMORAR.
 *
 * Um mock que sempre acerta e responde na hora e um ambiente que so testa o caso
 * feliz: ele da confianca falsa e esconde metade da tela. Os estados de carregando
 * e de erro custam cinco minutos enquanto a tela esta na sua mao, e custam um dia
 * quando ja tem dez telas prontas sem eles.
 *
 * Controle por URL, ou pelo painel do canto da tela:
 *
 *   ?falhar=rede     toda operacao devolve Falha com essa causa
 *   ?lento=2000      toda operacao demora 2s antes de responder
 *   ?falhar=rede&lento=800
 */

const params = new URLSearchParams(location.search)

const CAUSAS: CausaFalha[] = [
  'rede',
  'sessao',
  'configuracao',
  'banco',
  'permissao',
  'validacao',
  'conflito',
  'nao-encontrado',
  'impressora',
  'desconhecida',
]

function causaForcada(): CausaFalha | null {
  const valor = params.get('falhar')
  if (!valor) return null
  return (CAUSAS as string[]).includes(valor) ? (valor as CausaFalha) : 'desconhecida'
}

function atrasoMs(): number {
  const valor = Number(params.get('lento'))
  // Um pouco de atraso SEMPRE, mesmo sem `?lento`: com resposta instantanea o
  // estado de carregando nunca aparece e ninguem desenha ele.
  return Number.isFinite(valor) && valor > 0 ? valor : 220
}

const espera = (ms: number) => new Promise((seguir) => setTimeout(seguir, ms))

/**
 * Embrulha a resposta de uma operacao do mock: aplica o atraso e, se houver causa
 * forcada, devolve `Falha` em vez do dado.
 */
export async function simular<T>(produzir: () => Resultado<T>): Promise<Resultado<T>> {
  await espera(atrasoMs())

  const causa = causaForcada()
  if (causa) return falha(causa, `Falha simulada pelo mock (${causa}).`)

  return produzir()
}

export const controles = { CAUSAS, causaForcada, atrasoMs, params }
