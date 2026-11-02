/**
 * O detalhe da ficha no banco da 1.0 (telas 4.2 e 5.2; `R-FICHA-02`, `03`,
 * `R-CORRECAO-03`). As regras
 * estão em `comum/regras/ficha.ts`, as mesmas do mock; aqui fica o que é do
 * banco: o cancelamento com a devolução ao estoque numa transação, e a
 * conferência da dona como registro à parte (`conferencia_cancelamento`,
 * migration 0004), porque o cancelamento é fato.
 */
import { falha, ok, type Contrato, type FichaDetalhe, type PagamentoDaFicha, type Resultado } from '../../comum/contrato'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { ANOTACAO_MAXIMA, conferirTexto, contaDaFicha, MENSAGENS_FICHA, MOTIVO_MAXIMO } from '../../comum/regras/ficha'
import { numeroFicha } from '../../comum/regras/movimentos'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { codigoProduto, MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesFicha = Pick<Contrato, 'obterFicha' | 'cancelarFicha' | 'conferirCancelamento' | 'anotarFicha' | 'estornarRecebimento' | 'conferirEstorno'>

type LinhaFicha = {
  id: string; numero: number; cliente_id: string | null; cliente: string | null; registrado_em: string; operador: string
  forma: FichaDetalhe['forma']; vencimento: string | null; subtotal: number; desconto: number; total: number
}

function ler(banco: Banco, id: string): FichaDetalhe | null {
  const f = banco.prepare(`
    select f.id, f.numero, f.cliente_id, c.nome as cliente, f.registrado_em, o.nome as operador, f.forma, f.vencimento, f.subtotal, f.desconto, f.total
    from ficha f join operador o on o.id = f.operador_id left join cliente c on c.id = f.cliente_id
    where f.id = ?`).get(id) as LinhaFicha | undefined
  if (!f) return null
  const itens = banco.prepare(`
    select i.produto_id, p.numero, i.descricao, i.quantidade, i.preco
    from ficha_item i join produto p on p.id = i.produto_id where i.ficha_id = ? order by i.rowid`).all(id) as
    { produto_id: string; numero: number; descricao: string; quantidade: number; preco: number }[]
  const servicos = banco.prepare('select nome, valor, perdas, observacao from ficha_servico where ficha_id = ? order by rowid').all(id) as
    FichaDetalhe['servicos']
  // As outras notinhas do mesmo "Receber": estornar desfaz todas juntas (`R-CORRECAO-03`).
  const outras = banco.prepare(`
    select o.ficha_id, f.numero, o.valor from pagamento o join ficha f on f.id = o.ficha_id
    where o.recebimento_id = ? and o.ficha_id <> ? order by f.dia, f.numero, o.rowid`)
  const pagamentos = (banco.prepare(`
    select p.id, p.tipo, p.meio, p.valor, p.rotulo, p.dia, p.registrado_em, p.recebimento_id, o.nome as operador,
           e.dia as estorno_dia, e.motivo as estorno_motivo, eo.nome as estorno_operador, d.nome as conferido_por
    from pagamento p join operador o on o.id = p.operador_id
    left join pagamento_estorno e on e.pagamento_id = p.id left join operador eo on eo.id = e.operador_id
    left join conferencia_estorno ce on ce.estorno_id = e.id left join operador d on d.id = ce.operador_id
    where p.ficha_id = ? order by p.registrado_em, p.rowid`).all(id) as {
      id: string; tipo: PagamentoDaFicha['tipo']; meio: PagamentoDaFicha['meio']; valor: number; rotulo: string | null; dia: string
      registrado_em: string; recebimento_id: string | null; operador: string
      estorno_dia: string | null; estorno_motivo: string | null; estorno_operador: string | null; conferido_por: string | null
    }[]).map((p): PagamentoDaFicha => ({
    id: p.id, tipo: p.tipo, meio: p.meio, valor: p.valor, rotulo: p.rotulo, dia: p.dia, registradoEm: p.registrado_em, operador: p.operador,
    mesmoRecebimento: p.recebimento_id
      ? (outras.all(p.recebimento_id, id) as { ficha_id: string; numero: number; valor: number }[])
        .map((o) => ({ fichaId: o.ficha_id, numero: numeroFicha(o.numero), valor: o.valor }))
      : [],
    estorno: p.estorno_dia ? { dia: p.estorno_dia, motivo: p.estorno_motivo!, operador: p.estorno_operador!, conferidoPor: p.conferido_por } : null,
  }))
  const c = banco.prepare(`
    select fc.dia, fc.registrado_em, fc.motivo, o.nome as operador, d.nome as conferido_por
    from ficha_cancelamento fc join operador o on o.id = fc.operador_id
    left join conferencia_cancelamento cc on cc.cancelamento_id = fc.id left join operador d on d.id = cc.operador_id
    where fc.ficha_id = ?`).get(id) as { dia: string; registrado_em: string; motivo: string; operador: string; conferido_por: string | null } | undefined
  const anotacoes = (banco.prepare(`
    select a.registrado_em, a.texto, o.nome as operador from ficha_anotacao a join operador o on o.id = a.operador_id
    where a.ficha_id = ? order by a.registrado_em, a.rowid`).all(id) as { registrado_em: string; texto: string; operador: string }[])
    .map((a) => ({ registradoEm: a.registrado_em, texto: a.texto, operador: a.operador }))
  const umMeio = f.forma !== 'notinha' && f.forma !== 'misto'
  return {
    id: f.id, numero: numeroFicha(f.numero),
    cliente: f.cliente_id ? { id: f.cliente_id, nome: f.cliente ?? '' } : null,
    registradoEm: f.registrado_em, operador: f.operador, forma: f.forma,
    rotulo: umMeio ? pagamentos.find((p) => p.tipo === 'venda')?.rotulo ?? null : null,
    vencimento: f.vencimento,
    ...contaDaFicha({ forma: f.forma, total: f.total, vencimento: f.vencimento, cancelada: Boolean(c), pagamentos }, hojeEmSaoPaulo()),
    itens: itens.map((i) => ({ produtoId: i.produto_id, codigo: codigoProduto(i.numero), descricao: i.descricao, quantidade: i.quantidade, preco: i.preco })),
    servicos: servicos.map((s) => ({ ...s })), subtotal: f.subtotal, desconto: f.desconto, total: f.total, pagamentos,
    cancelamento: c ? { dia: c.dia, registradoEm: c.registrado_em, motivo: c.motivo, operador: c.operador, conferidoPor: c.conferido_por } : null,
    anotacoes,
  }
}

export function fichasSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesFicha {
  const conferir = criarConferencia(banco, tentativas)
  const devolver = (id: string): Resultado<FichaDetalhe> => {
    const f = ler(banco(), id)
    return f ? ok(f) : falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
  }
  const existe = (id: unknown) => typeof id === 'string' && Boolean(banco().prepare('select 1 from ficha where id = ?').get(id))
  const cancelada = (id: string) => Boolean(banco().prepare('select 1 from ficha_cancelamento where ficha_id = ?').get(id))
  const lerPagamento = (id: unknown) => (typeof id === 'string'
    ? banco().prepare(`select p.id, p.ficha_id, p.tipo, p.recebimento_id,
        exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id) as estornado
        from pagamento p where p.id = ?`).get(id) as { id: string; ficha_id: string; tipo: string; recebimento_id: string | null; estornado: number } | undefined
    : undefined)

  return {
    async obterFicha(id) {
      return devolver(String(id))
    },

    async cancelarFicha(id, bruto, quem) {
      if (!existe(id)) return falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
      if (cancelada(id)) return falha('validacao', MENSAGENS_FICHA.jaCancelada)
      const motivo = conferirTexto(bruto, MENSAGENS_FICHA.motivo, MOTIVO_MAXIMO)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      // A assinatura antes da transação: conferir o PIN é lento (scrypt).
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      return transacao(banco(), () => {
        // Outra máquina pode ter cancelado durante o PIN.
        if (cancelada(id)) return falha('validacao', MENSAGENS_FICHA.jaCancelada)
        const agora = new Date().toISOString()
        const cancelamento = crypto.randomUUID()
        const caixa = banco().prepare(`select c.id from caixa c
          where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id)`).get() as { id: string } | undefined
        banco().prepare(`insert into ficha_cancelamento (id, ficha_id, motivo, dia, caixa_id, operador_id, registrado_em)
          values (?, ?, ?, ?, ?, ?, ?)`).run(cancelamento, id, motivo, hojeEmSaoPaulo(), caixa?.id ?? null, pessoa.id, agora)
        // Volta o que a venda baixou, item a item; o gatilho grava o saldo novo.
        const vendidos = banco().prepare(`select produto_id, -quantidade as quantidade from movimento_estoque
          where ficha_id = ? and tipo = 'venda' order by rowid`).all(id) as { produto_id: string; quantidade: number }[]
        const devolve = banco().prepare(`insert into movimento_estoque
          (id, produto_id, tipo, quantidade, saldo_antes, saldo_depois, motivo, ficha_id, operador_id, registrado_em)
          select ?, id, 'cancelamento', ?, saldo, saldo + ?, ?, ?, ?, ? from produto where id = ?`)
        for (const v of vendidos) devolve.run(crypto.randomUUID(), v.quantidade, v.quantidade, motivo, id, pessoa.id, agora, v.produto_id)
        // O da dona já nasce conferido (`R-FICHA-02`).
        if (pessoa.admin) {
          banco().prepare('insert into conferencia_cancelamento (cancelamento_id, operador_id, registrado_em) values (?, ?, ?)').run(cancelamento, pessoa.id, agora)
        }
        gravarUltimoOperador(banco(), pessoa.id)
        return devolver(id)
      })
    },

    async conferirCancelamento(id, dona) {
      if (!existe(id)) return falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
      if (!cancelada(id)) return falha('validacao', MENSAGENS_FICHA.naoCancelada)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      banco().prepare(`insert into conferencia_cancelamento (cancelamento_id, operador_id, registrado_em)
        select id, ?, ? from ficha_cancelamento where ficha_id = ? on conflict do nothing`).run(pessoa.id, new Date().toISOString(), id)
      return devolver(id)
    },

    async anotarFicha(id, bruto, quem) {
      if (!existe(id)) return falha('nao-encontrado', MENSAGENS_FICHA.naoEncontrada)
      const texto = conferirTexto(bruto, MENSAGENS_FICHA.anotacao, ANOTACAO_MAXIMA)
      if (typeof texto !== 'string') return texto
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      banco().prepare('insert into ficha_anotacao (id, ficha_id, texto, operador_id, registrado_em) values (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), id, texto, pessoa.id, new Date().toISOString())
      gravarUltimoOperador(banco(), pessoa.id)
      return devolver(id)
    },

    async estornarRecebimento(pagamentoId, bruto, quem) {
      const alvo = lerPagamento(pagamentoId)
      if (!alvo) return falha('nao-encontrado', MENSAGENS_FICHA.pagamentoNaoEncontrado)
      if (alvo.tipo !== 'recebimento' || !alvo.recebimento_id) return falha('validacao', MENSAGENS_FICHA.soRecebimento)
      if (cancelada(alvo.ficha_id)) return falha('validacao', MENSAGENS_FICHA.fichaCancelada)
      if (alvo.estornado) return falha('validacao', MENSAGENS_FICHA.jaEstornado)
      const motivo = conferirTexto(bruto, MENSAGENS_FICHA.motivo, MOTIVO_MAXIMO)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      return transacao(banco(), () => {
        // Outra máquina pode ter estornado durante o PIN.
        if (lerPagamento(pagamentoId)!.estornado) return falha('validacao', MENSAGENS_FICHA.jaEstornado)
        const agora = new Date().toISOString()
        const caixa = banco().prepare(`select c.id from caixa c
          where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id)`).get() as { id: string } | undefined
        // O "Receber" inteiro: todas as linhas dele que ainda contam.
        const linhas = banco().prepare(`select p.id from pagamento p where p.recebimento_id = ?
          and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)`).all(alvo.recebimento_id) as { id: string }[]
        const estorna = banco().prepare(`insert into pagamento_estorno (id, pagamento_id, motivo, dia, caixa_id, operador_id, registrado_em)
          values (?, ?, ?, ?, ?, ?, ?)`)
        const visto = banco().prepare('insert into conferencia_estorno (estorno_id, operador_id, registrado_em) values (?, ?, ?)')
        for (const l of linhas) {
          const estorno = crypto.randomUUID()
          estorna.run(estorno, l.id, motivo, hojeEmSaoPaulo(), caixa?.id ?? null, pessoa.id, agora)
          // O da dona já nasce conferido (`R-CORRECAO-03`).
          if (pessoa.admin) visto.run(estorno, pessoa.id, agora)
        }
        gravarUltimoOperador(banco(), pessoa.id)
        return devolver(alvo.ficha_id)
      })
    },

    async conferirEstorno(pagamentoId, dona) {
      const alvo = lerPagamento(pagamentoId)
      if (!alvo) return falha('nao-encontrado', MENSAGENS_FICHA.pagamentoNaoEncontrado)
      if (!alvo.estornado) return falha('validacao', MENSAGENS_FICHA.naoEstornado)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      // Todas as linhas estornadas do mesmo recebimento; a linha antiga sem recebimento, sozinha.
      banco().prepare(`insert into conferencia_estorno (estorno_id, operador_id, registrado_em)
        select e.id, ?, ? from pagamento_estorno e join pagamento p on p.id = e.pagamento_id
        where p.id = ? or (p.recebimento_id is not null and p.recebimento_id = ?)
        on conflict do nothing`).run(pessoa.id, new Date().toISOString(), alvo.id, alvo.recebimento_id)
      return devolver(alvo.ficha_id)
    },
  }
}
