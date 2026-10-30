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
}

contextBridge.exposeInMainWorld('api', api)
