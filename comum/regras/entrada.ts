/**
 * As regras da entrada de mercadoria (Memoria.md, "Estoque", `R-ESTOQUE-04` e
 * `09`), uma vez só para o mock e o SQLite. Funções puras; o que existe no
 * banco (produto, ativo) cada lado confere.
 */
import { falha, type Entrega, type Falha } from '../contrato'
import { textoDoCadastro } from './produto'

export const MOTIVO_ENTRADA = 'Recebimento de mercadorias'

export const MENSAGENS_ENTRADA = {
  semItens: 'A entrega precisa de pelo menos um produto.',
  repetido: 'O mesmo produto aparece duas vezes na entrega.',
  quantidade: 'Informe quantas chegaram, um número inteiro maior que zero.',
  custo: 'Confira o custo informado.',
  dia: 'Informe o dia em que a mercadoria chegou.',
  futuro: 'A data de recebimento não pode ser depois de hoje.',
  desativado: (nome: string) => `${nome} está desativado: reative antes de dar entrada.`,
}

/** O dia de hoje na loja ('AAAA-MM-DD', fuso de São Paulo), qualquer que seja o fuso da máquina. */
export const hojeEmSaoPaulo = (agora = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)

export function diaValido(dia: unknown): dia is string {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false
  const [ano, mes, d] = dia.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, d))
  return ano >= 2000 && data.getUTCMonth() === mes - 1 && data.getUTCDate() === d
}

const inteiro = (v: unknown, minimo: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= minimo

/**
 * Do que chegou pela IPC para a entrega limpa, ou a falha. O que só o banco
 * sabe (o produto existe e está ativo) fica para quem chama.
 */
export function conferirEntrega(bruta: unknown): Entrega | Falha {
  const b = (typeof bruta === 'object' && bruta !== null ? bruta : {}) as Record<string, unknown>
  if (!diaValido(b.recebidaEm)) return falha('validacao', MENSAGENS_ENTRADA.dia)
  if (b.recebidaEm > hojeEmSaoPaulo()) return falha('validacao', MENSAGENS_ENTRADA.futuro)
  if (!Array.isArray(b.itens) || b.itens.length === 0) return falha('validacao', MENSAGENS_ENTRADA.semItens)
  const vistos = new Set<string>()
  const itens: Entrega['itens'] = []
  for (const bruto of b.itens as unknown[]) {
    const item = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
    if (typeof item.produtoId !== 'string' || !item.produtoId) return falha('nao-encontrado', 'Produto não encontrado.')
    if (vistos.has(item.produtoId)) return falha('validacao', MENSAGENS_ENTRADA.repetido)
    vistos.add(item.produtoId)
    if (!inteiro(item.quantidade, 1)) return falha('validacao', MENSAGENS_ENTRADA.quantidade)
    const custo = item.custoUnitario ?? null
    if (custo !== null && !inteiro(custo, 0)) return falha('validacao', MENSAGENS_ENTRADA.custo)
    itens.push({ produtoId: item.produtoId, quantidade: item.quantidade as number, custoUnitario: custo as number | null })
  }
  return {
    recebidaEm: b.recebidaEm,
    fornecedor: textoDoCadastro(b.fornecedor),
    referencia: textoDoCadastro(b.referencia),
    observacoes: textoDoCadastro(b.observacoes),
    itens,
  }
}
