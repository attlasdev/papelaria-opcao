/**
 * As regras do caixa (Memoria.md, "Caixa"; `R-CAIXA-02` a `10`), uma vez só
 * para o mock e o SQLite. Funções puras: cada lado lê o caixa e os movimentos
 * em dinheiro dele e entrega aqui; o esperado sai daqui, nos dois.
 */
import {
  falha, type CaixaDetalhe, type CaixaResumido, type Falha, type MovimentoCaixa, type MovimentoGaveta, type PaginaCaixas, type TipoMovimentoCaixa,
} from '../contrato'
import { diaValido } from './entrada'
import { paginaQueExiste, POR_PAGINA_MAXIMO } from './produto'

export const MENSAGENS_CAIXA = {
  valor: 'Informe quanto você contou na gaveta.',
  valorMovimento: 'Informe um valor maior que zero.',
  motivo: 'Informe a origem, o destino ou o motivo.',
  jaAberto: 'Já existe um caixa aberto. Feche-o antes de abrir outro.',
  semAberto: 'Não há caixa aberto. Abra o caixa antes.',
  justificativa: 'Informe o motivo da diferença para fechar o caixa.',
  naoEncontrado: 'Caixa não encontrado.',
  naoFechado: 'Este caixa ainda está aberto.',
  semDiferenca: 'Este fechamento não tem diferença: não precisa de visto.',
  periodo: 'Período inválido.',
  futuro: 'O período não pode passar de hoje.',
  pagina: 'Pedido de página inválido.',
}

/** Dinheiro contado: inteiro em centavos, zero ou mais. */
export const valorContado = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

/** O texto do movimento, igual nos dois lados (o detalhe do caixa e o Financeiro leem assim). */
export function descricaoMovimento(tipo: TipoMovimentoCaixa, numero: string | null, texto: string | null) {
  switch (tipo) {
    case 'venda': return `Venda da ficha #${numero}`
    case 'servico': return `Serviço da ficha #${numero}`
    case 'entrada': return `Entrada da notinha #${numero}`
    case 'recebimento': return `Recebimento da notinha #${numero}`
    case 'estorno-recebimento': return `Estorno do recebimento da notinha #${numero}`
    case 'cancelamento': return `Cancelamento da ficha #${numero}`
    case 'lancamento': return texto ?? 'Lançamento'
    case 'estorno-lancamento': return `Estorno: ${texto ?? 'lançamento'}`
    case 'adicao': return 'Dinheiro adicionado'
    case 'retirada': return 'Dinheiro retirado'
    case 'estorno-gaveta': return 'Estorno de adição ou retirada'
  }
}

/** O movimento como cada lado lê: sem o texto, que sai daqui. `texto`: a descrição do lançamento. */
export type MovimentoLido = Omit<MovimentoCaixa, 'descricao'> & { texto: string | null }

/**
 * O caixa com o resumo (`R-CAIXA-02`, `03`): entradas e saídas em dinheiro e o
 * esperado na gaveta. Fechado, o esperado é o gravado no fechamento: os dias
 * fechados não se recalculam.
 */
export function detalheDoCaixa(caixa: CaixaResumido, lidos: MovimentoLido[]): CaixaDetalhe {
  const movimentos = [...lidos]
    .sort((a, b) => a.registradoEm.localeCompare(b.registradoEm) || a.id.localeCompare(b.id))
    .map(({ texto, ...m }) => ({ ...m, descricao: descricaoMovimento(m.tipo, m.ficha?.numero ?? null, texto) }))
  const entradas = movimentos.filter((m) => m.valor > 0).reduce((t, m) => t + m.valor, 0)
  const saidas = movimentos.filter((m) => m.valor < 0).reduce((t, m) => t - m.valor, 0)
  const esperado = caixa.fechamento ? caixa.fechamento.esperado : caixa.dinheiroAbertura + entradas - saidas
  return { ...caixa, resumo: { entradas, saidas, esperado }, movimentos }
}

/** Fechamento com diferença sem o visto da dona (`R-CAIXA-10`). */
export const aguardandoDona = (c: CaixaResumido) => Boolean(c.fechamento && c.fechamento.diferenca !== 0 && !c.fechamento.conferidoPor)

const diaEmSaoPaulo = (instante: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instante))

/** O período pedido, ou a falha. `hoje`: o dia de São Paulo. */
export function conferirPeriodoCaixa(bruto: unknown, hoje: string): { de: string; ate: string } | Falha {
  const p = typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : null
  if (!p || !diaValido(p.de) || !diaValido(p.ate) || p.de > p.ate) return falha('validacao', MENSAGENS_CAIXA.periodo)
  if (p.ate > hoje) return falha('validacao', MENSAGENS_CAIXA.futuro)
  return { de: p.de, ate: p.ate }
}

export function conferirPagina(pagina: unknown, porPagina: unknown): Falha | null {
  const inteiro = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1
  return inteiro(pagina) && inteiro(porPagina) && (porPagina as number) <= POR_PAGINA_MAXIMO ? null : falha('validacao', MENSAGENS_CAIXA.pagina)
}

/**
 * Os caixas do período: o fechado pelo dia do fechamento, o aberto pelo da
 * abertura, em São Paulo, do mais novo ao mais velho (`R-CAIXA-07`, `08`).
 */
export function paginaDeCaixas(caixas: CaixaResumido[], periodo: { de: string; ate: string }, soFechados: boolean, pagina: number, porPagina: number): PaginaCaixas {
  const marco = (c: CaixaResumido) => c.fechamento?.registradoEm ?? c.abertoEm
  const achados = caixas
    .filter((c) => (!soFechados || c.fechamento) && diaEmSaoPaulo(marco(c)) >= periodo.de && diaEmSaoPaulo(marco(c)) <= periodo.ate)
    .sort((a, b) => marco(b).localeCompare(marco(a)))
  const atual = paginaQueExiste(pagina, achados.length, porPagina)
  return { caixas: achados.slice((atual - 1) * porPagina, atual * porPagina), total: achados.length, pagina: atual }
}

/** As adições e retiradas do período, pelo dia do lançamento em São Paulo, do mais novo ao mais velho. */
export function paginaDeGaveta(movimentos: MovimentoGaveta[], periodo: { de: string; ate: string }, pagina: number, porPagina: number) {
  const achados = movimentos
    .filter((m) => diaEmSaoPaulo(m.registradoEm) >= periodo.de && diaEmSaoPaulo(m.registradoEm) <= periodo.ate)
    .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || b.id.localeCompare(a.id))
  const atual = paginaQueExiste(pagina, achados.length, porPagina)
  return { movimentos: achados.slice((atual - 1) * porPagina, atual * porPagina), total: achados.length, pagina: atual }
}
