/**
 * As regras do Financeiro (Memoria.md, "Financeiro"; `R-FINANCEIRO-02` a
 * `07`, `R-SERVICO-04`, `R-BOLETO-04`), uma vez só para o mock e o SQLite.
 * Funções puras: cada lado lê os pagamentos das fichas e os lançamentos
 * manuais (sem a gaveta, que é do Caixa) e entrega aqui; o texto, a categoria e
 * o lado de cada linha saem daqui, nos dois.
 */
import {
  falha, type DadosLancamento, type Falha, type FiltroFinanceiro, type LinhaFinanceira, type MeioPagamento, type PaginaFinanceiro, type ResumoFinanceiro,
} from '../contrato'
import { paginaQueExiste } from './produto'

export const MENSAGENS_FINANCEIRO = {
  descricao: 'Informe a descrição do movimento.',
  valor: 'Informe um valor maior que zero.',
  pedido: 'Pedido inválido.',
  naoEncontrado: 'Lançamento não encontrado.',
  jaEstornado: 'Este lançamento já foi estornado.',
  ehEstorno: 'Estorno não se estorna.',
  motivo: 'Informe o motivo do estorno.',
  naoEhEstorno: 'Só o estorno de lançamento se confere.',
}

export const CATEGORIA_ESTORNO = 'Estorno'
const MEIOS: MeioPagamento[] = ['dinheiro', 'pix', 'cartao']
const FILTROS: FiltroFinanceiro[] = ['todos', ...MEIOS, 'estornos']

/** O que chegou pela IPC para o lançamento limpo, ou a falha. */
export function conferirLancamento(bruto: unknown): DadosLancamento | Falha {
  const b = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
  if ((b.tipo !== 'entrada' && b.tipo !== 'despesa') || !MEIOS.includes(b.meio as MeioPagamento)) return falha('validacao', MENSAGENS_FINANCEIRO.pedido)
  const descricao = typeof b.descricao === 'string' ? b.descricao.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
  if (!descricao) return falha('validacao', MENSAGENS_FINANCEIRO.descricao)
  if (typeof b.valor !== 'number' || !Number.isSafeInteger(b.valor) || b.valor <= 0) return falha('validacao', MENSAGENS_FINANCEIRO.valor)
  return { tipo: b.tipo, meio: b.meio as MeioPagamento, descricao, valor: b.valor }
}

export const conferirFiltroFinanceiro = (filtro: unknown): Falha | null => (FILTROS.includes(filtro as FiltroFinanceiro) ? null : falha('validacao', MENSAGENS_FINANCEIRO.pedido))

/** Um pagamento de ficha como cada lado lê, e o que o desfez, se algo desfez. */
export type PagamentoLido = {
  id: string
  dia: string
  registradoEm: string
  tipo: 'venda' | 'entrada' | 'recebimento'
  ficha: { id: string; numero: string; forma: string; temItens: boolean; temServicos: boolean }
  cliente: string | null
  meio: MeioPagamento
  rotulo: string | null
  valor: number
  operador: string
  /** `estorno`: o recebimento estornado; senão, o cancelamento da ficha. */
  desfeito: { estorno: boolean; dia: string; registradoEm: string; motivo: string; operador: string } | null
}

/** Um lançamento manual como cada lado lê (valor com sinal), e o estorno dele. */
export type LancamentoLido = {
  id: string
  dia: string
  registradoEm: string
  tipo: 'entrada' | 'despesa'
  descricao: string
  origem: string
  meio: MeioPagamento
  valor: number
  operador: string
  estorno: { id: string; dia: string; registradoEm: string; motivo: string; operador: string; conferidoPor: string | null } | null
}

/** Serviço paga ISS e produto ICMS: o contador precisa separar (`R-SERVICO-04`). */
function categoriaDaFicha(f: PagamentoLido['ficha']) {
  if (f.forma === 'notinha') return 'Recebimento de notinha'
  if (!f.temServicos) return 'Venda'
  return f.temItens ? 'Venda e serviço' : 'Serviço'
}

/** O estorno abate do próprio lado: desfazer venda reduz entradas; desfazer despesa, saídas (`R-FINANCEIRO-03`). */
const lado = (categoria: string, valor: number): LinhaFinanceira['lado'] =>
  (categoria === CATEGORIA_ESTORNO ? valor < 0 : valor > 0) ? 'entrada' : 'saida'

const NAO_IDENTIFICADO = 'Não identificado'

/** As linhas: o pagamento (e a linha do estorno ou do cancelamento) e o lançamento (e o estorno dele). */
export function linhasFinanceiras(pagamentos: PagamentoLido[], lancamentos: LancamentoLido[]): LinhaFinanceira[] {
  const daFicha = pagamentos.flatMap((p): LinhaFinanceira[] => {
    const categoria = categoriaDaFicha(p.ficha)
    const cliente = p.cliente ?? NAO_IDENTIFICADO
    const n = p.ficha.numero
    const descricao = p.ficha.forma !== 'notinha' ? `${categoria === 'Serviço' ? 'Serviço' : 'Venda'} da ficha #${n}`
      : p.tipo === 'entrada' ? `Entrada da notinha #${n}` : `Recebimento da notinha #${n}`
    const original: LinhaFinanceira = {
      id: p.id, dia: p.dia, registradoEm: p.registradoEm, descricao, origem: `Balcão · ${cliente}`, categoria, meio: p.meio, rotulo: p.rotulo,
      valor: p.valor, lado: lado(categoria, p.valor), operador: p.operador, ficha: { id: p.ficha.id, numero: n }, cliente,
      estornoDe: null, estornado: Boolean(p.desfeito), vendaEstornavel: p.ficha.forma !== 'notinha' && !p.desfeito,
      lancamentoEstornavel: false, conferidoPor: null, aguardandoDona: false,
    }
    if (!p.desfeito) return [original]
    const d = p.desfeito
    return [original, {
      ...original, id: `${p.id}-estorno`, dia: d.dia, registradoEm: d.registradoEm,
      descricao: d.estorno ? `Estorno do recebimento da notinha #${n}` : `Cancelamento da ficha #${n}`,
      origem: `${cliente} · ${d.motivo}`, categoria: CATEGORIA_ESTORNO, valor: -p.valor, lado: lado(CATEGORIA_ESTORNO, -p.valor),
      operador: d.operador, estornoDe: p.id, estornado: false, vendaEstornavel: false,
    }]
  })
  const manuais = lancamentos.flatMap((l): LinhaFinanceira[] => {
    const categoria = l.tipo === 'entrada' ? 'Recebimento avulso' : 'Despesa'
    const original: LinhaFinanceira = {
      id: l.id, dia: l.dia, registradoEm: l.registradoEm, descricao: l.descricao, origem: l.origem, categoria, meio: l.meio, rotulo: null,
      valor: l.valor, lado: lado(categoria, l.valor), operador: l.operador, ficha: null, cliente: null, estornoDe: null,
      estornado: Boolean(l.estorno), vendaEstornavel: false, lancamentoEstornavel: !l.estorno, conferidoPor: null, aguardandoDona: false,
    }
    if (!l.estorno) return [original]
    const e = l.estorno
    return [original, {
      ...original, id: e.id, dia: e.dia, registradoEm: e.registradoEm, descricao: `Estorno: ${l.descricao}`, origem: e.motivo,
      categoria: CATEGORIA_ESTORNO, valor: -l.valor, lado: lado(CATEGORIA_ESTORNO, -l.valor), operador: e.operador, estornoDe: l.id,
      estornado: false, lancamentoEstornavel: false, conferidoPor: e.conferidoPor, aguardandoDona: !e.conferidoPor,
    }]
  })
  return [...daFicha, ...manuais]
}

/** As linhas do período, da mais nova para a mais velha. */
export function linhasDoPeriodo(linhas: LinhaFinanceira[], periodo: { de: string; ate: string }) {
  return linhas.filter((l) => l.dia >= periodo.de && l.dia <= periodo.ate)
    .sort((a, b) => b.dia.localeCompare(a.dia) || b.registradoEm.localeCompare(a.registradoEm) || b.id.localeCompare(a.id))
}

/** Os cartões e as contagens do período inteiro (`R-FINANCEIRO-04`). */
export function resumoFinanceiro(doPeriodo: LinhaFinanceira[]): ResumoFinanceiro {
  const entradas = doPeriodo.filter((l) => l.lado === 'entrada').reduce((t, l) => t + l.valor, 0)
  const saidas = doPeriodo.filter((l) => l.lado === 'saida').reduce((t, l) => t - l.valor, 0)
  return {
    entradas, saidas, liquido: entradas - saidas,
    quantidadeSaidas: doPeriodo.filter((l) => l.valor < 0 && l.categoria !== CATEGORIA_ESTORNO).length,
    contagem: {
      todos: doPeriodo.length,
      dinheiro: doPeriodo.filter((l) => l.meio === 'dinheiro').length,
      pix: doPeriodo.filter((l) => l.meio === 'pix').length,
      cartao: doPeriodo.filter((l) => l.meio === 'cartao').length,
      estornos: doPeriodo.filter((l) => l.categoria === CATEGORIA_ESTORNO).length,
    },
  }
}

export function paginaFinanceiro(doPeriodo: LinhaFinanceira[], filtro: FiltroFinanceiro, pagina: number, porPagina: number): PaginaFinanceiro {
  const achadas = filtro === 'todos' ? doPeriodo : filtro === 'estornos' ? doPeriodo.filter((l) => l.categoria === CATEGORIA_ESTORNO) : doPeriodo.filter((l) => l.meio === filtro)
  const atual = paginaQueExiste(pagina, achadas.length, porPagina)
  return { linhas: achadas.slice((atual - 1) * porPagina, atual * porPagina), total: achadas.length, pagina: atual, resumo: resumoFinanceiro(doPeriodo) }
}
