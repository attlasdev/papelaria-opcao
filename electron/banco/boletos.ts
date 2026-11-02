/**
 * Os boletos no banco da 1.0 (tela 6.1; `R-BOLETO-01` a `06`, D7). As regras
 * estão em `comum/regras/boleto.ts`, as mesmas do mock; aqui fica o que é do
 * banco: o boleto nunca se apaga, e a situação é o último evento
 * (`boleto_evento`: pago, pagamento desfeito, excluído), que o gatilho
 * `boleto_evento_sequencia` mantém em ordem.
 */
import { falha, ok, type Contrato, type Resultado, type Boleto } from '../../comum/contrato'
import { boletoComSituacao, conferirDadosBoleto, conferirPedidoDeBoletos, listaDeBoletos, MENSAGENS_BOLETO, type BoletoLido } from '../../comum/regras/boleto'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { conferirTexto, MOTIVO_MAXIMO } from '../../comum/regras/ficha'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { proximoNumero, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesBoleto = Pick<Contrato, 'listarBoletos' | 'cadastrarBoleto' | 'editarBoleto' | 'marcarBoletoPago' | 'desfazerPagamentoBoleto' | 'excluirBoleto'>

/** O boleto com o último evento: pago (com o dia e quem), ou nada. Excluído não entra. */
const BOLETOS = `
  select b.id, b.descricao, b.valor, b.numero, b.vencimento, b.criado_em, u.tipo as ultimo, u.dia as pago_dia, o.nome as pago_por
  from boleto b
  left join boleto_evento u on u.id = (select e.id from boleto_evento e where e.boleto_id = b.id order by e.rowid desc limit 1)
  left join operador o on o.id = u.operador_id
  where (u.tipo is null or u.tipo <> 'excluido')`

type Linha = { id: string; descricao: string; valor: number; numero: string; vencimento: string; criado_em: string; ultimo: string | null; pago_dia: string | null; pago_por: string | null }

const lido = (l: Linha): BoletoLido => ({
  id: l.id, descricao: l.descricao, valor: l.valor, numero: l.numero, vencimento: l.vencimento, cadastradoEm: l.criado_em,
  pago: l.ultimo === 'pago' ? { dia: l.pago_dia!, operador: l.pago_por! } : null,
})

export function boletosSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesBoleto {
  const conferir = criarConferencia(banco, tentativas)
  const buscar = (id: unknown) => (typeof id === 'string' ? banco().prepare(`${BOLETOS} and b.id = ?`).get(id) as Linha | undefined : undefined)
  const devolver = (id: string): Resultado<Boleto> => {
    const l = buscar(id)
    return l ? ok(boletoComSituacao(lido(l), hojeEmSaoPaulo())) : falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
  }
  const evento = (boletoId: string, tipo: string, dia: string | null, motivo: string | null, operadorId: string) =>
    banco().prepare('insert into boleto_evento (id, boleto_id, tipo, dia, motivo, operador_id, registrado_em) values (?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), boletoId, tipo, dia, motivo, operadorId, new Date().toISOString())
  const motivoDe = (bruto: unknown) => conferirTexto(bruto, MENSAGENS_BOLETO.motivo, MOTIVO_MAXIMO)

  return {
    async listarBoletos(filtro, busca) {
      const problema = conferirPedidoDeBoletos(filtro, busca)
      if (problema) return problema
      return ok(listaDeBoletos((banco().prepare(BOLETOS).all() as Linha[]).map(lido), filtro, busca, hojeEmSaoPaulo()))
    },

    async cadastrarBoleto(bruto) {
      const dados = conferirDadosBoleto(bruto)
      if ('ok' in dados) return dados
      const id = crypto.randomUUID()
      banco().prepare('insert into boleto (id, numero_exibicao, descricao, valor, numero, vencimento, criado_em) values (?, ?, ?, ?, ?, ?, ?)')
        .run(id, proximoNumero(banco(), 'boleto'), dados.descricao, dados.valor, dados.numero, dados.vencimento, new Date().toISOString())
      return devolver(id)
    },

    async editarBoleto(id, bruto) {
      if (!buscar(id)) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      const dados = conferirDadosBoleto(bruto)
      if ('ok' in dados) return dados
      banco().prepare('update boleto set descricao = ?, valor = ?, numero = ?, vencimento = ? where id = ?')
        .run(dados.descricao, dados.valor, dados.numero, dados.vencimento, id)
      return devolver(id)
    },

    async marcarBoletoPago(id, quem) {
      const l = buscar(id)
      if (!l) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      if (l.ultimo === 'pago') return falha('validacao', MENSAGENS_BOLETO.jaPago)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      evento(l.id, 'pago', hojeEmSaoPaulo(), null, pessoa.id)
      gravarUltimoOperador(banco(), pessoa.id)
      return devolver(l.id)
    },

    async desfazerPagamentoBoleto(id, bruto, quem) {
      const l = buscar(id)
      if (!l) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      if (l.ultimo !== 'pago') return falha('validacao', MENSAGENS_BOLETO.naoPago)
      const motivo = motivoDe(bruto)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      evento(l.id, 'pagamento-desfeito', null, motivo, pessoa.id)
      gravarUltimoOperador(banco(), pessoa.id)
      return devolver(l.id)
    },

    async excluirBoleto(id, bruto, quem) {
      const l = buscar(id)
      if (!l) return falha('nao-encontrado', MENSAGENS_BOLETO.naoEncontrado)
      const motivo = motivoDe(bruto)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      evento(l.id, 'excluido', null, motivo, pessoa.id)
      gravarUltimoOperador(banco(), pessoa.id)
      return ok(null)
    },
  }
}
