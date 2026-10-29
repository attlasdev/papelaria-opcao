import type { Unidade } from '../../mock/base/tipos'
import type { RascunhoProduto } from '../cadastrar-produto/CadastrarProduto'

export type ItemEntrada = {
  /** Chave da linha: o código de exibição (EST-0021), ou `novo:<código de barras>`. */
  codigo: string
  /** O id do produto que já existe; ausente no produto novo. */
  produtoId?: string
  codigoBarras?: string
  descricao: string
  detalhe: string
  unidade: Unidade
  saldoAtual: number
  quantidade: number
  /** Custo unitário desta entrega em centavos; nunca presumido do cadastro. */
  custo?: number
  /** Produto que ainda não existe: o cadastro preparado, gravado ao confirmar a entrada. */
  novo?: RascunhoProduto
}
