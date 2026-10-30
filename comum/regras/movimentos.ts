/**
 * As regras da lista de movimentos do estoque (tela 2.6), uma vez só para o
 * mock e o SQLite. Funções puras.
 */
import { falha, type Falha, type FiltroMovimentos } from '../contrato'
import { POR_PAGINA_MAXIMO } from './produto'

const TIPOS = ['todas', 'entrada', 'ajuste', 'venda'] as const

/** O pedido que chegou pela IPC: filtro conhecido e números inteiros. */
export function conferirPedidoDeMovimentos(filtro: unknown, pagina: unknown, porPagina: unknown): FiltroMovimentos | Falha {
  const f = (typeof filtro === 'object' && filtro !== null ? filtro : {}) as Record<string, unknown>
  const inteiro = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1
  if (!TIPOS.includes(f.tipo as (typeof TIPOS)[number]) || typeof f.aguardando !== 'boolean'
    || (f.produtoId !== null && (typeof f.produtoId !== 'string' || !f.produtoId))) return falha('validacao', 'Pedido inválido.')
  if (!inteiro(pagina) || !inteiro(porPagina) || (porPagina as number) > POR_PAGINA_MAXIMO) return falha('validacao', 'Pedido de página inválido.')
  return { produtoId: f.produtoId as string | null, tipo: f.tipo as FiltroMovimentos['tipo'], aguardando: f.aguardando }
}

/** O número da ficha como a loja lê ("1043"). */
export const numeroFicha = (numero: number | string) => String(numero).padStart(4, '0')
