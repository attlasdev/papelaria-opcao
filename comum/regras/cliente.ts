/**
 * As regras do cadastro de cliente (Memoria.md, "Clientes", `R-CLIENTE-04`,
 * `09` e `10`), uma vez só para o mock e o SQLite, e para a tela apontar o
 * campo errado antes de mandar. Funções puras.
 */
import { falha, type DadosCliente, type Falha } from '../contrato'
import { textoDoCadastro } from './produto'

/** Os 27 estados, pela sigla que o banco guarda e o nome que a tela mostra. */
export const ESTADOS = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'],
  ['SE', 'Sergipe'], ['TO', 'Tocantins'],
] as const

export const MENSAGENS_CLIENTE = {
  nome: 'Informe o nome do cliente.',
  documento: 'CPF ou CNPJ inválido: confira os números.',
  telefone: 'Informe o telefone com DDD (10 ou 11 números).',
  cep: 'O CEP tem 8 números.',
  uf: 'Escolha o estado da lista.',
  repetido: (codigo: string, nome: string) => `Este documento já está cadastrado em ${codigo} · ${nome}. Busque o cliente em vez de cadastrar de novo.`,
  naoEncontrado: 'Cliente não encontrado.',
}

export type CampoCliente = 'nome' | 'documento' | 'telefone' | 'cep' | 'uf'

export const soDigitos = (valor: unknown) => (typeof valor === 'string' ? valor.replace(/\D/g, '') : '') || null

/** Dígito verificador do CPF e do CNPJ: a soma ponderada, módulo 11. */
function digitoVerificador(numeros: number[], pesos: number[]) {
  const resto = numeros.reduce((soma, n, i) => soma + n * pesos[i], 0) % 11
  return resto < 2 ? 0 : 11 - resto
}

/** `R-CLIENTE-09`: 11 dígitos (CPF) ou 14 (CNPJ), com os verificadores certos. */
export function documentoValido(digitos: string) {
  if (!/^(\d{11}|\d{14})$/.test(digitos) || /^(\d)\1+$/.test(digitos)) return false
  const n = [...digitos].map(Number)
  if (n.length === 11) {
    return digitoVerificador(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9]
      && digitoVerificador(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10]
  }
  const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  return digitoVerificador(n.slice(0, 12), pesos.slice(1)) === n[12] && digitoVerificador(n.slice(0, 13), pesos) === n[13]
}

/** "MG" → "Minas Gerais"; sigla desconhecida volta como veio. */
export const nomeDoEstado = (uf: string | null) => ESTADOS.find(([sigla]) => sigla === uf)?.[1] ?? uf ?? ''

/** Os números com a pontuação de sempre: CPF, CNPJ e telefone com DDD. */
export function formatarDocumento(d: string) {
  return d.length === 11
    ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}
export const formatarTelefone = (t: string) => t.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3')

/**
 * A máscara enquanto a pessoa digita: só os números, e a pontuação vai
 * entrando. Até 11 números é CPF (000.000.000-00); de 12 a 14, CNPJ
 * (00.000.000/0000-00). O que passa de 14 é cortado.
 */
export function mascaraDocumento(texto: string) {
  const d = texto.replace(/\D/g, '').slice(0, 14)
  const partes = d.length <= 11
    ? [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)]
    : [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)]
  const juntas = d.length <= 11 ? ['', '.', '.', '-'] : ['', '.', '.', '/', '-']
  return partes.map((p, i) => (p ? juntas[i] + p : '')).join('')
}

/** Telefone com DDD enquanto digita: (00) 0000-0000, ou (00) 00000-0000 com 11 números. */
export function mascaraTelefone(texto: string) {
  const d = texto.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  const corte = d.length === 11 ? 7 : 6
  const meio = d.slice(2, corte)
  const fim = d.slice(corte)
  return `(${d.slice(0, 2)}) ${meio}${fim ? `-${fim}` : ''}`
}

/** "CLI-0104": o número que o banco deu, como a loja lê. */
export const codigoCliente = (numero: number) => `CLI-${String(numero).padStart(4, '0')}`

/**
 * Do que chegou pela IPC para o dado guardado: textos limpos, documento,
 * telefone e CEP só com números, estado em sigla. Os erros saem por campo, na
 * ordem da tela; o primeiro é o que o back devolve.
 */
export function conferirCliente(bruto: unknown): { dados: DadosCliente; erros: Partial<Record<CampoCliente, string>> } {
  const b = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
  const f = (typeof b.fiscal === 'object' && b.fiscal !== null ? b.fiscal : {}) as Record<string, unknown>
  const erros: Partial<Record<CampoCliente, string>> = {}
  const nome = textoDoCadastro(b.nome)
  const documento = soDigitos(b.documento)
  const telefone = soDigitos(b.telefone)
  const cep = soDigitos(b.cep)
  const uf = typeof b.uf === 'string' && b.uf.trim() ? b.uf.trim().toUpperCase() : null
  if (!nome) erros.nome = MENSAGENS_CLIENTE.nome
  if (documento && !documentoValido(documento)) erros.documento = MENSAGENS_CLIENTE.documento
  if (telefone && !/^\d{10,11}$/.test(telefone)) erros.telefone = MENSAGENS_CLIENTE.telefone
  if (cep && cep.length !== 8) erros.cep = MENSAGENS_CLIENTE.cep
  if (uf && !ESTADOS.some(([sigla]) => sigla === uf)) erros.uf = MENSAGENS_CLIENTE.uf
  const contribuinte = ['nao-contribuinte', 'contribuinte', 'isento'].includes(f.tipoContribuinte as string) ? f.tipoContribuinte as DadosCliente['fiscal']['tipoContribuinte'] : null
  const tipo = ['consumidor', 'revenda'].includes(f.tipoCliente as string) ? f.tipoCliente as DadosCliente['fiscal']['tipoCliente'] : null
  const dados: DadosCliente = {
    nome: nome ?? '', documento, telefone,
    rua: textoDoCadastro(b.rua), numero: textoDoCadastro(b.numero), complemento: textoDoCadastro(b.complemento),
    bairro: textoDoCadastro(b.bairro), cidade: textoDoCadastro(b.cidade), uf, cep,
    fiscal: { tipoContribuinte: contribuinte, tipoCliente: tipo, inscricaoEstadual: soDigitos(f.inscricaoEstadual) },
  }
  return { dados, erros }
}

/** O mesmo, no formato do back: o dado limpo, ou a falha do primeiro campo. */
export function clienteValido(bruto: unknown): DadosCliente | Falha {
  const { dados, erros } = conferirCliente(bruto)
  const primeiro = Object.values(erros)[0]
  return primeiro ? falha('validacao', primeiro) : dados
}
