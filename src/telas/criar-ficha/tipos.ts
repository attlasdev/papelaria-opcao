import type { FormaVenda } from '../../mock/base/tipos'

export type ClienteFicha = { id: string; nome: string; documento: string; telefone: string }

/**
 * Venda de balcão em que a pessoa não quis se identificar. Não é um cadastro:
 * a ficha fica sem cliente (clienteId nulo) e aparece como "Não identificado".
 */
export const semIdentificacao = 'sem-identificacao'
export type EscolhaCliente = ClienteFicha | typeof semIdentificacao

/**
 * Item na ficha em andamento. `preco` e `saldo` são os do cadastro quando o
 * item entrou: o preço vai como `precoVisto` (`R-VENDA-11`), e o saldo avisa
 * antes de concluir (o back confere de novo).
 */
export type ItemFicha = {
  produtoId: string
  /** O que a linha mostra: o código de barras, ou o código interno. */
  codigo: string
  descricao: string
  preco: number // centavos
  saldo: number
  unidade: string
  quantidade: number
}

export type FormaPagamento = FormaVenda
