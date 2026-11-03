/**
 * A busca do cabeçalho (Memoria.md, "Início e sino"; `R-INICIO-07`), uma vez
 * só para o mock e o SQLite. Funções puras: cada lado lê clientes, fichas e
 * produtos, e entrega aqui; o que casa, a ordem e o corte saem daqui, nos dois.
 * Cliente e produto casam pelas funções das listas de Clientes e Estoque.
 */
import { falha, type ClienteDaBusca, type Falha, type GrupoDaBusca, type Produto } from '../contrato'
import { clienteCorresponde } from './cliente'
import { paraBusca, produtoCorresponde } from './produto'

export const POR_GRUPO_BUSCA = 20
export const TERMO_MAXIMO_BUSCA = 100

/** O termo limpo, ou a falha. */
export function conferirTermo(termo: unknown): string | Falha {
  if (typeof termo !== 'string' || termo.length > TERMO_MAXIMO_BUSCA) return falha('validacao', 'Pedido inválido.')
  return termo.trim()
}

/** O que cada lado lê de toda ficha para buscar e ordenar; o resto, só dos 20 primeiros. */
export type FichaParaBusca = { id: string; numero: string; registradoEm: string; cliente: string | null; itens: string[]; servicos: string[] }

/** Ficha: o número (com ou sem `#` e zeros à esquerda), o cliente, um item ou um serviço. */
export function fichaCorresponde(f: FichaParaBusca, termo: string) {
  const t = paraBusca(termo.trim())
  if (!t) return false
  const numero = t.replace(/^#\s*/, '')
  if (/^\d+$/.test(numero) && Number(numero) === Number(f.numero)) return true
  return [f.cliente ?? '', ...f.itens, ...f.servicos].some((texto) => paraBusca(texto).includes(t))
}

const grupo = <T>(achados: T[]): GrupoDaBusca<T> => ({ itens: achados.slice(0, POR_GRUPO_BUSCA), total: achados.length })
const numeroDoCodigo = (codigo: string) => Number(codigo.replace(/\D/g, ''))

/** Clientes por nome. */
export const clientesDaBusca = (clientes: ClienteDaBusca[], termo: string) =>
  grupo(termo ? clientes.filter((c) => clienteCorresponde(c, termo)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.codigo.localeCompare(b.codigo)) : [])

/** Fichas da mais nova para a mais velha, canceladas inclusive. */
export const fichasDaBusca = <F extends FichaParaBusca>(fichas: F[], termo: string) =>
  grupo(fichas.filter((f) => fichaCorresponde(f, termo)).sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || Number(b.numero) - Number(a.numero)))

/** Produtos pelo código, desativados inclusive. */
export const produtosDaBusca = (produtos: Produto[], termo: string) =>
  grupo(termo ? produtos.filter((p) => produtoCorresponde(p, termo)).sort((a, b) => numeroDoCodigo(a.codigo) - numeroDoCodigo(b.codigo)) : [])
