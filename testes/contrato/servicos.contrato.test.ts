/**
 * Serviços (1.0, tela 6.2): os mesmos cenários no mock (base da demonstração)
 * e no SQLite. Regras em Memoria.md, "Serviços". Os serviços nascem pela venda
 * (`concluirFicha`), em dias diferentes: o relógio do cenário anda para trás
 * na hora da venda e volta para hoje (27/10).
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosProduto, PagamentoVenda } from '../../comum/contrato'
import { criarTentativas } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { servicosSqlite } from '../../electron/banco/servicos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarServicosDaBase, type OperacoesServico } from '../../src/mock/operacoes/servicos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesServico

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t), ...criarServicosDaBase() }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco),
    ...vendasSqlite(() => banco, t), ...fichasSqlite(() => banco, t), ...servicosSqlite(() => banco),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: 'Capa', categoria: 'Escolar', unidade: 'un', preco: 500, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}
const CLIENTE: DadosCliente = {
  nome: 'Ana Souza', documento: null, telefone: null, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

type Servico = { nome: string; valor: number; perdas?: number; observacao?: string }

/**
 *   30/09  Xerox antigo R$ 1                              (mês passado)
 *   20/10  Xerox R$ 1,50, 2 perdas "saiu torta", sem cliente
 *   25/10  capa (produto) + Encadernação R$ 6, da Ana
 *   27/10  Impressão R$ 3 com 4 perdas, depois cancelada
 *   27/10  venda só de produto (não entra)
 */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const capa = dado(await api.cadastrarProduto(PRODUTO, 10, dona))
  const ana = dado(await api.cadastrarCliente(CLIENTE)).id
  const pix: PagamentoVenda = { forma: 'pix', maquininha: null }
  const vender = async (dia: string, horario: string, servicos: Servico[], resto: { capas?: number; clienteId?: string } = {}) => {
    vi.setSystemTime(new Date(`${dia}T${horario}:00-03:00`))
    const id = dado(await api.concluirFicha({
      clienteId: resto.clienteId ?? null, itens: resto.capas ? [{ produtoId: capa.id, quantidade: resto.capas, precoVisto: 500 }] : [],
      servicos: servicos.map((s) => ({ nome: s.nome, valor: s.valor, perdas: s.perdas ?? null, observacao: s.observacao ?? null })), desconto: 0, pagamento: pix,
    }, dona)).id
    vi.setSystemTime(AGORA)
    return id
  }
  const antigo = await vender('2026-09-30', '10:00', [{ nome: 'Xerox antigo', valor: 100 }])
  const xerox = await vender('2026-10-20', '10:00', [{ nome: 'Xerox', valor: 150, perdas: 2, observacao: 'saiu torta' }])
  const encadernacao = await vender('2026-10-25', '10:00', [{ nome: 'Encadernação', valor: 600 }], { capas: 2, clienteId: ana })
  const impressao = await vender(HOJE, '09:00', [{ nome: 'Impressão', valor: 300, perdas: 4 }])
  dado(await api.cancelarFicha(impressao, 'Cliente desistiu', dona))
  await vender(HOJE, '10:00', [], { capas: 1 })
  return { capa, antigo, xerox, encadernacao, impressao }
}

const MES = { de: '2026-10-01', ate: HOJE }

testarContrato('serviços', { mock, sqlite }, (abrir) => {
  it('[R-SERVICO-02] os feitos do período, cada um com a ficha; a cancelada fica de fora', async () => {
    const api = abrir('vazia')
    const { xerox, encadernacao } = await loja(api)
    const r = dado(await api.listarServicos(MES))
    expect(r.feitos.map((s) => [s.fichaId, s.servico, s.cliente, s.comProdutos, s.perdas, s.valor, s.observacao])).toEqual([
      [encadernacao, 'Encadernação', 'Ana Souza', true, 0, 600, null],
      [xerox, 'Xerox', null, false, 2, 150, 'saiu torta'],
    ])
    expect(r.feitos[0].numero).toMatch(/^\d{4}$/)
    expect(r.resumo).toMatchObject({ feitos: 2, valorFeitos: 750 })
  })

  it('[R-SERVICO-03] as perdas: a da ficha cancelada continua; nada mexe no estoque', async () => {
    const api = abrir('vazia')
    const { capa, xerox, impressao } = await loja(api)
    const r = dado(await api.listarServicos(MES))
    expect(r.perdas.map((p) => [p.fichaId, p.servico, p.quantidade, p.observacao])).toEqual([
      [impressao, 'Impressão', 4, null], [xerox, 'Xerox', 2, 'saiu torta'],
    ])
    expect(r.resumo).toMatchObject({ anotacoes: 2, unidadesPerdidas: 6 })
    // 10 capas, 2 + 1 vendidas: as perdas dos serviços não baixam nada.
    expect(dado(await api.obterProduto(capa.id)).saldo).toBe(7)
  })

  it('o período pelo dia da ficha; recusa o que não serve', async () => {
    const api = abrir('vazia')
    const { antigo, encadernacao } = await loja(api)
    expect(dado(await api.listarServicos({ de: '2026-10-21', ate: HOJE })).feitos.map((s) => s.fichaId)).toEqual([encadernacao])
    expect(dado(await api.listarServicos({ de: '2026-09-01', ate: '2026-09-30' })).feitos.map((s) => s.fichaId)).toEqual([antigo])
    expect(dado(await api.listarServicos({ de: HOJE, ate: HOJE }))).toEqual({ feitos: [], perdas: [expect.objectContaining({ servico: 'Impressão' })], resumo: { feitos: 0, valorFeitos: 0, anotacoes: 1, unidadesPerdidas: 4 } })
    const recusa = { ok: false, causa: 'validacao' }
    expect(await api.listarServicos({ de: HOJE, ate: '2026-10-28' })).toMatchObject(recusa)
    expect(await api.listarServicos({ de: HOJE, ate: '2026-10-01' })).toMatchObject(recusa)
    expect(await api.listarServicos({ de: '2026-02-30', ate: HOJE })).toMatchObject(recusa)
  })

  it('na semente: os totais batem com as linhas', async () => {
    const api = abrir('semente')
    const r = dado(await api.listarServicos({ de: '2026-08-01', ate: HOJE }))
    // A semente do mock não tem serviço; a do SQLite tem (com perda e ficha cancelada).
    expect(r.resumo.valorFeitos).toBe(r.feitos.reduce((t, s) => t + s.valor, 0))
    expect(r.resumo.unidadesPerdidas).toBe(r.perdas.reduce((t, p) => t + p.quantidade, 0))
  })
})
