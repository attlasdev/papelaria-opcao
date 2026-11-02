/**
 * Os avisos do sino (Memoria.md, "Início e sino"; `R-INICIO-05`), uma vez só
 * para o mock e o SQLite. Funções puras: cada lado lê as notinhas abertas, os
 * boletos a pagar, os produtos ativos e quantos itens aguardam a dona, e
 * entrega aqui; o texto e a ordem saem daqui, nos dois.
 */
import { falha, type Aviso, type Boleto, type Falha } from '../contrato'
import { situacaoSaldo } from './produto'

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const reais = (centavos: number) => real.format(centavos / 100)
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)

/** Notinha que vence nestes dias entra no sino antes de atrasar. */
export const DIAS_AVISO_NOTINHA = 3

/** Uma notinha que ainda deve, com o cliente. */
export type NotinhaDoAviso = { clienteId: string; cliente: string; vencimento: string; emAberto: number }

export type DadosDosAvisos = {
  notinhas: NotinhaDoAviso[]
  /** Os boletos a pagar, com a situação de hoje. */
  boletos: Boleto[]
  /** Só os produtos ativos. */
  produtos: { descricao: string; saldo: number; minimo: number }[]
  aguardandoDona: number
}

/** "vence hoje", "vence amanhã", "vence em 3 dias", "venceu há 2 dias". */
export function prazoBoleto(dias: number) {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  if (dias > 1) return `vence em ${dias} dias`
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`
}

/**
 * Do mais grave ao menos grave: atrasos (notinhas, depois boletos), produto
 * zerado, o que vence logo (notinhas, depois boletos), estoque baixo e o que
 * aguarda a dona. Clientes pelo nome; produtos pela descrição.
 */
export function avisosDaLoja(d: DadosDosAvisos, hoje: string): Omit<Aviso, 'lido'>[] {
  const atrasos: Omit<Aviso, 'lido'>[] = []
  const vencendo: Omit<Aviso, 'lido'>[] = []
  const porCliente = new Map<string, NotinhaDoAviso[]>()
  for (const n of [...d.notinhas].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR') || a.clienteId.localeCompare(b.clienteId))) {
    porCliente.set(n.clienteId, [...(porCliente.get(n.clienteId) ?? []), n])
  }
  for (const [clienteId, abertas] of porCliente) {
    const nome = abertas[0].cliente
    const soma = (lista: NotinhaDoAviso[]) => reais(lista.reduce((t, n) => t + n.emAberto, 0))
    const atrasadas = abertas.filter((n) => n.vencimento < hoje)
    if (atrasadas.length) {
      atrasos.push({
        id: `atraso-${clienteId}`, tipo: 'atraso', tom: 'critico', titulo: nome,
        detalhe: `${plural(atrasadas.length, 'notinha', 'notinhas')} em atraso · ${soma(atrasadas)}`, destino: { tela: 'cliente', clienteId },
      })
    }
    const proximas = abertas.filter((n) => n.vencimento >= hoje && diasEntre(hoje, n.vencimento) <= DIAS_AVISO_NOTINHA)
    if (proximas.length) {
      const dias = Math.min(...proximas.map((n) => diasEntre(hoje, n.vencimento)))
      vencendo.push({
        id: `vencendo-${clienteId}`, tipo: 'vencendo', tom: 'atencao', titulo: nome,
        detalhe: `${proximas.length === 1 ? 'Notinha' : `${proximas.length} notinhas`} ${dias === 0 ? 'vence hoje' : `vence em ${plural(dias, 'dia', 'dias')}`} · ${soma(proximas)}`,
        destino: { tela: 'cliente', clienteId },
      })
    }
  }

  const abertos = d.boletos.filter((b) => !b.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero.localeCompare(b.numero))
  const descricoes = (lista: Boleto[]) => (lista.length === 1 ? lista[0].descricao : `${lista[0].descricao} e mais ${lista.length - 1}`)
  const total = (lista: Boleto[]) => reais(lista.reduce((t, b) => t + b.valor, 0))
  const vencidos = abertos.filter((b) => b.situacao === 'vencido')
  const aVencer = abertos.filter((b) => b.situacao === 'vencendo')
  if (vencidos.length) {
    atrasos.push({
      id: 'boleto-vencido', tipo: 'boleto-vencido', tom: 'critico', titulo: plural(vencidos.length, 'boleto vencido', 'boletos vencidos'),
      detalhe: `${descricoes(vencidos)} · ${total(vencidos)}`, destino: { tela: 'boletos' },
    })
  }
  if (aVencer.length) {
    const prazo = prazoBoleto(aVencer[0].dias)
    vencendo.push({
      id: 'boleto-vencendo', tipo: 'boleto-vencendo', tom: 'atencao',
      titulo: aVencer.length === 1 ? '1 boleto vence em breve' : `${aVencer.length} boletos vencem em breve`,
      detalhe: `${descricoes(aVencer)} · ${aVencer.length === 1 ? prazo : `o primeiro ${prazo}`} · ${total(aVencer)}`, destino: { tela: 'boletos' },
    })
  }

  const produtos = [...d.produtos].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
  const nomes = (lista: typeof produtos) => (lista.length === 1 ? lista[0].descricao : `${lista[0].descricao} e mais ${lista.length - 1}`)
  const zerados = produtos.filter((p) => situacaoSaldo(p.saldo, p.minimo) === 'zerado')
  const baixos = produtos.filter((p) => situacaoSaldo(p.saldo, p.minimo) === 'baixo')
  const estoque: Omit<Aviso, 'lido'>[] = zerados.length ? [{
    id: 'estoque-zerado', tipo: 'estoque-zerado', tom: 'critico',
    titulo: plural(zerados.length, 'produto zerado', 'produtos zerados'), detalhe: nomes(zerados), destino: { tela: 'estoque' },
  }] : []
  const depois: Omit<Aviso, 'lido'>[] = []
  if (baixos.length) {
    depois.push({
      id: 'estoque-baixo', tipo: 'estoque-baixo', tom: 'atencao',
      titulo: plural(baixos.length, 'produto com estoque baixo', 'produtos com estoque baixo'), detalhe: nomes(baixos), destino: { tela: 'estoque' },
    })
  }
  // Um aviso só, com a contagem da faixa do Início: o número no título faz o aviso voltar a ser novo.
  if (d.aguardandoDona) {
    depois.push({
      id: 'aguardando-dona', tipo: 'aguardando-dona', tom: 'atencao',
      titulo: plural(d.aguardandoDona, 'item aguardando a dona', 'itens aguardando a dona'),
      detalhe: 'A dona confere com o PIN dela', destino: { tela: 'aguardando' },
    })
  }
  return [...atrasos, ...estoque, ...vencendo, ...depois]
}

/** O aviso só conta como lido enquanto diz a mesma coisa que foi lida. */
export const assinaturaAviso = (a: Pick<Aviso, 'titulo' | 'detalhe'>) => `${a.titulo}|${a.detalhe}`

export type AvisosLidos = Record<string, string>

export const comLido = (avisos: Omit<Aviso, 'lido'>[], lidos: AvisosLidos): Aviso[] =>
  avisos.map((a) => ({ ...a, lido: lidos[a.id] === assinaturaAviso(a) }))

/** Grava o texto de agora dos avisos pedidos; só os que existem. */
export function marcarLidos(avisos: Omit<Aviso, 'lido'>[], lidos: AvisosLidos, ids: string[]): AvisosLidos {
  const proximos = { ...lidos }
  for (const a of avisos) if (ids.includes(a.id)) proximos[a.id] = assinaturaAviso(a)
  return proximos
}

export function conferirIdsDeAvisos(ids: unknown): string[] | Falha {
  return Array.isArray(ids) && ids.length <= 500 && ids.every((i) => typeof i === 'string') ? ids : falha('validacao', 'Pedido inválido.')
}

/** O que está gravado, lido com desconfiança: arquivo antigo ou mexido vira vazio. */
export function avisosLidosDe(texto: unknown): AvisosLidos {
  try {
    const v = typeof texto === 'string' ? JSON.parse(texto) : texto
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
    return Object.fromEntries(Object.entries(v).filter(([, s]) => typeof s === 'string')) as AvisosLidos
  } catch {
    return {}
  }
}
