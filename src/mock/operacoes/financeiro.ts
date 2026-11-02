/**
 * O Financeiro sobre a base da demonstração (1.0, tela 7.2; `R-FINANCEIRO-02`
 * a `07`). Lado "mock" dos testes de contrato e, até a Fase 3, o que responde
 * no app (`src/dados/api.ts`). As regras são as de `comum/regras/financeiro.ts`,
 * as mesmas do SQLite.
 *
 * Na base, os lançamentos manuais e a gaveta dividem `movimentosCaixa`: a
 * gaveta (adição, retirada e as categorias antigas "Troco" e "Saída de caixa")
 * fica de fora, como no SQLite, onde ela é outra tabela.
 */
import { falha, ok, type Contrato, type LinhaFinanceira } from '../../../comum/contrato'
import { conferirPeriodoCaixa, conferirPagina } from '../../../comum/regras/caixa'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { conferirTexto, MOTIVO_MAXIMO } from '../../../comum/regras/ficha'
import {
  conferirFiltroFinanceiro, conferirLancamento, linhasDoPeriodo, linhasFinanceiras, MENSAGENS_FINANCEIRO, paginaFinanceiro,
  type LancamentoLido, type PagamentoLido,
} from '../../../comum/regras/financeiro'
import { numeroFicha } from '../../../comum/regras/movimentos'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import type { MovimentoCaixa } from '../base/tipos'
import {
  agoraHorario, CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, conferirEstornoLancamento, estornarMovimentoCaixa, gravarUltimoOperador,
  obterBase, registrarMovimentoCaixa,
} from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesFinanceiro = Pick<Contrato, 'consultarFinanceiro' | 'listarFinanceiroDoPeriodo' | 'registrarLancamento' | 'estornarLancamento' | 'conferirEstornoLancamento'>

const instante = (data: string, horario: string) => new Date(`${data}T${horario}:00-03:00`).toISOString()
const daGaveta = (m: MovimentoCaixa) => [CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, 'Troco', 'Saída de caixa'].includes(m.categoria)

/** Todas as linhas da base, como o contrato as vê. */
function todasAsLinhas(): LinhaFinanceira[] {
  const { fichas, clientes, movimentosCaixa } = obterBase()
  const pagamentos = fichas.flatMap((f) => f.pagamentos.map((p, i): PagamentoLido => {
    const desfeito = p.estorno ?? f.cancelamento
    return {
      id: `${f.id}-${i}`, dia: p.data, registradoEm: p.registradoEm ?? instante(p.data, p.horario),
      tipo: f.forma !== 'notinha' ? 'venda' : p.entrada ? 'entrada' : 'recebimento',
      ficha: { id: f.id, numero: numeroFicha(f.id), forma: f.forma, temItens: f.itens.length > 0, temServicos: Boolean(f.servicos?.length) },
      cliente: f.clienteId ? clientes.find((c) => c.id === f.clienteId)?.nome ?? 'Cliente removido' : null,
      meio: p.meio, rotulo: p.rotulo ?? null, valor: p.valor, operador: p.operador ?? f.operador,
      desfeito: desfeito ? {
        estorno: Boolean(p.estorno), dia: desfeito.data, registradoEm: desfeito.registradoEm ?? instante(desfeito.data, desfeito.horario),
        motivo: desfeito.motivo, operador: desfeito.operador ?? '',
      } : null,
    }
  }))
  const lancamentos = movimentosCaixa.flatMap((m): LancamentoLido[] => {
    if (m.estornoDe || daGaveta(m)) return []
    const e = movimentosCaixa.find((x) => x.estornoDe === m.id)
    return [{
      id: m.id, dia: m.data, registradoEm: m.registradoEm ?? instante(m.data, m.horario), tipo: m.valor > 0 ? 'entrada' : 'despesa',
      descricao: m.descricao, origem: m.origem, meio: m.meio, valor: m.valor, operador: m.operador ?? '',
      estorno: e ? {
        id: e.id, dia: e.data, registradoEm: e.registradoEm ?? instante(e.data, e.horario), motivo: e.origem, operador: e.operador ?? '',
        conferidoPor: e.conferidoPor ?? null,
      } : null,
    }]
  })
  return linhasFinanceiras(pagamentos, lancamentos)
}

const linhaPeloId = (id: unknown) => (typeof id === 'string' ? todasAsLinhas().find((l) => l.id === id) : undefined)

export function criarFinanceiroDaBase(tentativas = criarTentativas()): OperacoesFinanceiro {
  const conferir = criarConferencia(tentativas)
  return {
    async consultarFinanceiro(bruto, filtro, pagina, porPagina) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const problema = conferirFiltroFinanceiro(filtro) ?? conferirPagina(pagina, porPagina)
      if (problema) return problema
      return ok(paginaFinanceiro(linhasDoPeriodo(todasAsLinhas(), periodo), filtro, pagina, porPagina))
    },

    async listarFinanceiroDoPeriodo(bruto) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      return ok(linhasDoPeriodo(todasAsLinhas(), periodo))
    },

    async registrarLancamento(bruto, quem) {
      const dados = conferirLancamento(bruto)
      if ('ok' in dados) return dados
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      registrarMovimentoCaixa({
        data: hojeEmSaoPaulo(), horario: agoraHorario(), descricao: dados.descricao, origem: 'Lançamento manual',
        categoria: dados.tipo === 'entrada' ? 'Recebimento avulso' : 'Despesa', meio: dados.meio,
        valor: dados.tipo === 'entrada' ? dados.valor : -dados.valor,
      }, pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return ok(linhaPeloId(obterBase().movimentosCaixa[0].id)!)
    },

    async estornarLancamento(id, bruto, quem) {
      const l = linhaPeloId(id)
      if (!l || l.ficha) return falha('nao-encontrado', MENSAGENS_FINANCEIRO.naoEncontrado)
      if (l.estornoDe) return falha('validacao', MENSAGENS_FINANCEIRO.ehEstorno)
      if (l.estornado) return falha('validacao', MENSAGENS_FINANCEIRO.jaEstornado)
      const motivo = conferirTexto(bruto, MENSAGENS_FINANCEIRO.motivo, MOTIVO_MAXIMO)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      // O da dona já nasce conferido (`R-FINANCEIRO-07`).
      estornarMovimentoCaixa(l.id, motivo, pessoa.nome, pessoa.admin ? pessoa.nome : undefined)
      gravarUltimoOperador(pessoa.id)
      return ok(linhaPeloId(obterBase().movimentosCaixa[0].id)!)
    },

    async conferirEstornoLancamento(id, dona) {
      const l = linhaPeloId(id)
      if (!l || l.ficha) return falha('nao-encontrado', MENSAGENS_FINANCEIRO.naoEncontrado)
      if (!l.estornoDe) return falha('validacao', MENSAGENS_FINANCEIRO.naoEhEstorno)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      conferirEstornoLancamento(l.id, pessoa.nome)
      return ok(linhaPeloId(l.id)!)
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const financeiroDaBase = criarFinanceiroDaBase(tentativasDaBase)
