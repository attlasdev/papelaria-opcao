/**
 * O histórico do estoque no banco da 1.0 (tela 2.6). Junta o movimento com o
 * que explica cada um: a entrega, a ficha e o motivo do cancelamento, e o visto
 * da dona no ajuste (`conferencia_ajuste`). Paginado aqui: são milhares.
 */
import { ok, type Contrato, type MovimentoEstoque } from '../../comum/contrato'
import { conferirPedidoDeMovimentos, numeroFicha } from '../../comum/regras/movimentos'
import { codigoProduto } from '../../comum/regras/produto'
import type { Banco } from './banco'

type OperacoesMovimento = Pick<Contrato, 'listarMovimentosEstoque'>

type Linha = {
  id: string; registrado_em: string; tipo: MovimentoEstoque['tipo']; produto_id: string; numero: number; descricao: string
  saldo_antes: number; saldo_depois: number; motivo: string | null; operador: string
  entrada_id: string | null; recebida_em: string | null; fornecedor: string | null; referencia: string | null; observacoes: string | null
  custo_unitario: number | null; ficha_id: string | null; ficha_numero: number | null
  conferido_por: string | null; conferido_em: string | null
}

const DE = `
  from movimento_estoque m
  join produto p on p.id = m.produto_id
  join operador o on o.id = m.operador_id
  left join entrada_mercadoria e on e.id = m.entrada_id
  left join ficha f on f.id = m.ficha_id
  left join ficha_cancelamento fc on fc.ficha_id = m.ficha_id and m.tipo = 'cancelamento'
  left join conferencia_ajuste c on c.movimento_id = m.id
  left join operador d on d.id = c.operador_id`

const AGUARDANDO = "(m.tipo = 'ajuste' and c.movimento_id is null)"

const paraMovimento = (l: Linha): MovimentoEstoque => ({
  id: l.id,
  registradoEm: l.registrado_em,
  tipo: l.tipo,
  produto: { id: l.produto_id, codigo: codigoProduto(l.numero), descricao: l.descricao },
  saldoAntes: l.saldo_antes,
  saldoDepois: l.saldo_depois,
  motivo: l.motivo,
  operador: l.operador,
  entrada: l.entrada_id
    ? { recebidaEm: l.recebida_em!, fornecedor: l.fornecedor, referencia: l.referencia, observacoes: l.observacoes, custoUnitario: l.custo_unitario }
    : null,
  ficha: l.ficha_id ? { id: l.ficha_id, numero: numeroFicha(l.ficha_numero!) } : null,
  aguardandoConferencia: l.tipo === 'ajuste' && !l.conferido_em,
  conferencia: l.conferido_em ? { por: l.conferido_por!, em: l.conferido_em } : null,
})

export function movimentosSqlite(banco: () => Banco): OperacoesMovimento {
  return {
    async listarMovimentosEstoque(bruto, pagina, porPagina) {
      const filtro = conferirPedidoDeMovimentos(bruto, pagina, porPagina)
      if ('ok' in filtro) return filtro
      const doProduto = filtro.produtoId ? 'm.produto_id = ?' : '1'
      const valores = filtro.produtoId ? [filtro.produtoId] : []
      const condicoes = [doProduto]
      if (filtro.tipo !== 'todas') condicoes.push(`m.tipo = '${filtro.tipo}'`)
      if (filtro.aguardando) condicoes.push(AGUARDANDO)
      const onde = `where ${condicoes.join(' and ')}`

      const { total } = banco().prepare(`select count(*) as total ${DE} ${onde}`).get(...valores) as { total: number }
      const { aguardando } = banco().prepare(`select count(*) as aguardando ${DE} where ${doProduto} and ${AGUARDANDO}`).get(...valores) as { aguardando: number }
      const linhas = banco().prepare(`
        select m.id, m.registrado_em, m.tipo, m.produto_id, p.numero, p.descricao, m.saldo_antes, m.saldo_depois,
               case when m.tipo = 'cancelamento' then fc.motivo else m.motivo end as motivo, o.nome as operador,
               m.entrada_id, e.recebida_em, e.fornecedor, e.referencia, e.observacoes, m.custo_unitario,
               f.id as ficha_id, f.numero as ficha_numero, d.nome as conferido_por, c.registrado_em as conferido_em
        ${DE} ${onde}
        order by m.registrado_em desc, m.rowid desc
        limit ? offset ?`).all(...valores, porPagina, (pagina - 1) * porPagina) as Linha[]
      return ok({ movimentos: linhas.map(paraMovimento), total, aguardando })
    },
  }
}
