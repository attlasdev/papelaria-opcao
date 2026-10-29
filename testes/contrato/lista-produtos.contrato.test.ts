/**
 * Lista do Estoque (1.0, tela 2.2): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Estoque".
 */
import { expect, it } from 'vitest'
import type { DadosProduto, FiltroProdutos } from '../../comum/contrato'
import { criarTentativas } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto

const mock = (): Api => {
  const tentativas = criarTentativas()
  return { ...criarOperadoresDaBase(tentativas), ...criarProdutosDaBase(tentativas) }
}
const sqlite = (banco: Banco): Api => {
  const tentativas = criarTentativas()
  return { ...operadoresSqlite(() => banco, tentativas), ...produtosSqlite(() => banco, tentativas) }
}

const BASE: DadosProduto = {
  codigoBarras: null, descricao: '', categoria: '', unidade: 'un', preco: 100, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/**
 * Loja nova com cinco produtos, um de cada jeito:
 *   EST-0001 Sulfite       Papéis   zerado        com código
 *   EST-0002 Café solúvel  Copa     baixo (5/10)  com código
 *   EST-0003 Caneta azul   Escrita  normal        sem código
 *   EST-0004 Caderno       Escrita  normal        sem código, desativado
 *   EST-0005 Lápis         Escrita  normal        com código
 */
async function loja(api: Api) {
  const dona = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const novo = async (d: Partial<DadosProduto>, saldo: number) => dado(await api.cadastrarProduto({ ...BASE, ...d }, saldo, saldo > 0 ? dona : null))
  await novo({ descricao: 'Sulfite A4', categoria: 'Papéis', codigoBarras: '7891' }, 0)
  await novo({ descricao: 'Café solúvel', categoria: 'Copa', codigoBarras: '7892', minimo: 10 }, 5)
  await novo({ descricao: 'Caneta azul', categoria: 'Escrita', minimo: 2 }, 20)
  const caderno = await novo({ descricao: 'Caderno', categoria: 'Escrita' }, 3)
  dado(await api.ativarProduto(caderno.id, false))
  await novo({ descricao: 'Lápis HB', categoria: 'Escrita', codigoBarras: '7895' }, 8)
}

const nomes = async (api: Api, filtro: FiltroProdutos, busca = '', pagina = 1, porPagina = 20) =>
  dado(await api.listarProdutos(filtro, busca, pagina, porPagina)).produtos.map((p) => p.descricao)

testarContrato('lista de produtos', { mock, sqlite }, (abrir) => {
  it('[R-ESTOQUE-02] desativado só aparece na aba dele; os cartões contam os ativos', async () => {
    const api = abrir('vazia')
    await loja(api)
    expect(await nomes(api, 'todos')).toEqual(['Sulfite A4', 'Café solúvel', 'Caneta azul', 'Lápis HB'])
    expect(await nomes(api, 'desativados')).toEqual(['Caderno'])
    const pagina = dado(await api.listarProdutos('todos', '', 1, 20))
    expect(pagina.resumo).toEqual({ produtos: 4, categorias: 3, baixo: 2, semCodigo: 1, desativados: 1 })
    expect(pagina.categorias).toEqual(['Copa', 'Escrita', 'Papéis'])
    expect(pagina.produtos[0]).toMatchObject({ codigo: 'EST-0001', saldo: 0, ativo: true })
  })

  it('cada aba recorta a lista: estoque baixo inclui o zerado; categoria e sem código ficam nos ativos', async () => {
    const api = abrir('vazia')
    await loja(api)
    expect(await nomes(api, 'baixo')).toEqual(['Sulfite A4', 'Café solúvel'])
    expect(await nomes(api, 'sem-codigo')).toEqual(['Caneta azul'])
    expect(await nomes(api, { categoria: 'Escrita' })).toEqual(['Caneta azul', 'Lápis HB'])
    expect(await nomes(api, { categoria: 'Inexistente' })).toEqual([])
  })

  it('a busca ignora acento e maiúscula, e acha por código, código de barras, nome e categoria', async () => {
    const api = abrir('vazia')
    await loja(api)
    expect(await nomes(api, 'todos', 'CAFE')).toEqual(['Café solúvel'])
    expect(await nomes(api, 'todos', 'papeis')).toEqual(['Sulfite A4'])
    expect(await nomes(api, 'todos', ' est-0005 ')).toEqual(['Lápis HB'])
    expect(await nomes(api, 'todos', '7892')).toEqual(['Café solúvel'])
    expect(await nomes(api, { categoria: 'Escrita' }, 'lapis')).toEqual(['Lápis HB'])
    // O desativado não aparece na busca de Todos, só na aba dele.
    expect(await nomes(api, 'todos', 'caderno')).toEqual([])
    expect(await nomes(api, 'desativados', 'caderno')).toEqual(['Caderno'])
    // Caractere que é coringa no SQL é só texto.
    expect(await nomes(api, 'todos', '%')).toEqual([])
  })

  it('pagina no back, em ordem de código; página além do fim devolve a última', async () => {
    const api = abrir('vazia')
    await loja(api)
    expect(await nomes(api, 'todos', '', 1, 3)).toEqual(['Sulfite A4', 'Café solúvel', 'Caneta azul'])
    const segunda = dado(await api.listarProdutos('todos', '', 2, 3))
    expect(segunda).toMatchObject({ total: 4, pagina: 2 })
    expect(segunda.produtos.map((p) => p.descricao)).toEqual(['Lápis HB'])
    expect(dado(await api.listarProdutos('todos', '', 9, 3))).toMatchObject({ pagina: 2, total: 4 })
    // Lista vazia ainda tem a página 1.
    expect(dado(await api.listarProdutos('todos', 'nada assim', 3, 3))).toMatchObject({ pagina: 1, total: 0, produtos: [] })
  })

  it('pedido fora do formato é recusado', async () => {
    const api = abrir('vazia')
    for (const [pagina, porPagina] of [[0, 10], [1, 0], [1, 101], [1.5, 10]]) {
      expect(await api.listarProdutos('todos', '', pagina, porPagina)).toMatchObject({ ok: false, causa: 'validacao' })
    }
    expect(await api.listarProdutos('outra' as FiltroProdutos, '', 1, 10)).toMatchObject({ ok: false, causa: 'validacao' })
  })
})
