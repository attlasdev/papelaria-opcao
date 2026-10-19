import { VERSAO_BASE, type Base, type ServicoVenda } from './tipos'

const CHAVE = 'papelaria-opcao:base'

/**
 * localStorage pode faltar (teste em Node) ou lançar (armazenamento bloqueado).
 * Nesses casos a base vive só na memória da janela, sem quebrar a tela.
 */
export function carregarBase(): Base | null {
  try {
    const texto = globalThis.localStorage?.getItem(CHAVE)
    return texto ? normalizarBase(JSON.parse(texto)) : null
  } catch {
    return null
  }
}

/**
 * Confere e completa uma base vinda de fora (da cópia local ou do banco). Devolve
 * `null` se ela não estiver no formato desta versão do app.
 */
export function normalizarBase(bruto: unknown): Base | null {
  if (!bruto || typeof bruto !== 'object') return null
  const base = bruto as Base
  if (base.versao !== VERSAO_BASE || !Array.isArray(base.clientes) || !Array.isArray(base.produtos) || !Array.isArray(base.fichas)) return null
  // O cadastro de serviços saiu (`2026-10-19`); a lista antiga, se houver, é descartada.
  const { servicos: _catalogoAntigo, ...semCatalogo } = base as Base & { servicos?: unknown }
  // Campos que chegaram depois ganham valor vazio em vez de apagar a base guardada.
  return {
    ...semCatalogo,
    avisosLidos: base.avisosLidos ?? {},
    fichas: base.fichas.map((f) => (f.servicos ? { ...f, servicos: f.servicos.map(servicoAtual) } : f)),
    ...(base.rascunhoFicha ? { rascunhoFicha: { ...base.rascunhoFicha, ...(base.rascunhoFicha.servicos ? { servicos: base.rascunhoFicha.servicos.map(servicoAtual) } : {}) } } : {}),
    // Conserva o cadastro existente, retirando campos que deixaram de fazer parte dele.
    clientes: base.clientes.map(({ id, nome, documento, telefone, endereco, descricao, desde, fiscal, emitteEnviadoEm }) =>
      ({ id, nome, documento, telefone, endereco, descricao, desde, ...(fiscal ? { fiscal } : {}), ...(emitteEnviadoEm ? { emitteEnviadoEm } : {}) })),
  }
}

/** Serviço gravado antes de `2026-10-19` trazia código do cadastro e motivo da perda: saem. */
function servicoAtual({ nome, valor, perdas, observacao }: ServicoVenda): ServicoVenda {
  return { nome, valor, ...(perdas ? { perdas: { quantidade: perdas.quantidade } } : {}), ...(observacao ? { observacao } : {}) }
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
