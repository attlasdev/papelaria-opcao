import { useSyncExternalStore } from 'react'
import type { CausaFalha, Contrato, DocumentoBase, Resultado, Sessao } from '../../comum/contrato'
import type { Base } from '../mock/base/tipos'
import { carregarBase, normalizarBase } from '../mock/base/persistencia'
import { criarBaseVazia } from '../mock/base/semente'
import { hojeISO } from '../mock/base/datas'
import { obterBase, observarMudancas, substituirBase } from '../mock/estado-demonstracao'

/**
 * Leva a base da loja ao banco e decide, ao abrir o app, qual versão vale.
 *
 * Piloto 0.1 (Memoria.md, `2026-10-06`): a base inteira é um documento só. Há uma
 * máquina só, então a cópia no computador é sempre a mais nova; a do banco é o
 * que sobrevive se o computador for trocado. Toda mudança fica marcada como
 * pendente até o banco confirmar — fechar o app sem internet não perde nada, só
 * adia o envio para a próxima abertura.
 */

/** O que a cópia do computador sabe sobre o banco. */
export type Marcador = { revisao: number; pendente: boolean }

export type Inicio =
  | { tipo: 'usar'; base: Base; marcador: Marcador; descartada?: Base }
  | { tipo: 'invalida' }

/**
 * Qual versão vale ao abrir, tendo a cópia local e a do banco.
 *
 * - Cópia local com mudança pendente, e o banco ainda na revisão que ela viu:
 *   vale a local (ela é a continuação), e o envio segue.
 * - Cópia local pendente, mas o banco já mudou por outro caminho: vale o banco,
 *   e a local é guardada à parte em vez de apagada.
 * - Sem nada pendente: vale o banco; sem banco, uma loja vazia.
 *
 * Cópia local sem marcador é de antes da sincronia existir — a demonstração
 * antiga, com dados de exemplo. Não é enviada: vale o banco. (Enviá-la subia a
 * amostra de 90 dias como se fosse a loja, em qualquer máquina onde a
 * demonstração já tinha rodado.)
 */
export function decidirInicio(
  local: Base | null,
  marcador: Marcador | null,
  nuvem: DocumentoBase | null,
  vazia: () => Base,
): Inicio {
  const meu = local ? marcador : null
  const revisaoNuvem = nuvem?.revisao ?? 0
  const daNuvem = nuvem ? normalizarBase(nuvem.conteudo) : null
  if (nuvem && !daNuvem) return { tipo: 'invalida' }

  if (local && meu?.pendente) {
    if (meu.revisao === revisaoNuvem) return { tipo: 'usar', base: local, marcador: meu }
    return { tipo: 'usar', base: daNuvem ?? vazia(), marcador: { revisao: revisaoNuvem, pendente: false }, descartada: local }
  }
  return { tipo: 'usar', base: daNuvem ?? vazia(), marcador: { revisao: revisaoNuvem, pendente: false } }
}

export type SituacaoGravacao = 'salvo' | 'pendente' | 'salvando' | 'sem-conexao' | 'conflito'

export type EstadoSincronia =
  | { fase: 'iniciando' }
  | { fase: 'entrar' }
  | { fase: 'erro'; causa: CausaFalha; mensagem: string; podeTentar: boolean }
  | { fase: 'pronto'; gravacao: SituacaoGravacao; salvoEm?: string; mensagem?: string; descartada: boolean }

type Armazenamento = { ler(chave: string): string | null; gravar(chave: string, valor: string): void }

export type Dependencias = {
  api: () => Pick<Contrato, 'sessaoAtual' | 'entrar' | 'carregarBase' | 'salvarBase'>
  lerLocal: () => Base | null
  obterBase: () => Base
  substituirBase: (base: Base) => void
  observarMudancas: (observador: () => void) => () => void
  vazia: () => Base
  armazenamento: Armazenamento
  esperar: (ms: number, fazer: () => void) => void
}

const CHAVE_MARCADOR = 'papelaria-opcao:sincronia'
const CHAVE_DESCARTADA = 'papelaria-opcao:copia-descartada'
/** Junta digitações seguidas num envio só. */
const ATRASO_ENVIO = 1500
/** Sem conexão: tenta de novo cada vez mais espaçado, até um minuto. */
const NOVAS_TENTATIVAS = [3000, 10000, 30000, 60000]

export function criarSincronia(dep: Dependencias) {
  let estado: EstadoSincronia = { fase: 'iniciando' }
  let marcador: Marcador = { revisao: 0, pendente: false }
  let iniciado = false
  let enviando = false
  let agendado = false
  let tentativas = 0
  const ouvintes = new Set<() => void>()

  function definir(novo: EstadoSincronia) {
    estado = novo
    ouvintes.forEach((ouvinte) => ouvinte())
  }

  function gravacao(situacao: SituacaoGravacao, extra: { salvoEm?: string; mensagem?: string } = {}) {
    if (estado.fase !== 'pronto') return
    definir({ ...estado, gravacao: situacao, salvoEm: extra.salvoEm ?? estado.salvoEm, mensagem: extra.mensagem })
  }

  function guardarMarcador() {
    dep.armazenamento.gravar(CHAVE_MARCADOR, JSON.stringify(marcador))
  }

  function lerMarcador(): Marcador | null {
    try {
      const bruto = JSON.parse(dep.armazenamento.ler(CHAVE_MARCADOR) ?? 'null') as Marcador | null
      return bruto && Number.isSafeInteger(bruto.revisao) ? { revisao: bruto.revisao, pendente: Boolean(bruto.pendente) } : null
    } catch {
      return null
    }
  }

  function agendar(ms: number) {
    if (agendado) return
    agendado = true
    dep.esperar(ms, () => {
      agendado = false
      void enviar()
    })
  }

  async function enviar() {
    if (enviando || !marcador.pendente || estado.fase !== 'pronto' || estado.gravacao === 'conflito') return
    enviando = true
    gravacao('salvando')
    const enviada = dep.obterBase()
    const r = await dep.api().salvarBase(enviada, marcador.revisao)
    enviando = false
    if (r.ok) {
      tentativas = 0
      // Se a pessoa mexeu durante o envio, ainda há o que mandar.
      marcador = { revisao: r.dado.revisao, pendente: dep.obterBase() !== enviada }
      guardarMarcador()
      gravacao(marcador.pendente ? 'pendente' : 'salvo', { salvoEm: r.dado.salvoEm })
      if (marcador.pendente) agendar(ATRASO_ENVIO)
      return
    }
    if (r.causa === 'conflito') return gravacao('conflito', { mensagem: r.erro })
    if (r.causa === 'sessao') return definir({ fase: 'entrar' })
    gravacao('sem-conexao', { mensagem: r.erro })
    agendar(NOVAS_TENTATIVAS[Math.min(tentativas++, NOVAS_TENTATIVAS.length - 1)])
  }

  function comecar(inicio: Extract<Inicio, { tipo: 'usar' }>, situacao: SituacaoGravacao, mensagem?: string) {
    if (inicio.descartada) dep.armazenamento.gravar(CHAVE_DESCARTADA, JSON.stringify(inicio.descartada))
    marcador = inicio.marcador
    guardarMarcador()
    dep.substituirBase(inicio.base)
    if (!iniciado) {
      iniciado = true
      dep.observarMudancas(() => {
        marcador = { ...marcador, pendente: true }
        guardarMarcador()
        if (estado.fase === 'pronto' && estado.gravacao !== 'conflito') gravacao('pendente')
        agendar(ATRASO_ENVIO)
      })
    }
    definir({ fase: 'pronto', gravacao: marcador.pendente ? 'pendente' : situacao, mensagem, descartada: Boolean(inicio.descartada) })
    if (marcador.pendente) agendar(situacao === 'sem-conexao' ? NOVAS_TENTATIVAS[0] : 0)
  }

  /** Sem banco ao abrir: segue com a cópia do computador, se houver. */
  function abrirSemBanco(r: { erro: string; causa: CausaFalha }) {
    const local = dep.lerLocal()
    if (!local) return definir({ fase: 'erro', causa: r.causa, mensagem: r.erro, podeTentar: true })
    const meu = lerMarcador()
    // Sem marcador, a cópia é a demonstração antiga: não serve como a loja.
    if (!meu) return definir({ fase: 'erro', causa: r.causa, mensagem: r.erro, podeTentar: true })
    comecar({ tipo: 'usar', base: local, marcador: meu }, 'sem-conexao', r.erro)
  }

  async function iniciar() {
    definir({ fase: 'iniciando' })
    const sessao = await dep.api().sessaoAtual()
    if (!sessao.ok) {
      if (sessao.causa === 'rede') return abrirSemBanco(sessao)
      return definir({ fase: 'erro', causa: sessao.causa, mensagem: sessao.erro, podeTentar: sessao.causa !== 'configuracao' })
    }
    if (!sessao.dado) return definir({ fase: 'entrar' })

    const nuvem = await dep.api().carregarBase()
    if (!nuvem.ok) {
      if (nuvem.causa === 'sessao') return definir({ fase: 'entrar' })
      if (nuvem.causa === 'rede') return abrirSemBanco(nuvem)
      return definir({ fase: 'erro', causa: nuvem.causa, mensagem: nuvem.erro, podeTentar: true })
    }
    const inicio = decidirInicio(dep.lerLocal(), lerMarcador(), nuvem.dado, dep.vazia)
    if (inicio.tipo === 'invalida') {
      return definir({ fase: 'erro', causa: 'banco', mensagem: 'Os dados guardados no banco estão num formato que esta versão do app não reconhece. Chame o suporte.', podeTentar: false })
    }
    comecar(inicio, 'salvo')
  }

  async function entrar(email: string, senha: string): Promise<Resultado<Sessao>> {
    const r = await dep.api().entrar(email, senha)
    if (!r.ok) return r
    if (iniciado) {
      // A sessão venceu no meio do uso: a base continua a que está na tela.
      definir({ fase: 'pronto', gravacao: marcador.pendente ? 'pendente' : 'salvo', descartada: false })
      void enviar()
    } else {
      void iniciar()
    }
    return r
  }

  return {
    iniciar,
    entrar,
    obter: () => estado,
    inscrever(ouvinte: () => void) {
      ouvintes.add(ouvinte)
      return () => { ouvintes.delete(ouvinte) }
    },
  }
}

const armazenamentoLocal: Armazenamento = {
  ler: (chave) => {
    try { return globalThis.localStorage?.getItem(chave) ?? null }
    catch { return null }
  },
  gravar: (chave, valor) => {
    try { globalThis.localStorage?.setItem(chave, valor) }
    catch { /* Sem armazenamento: o marcador vive só nesta janela. */ }
  },
}

export const sincronia = criarSincronia({
  api: () => window.api,
  lerLocal: carregarBase,
  obterBase,
  substituirBase,
  observarMudancas,
  vazia: () => criarBaseVazia(hojeISO()),
  armazenamento: armazenamentoLocal,
  esperar: (ms, fazer) => { window.setTimeout(fazer, ms) },
})

export function useSincronia() {
  return useSyncExternalStore(sincronia.inscrever, sincronia.obter)
}
