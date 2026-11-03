import { useSyncExternalStore } from 'react'
import type { Contrato, NomeOperacao, Resultado } from '../../comum/contrato'

/**
 * Quando reler (plano da 1.0, Fase 3.2). Com o banco no processo principal, a
 * tela não vê a mudança acontecer: quem grava avisa. Toda operação que deu
 * certo e muda o que as telas mostram soma um na versão dos dados, e as telas
 * abertas (a da rota e o sino) releem.
 *
 * A tabela tem todas as operações do contrato: o compilador recusa uma
 * operação nova sem a resposta. `false` também para gravação que não muda o
 * que outra tela aberta mostra: o rascunho da ficha (grava a cada pausa da
 * digitação; o Início lê ao abrir) e os avisos lidos (o sino usa a resposta).
 * Entrar e sair contam: o sino e o rodapé mostram o estado do backup.
 */
export const AVISA_AS_TELAS: Record<NomeOperacao, boolean> = {
  sessaoAtual: false, entrar: true, sair: true, obterEstadoBackup: false, salvarArquivo: false,
  iniciarCobranca: false, consultarCobranca: false, cancelarCobranca: false, simularCobranca: false, imprimirComprovante: false,
  listarOperadores: false, cadastrarAdministradora: true, cadastrarOperador: true, renomearOperador: true, ativarOperador: true, redefinirPin: true,
  obterCliente: false, cadastrarCliente: true, editarCliente: true, listarClientes: false, listarComprasDoCliente: false,
  listarProdutos: false, obterProduto: false, buscarProdutoPorCodigoBarras: false, listarCategorias: false,
  cadastrarProduto: true, editarProduto: true, excluirProduto: true, ativarProduto: true,
  registrarEntrada: true, ajustarEstoque: true, conferirAjustes: true, listarMovimentosEstoque: false,
  concluirFicha: true, obterRascunhoFicha: false, salvarRascunhoFicha: false, obterFicha: false,
  cancelarFicha: true, conferirCancelamento: true, anotarFicha: true,
  listarNotinhasAbertas: false, receberNotinhas: true, estornarRecebimento: true, conferirEstorno: true, listarVendasSemIdentificacao: false,
  listarBoletos: false, cadastrarBoleto: true, editarBoleto: true, marcarBoletoPago: true, desfazerPagamentoBoleto: true, excluirBoleto: true,
  listarServicos: false,
  obterCaixaAtual: false, abrirCaixa: true, movimentarGaveta: true, fecharCaixa: true, conferirFechamento: true,
  listarCaixas: false, listarMovimentosGaveta: false, obterCaixa: false,
  consultarFinanceiro: false, listarFinanceiroDoPeriodo: false, registrarLancamento: true, estornarLancamento: true, conferirEstornoLancamento: true,
  obterResumoDoDia: false, listarFichas: false, listarAguardandoDona: false, listarAvisos: false, marcarAvisosLidos: false, buscar: false,
}

let versao = 0
const ouvintes = new Set<() => void>()

function avisar() {
  versao++
  ouvintes.forEach((ouvinte) => ouvinte())
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => { ouvintes.delete(ouvinte) }
}

/** A versão dos dados: entra nas dependências do efeito que lê. */
export function useDadosMudaram() {
  return useSyncExternalStore(inscrever, () => versao)
}

type Operacao = (...argumentos: unknown[]) => Promise<Resultado<unknown>>

/**
 * O contrato com o aviso: as operações que avisam somam a versão quando dão
 * certo. `fonte` é lida a cada chamada (no navegador, `window.api` pode ser
 * trocado depois, como o painel do mock faz).
 */
export function comAviso(fonte: () => Contrato): Contrato {
  const embrulhado: Record<string, Operacao> = {}
  for (const nome of Object.keys(AVISA_AS_TELAS) as NomeOperacao[]) {
    embrulhado[nome] = async (...argumentos) => {
      const contrato = fonte()
      const r = await (contrato[nome] as unknown as Operacao).apply(contrato, argumentos)
      if (r.ok && AVISA_AS_TELAS[nome]) avisar()
      return r
    }
  }
  return embrulhado as unknown as Contrato
}
