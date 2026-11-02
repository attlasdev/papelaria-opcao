/**
 * O caixa sobre a base da demonstração (1.0, tela 7.1; `R-CAIXA-02` a `10`).
 * Lado "mock" dos testes de contrato e, até a Fase 3, o que responde no app
 * (`src/dados/api.ts`). As regras são as de `comum/regras/caixa.ts`, as mesmas
 * do SQLite.
 *
 * A base guarda o caixa como a 0.1: o turno, os pagamentos e os lançamentos
 * apontam o turno (`turnoCaixaId`). Aqui viram os movimentos do contrato. Os
 * registros antigos da gaveta sem turno ("Troco", "Saída de caixa") só existem
 * no mock: entram no histórico com `caixaId` nulo.
 */
import { falha, ok, type CaixaResumido, type Contrato, type MovimentoGaveta, type Resultado, type CaixaDetalhe } from '../../../comum/contrato'
import {
  conferirPagina, conferirPeriodoCaixa, detalheDoCaixa, MENSAGENS_CAIXA, paginaDeCaixas, paginaDeGaveta, valorContado, type MovimentoLido,
} from '../../../comum/regras/caixa'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { numeroFicha } from '../../../comum/regras/movimentos'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import type { MovimentoCaixa as MovimentoDaBase, TurnoCaixa } from '../base/tipos'
import {
  abrirTurnoCaixa, CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, conferirFechamentoCaixa, fecharTurnoCaixa, gravarUltimoOperador,
  movimentarDinheiroCaixa, obterBase,
} from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesCaixa = Pick<Contrato,
  'obterCaixaAtual' | 'abrirCaixa' | 'movimentarGaveta' | 'fecharCaixa' | 'conferirFechamento' | 'listarCaixas' | 'listarMovimentosGaveta' | 'obterCaixa'>

const instante = (data: string, horario: string) => new Date(`${data}T${horario}:00-03:00`).toISOString()

/** Adição e retirada da gaveta, inclusive os registros antigos sem turno. */
const daGaveta = (m: MovimentoDaBase) => [CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, 'Troco', 'Saída de caixa'].includes(m.categoria)

function paraCaixa(t: TurnoCaixa, esperado: () => number): CaixaResumido {
  return {
    id: t.id, abertoEm: t.abertoEm, operadorAbertura: t.operadorAbertura, dinheiroAbertura: t.fundoInicial,
    fechamento: t.fechadoEm ? (() => {
      const esperadoFechamento = t.esperadoFechamento ?? esperado()
      const contado = t.contadoFechamento ?? 0
      return {
        registradoEm: t.fechadoEm, operador: t.operadorFechamento ?? '', contado, esperado: esperadoFechamento,
        diferenca: contado - esperadoFechamento, justificativa: t.justificativaDiferenca ?? null, conferidoPor: t.conferidoPor ?? null,
      }
    })() : null,
  }
}

/** Os movimentos em dinheiro do turno, como o contrato os vê. */
function movimentosDoTurno(turnoId: string): MovimentoLido[] {
  const { fichas, movimentosCaixa } = obterBase()
  const daVenda = fichas.flatMap((f) => f.pagamentos.flatMap((p, i): MovimentoLido[] => {
    if (p.meio !== 'dinheiro') return []
    const ficha = { id: f.id, numero: numeroFicha(f.id) }
    const desfeito = p.estorno ?? f.cancelamento
    const linhas: MovimentoLido[] = []
    if (p.turnoCaixaId === turnoId) {
      linhas.push({
        id: `${f.id}-${i}`, registradoEm: p.registradoEm ?? instante(p.data, p.horario),
        tipo: f.forma !== 'notinha' ? (f.itens.length ? 'venda' : 'servico') : p.entrada ? 'entrada' : 'recebimento',
        motivo: null, valor: p.valor, operador: p.operador ?? f.operador, ficha, estornado: Boolean(desfeito), texto: null,
      })
    }
    if (desfeito?.turnoCaixaId === turnoId) {
      linhas.push({
        id: `${f.id}-${i}-estorno`, registradoEm: desfeito.registradoEm ?? instante(desfeito.data, desfeito.horario),
        tipo: p.estorno ? 'estorno-recebimento' : 'cancelamento', motivo: desfeito.motivo, valor: -p.valor,
        operador: desfeito.operador ?? '', ficha, estornado: false, texto: null,
      })
    }
    return linhas
  }))
  const estornados = new Set(movimentosCaixa.flatMap((m) => (m.estornoDe ? [m.estornoDe] : [])))
  const manuais = movimentosCaixa.flatMap((m): MovimentoLido[] => {
    if (m.turnoCaixaId !== turnoId || m.meio !== 'dinheiro') return []
    const original = m.estornoDe ? movimentosCaixa.find((x) => x.id === m.estornoDe) : undefined
    const tipo = m.estornoDe ? (original && daGaveta(original) ? 'estorno-gaveta' : 'estorno-lancamento')
      : daGaveta(m) ? (m.valor > 0 ? 'adicao' : 'retirada') : 'lancamento'
    return [{
      id: m.id, registradoEm: m.registradoEm ?? instante(m.data, m.horario), tipo,
      motivo: m.estornoDe ? m.origem : m.descricao, valor: m.valor, operador: m.operador ?? '', ficha: null,
      estornado: estornados.has(m.id), texto: m.estornoDe ? original?.descricao ?? null : m.descricao,
    }]
  })
  return [...daVenda, ...manuais]
}

const turnos = () => obterBase().turnosCaixa ?? []

function detalhe(t: TurnoCaixa): CaixaDetalhe {
  const movimentos = movimentosDoTurno(t.id)
  return detalheDoCaixa(paraCaixa(t, () => detalheDoCaixa(paraCaixa({ ...t, fechadoEm: undefined }, () => 0), movimentos).resumo.esperado), movimentos)
}

function resumido(t: TurnoCaixa): CaixaResumido {
  const { resumo: _r, movimentos: _m, ...c } = detalhe(t)
  return c
}

/** Todos os caixas da base, como o contrato os vê (o Início lê os que aguardam a dona). */
export const caixasDaBase = () => turnos().map(resumido)

export function criarCaixaDaBase(tentativas = criarTentativas()): OperacoesCaixa {
  const conferir = criarConferencia(tentativas)
  const aberto = () => turnos().find((t) => !t.fechadoEm)
  const devolver = (id: string): Resultado<CaixaDetalhe> => {
    const t = turnos().find((x) => x.id === id)
    return t ? ok(detalhe(t)) : falha('nao-encontrado', MENSAGENS_CAIXA.naoEncontrado)
  }

  return {
    async obterCaixaAtual() {
      const t = aberto()
      return ok(t ? detalhe(t) : null)
    },

    async abrirCaixa(contado, quem) {
      if (!valorContado(contado)) return falha('validacao', MENSAGENS_CAIXA.valor)
      if (aberto()) return falha('validacao', MENSAGENS_CAIXA.jaAberto)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      abrirTurnoCaixa(contado, pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return devolver(aberto()!.id)
    },

    async movimentarGaveta(tipo, valor, bruto, quem) {
      if (tipo !== 'adicao' && tipo !== 'retirada') return falha('validacao', 'Pedido inválido.')
      if (!valorContado(valor) || valor === 0) return falha('validacao', MENSAGENS_CAIXA.valorMovimento)
      const motivo = typeof bruto === 'string' ? bruto.trim() : ''
      if (!motivo) return falha('validacao', MENSAGENS_CAIXA.motivo)
      const t = aberto()
      if (!t) return falha('validacao', MENSAGENS_CAIXA.semAberto)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      movimentarDinheiroCaixa(tipo === 'adicao' ? 'adicionar' : 'retirar', valor, motivo, pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return devolver(t.id)
    },

    async fecharCaixa(contado, bruto, quem) {
      if (!valorContado(contado)) return falha('validacao', MENSAGENS_CAIXA.valor)
      const t = aberto()
      if (!t) return falha('validacao', MENSAGENS_CAIXA.semAberto)
      const esperado = detalhe(t).resumo.esperado
      const justificativa = typeof bruto === 'string' ? bruto.trim() : ''
      if (contado !== esperado && !justificativa) return falha('validacao', MENSAGENS_CAIXA.justificativa)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      // Com diferença, a dona que fecha já confere (`R-CAIXA-10`).
      fecharTurnoCaixa(t.id, contado, contado === esperado ? '' : justificativa, pessoa.nome, esperado, pessoa.admin && contado !== esperado ? pessoa.nome : undefined)
      gravarUltimoOperador(pessoa.id)
      return devolver(t.id)
    },

    async conferirFechamento(id, dona) {
      const t = typeof id === 'string' ? turnos().find((x) => x.id === id) : undefined
      if (!t) return falha('nao-encontrado', MENSAGENS_CAIXA.naoEncontrado)
      const c = resumido(t)
      if (!c.fechamento) return falha('validacao', MENSAGENS_CAIXA.naoFechado)
      if (c.fechamento.diferenca === 0) return falha('validacao', MENSAGENS_CAIXA.semDiferenca)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      conferirFechamentoCaixa(t.id, pessoa.nome)
      return devolver(t.id)
    },

    async listarCaixas(bruto, soFechados, pagina, porPagina) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const problema = conferirPagina(pagina, porPagina)
      if (problema) return problema
      return ok(paginaDeCaixas(turnos().map(resumido), periodo, soFechados === true, pagina, porPagina))
    },

    async listarMovimentosGaveta(bruto, pagina, porPagina) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const problema = conferirPagina(pagina, porPagina)
      if (problema) return problema
      const todos = obterBase().movimentosCaixa
      const estornados = new Set(todos.flatMap((m) => (m.estornoDe ? [m.estornoDe] : [])))
      const daGavetaOuEstorno = (m: MovimentoDaBase) => daGaveta(m) || Boolean(m.estornoDe && todos.some((x) => x.id === m.estornoDe && daGaveta(x)))
      const movimentos = todos.filter(daGavetaOuEstorno).map((m): MovimentoGaveta => ({
        id: m.id, registradoEm: m.registradoEm ?? instante(m.data, m.horario),
        tipo: m.estornoDe ? 'estorno-gaveta' : m.valor > 0 ? 'adicao' : 'retirada',
        descricao: m.estornoDe ? 'Estorno de adição ou retirada' : m.valor > 0 ? 'Dinheiro adicionado' : 'Dinheiro retirado',
        motivo: m.estornoDe ? m.origem : m.descricao, valor: m.valor, operador: m.operador ?? '',
        caixaId: m.turnoCaixaId ?? null, estornado: estornados.has(m.id),
      }))
      return ok(paginaDeGaveta(movimentos, periodo, pagina, porPagina))
    },

    async obterCaixa(id) {
      return devolver(String(id))
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const caixaDaBase = criarCaixaDaBase(tentativasDaBase)
