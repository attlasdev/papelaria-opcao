/**
 * As regras do cadastro de cliente (Memoria.md, "Clientes", `R-CLIENTE-04`,
 * `09` e `10`), uma vez só para o mock e o SQLite, e para a tela apontar o
 * campo errado antes de mandar. Funções puras.
 */
import { falha, type CompraCliente, type DadosCliente, type Falha, type FiltroClientes, type FiltroCompras, type LinhaCliente, type PaginaClientes, type PaginaCompras } from '../contrato'
import { emAberto, situacaoCliente, situacaoCompra, type FichaDaConta } from './notinha'
import { paginaQueExiste, paraBusca, POR_PAGINA_MAXIMO, textoDoCadastro } from './produto'

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

// Lista de Clientes (tela 3.2) ------------------------------------------------

const FILTROS: FiltroClientes[] = ['todos', 'a-vencer', 'em-atraso']
const inteiro = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1

/** O pedido que chegou pela IPC: filtro conhecido e números inteiros. */
export function conferirPedidoDeClientes(filtro: unknown, busca: unknown, pagina: unknown, porPagina: unknown): Falha | null {
  if (!FILTROS.includes(filtro as FiltroClientes) || typeof busca !== 'string') return falha('validacao', 'Pedido inválido.')
  if (!inteiro(pagina) || !inteiro(porPagina) || (porPagina as number) > POR_PAGINA_MAXIMO) return falha('validacao', 'Pedido de página inválido.')
  return null
}

/** Sem acento, minúsculo e com um espaço só (nome colado de outro lugar traz dois, ou o que não quebra). */
const paraComparar = (texto: string) => paraBusca(texto).replace(/\s+/g, ' ').trim()

type Identificacao = Pick<LinhaCliente, 'codigo' | 'nome' | 'documento' | 'telefone'>

/**
 * `R-CLIENTE-03`: código e nome sem acento; só com números (e "CPF"/"CNPJ" na
 * frente), no documento e no telefone, com ou sem a pontuação.
 */
export function clienteCorresponde(c: Identificacao, busca: string) {
  const termo = paraComparar(busca)
  if (!termo || paraComparar(`${c.codigo} ${c.nome}`).includes(termo)) return true
  const numero = termo.replace(/^(cpf|cnpj)\s*/, '')
  if (!/^[\d\s()./+*\-]+$/.test(numero)) return false
  const digitos = numero.replace(/\D/g, '')
  return Boolean(digitos) && [c.documento, c.telefone].some((campo) => campo?.includes(digitos))
}

/** O que cada lado junta do cliente: a identificação, quantas compras e as notinhas (as quitadas podem ficar de fora). */
export type ClienteDaLista = Pick<LinhaCliente, 'id' | 'codigo' | 'nome' | 'documento' | 'telefone' | 'compras'> & { notinhas: FichaDaConta[] }

/**
 * A página da lista, com os cartões contando todos os clientes. Os dois lados
 * montam em memória: os cartões precisam da situação de todos de qualquer jeito,
 * e a loja tem centenas de clientes, não milhões.
 */
export function paginaDeClientes(
  todos: ClienteDaLista[], filtro: FiltroClientes, busca: string, pagina: number, porPagina: number,
  vendasSemIdentificacaoHoje: number, hoje: string,
): PaginaClientes {
  const linhas: LinhaCliente[] = todos.map(({ notinhas, ...c }) => ({
    ...c,
    emAberto: notinhas.reduce((soma, n) => soma + emAberto(n), 0),
    situacao: situacaoCliente(notinhas.map((n) => situacaoCompra(n, hoje))),
  }))
  const contar = (situacao: LinhaCliente['situacao']) => linhas.filter((l) => l.situacao === situacao).length
  const achados = linhas
    .filter((l) => (filtro === 'todos' || l.situacao === filtro) && clienteCorresponde(l, busca))
    .sort((a, b) => paraComparar(a.nome).localeCompare(paraComparar(b.nome), 'pt-BR') || a.codigo.localeCompare(b.codigo))
  const atual = paginaQueExiste(pagina, achados.length, porPagina)
  return {
    clientes: achados.slice((atual - 1) * porPagina, atual * porPagina),
    total: achados.length,
    pagina: atual,
    resumo: { clientes: linhas.length, aVencer: contar('a-vencer'), emAtraso: contar('em-atraso') },
    vendasSemIdentificacaoHoje,
  }
}

/** Uma ficha do cliente como cada lado junta. */
export type FichaDaCompra = FichaDaConta & Pick<CompraCliente, 'id' | 'numero' | 'registradoEm' | 'rotulo'>

/** A ficha do histórico (3.3): o que a linha mostra além da conta. */
export type FichaDoHistorico = FichaDaCompra & Pick<CompraCliente, 'itens' | 'servicos' | 'canceladaEm'> & {
  /** O dia do último pagamento que vale (`AAAA-MM-DD`), ou `null`. */
  ultimoPagamento: string | null
}

/**
 * O histórico do cliente (`R-CLIENTE-05`): da mais nova para a mais velha. A
 * cancelada fica em "Todas", mas não é compra nem entra no ticket médio. Os
 * cartões e as abas contam o cliente inteiro; o filtro só escolhe as linhas.
 */
export function paginaDeCompras(fichas: FichaDoHistorico[], filtro: FiltroCompras, pagina: number, porPagina: number, hoje: string): PaginaCompras {
  const ordem = [...fichas]
    .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm) || Number(b.numero) - Number(a.numero))
    .map((f): CompraCliente => {
      const situacao = situacaoCompra(f, hoje)
      return {
        id: f.id, numero: f.numero, registradoEm: f.registradoEm, total: f.total, forma: f.forma, rotulo: f.rotulo,
        situacao, emAberto: emAberto(f), vencimento: f.forma === 'notinha' ? f.vencimento : null,
        quitadaEm: f.forma === 'notinha' && situacao === 'paga' ? f.ultimoPagamento : null,
        canceladaEm: f.cancelada ? f.canceladaEm : null, itens: f.itens, servicos: f.servicos,
      }
    })
  const compras = ordem.filter((c) => c.situacao !== 'cancelada')
  const abertas = ordem.filter((c) => c.emAberto > 0)
  const contar = (situacao: CompraCliente['situacao']) => ordem.filter((c) => c.situacao === situacao).length
  const totalComprado = compras.reduce((soma, c) => soma + c.total, 0)
  const achadas = filtro === 'todas' ? ordem : ordem.filter((c) => c.situacao === filtro)
  const atual = paginaQueExiste(pagina, achadas.length, porPagina)
  return {
    compras: achadas.slice((atual - 1) * porPagina, atual * porPagina),
    total: achadas.length,
    pagina: atual,
    resumo: {
      compras: compras.length,
      totalComprado,
      ticketMedio: compras.length ? Math.round(totalComprado / compras.length) : 0,
      emAberto: abertas.reduce((soma, c) => soma + c.emAberto, 0),
      notinhasEmAberto: abertas.length,
      situacao: situacaoCliente(ordem.map((c) => c.situacao)),
      contagem: { todas: ordem.length, pagas: contar('paga'), aVencer: contar('a-vencer'), emAtraso: contar('em-atraso') },
    },
  }
}

const FILTROS_COMPRAS: FiltroCompras[] = ['todas', 'paga', 'a-vencer', 'em-atraso']

/** O pedido do histórico: id, filtro e números inteiros. */
export function conferirPedidoDeCompras(clienteId: unknown, filtro: unknown, pagina: unknown, porPagina: unknown): Falha | null {
  if (typeof clienteId !== 'string' || !clienteId) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
  if (!FILTROS_COMPRAS.includes(filtro as FiltroCompras)) return falha('validacao', 'Pedido inválido.')
  if (!inteiro(pagina) || !inteiro(porPagina) || (porPagina as number) > POR_PAGINA_MAXIMO) return falha('validacao', 'Pedido de página inválido.')
  return null
}
