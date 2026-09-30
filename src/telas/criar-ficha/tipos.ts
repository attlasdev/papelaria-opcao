import type { FormaVenda } from '../../mock/estado-demonstracao'

export type ClienteFicha = { id: string; nome: string; documento: string; telefone: string }

/**
 * Venda de balcão em que a pessoa não quis se identificar. Não é um cadastro:
 * a ficha fica sem cliente (clienteId nulo) e aparece como "Não identificado".
 */
export const semIdentificacao = 'sem-identificacao'
export type EscolhaCliente = ClienteFicha | typeof semIdentificacao

/** Item na ficha em andamento; `codigo` liga ao produto do estoque. */
export type ItemFicha = {
  codigo: string
  codigoBarras: string
  descricao: string
  estoque: string
  preco: number // centavos
  quantidade: number
}

export type FormaPagamento = FormaVenda
