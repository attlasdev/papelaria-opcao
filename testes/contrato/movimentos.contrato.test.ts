/**
 * Histórico do estoque (1.0, tela 2.6): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Estoque". O cancelamento
 * de ficha entra quando a operação existir (tela 4.2).
 */
import { expect, it } from 'vitest'
import type { Assinatura, DadosProduto, FiltroMovimentos } from '../../comum/contrato'
import { criarTentativas } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { ajustesSqlite } from '../../electron/banco/ajustes'
import { entradasSqlite } from '../../electron/banco/entradas'
import { movimentosSqlite } from '../../electron/banco/movimentos'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { criarAjustesDaBase, type OperacoesAjuste } from '../../src/mock/operacoes/ajustes'
import { criarEntradasDaBase, type OperacoesEntrada } from '../../src/mock/operacoes/entradas'
import { criarMovimentosDaBase, type OperacoesMovimento } from '../../src/mock/operacoes/movimentos'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesEntrada & OperacoesAjuste & OperacoesMovimento

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarEntradasDaBase(t), ...criarAjustesDaBase(t), ...criarMovimentosDaBase() }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  const b = () => banco
  return { ...operadoresSqlite(b, t), ...produtosSqlite(b, t), ...entradasSqlite(b, t), ...ajustesSqlite(b, t), ...movimentosSqlite(b) }
}

const BASE: DadosProduto = {
  codigoBarras: null, descricao: '', categoria: 'Escolar', unidade: 'un', preco: 100, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/**
 * Loja nova com quatro movimentos, do mais velho ao mais novo:
 *   saldo inicial do caderno (dona) · entrada do caderno (João) ·
 *   ajuste do caderno (João, aguardando) · ajuste da régua (dona, conferido)
 */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Caderno' }, 10, dona))
  const regua = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Régua' }, 0, null))
  dado(await api.registrarEntrada({
    recebidaEm: '2026-10-25', fornecedor: 'Atacadão', referencia: 'NF 1', observacoes: null,
    itens: [{ produtoId: caderno.id, quantidade: 5, custoUnitario: 300 }],
  }, joao))
  dado(await api.ajustarEstoque({ produtoId: caderno.id, contagem: 12, saldoVisto: 15, motivo: 'Quebrados' }, joao))
  dado(await api.ajustarEstoque({ produtoId: regua.id, contagem: 3, saldoVisto: 0, motivo: 'Achadas no depósito' }, dona))
  return { dona, joao, caderno, regua }
}

const TODAS: FiltroMovimentos = { produtoId: null, tipo: 'todas', aguardando: false }
const pagina = async (api: Api, filtro: Partial<FiltroMovimentos> = {}, n = 1, porPagina = 20) =>
  dado(await api.listarMovimentosEstoque({ ...TODAS, ...filtro }, n, porPagina))

testarContrato('histórico do estoque', { mock, sqlite }, (abrir) => {
  it('[R-ESTOQUE-04] do mais novo ao mais velho, cada um com o que o explica', async () => {
    const api = abrir('vazia')
    const { caderno } = await loja(api)
    const r = await pagina(api)
    expect(r.total).toBe(4)
    expect(r.movimentos.map((m) => [m.tipo, m.produto.descricao, m.saldoAntes, m.saldoDepois, m.operador])).toEqual([
      ['ajuste', 'Régua', 0, 3, 'Helena'],
      ['ajuste', 'Caderno', 15, 12, 'João'],
      ['entrada', 'Caderno', 10, 15, 'João'],
      ['entrada', 'Caderno', 0, 10, 'Helena'],
    ])
    const [daDona, doJoao, entrada, inicial] = r.movimentos
    expect(entrada).toMatchObject({
      produto: { id: caderno.id, codigo: caderno.codigo }, motivo: 'Recebimento de mercadorias', ficha: null,
      entrada: { recebidaEm: '2026-10-25', fornecedor: 'Atacadão', referencia: 'NF 1', observacoes: null, custoUnitario: 300 },
      aguardandoConferencia: false, conferencia: null,
    })
    expect(inicial).toMatchObject({ motivo: 'Saldo inicial do cadastro', entrada: null })
    expect(doJoao).toMatchObject({ motivo: 'Quebrados', aguardandoConferencia: true, conferencia: null })
    expect(daDona).toMatchObject({ aguardandoConferencia: false, conferencia: { por: 'Helena' } })
  })

  it('[R-ESTOQUE-11] o filtro dos aguardando e a contagem; conferir tira o ajuste de lá', async () => {
    const api = abrir('vazia')
    const { dona, caderno, regua } = await loja(api)
    const aguardando = await pagina(api, { aguardando: true })
    expect([aguardando.total, aguardando.aguardando, aguardando.movimentos[0].produto.descricao]).toEqual([1, 1, 'Caderno'])
    // A contagem vale para o produto, qualquer que seja o tipo filtrado.
    expect((await pagina(api, { tipo: 'entrada' })).aguardando).toBe(1)
    expect((await pagina(api, { produtoId: regua.id })).aguardando).toBe(0)
    expect((await pagina(api, { produtoId: caderno.id })).aguardando).toBe(1)
    dado(await api.conferirAjustes([aguardando.movimentos[0].id], dona))
    const depois = await pagina(api, { aguardando: true })
    expect([depois.total, depois.aguardando]).toEqual([0, 0])
    expect((await pagina(api, { tipo: 'ajuste', produtoId: caderno.id })).movimentos[0].conferencia).toMatchObject({ por: 'Helena' })
  })

  it('filtra por tipo e por produto, e pagina no back', async () => {
    const api = abrir('vazia')
    const { caderno } = await loja(api)
    expect((await pagina(api, { tipo: 'ajuste' })).movimentos.map((m) => m.produto.descricao)).toEqual(['Régua', 'Caderno'])
    expect((await pagina(api, { tipo: 'entrada', produtoId: caderno.id })).total).toBe(2)
    expect((await pagina(api, { tipo: 'venda' })).total).toBe(0)
    const [primeira, segunda] = [await pagina(api, {}, 1, 3), await pagina(api, {}, 2, 3)]
    expect([primeira.movimentos.length, segunda.movimentos.length, segunda.total]).toEqual([3, 1, 4])
    expect(segunda.movimentos[0].motivo).toBe('Saldo inicial do cadastro')
    expect((await pagina(api, {}, 5, 3)).movimentos).toEqual([])
  })

  it('na semente: a venda traz a ficha para abrir, sem motivo escrito', async () => {
    const api = abrir('semente')
    const vendas = await pagina(api, { tipo: 'venda' }, 1, 5)
    expect(vendas.total).toBeGreaterThan(5)
    for (const v of vendas.movimentos) {
      expect(v).toMatchObject({ tipo: 'venda', motivo: null, entrada: null })
      expect(v.ficha?.numero).toMatch(/^\d{4,}$/)
      expect(v.saldoDepois).toBeLessThan(v.saldoAntes)
    }
  })

  it('pedido fora do formato é recusado', async () => {
    const api = abrir('vazia')
    for (const [filtro, n, por] of [
      [{ ...TODAS, tipo: 'outra' }, 1, 10], [{ ...TODAS, aguardando: 'sim' }, 1, 10], [{ ...TODAS, produtoId: '' }, 1, 10],
      [TODAS, 0, 10], [TODAS, 1, 101],
    ] as [FiltroMovimentos, number, number][]) {
      expect(await api.listarMovimentosEstoque(filtro, n, por)).toMatchObject({ ok: false, causa: 'validacao' })
    }
  })
})
