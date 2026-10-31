/**
 * As regras do receber notinhas (Memoria.md, "Clientes" e "Notinha";
 * `R-CLIENTE-06`, `R-NOTINHA-03`, `05`, `06`), uma vez só para o mock e o
 * SQLite. Funções puras: cada lado lê as notinhas abertas e grava as linhas.
 */
import { falha, type Falha, type MeioPagamento, type ModalidadeCartao, type NotinhaAberta, type Recebimento } from '../contrato'
import { diaValido } from './entrada'
import { rotuloPagamento } from './venda'

export const MENSAGENS_RECEBIMENTO = {
  pedido: 'Pedido inválido.',
  semNotinha: 'Marque ao menos uma notinha.',
  valor: 'Informe o valor a pagar agora.',
  meioRepetido: 'Cada forma de pagamento entra uma vez.',
  cartao: 'Informe se o cartão é crédito ou débito.',
  data: 'Informe a data do pagamento.',
  futuro: 'A data do pagamento não pode ser depois de hoje.',
  dinheiroHoje: 'Em dinheiro, a data do pagamento é hoje.',
  antesDaVenda: (dia: string) => `A data do pagamento é anterior à notinha (${dia.split('-').reverse().join('/')}).`,
  naoAberta: 'Uma das notinhas marcadas não está mais em aberto. Abra a janela de novo.',
  outroCliente: 'As notinhas marcadas são de clientes diferentes.',
  acima: (total: string) => `O valor passa do total em aberto (${total}).`,
  entregue: 'O dinheiro entregue não cobre o valor a pagar.',
  naoEncontrada: 'Notinha não encontrada.',
}

const MEIOS: MeioPagamento[] = ['dinheiro', 'pix', 'cartao']
const MODALIDADES: ModalidadeCartao[] = ['credito', 'debito']
const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const inteiro = (v: unknown, minimo = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= minimo
const objeto = (v: unknown) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** Do que chegou pela IPC para o recebimento limpo, ou a falha. `hoje`: o dia de São Paulo. */
export function conferirRecebimento(bruto: unknown, hoje: string): Recebimento | Falha {
  const r = objeto(bruto)
  if (!r || !Array.isArray(r.notinhas) || !Array.isArray(r.parcelas) || r.notinhas.length > 200) return falha('validacao', MENSAGENS_RECEBIMENTO.pedido)
  if (r.notinhas.some((id) => typeof id !== 'string' || !id) || new Set(r.notinhas).size !== r.notinhas.length) return falha('validacao', MENSAGENS_RECEBIMENTO.pedido)
  if (r.notinhas.length === 0) return falha('validacao', MENSAGENS_RECEBIMENTO.semNotinha)
  const parcelas = r.parcelas.map(objeto)
  if (parcelas.some((p) => !p || !MEIOS.includes(p.meio as MeioPagamento) || !inteiro(p.valor))) return falha('validacao', MENSAGENS_RECEBIMENTO.pedido)
  // Parcela com zero é meio que a pessoa não usou.
  const usadas = parcelas.filter((p) => (p!.valor as number) > 0).map((p) => ({ meio: p!.meio as MeioPagamento, valor: p!.valor as number }))
  if (usadas.length === 0) return falha('validacao', MENSAGENS_RECEBIMENTO.valor)
  if (new Set(usadas.map((p) => p.meio)).size !== usadas.length) return falha('validacao', MENSAGENS_RECEBIMENTO.meioRepetido)
  const noCartao = usadas.some((p) => p.meio === 'cartao')
  if (noCartao && !MODALIDADES.includes(r.cartao as ModalidadeCartao)) return falha('validacao', MENSAGENS_RECEBIMENTO.cartao)
  if (r.recebido !== null && r.recebido !== undefined && !inteiro(r.recebido)) return falha('validacao', MENSAGENS_RECEBIMENTO.pedido)
  if (!diaValido(r.dia)) return falha('validacao', MENSAGENS_RECEBIMENTO.data)
  if (r.dia > hoje) return falha('validacao', MENSAGENS_RECEBIMENTO.futuro)
  const especie = usadas.find((p) => p.meio === 'dinheiro')?.valor ?? 0
  if (especie > 0 && r.dia !== hoje) return falha('validacao', MENSAGENS_RECEBIMENTO.dinheiroHoje)
  const recebido = especie > 0 ? (r.recebido as number | null | undefined) ?? null : null
  if (recebido !== null && recebido < especie) return falha('validacao', MENSAGENS_RECEBIMENTO.entregue)
  return {
    notinhas: r.notinhas as string[], dia: r.dia, parcelas: usadas,
    cartao: noCartao ? r.cartao as ModalidadeCartao : null, recebido,
  }
}

/** Uma linha de pagamento pronta para gravar, já na notinha certa. */
export type LinhaRecebimento = {
  fichaId: string
  meio: MeioPagamento
  valor: number
  recebido: number | null
  troco: number | null
  cartao: ModalidadeCartao | null
  maquininha: 'sicoob' | null
  rotulo: string | null
}

export type RecebimentoMontado = {
  clienteId: string
  abatimentos: { fichaId: string; numero: string; valor: number; quitada: boolean }[]
  linhas: LinhaRecebimento[]
}

/**
 * Com as notinhas abertas de agora (de qualquer cliente, por id): confere que
 * as marcadas estão abertas e são do mesmo cliente, que o valor cabe e que a
 * data não é antes da venda. Abate da mais antiga para a mais nova e reparte
 * os meios na ordem em que vieram (`R-NOTINHA-03`).
 */
export function montarRecebimento(r: Recebimento, abertas: Map<string, NotinhaAberta & { clienteId: string }>): RecebimentoMontado | Falha {
  const marcadas = r.notinhas.map((id) => abertas.get(id))
  if (marcadas.some((n) => !n)) return falha('validacao', MENSAGENS_RECEBIMENTO.naoAberta)
  const notinhas = (marcadas as (NotinhaAberta & { clienteId: string })[])
    .sort((a, b) => a.dia.localeCompare(b.dia) || Number(a.numero) - Number(b.numero))
  if (new Set(notinhas.map((n) => n.clienteId)).size !== 1) return falha('validacao', MENSAGENS_RECEBIMENTO.outroCliente)
  const valor = r.parcelas.reduce((t, p) => t + p.valor, 0)
  const emAberto = notinhas.reduce((t, n) => t + n.emAberto, 0)
  if (valor > emAberto) return falha('validacao', MENSAGENS_RECEBIMENTO.acima(real.format(emAberto / 100)))

  let resto = valor
  const abatimentos = notinhas.flatMap((n) => {
    const abatido = Math.min(resto, n.emAberto)
    resto -= abatido
    return abatido > 0 ? [{ fichaId: n.id, numero: n.numero, valor: abatido, quitada: abatido === n.emAberto }] : []
  })
  // O pagamento não pode ser antes da venda de nenhuma notinha que ele abate.
  const maisNova = notinhas.filter((n) => abatimentos.some((a) => a.fichaId === n.id)).map((n) => n.dia).sort().at(-1)!
  if (r.dia < maisNova) return falha('validacao', MENSAGENS_RECEBIMENTO.antesDaVenda(maisNova))

  const porMeio = r.parcelas.map((p) => ({ ...p }))
  const linhas: LinhaRecebimento[] = []
  for (const a of abatimentos) {
    let falta = a.valor
    for (const p of porMeio) {
      const parte = Math.min(falta, p.valor)
      if (parte === 0) continue
      p.valor -= parte
      falta -= parte
      const cartao = p.meio === 'cartao' ? r.cartao : null
      // O cartão no receber é manual, na Sicoob (`R-NOTINHA-06`); o rótulo sai da mesma maquininha gravada.
      const maquininha = cartao ? 'sicoob' as const : null
      linhas.push({
        fichaId: a.fichaId, meio: p.meio, valor: parte, recebido: null, troco: null, cartao, maquininha,
        rotulo: rotuloPagamento({ meio: p.meio, cartao: cartao ?? undefined, maquininha: maquininha ?? undefined }) ?? null,
      })
    }
  }
  // O troco vai na primeira linha em dinheiro: é ali que a nota do cliente entrou.
  const especie = r.parcelas.find((p) => p.meio === 'dinheiro')?.valor ?? 0
  const primeira = linhas.find((l) => l.meio === 'dinheiro')
  if (primeira && r.recebido !== null) {
    primeira.troco = r.recebido - especie
    primeira.recebido = primeira.valor + primeira.troco
  }
  return { clienteId: notinhas[0].clienteId, abatimentos, linhas }
}
