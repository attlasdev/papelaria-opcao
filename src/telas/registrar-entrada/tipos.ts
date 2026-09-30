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
  /** Custo unitário em centavos; ausente quando o produto não tem custo cadastrado. */
  custo?: number
  /** Produto que ainda não existe: o cadastro preparado, gravado ao confirmar a entrada. */
  novo?: RascunhoProduto
}
