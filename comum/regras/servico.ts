/**
 * Os serviços feitos e as perdas (Memoria.md, "Serviços"; `R-SERVICO-02`,
 * `03`), uma vez só para o mock e o SQLite. Funções puras: cada lado lê as
 * fichas do período que têm serviço e entrega aqui.
 */
import { falha, type Falha, type ServicosDoPeriodo } from '../contrato'
import { diaValido } from './entrada'

/** O período pedido, ou a falha. `hoje`: o dia de São Paulo. */
export function conferirPeriodoServicos(bruto: unknown, hoje: string): { de: string; ate: string } | Falha {
  const p = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : null
  if (!p || !diaValido(p.de) || !diaValido(p.ate) || p.de > p.ate) return falha('validacao', 'Período inválido.')
  if (p.ate > hoje) return falha('validacao', 'O período não pode passar de hoje.')
  return { de: p.de, ate: p.ate }
}

/** Uma ficha do período com serviço, como cada lado lê. */
export type FichaComServicos = {
  id: string
  numero: string
  registradoEm: string
  cliente: string | null
  cancelada: boolean
  comProdutos: boolean
  servicos: { nome: string; valor: number; perdas: number | null; observacao: string | null }[]
}

/**
 * Da mais nova para a mais velha, na ordem dos serviços dentro da ficha. A
 * ficha cancelada sai dos feitos e fica nas perdas (`R-SERVICO-02`, `03`).
 */
export function servicosDoPeriodo(fichas: FichaComServicos[]): ServicosDoPeriodo {
  const ordem = [...fichas].sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || Number(b.numero) - Number(a.numero))
  const feitos = ordem.filter((f) => !f.cancelada).flatMap((f) => f.servicos.map((s) => ({
    fichaId: f.id, numero: f.numero, registradoEm: f.registradoEm, cliente: f.cliente, servico: s.nome,
    observacao: s.observacao, perdas: s.perdas ?? 0, valor: s.valor, comProdutos: f.comProdutos,
  })))
  const perdas = ordem.flatMap((f) => f.servicos.flatMap((s) => (s.perdas ? [{
    fichaId: f.id, numero: f.numero, registradoEm: f.registradoEm, servico: s.nome, quantidade: s.perdas, observacao: s.observacao,
  }] : [])))
  return {
    feitos, perdas,
    resumo: {
      feitos: feitos.length, valorFeitos: feitos.reduce((t, s) => t + s.valor, 0),
      anotacoes: perdas.length, unidadesPerdidas: perdas.reduce((t, p) => t + p.quantidade, 0),
    },
  }
}
