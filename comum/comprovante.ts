import type { DadosComprovante, ItemComprovante, PagamentoComprovante } from './contrato'

/**
 * O comprovante NAO FISCAL (Memoria.md, `2026-10-07`): conferencia do dado que
 * chega pela IPC e o desenho do papel em linhas de largura fixa.
 *
 * Fica em `comum/` porque as duas implementacoes do contrato o usam: o processo
 * principal converte as linhas em ESC/POS (`electron/escpos.ts`) e o mock as
 * mostra no console do navegador. O alinhamento e feito aqui, com espacos, e nao
 * por comando da impressora: assim o que o mock mostra e exatamente o papel.
 */

/** Cabecalho da loja; vem da configuracao da maquina, nunca da tela. */
export type Loja = { nome: string; endereco: string; telefone: string; cnpj: string }

export type Linha = { texto: string; negrito?: boolean }

/** Colunas da Elgin i8 na fonte padrao, medido no papel (`2026-10-07`). */
export const LARGURA = 48

const AVISO_FISCAL = 'NÃO É DOCUMENTO FISCAL'

// ---------------------------------------------------------------------------
// Conferencia: o dado entra pela IPC sem garantia de tipo.
// ---------------------------------------------------------------------------

/**
 * Tira caractere de controle. Sem isto, um ESC escondido no nome de um produto
 * viraria comando da impressora (cortar, mudar a pagina de codigo...).
 */
export function limpar(texto: string) {
  return texto.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const textoAte = (valor: unknown, max: number) => (typeof valor === 'string' ? limpar(valor).slice(0, max) : '')
const centavos = (valor: unknown): valor is number => Number.isSafeInteger(valor) && (valor as number) >= 0

export const totalItem = (item: ItemComprovante) => Math.round(item.quantidade * item.preco)

/** Devolve o dado conferido e limpo, ou o motivo da recusa (texto de tela). */
export function conferirComprovante(entrada: unknown): DadosComprovante | string {
  if (!entrada || typeof entrada !== 'object') return 'Dados do comprovante inválidos.'
  const d = entrada as Record<string, unknown>

  const numero = textoAte(d.numero, 20)
  if (!numero) return 'Falta o número da venda.'
  if (typeof d.dataHora !== 'string' || Number.isNaN(Date.parse(d.dataHora))) return 'Data da venda inválida.'
  const operador = textoAte(d.operador, 40)
  const cliente = textoAte(d.cliente, 80) || undefined

  if (!Array.isArray(d.itens) || d.itens.length === 0 || d.itens.length > 300) return 'O comprovante precisa ter itens.'
  const itens: ItemComprovante[] = []
  for (const bruto of d.itens as unknown[]) {
    const i = (bruto ?? {}) as Record<string, unknown>
    const descricao = textoAte(i.descricao, 200)
    const quantidade = Number(i.quantidade)
    if (!descricao || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 100_000 || !centavos(i.preco)) return 'Item do comprovante inválido.'
    itens.push({ descricao, quantidade, preco: i.preco })
  }

  if (!Array.isArray(d.pagamentos) || d.pagamentos.length > 20) return 'Pagamentos do comprovante inválidos.'
  const pagamentos: PagamentoComprovante[] = []
  for (const bruto of d.pagamentos as unknown[]) {
    const p = (bruto ?? {}) as Record<string, unknown>
    const rotulo = textoAte(p.rotulo, 60)
    if (!rotulo || !centavos(p.valor) || p.valor === 0) return 'Pagamento do comprovante inválido.'
    pagamentos.push({ rotulo, valor: p.valor })
  }

  if (!centavos(d.desconto) || !centavos(d.total) || !centavos(d.troco)) return 'Valores do comprovante inválidos.'
  if (typeof d.demonstracao !== 'boolean' || typeof d.segundaVia !== 'boolean') return 'Dados do comprovante inválidos.'

  // Comprovante com conta errada e pior que nenhum: recusa em vez de imprimir.
  const subtotal = itens.reduce((soma, item) => soma + totalItem(item), 0)
  if (subtotal - d.desconto !== d.total) return 'A soma dos itens menos o desconto não bate com o total.'
  const pago = pagamentos.reduce((soma, p) => soma + p.valor, 0)
  if (pago - d.troco !== d.total) return 'Os pagamentos menos o troco não batem com o total.'

  return { numero, dataHora: d.dataHora, operador, cliente, itens, desconto: d.desconto, total: d.total, pagamentos, troco: d.troco, demonstracao: d.demonstracao, segundaVia: d.segundaVia }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** 123456 -> "1.234,56" */
export function dinheiro(centavos: number) {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sinal}${reais},${String(abs % 100).padStart(2, '0')}`
}

const quantidadeTexto = (q: number) => (Number.isInteger(q) ? String(q) : String(q).replace('.', ','))

/** Quebra por palavra; palavra maior que a linha e cortada. */
export function quebrar(texto: string, largura = LARGURA): string[] {
  const linhas: string[] = []
  let atual = ''
  for (let palavra of texto.split(' ').filter(Boolean)) {
    while (palavra.length > largura) {
      if (atual) { linhas.push(atual); atual = '' }
      linhas.push(palavra.slice(0, largura))
      palavra = palavra.slice(largura)
    }
    if (!atual) atual = palavra
    else if (atual.length + 1 + palavra.length <= largura) atual += ` ${palavra}`
    else { linhas.push(atual); atual = palavra }
  }
  if (atual) linhas.push(atual)
  return linhas.length ? linhas : ['']
}

const centro = (texto: string, largura = LARGURA) => ' '.repeat(Math.max(0, Math.floor((largura - texto.length) / 2))) + texto

/** Texto a esquerda e valor encostado na direita; se nao couber, o valor desce. */
function colunas(esquerda: string, direita: string, largura = LARGURA): string[] {
  if (esquerda.length + 1 + direita.length <= largura) return [esquerda + ' '.repeat(largura - esquerda.length - direita.length) + direita]
  return [...quebrar(esquerda, largura), direita.padStart(largura)]
}

function dataLocal(iso: string, fuso?: string) {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return f.format(new Date(iso)).replace(',', '')
}

/** `fuso` so para os testes; no app vale o fuso da maquina. */
export function linhasComprovante(d: DadosComprovante, loja: Loja, fuso?: string): Linha[] {
  const L: Linha[] = []
  const texto = (t: string, negrito = false) => L.push(negrito ? { texto: t, negrito } : { texto: t })
  const centrado = (t: string, negrito = false) => quebrar(t).forEach((parte) => texto(centro(parte), negrito))
  const traco = (c = '-') => texto(c.repeat(LARGURA))

  centrado(loja.nome.toUpperCase(), true)
  centrado(loja.endereco)
  centrado(`Tel: ${loja.telefone}`)
  centrado(`CNPJ: ${loja.cnpj}`)
  traco('=')
  centrado(`*** ${AVISO_FISCAL} ***`, true)
  if (d.demonstracao) centrado('*** SIMULAÇÃO - DADOS DE TESTE ***', true)
  if (d.segundaVia) centrado('2ª VIA', true)
  traco()

  colunas(`Venda nº ${d.numero}`, dataLocal(d.dataHora, fuso)).forEach((t) => texto(t))
  if (d.operador) texto(`Atendente: ${d.operador}`)
  if (d.cliente) quebrar(`Cliente: ${d.cliente}`).forEach((t) => texto(t))
  traco()

  for (const item of d.itens) {
    quebrar(item.descricao).forEach((t) => texto(t))
    colunas(`  ${quantidadeTexto(item.quantidade)} x ${dinheiro(item.preco)}`, dinheiro(totalItem(item))).forEach((t) => texto(t))
  }
  traco()

  if (d.desconto > 0) {
    colunas('Subtotal', dinheiro(d.total + d.desconto)).forEach((t) => texto(t))
    colunas('Desconto', dinheiro(-d.desconto)).forEach((t) => texto(t))
  }
  colunas('TOTAL R$', dinheiro(d.total)).forEach((t) => texto(t, true))
  traco()

  for (const p of d.pagamentos) colunas(p.rotulo, dinheiro(p.valor)).forEach((t) => texto(t))
  if (d.troco > 0) colunas('Troco', dinheiro(d.troco)).forEach((t) => texto(t))
  traco('=')

  centrado(AVISO_FISCAL, true)
  centrado('Obrigado pela preferência!')
  return L
}

/** O papel em texto puro (mock e testes). */
export const textoComprovante = (linhas: Linha[]) => linhas.map((l) => l.texto).join('\n')
