import { useSyncExternalStore } from 'react'
import { assinaturaAviso, CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, CATEGORIA_ESTORNO, distribuir, documentoJaCadastrado, faltaEstoqueParaVenda, MOTIVO_SALDO_INICIAL, notinha, produtoTemHistorico, resumoTurnoCaixa, type Abatimento, type Notificacao, type Notinha } from './base/derivados'
import { agoraHorario, dataCalendarioValida, hojeISO, minutoDoDia } from './base/datas'
import { apagarBase, carregarBase, salvarBase } from './base/persistencia'
import { criarBaseVazia, criarSemente } from './base/semente'
import { comFechamentosExemplo } from './base/cenario-caixa'
import type { Base, Boleto, Cliente, Estorno, ServicoVenda, Ficha, Meio, MovimentoCaixa, MovimentoEstoque, Produto, RascunhoFicha } from './base/tipos'

export * from './base/derivados'
export * from './base/datas'
export type * from './base/tipos'

/**
 * A base da loja: uma só, lida por todas as telas. Toda mudança grava a cópia no
 * computador (localStorage) na hora; quem leva ao banco é `src/dados/sincronia.ts`,
 * que também decide, ao abrir o app, qual versão vale.
 *
 * Piloto 0.1 (Memoria.md, `2026-10-06`): a 1.0 troca isto por uma operação do
 * contrato por gesto do usuário.
 */
let base: Base = carregarBase() ?? criarBaseVazia(hojeISO())

const ouvintes = new Set<() => void>()
/** Quem precisa saber que o USUÁRIO mudou algo (a sincronia), não só que a tela mudou. */
const aoMudar = new Set<() => void>()
const inscrever = (ouvinte: () => void) => {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export const obterBase = () => base

const turnoCaixaAberto = () => (base.turnosCaixa ?? []).find((turno) => !turno.fechadoEm)?.id

function mudar(proxima: Base) {
  base = proxima
  salvarBase(base)
  ouvintes.forEach((ouvinte) => ouvinte())
  aoMudar.forEach((observador) => observador())
}

/** Troca a base inteira pela versão escolhida ao abrir o app, sem contar como mudança do usuário. */
export function substituirBase(nova: Base) {
  base = nova
  salvarBase(base)
  ouvintes.forEach((ouvinte) => ouvinte())
}

/** Operadores (1.0, tela 1): quem chama é `src/mock/operacoes/operadores.ts`, que confere as regras. */
export function gravarOperadores(operadores: Base['operadores']) {
  mudar({ ...base, operadores })
}

/** Quem assinou o último gesto vem marcado no próximo (`R-OPERADOR-02`). */
export function gravarUltimoOperador(id: string) {
  if (base.ultimoOperadorId !== id) mudar({ ...base, ultimoOperadorId: id })
}

export function observarMudancas(observador: () => void) {
  aoMudar.add(observador)
  return () => { aoMudar.delete(observador) }
}

export function useEstadoDemonstracao() {
  return useSyncExternalStore(inscrever, obterBase)
}

/** Volta à amostra de 90 dias até hoje, apagando o que foi feito nesta máquina. */
export function restaurarDemonstracao(hoje = hojeISO(), minutoAtual = minutoDoDia()) {
  apagarBase()
  const semente = criarSemente(hoje, minutoAtual)
  mudar(import.meta.env.MODE === 'development' ? comFechamentosExemplo(semente, hoje) : semente)
}

function proximoCodigo(codigos: string[], prefixo: string) {
  const maior = Math.max(0, ...codigos.map((codigo) => Number(codigo.slice(prefixo.length)) || 0))
  return `${prefixo}${String(maior + 1).padStart(4, '0')}`
}

export function proximoNumeroFicha(atual: Base) {
  return String(Math.max(0, ...atual.fichas.map((f) => Number(f.id))) + 1).padStart(4, '0')
}

/** Nome e valor inteiro não negativo; perda, se houver, com quantidade positiva. */
function servicoVendaValido(s: ServicoVenda) {
  if (!s.nome.trim() || !Number.isSafeInteger(s.valor) || s.valor < 0) return false
  if (s.perdas && (!Number.isSafeInteger(s.perdas.quantidade) || s.perdas.quantidade < 1)) return false
  return true
}

export function proximoCodigoProduto(atual: Base) {
  return proximoCodigo(atual.produtos.map((p) => p.codigo), 'EST-')
}

type DadosCliente = { nome: string; documento: string; telefone: string; endereco: string; fiscal?: Cliente['fiscal'] }

export function cadastrarCliente(dados: DadosCliente) {
  if (documentoJaCadastrado(base.clientes, dados.documento)) return null
  const id = proximoCodigo(base.clientes.map((c) => c.id), 'CLI-')
  mudar({ ...base, clientes: [...base.clientes, { ...dados, id, descricao: 'Cadastro novo', desde: hojeISO() }] })
  return id
}

export function editarCliente(id: string, dados: DadosCliente) {
  if (!base.clientes.some((cliente) => cliente.id === id) || documentoJaCadastrado(base.clientes, dados.documento, id)) return false
  mudar({ ...base, clientes: base.clientes.map((c) => (c.id === id ? { ...c, ...dados } : c)) })
  return true
}

/** `operador`: quem assinou a quantidade inicial (`R-ESTOQUE-07`); sem ele, o da base (0.1). */
export function cadastrarProduto(dados: Omit<Produto, 'codigo'>, operador = base.operador) {
  const codigo = proximoCodigoProduto(base)
  const produto = { ...dados, codigo }
  // Quantidade contada no cadastro vira a primeira entrada: o histórico explica o saldo.
  const inicial = produto.saldo > 0 ? [{ ...movimentoEstoque({ ...produto, saldo: 0 }, produto.saldo, 'Entrada', MOTIVO_SALDO_INICIAL), operador }] : []
  mudar({ ...base, produtos: [...base.produtos, produto], movimentosEstoque: [...inicial, ...base.movimentosEstoque] })
  return codigo
}

/** Corrige o cadastro. Saldo não muda aqui: só por entrada ou ajuste, para o histórico bater. */
export function editarProduto(codigo: string, dados: Omit<Produto, 'codigo' | 'saldo' | 'inativo'>) {
  const produto = base.produtos.find((p) => p.codigo === codigo)
  if (!produto) return false
  const editado: Produto = {
    ...dados, codigo, saldo: produto.saldo,
    ...(produto.inativo ? { inativo: true as const } : {}),
    // Sem isto, editar faria o produto ir de novo para a Emitte, que duplicaria.
    ...(produto.emitteEnviadoEm ? { emitteEnviadoEm: produto.emitteEnviadoEm } : {}),
  }
  mudar({ ...base, produtos: base.produtos.map((p) => (p.codigo === codigo ? editado : p)) })
  return true
}

/** Apaga só cadastro sem nenhum registro; com histórico, o caminho é desativar. */
export function excluirProduto(codigo: string) {
  if (!base.produtos.some((p) => p.codigo === codigo) || produtoTemHistorico(base, codigo)) return false
  // Sem histórico, o único movimento possível é o saldo inicial do próprio cadastro.
  mudar({ ...base, produtos: base.produtos.filter((p) => p.codigo !== codigo), movimentosEstoque: base.movimentosEstoque.filter((m) => m.produto !== codigo) })
  return true
}

export function definirProdutoAtivo(codigo: string, ativo: boolean) {
  mudar({
    ...base,
    produtos: base.produtos.map((p) => {
      if (p.codigo !== codigo) return p
      const { inativo: _inativo, ...resto } = p
      return ativo ? resto : { ...resto, inativo: true as const }
    }),
  })
}

function movimentoEstoque(produto: Produto, depois: number, tipo: MovimentoEstoque['tipo'], motivo: string, entrada?: MovimentoEstoque['entrada']): MovimentoEstoque {
  const data = new Date().toISOString()
  // O sufixo aleatório separa dois movimentos do mesmo produto no mesmo milissegundo (a conferência marca pelo id).
  return { id: `${data}-${produto.codigo}-${tipo}-${crypto.randomUUID().slice(0, 8)}`, data, produto: produto.codigo, descricao: produto.descricao, tipo, antes: produto.saldo, depois, motivo, operador: base.operador, ...(entrada ? { entrada } : {}) }
}

/**
 * Uma entrega inteira de uma vez (1.0, `registrarEntrada`; quem confere é
 * `src/mock/operacoes/entradas.ts`): soma cada quantidade ao saldo de agora,
 * nunca grava um saldo final vindo da tela.
 */
export function gravarEntrada(
  itens: { codigo: string; quantidade: number; custoUnitario?: number }[],
  entrada: Omit<NonNullable<MovimentoEstoque['entrada']>, 'custoUnitario'>,
  motivo: string,
  operador: string,
) {
  let produtos = base.produtos
  const movimentos: MovimentoEstoque[] = []
  for (const item of itens) {
    const produto = produtos.find((p) => p.codigo === item.codigo)!
    const depois = produto.saldo + item.quantidade
    const custo = item.custoUnitario === undefined ? {} : { custoUnitario: item.custoUnitario }
    movimentos.unshift({ ...movimentoEstoque(produto, depois, 'Entrada', motivo, { ...entrada, ...custo }), operador })
    produtos = produtos.map((p) => (p.codigo === item.codigo ? { ...p, saldo: depois } : p))
  }
  mudar({ ...base, produtos, movimentosEstoque: [...movimentos, ...base.movimentosEstoque] })
}

/**
 * Ajuste de contagem (1.0, `ajustarEstoque`; quem confere é
 * `src/mock/operacoes/ajustes.ts`): o saldo vira a contagem. Feito pela dona,
 * já nasce conferido (`R-ESTOQUE-11`).
 */
export function gravarAjuste(codigo: string, contagem: number, motivo: string, operador: string, conferidoPor?: string) {
  const produto = base.produtos.find((p) => p.codigo === codigo)!
  const feito = movimentoEstoque(produto, contagem, 'Ajuste', motivo)
  const movimento = { ...feito, operador, ...(conferidoPor ? { conferidoPor, conferidoEm: feito.data } : {}) }
  mudar({
    ...base,
    produtos: base.produtos.map((p) => (p.codigo === codigo ? { ...p, saldo: contagem } : p)),
    movimentosEstoque: [movimento, ...base.movimentosEstoque],
  })
}

/** A dona confere ajustes (`R-ESTOQUE-11`): o visto, com o nome dela e o instante. */
export function gravarConferencia(ids: string[], conferidoPor: string) {
  const agora = new Date().toISOString()
  const marcar = new Set(ids)
  mudar({
    ...base,
    movimentosEstoque: base.movimentosEstoque.map((m) => (marcar.has(m.id) ? { ...m, conferidoPor, conferidoEm: agora } : m)),
  })
}

export function alterarSaldo(codigo: string, depois: number, motivo: string, tipo: 'Entrada' | 'Ajuste', entrada?: MovimentoEstoque['entrada']) {
  const produto = base.produtos.find((p) => p.codigo === codigo)
  if (!produto || !Number.isInteger(depois) || depois < 0) return false
  if (entrada && (tipo !== 'Entrada' || !dataCalendarioValida(entrada.recebidaEm) || entrada.recebidaEm > hojeISO())) return false
  if (entrada?.custoUnitario !== undefined && (!Number.isSafeInteger(entrada.custoUnitario) || entrada.custoUnitario < 0)) return false
  mudar({
    ...base,
    produtos: base.produtos.map((p) => (p.codigo === codigo ? { ...p, saldo: depois } : p)),
    movimentosEstoque: [movimentoEstoque(produto, depois, tipo, motivo, entrada), ...base.movimentosEstoque],
  })
  return true
}

export function registrarMovimentoCaixa(dados: Omit<MovimentoCaixa, 'id'>) {
  if (!Number.isSafeInteger(dados.valor) || dados.valor === 0 || !dados.descricao.trim()) return false
  if (dados.categoria === CATEGORIA_RETIRADA_CAIXA && (dados.meio !== 'dinheiro' || dados.valor >= 0)) return false
  if (dados.categoria === CATEGORIA_ADICAO_CAIXA && (dados.meio !== 'dinheiro' || dados.valor <= 0 || !turnoCaixaAberto())) return false
  const movimento = { ...dados, id: `${dados.data}-${dados.horario}-${base.movimentosCaixa.length}`, operador: base.operador, registradoEm: new Date().toISOString(), turnoCaixaId: turnoCaixaAberto() }
  mudar({ ...base, movimentosCaixa: [movimento, ...base.movimentosCaixa] })
  return true
}

/** Transferir notas/moedas exige uma conferência aberta, sem criar receita/despesa. */
export function movimentarDinheiroCaixa(acao: 'adicionar' | 'retirar', valor: number, motivo: string) {
  if (!turnoCaixaAberto() || !Number.isSafeInteger(valor) || valor <= 0 || !motivo.trim()) return false
  return registrarMovimentoCaixa({ data: hojeISO(), horario: agoraHorario(), descricao: motivo.trim(), origem: 'Movimentação da gaveta', categoria: acao === 'adicionar' ? CATEGORIA_ADICAO_CAIXA : CATEGORIA_RETIRADA_CAIXA, meio: 'dinheiro', valor: acao === 'adicionar' ? valor : -valor })
}

/** Abre uma conferência a partir do dinheiro contado agora. */
export function abrirTurnoCaixa(fundoInicial: number) {
  if (!Number.isSafeInteger(fundoInicial) || fundoInicial < 0 || (base.turnosCaixa ?? []).some((turno) => !turno.fechadoEm)) return false
  const abertoEm = new Date().toISOString()
  mudar({
    ...base,
    turnosCaixa: [{ id: `${abertoEm}-${(base.turnosCaixa ?? []).length}`, abertoEm, operadorAbertura: base.operador, fundoInicial }, ...(base.turnosCaixa ?? [])],
  })
  return true
}

/** Fecha sem reescrever movimentos; diferença exige explicação. */
export function fecharTurnoCaixa(id: string, contadoFechamento: number, justificativaDiferenca: string) {
  const turno = (base.turnosCaixa ?? []).find((item) => item.id === id)
  if (!turno || turno.fechadoEm || !Number.isSafeInteger(contadoFechamento) || contadoFechamento < 0) return false
  const fechadoEm = new Date().toISOString()
  const esperadoFechamento = resumoTurnoCaixa(base, { ...turno, fechadoEm }).esperado
  if (contadoFechamento !== esperadoFechamento && !justificativaDiferenca.trim()) return false
  mudar({
    ...base,
    turnosCaixa: (base.turnosCaixa ?? []).map((item) => item.id === id ? {
      ...item, fechadoEm, operadorFechamento: base.operador, esperadoFechamento, contadoFechamento,
      justificativaDiferenca: justificativaDiferenca.trim() || undefined,
    } : item),
  })
  return true
}

/** Venda concluída somente se todas as unidades já existirem no estoque. */
export function concluirFicha(dados: Omit<Ficha, 'id' | 'operador'>) {
  // Ficha só de serviço vale: uma cópia não tem item de estoque.
  const servicos = dados.servicos ?? []
  if (servicos.some((s) => !servicoVendaValido(s))) return null
  if (!dados.itens.length && !servicos.length) return null
  if (dados.itens.some((item) => !Number.isSafeInteger(item.quantidade) || item.quantidade < 1) || new Set(dados.itens.map((item) => item.codigo)).size !== dados.itens.length || faltaEstoqueParaVenda(base, dados.itens)) return null
  const meios = new Set(dados.pagamentos.map((pagamento) => pagamento.meio))
  const somaPagamentos = dados.pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0)
  if (dados.forma === 'misto' && (meios.size < 2 || meios.size !== dados.pagamentos.length || somaPagamentos !== dados.total || dados.pagamentos.some((pagamento) => pagamento.valor <= 0))) return null
  if (dados.forma !== 'misto' && dados.forma !== 'notinha' && (dados.pagamentos.length !== 1 || dados.pagamentos[0].meio !== dados.forma || somaPagamentos !== dados.total)) return null
  if (dados.pagamentos.some((pagamento) => !Number.isSafeInteger(pagamento.valor) || pagamento.valor < 0)) return null
  const id = proximoNumeroFicha(base)
  const movimentos: MovimentoEstoque[] = []
  const baixas = new Map<string, number>()
  const produtos = base.produtos.map((p) => {
    const vendido = dados.itens.find((i) => i.codigo === p.codigo)
    if (!vendido) return p
    const depois = p.saldo - vendido.quantidade
    baixas.set(p.codigo, p.saldo - depois)
    movimentos.push(movimentoEstoque(p, depois, 'Venda', `Ficha #${id}`))
    return { ...p, saldo: depois }
  })
  mudar({
    ...base,
    fichas: [...base.fichas, {
      ...dados,
      id,
      operador: base.operador,
      itens: dados.itens.map((item) => ({ ...item, baixaEstoque: baixas.get(item.codigo) ?? 0 })),
      ...(servicos.length ? { servicos: servicos.map((s) => ({ ...s, nome: s.nome.trim() })) } : {}),
      pagamentos: dados.pagamentos.map((pagamento) => ({ ...pagamento, operador: base.operador, registradoEm: new Date().toISOString(), turnoCaixaId: turnoCaixaAberto() })),
    }],
    produtos,
    movimentosEstoque: [...movimentos, ...base.movimentosEstoque],
    rascunhoFicha: null,
  })
  return id
}

type RecebimentoNotinhas = { data: string; horario: string } & (
  | { meio: Meio; valor: number }
  | { parcelas: { meio: Meio; valor: number }[] }
)

/** Recebe uma ou várias notinhas, em uma gravação; cada meio conserva seu valor. */
export function receberNotinhas(ids: string[], pagamento: RecebimentoNotinhas): Abatimento[] {
  const parcelas = 'parcelas' in pagamento ? pagamento.parcelas : [{ meio: pagamento.meio, valor: pagamento.valor }]
  const total = parcelas.reduce((soma, parcela) => soma + parcela.valor, 0)
  if (!ids.length || new Set(ids).size !== ids.length || !parcelas.length ||
    parcelas.some((parcela) => !['dinheiro', 'pix', 'cartao'].includes(parcela.meio) || !Number.isSafeInteger(parcela.valor) || parcela.valor <= 0) ||
    new Set(parcelas.map((parcela) => parcela.meio)).size !== parcelas.length || !Number.isSafeInteger(total) ||
    !dataCalendarioValida(pagamento.data) || pagamento.data > hojeISO()) return []
  const abertas = base.fichas
    .filter((f) => ids.includes(f.id))
    .map((f) => notinha(f, pagamento.data))
    .filter((n): n is Notinha => n !== null && n.emAberto > 0)
  if (abertas.length !== ids.length || new Set(abertas.map((n) => n.ficha.clienteId)).size !== 1 ||
    total > abertas.reduce((soma, n) => soma + n.emAberto, 0)) return []
  const abatimentos = distribuir(abertas, total)
  if (abatimentos.some((abatimento) => abertas.find((n) => n.ficha.id === abatimento.id)!.ficha.data > pagamento.data)) return []
  const restantePorMeio = parcelas.map((parcela) => ({ ...parcela }))
  const pagamentosPorFicha = new Map<string, { meio: Meio; valor: number }[]>()
  for (const abatimento of abatimentos) {
    let restante = abatimento.valor
    const recebidos: { meio: Meio; valor: number }[] = []
    for (const parcela of restantePorMeio) {
      const valor = Math.min(restante, parcela.valor)
      if (valor > 0) recebidos.push({ meio: parcela.meio, valor })
      parcela.valor -= valor
      restante -= valor
    }
    pagamentosPorFicha.set(abatimento.id, recebidos)
  }
  const registradoEm = new Date().toISOString()
  const turnoCaixaId = turnoCaixaAberto()
  mudar({
    ...base,
    fichas: base.fichas.map((f) => {
      const recebidos = pagamentosPorFicha.get(f.id)
      if (!recebidos) return f
      return { ...f, pagamentos: [...f.pagamentos, ...recebidos.map((parcela) => ({ ...parcela, data: pagamento.data, horario: pagamento.horario, operador: base.operador, registradoEm, turnoCaixaId }))] }
    }),
  })
  return abatimentos
}

function estornoAgora(motivo: string): Estorno {
  return { data: hojeISO(), horario: agoraHorario(), motivo: motivo.trim(), operador: base.operador, registradoEm: new Date().toISOString(), turnoCaixaId: turnoCaixaAberto() }
}

/**
 * Desfaz uma venda sem apagá-la: a ficha fica marcada como cancelada, os itens
 * voltam ao estoque e o que foi pago sai do caixa hoje (os dias passados não mudam).
 */
export function cancelarFicha(id: string, motivo: string) {
  const ficha = base.fichas.find((f) => f.id === id)
  if (!ficha || ficha.cancelamento || !motivo.trim()) return false
  const movimentos: MovimentoEstoque[] = []
  const produtos = base.produtos.map((p) => {
    const devolvido = ficha.itens.find((i) => i.codigo === p.codigo)
    if (!devolvido) return p
    // Fichas antigas não têm baixaEstoque: preservam a regra anterior.
    const baixa = devolvido.baixaEstoque ?? devolvido.quantidade
    movimentos.push(movimentoEstoque(p, p.saldo + baixa, 'Cancelamento', `Ficha #${id} cancelada · ${motivo.trim()}`))
    return { ...p, saldo: p.saldo + baixa }
  })
  mudar({
    ...base,
    fichas: base.fichas.map((f) => (f.id === id ? { ...f, cancelamento: estornoAgora(motivo) } : f)),
    produtos,
    movimentosEstoque: [...movimentos, ...base.movimentosEstoque],
  })
  return true
}

/** Recebimento de notinha lançado por engano: deixa de contar e a notinha volta a dever. */
export function estornarPagamento(fichaId: string, indice: number, motivo: string) {
  const ficha = base.fichas.find((f) => f.id === fichaId)
  const pagamento = ficha?.pagamentos[indice]
  if (!ficha || ficha.cancelamento || ficha.forma !== 'notinha' || !pagamento || pagamento.estorno || !motivo.trim()) return false
  const pagamentos = ficha.pagamentos.map((p, i) => (i === indice ? { ...p, estorno: estornoAgora(motivo) } : p))
  mudar({ ...base, fichas: base.fichas.map((f) => (f.id === fichaId ? { ...f, pagamentos } : f)) })
  return true
}

/** Lançamento manual errado: um lançamento novo, de sinal contrário, anula o primeiro. */
export function estornarMovimentoCaixa(id: string, motivo: string) {
  const original = base.movimentosCaixa.find((m) => m.id === id)
  if (!original || original.estornoDe || base.movimentosCaixa.some((m) => m.estornoDe === id) || !motivo.trim()) return false
  const { data, horario, registradoEm, turnoCaixaId } = estornoAgora(motivo)
  const estorno: MovimentoCaixa = {
    id: `${data}-${horario}-${base.movimentosCaixa.length}`,
    data,
    horario,
    descricao: `Estorno: ${original.descricao}`,
    origem: motivo.trim(),
    categoria: CATEGORIA_ESTORNO,
    meio: original.meio,
    valor: -original.valor,
    operador: base.operador,
    registradoEm,
    turnoCaixaId,
    estornoDe: id,
  }
  mudar({ ...base, movimentosCaixa: [estorno, ...base.movimentosCaixa] })
  return true
}

/** Lembrete na ficha. Só se acrescenta: o que foi anotado fica como foi. */
export function anotarFicha(id: string, texto: string) {
  if (!texto.trim() || !base.fichas.some((f) => f.id === id)) return false
  mudar({
    ...base,
    fichas: base.fichas.map((f) => (f.id === id ? { ...f, anotacoes: [...(f.anotacoes ?? []), { data: hojeISO(), horario: agoraHorario(), texto: texto.trim() }] } : f)),
  })
  return true
}

export function salvarRascunhoFicha(rascunho: RascunhoFicha | null) {
  mudar({ ...base, rascunhoFicha: rascunho })
}

export function prepararRascunho(id: string) {
  if (!base.rascunhosNota.includes(id)) mudar({ ...base, rascunhosNota: [id, ...base.rascunhosNota] })
}

/**
 * A dona confirmou que importou na Emitte: esses não vão mais nas próximas
 * exportações (a Emitte duplicaria — ela só cria, nunca atualiza).
 */
export function marcarEnviadosEmitte(tipo: 'produtos' | 'clientes', ids: string[]) {
  const agora = new Date().toISOString()
  const marcar = new Set(ids)
  if (tipo === 'produtos') mudar({ ...base, produtos: base.produtos.map((p) => (marcar.has(p.codigo) && !p.emitteEnviadoEm ? { ...p, emitteEnviadoEm: agora } : p)) })
  else mudar({ ...base, clientes: base.clientes.map((c) => (marcar.has(c.id) && !c.emitteEnviadoEm ? { ...c, emitteEnviadoEm: agora } : c)) })
}

type DadosBoleto = Pick<Boleto, 'descricao' | 'valor' | 'numero' | 'vencimento'>

/** Descrição e número com texto, valor positivo em centavos, vencimento de calendário. */
function dadosBoleto(dados: DadosBoleto): DadosBoleto | null {
  const descricao = dados.descricao.trim()
  const numero = dados.numero.trim()
  if (!descricao || !numero || !Number.isSafeInteger(dados.valor) || dados.valor <= 0 || !dataCalendarioValida(dados.vencimento)) return null
  return { descricao, valor: dados.valor, numero, vencimento: dados.vencimento }
}

/** A data de cadastro nasce aqui, não vem da tela (`2026-10-23`). */
export function cadastrarBoleto(dados: DadosBoleto) {
  const limpos = dadosBoleto(dados)
  if (!limpos) return null
  const id = proximoCodigo(base.boletos.map((b) => b.id), 'BOL-')
  mudar({ ...base, boletos: [...base.boletos, { ...limpos, id, cadastradoEm: new Date().toISOString() }] })
  return id
}

/** Corrige os dados; data de cadastro e pagamento ficam como estavam. */
export function editarBoleto(id: string, dados: DadosBoleto) {
  const limpos = dadosBoleto(dados)
  if (!limpos || !base.boletos.some((b) => b.id === id)) return false
  mudar({ ...base, boletos: base.boletos.map((b) => (b.id === id ? { ...b, ...limpos } : b)) })
  return true
}

/**
 * Marca como pago hoje, por quem está no balcão, ou desfaz. Só anotação: não
 * lança no Financeiro. A confirmação do operador está sendo desenhada à parte
 * (Memoria.md, PENDENTE); por ora a tela pede um segundo clique.
 */
export function marcarBoletoPago(id: string, pago: boolean) {
  const boleto = base.boletos.find((b) => b.id === id)
  if (!boleto || Boolean(boleto.pagoEm) === pago) return false
  const { pagoEm: _pagoEm, pagoPor: _pagoPor, ...aberto } = boleto
  const proximo: Boleto = pago ? { ...aberto, pagoEm: hojeISO(), pagoPor: base.operador } : aberto
  mudar({ ...base, boletos: base.boletos.map((b) => (b.id === id ? proximo : b)) })
  return true
}

/** Boleto lançado por engano. Não há histórico ligado a ele. */
export function excluirBoleto(id: string) {
  if (!base.boletos.some((b) => b.id === id)) return false
  mudar({ ...base, boletos: base.boletos.filter((b) => b.id !== id) })
  return true
}

export function marcarAvisosLidos(avisos: Notificacao[]) {
  const lidos = { ...base.avisosLidos }
  for (const aviso of avisos) lidos[aviso.id] = assinaturaAviso(aviso)
  mudar({ ...base, avisosLidos: lidos })
}
