import { useSyncExternalStore } from 'react'
import { assinaturaAviso, distribuir, notinha, produtoTemHistorico, type Abatimento, type Notificacao, type Notinha } from './base/derivados'
import { hojeISO, minutoDoDia } from './base/datas'
import { apagarBase, carregarBase, salvarBase } from './base/persistencia'
import { criarSemente } from './base/semente'
import type { Base, Ficha, Meio, MovimentoCaixa, MovimentoEstoque, Produto, RascunhoFicha } from './base/tipos'

export * from './base/derivados'
export * from './base/datas'
export type * from './base/tipos'

/**
 * A base local da demonstração: uma só, gravada no localStorage, lida por todas
 * as telas. Sai de cena quando o banco de verdade entrar (via window.api e contrato).
 */
let base: Base = carregarBase() ?? criarSemente(hojeISO(), minutoDoDia())
salvarBase(base)

const ouvintes = new Set<() => void>()
const inscrever = (ouvinte: () => void) => {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export const obterBase = () => base

function mudar(proxima: Base) {
  base = proxima
  salvarBase(base)
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function useEstadoDemonstracao() {
  return useSyncExternalStore(inscrever, obterBase)
}

/** Volta à amostra de 90 dias até hoje, apagando o que foi feito nesta máquina. */
export function restaurarDemonstracao(hoje = hojeISO(), minutoAtual = minutoDoDia()) {
  apagarBase()
  mudar(criarSemente(hoje, minutoAtual))
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

type DadosCliente = { nome: string; documento: string; telefone: string; email: string; endereco: string }

export function cadastrarCliente(dados: DadosCliente) {
  const id = proximoCodigo(base.clientes.map((c) => c.id), 'CLI-')
  mudar({ ...base, clientes: [...base.clientes, { ...dados, id, descricao: 'Cadastro novo', desde: hojeISO() }] })
  return id
}

export function editarCliente(id: string, dados: DadosCliente) {
  mudar({ ...base, clientes: base.clientes.map((c) => (c.id === id ? { ...c, ...dados } : c)) })
}

export function cadastrarProduto(dados: Omit<Produto, 'codigo'>) {
  const codigo = proximoCodigoProduto(base)
  mudar({ ...base, produtos: [...base.produtos, { ...dados, codigo }] })
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
  mudar({ ...base, produtos: base.produtos.filter((p) => p.codigo !== codigo) })
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

function movimentoEstoque(produto: Produto, depois: number, tipo: MovimentoEstoque['tipo'], motivo: string): MovimentoEstoque {
  const data = new Date().toISOString()
  return { id: `${data}-${produto.codigo}-${tipo}`, data, produto: produto.codigo, descricao: produto.descricao, tipo, antes: produto.saldo, depois, motivo }
}

export function alterarSaldo(codigo: string, depois: number, motivo: string, tipo: 'Entrada' | 'Ajuste') {
  const produto = base.produtos.find((p) => p.codigo === codigo)
  if (!produto || !Number.isInteger(depois) || depois < 0) return false
  mudar({
    ...base,
    produtos: base.produtos.map((p) => (p.codigo === codigo ? { ...p, saldo: depois } : p)),
    movimentosEstoque: [movimentoEstoque(produto, depois, tipo, motivo), ...base.movimentosEstoque],
  })
  return true
}

export function registrarMovimentoCaixa(dados: Omit<MovimentoCaixa, 'id'>) {
  const movimento = { ...dados, id: `${dados.data}-${dados.horario}-${base.movimentosCaixa.length}` }
  mudar({ ...base, movimentosCaixa: [movimento, ...base.movimentosCaixa] })
}

/** Venda concluída: guarda a ficha e dá baixa no estoque; o saldo para em zero. */
export function concluirFicha(dados: Omit<Ficha, 'id' | 'operador'>) {
  const id = proximoNumeroFicha(base)
  const movimentos: MovimentoEstoque[] = []
  const produtos = base.produtos.map((p) => {
    const vendido = dados.itens.find((i) => i.codigo === p.codigo)
    if (!vendido) return p
    const depois = Math.max(0, p.saldo - vendido.quantidade)
    const aviso = p.saldo < vendido.quantidade ? ' · saldo do sistema menor que o vendido' : ''
    movimentos.push(movimentoEstoque(p, depois, 'Venda', `Ficha #${id}${aviso}`))
    return { ...p, saldo: depois }
  })
  mudar({
    ...base,
    fichas: [...base.fichas, { ...dados, id, operador: base.operador }],
    produtos,
    movimentosEstoque: [...movimentos, ...base.movimentosEstoque],
    rascunhoFicha: null,
  })
  return id
}

/** Recebe uma ou várias notinhas; cada uma ganha o pagamento que lhe coube. */
export function receberNotinhas(ids: string[], pagamento: { data: string; horario: string; meio: Meio; valor: number }): Abatimento[] {
  const abertas = base.fichas
    .filter((f) => ids.includes(f.id))
    .map((f) => notinha(f, pagamento.data))
    .filter((n): n is Notinha => n !== null && n.emAberto > 0)
  const abatimentos = distribuir(abertas, pagamento.valor)
  if (!abatimentos.length) return []
  mudar({
    ...base,
    fichas: base.fichas.map((f) => {
      const abatimento = abatimentos.find((a) => a.id === f.id)
      if (!abatimento) return f
      return { ...f, pagamentos: [...f.pagamentos, { data: pagamento.data, horario: pagamento.horario, meio: pagamento.meio, valor: abatimento.valor }] }
    }),
  })
  return abatimentos
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
