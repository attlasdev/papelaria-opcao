/**
 * Login e backup (1.0, Fase 3.5; `R-LOGIN-01`): os mesmos cenários no mock e no
 * SQLite. O registro da máquina e a sessão são controlados pelo cenário; o
 * sino é o de cada lado, com o aviso do backup por cima. Hoje é 27/10, 15h.
 */
import { beforeEach, expect, it } from 'vitest'
import type { DadosBoleto, EstadoBackup } from '../../comum/contrato'
import { REGISTRO_VAZIO, operacoesDoBackup, type RegistroBackup } from '../../comum/regras/backup'
import { criarTentativas } from '../../comum/regras/operador'
import { avisosSqlite } from '../../electron/banco/avisos'
import type { Banco } from '../../electron/banco/banco'
import { boletosSqlite } from '../../electron/banco/boletos'
import { inicioSqlite } from '../../electron/banco/inicio'
import { criarBackupDaBase } from '../../src/mock/operacoes/backup'
import { criarBoletosDaBase } from '../../src/mock/operacoes/boletos'
import { criarInicioDaBase } from '../../src/mock/operacoes/inicio'
import { AGORA, testarContrato } from './estrutura'

/** O que o cenário diz sobre esta máquina. */
const maquina: { sessao: boolean; registro: RegistroBackup } = { sessao: true, registro: { ...REGISTRO_VAZIO } }
beforeEach(() => { maquina.sessao = true; maquina.registro = { ...REGISTRO_VAZIO } })

const fonte = {
  registro: () => maquina.registro,
  temSessao: async () => maquina.sessao,
  marcarEntrada: () => { maquina.registro = { ...maquina.registro, entrouEm: new Date().toISOString() } },
}
const mock = () => {
  const t = criarTentativas()
  return { ...criarBoletosDaBase(t), ...criarInicioDaBase(), ...criarBackupDaBase(maquina) }
}
const sqlite = (banco: Banco) => {
  const t = criarTentativas()
  return { ...boletosSqlite(() => banco, t), ...inicioSqlite(() => banco), ...operacoesDoBackup(fonte, avisosSqlite(() => banco)) }
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/** Vencido em 20/10: um aviso da loja, para ver a ordem e o lido. */
const LUZ: DadosBoleto = { descricao: 'Luz', valor: 10000, numero: '123', vencimento: '2026-10-20' }

const minutosAtras = (n: number) => new Date(AGORA.getTime() - n * 60_000).toISOString()

testarContrato('login e backup', { mock, sqlite }, (abrir) => {
  it('[R-LOGIN-01] primeira abertura sem login: a loja precisa entrar', async () => {
    maquina.sessao = false
    const estado: EstadoBackup = dado(await abrir().obterEstadoBackup())
    expect(estado).toEqual({ sessao: false, precisaEntrar: true, ultimaCopiaEm: null, pendenteDesde: null, parada: true })
  })

  it('[B-005] entrou antes do registro existir: com sessão, fica registrado, e perder a sessão não pede o login', async () => {
    const api = abrir()
    expect(dado(await api.obterEstadoBackup())).toMatchObject({ sessao: true, precisaEntrar: false })
    expect(maquina.registro.entrouEm).toBe(AGORA.toISOString())
    maquina.sessao = false
    expect(dado(await api.obterEstadoBackup())).toMatchObject({ sessao: false, precisaEntrar: false, parada: true })
  })

  it('[R-LOGIN-01] já entrou uma vez: perder a sessão não para a loja, só a cópia', async () => {
    maquina.sessao = false
    maquina.registro = { entrouEm: minutosAtras(60 * 24), ultimaCopiaEm: minutosAtras(10), pendenteDesde: null }
    const estado = dado(await abrir().obterEstadoBackup())
    expect(estado).toMatchObject({ sessao: false, precisaEntrar: false, ultimaCopiaEm: minutosAtras(10), parada: true })
  })

  it('[R-LOGIN-01] com sessão, mudança esperando: parada só depois de 1 hora', async () => {
    const api = abrir()
    maquina.registro = { entrouEm: minutosAtras(600), ultimaCopiaEm: minutosAtras(300), pendenteDesde: minutosAtras(60) }
    expect(dado(await api.obterEstadoBackup())).toMatchObject({ sessao: true, precisaEntrar: false, pendenteDesde: minutosAtras(60), parada: false })
    maquina.registro = { ...maquina.registro, pendenteDesde: minutosAtras(61) }
    expect(dado(await api.obterEstadoBackup()).parada).toBe(true)
  })

  it('[R-LOGIN-01] horas sem mexer não é cópia parada: conta da mudança, não da última cópia', async () => {
    maquina.registro = { entrouEm: minutosAtras(600), ultimaCopiaEm: minutosAtras(300), pendenteDesde: minutosAtras(1) }
    expect(dado(await abrir().obterEstadoBackup()).parada).toBe(false)
  })

  it('[R-LOGIN-01] o sino avisa a cópia parada na frente de tudo, e leva a entrar', async () => {
    const api = abrir()
    dado(await api.cadastrarBoleto(LUZ))
    maquina.registro = { ...maquina.registro, entrouEm: minutosAtras(600) }

    const emDia = dado(await api.listarAvisos())
    expect(emDia.map((a) => a.id)).toEqual(['boleto-vencido'])

    maquina.sessao = false
    const parada = dado(await api.listarAvisos())
    expect(parada.map((a) => a.id)).toEqual(['copia-parada', 'boleto-vencido'])
    expect(parada[0]).toMatchObject({ tipo: 'copia-parada', tom: 'critico', titulo: 'Cópia na nuvem parada', destino: { tela: 'entrar' }, lido: false })
    expect(parada[0].detalhe).toContain('Entre de novo')

    maquina.sessao = true
    maquina.registro = { ...maquina.registro, pendenteDesde: minutosAtras(90) }
    expect(dado(await api.listarAvisos())[0].detalhe).toContain('não sobem há mais de 1 hora')
  })

  it('[R-LOGIN-01] a cópia parada nunca conta como lida; os outros avisos, sim', async () => {
    const api = abrir()
    dado(await api.cadastrarBoleto(LUZ))
    maquina.sessao = false
    const depois = dado(await api.marcarAvisosLidos(['copia-parada', 'boleto-vencido']))
    expect(depois.map((a) => [a.id, a.lido])).toEqual([['copia-parada', false], ['boleto-vencido', true]])
    expect(dado(await api.listarAvisos()).map((a) => [a.id, a.lido])).toEqual([['copia-parada', false], ['boleto-vencido', true]])
  })

  it('[R-LOGIN-01] a cópia voltou: o aviso some sozinho', async () => {
    const api = abrir()
    maquina.sessao = false
    maquina.registro = { entrouEm: minutosAtras(600), ultimaCopiaEm: null, pendenteDesde: minutosAtras(120) }
    expect(dado(await api.listarAvisos()).map((a) => a.id)).toEqual(['copia-parada'])
    maquina.sessao = true
    maquina.registro = { ...maquina.registro, ultimaCopiaEm: AGORA.toISOString(), pendenteDesde: null }
    expect(dado(await api.listarAvisos())).toEqual([])
    expect(dado(await api.obterEstadoBackup())).toMatchObject({ parada: false, ultimaCopiaEm: AGORA.toISOString() })
  })
})
