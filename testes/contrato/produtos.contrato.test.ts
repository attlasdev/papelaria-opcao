/**
 * Cadastro de produto (1.0, tela 2.1): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Estoque".
 */
import { expect, it } from 'vitest'
import type { Assinatura, DadosProduto, Produto } from '../../comum/contrato'
import { criarTentativas, LIMITE_ERROS, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from '../../electron/banco/banco'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { PINS } from '../../electron/banco/semente'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto

/** Uma conta de PINs errados para as duas áreas, como no app. */
const mock = (): Api => {
  const tentativas = criarTentativas()
  return { ...criarOperadoresDaBase(tentativas), ...criarProdutosDaBase(tentativas) }
}
const sqlite = (banco: Banco): Api => {
  const tentativas = criarTentativas()
  return { ...operadoresSqlite(() => banco, tentativas), ...produtosSqlite(() => banco, tentativas) }
}

const CADERNO: DadosProduto = {
  codigoBarras: '7891234567895', descricao: 'Caderno espiral 96 folhas', categoria: 'Escolar', unidade: 'un',
  preco: 1590, custo: 800, minimo: 3, localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null,
  conteudo: null, ncm: null, cest: null,
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/** As pessoas da semente: a dona, o João (ativo) e a Márcia (desativada). */
async function pessoas(api: Api) {
  const lista = dado(await api.listarOperadores()).pessoas
  const id = (filtro: (p: (typeof lista)[number]) => boolean) => lista.find(filtro)!.id
  return {
    dona: { operadorId: id((p) => p.admin), pin: PINS.dona } satisfies Assinatura,
    joao: { operadorId: id((p) => !p.admin && p.ativo), pin: PINS.joao } satisfies Assinatura,
    marcia: { operadorId: id((p) => !p.ativo), pin: PINS.marcia } satisfies Assinatura,
  }
}

/** O produto foi gravado? O código de barras é a busca que não depende de id. */
const gravado = async (api: Api, codigoBarras: string) => dado(await api.buscarProdutoPorCodigoBarras(codigoBarras))

testarContrato('produtos', { mock, sqlite }, (abrir) => {
  it('[R-ESTOQUE-08] o código nasce no banco, em sequência, ao salvar', async () => {
    const api = abrir('vazia')
    const primeiro = dado(await api.cadastrarProduto(CADERNO, 0, null))
    const segundo = dado(await api.cadastrarProduto({ ...CADERNO, codigoBarras: null, descricao: 'Régua 30 cm' }, 0, null))
    expect([primeiro.codigo, segundo.codigo]).toEqual(['EST-0001', 'EST-0002'])
    expect(primeiro).toMatchObject({ ...CADERNO, saldo: 0, ativo: true, temHistorico: false })
    expect(dado(await api.obterProduto(primeiro.id))).toEqual(primeiro)
    expect(await api.obterProduto('nao-existe')).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-ESTOQUE-07] quantidade inicial pede quem está fazendo; com 0, grava direto', async () => {
    const api = abrir('semente')
    const { joao, marcia } = await pessoas(api)

    expect(await api.cadastrarProduto(CADERNO, 5, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.semAssinatura })
    expect(await api.cadastrarProduto(CADERNO, 5, { ...joao, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await api.cadastrarProduto(CADERNO, 5, marcia)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.inativo })
    expect(await gravado(api, CADERNO.codigoBarras!)).toBeNull()

    const caderno = dado(await api.cadastrarProduto(CADERNO, 5, joao))
    expect(caderno).toMatchObject({ saldo: 5, temHistorico: false })
    // Com 0 não há fato: a assinatura nem é olhada.
    expect(await api.cadastrarProduto({ ...CADERNO, codigoBarras: null, descricao: 'Régua' }, 0, { ...joao, pin: '0000' })).toMatchObject({ ok: true })
    expect(await api.cadastrarProduto({ ...CADERNO, codigoBarras: null, descricao: 'Lápis' }, -1, joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.saldo })
    expect(await api.cadastrarProduto({ ...CADERNO, codigoBarras: null, descricao: 'Lápis' }, 1.5, joao)).toMatchObject({ ok: false, causa: 'validacao' })

    // Excluir o que tem o saldo inicial também pede (não é gesto da dona).
    expect(await api.excluirProduto(caderno.id, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.semAssinatura })
    expect(await api.excluirProduto(caderno.id, joao)).toEqual({ ok: true, dado: null })
    expect(await gravado(api, CADERNO.codigoBarras!)).toBeNull()
  })

  it('[R-OPERADOR-02] quem assina a quantidade inicial vem marcado na próxima vez', async () => {
    const api = abrir('semente')
    const { dona } = await pessoas(api)
    expect(dado(await api.listarOperadores()).ultimoId).not.toBe(dona.operadorId)
    await api.cadastrarProduto(CADERNO, 2, dona)
    expect(dado(await api.listarOperadores()).ultimoId).toBe(dona.operadorId)
  })

  it('[R-OPERADOR-04] os PINs errados no produto contam junto com os do cadastro de pessoas', async () => {
    const api = abrir('semente')
    const { dona } = await pessoas(api)
    for (let i = 0; i < LIMITE_ERROS; i++) await api.cadastrarProduto(CADERNO, 1, { ...dona, pin: '0000' })
    expect(await api.renomearOperador(dona.operadorId, 'Helena', dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.espera(30) })
  })

  it('[R-ESTOQUE-05] o bipe acha o produto cadastrado; código repetido não duplica', async () => {
    const api = abrir('vazia')
    const caderno = dado(await api.cadastrarProduto(CADERNO, 0, null))
    expect(await gravado(api, ` ${CADERNO.codigoBarras} `)).toEqual(caderno)
    expect(await gravado(api, '000')).toBeNull()

    const repetido = { ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.codigoRepetido(caderno.codigo) }
    expect(await api.cadastrarProduto({ ...CADERNO, descricao: 'Outro' }, 0, null)).toEqual(repetido)
    const regua = dado(await api.cadastrarProduto({ ...CADERNO, codigoBarras: '789000', descricao: 'Régua' }, 0, null))
    expect(await api.editarProduto(regua.id, { ...CADERNO, descricao: 'Régua' })).toEqual(repetido)
    // O próprio código não conta como repetido.
    expect(await api.editarProduto(caderno.id, { ...CADERNO, preco: 1690 })).toMatchObject({ ok: true, dado: { preco: 1690 } })
  })

  it('[R-ESTOQUE-01] editar corrige o cadastro sem mexer no saldo nem na situação', async () => {
    const api = abrir('semente')
    const { joao } = await pessoas(api)
    const caderno = dado(await api.cadastrarProduto(CADERNO, 7, joao))
    dado(await api.ativarProduto(caderno.id, false))
    const editado = dado(await api.editarProduto(caderno.id, { ...CADERNO, preco: 1990, minimo: 10, marca: 'Tilibra' }))
    expect(editado).toMatchObject({ preco: 1990, minimo: 10, marca: 'Tilibra', saldo: 7, ativo: false, codigo: caderno.codigo })
    expect(await api.editarProduto('nao-existe', CADERNO)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-ESTOQUE-02] com histórico não se exclui: desativa e reativa', async () => {
    const api = abrir('semente')
    const { joao } = await pessoas(api)
    const vendido = (await gravado(api, '789102711'))!
    expect(vendido.temHistorico).toBe(true)
    expect(await api.excluirProduto(vendido.id, joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.comHistorico })
    expect(await api.ativarProduto(vendido.id, false)).toMatchObject({ ok: true, dado: { ativo: false } })
    expect(await api.ativarProduto(vendido.id, true)).toMatchObject({ ok: true, dado: { ativo: true } })

    // Sem saldo nem histórico: cadastro por engano sai sem pedir ninguém.
    const engano = dado(await api.cadastrarProduto(CADERNO, 0, null))
    expect(await api.excluirProduto(engano.id, null)).toEqual({ ok: true, dado: null })
    expect(await api.obterProduto(engano.id)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-ESTOQUE-06] NCM e CEST como anotação: só números, no tamanho certo', async () => {
    const api = abrir('vazia')
    const anotado = dado(await api.cadastrarProduto({ ...CADERNO, ncm: '4820.20.00', cest: '19.024.00' }, 0, null))
    expect(anotado).toMatchObject({ ncm: '48202000', cest: '1902400' })
    expect(await api.editarProduto(anotado.id, { ...CADERNO, ncm: '4820' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.ncm })
    expect(await api.editarProduto(anotado.id, { ...CADERNO, cest: '19024' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.cest })
    expect(dado(await api.editarProduto(anotado.id, { ...CADERNO, ncm: null, cest: null }))).toMatchObject({ ncm: null, cest: null })
  })

  it('categoria repetida com outra caixa ou sem acento vira a existente; texto colado sai limpo', async () => {
    const api = abrir('vazia')
    await api.cadastrarProduto({ ...CADERNO, categoria: 'Papelaria Básica' }, 0, null)
    const colado = dado(await api.cadastrarProduto({
      ...CADERNO, codigoBarras: null, categoria: ' papelaria basica ', descricao: 'Marca-texto Stabilo  Boss​ Amarelo',
    }, 0, null))
    expect(colado).toMatchObject({ categoria: 'Papelaria Básica', descricao: 'Marca-texto Stabilo Boss Amarelo' })
    expect(dado(await api.listarCategorias())).toEqual(['Papelaria Básica'])
  })

  it('dado fora do formato não grava: a mensagem é a do primeiro campo errado', async () => {
    const api = abrir('vazia')
    expect(await api.cadastrarProduto({ ...CADERNO, descricao: '  ', preco: 0 }, 0, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.descricao })
    expect(await api.cadastrarProduto({ ...CADERNO, preco: 0 }, 0, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.preco })
    expect(await api.cadastrarProduto({ ...CADERNO, unidade: 'kg' as Produto['unidade'] }, 0, null)).toMatchObject({ erro: MENSAGENS_PRODUTO.unidade })
    expect(await api.cadastrarProduto(null as unknown as DadosProduto, 0, null)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(dado(await api.listarCategorias())).toEqual([])
  })
})
