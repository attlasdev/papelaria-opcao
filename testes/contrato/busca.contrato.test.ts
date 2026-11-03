/**
 * Busca do cabeçalho (1.0, tela 8.3): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Início e sino".
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosProduto, PagamentoVenda } from '../../comum/contrato'
import { criarTentativas } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { buscaSqlite } from '../../electron/banco/busca'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarBuscaDaBase, type OperacoesBusca } from '../../src/mock/operacoes/busca'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesBusca

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t), ...criarBuscaDaBase() }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...vendasSqlite(() => banco, t),
    ...fichasSqlite(() => banco, t), ...buscaSqlite(() => banco),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: 'Caderno', categoria: 'Escolar', unidade: 'un', preco: 500, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}
const cliente = (nome: string, documento: string | null = null, telefone: string | null = null): DadosCliente => ({
  nome, documento, telefone, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
})
const PIX: PagamentoVenda = { forma: 'pix', maquininha: null }

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/**
 *   clientes: Ângela Souza (CPF e telefone), Bia Lima, e 22 "Cliente da escola"
 *   produtos: Caderno Tilibra (com código de barras), Cola branca (categoria Colas),
 *             Tinta guache desativada, e 22 "Lápis"
 *   fichas, uma por minuto: Ângela compra Caderno; venda avulsa com o serviço Xerox
 *             colorida; Bia compra Cola, cancelada; e 22 de Lápis para a Bia
 */
async function umaLoja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const caderno = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Caderno Tilibra', codigoBarras: '7891234567895' }, 100, dona))
  const cola = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Cola branca', categoria: 'Colas' }, 100, dona))
  const tinta = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Tinta guache' }, 0, null))
  dado(await api.ativarProduto(tinta.id, false))
  const lapis = []
  for (let i = 1; i <= 22; i++) lapis.push(dado(await api.cadastrarProduto({ ...PRODUTO, descricao: `Lápis nº ${i}` }, 100, dona)))
  const angela = dado(await api.cadastrarCliente(cliente('Ângela Souza', '52998224725', '11987654321'))).id
  const bia = dado(await api.cadastrarCliente(cliente('Bia Lima'))).id
  for (let i = 1; i <= 22; i++) dado(await api.cadastrarCliente(cliente(`Cliente da escola ${String(i).padStart(2, '0')}`)))

  let minuto = 0
  const vender = async (clienteId: string | null, produtoId: string | null, servico: string | null = null) => {
    vi.setSystemTime(new Date(`2026-10-26T10:${String(minuto++).padStart(2, '0')}:00-03:00`))
    const f = dado(await api.concluirFicha({
      clienteId, itens: produtoId ? [{ produtoId, quantidade: 1, precoVisto: 500 }] : [],
      servicos: servico ? [{ nome: servico, valor: 300, perdas: null, observacao: null }] : [], desconto: 0, pagamento: PIX,
    }, dona))
    vi.setSystemTime(AGORA)
    return f
  }
  const daAngela = await vender(angela, caderno.id)
  const xerox = await vender(null, null, 'Xerox colorida')
  const cancelada = await vender(bia, cola.id)
  dado(await api.cancelarFicha(cancelada.id, 'Cliente desistiu', dona))
  const deLapis = []
  for (let i = 0; i < 22; i++) deLapis.push(await vender(bia, lapis[i].id))
  return { caderno, cola, tinta, lapis, angela, bia, daAngela, xerox, cancelada, deLapis }
}

const buscar = async (api: Api, termo: string) => dado(await api.buscar(termo))

testarContrato('busca do cabeçalho', { mock, sqlite }, (abrir) => {
  it('[R-INICIO-07] até 20 por grupo, com o total de cada grupo', async () => {
    const api = abrir('vazia')
    const { deLapis } = await umaLoja(api)
    const r = await buscar(api, 'lápis')
    expect([r.produtos.itens.length, r.produtos.total]).toEqual([20, 22])
    expect([r.fichas.itens.length, r.fichas.total]).toEqual([20, 22])
    expect(r.fichas.itens.map((f) => f.id)).toEqual(deLapis.slice(-20).reverse().map((f) => f.id))
    const escola = await buscar(api, 'escola')
    expect([escola.clientes.itens.length, escola.clientes.total]).toEqual([20, 22])
    expect(escola.clientes.itens[0].nome).toBe('Cliente da escola 01')
  })

  it('[R-INICIO-07] cliente pelas regras da lista: sem acento, CPF e telefone com ou sem pontuação', async () => {
    const api = abrir('vazia')
    const { angela } = await umaLoja(api)
    for (const termo of ['angela', 'SOUZA', '529.982.247-25', 'cpf 52998224725', '(11) 98765-4321', '987654321']) {
      const r = await buscar(api, termo)
      expect(r.clientes.itens.map((c) => c.id), termo).toEqual([angela])
      expect(r.clientes.total, termo).toBe(1)
    }
    expect((await buscar(api, '00000')).clientes.total).toBe(0)
  })

  it('[R-INICIO-07] produto pelo código, código de barras, nome e categoria; o desativado aparece, marcado', async () => {
    const api = abrir('vazia')
    const { caderno, cola, tinta } = await umaLoja(api)
    expect((await buscar(api, caderno.codigo)).produtos.itens.map((p) => p.id)).toEqual([caderno.id])
    expect((await buscar(api, '7891234567895')).produtos.itens.map((p) => p.id)).toEqual([caderno.id])
    expect((await buscar(api, 'colas')).produtos.itens.map((p) => p.id)).toEqual([cola.id])
    const r = await buscar(api, 'tinta')
    expect(r.produtos.itens.map((p) => [p.id, p.ativo])).toEqual([[tinta.id, false]])
  })

  it('[R-INICIO-07] ficha pelo número (com ou sem # e zeros), cliente, item e serviço; a cancelada aparece, marcada', async () => {
    const api = abrir('vazia')
    const { daAngela, xerox, cancelada } = await umaLoja(api)
    const numero = Number(daAngela.numero)
    for (const termo of [`#${numero}`, daAngela.numero.padStart(6, '0'), '# ' + numero]) {
      expect((await buscar(api, termo)).fichas.itens.map((f) => f.id), termo).toEqual([daAngela.id])
    }
    // Só o número também casa com o texto ("Lápis nº 1"): a ficha vem junto.
    expect((await buscar(api, String(numero))).fichas.itens.map((f) => f.id)).toContain(daAngela.id)
    expect((await buscar(api, 'ângela')).fichas.itens.map((f) => f.id)).toEqual([daAngela.id])
    expect((await buscar(api, 'tilibra')).fichas.itens.map((f) => f.id)).toEqual([daAngela.id])
    const r = await buscar(api, 'xerox')
    expect(r.fichas.itens.map((f) => [f.id, f.cliente, f.servicos])).toEqual([[xerox.id, null, ['Xerox colorida']]])
    const c = await buscar(api, 'cola branca')
    expect(c.fichas.itens.map((f) => [f.id, f.cancelada, f.itens])).toEqual([[cancelada.id, true, [{ descricao: 'Cola branca', quantidade: 1 }]]])
  })

  it('[R-INICIO-07] o que não casa fica de fora: só os três grupos, e o termo vazio não traz nada', async () => {
    const api = abrir('vazia')
    await umaLoja(api)
    const nada = { clientes: { itens: [], total: 0 }, fichas: { itens: [], total: 0 }, produtos: { itens: [], total: 0 } }
    expect(await buscar(api, '   ')).toEqual(nada)
    expect(await buscar(api, '')).toEqual(nada)
    expect(await buscar(api, 'pincel atômico')).toEqual(nada)
    // A Bia tem fichas, mas "bia" não é item nem produto.
    const bia = await buscar(api, 'bia')
    expect([bia.clientes.total, bia.fichas.total, bia.produtos.total]).toEqual([1, 23, 0])
  })

  it('[R-INICIO-07] pedido fora do formato: validação', async () => {
    const api = abrir('vazia')
    for (const termo of [123, null, undefined, ['a'], 'a'.repeat(101)]) {
      const r = await api.buscar(termo as never)
      expect(r.ok ? 'ok' : r.causa, String(termo).slice(0, 10)).toBe('validacao')
    }
    expect((await api.buscar('a'.repeat(100))).ok).toBe(true)
  })

  it('[R-INICIO-07] na semente, cada resultado aponta para um registro que existe', async () => {
    const api = abrir('semente')
    for (const termo of ['a', 'caderno', 'escola']) {
      const r = await buscar(api, termo)
      expect(r.clientes.total + r.fichas.total + r.produtos.total, termo).toBeGreaterThan(0)
      for (const c of r.clientes.itens) expect((await api.obterCliente(c.id)).ok).toBe(true)
      for (const f of r.fichas.itens) expect((await api.obterFicha(f.id)).ok).toBe(true)
      for (const p of r.produtos.itens) expect((await api.obterProduto(p.id)).ok).toBe(true)
    }
  })
})
