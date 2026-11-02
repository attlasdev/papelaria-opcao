/**
 * As regras dos boletos da loja (Memoria.md, "Boletos"; `R-BOLETO-01` a `06`),
 * uma vez só para o mock e o SQLite. Funções puras: cada lado lê os boletos
 * que não foram excluídos, com o pagamento de agora, e entrega aqui.
 */
import { falha, type Boleto, type DadosBoleto, type Falha, type FiltroBoletos, type GrupoBoletos, type ListaBoletos, type SituacaoBoleto } from '../contrato'
import { diaValido } from './entrada'
import { paraBusca } from './produto'

/** Os boletos que vencem em até tantos dias pedem atenção (`R-BOLETO-05`). */
export const DIAS_AVISO_BOLETO = 5

export const MENSAGENS_BOLETO = {
  descricao: 'Informe a descrição do boleto.',
  valor: 'Informe o valor do boleto.',
  numero: 'Informe o número do boleto.',
  vencimento: 'Informe o vencimento.',
  naoEncontrado: 'Boleto não encontrado.',
  jaPago: 'Este boleto já está marcado como pago.',
  naoPago: 'Este boleto não está marcado como pago.',
  motivo: 'Informe o motivo.',
  filtro: 'Pedido inválido.',
}

const texto = (v: unknown, maximo: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, maximo) : '')

/** Do que chegou pela IPC para o boleto limpo, ou a falha do primeiro campo errado. */
export function conferirDadosBoleto(bruto: unknown): DadosBoleto | Falha {
  const b = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
  const descricao = texto(b.descricao, 120)
  if (!descricao) return falha('validacao', MENSAGENS_BOLETO.descricao)
  if (typeof b.valor !== 'number' || !Number.isSafeInteger(b.valor) || b.valor <= 0) return falha('validacao', MENSAGENS_BOLETO.valor)
  const numero = texto(b.numero, 30)
  if (!numero) return falha('validacao', MENSAGENS_BOLETO.numero)
  if (!diaValido(b.vencimento)) return falha('validacao', MENSAGENS_BOLETO.vencimento)
  return { descricao, valor: b.valor, numero, vencimento: b.vencimento }
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)

/** O boleto como cada lado lê: os dados, o cadastro e o pagamento que vale agora. */
export type BoletoLido = DadosBoleto & { id: string; cadastradoEm: string; pago: Boleto['pago'] }

export function boletoComSituacao(b: BoletoLido, hoje: string): Boleto {
  const dias = diasEntre(hoje, b.vencimento)
  const situacao: SituacaoBoleto = b.pago ? 'pago' : dias < 0 ? 'vencido' : dias <= DIAS_AVISO_BOLETO ? 'vencendo' : 'a-vencer'
  return { ...b, situacao, dias }
}

/**
 * A lista da tela: o filtro e a busca escolhem as linhas; os cartões e as
 * contagens das abas são de todos. Em aberto primeiro, pelo vencimento; pagos
 * depois, do pago mais recente (`R-BOLETO-06`).
 */
export function listaDeBoletos(lidos: BoletoLido[], filtro: FiltroBoletos, busca: string, hoje: string): ListaBoletos {
  const todos = lidos.map((b) => boletoComSituacao(b, hoje))
    .sort((a, b) => Number(Boolean(a.pago)) - Number(Boolean(b.pago))
      || (a.pago && b.pago ? b.pago.dia.localeCompare(a.pago.dia) : a.vencimento.localeCompare(b.vencimento))
      || a.numero.localeCompare(b.numero))
  const grupo = (lista: Boleto[]): GrupoBoletos => ({ quantidade: lista.length, valor: lista.reduce((t, b) => t + b.valor, 0) })
  const abertos = todos.filter((b) => !b.pago)
  const vencidos = abertos.filter((b) => b.situacao === 'vencido')
  const termo = paraBusca(busca.trim())
  const naAba = (b: Boleto) => filtro === 'todos' || (filtro === 'a-pagar' ? !b.pago : filtro === 'pagos' ? Boolean(b.pago) : b.situacao === 'vencido')
  return {
    boletos: todos.filter((b) => naAba(b) && (!termo || paraBusca(`${b.numero} ${b.descricao}`).includes(termo))),
    resumo: { vencidos: grupo(vencidos), vencendo: grupo(abertos.filter((b) => b.situacao === 'vencendo')), aPagar: grupo(abertos) },
    contagem: { 'a-pagar': abertos.length, vencidos: vencidos.length, pagos: todos.length - abertos.length, todos: todos.length },
  }
}

const FILTROS: FiltroBoletos[] = ['a-pagar', 'vencidos', 'pagos', 'todos']

export function conferirPedidoDeBoletos(filtro: unknown, busca: unknown): Falha | null {
  return FILTROS.includes(filtro as FiltroBoletos) && typeof busca === 'string' ? null : falha('validacao', MENSAGENS_BOLETO.filtro)
}
