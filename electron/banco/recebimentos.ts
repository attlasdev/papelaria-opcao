/**
 * O receber notinhas no banco da 1.0 (tela 5.1; `R-CLIENTE-06`,
 * `R-NOTINHA-05`, `06`). As regras estão em `comum/regras/recebimento.ts`, as
 * mesmas do mock; aqui fica o que é do banco: o `recebimento` e um `pagamento`
 * por notinha e por meio numa transação, com o em aberto lido dentro dela.
 */
import { falha, ok, type Contrato, type NotinhaAberta } from '../../comum/contrato'
import { MENSAGENS_CLIENTE } from '../../comum/regras/cliente'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { numeroFicha } from '../../comum/regras/movimentos'
import { emAberto, situacaoCompra } from '../../comum/regras/notinha'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { conferirRecebimento, MENSAGENS_RECEBIMENTO, montarRecebimento } from '../../comum/regras/recebimento'
import { transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesRecebimento = Pick<Contrato, 'listarNotinhasAbertas' | 'receberNotinhas'>

/** As notinhas que ainda podem dever: não canceladas, com o pago sem os estornados. */
const NOTINHAS = `
  select f.id, f.numero, f.cliente_id, f.dia, f.total, f.vencimento,
         (select coalesce(sum(p.valor), 0) from pagamento p
          where p.ficha_id = f.id and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)) as pago
  from ficha f
  where f.forma = 'notinha' and not exists (select 1 from ficha_cancelamento c where c.ficha_id = f.id)`

type Linha = { id: string; numero: number; cliente_id: string; dia: string; total: number; vencimento: string; pago: number }

function abertas(linhas: Linha[], hoje: string) {
  return linhas.flatMap((l): (NotinhaAberta & { clienteId: string })[] => {
    const conta = { forma: 'notinha' as const, total: l.total, vencimento: l.vencimento, cancelada: false, pago: l.pago }
    const falta = emAberto(conta)
    if (falta === 0) return []
    return [{
      id: l.id, numero: numeroFicha(l.numero), dia: l.dia, total: l.total, pago: l.pago, emAberto: falta, vencimento: l.vencimento,
      situacao: situacaoCompra(conta, hoje) as NotinhaAberta['situacao'], clienteId: l.cliente_id,
    }]
  })
}

export function recebimentosSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesRecebimento {
  const conferir = criarConferencia(banco, tentativas)
  const marcadas = (ids: string[]) =>
    banco().prepare(`${NOTINHAS} and f.id in (${ids.map(() => '?').join(', ')})`).all(...ids) as Linha[]

  return {
    async listarNotinhasAbertas(clienteId) {
      const cliente = typeof clienteId === 'string'
        ? banco().prepare('select id, nome from cliente where id = ?').get(clienteId) as { id: string; nome: string } | undefined
        : undefined
      if (!cliente) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
      const linhas = banco().prepare(`${NOTINHAS} and f.cliente_id = ?`).all(cliente.id) as Linha[]
      const notinhas = abertas(linhas, hojeEmSaoPaulo())
        .map(({ clienteId: _c, ...n }) => n)
        .sort((a, b) => a.dia.localeCompare(b.dia) || Number(a.numero) - Number(b.numero))
      return ok({ cliente: { id: cliente.id, nome: cliente.nome }, notinhas })
    },

    async receberNotinhas(bruto, quem) {
      const hoje = hojeEmSaoPaulo()
      const recebimento = conferirRecebimento(bruto, hoje)
      if ('ok' in recebimento) return recebimento
      const existem = banco().prepare(`select count(*) as n from ficha where id in (${recebimento.notinhas.map(() => '?').join(', ')})`)
        .get(...recebimento.notinhas) as { n: number }
      if (existem.n !== recebimento.notinhas.length) return falha('nao-encontrado', MENSAGENS_RECEBIMENTO.naoEncontrada)
      // Conferido antes do PIN, para responder logo; de novo dentro da transação.
      const previa = montarRecebimento(recebimento, new Map(abertas(marcadas(recebimento.notinhas), hoje).map((n) => [n.id, n])))
      if ('ok' in previa) return previa
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      // A assinatura antes da transação: conferir o PIN é lento (scrypt).
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa

      return transacao(banco(), () => {
        // O em aberto de agora: outro recebimento pode ter entrado durante o PIN.
        const montado = montarRecebimento(recebimento, new Map(abertas(marcadas(recebimento.notinhas), hoje).map((n) => [n.id, n])))
        if ('ok' in montado) return montado
        const agora = new Date().toISOString()
        const id = crypto.randomUUID()
        banco().prepare('insert into recebimento (id, cliente_id, dia, operador_id, registrado_em) values (?, ?, ?, ?, ?)')
          .run(id, montado.clienteId, recebimento.dia, pessoa.id, agora)
        const caixa = banco().prepare(`select c.id from caixa c
          where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id)`).get() as { id: string } | undefined
        const pagamento = banco().prepare(`insert into pagamento
          (id, ficha_id, recebimento_id, tipo, meio, valor, recebido, troco, maquininha, cartao, rotulo, dia, caixa_id, operador_id, registrado_em)
          values (?, ?, ?, 'recebimento', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        for (const l of montado.linhas) {
          pagamento.run(crypto.randomUUID(), l.fichaId, id, l.meio, l.valor, l.recebido, l.troco, l.maquininha, l.cartao, l.rotulo,
            recebimento.dia, caixa?.id ?? null, pessoa.id, agora)
        }
        gravarUltimoOperador(banco(), pessoa.id)
        return ok({ abatimentos: montado.abatimentos })
      })
    },
  }
}
