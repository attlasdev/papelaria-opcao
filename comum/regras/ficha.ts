/**
 * As regras do detalhe da ficha (Memoria.md, "Ficha"; `R-FICHA-02`, `03`),
 * uma vez só para o mock e o SQLite. Funções puras: cada lado lê a ficha e
 * entrega os pagamentos; a conta da notinha é a de `notinha.ts`.
 */
import { falha, type Falha, type FichaDetalhe, type PagamentoDaFicha } from '../contrato'
import { emAberto, situacaoCompra } from './notinha'

export const MENSAGENS_FICHA = {
  naoEncontrada: 'Ficha não encontrada.',
  jaCancelada: 'Esta ficha já foi cancelada.',
  naoCancelada: 'Esta ficha não está cancelada.',
  motivo: 'Informe o motivo do cancelamento.',
  anotacao: 'Escreva a anotação.',
  longo: (maximo: number) => `Use no máximo ${maximo} caracteres.`,
}

export const MOTIVO_MAXIMO = 300
export const ANOTACAO_MAXIMA = 500

/** Texto do gesto (motivo, anotação): com algo escrito e sem passar do tamanho. */
export function conferirTexto(bruto: unknown, vazio: string, maximo: number): string | Falha {
  const texto = typeof bruto === 'string' ? bruto.trim().replace(/\s+/g, ' ') : ''
  if (!texto) return falha('validacao', vazio)
  if (texto.length > maximo) return falha('validacao', MENSAGENS_FICHA.longo(maximo))
  return texto
}

/**
 * A situação da ficha pelos pagamentos que valem (o estornado não conta):
 * pago, em aberto e o dia em que a notinha quitou.
 */
export function contaDaFicha(
  f: Pick<FichaDetalhe, 'forma' | 'total' | 'vencimento'> & { cancelada: boolean; pagamentos: PagamentoDaFicha[] },
  hoje: string,
): Pick<FichaDetalhe, 'situacao' | 'pago' | 'emAberto' | 'quitadaEm'> {
  const validos = f.pagamentos.filter((p) => !p.estorno)
  const pago = validos.reduce((t, p) => t + p.valor, 0)
  const conta = { forma: f.forma, total: f.total, vencimento: f.vencimento, cancelada: f.cancelada, pago }
  const situacao = situacaoCompra(conta, hoje)
  const ultimo = validos.map((p) => p.dia).sort().at(-1) ?? null
  return { situacao, pago, emAberto: emAberto(conta), quitadaEm: f.forma === 'notinha' && situacao === 'paga' ? ultimo : null }
}
