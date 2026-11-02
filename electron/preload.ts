import { contextBridge, ipcRenderer } from 'electron'
import type { Contrato } from '../comum/contrato'

/**
 * A ponte. Uma funcao nomeada por operacao permitida — nada generico.
 *
 * Um `invoke(canal, ...args)` exposto ao renderer anularia a separacao: a tela
 * poderia chamar qualquer canal registrado no processo principal, que e justamente
 * quem guarda a chave do banco. Aqui o conjunto de canais e exatamente as chaves
 * de `Contrato`, e `ipcRenderer` nunca chega ao renderer.
 *
 * `const api: Contrato` faz o compilador conferir duas coisas de graca:
 * nenhuma operacao do contrato ficou de fora, e nenhuma assinatura divergiu.
 *
 * Nenhuma funcao daqui devolve chave, segredo ou caminho de arquivo.
 */
const api: Contrato = {
  sessaoAtual: () => ipcRenderer.invoke('sessaoAtual'),
  entrar: (email, senha) => ipcRenderer.invoke('entrar', email, senha),
  sair: () => ipcRenderer.invoke('sair'),
  carregarBase: () => ipcRenderer.invoke('carregarBase'),
  salvarBase: (conteudo, revisaoEsperada) => ipcRenderer.invoke('salvarBase', conteudo, revisaoEsperada),
  salvarArquivo: (nomeSugerido, conteudo) => ipcRenderer.invoke('salvarArquivo', nomeSugerido, conteudo),
  iniciarCobranca: (dados) => ipcRenderer.invoke('iniciarCobranca', dados),
  consultarCobranca: (id) => ipcRenderer.invoke('consultarCobranca', id),
  cancelarCobranca: (id) => ipcRenderer.invoke('cancelarCobranca', id),
  simularCobranca: (id, resultado) => ipcRenderer.invoke('simularCobranca', id, resultado),
  imprimirComprovante: (dados) => ipcRenderer.invoke('imprimirComprovante', dados),
  listarOperadores: () => ipcRenderer.invoke('listarOperadores'),
  cadastrarAdministradora: (nome, pin) => ipcRenderer.invoke('cadastrarAdministradora', nome, pin),
  cadastrarOperador: (nome, pin, dona) => ipcRenderer.invoke('cadastrarOperador', nome, pin, dona),
  renomearOperador: (id, nome, dona) => ipcRenderer.invoke('renomearOperador', id, nome, dona),
  ativarOperador: (id, ativo, dona) => ipcRenderer.invoke('ativarOperador', id, ativo, dona),
  redefinirPin: (id, pin, dona) => ipcRenderer.invoke('redefinirPin', id, pin, dona),
  listarProdutos: (filtro, busca, pagina, porPagina) => ipcRenderer.invoke('listarProdutos', filtro, busca, pagina, porPagina),
  obterProduto: (id) => ipcRenderer.invoke('obterProduto', id),
  buscarProdutoPorCodigoBarras: (codigoBarras) => ipcRenderer.invoke('buscarProdutoPorCodigoBarras', codigoBarras),
  listarCategorias: () => ipcRenderer.invoke('listarCategorias'),
  cadastrarProduto: (dados, saldoInicial, quem) => ipcRenderer.invoke('cadastrarProduto', dados, saldoInicial, quem),
  editarProduto: (id, dados) => ipcRenderer.invoke('editarProduto', id, dados),
  excluirProduto: (id, quem) => ipcRenderer.invoke('excluirProduto', id, quem),
  ativarProduto: (id, ativo) => ipcRenderer.invoke('ativarProduto', id, ativo),
  registrarEntrada: (entrega, quem) => ipcRenderer.invoke('registrarEntrada', entrega, quem),
  ajustarEstoque: (ajuste, quem) => ipcRenderer.invoke('ajustarEstoque', ajuste, quem),
  conferirAjustes: (movimentoIds, dona) => ipcRenderer.invoke('conferirAjustes', movimentoIds, dona),
  listarMovimentosEstoque: (filtro, pagina, porPagina) => ipcRenderer.invoke('listarMovimentosEstoque', filtro, pagina, porPagina),
  obterCliente: (id) => ipcRenderer.invoke('obterCliente', id),
  cadastrarCliente: (dados) => ipcRenderer.invoke('cadastrarCliente', dados),
  editarCliente: (id, dados) => ipcRenderer.invoke('editarCliente', id, dados),
  listarClientes: (filtro, busca, pagina, porPagina) => ipcRenderer.invoke('listarClientes', filtro, busca, pagina, porPagina),
  listarComprasDoCliente: (clienteId, filtro, pagina, porPagina) => ipcRenderer.invoke('listarComprasDoCliente', clienteId, filtro, pagina, porPagina),
  concluirFicha: (venda, quem) => ipcRenderer.invoke('concluirFicha', venda, quem),
  obterRascunhoFicha: () => ipcRenderer.invoke('obterRascunhoFicha'),
  salvarRascunhoFicha: (rascunho) => ipcRenderer.invoke('salvarRascunhoFicha', rascunho),
  obterFicha: (id) => ipcRenderer.invoke('obterFicha', id),
  cancelarFicha: (id, motivo, quem) => ipcRenderer.invoke('cancelarFicha', id, motivo, quem),
  conferirCancelamento: (fichaId, dona) => ipcRenderer.invoke('conferirCancelamento', fichaId, dona),
  anotarFicha: (id, texto, quem) => ipcRenderer.invoke('anotarFicha', id, texto, quem),
  estornarRecebimento: (pagamentoId, motivo, quem) => ipcRenderer.invoke('estornarRecebimento', pagamentoId, motivo, quem),
  conferirEstorno: (pagamentoId, dona) => ipcRenderer.invoke('conferirEstorno', pagamentoId, dona),
  listarVendasSemIdentificacao: (periodo, meio, pagina, porPagina) => ipcRenderer.invoke('listarVendasSemIdentificacao', periodo, meio, pagina, porPagina),
  listarBoletos: (filtro, busca) => ipcRenderer.invoke('listarBoletos', filtro, busca),
  cadastrarBoleto: (dados) => ipcRenderer.invoke('cadastrarBoleto', dados),
  editarBoleto: (id, dados) => ipcRenderer.invoke('editarBoleto', id, dados),
  marcarBoletoPago: (id, quem) => ipcRenderer.invoke('marcarBoletoPago', id, quem),
  desfazerPagamentoBoleto: (id, motivo, quem) => ipcRenderer.invoke('desfazerPagamentoBoleto', id, motivo, quem),
  excluirBoleto: (id, motivo, quem) => ipcRenderer.invoke('excluirBoleto', id, motivo, quem),
  listarServicos: (periodo) => ipcRenderer.invoke('listarServicos', periodo),
  listarNotinhasAbertas: (clienteId) => ipcRenderer.invoke('listarNotinhasAbertas', clienteId),
  receberNotinhas: (recebimento, quem) => ipcRenderer.invoke('receberNotinhas', recebimento, quem),
}

contextBridge.exposeInMainWorld('api', api)
