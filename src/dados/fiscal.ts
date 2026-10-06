import type { FiscalCliente, FiscalProduto } from '../mock/base/tipos'

/**
 * Regras de FORMATO dos dados fiscais, as que a Emitte confere na importação
 * (`docs/materiais-recebidos/emitte/Resumo_Integracao_Emitte.md`, seções 6 a 8). O CONTEÚDO — qual NCM,
 * qual CFOP — é decisão do contador; o app não tenta adivinhar.
 *
 * Piloto 0.1: os campos já existem no cadastro, sem exportação ainda.
 */

/** O que a nota leva quando o produto não tem dados fiscais: Simples Nacional, venda dentro e fora do estado. */
export const FISCAL_PRODUTO_PADRAO: FiscalProduto = {
  tributacao: 'simples',
  origem: '0',
  cfopEstadual: '5102',
  cfopInterestadual: '6102',
}

export const FISCAL_CLIENTE_PADRAO: FiscalCliente = {
  tipoContribuinte: 'nao-contribuinte',
  tipoCliente: 'consumidor',
}

export const ORIGENS = [
  { valor: '0', rotulo: '0 · Nacional' },
  { valor: '1', rotulo: '1 · Estrangeira, importação direta' },
  { valor: '2', rotulo: '2 · Estrangeira, mercado interno' },
  { valor: '3', rotulo: '3 · Nacional, mais de 40% importado' },
  { valor: '4', rotulo: '4 · Nacional, processo produtivo básico' },
  { valor: '5', rotulo: '5 · Nacional, até 40% importado' },
  { valor: '6', rotulo: '6 · Estrangeira direta, sem similar' },
  { valor: '7', rotulo: '7 · Estrangeira interna, sem similar' },
  { valor: '8', rotulo: '8 · Nacional, mais de 70% importado' },
]

export const TRIBUTACOES = [
  { valor: 'simples', rotulo: 'Simples Nacional (CSOSN 102)' },
  { valor: 'substituicao', rotulo: 'Substituição tributária (CSOSN 500)' },
]

export const TIPOS_CONTRIBUINTE = [
  { valor: 'nao-contribuinte', rotulo: 'Não contribuinte' },
  { valor: 'contribuinte', rotulo: 'Contribuinte (tem inscrição estadual)' },
  { valor: 'isento', rotulo: 'Isento de inscrição estadual' },
]

export const TIPOS_CLIENTE = [
  { valor: 'consumidor', rotulo: 'Consumidor' },
  { valor: 'revenda', rotulo: 'Revenda' },
]

const digitos = (texto: string) => texto.replace(/\D/g, '')

/**
 * Código de barras GTIN (EAN-8, UPC-12, EAN-13, GTIN-14) com dígito verificador
 * certo. A Emitte recusa o produto com dígito errado; código interno da loja que
 * não é GTIN vai para a nota como "SEM GTIN", sem bloquear o cadastro.
 */
export function gtinValido(codigo: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(codigo)) return false
  const numeros = [...codigo].map(Number)
  const verificador = numeros.pop()!
  const soma = numeros.reverse().reduce((total, n, i) => total + n * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (soma % 10)) % 10 === verificador
}

export type ErrosFiscalProduto = Partial<Record<'ncm' | 'cest' | 'cfopEstadual' | 'cfopInterestadual', string>>

/** Confere o formato; campo vazio só vale para NCM e CEST, que o contador ainda pode definir. */
export function conferirFiscalProduto(fiscal: FiscalProduto): ErrosFiscalProduto {
  const erros: ErrosFiscalProduto = {}
  if (fiscal.ncm && !/^\d{8}$/.test(fiscal.ncm)) erros.ncm = 'O NCM tem 8 números.'
  if (fiscal.cest && !/^\d{7}$/.test(fiscal.cest)) erros.cest = 'O CEST tem 7 números.'
  if (fiscal.cest && fiscal.tributacao !== 'substituicao') erros.cest = 'O CEST só se usa com substituição tributária.'
  if (!/^5\d{3}$/.test(fiscal.cfopEstadual)) erros.cfopEstadual = 'O CFOP dentro do estado tem 4 números e começa com 5.'
  if (!/^6\d{3}$/.test(fiscal.cfopInterestadual)) erros.cfopInterestadual = 'O CFOP para outro estado tem 4 números e começa com 6.'
  return erros
}

/** Do formulário para o dado guardado: só números onde a nota pede números. */
export function limparFiscalProduto(bruto: Record<keyof FiscalProduto, string>): FiscalProduto {
  return {
    tributacao: bruto.tributacao === 'substituicao' ? 'substituicao' : 'simples',
    origem: /^[0-8]$/.test(bruto.origem) ? bruto.origem : '0',
    cfopEstadual: digitos(bruto.cfopEstadual),
    cfopInterestadual: digitos(bruto.cfopInterestadual),
    ncm: digitos(bruto.ncm) || undefined,
    cest: digitos(bruto.cest) || undefined,
  }
}

export function conferirCep(cep: string | undefined) {
  return !cep || /^\d{8}$/.test(cep) ? undefined : 'O CEP tem 8 números.'
}

export function limparFiscalCliente(bruto: Record<keyof FiscalCliente, string>): FiscalCliente {
  return {
    tipoContribuinte: bruto.tipoContribuinte === 'contribuinte' || bruto.tipoContribuinte === 'isento' ? bruto.tipoContribuinte : 'nao-contribuinte',
    tipoCliente: bruto.tipoCliente === 'revenda' ? 'revenda' : 'consumidor',
    inscricaoEstadual: digitos(bruto.inscricaoEstadual) || undefined,
    cep: digitos(bruto.cep) || undefined,
    complemento: bruto.complemento.trim() || undefined,
  }
}
