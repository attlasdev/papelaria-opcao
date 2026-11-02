import type { CaixaResumido, Falha } from '../../../comum/contrato'
import { aguardandoDona } from '../../../comum/regras/caixa'
import type { Tom } from '../../componentes/selo/Selo'
import { tituloFalha } from '../../falhas'
import { reais } from '../../formatar'

export const mensagemDe = (r: Falha) => (r.causa === 'validacao' || r.causa === 'permissao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

export function textoDiferencaCaixa(diferenca: number) {
  if (diferenca === 0) return 'O valor contado confere.'
  return diferenca < 0 ? `Faltam ${reais(-diferenca)} em relação ao esperado.` : `Há ${reais(diferenca)} a mais que o esperado.`
}

/**
 * O selo do caixa na lista: aberto, conferido, com diferença, ou "A conferir"
 * quando a diferença aguarda a dona (`R-CAIXA-10`; o selo tem largura fixa).
 */
export function seloDoCaixa(c: CaixaResumido): { tom: Tom; texto: string } {
  if (!c.fechamento) return { tom: 'neutro', texto: 'Aberto' }
  if (c.fechamento.diferenca === 0) return { tom: 'ok', texto: 'Conferido' }
  return aguardandoDona(c) ? { tom: 'atencao', texto: 'A conferir' } : { tom: 'atencao', texto: 'Com diferença' }
}

/** Os últimos sete dias corridos, hoje incluído (`R-CAIXA-07`). */
export function ultimosSeteDias(hoje: string) {
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const inicio = new Date(Date.UTC(ano, mes - 1, dia - 6))
  return { de: inicio.toISOString().slice(0, 10), ate: hoje }
}
