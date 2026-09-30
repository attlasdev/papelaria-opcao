import { VERSAO_BASE, type Base } from './tipos'

const CHAVE = 'papelaria-opcao:base'

/**
 * localStorage pode faltar (teste em Node) ou lançar (armazenamento bloqueado).
 * Nesses casos a base vive só na memória da janela, sem quebrar a tela.
 */
export function carregarBase(): Base | null {
  try {
    const texto = globalThis.localStorage?.getItem(CHAVE)
    if (!texto) return null
    const base = JSON.parse(texto) as Base
    // Campos que chegaram depois ganham valor vazio em vez de apagar a base guardada.
    return base.versao === VERSAO_BASE ? { ...base, avisosLidos: base.avisosLidos ?? {} } : null
  } catch {
    return null
  }
}

export function salvarBase(base: Base) {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(base))
  } catch {
    // Sem espaço ou bloqueado: segue em memória.
  }
}

export function apagarBase() {
  try {
    globalThis.localStorage?.removeItem(CHAVE)
  } catch {
    // Idem.
  }
}
