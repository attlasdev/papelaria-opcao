/**
 * As vendas sem identificação sobre a base da demonstração (1.0, tela 5.3;
 * `R-CLIENTE-07`, `08`). Lado "mock" dos testes de contrato e, até a Fase 3, o
 * que responde no app (`src/dados/api.ts`). As regras são as de
 * `comum/regras/sem-identificacao.ts`, as mesmas do SQLite.
 */
import { ok, type Contrato } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { numeroFicha } from '../../../comum/regras/movimentos'
import { conferirPedidoDeVendas, paginaDeVendas, type VendaDaLista } from '../../../comum/regras/sem-identificacao'
import { obterBase } from '../estado-demonstracao'

export type OperacoesSemIdentificacao = Pick<Contrato, 'listarVendasSemIdentificacao'>

export function criarVendasSemIdentificacaoDaBase(): OperacoesSemIdentificacao {
  return {
    async listarVendasSemIdentificacao(bruto, meio, pagina, porPagina) {
      const periodo = conferirPedidoDeVendas(bruto, meio, pagina, porPagina, hojeEmSaoPaulo())
      if (periodo && 'ok' in periodo) return periodo
      const vendas = obterBase().fichas.flatMap((f): VendaDaLista[] => {
        if (f.clienteId !== null || f.forma === 'notinha') return []
        if (periodo && (f.data < periodo.de || f.data > periodo.ate)) return []
        return [{
          id: f.id, numero: numeroFicha(f.id), registradoEm: new Date(`${f.data}T${f.horario}:00-03:00`).toISOString(),
          total: f.total, forma: f.forma, rotulo: f.forma === 'misto' ? null : f.pagamentos[0]?.rotulo ?? null,
          cancelada: Boolean(f.cancelamento),
          itens: f.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade })),
          servicos: (f.servicos ?? []).map((s) => s.nome),
          pagamentos: f.pagamentos.filter((p) => !p.estorno).map((p) => ({ meio: p.meio, valor: p.valor })),
        }]
      })
      return ok(paginaDeVendas(vendas, meio, pagina, porPagina))
    },
  }
}

export const vendasSemIdentificacaoDaBase = criarVendasSemIdentificacaoDaBase()
