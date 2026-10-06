import { useSyncExternalStore } from 'react'
import { assinaturaAviso, CATEGORIA_ADICAO_CAIXA, CATEGORIA_RETIRADA_CAIXA, CATEGORIA_ESTORNO, distribuir, documentoJaCadastrado, faltaEstoqueParaVenda, MOTIVO_SALDO_INICIAL, notinha, produtoTemHistorico, resumoTurnoCaixa, type Abatimento, type Notificacao, type Notinha } from './base/derivados'
import { agoraHorario, dataCalendarioValida, hojeISO, minutoDoDia } from './base/datas'
import { apagarBase, carregarBase, salvarBase } from './base/persistencia'
import { criarBaseVazia, criarSemente } from './base/semente'
import { comFechamentosExemplo } from './base/cenario-caixa'
import type { Base, Estorno, Ficha, Meio, MovimentoCaixa, MovimentoEstoque, Produto, RascunhoFicha } from './base/tipos'

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

export function proximoCodigoProduto(atual: Base) {
  return proximoCodigo(atual.produtos.map((p) => p.codigo), 'EST-')
}

type DadosCliente = { nome: string; documento: string; telefone: string; endereco: string }

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

export function cadastrarProduto(dados: Omit<Produto, 'codigo'>) {
  const codigo = proximoCodigoProduto(base)
  const produto = { ...dados, codigo }
  // Quantidade contada no cadastro vira a primeira entrada: o histórico explica o saldo.
  const inicial = produto.saldo > 0 ? [movimentoEstoque({ ...produto, saldo: 0 }, produto.saldo, 'Entrada', MOTIVO_SALDO_INICIAL)] : []
  mudar({ ...base, produtos: [...base.produtos, produto], movimentosEstoque: [...inicial, ...base.movimentosEstoque] })
  return codigo
}

/**
 * Fecha um cadastro rápido: grava o cadastro completo, tira a marca e, se a
 * contagem da prateleira difere do sistema, registra o ajuste junto.
 */
export function completarProduto(codigo: string, dados: Omit<Produto, 'codigo' | 'saldo' | 'cadastroRapido'>, contagem: number) {
  const produto = base.produtos.find((p) => p.codigo === codigo)
  if (!produto || !Number.isInteger(contagem) || contagem < 0) return false
  const completo: Produto = { ...dados, codigo, saldo: contagem }
  const ajuste = contagem !== produto.saldo ? [movimentoEstoque(produto, contagem, 'Ajuste', 'Contagem ao completar cadastro rápido')] : []
  mudar({
    ...base,
    produtos: base.produtos.map((p) => (p.codigo === codigo ? completo : p)),
    movimentosEstoque: [...ajuste, ...base.movimentosEstoque],
  })
  return true
}

/** Corrige o cadastro. Saldo não muda aqui: só por entrada ou ajuste, para o histórico bater. */
export function editarProduto(codigo: string, dados: Omit<Produto, 'codigo' | 'saldo' | 'cadastroRapido' | 'inativo'>) {
  const produto = base.produtos.find((p) => p.codigo === codigo)
  if (!produto) return false
  const editado: Produto = { ...dados, codigo, saldo: produto.saldo, ...(produto.inativo ? { inativo: true as const } : {}) }
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
  return { id: `${data}-${produto.codigo}-${tipo}`, data, produto: produto.codigo, descricao: produto.descricao, tipo, antes: produto.saldo, depois, motivo, operador: base.operador, ...(entrada ? { entrada } : {}) }
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
  if (!dados.itens.length || dados.itens.some((item) => !Number.isSafeInteger(item.quantidade) || item.quantidade < 1) || new Set(dados.itens.map((item) => item.codigo)).size !== dados.itens.length || faltaEstoqueParaVenda(base, dados.itens)) return null
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

export function marcarAvisosLidos(avisos: Notificacao[]) {
  const lidos = { ...base.avisosLidos }
  for (const aviso of avisos) lidos[aviso.id] = assinaturaAviso(aviso)
  mudar({ ...base, avisosLidos: lidos })
}
