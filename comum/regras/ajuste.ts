/**
 * As regras do ajuste de estoque (Memoria.md, "Estoque", `R-ESTOQUE-10`, e
 * `R-OPERADOR-06`), uma vez só para o mock e o SQLite. Funções puras; o saldo de
 * agora e o produto ativo cada lado confere.
 */
import { falha, type Ajuste, type Falha } from '../contrato'
import { textoDoCadastro } from './produto'

export const MENSAGENS_AJUSTE = {
  contagem: 'Informe uma contagem inteira e não negativa.',
  igual: 'A nova contagem é igual ao saldo atual.',
  motivo: 'Informe o motivo do ajuste.',
  mudou: (agora: number) => `O saldo mudou desde que você abriu (agora: ${agora}). Confira a contagem.`,
}

const inteiro = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

/** Do que chegou pela IPC para o ajuste limpo, ou a falha. */
export function conferirAjuste(bruto: unknown): Ajuste | Falha {
  const b = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
  if (typeof b.produtoId !== 'string' || !b.produtoId) return falha('nao-encontrado', 'Produto não encontrado.')
  if (!inteiro(b.contagem)) return falha('validacao', MENSAGENS_AJUSTE.contagem)
  if (!inteiro(b.saldoVisto)) return falha('validacao', 'Pedido inválido.')
  const motivo = textoDoCadastro(b.motivo)
  if (!motivo) return falha('validacao', MENSAGENS_AJUSTE.motivo)
  return { produtoId: b.produtoId, contagem: b.contagem as number, saldoVisto: b.saldoVisto as number, motivo }
}

/**
 * Com o saldo de agora: mudou desde que a tela abriu (`R-ESTOQUE-10`), ou a
 * contagem não muda nada.
 */
export function conferirSaldo(ajuste: Ajuste, saldoAgora: number): Falha | null {
  if (saldoAgora !== ajuste.saldoVisto) return falha('conflito', MENSAGENS_AJUSTE.mudou(saldoAgora))
  if (ajuste.contagem === saldoAgora) return falha('validacao', MENSAGENS_AJUSTE.igual)
  return null
}
