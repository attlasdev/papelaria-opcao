/**
 * Os serviços e as perdas sobre a base da demonstração (1.0, tela 6.2;
 * `R-SERVICO-02`, `03`). Lado "mock" dos testes de contrato e, até a Fase 3, o
 * que responde no app (`src/dados/api.ts`). As regras são as de
 * `comum/regras/servico.ts`, as mesmas do SQLite.
 */
import { ok, type Contrato } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { numeroFicha } from '../../../comum/regras/movimentos'
import { conferirPeriodoServicos, servicosDoPeriodo, type FichaComServicos } from '../../../comum/regras/servico'
import { obterBase } from '../estado-demonstracao'

export type OperacoesServico = Pick<Contrato, 'listarServicos'>

export function criarServicosDaBase(): OperacoesServico {
  return {
    async listarServicos(bruto) {
      const periodo = conferirPeriodoServicos(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const { fichas, clientes } = obterBase()
      const doPeriodo = fichas.flatMap((f): FichaComServicos[] => {
        if (!f.servicos?.length || f.data < periodo.de || f.data > periodo.ate) return []
        return [{
          id: f.id, numero: numeroFicha(f.id), registradoEm: new Date(`${f.data}T${f.horario}:00-03:00`).toISOString(),
          cliente: f.clienteId ? clientes.find((c) => c.id === f.clienteId)?.nome ?? 'Cliente removido' : null,
          cancelada: Boolean(f.cancelamento), comProdutos: f.itens.length > 0,
          servicos: f.servicos.map((s) => ({ nome: s.nome, valor: s.valor, perdas: s.perdas?.quantidade ?? null, observacao: s.observacao ?? null })),
        }]
      })
      return ok(servicosDoPeriodo(doPeriodo))
    },
  }
}

export const servicosDaBase = criarServicosDaBase()
