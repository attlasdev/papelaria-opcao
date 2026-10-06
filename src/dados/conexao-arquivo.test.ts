import { describe, expect, it } from 'vitest'
import { interpretarConexao } from '../../electron/conexao-arquivo'

const certo = { url: 'https://abcdefghijklmnop.supabase.co', chave: 'sb_publishable_XYZ' }

describe('interpretarConexao (conexao.json montado à mão)', () => {
  it('aceita o arquivo certo', () => {
    expect(interpretarConexao(JSON.stringify(certo))).toEqual(certo)
  })
  it('tolera BOM do Bloco de Notas/PowerShell, espaços e barra no fim da URL', () => {
    const bruto = '﻿  {"url": " https://abcdefghijklmnop.supabase.co/ ", "chave": " sb_publishable_XYZ "}\r\n'
    expect(interpretarConexao(bruto)).toEqual(certo)
  })
  it('explica o que está errado', () => {
    expect(interpretarConexao('{url: sem aspas}')).toMatch(/formato/)
    expect(interpretarConexao(JSON.stringify({ ...certo, url: 'abcdefghijklmnop.supabase.co' }))).toMatch(/endereço/)
    expect(interpretarConexao(JSON.stringify({ url: certo.url }))).toMatch(/Falta a chave/)
  })
  it('recusa a chave secreta', () => {
    expect(interpretarConexao(JSON.stringify({ ...certo, chave: 'sb_secret_abc' }))).toMatch(/secreta/)
    const jwtServico = `x.${btoa('{"role":"service_role"}').replace(/=+$/, '')}.y`
    expect(interpretarConexao(JSON.stringify({ ...certo, chave: jwtServico }))).toMatch(/secreta/)
  })
  it('aceita o Supabase local do desenvolvimento', () => {
    expect(interpretarConexao(JSON.stringify({ url: 'http://127.0.0.1:54321', chave: 'k' }))).toEqual({ url: 'http://127.0.0.1:54321', chave: 'k' })
  })
})
