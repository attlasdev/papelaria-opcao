/**
 * Entrada de mercadoria (1.0, telas 2.3 e 2.4): os mesmos cenários no mock
 * (base da demonstração) e no SQLite. Regras em Memoria.md, "Estoque".
 *
 * A lista de movimentos só entra no contrato na tela 2.6; até lá cada lado
 * mostra aqui o que gravou (`entradas`), lendo direto da sua base.
 */
import { expect, it } from 'vitest'
import type { Assinatura, DadosProduto, Entrega } from '../../comum/contrato'
import { MENSAGENS_ENTRADA, MOTIVO_ENTRADA } from '../../comum/regras/entrada'
import { criarTentativas, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from '../../electron/banco/banco'
import { entradasSqlite } from '../../electron/banco/entradas'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { obterBase } from '../../src/mock/estado-demonstracao'
import { criarEntradasDaBase, type OperacoesEntrada } from '../../src/mock/operacoes/entradas'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { HOJE, testarContrato } from './estrutura'

/** O que uma entrada deixou gravado, do jeito que a tela 2.6 vai mostrar. */
type Gravada = { quantidade: number; recebidaEm: string; fornecedor: string | null; referencia: string | null; custoUnitario: number | null; operador: string }

type Api = OperacoesOperador & OperacoesProduto & OperacoesEntrada & { entradas: (produtoId: string) => Gravada[] }

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarEntradasDaBase(t),
    entradas: (produtoId) => obterBase().movimentosEstoque
      .filter((m) => m.produto === produtoId && m.motivo === MOTIVO_ENTRADA)
      .map((m) => ({
        quantidade: m.depois - m.antes, recebidaEm: m.entrada!.recebidaEm, fornecedor: m.entrada!.fornecedor ?? null,
        referencia: m.entrada!.referencia ?? null, custoUnitario: m.entrada!.custoUnitario ?? null, operador: m.operador!,
      })),
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...entradasSqlite(() => banco, t),
    entradas: (produtoId) => (banco.prepare(`
      select m.quantidade, e.recebida_em as recebidaEm, e.fornecedor, e.referencia, m.custo_unitario as custoUnitario, o.nome as operador
      from movimento_estoque m join entrada_mercadoria e on e.id = m.entrada_id join operador o on o.id = m.operador_id
      where m.produto_id = ? order by m.rowid desc`).all(produtoId) as Gravada[]).map((l) => ({ ...l })),
  }
}

const BASE: DadosProduto = {
  codigoBarras: null, descricao: '', categoria: 'Escolar', unidade: 'un', preco: 100, custo: 250, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/** Loja nova: a dona, o João, um caderno com 10, uma régua com 0 e uma cola desativada. */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Caderno' }, 10, dona))
  const regua = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Régua' }, 0, null))
  const cola = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Cola' }, 0, null))
  dado(await api.ativarProduto(cola.id, false))
  return { dona, joao, caderno, regua, cola }
}

const entrega = (itens: Entrega['itens'], resto: Partial<Entrega> = {}): Entrega =>
  ({ recebidaEm: HOJE, fornecedor: null, referencia: null, observacoes: null, itens, ...resto })

const saldo = async (api: Api, id: string) => dado(await api.obterProduto(id)).saldo

testarContrato('entrada de mercadoria', { mock, sqlite }, (abrir) => {
  it('[R-ESTOQUE-04] soma ao saldo de agora e guarda o dia físico, o fornecedor e a referência', async () => {
    const api = abrir('vazia')
    const { joao, caderno, regua } = await loja(api)
    const r = dado(await api.registrarEntrada(entrega([
      { produtoId: caderno.id, quantidade: 7, custoUnitario: 300 },
      { produtoId: regua.id, quantidade: 4, custoUnitario: null },
    ], { recebidaEm: '2026-10-25', fornecedor: ' Atacadão ', referencia: 'NF 1234' }), joao))
    expect(r.produtos.map((p) => [p.descricao, p.saldo])).toEqual([['Caderno', 17], ['Régua', 4]])
    expect(api.entradas(caderno.id)).toEqual([
      { quantidade: 7, recebidaEm: '2026-10-25', fornecedor: 'Atacadão', referencia: 'NF 1234', custoUnitario: 300, operador: 'João' },
    ])
    expect(api.entradas(regua.id)[0]).toMatchObject({ quantidade: 4, custoUnitario: null })
    // Outra entrega soma de novo; a tela nunca manda o saldo final.
    await api.registrarEntrada(entrega([{ produtoId: caderno.id, quantidade: 3, custoUnitario: null }]), joao)
    expect(await saldo(api, caderno.id)).toBe(20)
  })

  it('[R-ESTOQUE-09] o custo da entrega fica na entrega; o do cadastro não muda', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    await api.registrarEntrada(entrega([{ produtoId: caderno.id, quantidade: 5, custoUnitario: 199 }]), joao)
    expect(dado(await api.obterProduto(caderno.id)).custo).toBe(250)
    expect(api.entradas(caderno.id)[0].custoUnitario).toBe(199)
  })

  it('[R-OPERADOR-02] pede quem está fazendo, e quem assinou vem marcado na próxima vez', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    const uma = entrega([{ produtoId: caderno.id, quantidade: 1, custoUnitario: null }])
    expect(await api.registrarEntrada(uma, null as unknown as Assinatura)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.semAssinatura })
    expect(await api.registrarEntrada(uma, { ...joao, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await saldo(api, caderno.id)).toBe(10)
    expect(dado(await api.listarOperadores()).ultimoId).toBe(dona.operadorId)
    dado(await api.registrarEntrada(uma, joao))
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
  })

  it('[R-ESTOQUE-02] [A1] produto desativado não recebe entrada; e se um item não serve, nada entra', async () => {
    const api = abrir('vazia')
    const { joao, caderno, cola } = await loja(api)
    const r = await api.registrarEntrada(entrega([
      { produtoId: caderno.id, quantidade: 5, custoUnitario: null },
      { produtoId: cola.id, quantidade: 5, custoUnitario: null },
    ]), joao)
    expect(r).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_ENTRADA.desativado('Cola') })
    expect(await saldo(api, caderno.id)).toBe(10)
    expect(api.entradas(caderno.id)).toEqual([])
  })

  it('[A1] recusa a entrega fora do formato (quantidade fracionada inclusive), sem gravar nada', async () => {
    const api = abrir('vazia')
    const { joao, caderno, regua } = await loja(api)
    const item = { produtoId: caderno.id, quantidade: 2, custoUnitario: null }
    const recusas: [Entrega, string][] = [
      [entrega([]), MENSAGENS_ENTRADA.semItens],
      [entrega([item, { ...item, quantidade: 3 }]), MENSAGENS_ENTRADA.repetido],
      [entrega([{ ...item, quantidade: 0 }]), MENSAGENS_ENTRADA.quantidade],
      [entrega([{ ...item, quantidade: 1.5 }]), MENSAGENS_ENTRADA.quantidade],
      [entrega([{ ...item, custoUnitario: -1 }]), MENSAGENS_ENTRADA.custo],
      [entrega([item], { recebidaEm: '2026-10-28' }), MENSAGENS_ENTRADA.futuro],
      [entrega([item], { recebidaEm: '2026-02-30' }), MENSAGENS_ENTRADA.dia],
      [entrega([item], { recebidaEm: '27/10/2026' }), MENSAGENS_ENTRADA.dia],
    ]
    for (const [errada, mensagem] of recusas) {
      expect(await api.registrarEntrada(errada, joao)).toEqual({ ok: false, causa: 'validacao', erro: mensagem })
    }
    expect(await api.registrarEntrada(entrega([{ ...item, produtoId: 'nao-existe' }]), joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect(await api.registrarEntrada(entrega([{ ...item, produtoId: regua.id }, { ...item, produtoId: 'nao-existe' }]), joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect([await saldo(api, caderno.id), await saldo(api, regua.id)]).toEqual([10, 0])
  })

  it('[R-ESTOQUE-09] produto novo nasce na entrega, com o número do banco e o custo desta compra', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    const novo = { ...BASE, descricao: 'Grampeador', categoria: ' escolar ', codigoBarras: '7890001', custo: null }
    const r = dado(await api.registrarEntrada(entrega([
      { produtoId: caderno.id, quantidade: 2, custoUnitario: null },
      { novo, quantidade: 6, custoUnitario: 1890 },
    ], { recebidaEm: '2026-10-20' }), joao))
    expect(r.produtos.map((p) => [p.descricao, p.saldo])).toEqual([['Caderno', 12], ['Grampeador', 6]])
    const grampeador = r.produtos[1]
    expect(grampeador).toMatchObject({ codigo: 'EST-0004', categoria: 'Escolar', custo: 1890, temHistorico: true, ativo: true })
    expect(api.entradas(grampeador.id)).toEqual([
      { quantidade: 6, recebidaEm: '2026-10-20', fornecedor: null, referencia: null, custoUnitario: 1890, operador: 'João' },
    ])
    // Sem custo informado, fica o do cadastro preparado.
    const outro = dado(await api.registrarEntrada(entrega([{ novo: { ...novo, codigoBarras: null, descricao: 'Clipes', custo: 90 }, quantidade: 1, custoUnitario: null }]), joao))
    expect(outro.produtos[0].custo).toBe(90)
  })

  it('[R-ESTOQUE-05] código de barras do produto novo já cadastrado, ou repetido na entrega: nada é criado', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    dado(await api.editarProduto(caderno.id, { ...BASE, descricao: 'Caderno', codigoBarras: '7891' }))
    const novo = { ...BASE, descricao: 'Grampeador', codigoBarras: '7891' }
    expect(await api.registrarEntrada(entrega([{ novo, quantidade: 1, custoUnitario: null }]), joao))
      .toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.codigoRepetido('EST-0001') })
    expect(await api.registrarEntrada(entrega([
      { novo: { ...novo, codigoBarras: '555' }, quantidade: 1, custoUnitario: null },
      { novo: { ...novo, codigoBarras: '555', descricao: 'Outro' }, quantidade: 1, custoUnitario: null },
    ]), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_ENTRADA.barrasRepetido('555') })
    // Cadastro novo fora do formato também recusa tudo, com a entrega mista.
    expect(await api.registrarEntrada(entrega([
      { produtoId: caderno.id, quantidade: 1, custoUnitario: null },
      { novo: { ...novo, codigoBarras: null, preco: 0 }, quantidade: 1, custoUnitario: null },
    ]), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.preco })
    expect(dado(await api.listarProdutos('todos', '', 1, 20)).total).toBe(2)
    expect(await saldo(api, caderno.id)).toBe(10)
  })
})
