import { describe, expect, it } from 'vitest'
import type { Produto } from '../mock/base/tipos'
import { gerarXmlProdutos } from './emitte'

const produto = (dados: Partial<Produto>): Produto => ({
  codigo: 'EST-0001', descricao: 'Caderno', categoria: 'Cadernos', grupo: 'cadernos', unidade: 'un', preco: 2490, saldo: 1, minimo: 0, ...dados,
})

describe('gerarXmlProdutos', () => {
  const agora = new Date('2026-10-06T17:30:00Z')

  it('um item por produto ativo, com o total somado', () => {
    const { xml, quantidade } = gerarXmlProdutos([
      produto({ codigoBarras: '7890000000017' }),
      produto({ codigo: 'EST-0002', unidade: 'pct', preco: 1250 }),
      produto({ codigo: 'EST-0003', inativo: true }),
    ], agora)
    expect(quantidade).toBe(2)
    expect(xml.match(/<det nItem=/g)).toHaveLength(2)
    expect(xml).toContain('<vProd>37.40</vProd>')
    expect(xml).toContain('<vNF>37.40</vNF>')
    expect(xml).toContain('<uCom>PCT</uCom>')
    expect(xml).toContain('<vUnCom>24.9000000000</vUnCom>')
    expect(xml).toContain('<dhEmi>2026-10-06T14:30:00-03:00</dhEmi>')
  })

  it('código de barras inválido ou ausente vai como SEM GTIN, e é avisado', () => {
    const { xml, semGtin } = gerarXmlProdutos([
      produto({ codigo: 'EST-0001', codigoBarras: '7890000000017' }),
      produto({ codigo: 'EST-0002', codigoBarras: '789102711' }),
      produto({ codigo: 'EST-0003' }),
    ], agora)
    expect(semGtin).toEqual(['EST-0002', 'EST-0003'])
    expect(xml).toContain('<cEAN>7890000000017</cEAN>')
    expect(xml.match(/<cEAN>SEM GTIN<\/cEAN>/g)).toHaveLength(2)
  })

  it('NCM em branco: a dona completa na Emitte', () => {
    expect(gerarXmlProdutos([produto({})], agora).xml).toContain('<NCM></NCM>')
  })

  it('escapa caracteres que quebrariam o XML e corta o nome em 120', () => {
    const { xml } = gerarXmlProdutos([produto({ descricao: `Cola & Tesoura <kit> ${'x'.repeat(200)}` })], agora)
    expect(xml).toContain('Cola &amp; Tesoura &lt;kit&gt;')
    const nome = xml.match(/<xProd>(.*?)<\/xProd>/)![1]
    expect(nome.replace(/&amp;|&lt;|&gt;/g, '_').length).toBe(120)
  })
})
