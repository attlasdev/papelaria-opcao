/**
 * Ajuste de estoque (1.0, tela 2.5): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Estoque" e "Operadores e
 * login". A lista de movimentos só entra no contrato na tela 2.6; até lá cada
 * lado mostra aqui os ajustes que gravou (`ajustes`), do mais novo ao mais velho.
 */
import { expect, it } from 'vitest'
import type { Ajuste, Assinatura, DadosProduto } from '../../comum/contrato'
import { MENSAGEM_AJUSTE_NAO_ENCONTRADO, MENSAGENS_AJUSTE } from '../../comum/regras/ajuste'
import { MENSAGENS_ENTRADA } from '../../comum/regras/entrada'
import { criarTentativas, LIMITE_ERROS, MENSAGENS } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { ajustesSqlite } from '../../electron/banco/ajustes'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { obterBase } from '../../src/mock/estado-demonstracao'
import { criarAjustesDaBase, type OperacoesAjuste } from '../../src/mock/operacoes/ajustes'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { testarContrato } from './estrutura'

type Gravado = { id: string; quantidade: number; motivo: string; operador: string; conferidoPor: string | null }

type Api = OperacoesOperador & OperacoesProduto & OperacoesAjuste & { ajustes: (produtoId: string) => Gravado[] }

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarAjustesDaBase(t),
    ajustes: (produtoId) => obterBase().movimentosEstoque
      .filter((m) => m.produto === produtoId && m.tipo === 'Ajuste')
      .map((m) => ({ id: m.id, quantidade: m.depois - m.antes, motivo: m.motivo, operador: m.operador!, conferidoPor: m.conferidoPor ?? null })),
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...ajustesSqlite(() => banco, t),
    ajustes: (produtoId) => (banco.prepare(`
      select m.id, m.quantidade, m.motivo, o.nome as operador, d.nome as conferidoPor
      from movimento_estoque m join operador o on o.id = m.operador_id
      left join conferencia_ajuste c on c.movimento_id = m.id left join operador d on d.id = c.operador_id
      where m.produto_id = ? and m.tipo = 'ajuste' order by m.rowid desc`).all(produtoId) as Gravado[]).map((l) => ({ ...l })),
  }
}

const BASE: DadosProduto = {
  codigoBarras: null, descricao: '', categoria: 'Escolar', unidade: 'un', preco: 100, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/** Loja nova: a dona, o João, um caderno com 10 e uma cola desativada. */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Caderno' }, 10, dona))
  const cola = dado(await api.cadastrarProduto({ ...BASE, descricao: 'Cola' }, 0, null))
  dado(await api.ativarProduto(cola.id, false))
  return { dona, joao, caderno, cola }
}

const ajuste = (produtoId: string, contagem: number, resto: Partial<Ajuste> = {}): Ajuste =>
  ({ produtoId, contagem, saldoVisto: 10, motivo: 'Contagem da prateleira', ...resto })

const saldo = async (api: Api, id: string) => dado(await api.obterProduto(id)).saldo

testarContrato('ajuste de estoque', { mock, sqlite }, (abrir) => {
  it('[R-ESTOQUE-11] [R-OPERADOR-06] funcionário ajusta só com o PIN dele; o ajuste grava e fica aguardando a dona', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    expect(dado(await api.ajustarEstoque(ajuste(caderno.id, 7, { motivo: ' 3 quebrados ' }), joao))).toMatchObject({ saldo: 7 })
    expect(api.ajustes(caderno.id)).toMatchObject([{ quantidade: -3, motivo: '3 quebrados', operador: 'João', conferidoPor: null }])
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
    expect(await api.ajustarEstoque(ajuste(caderno.id, 5, { saldoVisto: 7 }), { ...joao, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await saldo(api, caderno.id)).toBe(7)
  })

  it('[R-ESTOQUE-11] o ajuste da própria dona já nasce conferido', async () => {
    const api = abrir('vazia')
    const { dona, caderno } = await loja(api)
    expect(dado(await api.ajustarEstoque(ajuste(caderno.id, 12), dona))).toMatchObject({ saldo: 12 })
    expect(api.ajustes(caderno.id)).toMatchObject([{ quantidade: 2, operador: 'Helena', conferidoPor: 'Helena' }])
  })

  it('[R-ESTOQUE-11] [R-OPERADOR-06] a dona confere um, ou todos de uma vez; o já conferido é ignorado', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    await api.ajustarEstoque(ajuste(caderno.id, 9), joao)
    await api.ajustarEstoque(ajuste(caderno.id, 8, { saldoVisto: 9 }), joao)
    await api.ajustarEstoque(ajuste(caderno.id, 6, { saldoVisto: 8 }), dona)
    const [daDona, segundo, primeiro] = api.ajustes(caderno.id)
    expect(dado(await api.conferirAjustes([primeiro.id], dona))).toEqual({ conferidos: 1 })
    expect(dado(await api.conferirAjustes([primeiro.id, segundo.id, daDona.id, segundo.id], dona))).toEqual({ conferidos: 1 })
    expect(api.ajustes(caderno.id).map((a) => a.conferidoPor)).toEqual(['Helena', 'Helena', 'Helena'])
  })

  it('[R-ESTOQUE-11] só a dona confere, com o PIN dela; ajuste que não existe, ou nenhum, é recusado', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    await api.ajustarEstoque(ajuste(caderno.id, 9), joao)
    const [feito] = api.ajustes(caderno.id)
    expect(await api.conferirAjustes([feito.id], joao)).toEqual({ ok: false, causa: 'permissao', erro: MENSAGENS.soAdmin })
    expect(await api.conferirAjustes([feito.id], { ...dona, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await api.conferirAjustes([feito.id, 'nao-existe'], dona)).toEqual({ ok: false, causa: 'nao-encontrado', erro: MENSAGEM_AJUSTE_NAO_ENCONTRADO })
    expect(await api.conferirAjustes([], dona)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(api.ajustes(caderno.id)[0].conferidoPor).toBeNull()
  })

  it('[R-ESTOQUE-10] o saldo mudou desde que a tela abriu: conflito, com o saldo de agora', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7, { saldoVisto: 11 }), joao))
      .toEqual({ ok: false, causa: 'conflito', erro: MENSAGENS_AJUSTE.mudou(10) })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 10), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.igual })
    expect(await saldo(api, caderno.id)).toBe(10)
  })

  it('[R-ESTOQUE-02] recusa produto desativado, contagem fora do formato e motivo vazio', async () => {
    const api = abrir('vazia')
    const { joao, caderno, cola } = await loja(api)
    expect(await api.ajustarEstoque(ajuste(cola.id, 3, { saldoVisto: 0 }), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_ENTRADA.desativado('Cola') })
    expect(await api.ajustarEstoque(ajuste(caderno.id, -1), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.contagem })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 1.5), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.contagem })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7, { motivo: '  ' }), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.motivo })
    expect(await api.ajustarEstoque(ajuste('nao-existe', 7), joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    // Contagem zero é válida: a prateleira pode estar vazia.
    expect(dado(await api.ajustarEstoque(ajuste(caderno.id, 0), joao))).toMatchObject({ saldo: 0 })
  })

  it('[R-OPERADOR-04] PIN errado da dona na conferência conta para a espera dela', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    await api.ajustarEstoque(ajuste(caderno.id, 9), joao)
    const [feito] = api.ajustes(caderno.id)
    for (let i = 0; i < LIMITE_ERROS; i++) await api.conferirAjustes([feito.id], { ...dona, pin: '0000' })
    expect(await api.renomearOperador(joao.operadorId, 'João Silva', dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.espera(30) })
  })

  it('[R-CORRECAO-05] ajuste errado se corrige com outro ajuste; os dois ficam no histórico', async () => {
    const api = abrir('vazia')
    const { dona, caderno } = await loja(api)
    dado(await api.ajustarEstoque(ajuste(caderno.id, 1), dona))
    const corrigido = dado(await api.ajustarEstoque(ajuste(caderno.id, 10, { saldoVisto: 1, motivo: 'Corrige a contagem errada' }), dona))
    expect(corrigido.saldo).toBe(10)
    expect(api.ajustes(caderno.id).map((a) => [a.quantidade, a.motivo])).toEqual([[9, 'Corrige a contagem errada'], [-9, 'Contagem da prateleira']])
  })
})
