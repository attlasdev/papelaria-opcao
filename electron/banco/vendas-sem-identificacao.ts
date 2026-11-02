/**
 * As vendas sem identificação no banco da 1.0 (tela 5.3; `R-CLIENTE-07`, `08`).
 * As regras estão em `comum/regras/sem-identificacao.ts`, as mesmas do mock;
 * aqui fica a leitura do período pelo dia da venda (`ficha.dia`).
 */
import { ok, type Contrato, type VendaSemIdentificacao } from '../../comum/contrato'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { numeroFicha } from '../../comum/regras/movimentos'
import { conferirPedidoDeVendas, paginaDeVendas, type VendaDaLista } from '../../comum/regras/sem-identificacao'
import type { Banco } from './banco'

type OperacoesSemIdentificacao = Pick<Contrato, 'listarVendasSemIdentificacao'>

export function vendasSemIdentificacaoSqlite(banco: () => Banco): OperacoesSemIdentificacao {
  return {
    async listarVendasSemIdentificacao(bruto, meio, pagina, porPagina) {
      const periodo = conferirPedidoDeVendas(bruto, meio, pagina, porPagina, hojeEmSaoPaulo())
      if (periodo && 'ok' in periodo) return periodo
      // Sem período, do primeiro dia possível até hoje.
      const [de, ate] = periodo ? [periodo.de, periodo.ate] : ['0000-01-01', '9999-12-31']
      const doPeriodo = `from ficha f where f.cliente_id is null and f.forma <> 'notinha' and f.dia between ? and ?`
      const fichas = banco().prepare(`
        select f.id, f.numero, f.registrado_em, f.total, f.forma,
               exists (select 1 from ficha_cancelamento c where c.ficha_id = f.id) as cancelada,
               (select p.rotulo from pagamento p where p.ficha_id = f.id and p.tipo = 'venda' order by p.rowid limit 1) as rotulo
        ${doPeriodo}`).all(de, ate) as {
          id: string; numero: number; registrado_em: string; total: number; forma: VendaSemIdentificacao['forma']; cancelada: number; rotulo: string | null
        }[]
      const itens = banco().prepare(`select i.ficha_id, i.descricao, i.quantidade from ficha_item i
        where i.ficha_id in (select f.id ${doPeriodo}) order by i.rowid`).all(de, ate) as { ficha_id: string; descricao: string; quantidade: number }[]
      const servicos = banco().prepare(`select s.ficha_id, s.nome from ficha_servico s
        where s.ficha_id in (select f.id ${doPeriodo}) order by s.rowid`).all(de, ate) as { ficha_id: string; nome: string }[]
      const pagamentos = banco().prepare(`select p.ficha_id, p.meio, p.valor from pagamento p
        where p.ficha_id in (select f.id ${doPeriodo})
        and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id) order by p.rowid`).all(de, ate) as
        { ficha_id: string; meio: VendaDaLista['pagamentos'][number]['meio']; valor: number }[]
      const vendas = fichas.map((f): VendaDaLista => ({
        id: f.id, numero: numeroFicha(f.numero), registradoEm: f.registrado_em, total: f.total, forma: f.forma,
        rotulo: f.forma === 'misto' ? null : f.rotulo, cancelada: f.cancelada === 1,
        itens: itens.filter((i) => i.ficha_id === f.id).map((i) => ({ descricao: i.descricao, quantidade: i.quantidade })),
        servicos: servicos.filter((s) => s.ficha_id === f.id).map((s) => s.nome),
        pagamentos: pagamentos.filter((p) => p.ficha_id === f.id).map((p) => ({ meio: p.meio, valor: p.valor })),
      }))
      return ok(paginaDeVendas(vendas, meio, pagina, porPagina))
    },
  }
}
