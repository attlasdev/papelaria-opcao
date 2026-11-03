/**
 * O Início no banco da 1.0 (tela 8.1; `R-INICIO-01` a `06`). As regras estão
 * em `comum/regras/inicio.ts`, as mesmas do mock. O histórico lê de toda ficha
 * só o que filtra e ordena, e o resto só da página: são milhares. O que
 * aguarda a dona é o fato sem a linha de conferência correspondente
 * (migrations 0003 a 0007).
 */
import { ok, type Contrato, type FichaDaLista, type MeioPagamento } from '../../comum/contrato'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { linhasDoPeriodo } from '../../comum/regras/financeiro'
import { conferirPedidoDeFichas, listaAguardandoDona, paginaDeFichas, resumoDoDia, type FichaLeve, type PendenciaLida } from '../../comum/regras/inicio'
import { numeroFicha } from '../../comum/regras/movimentos'
import type { Banco } from './banco'
import { todasAsLinhas } from './financeiro'

type OperacoesInicio = Pick<Contrato, 'obterResumoDoDia' | 'listarFichas' | 'listarAguardandoDona'>

const CANCELADA = 'exists (select 1 from ficha_cancelamento x where x.ficha_id = f.id)'

/** As fichas como a lista mostra, na ordem de `leves`: o resto lido só delas. */
export function fichasDaLista(b: Banco, leves: Pick<FichaLeve, 'id' | 'numero' | 'dia' | 'registradoEm' | 'forma'>[]): FichaDaLista[] {
  const ids = leves.map((f) => f.id)
  const lugares = ids.map(() => '?').join(', ') || 'null'
  const detalhes = b.prepare(`
    select f.id, f.total, f.cliente_id, c.nome, ${CANCELADA} as cancelada,
           (select p.rotulo from pagamento p where p.ficha_id = f.id and p.tipo = 'venda' order by p.rowid limit 1) as rotulo
    from ficha f left join cliente c on c.id = f.cliente_id where f.id in (${lugares})`).all(...ids) as {
      id: string; total: number; cliente_id: string | null; nome: string | null; cancelada: number; rotulo: string | null
    }[]
  const itens = b.prepare(`select i.ficha_id, i.descricao, i.quantidade from ficha_item i where i.ficha_id in (${lugares}) order by i.rowid`)
    .all(...ids) as { ficha_id: string; descricao: string; quantidade: number }[]
  const servicos = b.prepare(`select s.ficha_id, s.nome from ficha_servico s where s.ficha_id in (${lugares}) order by s.rowid`)
    .all(...ids) as { ficha_id: string; nome: string }[]
  return leves.map((f): FichaDaLista => {
    const d = detalhes.find((x) => x.id === f.id)!
    return {
      id: f.id, numero: f.numero, dia: f.dia, registradoEm: f.registradoEm, forma: f.forma, total: d.total,
      cliente: d.cliente_id ? { id: d.cliente_id, nome: d.nome! } : null,
      rotulo: f.forma === 'misto' || f.forma === 'notinha' ? null : d.rotulo, cancelada: d.cancelada === 1,
      itens: itens.filter((i) => i.ficha_id === f.id).map((i) => ({ descricao: i.descricao, quantidade: i.quantidade })),
      servicos: servicos.filter((s) => s.ficha_id === f.id).map((s) => s.nome),
    }
  })
}

export function inicioSqlite(banco: () => Banco): OperacoesInicio {
  return {
    async obterResumoDoDia() {
      const hoje = hojeEmSaoPaulo()
      const fichas = banco().prepare(`select f.total, ${CANCELADA} as cancelada from ficha f where f.dia = ?`).all(hoje) as { total: number; cancelada: number }[]
      return ok(resumoDoDia(hoje, linhasDoPeriodo(todasAsLinhas(banco()), { de: hoje, ate: hoje }), fichas.map((f) => ({ total: f.total, cancelada: f.cancelada === 1 }))))
    },

    async listarFichas(bruto, pagina, porPagina) {
      const filtro = conferirPedidoDeFichas(bruto, pagina, porPagina, hojeEmSaoPaulo())
      if ('ok' in filtro) return filtro
      const leves = (banco().prepare(`
        select f.id, f.numero, f.dia, f.registrado_em, f.forma,
               (select group_concat(distinct p.meio) from pagamento p where p.ficha_id = f.id) as meios
        from ficha f ${filtro.dia ? 'where f.dia = ?' : ''}`).all(...(filtro.dia ? [filtro.dia] : [])) as {
          id: string; numero: number; dia: string; registrado_em: string; forma: FichaLeve['forma']; meios: string | null
        }[]).map((f): FichaLeve => ({
        id: f.id, numero: numeroFicha(f.numero), dia: f.dia, registradoEm: f.registrado_em, forma: f.forma,
        meios: (f.meios ? f.meios.split(',') : []) as MeioPagamento[],
      }))
      const r = paginaDeFichas(leves, filtro, pagina as number, porPagina as number)
      return ok({ total: r.total, pagina: r.pagina, fichas: fichasDaLista(banco(), r.fichas) })
    },

    async listarAguardandoDona() {
      const b = banco()
      const ajustes = (b.prepare(`
        select m.id, m.registrado_em, o.nome as operador, p.descricao from movimento_estoque m
        join produto p on p.id = m.produto_id join operador o on o.id = m.operador_id
        where m.tipo = 'ajuste' and not exists (select 1 from conferencia_ajuste c where c.movimento_id = m.id)`).all() as
        { id: string; registrado_em: string; operador: string; descricao: string }[])
        .map((l): PendenciaLida => ({ tipo: 'ajuste', id: l.id, registradoEm: l.registrado_em, operador: l.operador, produto: l.descricao }))
      const cancelamentos = (b.prepare(`
        select f.id, f.numero, x.registrado_em, o.nome as operador from ficha_cancelamento x
        join ficha f on f.id = x.ficha_id join operador o on o.id = x.operador_id
        where not exists (select 1 from conferencia_cancelamento c where c.cancelamento_id = x.id)`).all() as
        { id: string; numero: number; registrado_em: string; operador: string }[])
        .map((l): PendenciaLida => ({ tipo: 'cancelamento', id: l.id, registradoEm: l.registrado_em, operador: l.operador, numero: numeroFicha(l.numero) }))
      const estornos = (b.prepare(`
        select p.recebimento_id, f.id as ficha_id, f.numero, e.registrado_em, o.nome as operador from pagamento_estorno e
        join pagamento p on p.id = e.pagamento_id join ficha f on f.id = p.ficha_id join operador o on o.id = e.operador_id
        where not exists (select 1 from conferencia_estorno c where c.estorno_id = e.id)`).all() as
        { recebimento_id: string; ficha_id: string; numero: number; registrado_em: string; operador: string }[])
        .map((l): PendenciaLida => ({
          tipo: 'estorno-recebimento', id: l.recebimento_id, registradoEm: l.registrado_em, operador: l.operador,
          ficha: { id: l.ficha_id, numero: numeroFicha(l.numero) },
        }))
      const fechamentos = (b.prepare(`
        select x.caixa_id, x.registrado_em, o.nome as operador from caixa_fechamento x join operador o on o.id = x.operador_id
        where x.contado <> x.esperado and not exists (select 1 from conferencia_fechamento c where c.fechamento_id = x.id)`).all() as
        { caixa_id: string; registrado_em: string; operador: string }[])
        .map((l): PendenciaLida => ({ tipo: 'fechamento', id: l.caixa_id, registradoEm: l.registrado_em, operador: l.operador }))
      const lancamentos = (b.prepare(`
        select e.id, e.registrado_em, e.dia, o.nome as operador, l.descricao from lancamento e
        join lancamento l on l.id = e.estorno_de join operador o on o.id = e.operador_id
        where not exists (select 1 from conferencia_lancamento c where c.estorno_id = e.id)`).all() as
        { id: string; registrado_em: string; dia: string; operador: string; descricao: string }[])
        .map((l): PendenciaLida => ({ tipo: 'estorno-lancamento', id: l.id, registradoEm: l.registrado_em, operador: l.operador, descricao: l.descricao, dia: l.dia }))
      return ok(listaAguardandoDona([...ajustes, ...cancelamentos, ...estornos, ...fechamentos, ...lancamentos]))
    },
  }
}
