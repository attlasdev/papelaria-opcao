import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGISTRO_VAZIO } from '../../comum/regras/backup'
import { criarRegistro } from './registro'

let pasta: string
let arquivo: string
beforeEach(() => {
  pasta = mkdtempSync(path.join(tmpdir(), 'registro-'))
  arquivo = path.join(pasta, 'estado-backup.json')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(pasta, { recursive: true, force: true })
})

describe('[R-LOGIN-01] registro do backup da máquina', () => {
  it('sem arquivo: nunca entrou, nenhuma cópia, nada esperando', () => {
    expect(criarRegistro(arquivo).ler()).toEqual(REGISTRO_VAZIO)
  })

  it('grava e lê de volta numa abertura nova, sem deixar o temporário', () => {
    criarRegistro(arquivo).atualizar({ entrouEm: '2026-10-27T18:00:00.000Z', pendenteDesde: '2026-10-27T18:01:00.000Z' })
    criarRegistro(arquivo).atualizar({ pendenteDesde: null, ultimaCopiaEm: '2026-10-27T18:05:00.000Z' })
    expect(criarRegistro(arquivo).ler()).toEqual({ entrouEm: '2026-10-27T18:00:00.000Z', ultimaCopiaEm: '2026-10-27T18:05:00.000Z', pendenteDesde: null })
    expect(existsSync(`${arquivo}.gravando`)).toBe(false)
  })

  it('arquivo estragado ou mexido vale como vazio no que não for instante', () => {
    writeFileSync(arquivo, '{ isto não é json')
    expect(criarRegistro(arquivo).ler()).toEqual(REGISTRO_VAZIO)
    writeFileSync(arquivo, JSON.stringify({ entrouEm: 'ontem', ultimaCopiaEm: 5, pendenteDesde: '2026-10-27T18:01:00.000Z' }))
    expect(criarRegistro(arquivo).ler()).toEqual({ entrouEm: null, ultimaCopiaEm: null, pendenteDesde: '2026-10-27T18:01:00.000Z' })
  })

  it('sem conseguir gravar, fica na memória e o app segue', () => {
    const registro = criarRegistro(path.join(pasta, 'nao-existe', 'estado-backup.json'))
    expect(registro.atualizar({ entrouEm: '2026-10-27T18:00:00.000Z' }).entrouEm).toBe('2026-10-27T18:00:00.000Z')
    expect(registro.ler().entrouEm).toBe('2026-10-27T18:00:00.000Z')
    expect(existsSync(arquivo)).toBe(false)
  })
})
