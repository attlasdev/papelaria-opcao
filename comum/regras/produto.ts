/**
 * As regras do cadastro de produto (Memoria.md, "Estoque", `R-ESTOQUE-*`), uma
 * vez só para o mock e o SQLite, e para a tela apontar o campo errado antes de
 * mandar. Funções puras.
 */
import { falha, type ConteudoProduto, type DadosProduto, type Falha, type UnidadeProduto } from '../contrato'

/** O motivo do movimento que a quantidade do cadastro vira (`R-ESTOQUE-01`). */
export const MOTIVO_SALDO_INICIAL = 'Saldo inicial do cadastro'

export const MENSAGENS_PRODUTO = {
  descricao: 'Informe o nome do produto.',
  descricaoLonga: 'Nome longo demais (até 200 letras).',
  categoria: 'Escolha ou crie uma categoria.',
  unidade: 'Escolha a unidade de venda.',
  preco: 'Informe um preço de venda maior que zero.',
  custo: 'Confira o custo informado.',
  minimo: 'Informe um estoque mínimo válido.',
  saldo: 'Informe uma quantidade válida.',
  ncm: 'O NCM tem 8 números.',
  cest: 'O CEST tem 7 números.',
  conteudo: 'Confira como o produto vem embalado.',
  codigoRepetido: (codigo: string) => `Este código já está cadastrado em ${codigo}.`,
  semAssinatura: 'Informe quem está fazendo.',
  naoEncontrado: 'Produto não encontrado.',
  comHistorico: 'Este produto já tem histórico: desative em vez de excluir.',
}

export type CampoProduto = 'descricao' | 'categoria' | 'unidade' | 'preco' | 'custo' | 'minimo' | 'ncm' | 'cest' | 'conteudo'

/** "EST-0031": o número que o banco deu, como a loja lê. */
export const codigoProduto = (numero: number) => `EST-${String(numero).padStart(4, '0')}`

const UNIDADES: readonly UnidadeProduto[] = ['un', 'pct', 'cx']

/**
 * Texto de cadastro: sem espaços nas pontas nem repetidos, e sem os caracteres
 * invisíveis que vêm colados de site de fornecedor. Vazio vira `null`.
 */
export function textoDoCadastro(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.replace(/[​-‍⁠﻿]/g, '').trim().replace(/\s+/g, ' ')
  return limpo || null
}

const digitos = (valor: unknown) => (typeof valor === 'string' ? valor.replace(/\D/g, '') : '') || null
const inteiro = (valor: unknown, minimo: number) => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo
const inteiroOuNulo = (valor: unknown, minimo: number) => valor === null || valor === undefined || inteiro(valor, minimo)

function conteudoLimpo(valor: unknown): ConteudoProduto | null | undefined {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== 'object') return undefined
  const { embalagem, pacotes, unidades } = valor as Record<string, unknown>
  if ((embalagem !== 'cx' && embalagem !== 'pct') || !inteiroOuNulo(pacotes, 1) || !inteiroOuNulo(unidades, 1)) return undefined
  return { embalagem, pacotes: (pacotes as number | null | undefined) ?? null, unidades: (unidades as number | null | undefined) ?? null }
}

/**
 * Do que chegou pela IPC para o dado guardado: textos limpos, NCM e CEST só com
 * números. Os erros saem por campo, na ordem da tela; o primeiro é o que o
 * back devolve.
 */
export function conferirProduto(bruto: unknown): { dados: DadosProduto; erros: Partial<Record<CampoProduto, string>> } {
  const b = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
  const erros: Partial<Record<CampoProduto, string>> = {}
  const descricao = textoDoCadastro(b.descricao)
  const categoria = textoDoCadastro(b.categoria)
  const conteudo = conteudoLimpo(b.conteudo)
  const ncm = digitos(b.ncm)
  const cest = digitos(b.cest)
  if (!descricao) erros.descricao = MENSAGENS_PRODUTO.descricao
  else if (descricao.length > 200) erros.descricao = MENSAGENS_PRODUTO.descricaoLonga
  if (!categoria) erros.categoria = MENSAGENS_PRODUTO.categoria
  if (!UNIDADES.includes(b.unidade as UnidadeProduto)) erros.unidade = MENSAGENS_PRODUTO.unidade
  if (!inteiro(b.preco, 1)) erros.preco = MENSAGENS_PRODUTO.preco
  if (!inteiroOuNulo(b.custo, 0)) erros.custo = MENSAGENS_PRODUTO.custo
  if (!inteiro(b.minimo, 0)) erros.minimo = MENSAGENS_PRODUTO.minimo
  if (ncm && ncm.length !== 8) erros.ncm = MENSAGENS_PRODUTO.ncm
  if (cest && cest.length !== 7) erros.cest = MENSAGENS_PRODUTO.cest
  if (conteudo === undefined) erros.conteudo = MENSAGENS_PRODUTO.conteudo
  const dados: DadosProduto = {
    codigoBarras: textoDoCadastro(b.codigoBarras)?.replace(/\s/g, '') ?? null,
    descricao: descricao ?? '',
    categoria: categoria ?? '',
    unidade: b.unidade as UnidadeProduto,
    preco: b.preco as number,
    custo: (b.custo as number | null | undefined) ?? null,
    minimo: b.minimo as number,
    localizacao: textoDoCadastro(b.localizacao),
    marca: textoDoCadastro(b.marca),
    caracteristicas: textoDoCadastro(b.caracteristicas),
    descricaoAdicional: textoDoCadastro(b.descricaoAdicional),
    conteudo: conteudo ?? null,
    ncm,
    cest,
  }
  return { dados, erros }
}

/** O mesmo, no formato do back: o dado limpo, ou a falha do primeiro campo. */
export function produtoValido(bruto: unknown): DadosProduto | Falha {
  const { dados, erros } = conferirProduto(bruto)
  const primeiro = Object.values(erros)[0]
  return primeiro ? falha('validacao', primeiro) : dados
}

export const saldoInicialValido = (saldo: unknown): Falha | null =>
  inteiro(saldo, 0) ? null : falha('validacao', MENSAGENS_PRODUTO.saldo)

/**
 * Mesma categoria com outra caixa ou sem acento é a já existente: não duplica o
 * filtro do Estoque.
 */
export function categoriaCanonica(digitada: string, existentes: readonly string[]) {
  return existentes.find((c) => c.localeCompare(digitada, 'pt-BR', { sensitivity: 'base' }) === 0) ?? digitada
}

export const ordenarCategorias = (categorias: Iterable<string>) =>
  [...new Set(categorias)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
