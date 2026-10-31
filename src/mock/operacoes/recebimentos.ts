/**
 * O receber notinhas sobre a base da demonstração (1.0, tela 5.1;
 * `R-CLIENTE-06`, `R-NOTINHA-05`, `06`). Lado "mock" dos testes de contrato e,
 * até a Fase 3, o que responde no app (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/recebimento.ts`, as mesmas do SQLite. A
 * base da 0.1 não guarda o "recebido" do dinheiro: o troco fica só no SQLite.
 */
import { falha, ok, type Contrato, type NotinhaAberta } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { numeroFicha } from '../../../comum/regras/movimentos'
import { emAberto, situacaoCompra } from '../../../comum/regras/notinha'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import { conferirRecebimento, MENSAGENS_RECEBIMENTO, montarRecebimento } from '../../../comum/regras/recebimento'
import type { Ficha } from '../base/tipos'
import { gravarRecebimento, gravarUltimoOperador, obterBase } from '../estado-demonstracao'
import { MENSAGENS_CLIENTE } from '../../../comum/regras/cliente'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesRecebimento = Pick<Contrato, 'listarNotinhasAbertas' | 'receberNotinhas'>

const horarioEmSaoPaulo = () =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())

/** A notinha que ainda deve, ou `null`. */
function aberta(f: Ficha, hoje: string): (NotinhaAberta & { clienteId: string }) | null {
  if (f.forma !== 'notinha' || !f.clienteId || !f.vencimento) return null
  const pago = f.pagamentos.filter((p) => !p.estorno).reduce((t, p) => t + p.valor, 0)
  const conta = { forma: f.forma, total: f.total, vencimento: f.vencimento, cancelada: Boolean(f.cancelamento), pago }
  const falta = emAberto(conta)
  if (falta === 0) return null
  const situacao = situacaoCompra(conta, hoje) as NotinhaAberta['situacao']
  return { id: f.id, numero: numeroFicha(f.id), dia: f.data, total: f.total, pago, emAberto: falta, vencimento: f.vencimento, situacao, clienteId: f.clienteId }
}

export function criarRecebimentosDaBase(tentativas = criarTentativas()): OperacoesRecebimento {
  const conferir = criarConferencia(tentativas)
  return {
    async listarNotinhasAbertas(clienteId) {
      const base = obterBase()
      const cliente = base.clientes.find((c) => c.id === clienteId)
      if (!cliente) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
      const hoje = hojeEmSaoPaulo()
      const notinhas = base.fichas
        .filter((f) => f.clienteId === cliente.id)
        .flatMap((f) => {
          const n = aberta(f, hoje)
          if (!n) return []
          const { clienteId: _c, ...semCliente } = n
          return [semCliente]
        })
        .sort((a, b) => a.dia.localeCompare(b.dia) || Number(a.numero) - Number(b.numero))
      return ok({ cliente: { id: cliente.id, nome: cliente.nome }, notinhas })
    },

    async receberNotinhas(bruto, quem) {
      const hoje = hojeEmSaoPaulo()
      const recebimento = conferirRecebimento(bruto, hoje)
      if ('ok' in recebimento) return recebimento
      const fichas = obterBase().fichas
      if (recebimento.notinhas.some((id) => !fichas.some((f) => f.id === id))) return falha('nao-encontrado', MENSAGENS_RECEBIMENTO.naoEncontrada)
      const abertas = new Map(fichas.flatMap((f) => {
        const n = aberta(f, hoje)
        return n ? [[n.id, n] as const] : []
      }))
      const montado = montarRecebimento(recebimento, abertas)
      if ('ok' in montado) return montado
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      gravarRecebimento(montado.linhas, recebimento.dia, horarioEmSaoPaulo(), pessoa.nome)
      gravarUltimoOperador(pessoa.id)
      return ok({ abatimentos: montado.abatimentos })
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const recebimentosDaBase = criarRecebimentosDaBase(tentativasDaBase)
