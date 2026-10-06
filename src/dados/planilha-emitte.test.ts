import { strFromU8, unzipSync } from 'fflate'
import urlClientes from '../../recursos/emitte/modelo-clientes.xlsx?inline'
import urlProdutos from '../../recursos/emitte/modelo-produtos.xlsx?inline'
import { describe, expect, it } from 'vitest'
import type { Cliente, Produto } from '../mock/base/tipos'
import { cidadesDoModelo, cidadeEmitte, gerarPlanilhaClientes, gerarPlanilhaProdutos, separarCidade, separarLogradouro } from './emitte'

// Os mesmos modelos que o app embute (recursos/emitte/), lidos do mesmo jeito.
const bytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0))
const modeloClientes = bytes(urlClientes)
const modeloProdutos = bytes(urlProdutos)
const cidades = cidadesDoModelo(modeloClientes)

/** Lê de volta as células da aba de dados: { A6: 'N', … }. */
function celulas(bytes: Uint8Array) {
  const arquivos = unzipSync(bytes)
  const textos = [...strFromU8(arquivos['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(''))
  const aba = strFromU8(arquivos['xl/worksheets/sheet1.xml'])
  const valores: Record<string, string> = {}
  for (const m of aba.matchAll(/<c r="([A-Z]+\d+)"([^>]*)><v>([^<]*)<\/v><\/c>/g)) {
    valores[m[1]] = m[2].includes('t="s"') ? textos[Number(m[3])] : m[3]
  }
  return { valores, aba, arquivos }
}

const cliente = (dados: Partial<Cliente>): Cliente => ({
  id: 'CLI-0001', nome: 'Papelaria Teste Ltda', documento: '44.555.666/0001-81', telefone: '(11) 99999-0000',
  endereco: 'Av. Paulista, 1000 - Bela Vista - São Paulo/SP', descricao: 'Cadastro novo', desde: '2026-10-06',
  fiscal: { tipoContribuinte: 'contribuinte', tipoCliente: 'revenda', inscricaoEstadual: '111.111.111.111', cep: '01310-100', complemento: 'Sala 3' },
  ...dados,
})

describe('auxiliares de endereço', () => {
  it('cidade no formato da Emitte e na lista do modelo', () => {
    expect(cidadeEmitte('São  Paulo')).toBe('SAO PAULO')
    expect(cidades.has('SAO PAULO|SP')).toBe(true)
    expect(cidades.size).toBeGreaterThan(5000)
  })
  it('tipo de logradouro pela primeira palavra, inclusive abreviada', () => {
    expect(separarLogradouro('Av. Paulista')).toEqual({ tipo: 'Avenida', logradouro: 'Paulista' })
    expect(separarLogradouro('Rua das Flores')).toEqual({ tipo: 'Rua', logradouro: 'das Flores' })
    expect(separarLogradouro('Alameda Santos')).toEqual({ tipo: '', logradouro: 'Alameda Santos' })
  })
  it('cidade e UF com barra ou traço', () => {
    expect(separarCidade('São Paulo/SP')).toEqual({ cidade: 'São Paulo', uf: 'SP' })
    expect(separarCidade('Campinas - sp')).toEqual({ cidade: 'Campinas', uf: 'SP' })
  })
})

describe('gerarPlanilhaClientes', () => {
  it('cliente completo vira a linha 6, só com números onde a Emitte pede', () => {
    const r = gerarPlanilhaClientes([cliente({})], modeloClientes, cidades)
    expect(r).toMatchObject({ incluidos: 1, deFora: [] })
    const { valores } = celulas(r.bytes)
    expect(valores).toMatchObject({
      A6: 'C', B6: 'R', C6: '44555666000181', D6: '111111111111', F6: 'Papelaria Teste Ltda', H6: '11999990000',
      K6: '01310100', L6: 'Avenida', M6: 'Paulista', N6: '1000', O6: 'Sala 3', P6: 'Bela Vista', Q6: 'SAO PAULO', R6: 'SP',
    })
    expect(valores.S6).toBeUndefined()
  })

  it('incompleto fica de fora com o que falta; cidade fora da lista também', () => {
    const r = gerarPlanilhaClientes([
      cliente({ nome: 'Sem nada', documento: 'Sem documento', endereco: '', fiscal: undefined }),
      cliente({ nome: 'Cidade errada', endereco: 'Rua A, 1 - Centro - Sao Paolo/SP' }),
      cliente({ nome: 'Ok' }),
    ], modeloClientes, cidades)
    expect(r.incluidos).toBe(1)
    expect(r.deFora[0]).toEqual({ nome: 'Sem nada', falta: ['CPF ou CNPJ', 'CEP', 'rua', 'bairro', 'cidade/UF'] })
    expect(r.deFora[1].falta[0]).toMatch(/não está na lista/)
  })

  it('arquivo no formato que a Emitte aceita: textos compartilhados, tabela ajustada, resto intacto', () => {
    const { aba, arquivos } = celulas(gerarPlanilhaClientes([cliente({}), cliente({ nome: 'Outra' })], modeloClientes, cidades).bytes)
    expect(aba).not.toContain('inlineStr')
    expect(aba).toContain('<dimension ref="A1:T7"/>')
    expect(strFromU8(arquivos['xl/tables/table1.xml'])).toContain('ref="A5:S7"')
    expect(Object.keys(arquivos)).toEqual(Object.keys(unzipSync(modeloClientes)))
    expect(strFromU8(arquivos['xl/worksheets/sheet2.xml'])).toBe(strFromU8(unzipSync(modeloClientes)['xl/worksheets/sheet2.xml']))
  })
})

describe('gerarPlanilhaProdutos', () => {
  const produto = (dados: Partial<Produto>): Produto => ({
    codigo: 'EST-0001', codigoBarras: '7890000000017', descricao: 'Caderno 10 matérias', categoria: 'Cadernos', grupo: 'cadernos',
    unidade: 'pct', preco: 2490, saldo: 1, minimo: 0, ...dados,
  })

  it('uma linha por produto ativo, preço como número, CFOP de revenda, NCM em branco', () => {
    const r = gerarPlanilhaProdutos([produto({}), produto({ codigo: 'EST-0002', codigoBarras: '123' }), produto({ codigo: 'EST-0003', inativo: true })], modeloProdutos)
    expect(r).toMatchObject({ quantidade: 2, semGtin: ['EST-0002'] })
    const { valores } = celulas(r.bytes)
    expect(valores).toMatchObject({ A6: '7890000000017', B6: 'EST-0001', C6: 'Caderno 10 matérias', D6: 'PCT', E6: '24.9', F6: '0', L6: '5102', M6: '6102', A7: 'SEM GTIN' })
    expect(valores.G6).toBeUndefined()
    expect(valores.A8).toBeUndefined()
  })
})
