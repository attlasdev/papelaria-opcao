import { MOTIVO_SALDO_INICIAL } from '../../../comum/regras/produto'
import { dataCurta, reais } from '../../formatar'
import { funcoes } from '../../funcoes'
import { rotas } from '../../rotas-caminhos'
import { dataCalendarioValida, diaDoInstante, diasEntre, noPeriodo, periodoAnterior, type Periodo } from './datas'
import type { Base, Boleto, Cliente, Ficha, ItemVenda, Meio, Produto, TurnoCaixa } from './tipos'

/**
 * Tudo o que se calcula a partir da base. Funções puras: recebem a base e a
 * data de hoje e devolvem o que a tela mostra. Nenhuma guarda cópia.
 */

export type SituacaoNotinha = 'pago' | 'pendente' | 'vencido' | 'cancelada'
export type SituacaoCliente = 'em-dia' | 'pendente' | 'vencido'
export type Notinha = { ficha: Ficha; pago: number; emAberto: number; situacao: SituacaoNotinha; detalhe?: string }

export const ROTULO_SEM_IDENTIFICACAO = 'Não identificado'

export const NOME_MEIO = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' } as const

/** Pontuação e prefixos não tornam CPF/CNPJ distintos no cadastro. */
export function documentoJaCadastrado(clientes: Cliente[], documento: string, excetoId?: string) {
  const digitos = documento.replace(/\D/g, '')
  return Boolean(digitos) && clientes.some((cliente) => cliente.id !== excetoId && cliente.documento.replace(/\D/g, '') === digitos)
}

export function nomeCliente(base: Base, clienteId: string | null) {
  if (!clienteId) return ROTULO_SEM_IDENTIFICACAO
  return base.clientes.find((c) => c.id === clienteId)?.nome ?? 'Cliente removido'
}

export function resumoItens(ficha: Ficha) {
  return [...ficha.itens.map((i) => `${i.descricao} (${i.quantidade}x)`), ...(ficha.servicos ?? []).map((s) => s.nome)].join(', ')
}

export type ServicoFeito = { ficha: string; data: string; horario: string; cliente: string; servico: string; valor: number; perdas: number; comProdutos: boolean; observacao?: string }

/**
 * Os serviços prestados no período (dia da ficha), mais recentes primeiro, com
 * o número da ficha: uma ficha pode ter produtos e serviços juntos. Ficha
 * cancelada fica de fora (`2026-10-19`, Agostinho).
 */
export function servicosFeitos(base: Base, de: string, ate: string): ServicoFeito[] {
  return base.fichas
    .filter((f) => !f.cancelamento && f.data >= de && f.data <= ate)
    .flatMap((f) => (f.servicos ?? []).map((s) => ({ ficha: f.id, data: f.data, horario: f.horario, cliente: nomeCliente(base, f.clienteId), servico: s.nome, valor: s.valor, perdas: s.perdas?.quantidade ?? 0, comProdutos: f.itens.length > 0, observacao: s.observacao })))
    .sort(porDataDecrescente)
}

export type PerdaServico = { ficha: string; data: string; horario: string; servico: string; quantidade: number; observacao?: string }

/**
 * As perdas anotadas nos serviços do período (dia da ficha), mais recentes
 * primeiro. Só conferência: nada disso mexe no estoque (decisão de 2026-10-19).
 * Ficha cancelada continua: o material se perdeu do mesmo jeito.
 */
export function perdasServicos(base: Base, de: string, ate: string): PerdaServico[] {
  return base.fichas
    .filter((f) => f.data >= de && f.data <= ate)
    .flatMap((f) => (f.servicos ?? []).flatMap((s) => (s.perdas ? [{ ficha: f.id, data: f.data, horario: f.horario, servico: s.nome, quantidade: s.perdas.quantidade, observacao: s.observacao }] : [])))
    .sort(porDataDecrescente)
}

/**
 * Categoria no Financeiro: serviço paga ISS e produto ICMS, então o contador
 * precisa separar. Ficha só de serviço é "Serviço"; com os dois, "Venda e serviço".
 */
function categoriaDaFicha(f: Ficha) {
  if (f.forma === 'notinha') return 'Recebimento de notinha'
  if (!f.servicos?.length) return 'Venda'
  return f.itens.length ? 'Venda e serviço' : 'Serviço'
}

/** A venda só pode baixar unidades que já constam no estoque. */
export function faltaEstoqueParaVenda(base: Base, itens: Pick<ItemVenda, 'codigo' | 'descricao' | 'quantidade'>[]) {
  const solicitados = new Map<string, { descricao: string; quantidade: number }>()
  for (const item of itens) {
    const anterior = solicitados.get(item.codigo)
    solicitados.set(item.codigo, { descricao: item.descricao, quantidade: (anterior?.quantidade ?? 0) + item.quantidade })
  }
  for (const [codigo, pedido] of solicitados) {
    const produto = base.produtos.find((item) => item.codigo === codigo && !item.inativo)
    if (!produto || !Number.isSafeInteger(pedido.quantidade) || pedido.quantidade < 1 || produto.saldo < pedido.quantidade) {
      return { codigo, descricao: produto?.descricao ?? pedido.descricao, disponivel: produto?.saldo ?? 0, solicitado: pedido.quantidade }
    }
  }
  return null
}

export function contagemItens(ficha: Ficha) {
  const unidades = ficha.itens.reduce((t, i) => t + i.quantidade, 0)
  const servicos = ficha.servicos?.length ?? 0
  const itens = ficha.itens.length ? `${ficha.itens.length} ${ficha.itens.length === 1 ? 'tipo de item' : 'tipos de itens'} · ${unidades} ${unidades === 1 ? 'unidade' : 'unidades'}` : ''
  const comServicos = servicos ? `${servicos} ${servicos === 1 ? 'serviço' : 'serviços'}` : ''
  return [itens, comServicos].filter(Boolean).join(' · ')
}

export function rotuloForma(ficha: Ficha) {
  if (ficha.forma === 'notinha') return 'Notinha'
  if (ficha.forma === 'misto') return 'Misto'
  return ficha.pagamentos[0]?.rotulo ?? NOME_MEIO[ficha.forma]
}

/** Mais recente primeiro. */
export function porDataDecrescente(a: { data: string; horario: string }, b: { data: string; horario: string }) {
  return `${b.data} ${b.horario}`.localeCompare(`${a.data} ${a.horario}`)
}

function textoPrazo(vencimento: string, hoje: string) {
  const dias = diasEntre(hoje, vencimento)
  if (dias === 0) return 'Vence hoje'
  if (dias > 0) return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`
}

/** Pagamentos que valem: o estornado fica no registro, mas não conta como pago. */
export function pagamentosValidos(ficha: Ficha) {
  return ficha.pagamentos.filter((p) => !p.estorno)
}

function textoCancelada(ficha: Ficha) {
  return ficha.cancelamento ? `Em ${dataCurta(ficha.cancelamento.data)}` : undefined
}

export function notinha(ficha: Ficha, hoje: string): Notinha | null {
  if (ficha.forma !== 'notinha') return null
  const validos = pagamentosValidos(ficha)
  const pago = validos.reduce((t, p) => t + p.valor, 0)
  // Cancelada não deve nada: sai da cobrança, do sino e do total em aberto.
  if (ficha.cancelamento) return { ficha, pago, emAberto: 0, situacao: 'cancelada', detalhe: textoCancelada(ficha) }
  const emAberto = Math.max(0, ficha.total - pago)
  if (emAberto === 0) {
    const ultimo = validos[validos.length - 1]
    return { ficha, pago, emAberto, situacao: 'pago', detalhe: ultimo ? `Quitada em ${dataCurta(ultimo.data)}` : undefined }
  }
  const vencimento = ficha.vencimento ?? hoje
  const situacao: SituacaoNotinha = diasEntre(hoje, vencimento) < 0 ? 'vencido' : 'pendente'
  // Só o prazo: cabe na segunda linha do selo. O valor em aberto a tela mostra à parte.
  return { ficha, pago, emAberto, situacao, detalhe: textoPrazo(vencimento, hoje) }
}

/** Situação de qualquer ficha: à vista é sempre paga. */
export function situacaoDaFicha(ficha: Ficha, hoje: string): { situacao: SituacaoNotinha; detalhe?: string } {
  const n = notinha(ficha, hoje)
  if (n) return { situacao: n.situacao, detalhe: n.detalhe }
  return ficha.cancelamento ? { situacao: 'cancelada', detalhe: textoCancelada(ficha) } : { situacao: 'pago' }
}

export function notinhasDoCliente(base: Base, clienteId: string, hoje: string) {
  return base.fichas
    .filter((f) => f.clienteId === clienteId)
    .map((f) => notinha(f, hoje))
    .filter((n): n is Notinha => n !== null)
}

export function resumoDoCliente(base: Base, clienteId: string, hoje: string) {
  const fichas = base.fichas.filter((f) => f.clienteId === clienteId).sort(porDataDecrescente)
  // A cancelada fica no histórico, mas não é compra.
  const compras = fichas.filter((f) => !f.cancelamento)
  const totalComprado = compras.reduce((t, f) => t + f.total, 0)
  const abertas = fichas.map((f) => notinha(f, hoje)).filter((n): n is Notinha => n !== null && n.emAberto > 0)
  const emAberto = abertas.reduce((t, n) => t + n.emAberto, 0)
  const situacao: SituacaoCliente = abertas.some((n) => n.situacao === 'vencido') ? 'vencido' : abertas.length ? 'pendente' : 'em-dia'
  return {
    fichas,
    totalComprado,
    compras: compras.length,
    ticketMedio: compras.length ? Math.round(totalComprado / compras.length) : 0,
    abertas,
    emAberto,
    situacao,
    detalheSituacao: abertas.length ? `${reais(emAberto)} em aberto` : undefined,
  }
}

export type ResumoCliente = ReturnType<typeof resumoDoCliente>

export type Abatimento = { id: string; valor: number; quita: boolean }

/** Divide um valor entre notinhas, da mais antiga para a mais nova. */
export function distribuir(notinhas: Notinha[], valor: number): Abatimento[] {
  let resto = valor
  return [...notinhas]
    .sort((a, b) => porDataDecrescente(b.ficha, a.ficha) || a.ficha.id.localeCompare(b.ficha.id))
    .map((n) => {
      const abatido = Math.min(resto, n.emAberto)
      resto -= abatido
      return { id: n.ficha.id, valor: abatido, quita: abatido === n.emAberto }
    })
    .filter((a) => a.valor > 0)
}

export type LinhaFinanceiro = {
  id: string
  data: string
  horario: string
  descricao: string
  origem: string
  ficha?: string
  /** Só nas linhas de ficha: o cliente, ou "Não identificado". */
  cliente?: string
  categoria: string
  meio: Meio
  meioRotulo: string
  valor: number
  operador?: string
  estornoDe?: string
  registradoEm?: string
  turnoCaixaId?: string
  /** Lançamento manual que ainda pode ser estornado. */
  estornavel?: boolean
  /** Já desfeito por um estorno (lançamento manual, recebimento ou ficha cancelada). */
  estornado?: boolean
  /** Venda à vista ainda ativa: "Estornar" cancela a ficha inteira (`2026-10-19`). */
  vendaEstornavel?: boolean
}

/**
 * O Financeiro lê os pagamentos das fichas (um registro por dinheiro recebido)
 * e os lançamentos manuais. Notinha só aparece quando alguém paga.
 */
export function movimentosFinanceiro(base: Base): LinhaFinanceiro[] {
  const daVenda = base.fichas.flatMap((f) => f.pagamentos.flatMap((p, indice) => {
    const linha: LinhaFinanceiro = {
      id: `${f.id}-${indice}`,
      data: p.data,
      horario: p.horario,
      descricao: f.forma !== 'notinha' ? `${categoriaDaFicha(f) === 'Serviço' ? 'Serviço' : 'Venda'} da ficha #${f.id}` : p.entrada ? `Entrada da notinha #${f.id}` : `Recebimento da notinha #${f.id}`,
      origem: `Balcão · ${nomeCliente(base, f.clienteId)}`,
      ficha: f.id,
      cliente: nomeCliente(base, f.clienteId),
      categoria: categoriaDaFicha(f),
      meio: p.meio,
      meioRotulo: p.rotulo ?? NOME_MEIO[p.meio],
      valor: p.valor,
      operador: p.operador ?? f.operador,
      registradoEm: p.registradoEm,
      turnoCaixaId: p.turnoCaixaId,
    }
    // O dinheiro que entrou continua no dia em que entrou; o estorno sai no dia do estorno.
    const desfeito = p.estorno ?? f.cancelamento
    if (!desfeito) return [f.forma !== 'notinha' ? { ...linha, vendaEstornavel: true } : linha]
    return [{ ...linha, estornado: true }, {
      ...linha,
      id: `${linha.id}-estorno`,
      data: desfeito.data,
      horario: desfeito.horario,
      descricao: p.estorno ? `Estorno do recebimento da notinha #${f.id}` : `Cancelamento da ficha #${f.id}`,
      origem: `${nomeCliente(base, f.clienteId)} · ${desfeito.motivo}`,
      categoria: CATEGORIA_ESTORNO,
      valor: -p.valor,
      operador: desfeito.operador,
      registradoEm: desfeito.registradoEm,
      turnoCaixaId: desfeito.turnoCaixaId,
    }]
  }))
  const estornados = new Set(base.movimentosCaixa.flatMap((m) => (m.estornoDe ? [m.estornoDe] : [])))
  const manuais = base.movimentosCaixa.map((m) => ({
    ...m,
    meioRotulo: NOME_MEIO[m.meio],
    estornado: estornados.has(m.id),
    estornavel: !m.estornoDe && !estornados.has(m.id),
  }))
  return [...daVenda, ...manuais].sort(porDataDecrescente)
}

/** Conta apenas dinheiro lançado após a abertura, inclusive estornos. */
export function movimentosDoTurnoCaixa(base: Base, turnoId: string) {
  return movimentosFinanceiro(base).filter((linha) => linha.meio === 'dinheiro' && linha.turnoCaixaId === turnoId)
}

export const CATEGORIA_RETIRADA_CAIXA = 'Retirada de caixa'
export const CATEGORIA_ADICAO_CAIXA = 'Adição de caixa'

function categoriaFisica(categoria: string) {
  // A semente antiga usava estas duas categorias sem vínculo com um turno.
  // Classificá-las na consulta não altera os registros persistidos nem seus sinais.
  return categoria === CATEGORIA_RETIRADA_CAIXA || categoria === CATEGORIA_ADICAO_CAIXA
    || categoria === 'Troco' || categoria === 'Saída de caixa'
}

function identificarMovimentosFisicos(linhas: LinhaFinanceiro[]) {
  const idsFisicos = new Set(linhas.filter((linha) => categoriaFisica(linha.categoria)).map((linha) => linha.id))
  return (linha: LinhaFinanceiro) => idsFisicos.has(linha.id) || (linha.estornoDe !== undefined && idsFisicos.has(linha.estornoDe))
}

/** Separação de apresentação: mantém também o estorno no mesmo lado do original. */
export function movimentosOperacionaisFinanceiro(linhas: LinhaFinanceiro[]) {
  const ehFisico = identificarMovimentosFisicos(linhas)
  return linhas.filter((linha) => !ehFisico(linha))
}

/** Registros físicos e seus estornos, conservando os dados originais. */
export function movimentosFisicosCaixa(base: Base) {
  const linhas = movimentosFinanceiro(base)
  const ehFisico = identificarMovimentosFisicos(linhas)
  return linhas.filter(ehFisico)
}

/** Fechados são consultados pelo fechamento; abertos, pela abertura. */
export function turnosCaixaNoPeriodo(base: Base, de: string, ate: string) {
  if (!dataCalendarioValida(de) || !dataCalendarioValida(ate) || de > ate) return []
  return [...(base.turnosCaixa ?? [])].filter((turno) => {
    const dia = diaDoInstante(turno.fechadoEm ?? turno.abertoEm)
    return dia >= de && dia <= ate
  }).sort((a, b) => (b.fechadoEm ?? b.abertoEm).localeCompare(a.fechadoEm ?? a.abertoEm))
}

export function fechamentosCaixaNoPeriodo(base: Base, de: string, ate: string) {
  return turnosCaixaNoPeriodo(base, de, ate).filter((turno) => turno.fechadoEm)
}

export function textoDiferencaCaixa(diferenca: number) {
  if (diferenca === 0) return 'O valor contado confere.'
  return diferenca < 0 ? `Faltam ${reais(-diferenca)} em relação ao esperado.` : `Há ${reais(diferenca)} a mais que o esperado.`
}

export function resumoTurnoCaixa(base: Base, turno: TurnoCaixa) {
  const movimentos = movimentosDoTurnoCaixa(base, turno.id)
  const entradas = movimentos.filter((linha) => linha.valor > 0).reduce((total, linha) => total + linha.valor, 0)
  const saidas = movimentos.filter((linha) => linha.valor < 0).reduce((total, linha) => total - linha.valor, 0)
  const esperado = turno.fechadoEm ? turno.esperadoFechamento ?? turno.fundoInicial + entradas - saidas : turno.fundoInicial + entradas - saidas
  return { entradas, saidas, esperado, diferenca: turno.contadoFechamento === undefined ? undefined : turno.contadoFechamento - esperado }
}

export const CATEGORIA_ESTORNO = 'Estorno'

export type Variacao = { texto: string; direcao: 'alta' | 'baixa' }

/** Datas inclusivas, válidas e em ordem; retorna todos os registros do intervalo. */
export function linhasFinanceiroNoIntervalo(linhas: LinhaFinanceiro[], de: string, ate: string) {
  if (!dataCalendarioValida(de) || !dataCalendarioValida(ate) || de > ate) return []
  return linhas.filter((linha) => linha.data >= de && linha.data <= ate)
}

function variacaoPercentual(atual: number, anterior: number): Variacao | undefined {
  if (anterior === 0) return undefined
  const pct = ((atual - anterior) / anterior) * 100
  return { texto: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`, direcao: pct >= 0 ? 'alta' : 'baixa' }
}

/**
 * `agora` (HH:MM) corta o período anterior no mesmo ponto: às 10h, hoje é comparado
 * com ontem até as 10h, não com ontem inteiro (senão toda manhã parece queda).
 */
export function resumoFinanceiro(linhas: LinhaFinanceiro[], periodo: Periodo, referencia: string, agora = '23:59') {
  const doPeriodo = linhas.filter((l) => noPeriodo(l.data, periodo, referencia))
  const resumo = resumirFinanceiro(linhas, doPeriodo)
  const anterior = periodoAnterior(periodo, referencia)
  const ateOMesmoPonto = (l: LinhaFinanceiro) => l.data < anterior || (l.data === anterior && l.horario <= agora)
  const ehFisico = identificarMovimentosFisicos(linhas)
  return {
    ...resumo,
    variacao: variacaoPercentual(resumo.entradas, entradasDe(linhas.filter((l) => !ehFisico(l) && noPeriodo(l.data, periodo, anterior) && ateOMesmoPonto(l)))),
  }
}

export function resumoFinanceiroIntervalo(linhas: LinhaFinanceiro[], de: string, ate: string) {
  return resumirFinanceiro(linhas, linhasFinanceiroNoIntervalo(linhas, de, ate))
}

/**
 * Estorno abate do próprio lado: desfazer uma venda reduz as entradas, desfazer
 * uma despesa reduz as saídas. Assim nenhum dos dois totais fica inflado.
 */
export function ladoFinanceiro(linha: LinhaFinanceiro): 'entrada' | 'saida' {
  return (linha.categoria === CATEGORIA_ESTORNO ? linha.valor < 0 : linha.valor > 0) ? 'entrada' : 'saida'
}

function entradasDe(linhas: LinhaFinanceiro[]) {
  return linhas.filter((linha) => ladoFinanceiro(linha) === 'entrada').reduce((total, linha) => total + linha.valor, 0)
}

function resumirFinanceiro(linhas: LinhaFinanceiro[], doPeriodo: LinhaFinanceiro[]) {
  const idsRetiradas = new Set(linhas.filter((l) => l.categoria === CATEGORIA_RETIRADA_CAIXA).map((l) => l.id))
  const ehRetirada = (l: LinhaFinanceiro) => idsRetiradas.has(l.id) || (l.estornoDe !== undefined && idsRetiradas.has(l.estornoDe))
  const fisico = identificarMovimentosFisicos(linhas)
  const operacionais = doPeriodo.filter((l) => !fisico(l))
  const entradas = entradasDe(operacionais)
  const saidas = operacionais.filter((l) => ladoFinanceiro(l) === 'saida').reduce((t, l) => t - l.valor, 0)
  const retiradas = doPeriodo.filter(ehRetirada).reduce((t, l) => t - l.valor, 0)
  const saidasLista = operacionais.filter((l) => l.valor < 0 && l.categoria !== CATEGORIA_ESTORNO)
  return {
    entradas,
    saidas,
    retiradas,
    quantidadeSaidas: saidasLista.length,
    liquido: entradas - saidas,
    contagem: {
      todos: operacionais.length,
      pix: operacionais.filter((l) => l.meio === 'pix').length,
      cartao: operacionais.filter((l) => l.meio === 'cartao').length,
      dinheiro: operacionais.filter((l) => l.meio === 'dinheiro').length,
    },
  }
}

export function resumoDoDia(base: Base, dia: string, agora?: string) {
  const r = resumoFinanceiro(movimentosFinanceiro(base), 'dia', dia, agora)
  const vendas = base.fichas.filter((f) => f.data === dia && !f.cancelamento)
  const totalVendido = vendas.reduce((t, f) => t + f.total, 0)
  return {
    recebimentos: r.entradas,
    variacao: r.variacao,
    vendas: vendas.length,
    ticketMedio: vendas.length ? Math.round(totalVendido / vendas.length) : 0,
    saidas: r.saidas,
    quantidadeSaidas: r.quantidadeSaidas,
  }
}

export type SituacaoSaldo = 'normal' | 'baixo' | 'zerado'

export function situacaoSaldo(produto: Produto): SituacaoSaldo {
  if (produto.saldo === 0) return 'zerado'
  return produto.saldo < produto.minimo ? 'baixo' : 'normal'
}

/** Produtos à venda: os desativados ficam só no histórico. */
export function produtosAtivos(base: Base) {
  return base.produtos.filter((p) => !p.inativo)
}

/** Motivo da entrada que o próprio cadastro gera; sozinha, não é histórico. */
export { MOTIVO_SALDO_INICIAL }

/** Já vendido, movimentado ou numa ficha em andamento: apagar quebraria esse registro. */
export function produtoTemHistorico(base: Base, codigo: string) {
  return base.movimentosEstoque.some((m) => m.produto === codigo && m.motivo !== MOTIVO_SALDO_INICIAL)
    || base.fichas.some((f) => f.itens.some((i) => i.codigo === codigo))
    || Boolean(base.rascunhoFicha?.itens.some((i) => i.codigo === codigo))
}

export function resumoEstoque(base: Base) {
  const ativos = produtosAtivos(base)
  return {
    produtos: ativos.length,
    categorias: new Set(ativos.map((p) => p.categoria)).size,
    baixo: ativos.filter((p) => situacaoSaldo(p) !== 'normal').length,
    semCodigo: ativos.filter((p) => !p.codigoBarras).length,
    desativados: base.produtos.length - ativos.length,
  }
}

export function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

/** Nome/código sem acento; documento e telefone com ou sem a pontuação do cadastro. */
export function clienteCorrespondeBusca(cliente: Cliente, busca: string) {
  const termo = normalizar(busca.trim())
  if (!termo || normalizar(`${cliente.id} ${cliente.nome} ${cliente.documento} ${cliente.telefone}`).includes(termo)) return true
  const numero = termo.replace(/^(cpf|cnpj)\s*/, '')
  if (!/^[\d\s()./+*\-]+$/.test(numero)) return false
  const digitos = numero.replace(/\D/g, '')
  return Boolean(digitos) && [cliente.documento, cliente.telefone].some((campo) => campo.replace(/\D/g, '').includes(digitos))
}

export function buscar(base: Base, termo: string): { clientes: Cliente[]; fichas: Ficha[]; produtos: Produto[] } {
  const t = normalizar(termo.trim())
  if (!t) return { clientes: [], fichas: [], produtos: [] }
  const casa = (texto: string) => normalizar(texto).includes(t)
  return {
    clientes: base.clientes.filter((c) => clienteCorrespondeBusca(c, termo)),
    fichas: base.fichas
      .filter((f) => casa(`${f.id} ${nomeCliente(base, f.clienteId)} ${resumoItens(f)}`))
      .sort(porDataDecrescente)
      .slice(0, 30),
    produtos: base.produtos.filter((p) => casa(`${p.codigo} ${p.codigoBarras ?? ''} ${p.descricao} ${p.categoria}`)),
  }
}

/** Boleto que vence nestes dias entra no sino antes de vencer (`2026-10-23`, Agostinho). */
export const DIAS_AVISO_BOLETO = 5

export type SituacaoBoleto = 'pago' | 'vencido' | 'vencendo' | 'a-vencer'

/** `dias`: até o vencimento; negativo quando já passou. */
export function situacaoBoleto(boleto: Boleto, hoje: string): { situacao: SituacaoBoleto; dias: number } {
  const dias = diasEntre(hoje, boleto.vencimento)
  if (boleto.pagoEm) return { situacao: 'pago', dias }
  return { situacao: dias < 0 ? 'vencido' : dias <= DIAS_AVISO_BOLETO ? 'vencendo' : 'a-vencer', dias }
}

/** "vence hoje", "vence amanhã", "vence em 3 dias", "venceu há 2 dias". */
export function prazoBoleto(dias: number) {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  if (dias > 1) return `vence em ${dias} dias`
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`
}

type GrupoBoletos = { quantidade: number; valor: number }

export function resumoBoletos(base: Base, hoje: string): Record<'vencidos' | 'vencendo' | 'aPagar', GrupoBoletos> {
  const grupo = (lista: Boleto[]): GrupoBoletos => ({ quantidade: lista.length, valor: lista.reduce((t, b) => t + b.valor, 0) })
  const abertos = base.boletos.filter((b) => !b.pagoEm)
  return {
    vencidos: grupo(abertos.filter((b) => situacaoBoleto(b, hoje).situacao === 'vencido')),
    vencendo: grupo(abertos.filter((b) => situacaoBoleto(b, hoje).situacao === 'vencendo')),
    aPagar: grupo(abertos),
  }
}

/** Outro boleto com o mesmo número de arquivo: só avisa, não impede (`2026-10-23`). */
export function boletoComMesmoNumero(base: Base, numero: string, ignorar?: string) {
  const alvo = numero.trim().toLowerCase()
  return alvo ? base.boletos.find((b) => b.id !== ignorar && b.numero.trim().toLowerCase() === alvo) : undefined
}

export type TipoNotificacao = 'atraso' | 'vencendo' | 'estoque-zerado' | 'estoque-baixo' | 'rascunho' | 'boleto-vencido' | 'boleto-vencendo'

export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  tom: 'critico' | 'atencao' | 'neutro'
  titulo: string
  detalhe: string
  destino: string
}

/** O aviso só conta como lido enquanto diz a mesma coisa que foi lida. */
export function assinaturaAviso(aviso: Notificacao) {
  return `${aviso.titulo}|${aviso.detalhe}`
}

export function avisoLido(base: Base, aviso: Notificacao) {
  return base.avisosLidos[aviso.id] === assinaturaAviso(aviso)
}

/** Notinha que vence nestes dias entra no sino antes de atrasar. */
const DIAS_AVISO_VENCIMENTO = 3

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Tudo o que pede atenção agora, do mais grave para o menos grave. */
export function notificacoes(base: Base, hoje: string): Notificacao[] {
  const atrasos: Notificacao[] = []
  const vencendo: Notificacao[] = []
  for (const c of base.clientes) {
    const abertas = notinhasDoCliente(base, c.id, hoje).filter((n) => n.emAberto > 0)
    const atrasadas = abertas.filter((n) => n.situacao === 'vencido')
    if (atrasadas.length) {
      atrasos.push({
        id: `atraso-${c.id}`, tipo: 'atraso', tom: 'critico', titulo: c.nome,
        detalhe: `${plural(atrasadas.length, 'notinha', 'notinhas')} em atraso · ${reais(atrasadas.reduce((t, n) => t + n.emAberto, 0))}`,
        destino: rotas.cliente(c.id),
      })
    }
    const proximas = abertas.filter((n) => n.situacao === 'pendente' && diasEntre(hoje, n.ficha.vencimento ?? hoje) <= DIAS_AVISO_VENCIMENTO)
    if (proximas.length) {
      const dias = Math.min(...proximas.map((n) => diasEntre(hoje, n.ficha.vencimento ?? hoje)))
      vencendo.push({
        id: `vencendo-${c.id}`, tipo: 'vencendo', tom: 'atencao', titulo: c.nome,
        detalhe: `${proximas.length === 1 ? 'Notinha' : `${proximas.length} notinhas`} ${dias === 0 ? 'vence hoje' : `vence em ${plural(dias, 'dia', 'dias')}`} · ${reais(proximas.reduce((t, n) => t + n.emAberto, 0))}`,
        destino: rotas.cliente(c.id),
      })
    }
  }
  // Boletos da loja: os vencidos logo depois das notinhas em atraso; os que vencem, depois das que vencem.
  const abertos = base.boletos.filter((b) => !b.pagoEm).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const boletosVencidos = abertos.filter((b) => situacaoBoleto(b, hoje).situacao === 'vencido')
  const boletosVencendo = abertos.filter((b) => situacaoBoleto(b, hoje).situacao === 'vencendo')
  const descricoes = (lista: Boleto[]) => lista.length === 1 ? lista[0].descricao : `${lista[0].descricao} e mais ${lista.length - 1}`
  const total = (lista: Boleto[]) => reais(lista.reduce((t, b) => t + b.valor, 0))
  if (boletosVencidos.length) {
    atrasos.push({
      id: 'boleto-vencido', tipo: 'boleto-vencido', tom: 'critico',
      titulo: plural(boletosVencidos.length, 'boleto vencido', 'boletos vencidos'),
      detalhe: `${descricoes(boletosVencidos)} · ${total(boletosVencidos)}`, destino: rotas.boletos,
    })
  }
  if (boletosVencendo.length) {
    const prazo = prazoBoleto(situacaoBoleto(boletosVencendo[0], hoje).dias)
    vencendo.push({
      id: 'boleto-vencendo', tipo: 'boleto-vencendo', tom: 'atencao',
      titulo: boletosVencendo.length === 1 ? '1 boleto vence em breve' : `${boletosVencendo.length} boletos vencem em breve`,
      detalhe: `${descricoes(boletosVencendo)} · ${boletosVencendo.length === 1 ? prazo : `o primeiro ${prazo}`} · ${total(boletosVencendo)}`,
      destino: rotas.boletos,
    })
  }
  const avisos = [...atrasos, ...vencendo]

  const nomes = (lista: Produto[]) => lista.length === 1 ? lista[0].descricao : `${lista[0].descricao} e mais ${lista.length - 1}`
  const contados = produtosAtivos(base)
  const zerados = contados.filter((p) => situacaoSaldo(p) === 'zerado')
  const baixos = contados.filter((p) => situacaoSaldo(p) === 'baixo')
  if (zerados.length) {
    avisos.splice(atrasos.length, 0, {
      id: 'estoque-zerado', tipo: 'estoque-zerado', tom: 'critico',
      titulo: plural(zerados.length, 'produto zerado', 'produtos zerados'), detalhe: nomes(zerados), destino: rotas.estoque,
    })
  }
  if (baixos.length) {
    avisos.push({
      id: 'estoque-baixo', tipo: 'estoque-baixo', tom: 'atencao',
      titulo: plural(baixos.length, 'produto com estoque baixo', 'produtos com estoque baixo'), detalhe: nomes(baixos), destino: rotas.estoque,
    })
  }
  // Com a área de notas oculta, o aviso levaria a uma tela sem caminho (`2026-10-19`).
  if (funcoes.notasFiscais && base.rascunhosNota.length) {
    avisos.push({
      id: 'rascunho', tipo: 'rascunho', tom: 'neutro',
      titulo: plural(base.rascunhosNota.length, 'rascunho de nota em revisão', 'rascunhos de nota em revisão'),
      detalhe: 'Conferir antes de emitir', destino: rotas.rascunhosNotas,
    })
  }
  return avisos
}
