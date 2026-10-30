/**
 * Ajuste de estoque (1.0, tela 2.5): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Estoque" e "Operadores e
 * login". A lista de movimentos só entra no contrato na tela 2.6; até lá cada
 * lado mostra aqui o último ajuste que gravou (`ultimoAjuste`).
 */
import { expect, it } from 'vitest'
import type { Ajuste, Assinatura, DadosProduto } from '../../comum/contrato'
import { MENSAGENS_AJUSTE } from '../../comum/regras/ajuste'
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

type Gravado = { quantidade: number; motivo: string; operador: string; autorizadoPor: string | null }

type Api = OperacoesOperador & OperacoesProduto & OperacoesAjuste & { ultimoAjuste: (produtoId: string) => Gravado | null }

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarAjustesDaBase(t),
    ultimoAjuste: (produtoId) => {
      const m = obterBase().movimentosEstoque.find((x) => x.produto === produtoId && x.tipo === 'Ajuste')
      return m ? { quantidade: m.depois - m.antes, motivo: m.motivo, operador: m.operador!, autorizadoPor: m.autorizadoPor ?? null } : null
    },
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...ajustesSqlite(() => banco, t),
    ultimoAjuste: (produtoId) => {
      const l = banco.prepare(`
        select m.quantidade, m.motivo, o.nome as operador, a.nome as autorizadoPor
        from movimento_estoque m join operador o on o.id = m.operador_id left join operador a on a.id = m.autorizado_por_id
        where m.produto_id = ? and m.tipo = 'ajuste' order by m.rowid desc limit 1`).get(produtoId) as Gravado | undefined
      return l ? { ...l } : null
    },
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
  it('[R-OPERADOR-06] quem faz assina e a dona autoriza; o movimento guarda a diferença e os dois', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    expect(dado(await api.ajustarEstoque(ajuste(caderno.id, 7, { motivo: ' 3 quebrados ' }), joao, dona))).toMatchObject({ saldo: 7 })
    expect(api.ultimoAjuste(caderno.id)).toEqual({ quantidade: -3, motivo: '3 quebrados', operador: 'João', autorizadoPor: 'Helena' })
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
  })

  it('[R-OPERADOR-06] se é a dona que ajusta, um PIN basta', async () => {
    const api = abrir('vazia')
    const { dona, caderno } = await loja(api)
    expect(dado(await api.ajustarEstoque(ajuste(caderno.id, 12), dona, null))).toMatchObject({ saldo: 12 })
    expect(api.ultimoAjuste(caderno.id)).toMatchObject({ quantidade: 2, operador: 'Helena', autorizadoPor: null })
  })

  it('[R-OPERADOR-06] sem o PIN da dona, com o PIN errado dela, ou outra pessoa no lugar dela: nada muda', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7), joao, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.semDona })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7), joao, { ...dona, pin: '0000' }))
      .toEqual({ ok: false, causa: 'validacao', erro: `Administradora: ${MENSAGENS.pinErrado}` })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7), joao, joao)).toEqual({ ok: false, causa: 'permissao', erro: MENSAGENS.soAdmin })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7), { ...joao, pin: '0000' }, dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await saldo(api, caderno.id)).toBe(10)
    expect(api.ultimoAjuste(caderno.id)).toBeNull()
  })

  it('[R-ESTOQUE-10] o saldo mudou desde que a tela abriu: conflito, com o saldo de agora', async () => {
    const api = abrir('vazia')
    const { dona, caderno } = await loja(api)
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7, { saldoVisto: 11 }), dona, null))
      .toEqual({ ok: false, causa: 'conflito', erro: MENSAGENS_AJUSTE.mudou(10) })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 10), dona, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.igual })
    expect(await saldo(api, caderno.id)).toBe(10)
  })

  it('[R-ESTOQUE-02] recusa produto desativado, contagem fora do formato e motivo vazio', async () => {
    const api = abrir('vazia')
    const { dona, caderno, cola } = await loja(api)
    expect(await api.ajustarEstoque(ajuste(cola.id, 3, { saldoVisto: 0 }), dona, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_ENTRADA.desativado('Cola') })
    expect(await api.ajustarEstoque(ajuste(caderno.id, -1), dona, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.contagem })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 1.5), dona, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.contagem })
    expect(await api.ajustarEstoque(ajuste(caderno.id, 7, { motivo: '  ' }), dona, null)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_AJUSTE.motivo })
    expect(await api.ajustarEstoque(ajuste('nao-existe', 7), dona, null)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    // Contagem zero é válida: a prateleira pode estar vazia.
    expect(dado(await api.ajustarEstoque(ajuste(caderno.id, 0), dona, null))).toMatchObject({ saldo: 0 })
  })

  it('[R-OPERADOR-04] PIN errado da dona no ajuste conta para a espera dela', async () => {
    const api = abrir('vazia')
    const { dona, joao, caderno } = await loja(api)
    for (let i = 0; i < LIMITE_ERROS; i++) await api.ajustarEstoque(ajuste(caderno.id, 7), joao, { ...dona, pin: '0000' })
    expect(await api.renomearOperador(joao.operadorId, 'João Silva', dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.espera(30) })
  })

  it('[R-CORRECAO-05] ajuste errado se corrige com outro ajuste; os dois ficam no histórico', async () => {
    const api = abrir('vazia')
    const { dona, caderno } = await loja(api)
    dado(await api.ajustarEstoque(ajuste(caderno.id, 1), dona, null))
    const corrigido = dado(await api.ajustarEstoque(ajuste(caderno.id, 10, { saldoVisto: 1, motivo: 'Corrige a contagem errada' }), dona, null))
    expect(corrigido.saldo).toBe(10)
    expect(api.ultimoAjuste(caderno.id)).toMatchObject({ quantidade: 9, motivo: 'Corrige a contagem errada' })
  })
})
