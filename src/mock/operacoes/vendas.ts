/**
 * A venda sobre a base da demonstração (1.0, tela 4.1; `R-VENDA-05` a `11`).
 * Lado "mock" dos testes de contrato e, até a Fase 3, o que responde no app
 * (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/venda.ts`, as mesmas do SQLite. A base da
 * 0.1 não guarda o "recebido" do dinheiro: o troco fica só no SQLite.
 */
import { falha, ok, type Contrato, type RascunhoFicha as RascunhoContrato } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import { conferirRascunho, conferirVenda, MENSAGENS_VENDA, montarVenda, type ProdutoDaVenda } from '../../../comum/regras/venda'
import type { Pagamento, RascunhoFicha } from '../base/tipos'
import { concluirFicha, gravarUltimoOperador, obterBase, salvarRascunhoFicha } from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesVenda = Pick<Contrato, 'concluirFicha' | 'obterRascunhoFicha' | 'salvarRascunhoFicha'>

const horarioEmSaoPaulo = () =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date())

/** Da base (formato da 0.1) para o contrato: na base, o id do produto é o código. */
function paraContrato(r: RascunhoFicha): RascunhoContrato {
  return {
    clienteId: r.clienteId, semIdentificacao: r.semIdentificacao,
    itens: r.itens.map((i) => ({ produtoId: i.codigo, quantidade: i.quantidade })),
    servicos: (r.servicos ?? []).map((s) => ({ nome: s.nome, valor: s.valor, perdas: s.perdas?.quantidade ?? null, observacao: s.observacao ?? null })),
    desconto: r.desconto, forma: r.forma, recebido: r.recebido, vencimento: r.vencimento, entrada: r.entrada, meioEntrada: r.meioEntrada,
    divisao: r.divisaoPagamento ?? { dinheiro: 0, pix: 0, cartao: 0 }, recebidoMisto: r.recebidoMisto ?? 0,
    cartao: r.cartao ?? 'credito', maquininhaCartao: r.maquininhaCartao ?? 'mercado-pago', pixNaMaquininha: r.pixNaMaquininha ?? true,
  }
}

function paraBase(r: RascunhoContrato): RascunhoFicha {
  return {
    clienteId: r.clienteId, semIdentificacao: r.semIdentificacao,
    itens: r.itens.map((i) => ({ codigo: i.produtoId, quantidade: i.quantidade })),
    servicos: r.servicos.map((s) => ({
      nome: s.nome, valor: s.valor, ...(s.perdas ? { perdas: { quantidade: s.perdas } } : {}), ...(s.observacao ? { observacao: s.observacao } : {}),
    })),
    desconto: r.desconto, forma: r.forma, recebido: r.recebido, prepararNota: false, vencimento: r.vencimento, entrada: r.entrada,
    meioEntrada: r.meioEntrada, divisaoPagamento: r.divisao, recebidoMisto: r.recebidoMisto,
    cartao: r.cartao, maquininhaCartao: r.maquininhaCartao, pixNaMaquininha: r.pixNaMaquininha,
  }
}

export function criarVendasDaBase(tentativas = criarTentativas()): OperacoesVenda {
  const conferir = criarConferencia(tentativas)
  return {
    async concluirFicha(bruta, quem) {
      const hoje = hojeEmSaoPaulo()
      const venda = conferirVenda(bruta, hoje)
      if ('ok' in venda) return venda
      const base = obterBase()
      if (venda.clienteId && !base.clientes.some((c) => c.id === venda.clienteId)) return falha('nao-encontrado', MENSAGENS_VENDA.clienteNaoEncontrado)
      const produtos = new Map<string, ProdutoDaVenda>(base.produtos.map((p) => [p.codigo, { id: p.codigo, descricao: p.descricao, preco: p.preco, saldo: p.saldo, ativo: !p.inativo }]))
      const montada = montarVenda(venda, produtos)
      if ('ok' in montada) return montada
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa

      const horario = horarioEmSaoPaulo()
      const pagamentos: Pagamento[] = montada.pagamentos.map((p) => ({
        data: hoje, horario, meio: p.meio, valor: p.valor,
        ...(p.tipo === 'entrada' ? { entrada: true } : {}),
        ...(p.rotulo ? { rotulo: p.rotulo } : {}),
        ...(p.maquininha ? { maquininha: p.maquininha } : {}),
        ...(p.cartao ? { cartao: p.cartao } : {}),
      }))
      const id = concluirFicha({
        clienteId: venda.clienteId, data: hoje, horario,
        itens: montada.itens.map((i) => ({ codigo: i.produtoId, descricao: i.descricao, quantidade: i.quantidade, preco: i.preco })),
        ...(montada.servicos.length ? {
          servicos: montada.servicos.map((s) => ({
            nome: s.nome, valor: s.valor, ...(s.perdas ? { perdas: { quantidade: s.perdas } } : {}), ...(s.observacao ? { observacao: s.observacao } : {}),
          })),
        } : {}),
        desconto: montada.desconto, total: montada.total, forma: venda.pagamento.forma, pagamentos,
        ...(montada.vencimento ? { vencimento: montada.vencimento } : {}),
      }, pessoa.nome)
      // As regras acima já conferiram tudo o que a base confere: não devia acontecer.
      if (!id) return falha('desconhecida', 'A venda não foi registrada.')
      gravarUltimoOperador(pessoa.id)
      return ok({ id, numero: id })
    },

    async obterRascunhoFicha() {
      const r = obterBase().rascunhoFicha
      return ok(r ? paraContrato(r) : null)
    },

    async salvarRascunhoFicha(bruto) {
      if (bruto === null) {
        salvarRascunhoFicha(null)
        return ok(null)
      }
      const r = conferirRascunho(bruto)
      if ('ok' in r) return r
      salvarRascunhoFicha(paraBase(r))
      return ok(null)
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const vendasDaBase = criarVendasDaBase(tentativasDaBase)
