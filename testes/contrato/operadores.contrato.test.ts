/**
 * Operadores (1.0, tela 1): os mesmos cenários no mock (base da demonstração)
 * e no SQLite. Regras em Memoria.md, "Operadores e login".
 */
import { expect, it, vi } from 'vitest'
import type { Operador } from '../../comum/contrato'
import { ESPERA_MS, LIMITE_ERROS, MENSAGENS } from '../../comum/regras/operador'
import type { Banco } from '../../electron/banco/banco'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { PINS } from '../../electron/banco/semente'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { AGORA, testarContrato } from './estrutura'

const mock = () => criarOperadoresDaBase()
const sqlite = (banco: Banco) => operadoresSqlite(() => banco)

async function pessoas(api: OperacoesOperador) {
  const r = await api.listarOperadores()
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

async function porNome(api: OperacoesOperador, nome: string): Promise<Operador> {
  const achada = (await pessoas(api)).pessoas.find((p) => p.nome === nome)
  if (!achada) throw new Error(`sem ${nome}`)
  return achada
}

/** Loja nova com a dona (PIN 1234) já cadastrada. */
async function comDona(api: OperacoesOperador) {
  const r = await api.cadastrarAdministradora('Helena Prado', '1234')
  if (!r.ok) throw new Error(r.erro)
  return { operadorId: r.dado.id, pin: '1234' }
}

testarContrato('operadores', { mock, sqlite }, (abrir) => {
  it('[R-OPERADOR-05] loja nova: cadastra a administradora uma vez só', async () => {
    const api = abrir('vazia')
    expect(await pessoas(api)).toEqual({ pessoas: [], ultimoId: null })
    expect(await api.cadastrarAdministradora('  Helena   Prado ', '1234'))
      .toMatchObject({ ok: true, dado: { nome: 'Helena Prado', admin: true, ativo: true, temPin: true } })
    expect(await api.cadastrarAdministradora('Outra', '9999')).toEqual({ ok: false, causa: 'conflito', erro: MENSAGENS.adminJaExiste })
  })

  it('[R-OPERADOR-01] PIN de 4 números e nome único, sem diferenciar maiúscula', async () => {
    const api = abrir('vazia')
    for (const pin of ['123', '12345', '12a4', ' 1234', 1234 as unknown as string]) {
      expect(await api.cadastrarAdministradora('Helena', pin)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinFormato })
    }
    expect(await api.cadastrarAdministradora('   ', '1234')).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.nomeVazio })
    const dona = await comDona(api)
    expect(await api.cadastrarOperador('João', '2222', dona)).toMatchObject({ ok: true })
    expect(await api.cadastrarOperador('JOãO', '3333', dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.nomeRepetido })
  })

  it('[R-OPERADOR-03] cadastrar, renomear, desativar e redefinir só com o PIN da dona', async () => {
    const api = abrir('vazia')
    const dona = await comDona(api)
    const joao = await api.cadastrarOperador('João', '2222', dona)
    if (!joao.ok) throw new Error(joao.erro)
    const assinaJoao = { operadorId: joao.dado.id, pin: '2222' }

    expect(await api.cadastrarOperador('Bia', '4444', assinaJoao)).toEqual({ ok: false, causa: 'permissao', erro: MENSAGENS.soAdmin })
    expect(await api.cadastrarOperador('Bia', '4444', { ...dona, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await api.cadastrarOperador('Bia', '4444', { operadorId: 'ninguem', pin: '1234' })).toMatchObject({ ok: false, causa: 'nao-encontrado' })

    expect(await api.renomearOperador(joao.dado.id, 'João Silva', dona)).toMatchObject({ ok: true, dado: { nome: 'João Silva' } })
    expect(await api.ativarOperador(joao.dado.id, false, dona)).toMatchObject({ ok: true, dado: { ativo: false } })
    expect(await api.ativarOperador(joao.dado.id, true, dona)).toMatchObject({ ok: true, dado: { ativo: true } })
    expect(await api.ativarOperador(dona.operadorId, false, dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.adminAtiva })
    expect(await api.renomearOperador('ninguem', 'X', dona)).toMatchObject({ ok: false, causa: 'nao-encontrado' })

    // PIN esquecido: a dona define outro; o antigo deixa de valer, também o dela.
    expect(await api.redefinirPin(dona.operadorId, '5678', dona)).toMatchObject({ ok: true })
    expect(await api.cadastrarOperador('Bia', '4444', dona)).toMatchObject({ ok: false, erro: MENSAGENS.pinErrado })
    expect(await api.cadastrarOperador('Bia', '4444', { ...dona, pin: '5678' })).toMatchObject({ ok: true })
  })

  it('[R-OPERADOR-04] 5 PINs errados seguidos: 30 segundos de espera, mesmo com o PIN certo', async () => {
    const api = abrir('vazia')
    const dona = await comDona(api)
    const errado = { ...dona, pin: '0000' }

    // Acertar zera a conta: 4 erros, um acerto, mais 4 erros ainda não bloqueiam.
    for (let i = 1; i < LIMITE_ERROS; i++) await api.cadastrarOperador(`A${i}`, '1111', errado)
    expect(await api.cadastrarOperador('Ana', '1111', dona)).toMatchObject({ ok: true })
    for (let i = 1; i < LIMITE_ERROS; i++) {
      expect(await api.cadastrarOperador(`B${i}`, '1111', errado)).toMatchObject({ erro: MENSAGENS.pinErrado })
    }

    expect(await api.cadastrarOperador('Bia', '1111', errado)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.espera(30) })
    expect(await api.cadastrarOperador('Bia', '1111', dona)).toMatchObject({ ok: false, causa: 'validacao', erro: MENSAGENS.espera(30) })
    vi.setSystemTime(AGORA.getTime() + ESPERA_MS - 1000)
    expect(await api.cadastrarOperador('Bia', '1111', dona)).toMatchObject({ erro: MENSAGENS.espera(1) })
    vi.setSystemTime(AGORA.getTime() + ESPERA_MS)
    expect(await api.cadastrarOperador('Bia', '1111', dona)).toMatchObject({ ok: true })
  })

  it('[R-OPERADOR-07] na semente: a dona primeiro, a desativada continua listada, o último a usar vem marcado', async () => {
    const api = abrir('semente')
    const lista = await pessoas(api)
    expect(lista.pessoas.map((p) => [p.nome, p.admin, p.ativo])).toEqual([
      ['Helena Prado', true, true],
      ['João Silva', false, true],
      ['Márcia Antunes', false, false],
    ])
    const joao = await porNome(api, 'João Silva')
    expect(lista.ultimoId).toBe(joao.id)

    // Desativado deixa de vir marcado.
    const dona = { operadorId: (await porNome(api, 'Helena Prado')).id, pin: PINS.dona }
    expect(await api.ativarOperador(joao.id, false, dona)).toMatchObject({ ok: true })
    expect((await pessoas(api)).ultimoId).toBeNull()
  })

  it('[R-OPERADOR-08] o PIN e o hash nunca voltam para a tela', async () => {
    const api = abrir('semente')
    const dona = { operadorId: (await porNome(api, 'Helena Prado')).id, pin: PINS.dona }
    const respostas = [
      await api.listarOperadores(),
      await api.cadastrarOperador('Bia', '4321', dona),
      await api.redefinirPin((await porNome(api, 'Bia')).id, '8765', dona),
    ]
    const operadores = respostas.flatMap((r) => (!r.ok ? [] : 'pessoas' in r.dado ? r.dado.pessoas : [r.dado]))
    expect(operadores.length).toBeGreaterThan(3)
    for (const o of operadores) expect(Object.keys(o).sort()).toEqual(['admin', 'ativo', 'id', 'nome', 'temPin'])
    expect(JSON.stringify(respostas)).not.toMatch(/scrypt|sha256/)
  })
})
