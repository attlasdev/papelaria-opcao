/**
 * A busca do cabeçalho sobre a base da demonstração (1.0, tela 8.3;
 * `R-INICIO-07`). Lado "mock" dos testes de contrato e, até a Fase 3, o que
 * responde no app (`src/dados/api.ts`). As regras são as de
 * `comum/regras/busca.ts`, as mesmas do SQLite.
 */
import { ok, type Contrato } from '../../../comum/contrato'
import { clientesDaBusca, conferirTermo, fichasDaBusca, produtosDaBusca } from '../../../comum/regras/busca'
import { obterBase } from '../estado-demonstracao'
import { paraCliente } from './clientes'
import { paraLista } from './inicio'
import { paraProduto } from './produtos'

export type OperacoesBusca = Pick<Contrato, 'buscar'>

export function criarBuscaDaBase(): OperacoesBusca {
  return {
    async buscar(bruto) {
      const termo = conferirTermo(bruto)
      if (typeof termo !== 'string') return termo
      const base = obterBase()
      const fichas = termo
        ? fichasDaBusca(base.fichas.map(paraLista).map(({ meios: _m, ...f }) => ({
          ...f, ficha: f, cliente: f.cliente?.nome ?? null, itens: f.itens.map((i) => i.descricao),
        })), termo)
        : { itens: [], total: 0 }
      return ok({
        clientes: clientesDaBusca(base.clientes.map(paraCliente), termo),
        fichas: { itens: fichas.itens.map((f) => f.ficha), total: fichas.total },
        produtos: produtosDaBusca(base.produtos.map((p) => paraProduto(base, p)), termo),
      })
    },
  }
}

export const buscaDaBase = criarBuscaDaBase()
