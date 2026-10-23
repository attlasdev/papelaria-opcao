/**
 * Os endereços das telas, num lugar só. Botão que leva a outra tela usa estas
 * constantes, nunca a string solta: renomear uma rota vira mudança de uma linha.
 */
export const rotas = {
  inicio: '/',
  busca: (termo: string) => `/busca?q=${encodeURIComponent(termo)}`,
  criarFicha: '/ficha/nova',
  /** Produto que a ficha não achou: o modal abre sobre a ficha, com o código lido. */
  cadastrarProdutoNaFicha: (codigo?: string) => `/ficha/nova/produto/novo${codigo ? `?codigo=${encodeURIComponent(codigo)}` : ''}`,
  ficha: (id: string, origem: 'inicio' | 'historico' = 'inicio') => `/fichas/${id}?origem=${origem}`,
  clientes: '/clientes',
  cadastrarCliente: '/clientes/novo',
  vendasSemIdentificacao: '/clientes/sem-identificacao',
  cliente: (id: string) => `/clientes/${id}`,
  editarCliente: (id: string) => `/clientes/${id}/editar`,
  financeiro: '/financeiro',
  caixa: '/caixa',
  registrarMovimento: '/financeiro/movimento/novo',
  estoque: '/estoque',
  estoqueACompletar: '/estoque?filtro=completar',
  cadastrarProduto: '/estoque/produto/novo',
  completarProduto: (codigo: string) => `/estoque/produto/${codigo}/completar`,
  editarProduto: (codigo: string) => `/estoque/produto/${codigo}/editar`,
  registrarEntrada: '/estoque/entrada',
  entradaRapida: (codigo: string) => `/estoque/entrada-rapida?produto=${codigo}`,
  ajustarEstoque: (codigo?: string) => `/estoque/ajustar${codigo ? `?produto=${codigo}` : ''}`,
  movimentacoesEstoque: (codigo?: string) => `/estoque/movimentacoes${codigo ? `?produto=${codigo}` : ''}`,
  servicos: '/servicos',
  boletos: '/boletos',
  notas: '/notas-fiscais',
  rascunhosNotas: '/notas-fiscais/rascunhos',
  rascunhoNota: (id: string) => `/notas-fiscais/rascunhos/${id}`,
  documentoEntrada: '/notas-fiscais/documentos/fornecedor',
} as const
