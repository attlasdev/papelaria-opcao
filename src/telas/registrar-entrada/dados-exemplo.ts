import type { Unidade } from '../../mock/base/tipos'
import type { RascunhoProduto } from '../cadastrar-produto/CadastrarProduto'

export type ItemEntrada = {
  codigo: string
  codigoBarras?: string
  descricao: string
  detalhe: string
  unidade: Unidade
  saldoAtual: number
  quantidade: number
  /** Custo unitário em centavos; ausente quando o produto veio sem custo no protótipo. */
  custo?: number
  /** Produto que ainda não existe: o cadastro preparado, gravado ao confirmar a entrada. */
  novo?: RascunhoProduto
}

/** Custo unitário de referência (centavos) para alguns produtos; os demais entram sem custo. */
export const custoSugerido: Record<string, number> = {
  'EST-0021': 1556,
  'EST-0022': 650,
  'EST-0023': 1820,
  'EST-0025': 1050,
  'EST-0027': 125,
  'EST-0034': 4200,
}
