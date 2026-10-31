import type { SituacaoCompra } from '../../comum/contrato'
import type { Tom } from '../componentes/selo/Selo'
import { dataCurta } from '../formatar'

/** O selo da compra, no detalhe do cliente e no detalhe da ficha. */
export const SELO_COMPRA: Record<SituacaoCompra, { tom: Tom; titulo: string }> = {
  paga: { tom: 'ok', titulo: 'Pago' },
  'a-vencer': { tom: 'atencao', titulo: 'Pendente' },
  'em-atraso': { tom: 'critico', titulo: 'Vencido' },
  cancelada: { tom: 'neutro', titulo: 'Cancelada' },
}

/** Dias de `de` até `ate`, os dois `AAAA-MM-DD`. */
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)

/** A segunda linha do selo: o prazo da notinha, ou o dia em que quitou ou cancelou. */
export function detalheDaSituacao(
  c: { situacao: SituacaoCompra; vencimento: string | null; quitadaEm: string | null; canceladaEm: string | null },
  hoje: string,
) {
  if (c.situacao === 'cancelada') return c.canceladaEm ? `Em ${dataCurta(c.canceladaEm)}` : undefined
  if (c.situacao === 'paga') return c.quitadaEm ? `Quitada em ${dataCurta(c.quitadaEm)}` : undefined
  const dias = diasEntre(hoje, c.vencimento ?? hoje)
  if (dias === 0) return 'Vence hoje'
  if (dias > 0) return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`
}
