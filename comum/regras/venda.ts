/**
 * As regras da venda (Memoria.md, "Venda (ficha)" e "Notinha"; `R-VENDA-06`,
 * `07`, `09` a `12`, `R-NOTINHA-02`, `03`), uma vez só para o mock e o SQLite,
 * e o rótulo do pagamento. Funções puras: o produto de agora (preço, saldo,
 * ativo) cada lado lê e entrega a `montarVenda`.
 */
import {
  falha, type Falha, type FormaFicha, type ItemVendido, type Maquininha, type MeioPagamento, type ModalidadeCartao,
  type PagamentoVenda, type RascunhoFicha, type ServicoVendido, type Venda,
} from '../contrato'
import { diaValido } from './entrada'

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const reais = (centavos: number) => real.format(centavos / 100)

export const MENSAGENS_VENDA = {
  pedido: 'Pedido inválido.',
  semConteudo: 'Inclua ao menos um item ou serviço.',
  repetido: 'O mesmo produto aparece duas vezes na ficha.',
  quantidade: 'Informe uma quantidade inteira de 1 a 9999.',
  servico: 'Informe o nome e o valor do serviço.',
  desativado: (nome: string) => `${nome} está desativado: reative no Estoque para vender.`,
  precoMudou: (nome: string, antes: number, agora: number) => `O preço de ${nome} mudou de ${reais(antes)} para ${reais(agora)}. Confirme com o cliente.`,
  semSaldo: (nome: string, disponivel: number, pedido: number) =>
    `Estoque insuficiente para ${nome}: ${disponivel} disponível, ${pedido} na ficha.`,
  desconto: (subtotal: number) => `O desconto passa do subtotal (${reais(subtotal)}).`,
  dinheiro: 'O valor recebido é menor que o total.',
  mistoMeios: 'Escolha pelo menos dois meios com valor maior que zero.',
  mistoTotal: (total: number) => `Distribua exatamente ${reais(total)} entre os meios de pagamento.`,
  mistoDinheiro: 'O dinheiro entregue é menor que a parte paga em espécie.',
  mistoCartao: 'Informe o tipo de cartão e a maquininha da parte no cartão.',
  notinhaSemCliente: 'A notinha precisa de um cliente identificado.',
  vencimento: 'Informe o vencimento da notinha.',
  vencimentoPassado: 'O vencimento não pode ser antes de hoje.',
  entradaCobre: 'A entrada cobre o total: escolha outra forma.',
  clienteNaoEncontrado: 'Cliente não encontrado.',
}

const MEIOS: MeioPagamento[] = ['dinheiro', 'pix', 'cartao']
const FORMAS: FormaFicha[] = ['dinheiro', 'pix', 'cartao', 'misto', 'notinha']
const MAQUININHAS: Maquininha[] = ['mercado-pago', 'sicoob']
const MODALIDADES: ModalidadeCartao[] = ['credito', 'debito']
const QUANTIDADE_MAXIMA = 9999
const ITENS_MAXIMO = 500

const objeto = (v: unknown) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const inteiro = (v: unknown, minimo = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= minimo
const textoOuNulo = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

const NOME_MAQUININHA: Record<Maquininha, string> = { 'mercado-pago': 'Mercado Pago', sicoob: 'Sicoob' }
const NOME_MODALIDADE: Record<ModalidadeCartao, string> = { credito: 'crédito', debito: 'débito' }

/**
 * O rótulo que aparece no detalhe da ficha, no Início e no Financeiro:
 * "Cartão crédito Visa · Mercado Pago", "Cartão débito · Sicoob", "Pix ·
 * Mercado Pago", "Pix manual". Dinheiro não tem rótulo próprio.
 */
export function rotuloPagamento(p: { meio: MeioPagamento; cartao?: ModalidadeCartao; maquininha?: Maquininha; bandeira?: string }): string | undefined {
  if (p.meio === 'cartao') {
    const tipo = ['Cartão', p.cartao && NOME_MODALIDADE[p.cartao], p.bandeira].filter(Boolean).join(' ')
    return p.maquininha ? `${tipo} · ${NOME_MAQUININHA[p.maquininha]}` : tipo
  }
  if (p.meio === 'pix') return p.maquininha ? `Pix · ${NOME_MAQUININHA[p.maquininha]}` : 'Pix manual'
  return undefined
}

function conferirServico(bruto: unknown): ServicoVendido | null {
  const s = objeto(bruto)
  const nome = textoOuNulo(s?.nome)
  if (!s || !nome || !inteiro(s.valor)) return null
  if (s.perdas !== null && s.perdas !== undefined && !inteiro(s.perdas, 1)) return null
  return { nome, valor: s.valor, perdas: (s.perdas as number | null | undefined) ?? null, observacao: textoOuNulo(s.observacao) }
}

function conferirPagamento(bruto: unknown, comCliente: boolean, hoje: string): PagamentoVenda | Falha {
  const p = objeto(bruto)
  const invalido = falha('validacao', MENSAGENS_VENDA.pedido)
  switch (p?.forma) {
    case 'dinheiro':
      return inteiro(p.recebido) ? { forma: 'dinheiro', recebido: p.recebido } : falha('validacao', MENSAGENS_VENDA.dinheiro)
    case 'pix':
      return p.maquininha === null || p.maquininha === 'mercado-pago' ? { forma: 'pix', maquininha: p.maquininha } : invalido
    case 'cartao':
      if (!MODALIDADES.includes(p.cartao as ModalidadeCartao) || !MAQUININHAS.includes(p.maquininha as Maquininha)) return invalido
      return { forma: 'cartao', cartao: p.cartao as ModalidadeCartao, maquininha: p.maquininha as Maquininha, bandeira: textoOuNulo(p.bandeira)?.slice(0, 30) ?? null }
    case 'misto': {
      if (!Array.isArray(p.parcelas) || (p.recebido !== null && !inteiro(p.recebido))) return invalido
      const parcelas = p.parcelas.map(objeto)
      if (parcelas.some((x) => !x || !MEIOS.includes(x.meio as MeioPagamento) || !inteiro(x.valor))) return invalido
      // Parcela com zero é meio que a pessoa não usou.
      const usadas = parcelas.filter((x) => (x!.valor as number) > 0).map((x) => ({ meio: x!.meio as MeioPagamento, valor: x!.valor as number }))
      if (usadas.length < 2 || new Set(usadas.map((x) => x.meio)).size !== usadas.length) return falha('validacao', MENSAGENS_VENDA.mistoMeios)
      // Com valor no cartão, qual cartão e qual maquininha (`R-VENDA-12`); sem, o campo não vale.
      if (!usadas.some((x) => x.meio === 'cartao')) return { forma: 'misto', parcelas: usadas, recebido: p.recebido as number | null, cartao: null }
      const c = objeto(p.cartao)
      if (!c || !MODALIDADES.includes(c.cartao as ModalidadeCartao) || !MAQUININHAS.includes(c.maquininha as Maquininha)) return falha('validacao', MENSAGENS_VENDA.mistoCartao)
      return { forma: 'misto', parcelas: usadas, recebido: p.recebido as number | null, cartao: { cartao: c.cartao as ModalidadeCartao, maquininha: c.maquininha as Maquininha } }
    }
    case 'notinha': {
      if (!comCliente) return falha('validacao', MENSAGENS_VENDA.notinhaSemCliente)
      if (!diaValido(p.vencimento)) return falha('validacao', MENSAGENS_VENDA.vencimento)
      if (p.vencimento < hoje) return falha('validacao', MENSAGENS_VENDA.vencimentoPassado)
      if (p.entrada === null) return { forma: 'notinha', vencimento: p.vencimento, entrada: null }
      const e = objeto(p.entrada)
      if (!e || !MEIOS.includes(e.meio as MeioPagamento) || !inteiro(e.valor)) return invalido
      // Entrada zero é notinha sem entrada.
      return { forma: 'notinha', vencimento: p.vencimento, entrada: e.valor === 0 ? null : { meio: e.meio as MeioPagamento, valor: e.valor } }
    }
    default:
      return invalido
  }
}

/**
 * Do que chegou pela IPC para a venda limpa, ou a falha: o que dá para
 * conferir sem ler o banco. `hoje`: o dia de São Paulo.
 */
export function conferirVenda(bruta: unknown, hoje: string): Venda | Falha {
  const v = objeto(bruta)
  if (!v || !Array.isArray(v.itens) || !Array.isArray(v.servicos) || v.itens.length > ITENS_MAXIMO || v.servicos.length > ITENS_MAXIMO) {
    return falha('validacao', MENSAGENS_VENDA.pedido)
  }
  if (v.clienteId !== null && (typeof v.clienteId !== 'string' || !v.clienteId)) return falha('validacao', MENSAGENS_VENDA.pedido)
  const itens: ItemVendido[] = []
  for (const bruto of v.itens) {
    const i = objeto(bruto)
    if (!i || typeof i.produtoId !== 'string' || !i.produtoId || !inteiro(i.precoVisto)) return falha('validacao', MENSAGENS_VENDA.pedido)
    if (!inteiro(i.quantidade, 1) || i.quantidade > QUANTIDADE_MAXIMA) return falha('validacao', MENSAGENS_VENDA.quantidade)
    itens.push({ produtoId: i.produtoId, quantidade: i.quantidade, precoVisto: i.precoVisto })
  }
  if (new Set(itens.map((i) => i.produtoId)).size !== itens.length) return falha('validacao', MENSAGENS_VENDA.repetido)
  const servicos = v.servicos.map(conferirServico)
  if (servicos.some((s) => !s)) return falha('validacao', MENSAGENS_VENDA.servico)
  if (!itens.length && !servicos.length) return falha('validacao', MENSAGENS_VENDA.semConteudo)
  if (!inteiro(v.desconto)) return falha('validacao', MENSAGENS_VENDA.pedido)
  const pagamento = conferirPagamento(v.pagamento, v.clienteId !== null, hoje)
  if ('ok' in pagamento) return pagamento
  return { clienteId: v.clienteId as string | null, itens, servicos: servicos as ServicoVendido[], desconto: v.desconto, pagamento }
}

/** O produto como está agora, lido por cada lado. */
export type ProdutoDaVenda = { id: string; descricao: string; preco: number; saldo: number; ativo: boolean }

/** Um pagamento pronto para gravar. `entrada`: a parte da notinha paga na hora. */
export type LinhaPagamento = {
  tipo: 'venda' | 'entrada'
  meio: MeioPagamento
  valor: number
  recebido: number | null
  troco: number | null
  maquininha: Maquininha | null
  cartao: ModalidadeCartao | null
  rotulo: string | null
}

export type VendaMontada = {
  itens: { produtoId: string; descricao: string; quantidade: number; preco: number }[]
  servicos: ServicoVendido[]
  subtotal: number
  desconto: number
  total: number
  /** Só a notinha. */
  vencimento: string | null
  pagamentos: LinhaPagamento[]
}

const linha = (tipo: LinhaPagamento['tipo'], meio: MeioPagamento, valor: number, mais: Partial<LinhaPagamento> = {}): LinhaPagamento =>
  ({ tipo, meio, valor, recebido: null, troco: null, maquininha: null, cartao: null, rotulo: null, ...mais })

/** Dinheiro: o que a pessoa entregou, e o troco. */
const emEspecie = (valor: number, recebido: number | null) => (recebido === null ? {} : { recebido, troco: recebido - valor })

/**
 * Com os produtos de agora: o preço do cadastro (`R-VENDA-11`), o saldo
 * (`R-VENDA-07`), o desconto e se o pagamento fecha o total (`R-VENDA-06`,
 * `09`, `R-NOTINHA-03`). Total zero não gera pagamento.
 */
export function montarVenda(venda: Venda, produtos: Map<string, ProdutoDaVenda>): VendaMontada | Falha {
  const itens: VendaMontada['itens'] = []
  for (const item of venda.itens) {
    const p = produtos.get(item.produtoId)
    if (!p) return falha('nao-encontrado', 'Produto não encontrado.')
    if (!p.ativo) return falha('validacao', MENSAGENS_VENDA.desativado(p.descricao))
    if (p.preco !== item.precoVisto) return falha('conflito', MENSAGENS_VENDA.precoMudou(p.descricao, item.precoVisto, p.preco))
    if (p.saldo < item.quantidade) return falha('validacao', MENSAGENS_VENDA.semSaldo(p.descricao, p.saldo, item.quantidade))
    itens.push({ produtoId: p.id, descricao: p.descricao, quantidade: item.quantidade, preco: p.preco })
  }
  const subtotal = itens.reduce((t, i) => t + i.preco * i.quantidade, 0) + venda.servicos.reduce((t, s) => t + s.valor, 0)
  if (venda.desconto > subtotal) return falha('validacao', MENSAGENS_VENDA.desconto(subtotal))
  const total = subtotal - venda.desconto
  const pg = venda.pagamento
  let pagamentos: LinhaPagamento[] = []
  switch (pg.forma) {
    case 'dinheiro':
      if (pg.recebido < total) return falha('validacao', MENSAGENS_VENDA.dinheiro)
      pagamentos = [linha('venda', 'dinheiro', total, emEspecie(total, pg.recebido))]
      break
    case 'pix':
      pagamentos = [linha('venda', 'pix', total, { maquininha: pg.maquininha, rotulo: rotuloPagamento({ meio: 'pix', maquininha: pg.maquininha ?? undefined }) ?? null })]
      break
    case 'cartao':
      pagamentos = [linha('venda', 'cartao', total, {
        cartao: pg.cartao, maquininha: pg.maquininha,
        rotulo: rotuloPagamento({ meio: 'cartao', cartao: pg.cartao, maquininha: pg.maquininha, bandeira: pg.bandeira ?? undefined }) ?? null,
      })]
      break
    case 'misto': {
      if (pg.parcelas.reduce((t, x) => t + x.valor, 0) !== total) return falha('validacao', MENSAGENS_VENDA.mistoTotal(total))
      const especie = pg.parcelas.find((x) => x.meio === 'dinheiro')?.valor ?? 0
      if (especie > 0 && (pg.recebido === null || pg.recebido < especie)) return falha('validacao', MENSAGENS_VENDA.mistoDinheiro)
      const noCartao = pg.cartao && {
        cartao: pg.cartao.cartao, maquininha: pg.cartao.maquininha,
        rotulo: rotuloPagamento({ meio: 'cartao', cartao: pg.cartao.cartao, maquininha: pg.cartao.maquininha }) ?? null,
      }
      pagamentos = pg.parcelas.map((x) => linha('venda', x.meio, x.valor,
        x.meio === 'dinheiro' ? emEspecie(x.valor, pg.recebido) : x.meio === 'cartao' && noCartao ? noCartao : {}))
      break
    }
    case 'notinha':
      if (pg.entrada && pg.entrada.valor >= total) return falha('validacao', MENSAGENS_VENDA.entradaCobre)
      pagamentos = pg.entrada ? [linha('entrada', pg.entrada.meio, pg.entrada.valor)] : []
      break
  }
  return {
    itens, servicos: venda.servicos, subtotal, desconto: venda.desconto, total,
    vencimento: pg.forma === 'notinha' ? pg.vencimento : null,
    pagamentos: pagamentos.filter((x) => x.valor > 0),
  }
}

/** O rascunho que chegou pela IPC, conferido no formato; o conteúdo é estado de tela. */
export function conferirRascunho(bruto: unknown): RascunhoFicha | Falha {
  const r = objeto(bruto)
  const invalido = falha('validacao', 'Rascunho inválido.')
  if (!r || !Array.isArray(r.itens) || !Array.isArray(r.servicos) || r.itens.length > ITENS_MAXIMO || r.servicos.length > ITENS_MAXIMO) return invalido
  if (r.clienteId !== null && (typeof r.clienteId !== 'string' || !r.clienteId)) return invalido
  const itens = r.itens.map(objeto)
  if (itens.some((i) => !i || typeof i.produtoId !== 'string' || !i.produtoId || !inteiro(i.quantidade, 1))) return invalido
  const servicos = r.servicos.map(conferirServico)
  if (servicos.some((s) => !s)) return invalido
  const divisao = objeto(r.divisao)
  if (!divisao || MEIOS.some((m) => !inteiro(divisao[m]))) return invalido
  const numeros = [r.desconto, r.recebido, r.entrada, r.recebidoMisto]
  if (numeros.some((n) => !inteiro(n)) || typeof r.semIdentificacao !== 'boolean' || typeof r.pixNaMaquininha !== 'boolean') return invalido
  if (!FORMAS.includes(r.forma as FormaFicha) || !MEIOS.includes(r.meioEntrada as MeioPagamento) || typeof r.vencimento !== 'string' || r.vencimento.length > 10) return invalido
  if (!MODALIDADES.includes(r.cartao as ModalidadeCartao) || !MAQUININHAS.includes(r.maquininhaCartao as Maquininha)) return invalido
  return {
    clienteId: r.clienteId as string | null,
    semIdentificacao: r.semIdentificacao,
    itens: itens.map((i) => ({ produtoId: i!.produtoId as string, quantidade: i!.quantidade as number })),
    servicos: servicos as ServicoVendido[],
    desconto: r.desconto as number,
    forma: r.forma as FormaFicha,
    recebido: r.recebido as number,
    vencimento: r.vencimento,
    entrada: r.entrada as number,
    meioEntrada: r.meioEntrada as MeioPagamento,
    divisao: { dinheiro: divisao.dinheiro as number, pix: divisao.pix as number, cartao: divisao.cartao as number },
    recebidoMisto: r.recebidoMisto as number,
    cartao: r.cartao as ModalidadeCartao,
    maquininhaCartao: r.maquininhaCartao as Maquininha,
    pixNaMaquininha: r.pixNaMaquininha,
  }
}
