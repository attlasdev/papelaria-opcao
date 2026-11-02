/**
 * Vendas sem identificação (1.0, tela 5.3): os mesmos cenários no mock (base
 * da demonstração) e no SQLite. Regras em Memoria.md, "Clientes". As vendas
 * nascem pela venda (`concluirFicha`), em dias diferentes: o relógio do
 * cenário anda para trás na hora da venda e volta para hoje (27/10, terça).
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosProduto, FiltroMeioVenda, PagamentoVenda, PeriodoVendas } from '../../comum/contrato'
import { criarTentativas } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { vendasSemIdentificacaoSqlite } from '../../electron/banco/vendas-sem-identificacao'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { criarVendasSemIdentificacaoDaBase, type OperacoesSemIdentificacao } from '../../src/mock/operacoes/vendas-sem-identificacao'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesSemIdentificacao

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t), ...criarVendasSemIdentificacaoDaBase() }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco),
    ...vendasSqlite(() => banco, t), ...fichasSqlite(() => banco, t), ...vendasSemIdentificacaoSqlite(() => banco),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: 'Caderno', categoria: 'Escolar', unidade: 'un', preco: 100, custo: null, minimo: 0,
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

/**
 * Seis vendas sem cliente e uma com cliente (que nunca entra):
 *   30/09  dinheiro R$ 4                       (mês passado)
 *   20/10  dinheiro R$ 10                      (semana passada)
 *   25/10  Pix R$ 20                           (domingo: começa a semana)
 *   27/10  misto dinheiro R$ 5 + cartão R$ 10  (hoje)
 *   27/10  cartão no Sicoob R$ 30, cancelada   (hoje)
 *   27/10  só serviço, Pix R$ 7                (hoje)
 */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const caderno = dado(await api.cadastrarProduto(PRODUTO, 100, dona))
  const ana = dado(await api.cadastrarCliente(CLIENTE)).id
  const vender = async (dia: string, horario: string, quantidade: number, pagamento: PagamentoVenda, resto: { clienteId?: string; servicos?: { nome: string; valor: number }[] } = {}) => {
    vi.setSystemTime(new Date(`${dia}T${horario}:00-03:00`))
    const itens = quantidade ? [{ produtoId: caderno.id, quantidade, precoVisto: 100 }] : []
    const servicos = (resto.servicos ?? []).map((s) => ({ ...s, perdas: null, observacao: null }))
    const id = dado(await api.concluirFicha({ clienteId: resto.clienteId ?? null, itens, servicos, desconto: 0, pagamento }, dona)).id
    vi.setSystemTime(AGORA)
    return id
  }
  const setembro = await vender('2026-09-30', '10:00', 4, { forma: 'dinheiro', recebido: 400 })
  const semanaPassada = await vender('2026-10-20', '10:00', 10, { forma: 'dinheiro', recebido: 1000 })
  const domingo = await vender('2026-10-25', '10:00', 20, { forma: 'pix', maquininha: null })
  const misto = await vender(HOJE, '09:00', 15, { forma: 'misto', parcelas: [{ meio: 'dinheiro', valor: 500 }, { meio: 'cartao', valor: 1000 }], recebido: 500, cartao: { cartao: 'debito' } })
  const cancelada = await vender(HOJE, '10:00', 30, { forma: 'cartao', cartao: 'credito', maquininha: 'sicoob', bandeira: null })
  dado(await api.cancelarFicha(cancelada, 'Cobrado errado', dona))
  const servico = await vender(HOJE, '11:00', 0, { forma: 'pix', maquininha: null }, { servicos: [{ nome: 'Xerox', valor: 700 }] })
  await vender(HOJE, '12:00', 5, { forma: 'dinheiro', recebido: 500 }, { clienteId: ana })
  return { setembro, semanaPassada, domingo, misto, cancelada, servico }
}

const lista = async (api: Api, periodo: PeriodoVendas, meio: FiltroMeioVenda = 'todos', pagina = 1, porPagina = 20) =>
  dado(await api.listarVendasSemIdentificacao(periodo, meio, pagina, porPagina))
const HOJE_SO: PeriodoVendas = { de: HOJE, ate: HOJE }

testarContrato('vendas sem identificação', { mock, sqlite }, (abrir) => {
  it('[R-CLIENTE-07] o dia: da mais nova para a mais velha; o misto em cada meio; a cancelada na lista e fora dos cartões', async () => {
    const api = abrir('vazia')
    const { misto, cancelada, servico } = await loja(api)
    const r = await lista(api, HOJE_SO)
    expect(r.vendas.map((v) => [v.id, v.forma, v.total, v.cancelada])).toEqual([
      [servico, 'pix', 700, false], [cancelada, 'cartao', 3000, true], [misto, 'misto', 1500, false],
    ])
    expect(r.contagem).toEqual({ todos: 3, dinheiro: 1, pix: 1, cartao: 2 })
    expect(r.resumo).toEqual({
      vendas: 2, totalVendido: 2200,
      porMeio: { dinheiro: { valor: 500, vendas: 1 }, pix: { valor: 700, vendas: 1 }, cartao: { valor: 1000, vendas: 1 } },
    })
    // A aba mostra as linhas que conta, canceladas inclusive.
    const noCartao = await lista(api, HOJE_SO, 'cartao')
    expect([noCartao.total, noCartao.vendas.map((v) => v.id)]).toEqual([2, [cancelada, misto]])
    expect((await lista(api, HOJE_SO, 'dinheiro')).vendas.map((v) => v.id)).toEqual([misto])
    // O filtro escolhe as linhas; as abas e os cartões continuam os do período.
    expect([noCartao.contagem, noCartao.resumo.totalVendido]).toEqual([r.contagem, 2200])
  })

  it('[R-CLIENTE-07] cada linha traz o rótulo, os itens e os serviços', async () => {
    const api = abrir('vazia')
    const { misto, cancelada, servico } = await loja(api)
    const r = await lista(api, HOJE_SO)
    const por = (id: string) => r.vendas.find((v) => v.id === id)!
    expect(por(cancelada)).toMatchObject({ rotulo: 'Cartão crédito · Sicoob', itens: [{ descricao: 'Caderno', quantidade: 30 }], servicos: [] })
    expect(por(misto)).toMatchObject({ rotulo: null, itens: [{ descricao: 'Caderno', quantidade: 15 }] })
    expect(por(servico)).toMatchObject({ rotulo: 'Pix manual', itens: [], servicos: ['Xerox'] })
    expect(por(misto).numero).toMatch(/^\d{4}$/)
  })

  it('os períodos: semana (domingo a sábado), mês e todo o histórico; venda com cliente nunca entra', async () => {
    const api = abrir('vazia')
    const { setembro, semanaPassada, domingo } = await loja(api)
    const semana = await lista(api, { de: '2026-10-25', ate: HOJE })
    expect([semana.total, semana.vendas.at(-1)?.id]).toEqual([4, domingo])
    const mes = await lista(api, { de: '2026-10-01', ate: HOJE })
    expect([mes.total, mes.vendas.at(-1)?.id]).toEqual([5, semanaPassada])
    const tudo = await lista(api, null)
    expect([tudo.total, tudo.vendas.at(-1)?.id, tudo.resumo.vendas]).toEqual([6, setembro, 5])
  })

  it('pagina no back e recusa o pedido fora do formato', async () => {
    const api = abrir('vazia')
    await loja(api)
    const segunda = await lista(api, null, 'todos', 2, 4)
    expect([segunda.pagina, segunda.total, segunda.vendas.length]).toEqual([2, 6, 2])
    expect((await lista(api, null, 'todos', 9, 4)).pagina).toBe(2)
    const recusa = { ok: false, causa: 'validacao' }
    expect(await api.listarVendasSemIdentificacao({ de: HOJE, ate: '2026-10-28' }, 'todos', 1, 10)).toMatchObject(recusa)
    expect(await api.listarVendasSemIdentificacao({ de: HOJE, ate: '2026-10-20' }, 'todos', 1, 10)).toMatchObject(recusa)
    expect(await api.listarVendasSemIdentificacao({ de: '2026-02-30', ate: HOJE }, 'todos', 1, 10)).toMatchObject(recusa)
    expect(await api.listarVendasSemIdentificacao(HOJE_SO, 'notinha' as FiltroMeioVenda, 1, 10)).toMatchObject(recusa)
    expect(await api.listarVendasSemIdentificacao(HOJE_SO, 'todos', 1, 101)).toMatchObject(recusa)
  })

  it('na semente: o dia de hoje bate com o "vendas hoje" da lista de clientes', async () => {
    const api = abrir('semente')
    const hoje = await lista(api, HOJE_SO)
    expect(hoje.contagem.todos).toBe(dado(await api.listarClientes('todos', '', 1, 10)).vendasSemIdentificacaoHoje)
    const tudo = await lista(api, null, 'todos', 1, 100)
    expect(tudo.total).toBeGreaterThan(0)
  })
})
