/**
 * O detalhe da ficha sobre a base da demonstração (1.0, tela 4.2; `R-FICHA-02`,
 * `03`). Lado "mock" dos testes de contrato e, até a Fase 3, o que responde no
 * app (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/ficha.ts`, as mesmas do SQLite. A base da
 * 0.1 guarda data e horário de São Paulo; aqui viram instante UTC.
 */
import { falha, ok, type Contrato, type FichaDetalhe, type PagamentoDaFicha, type Resultado } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { ANOTACAO_MAXIMA, conferirTexto, contaDaFicha, MENSAGENS_FICHA, MOTIVO_MAXIMO } from '../../../comum/regras/ficha'
import { numeroFicha } from '../../../comum/regras/movimentos'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import type { Ficha } from '../base/tipos'
import { anotarFicha, cancelarFicha, conferirCancelamento, gravarUltimoOperador, obterBase } from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesFicha = Pick<Contrato, 'obterFicha' | 'cancelarFicha' | 'conferirCancelamento' | 'anotarFicha'>

const instante = (data: string, horario: string) => new Date(`${data}T${horario}:00-03:00`).toISOString()

function paraDetalhe(f: Ficha): FichaDetalhe {
  const base = obterBase()
  const cliente = f.clienteId ? base.clientes.find((c) => c.id === f.clienteId) : undefined
  const notinha = f.forma === 'notinha'
  const pagamentos: PagamentoDaFicha[] = f.pagamentos.map((p, i) => ({
    id: `${f.id}-${i}`,
    tipo: !notinha ? 'venda' : p.entrada ? 'entrada' : 'recebimento',
    meio: p.meio, valor: p.valor, rotulo: p.rotulo ?? null, dia: p.data,
    registradoEm: p.registradoEm ?? instante(p.data, p.horario), operador: p.operador ?? f.operador,
    estorno: p.estorno ? { dia: p.estorno.data, motivo: p.estorno.motivo, operador: p.estorno.operador ?? '' } : null,
  }))
  const c = f.cancelamento
  const servicos = (f.servicos ?? []).map((s) => ({ nome: s.nome, valor: s.valor, perdas: s.perdas?.quantidade ?? null, observacao: s.observacao ?? null }))
  const subtotal = f.itens.reduce((t, i) => t + i.preco * i.quantidade, 0) + servicos.reduce((t, s) => t + s.valor, 0)
  return {
    id: f.id, numero: numeroFicha(f.id),
    cliente: f.clienteId ? { id: f.clienteId, nome: cliente?.nome ?? 'Cliente removido' } : null,
    registradoEm: instante(f.data, f.horario), operador: f.operador, forma: f.forma,
    rotulo: notinha || f.forma === 'misto' ? null : f.pagamentos[0]?.rotulo ?? null,
    vencimento: f.vencimento ?? null,
    ...contaDaFicha({ forma: f.forma, total: f.total, vencimento: f.vencimento ?? null, cancelada: Boolean(c), pagamentos }, hojeEmSaoPaulo()),
    itens: f.itens.map((i) => ({ produtoId: i.codigo, codigo: i.codigo, descricao: i.descricao, quantidade: i.quantidade, preco: i.preco })),
    servicos, subtotal, desconto: f.desconto, total: f.total, pagamentos,
    cancelamento: c ? {
      dia: c.data, registradoEm: c.registradoEm ?? instante(c.data, c.horario), motivo: c.motivo,
      operador: c.operador ?? '', conferidoPor: c.conferidoPor ?? null,
    } : null,
    anotacoes: (f.anotacoes ?? []).map((a) => ({ registradoEm: instante(a.data, a.horario), texto: a.texto, operador: a.operador ?? '' })),
  }
}

export function criarFichasDaBase(tentativas = criarTentativas()): OperacoesFicha {
  const conferir = criarConferencia(tentativas)
  const buscar = (id: unknown) => (typeof id === 'string' ? obterBase().fichas.find((f) => f.id === id) : undefined)
  const devolver = (id: string): Resultado<FichaDetalhe> => {
    const f = buscar(id)
    return f ? ok(paraDetalhe(f)) : falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
  }

  return {
    async obterFicha(id) {
      return devolver(String(id))
    },

    async cancelarFicha(id, bruto, quem) {
      const f = buscar(id)
      if (!f) return falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
      if (f.cancelamento) return falha('validacao', MENSAGENS_FICHA.jaCancelada)
      const motivo = conferirTexto(bruto, MENSAGENS_FICHA.motivo, MOTIVO_MAXIMO)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      // O da dona já nasce conferido (`R-FICHA-02`).
      cancelarFicha(f.id, motivo, pessoa.nome, pessoa.admin ? pessoa.nome : undefined)
      gravarUltimoOperador(pessoa.id)
      return devolver(f.id)
    },

    async conferirCancelamento(id, dona) {
      const f = buscar(id)
      if (!f) return falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
      if (!f.cancelamento) return falha('validacao', MENSAGENS_FICHA.naoCancelada)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      conferirCancelamento(f.id, pessoa.nome)
      return devolver(f.id)
    },

    async anotarFicha(id, bruto, quem) {
      const f = buscar(id)
      if (!f) return falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
      const texto = conferirTexto(bruto, MENSAGENS_FICHA.anotacao, ANOTACAO_MAXIMA)
      if (typeof texto !== 'string') return texto
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      anotarFicha(f.id, texto, pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return devolver(f.id)
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const fichasDaBase = criarFichasDaBase(tentativasDaBase)
