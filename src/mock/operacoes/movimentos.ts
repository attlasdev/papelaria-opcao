/**
 * O histórico do estoque sobre a base da demonstração (1.0, tela 2.6). Lado
 * "mock" dos testes de contrato e, até a Fase 3, o que responde no app
 * (`src/dados/api.ts`).
 *
 * Na base, o movimento guarda o texto de exibição ("Ficha #1129 cancelada ·
 * motivo"); aqui ele vira os campos do contrato, iguais aos do SQLite.
 */
import { ok, type Contrato, type MovimentoEstoque as Movimento } from '../../../comum/contrato'
import { conferirPedidoDeMovimentos, numeroFicha } from '../../../comum/regras/movimentos'
import type { MovimentoEstoque, Produto } from '../base/tipos'
import { obterBase } from '../estado-demonstracao'

export type OperacoesMovimento = Pick<Contrato, 'listarMovimentosEstoque'>

const TIPO: Record<MovimentoEstoque['tipo'], Movimento['tipo']> = { Entrada: 'entrada', Ajuste: 'ajuste', Venda: 'venda', Cancelamento: 'cancelamento' }

function paraMovimento(m: MovimentoEstoque, produtos: Produto[]): Movimento {
  const tipo = TIPO[m.tipo]
  const ficha = /^Ficha #(\d+)/.exec(m.motivo)?.[1]
  const motivo = tipo === 'venda' ? null : tipo === 'cancelamento' ? m.motivo.split(' · ').slice(1).join(' · ') || null : m.motivo
  const e = m.entrada
  return {
    id: m.id,
    registradoEm: m.data,
    tipo,
    produto: { id: m.produto, codigo: m.produto, descricao: produtos.find((p) => p.codigo === m.produto)?.descricao ?? m.descricao },
    saldoAntes: m.antes,
    saldoDepois: m.depois,
    motivo,
    operador: m.operador ?? '—',
    entrada: e ? { recebidaEm: e.recebidaEm, fornecedor: e.fornecedor ?? null, referencia: e.referencia ?? null, observacoes: e.observacoes ?? null, custoUnitario: e.custoUnitario ?? null } : null,
    ficha: ficha ? { id: ficha, numero: numeroFicha(ficha) } : null,
    aguardandoConferencia: tipo === 'ajuste' && !m.conferidoPor,
    conferencia: m.conferidoPor && m.conferidoEm ? { por: m.conferidoPor, em: m.conferidoEm } : null,
  }
}

export function criarMovimentosDaBase(): OperacoesMovimento {
  return {
    async listarMovimentosEstoque(bruto, pagina, porPagina) {
      const filtro = conferirPedidoDeMovimentos(bruto, pagina, porPagina)
      if ('ok' in filtro) return filtro
      const base = obterBase()
      // Do mais novo ao mais velho; o empate fica na ordem da base, que já é essa.
      const doProduto = base.movimentosEstoque
        .filter((m) => !filtro.produtoId || m.produto === filtro.produtoId)
        .map((m, ordem) => ({ m, ordem }))
        .sort((a, b) => b.m.data.localeCompare(a.m.data) || a.ordem - b.ordem)
        .map(({ m }) => paraMovimento(m, base.produtos))
      const achados = doProduto.filter((m) =>
        (filtro.tipo === 'todas' || m.tipo === filtro.tipo) && (!filtro.aguardando || m.aguardandoConferencia))
      return ok({
        movimentos: achados.slice((pagina - 1) * porPagina, pagina * porPagina),
        total: achados.length,
        aguardando: doProduto.filter((m) => m.aguardandoConferencia).length,
      })
    },
  }
}

export const movimentosDaBase = criarMovimentosDaBase()
