import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configurarLog, formatarLinha, limparSegredos, log } from './log'

describe('[A6] log em arquivo', () => {
  let pasta: string
  beforeEach(() => {
    pasta = mkdtempSync(path.join(tmpdir(), 'log-'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    configurarLog(null)
    vi.restoreAllMocks()
    rmSync(pasta, { recursive: true, force: true })
  })

  it('grava cada linha com instante, nível e origem, inclusive a pilha do erro', () => {
    configurarLog(path.join(pasta, 'logs'))
    log.erro('salvarBase', new Error('o banco recusou'))
    log.info('inicio', 'versão 1.0.0')
    const texto = readFileSync(path.join(pasta, 'logs', 'app.log'), 'utf8')
    expect(texto).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z ERRO \[salvarBase\] Error: o banco recusou\n\s+at /)
    expect(texto).toMatch(/INFO \[inicio\] versão 1\.0\.0\n$/)
  })

  it('passou de 1 MB, roda: guarda três antigos e descarta o resto', () => {
    const logs = path.join(pasta, 'logs')
    configurarLog(logs)
    log.info('x', 'primeira')
    for (let volta = 0; volta < 5; volta++) {
      writeFileSync(path.join(logs, 'app.log'), 'x'.repeat(1024 * 1024))
      log.info('x', `volta ${volta}`)
    }
    expect(['app.log', 'app.1.log', 'app.2.log', 'app.3.log'].map((n) => existsSync(path.join(logs, n)))).toEqual([true, true, true, true])
    expect(existsSync(path.join(logs, 'app.4.log'))).toBe(false)
    expect(readFileSync(path.join(logs, 'app.log'), 'utf8')).toMatch(/volta 4\n$/)
  })

  it('pasta impossível de gravar não derruba o app: a linha vai só para o console', () => {
    const arquivoNoCaminho = path.join(pasta, 'ocupado')
    writeFileSync(arquivoNoCaminho, '')
    configurarLog(path.join(arquivoNoCaminho, 'logs'))
    expect(() => log.erro('x', 'não pode lançar')).not.toThrow()
  })
})

describe('[A6] nenhuma credencial no log (regra 3)', () => {
  it.each([
    ['JWT antigo (anon/service_role)', 'chave eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.abc-123_x no pedido', 'chave [jwt] no pedido'],
    ['chave nova do Supabase', 'usando sb_publishable_AbC123-xyz e sb_secret_Q9w8', 'usando sb_publishable_[chave] e sb_secret_[chave]'],
    ['cabeçalho de autorização', 'Authorization: Bearer abc.def-ghi', 'Authorization: Bearer [token]'],
    ['campos de credencial em JSON', '{"apikey":"k1","password":"p2","refresh_token":"r3"}', '{"apikey":"[oculto]","password":"[oculto]","refresh_token":"[oculto]"}'],
    ['senha na URL', 'postgres://usuario:segredo@db.exemplo.co:5432/postgres', 'postgres://usuario:[oculto]@db.exemplo.co:5432/postgres'],
  ])('%s', (_, entrada, saida) => {
    expect(limparSegredos(entrada)).toBe(saida)
  })

  it('a limpeza vale também para o texto do erro e da pilha', () => {
    const erro = new Error('falhou com apikey=sb_secret_XYZ')
    const linha = formatarLinha('erro', 'x', [erro])
    expect(linha).not.toMatch(/XYZ/)
  })

  it('não estraga o texto comum', () => {
    expect(limparSegredos('Venda #1131 concluída em https://exemplo.supabase.co/rest/v1/base_loja')).toBe('Venda #1131 concluída em https://exemplo.supabase.co/rest/v1/base_loja')
  })
})
