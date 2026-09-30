// Nenhum documento aqui é nota emitida: não há número fiscal nem autorização.

export type Direcao = 'saida' | 'entrada'

export type Documento = {
  referencia: string
  origem: string
  data: string
  situacao: string
  direcao: Direcao
  acao: string
  destino: string
}

/** Único exemplo de entrada: as compras de fornecedor ainda não têm documento na base. */
export const documentoFornecedor = {
  referencia: 'Documento de fornecedor',
  origem: 'Compra de mercadorias',
  situacao: 'Exemplo de entrada',
}
