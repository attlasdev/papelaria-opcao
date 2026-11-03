/**
 * A busca do cabeçalho no banco da 1.0 (tela 8.3; `R-INICIO-07`). As regras
 * estão em `comum/regras/busca.ts`, as mesmas do mock: o banco lê, a regra
 * casa. Das fichas lê de todas só o texto em que se procura, e o resto só das
 * 20 primeiras; clientes e produtos são centenas.
 */
import { ok, type ClienteDaBusca, type Contrato, type FormaFicha } from '../../comum/contrato'
import { clientesDaBusca, conferirTermo, fichasDaBusca, produtosDaBusca, type FichaParaBusca } from '../../comum/regras/busca'
import { codigoCliente } from '../../comum/regras/cliente'
import { numeroFicha } from '../../comum/regras/movimentos'
import type { Banco } from './banco'
import { fichasDaLista } from './inicio'
import { paraProduto, SELECT, type Linha } from './produtos'

type OperacoesBusca = Pick<Contrato, 'buscar'>

/** Separa os itens no `group_concat`: não aparece em texto digitado. */
const SEPARADOR = '\u001f'

export function buscaSqlite(banco: () => Banco): OperacoesBusca {
  return {
    async buscar(bruto) {
      const termo = conferirTermo(bruto)
      if (typeof termo !== 'string') return termo
      if (!termo) return ok({ clientes: { itens: [], total: 0 }, fichas: { itens: [], total: 0 }, produtos: { itens: [], total: 0 } })
      const b = banco()
      const clientes = (b.prepare('select id, numero, nome, documento, telefone from cliente').all() as
        { id: string; numero: number; nome: string; documento: string | null; telefone: string | null }[])
        .map((c): ClienteDaBusca => ({ id: c.id, codigo: codigoCliente(c.numero), nome: c.nome, documento: c.documento, telefone: c.telefone }))
      const fichas = (b.prepare(`
        select f.id, f.numero, f.dia, f.registrado_em, f.forma, c.nome as cliente,
               (select group_concat(i.descricao, char(31)) from ficha_item i where i.ficha_id = f.id) as itens,
               (select group_concat(s.nome, char(31)) from ficha_servico s where s.ficha_id = f.id) as servicos
        from ficha f left join cliente c on c.id = f.cliente_id`).all() as {
          id: string; numero: number; dia: string; registrado_em: string; forma: FormaFicha; cliente: string | null; itens: string | null; servicos: string | null
        }[]).map((f): FichaParaBusca & { dia: string; forma: FormaFicha } => ({
        id: f.id, numero: numeroFicha(f.numero), dia: f.dia, registradoEm: f.registrado_em, forma: f.forma, cliente: f.cliente,
        itens: f.itens ? f.itens.split(SEPARADOR) : [], servicos: f.servicos ? f.servicos.split(SEPARADOR) : [],
      }))
      const achadas = fichasDaBusca(fichas, termo)
      const produtos = (b.prepare(SELECT).all() as Linha[]).map(paraProduto)
      return ok({
        clientes: clientesDaBusca(clientes, termo),
        fichas: { itens: fichasDaLista(b, achadas.itens), total: achadas.total },
        produtos: produtosDaBusca(produtos, termo),
      })
    },
  }
}
