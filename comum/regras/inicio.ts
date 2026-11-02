/**
 * As regras do Início (Memoria.md, "Início e sino"; `R-INICIO-01` a `06`), uma
 * vez só para o mock e o SQLite. Funções puras: cada lado lê as fichas, as
 * linhas do Financeiro do dia e o que aguarda a dona, e entrega aqui.
 */
import {
  falha, type AguardandoDona, type Falha, type FiltroFichas, type FiltroPagamentoFicha, type FormaFicha, type LinhaFinanceira,
  type MeioPagamento, type ResumoDoDia,
} from '../contrato'
import { conferirPagina } from './caixa'
import { diaValido } from './entrada'
import { resumoFinanceiro } from './financeiro'
import { paginaQueExiste } from './produto'

export const MENSAGENS_INICIO = {
  pedido: 'Pedido inválido.',
  dia: 'Data inválida.',
  futuro: 'A data não pode passar de hoje.',
}

const FILTROS: FiltroPagamentoFicha[] = ['todos', 'dinheiro', 'pix', 'cartao', 'notinha']

/** O filtro e a página pedidos, ou a falha. `hoje`: o dia de São Paulo. */
export function conferirPedidoDeFichas(bruto: unknown, pagina: unknown, porPagina: unknown, hoje: string): FiltroFichas | Falha {
  const f = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
  if (!FILTROS.includes(f.pagamento as FiltroPagamentoFicha)) return falha('validacao', MENSAGENS_INICIO.pedido)
  const problema = conferirPagina(pagina, porPagina)
  if (problema) return problema
  if (f.dia === null) return { dia: null, pagamento: f.pagamento as FiltroPagamentoFicha }
  if (!diaValido(f.dia)) return falha('validacao', MENSAGENS_INICIO.dia)
  if (f.dia > hoje) return falha('validacao', MENSAGENS_INICIO.futuro)
  return { dia: f.dia, pagamento: f.pagamento as FiltroPagamentoFicha }
}

/**
 * A ficha entra no filtro: pela forma, e o misto também em cada meio que usou
 * (`R-INICIO-04`). A notinha fica só em Notinha. `meios`: os meios dos
 * pagamentos da ficha (só o misto precisa).
 */
export function fichaNoFiltro(ficha: { forma: FormaFicha; meios: MeioPagamento[] }, pagamento: FiltroPagamentoFicha) {
  if (pagamento === 'todos' || ficha.forma === pagamento) return true
  return ficha.forma === 'misto' && pagamento !== 'notinha' && ficha.meios.includes(pagamento)
}

/** O que cada lado lê de toda ficha para filtrar e ordenar; o resto, só da página. */
export type FichaLeve = { id: string; numero: string; dia: string; registradoEm: string; forma: FormaFicha; meios: MeioPagamento[] }

/** A página: da mais nova para a mais velha, canceladas inclusive. */
export function paginaDeFichas<F extends FichaLeve>(fichas: F[], filtro: FiltroFichas, pagina: number, porPagina: number) {
  const achadas = fichas.filter((f) => (!filtro.dia || f.dia === filtro.dia) && fichaNoFiltro(f, filtro.pagamento))
    .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || Number(b.numero) - Number(a.numero))
  const atual = paginaQueExiste(pagina, achadas.length, porPagina)
  return { fichas: achadas.slice((atual - 1) * porPagina, atual * porPagina), total: achadas.length, pagina: atual }
}

/** Os cartões: o Financeiro do dia e as fichas do dia (`R-INICIO-01`, `02`). */
export function resumoDoDia(dia: string, linhasDoDia: LinhaFinanceira[], fichasDoDia: { total: number; cancelada: boolean }[]): ResumoDoDia {
  const r = resumoFinanceiro(linhasDoDia)
  const vendidas = fichasDoDia.filter((f) => !f.cancelada)
  const total = vendidas.reduce((t, f) => t + f.total, 0)
  return {
    dia, recebimentos: r.entradas, vendas: vendidas.length, ticketMedio: vendidas.length ? Math.round(total / vendidas.length) : 0,
    saidas: r.saidas, quantidadeSaidas: r.quantidadeSaidas,
  }
}

/**
 * O que aguarda a dona como cada lado lê. O estorno de recebimento vem uma
 * linha por notinha; `id` é o do recebimento, e aqui vira um item só.
 */
export type PendenciaLida = { registradoEm: string; operador: string } & (
  | { tipo: 'ajuste'; id: string; produto: string }
  | { tipo: 'cancelamento'; id: string; numero: string }
  | { tipo: 'estorno-recebimento'; id: string; ficha: { id: string; numero: string } }
  | { tipo: 'fechamento'; id: string }
  | { tipo: 'estorno-lancamento'; id: string; descricao: string; dia: string }
)

/** A lista do Início e do sino, do mais novo para o mais velho (`R-INICIO-06`). */
export function listaAguardandoDona(lidas: PendenciaLida[]): AguardandoDona[] {
  const itens: AguardandoDona[] = []
  const recebimentos = new Map<string, Extract<PendenciaLida, { tipo: 'estorno-recebimento' }>[]>()
  for (const p of lidas) {
    const comum = { id: p.id, registradoEm: p.registradoEm, operador: p.operador }
    if (p.tipo === 'estorno-recebimento') recebimentos.set(p.id, [...(recebimentos.get(p.id) ?? []), p])
    else if (p.tipo === 'ajuste') itens.push({ ...comum, tipo: p.tipo, descricao: `Ajuste de estoque: ${p.produto}`, onde: { tela: 'movimentacoes' } })
    else if (p.tipo === 'cancelamento') itens.push({ ...comum, tipo: p.tipo, descricao: `Cancelamento da ficha #${p.numero}`, onde: { tela: 'ficha', fichaId: p.id } })
    else if (p.tipo === 'fechamento') itens.push({ ...comum, tipo: p.tipo, descricao: 'Fechamento do caixa com diferença', onde: { tela: 'caixa', caixaId: p.id } })
    else itens.push({ ...comum, tipo: p.tipo, descricao: `Estorno do lançamento: ${p.descricao}`, onde: { tela: 'financeiro', dia: p.dia } })
  }
  for (const [id, linhas] of recebimentos) {
    const fichas = linhas.map((l) => l.ficha).sort((a, b) => Number(a.numero) - Number(b.numero))
    const numeros = fichas.map((f) => `#${f.numero}`).join(', ')
    itens.push({
      id, tipo: 'estorno-recebimento', registradoEm: linhas[0].registradoEm, operador: linhas[0].operador,
      descricao: fichas.length === 1 ? `Estorno do recebimento da notinha ${numeros}` : `Estorno do recebimento das notinhas ${numeros}`,
      onde: { tela: 'ficha', fichaId: fichas[0].id },
    })
  }
  return itens.sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || b.id.localeCompare(a.id))
}
