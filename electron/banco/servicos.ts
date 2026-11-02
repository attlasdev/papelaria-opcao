/**
 * Os serviços e as perdas no banco da 1.0 (tela 6.2; `R-SERVICO-02`, `03`).
 * As regras estão em `comum/regras/servico.ts`, as mesmas do mock; aqui fica a
 * leitura pelo dia da ficha (`ficha.dia`).
 */
import { ok, type Contrato } from '../../comum/contrato'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { numeroFicha } from '../../comum/regras/movimentos'
import { conferirPeriodoServicos, servicosDoPeriodo, type FichaComServicos } from '../../comum/regras/servico'
import type { Banco } from './banco'

type OperacoesServico = Pick<Contrato, 'listarServicos'>

export function servicosSqlite(banco: () => Banco): OperacoesServico {
  return {
    async listarServicos(bruto) {
      const periodo = conferirPeriodoServicos(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const linhas = banco().prepare(`
        select f.id, f.numero, f.registrado_em, c.nome as cliente,
               exists (select 1 from ficha_cancelamento x where x.ficha_id = f.id) as cancelada,
               exists (select 1 from ficha_item i where i.ficha_id = f.id) as com_produtos,
               s.nome, s.valor, s.perdas, s.observacao
        from ficha_servico s join ficha f on f.id = s.ficha_id left join cliente c on c.id = f.cliente_id
        where f.dia between ? and ? order by s.rowid`).all(periodo.de, periodo.ate) as {
          id: string; numero: number; registrado_em: string; cliente: string | null; cancelada: number; com_produtos: number
          nome: string; valor: number; perdas: number | null; observacao: string | null
        }[]
      const fichas = new Map<string, FichaComServicos>()
      for (const l of linhas) {
        const f = fichas.get(l.id) ?? {
          id: l.id, numero: numeroFicha(l.numero), registradoEm: l.registrado_em, cliente: l.cliente,
          cancelada: l.cancelada === 1, comProdutos: l.com_produtos === 1, servicos: [],
        }
        f.servicos.push({ nome: l.nome, valor: l.valor, perdas: l.perdas, observacao: l.observacao })
        fichas.set(l.id, f)
      }
      return ok(servicosDoPeriodo([...fichas.values()]))
    },
  }
}
