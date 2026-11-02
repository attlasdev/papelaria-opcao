/**
 * Os boletos sobre a base da demonstração (1.0, tela 6.1; `R-BOLETO-01` a
 * `06`, D7). Lado "mock" dos testes de contrato e, até a Fase 3, o que responde
 * no app (`src/dados/api.ts`). As regras são as de `comum/regras/boleto.ts`,
 * as mesmas do SQLite. A base guarda o boleto como a 0.1: o pagamento que
 * vale agora, sem o histórico do desfazer (que fica no SQLite).
 */
import { falha, ok, type Contrato, type Resultado, type Boleto as BoletoContrato } from '../../../comum/contrato'
import { boletoComSituacao, conferirDadosBoleto, conferirPedidoDeBoletos, listaDeBoletos, MENSAGENS_BOLETO, type BoletoLido } from '../../../comum/regras/boleto'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { conferirTexto, MOTIVO_MAXIMO } from '../../../comum/regras/ficha'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import type { Boleto } from '../base/tipos'
import { cadastrarBoleto, editarBoleto, excluirBoleto, gravarUltimoOperador, marcarBoletoPago, obterBase } from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesBoleto = Pick<Contrato, 'listarBoletos' | 'cadastrarBoleto' | 'editarBoleto' | 'marcarBoletoPago' | 'desfazerPagamentoBoleto' | 'excluirBoleto'>

const lido = (b: Boleto): BoletoLido => ({
  id: b.id, descricao: b.descricao, valor: b.valor, numero: b.numero, vencimento: b.vencimento, cadastradoEm: b.cadastradoEm,
  pago: b.pagoEm ? { dia: b.pagoEm, operador: b.pagoPor ?? '' } : null,
})

export function criarBoletosDaBase(tentativas = criarTentativas()): OperacoesBoleto {
  const conferir = criarConferencia(tentativas)
  const buscar = (id: unknown) => (typeof id === 'string' ? obterBase().boletos.find((b) => b.id === id && !b.excluido) : undefined)
  const devolver = (id: string): Resultado<BoletoContrato> => {
    const b = buscar(id)
    return b ? ok(boletoComSituacao(lido(b), hojeEmSaoPaulo())) : falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
  }
  const motivoDe = (bruto: unknown) => conferirTexto(bruto, MENSAGENS_BOLETO.motivo, MOTIVO_MAXIMO)

  return {
    async listarBoletos(filtro, busca) {
      const problema = conferirPedidoDeBoletos(filtro, busca)
      if (problema) return problema
      return ok(listaDeBoletos(obterBase().boletos.filter((b) => !b.excluido).map(lido), filtro, busca, hojeEmSaoPaulo()))
    },

    async cadastrarBoleto(bruto) {
      const dados = conferirDadosBoleto(bruto)
      if ('ok' in dados) return dados
      const id = cadastrarBoleto(dados)
      return id ? devolver(id) : falha('validacao', MENSAGENS_BOLETO.vencimento)
    },

    async editarBoleto(id, bruto) {
      if (!buscar(id)) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      const dados = conferirDadosBoleto(bruto)
      if ('ok' in dados) return dados
      editarBoleto(id, dados)
      return devolver(id)
    },

    async marcarBoletoPago(id, quem) {
      const b = buscar(id)
      if (!b) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      if (b.pagoEm) return falha('validacao', MENSAGENS_BOLETO.jaPago)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      marcarBoletoPago(b.id, true, pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return devolver(b.id)
    },

    async desfazerPagamentoBoleto(id, bruto, quem) {
      const b = buscar(id)
      if (!b) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      if (!b.pagoEm) return falha('validacao', MENSAGENS_BOLETO.naoPago)
      const motivo = motivoDe(bruto)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      marcarBoletoPago(b.id, false)
      gravarUltimoOperador(pessoa.id)
      return devolver(b.id)
    },

    async excluirBoleto(id, bruto, quem) {
      const b = buscar(id)
      if (!b) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      const motivo = motivoDe(bruto)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      excluirBoleto(b.id, motivo, pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return ok(null)
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const boletosDaBase = criarBoletosDaBase(tentativasDaBase)
