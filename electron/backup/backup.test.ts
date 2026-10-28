import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBanco, versaoDoBanco, type Banco } from '../banco/banco'
import { migracoes } from '../banco/migracoes'
import { semearBanco } from '../banco/semente'
import { COPIAS_LOCAIS, criarAgendador, fazerCopia, NOME_ATUAL, restaurarCopia, type Destino } from './backup'

/** O armazenamento da nuvem, em memória, com as mesmas regras: sem apagar, e diária não se sobrescreve. */
function destinoFalso() {
  const arquivos = new Map<string, Uint8Array>()
  let fora = false
  const destino: Destino = {
    async enviar(nome, bytes, sobrescrever) {
      if (fora) throw new Error('sem internet')
      if (!sobrescrever && arquivos.has(nome)) return 'ja-existe'
      arquivos.set(nome, bytes)
      return 'enviado'
    },
    async baixar(nome) {
      const bytes = arquivos.get(nome)
      if (!bytes) throw new Error(`não existe: ${nome}`)
      return bytes
    },
    async listar(pasta) {
      return [...arquivos.keys()].filter((n) => n.startsWith(`${pasta}/`)).map((n) => n.slice(pasta.length + 1))
    },
  }
  return { destino, arquivos, semInternet: (valor: boolean) => { fora = valor } }
}

let pasta: string
let banco: Banco
beforeEach(() => {
  pasta = mkdtempSync(path.join(tmpdir(), 'backup-'))
  banco = abrirBanco(path.join(pasta, 'loja.sqlite'))
  semearBanco(banco, { hoje: '2026-10-27' })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  banco.close()
  vi.restoreAllMocks()
  rmSync(pasta, { recursive: true, force: true })
})

const contarFichas = (b: Banco) => (b.prepare('select count(*) n from ficha').get() as { n: number }).n
const ULTIMA = migracoes.length
const ESTA_TARDE = new Date('2026-10-28T15:00:00-03:00')

describe('cópia', () => {
  it('manda a atual e a diária para a nuvem e guarda a do dia no computador', async () => {
    const nuvem = destinoFalso()
    const resultado = await fazerCopia(banco, { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: ESTA_TARDE })
    expect(resultado.diaria).toBe('enviado')
    expect([...nuvem.arquivos.keys()].sort()).toEqual([NOME_ATUAL, 'dias/2026-10-28.sqlite.gz'])
    expect(readdirSync(path.join(pasta, 'copias'))).toEqual(['2026-10-28.sqlite'])
  })

  it('a segunda cópia do dia troca só a atual; a diária fica a primeira', async () => {
    const nuvem = destinoFalso()
    const opcoes = { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: ESTA_TARDE }
    await fazerCopia(banco, opcoes)
    const primeiraDiaria = nuvem.arquivos.get('dias/2026-10-28.sqlite.gz')
    banco.prepare("update operador set nome = 'Joana' where admin = 1").run()
    expect((await fazerCopia(banco, opcoes)).diaria).toBe('ja-existe')
    expect(nuvem.arquivos.get('dias/2026-10-28.sqlite.gz')).toBe(primeiraDiaria)
    expect(nuvem.arquivos.get(NOME_ATUAL)).not.toBe(primeiraDiaria)
  })

  it('o dia é o de São Paulo, também depois das 21h (já é amanhã em UTC)', async () => {
    const nuvem = destinoFalso()
    await fazerCopia(banco, { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: new Date('2026-10-28T22:30:00-03:00') })
    expect(nuvem.arquivos.has('dias/2026-10-28.sqlite.gz')).toBe(true)
  })

  it('sem internet a cópia local fica e o envio falha (para tentar de novo)', async () => {
    const nuvem = destinoFalso()
    nuvem.semInternet(true)
    await expect(fazerCopia(banco, { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: ESTA_TARDE })).rejects.toThrow('sem internet')
    expect(readdirSync(path.join(pasta, 'copias'))).toEqual(['2026-10-28.sqlite'])
  })

  it(`guarda só as ${COPIAS_LOCAIS} últimas cópias no computador`, async () => {
    const locais = path.join(pasta, 'copias')
    for (let dia = 1; dia <= 40; dia++) {
      await fazerCopia(banco, { destino: destinoFalso().destino, pastaLocal: locais, agora: new Date(Date.UTC(2026, 8, dia, 15)) })
    }
    const restantes = readdirSync(locais).sort()
    expect(restantes).toHaveLength(COPIAS_LOCAIS)
    expect(restantes[0]).toBe('2026-09-11.sqlite')
  })
})

describe('agendador', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('copia só quando houve mudança, a cada volta', async () => {
    const fazer = vi.fn(async () => {})
    const agenda = criarAgendador(fazer, 1000)
    await vi.advanceTimersByTimeAsync(3000)
    expect(fazer).not.toHaveBeenCalled()
    agenda.marcarMudanca()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fazer).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(fazer).toHaveBeenCalledTimes(1)
    await agenda.aoFechar()
  })

  it('falhou (sem internet): a mudança continua pendente e vai na próxima volta', async () => {
    const fazer = vi.fn().mockRejectedValueOnce(new Error('sem internet')).mockResolvedValue(undefined)
    const agenda = criarAgendador(fazer, 1000)
    agenda.marcarMudanca()
    await vi.advanceTimersByTimeAsync(1000)
    expect(agenda.pendente).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fazer).toHaveBeenCalledTimes(2)
    expect(agenda.pendente).toBe(false)
    await agenda.aoFechar()
  })

  it('ao fechar copia o que estiver pendente, sem esperar além do limite', async () => {
    const fazer = vi.fn(() => new Promise<void>(() => {}))
    const agenda = criarAgendador(fazer, 60_000)
    agenda.marcarMudanca()
    const fechando = agenda.aoFechar(5000)
    await vi.advanceTimersByTimeAsync(5000)
    await fechando
    expect(fazer).toHaveBeenCalledTimes(1)
  })
})

describe('restauração (só pelo suporte)', () => {
  it('traz a cópia da nuvem e guarda o banco que estava no lugar, com o -wal', async () => {
    const nuvem = destinoFalso()
    await fazerCopia(banco, { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: ESTA_TARDE })
    const fichas = contarFichas(banco)
    banco.close()

    const caminho = path.join(pasta, 'loja.sqlite')
    writeFileSync(`${caminho}-wal`, 'sobra de uma sessão anterior')
    const { guardado } = await restaurarCopia({ destino: nuvem.destino, nome: NOME_ATUAL, caminhoBanco: caminho, versaoApp: ULTIMA, agora: ESTA_TARDE })

    expect(guardado && existsSync(guardado) && existsSync(`${guardado}-wal`)).toBe(true)
    expect(existsSync(`${caminho}-wal`)).toBe(false)
    banco = abrirBanco(caminho)
    expect(contarFichas(banco)).toBe(fichas)
  })

  it('máquina nova, sem banco: só traz a cópia', async () => {
    const nuvem = destinoFalso()
    await fazerCopia(banco, { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: ESTA_TARDE })
    const caminho = path.join(pasta, 'nova', 'loja.sqlite')
    rmSync(path.dirname(caminho), { recursive: true, force: true })
    mkdirSync(path.dirname(caminho))
    expect(await restaurarCopia({ destino: nuvem.destino, nome: 'dias/2026-10-28.sqlite.gz', caminhoBanco: caminho, versaoApp: ULTIMA })).toEqual({ guardado: null })
    const restaurado = abrirBanco(caminho)
    expect(versaoDoBanco(restaurado)).toBe(ULTIMA)
    restaurado.close()
  })

  it('recusa cópia mais nova que o app e não toca no banco do lugar', async () => {
    const nuvem = destinoFalso()
    banco.exec('pragma user_version = 9')
    await fazerCopia(banco, { destino: nuvem.destino, pastaLocal: path.join(pasta, 'copias'), agora: ESTA_TARDE })
    banco.exec(`pragma user_version = ${ULTIMA}`)
    banco.close()
    const caminho = path.join(pasta, 'loja.sqlite')
    await expect(restaurarCopia({ destino: nuvem.destino, nome: NOME_ATUAL, caminhoBanco: caminho, versaoApp: ULTIMA })).rejects.toThrow(/versão 9/)
    banco = abrirBanco(caminho)
    expect(versaoDoBanco(banco)).toBe(ULTIMA)
    expect(readdirSync(pasta).filter((n) => n.includes('restaura'))).toEqual([])
  })

  it('recusa arquivo que não é banco', async () => {
    const nuvem = destinoFalso()
    nuvem.arquivos.set(NOME_ATUAL, gzipSync(Buffer.from('isto não é um banco')))
    banco.close()
    const caminho = path.join(pasta, 'loja.sqlite')
    await expect(restaurarCopia({ destino: nuvem.destino, nome: NOME_ATUAL, caminhoBanco: caminho, versaoApp: ULTIMA })).rejects.toThrow()
    banco = abrirBanco(caminho)
    expect(contarFichas(banco)).toBeGreaterThan(0)
  })
})
