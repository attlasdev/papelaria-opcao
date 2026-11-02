/**
 * As vendas sem identificação (Memoria.md, "Clientes"; `R-CLIENTE-07`, `08`),
 * uma vez só para o mock e o SQLite. Funções puras: cada lado lê as fichas sem
 * cliente do período, com os meios dos pagamentos, e entrega aqui.
 */
import {
  falha, type Falha, type FiltroMeioVenda, type MeioPagamento, type PaginaVendasSemIdentificacao, type PeriodoVendas, type VendaSemIdentificacao,
} from '../contrato'
import { diaValido } from './entrada'
import { paginaQueExiste, POR_PAGINA_MAXIMO } from './produto'

const MEIOS: MeioPagamento[] = ['dinheiro', 'pix', 'cartao']
const FILTROS: FiltroMeioVenda[] = ['todos', ...MEIOS]
const inteiro = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1

/** O período e a página pedidos, ou a falha. `hoje`: o dia de São Paulo. */
export function conferirPedidoDeVendas(periodo: unknown, meio: unknown, pagina: unknown, porPagina: unknown, hoje: string): PeriodoVendas | Falha {
  if (!FILTROS.includes(meio as FiltroMeioVenda)) return falha('validacao', 'Pedido inválido.')
  if (!inteiro(pagina) || !inteiro(porPagina) || (porPagina as number) > POR_PAGINA_MAXIMO) return falha('validacao', 'Pedido de página inválido.')
  if (periodo === null) return null
  const p = typeof periodo === 'object' ? (periodo as Record<string, unknown>) : null
  if (!p || !diaValido(p.de) || !diaValido(p.ate) || p.de > p.ate) return falha('validacao', 'Período inválido.')
  if (p.ate > hoje) return falha('validacao', 'O período não pode passar de hoje.')
  return { de: p.de, ate: p.ate }
}

/** Uma venda do período como cada lado lê: a linha e os meios em que foi paga. */
export type VendaDaLista = VendaSemIdentificacao & { pagamentos: { meio: MeioPagamento; valor: number }[] }

/**
 * A página: da mais nova para a mais velha, a venda entra em cada meio em que
 * foi paga. As abas contam as linhas que mostram (canceladas inclusive); os
 * cartões, só o que não foi cancelado (`R-CLIENTE-07`).
 */
export function paginaDeVendas(vendas: VendaDaLista[], meio: FiltroMeioVenda, pagina: number, porPagina: number): PaginaVendasSemIdentificacao {
  const ordem = [...vendas].sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || Number(b.numero) - Number(a.numero))
  const noMeio = (v: VendaDaLista, m: MeioPagamento) => v.forma === m || v.pagamentos.some((p) => p.meio === m)
  const achadas = meio === 'todos' ? ordem : ordem.filter((v) => noMeio(v, meio))
  const vendidas = ordem.filter((v) => !v.cancelada)
  const porMeio = Object.fromEntries(MEIOS.map((m) => [m, {
    valor: vendidas.flatMap((v) => v.pagamentos).filter((p) => p.meio === m).reduce((t, p) => t + p.valor, 0),
    vendas: vendidas.filter((v) => noMeio(v, m)).length,
  }])) as PaginaVendasSemIdentificacao['resumo']['porMeio']
  const atual = paginaQueExiste(pagina, achadas.length, porPagina)
  return {
    vendas: achadas.slice((atual - 1) * porPagina, atual * porPagina).map(({ pagamentos: _p, ...v }) => v),
    total: achadas.length,
    pagina: atual,
    resumo: { vendas: vendidas.length, totalVendido: vendidas.reduce((t, v) => t + v.total, 0), porMeio },
    contagem: {
      todos: ordem.length,
      dinheiro: ordem.filter((v) => noMeio(v, 'dinheiro')).length,
      pix: ordem.filter((v) => noMeio(v, 'pix')).length,
      cartao: ordem.filter((v) => noMeio(v, 'cartao')).length,
    },
  }
}
