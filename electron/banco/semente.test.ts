import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBanco, type Banco } from './banco'
import { semearBanco } from './semente'

const HOJE = '2026-10-27'

let banco: Banco

beforeEach(() => {
  banco = abrirBanco(':memory:')
  semearBanco(banco, { hoje: HOJE })
})

afterEach(() => banco.close())

const todos = <T>(sql: string) => banco.prepare(sql).all() as T[]
const contar = (sql: string) => (banco.prepare(`select count(*) as n from (${sql})`).get() as { n: number }).n

describe('semente', () => {
  it('é determinística: o mesmo dia dá a mesma base', () => {
    const outro = abrirBanco(':memory:')
    semearBanco(outro, { hoje: HOJE })
    const resumo = (b: Banco) => b.prepare('select (select count(*) from ficha) f, (select sum(total) from ficha) t, (select group_concat(id) from produto) p').get()
    expect(resumo(outro)).toEqual(resumo(banco))
    outro.close()
  })

  it('o saldo de cada produto é a soma dos seus movimentos', () => {
    expect(contar(`
      select p.id from produto p
      where p.saldo <> (select coalesce(sum(quantidade), 0) from movimento_estoque m where m.produto_id = p.id)`)).toBe(0)
  })

  it('só o caixa de hoje fica aberto; todo fechado conta o esperado de verdade', () => {
    expect(contar('select id from caixa c where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id)')).toBe(1)
    expect(contar('select id from caixa_fechamento where esperado < 0')).toBe(0)
    expect(contar('select id from caixa_fechamento where contado <> esperado')).toBe(2)
  })

  it('pagamento à vista fecha o total da ficha; notinha nunca recebe mais que o total', () => {
    const pago = `(select coalesce(sum(p.valor), 0) from pagamento p where p.ficha_id = f.id
                   and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id))`
    expect(contar(`select f.id from ficha f where f.forma <> 'notinha' and ${pago} <> f.total`)).toBe(0)
    expect(contar(`select f.id from ficha f where f.forma = 'notinha' and ${pago} > f.total`)).toBe(0)
  })

  it('nada acontece depois de agora', () => {
    const cedo = abrirBanco(':memory:')
    semearBanco(cedo, { hoje: HOJE, minutoAtual: 9 * 60 })
    const limite = new Date(`${HOJE}T09:00:00-03:00`).toISOString()
    for (const tabela of ['ficha', 'pagamento', 'movimento_estoque', 'lancamento', 'cobranca']) {
      const coluna = tabela === 'cobranca' ? 'criada_em' : 'registrado_em'
      expect((cedo.prepare(`select max(${coluna}) m from ${tabela}`).get() as { m: string }).m <= limite).toBe(true)
    }
    expect(cedo.prepare(`select count(*) n from pagamento where meio = 'cartao' and maquininha is null`).get()).toEqual({ n: 0 })
    cedo.close()
  })
})

describe('patologias da semente', () => {
  it('produto desativado com histórico, e produto só com o saldo inicial', () => {
    expect(contar(`select p.id from produto p where p.ativo = 0 and (select count(*) from movimento_estoque m where m.produto_id = p.id) > 1`)).toBe(1)
    const [engano] = todos<{ id: string; descricao: string }>(`
      select p.id, p.descricao from produto p where (select count(*) from movimento_estoque m where m.produto_id = p.id) = 1`)
    expect(engano.descricao).toContain('​')
    banco.prepare('delete from produto where id = ?').run(engano.id)
  })

  it('ficha cancelada devolve ao estoque o que baixou', () => {
    const [cancelada] = todos<{ ficha_id: string }>('select ficha_id from ficha_cancelamento')
    const baixa = banco.prepare(`select sum(quantidade) s from movimento_estoque where ficha_id = ? and tipo = 'venda'`).get(cancelada.ficha_id) as { s: number }
    const volta = banco.prepare(`select sum(quantidade) s from movimento_estoque where ficha_id = ? and tipo = 'cancelamento'`).get(cancelada.ficha_id) as { s: number }
    expect(volta.s).toBe(-baixa.s)
  })

  it('notinha com entrada, recebimento estornado e parcial: ainda deve', () => {
    const [ficha] = todos<{ id: string; total: number }>(`
      select f.id, f.total from ficha f join pagamento p on p.ficha_id = f.id join pagamento_estorno e on e.pagamento_id = p.id`)
    const pago = banco.prepare(`select sum(valor) s from pagamento p where ficha_id = ?
      and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)`).get(ficha.id) as { s: number }
    expect(pago.s).toBe(5000 + 3000)
    expect(ficha.total).toBeGreaterThan(pago.s)
  })

  it('serviço com perda, venda mista, cobrança recusada e cobrança presa na maquininha', () => {
    expect(contar('select id from ficha_servico where perdas is not null')).toBe(1)
    expect(contar(`select id from ficha where forma = 'misto'`)).toBe(1)
    expect(contar(`select id from cobranca where situacao = 'recusada'`)).toBe(1)
    expect(contar(`select id from cobranca where situacao = 'na-maquininha'`)).toBe(1)
    expect(contar(`select id from cobranca c where situacao = 'aprovada' and not exists (select 1 from pagamento p where p.cobranca_id = c.id)`)).toBe(0)
  })

  it('boletos: vencido, pago e desfeito, excluído, e número de arquivo repetido', () => {
    const situacoes = todos<{ tipo: string | null }>(`
      select (select tipo from boleto_evento e where e.boleto_id = b.id order by rowid desc limit 1) tipo from boleto b`)
    expect(situacoes.map((s) => s.tipo)).toEqual(expect.arrayContaining(['pago', 'pagamento-desfeito', 'excluido', null]))
    expect(contar(`select id from boleto where vencimento < '${HOJE}' and not exists (select 1 from boleto_evento e where e.boleto_id = boleto.id)`)).toBeGreaterThan(0)
    expect(contar('select numero from boleto group by numero having count(*) > 1')).toBeGreaterThan(0)
  })

  it('operador desativado continua citado; nome com espaço que não quebra', () => {
    expect(contar(`select f.id from ficha f join operador o on o.id = f.operador_id where o.ativo = 0`)).toBeGreaterThan(0)
    expect(contar(`select id from cliente where nome like '%' || char(160)`)).toBe(1)
    expect(contar('select id from cliente where documento is null')).toBe(1)
  })

  it('estorno de lançamento e movimento da gaveta nos dois sentidos', () => {
    expect(contar('select id from lancamento where estorno_de is not null')).toBe(1)
    expect(contar(`select distinct tipo from movimento_gaveta`)).toBe(2)
    expect(contar(`select id from movimento_estoque where tipo = 'ajuste'`)).toBe(1)
  })
})
