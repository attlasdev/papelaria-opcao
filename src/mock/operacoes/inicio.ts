/**
 * O Início sobre a base da demonstração (1.0, tela 8.1; `R-INICIO-01` a `06`).
 * Lado "mock" dos testes de contrato e, até a Fase 3, o que responde no app
 * (`src/dados/api.ts`). As regras são as de `comum/regras/inicio.ts`, as
 * mesmas do SQLite.
 *
 * Na base, o visto da dona fica no próprio registro (`conferidoPor`); o que
 * não tem, aguarda. O caixa vem pela leitura do Caixa, que já calcula o
 * esperado dos turnos antigos.
 */
import { ok, type Contrato, type FichaDaLista, type MeioPagamento } from '../../../comum/contrato'
import { aguardandoDona } from '../../../comum/regras/caixa'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { linhasDoPeriodo } from '../../../comum/regras/financeiro'
import { conferirPedidoDeFichas, listaAguardandoDona, paginaDeFichas, resumoDoDia, type PendenciaLida } from '../../../comum/regras/inicio'
import { numeroFicha } from '../../../comum/regras/movimentos'
import type { Ficha } from '../base/tipos'
import { CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, obterBase } from '../estado-demonstracao'
import { caixasDaBase } from './caixa'
import { todasAsLinhas } from './financeiro'

export type OperacoesInicio = Pick<Contrato, 'obterResumoDoDia' | 'listarFichas' | 'listarAguardandoDona'>

const instante = (data: string, horario: string) => new Date(`${data}T${horario}:00-03:00`).toISOString()

export function paraLista(f: Ficha): FichaDaLista & { meios: MeioPagamento[] } {
  const cliente = f.clienteId ? obterBase().clientes.find((c) => c.id === f.clienteId) : undefined
  return {
    id: f.id, numero: numeroFicha(f.id), dia: f.data, registradoEm: instante(f.data, f.horario),
    cliente: f.clienteId ? { id: f.clienteId, nome: cliente?.nome ?? 'Cliente removido' } : null,
    total: f.total, forma: f.forma, rotulo: f.forma === 'misto' || f.forma === 'notinha' ? null : f.pagamentos[0]?.rotulo ?? null,
    cancelada: Boolean(f.cancelamento),
    itens: f.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade })),
    servicos: (f.servicos ?? []).map((s) => s.nome),
    meios: f.pagamentos.map((p) => p.meio),
  }
}

export function criarInicioDaBase(): OperacoesInicio {
  return {
    async obterResumoDoDia() {
      const hoje = hojeEmSaoPaulo()
      const fichas = obterBase().fichas.filter((f) => f.data === hoje).map((f) => ({ total: f.total, cancelada: Boolean(f.cancelamento) }))
      return ok(resumoDoDia(hoje, linhasDoPeriodo(todasAsLinhas(), { de: hoje, ate: hoje }), fichas))
    },

    async listarFichas(bruto, pagina, porPagina) {
      const filtro = conferirPedidoDeFichas(bruto, pagina, porPagina, hojeEmSaoPaulo())
      if ('ok' in filtro) return filtro
      const r = paginaDeFichas(obterBase().fichas.map(paraLista), filtro, pagina as number, porPagina as number)
      return ok({ ...r, fichas: r.fichas.map(({ meios: _m, ...f }) => f) })
    },

    async listarAguardandoDona() {
      const { fichas, movimentosCaixa, movimentosEstoque, produtos } = obterBase()
      const ajustes = movimentosEstoque.flatMap((m): PendenciaLida[] => (m.tipo === 'Ajuste' && !m.conferidoPor ? [{
        tipo: 'ajuste', id: m.id, registradoEm: m.data, operador: m.operador ?? '',
        produto: produtos.find((p) => p.codigo === m.produto)?.descricao ?? m.descricao,
      }] : []))
      const daFicha = fichas.flatMap((f): PendenciaLida[] => {
        const numero = numeroFicha(f.id)
        const c = f.cancelamento
        const cancelamento: PendenciaLida[] = c && !c.conferidoPor
          ? [{ tipo: 'cancelamento', id: f.id, registradoEm: c.registradoEm ?? instante(c.data, c.horario), operador: c.operador ?? '', numero }]
          : []
        return [...cancelamento, ...f.pagamentos.flatMap((p, i): PendenciaLida[] => (p.estorno && !p.estorno.conferidoPor ? [{
          tipo: 'estorno-recebimento', id: p.recebimentoId ?? `${f.id}-${i}`,
          registradoEm: p.estorno.registradoEm ?? instante(p.estorno.data, p.estorno.horario), operador: p.estorno.operador ?? '',
          ficha: { id: f.id, numero },
        }] : []))]
      })
      const fechamentos = caixasDaBase().flatMap((c): PendenciaLida[] => (aguardandoDona(c) ? [{
        tipo: 'fechamento', id: c.id, registradoEm: c.fechamento!.registradoEm, operador: c.fechamento!.operador,
      }] : []))
      const lancamentos = movimentosCaixa.flatMap((m): PendenciaLida[] => {
        const original = m.estornoDe ? movimentosCaixa.find((x) => x.id === m.estornoDe) : undefined
        // O estorno da gaveta é do Caixa e não pede visto; no SQLite ela é outra tabela.
        const daGaveta = original && [CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, 'Troco', 'Saída de caixa'].includes(original.categoria)
        return original && !daGaveta && !m.conferidoPor ? [{
          tipo: 'estorno-lancamento', id: m.id, registradoEm: m.registradoEm ?? instante(m.data, m.horario), operador: m.operador ?? '',
          descricao: original.descricao, dia: m.data,
        }] : []
      })
      return ok(listaAguardandoDona([...ajustes, ...daFicha, ...fechamentos, ...lancamentos]))
    },
  }
}

export const inicioDaBase = criarInicioDaBase()
