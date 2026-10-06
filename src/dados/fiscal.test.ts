import { describe, expect, it } from 'vitest'
import { conferirCep, conferirFiscalProduto, FISCAL_PRODUTO_PADRAO, gtinValido, limparFiscalCliente, limparFiscalProduto } from './fiscal'

describe('gtinValido', () => {
  it('aceita os códigos do XML que a Emitte validou', () => {
    expect(gtinValido('7890000000017')).toBe(true)
    expect(gtinValido('7890000000024')).toBe(true)
  })

  it('aceita EAN-8 e GTIN-14 com dígito certo', () => {
    expect(gtinValido('96385074')).toBe(true)
    expect(gtinValido('17890000000014')).toBe(true)
  })

  it('recusa dígito verificador errado, tamanho fora do padrão e letras', () => {
    expect(gtinValido('7890000000018')).toBe(false)
    expect(gtinValido('789102711')).toBe(false)
    expect(gtinValido('SEM GTIN')).toBe(false)
  })
})

describe('dados fiscais do produto', () => {
  it('o padrão já passa na conferência', () => {
    expect(conferirFiscalProduto(FISCAL_PRODUTO_PADRAO)).toEqual({})
  })

  it('aceita NCM e CEST digitados com pontuação', () => {
    const fiscal = limparFiscalProduto({ tributacao: 'substituicao', origem: '0', cfopEstadual: '5405', cfopInterestadual: '6404', ncm: '4820.20.00', cest: '19.024.00' })
    expect(fiscal).toMatchObject({ ncm: '48202000', cest: '1902400' })
    expect(conferirFiscalProduto(fiscal)).toEqual({})
  })

  it('aponta NCM curto, CEST sem ST e CFOP trocado', () => {
    const fiscal = limparFiscalProduto({ tributacao: 'simples', origem: '0', cfopEstadual: '6102', cfopInterestadual: '5102', ncm: '4820', cest: '1902400' })
    expect(Object.keys(conferirFiscalProduto(fiscal)).sort()).toEqual(['cest', 'cfopEstadual', 'cfopInterestadual', 'ncm'])
  })
})

describe('dados fiscais do cliente', () => {
  it('guarda só números no CEP e na inscrição, e vazio vira ausente', () => {
    expect(limparFiscalCliente({ tipoContribuinte: 'contribuinte', tipoCliente: 'revenda', inscricaoEstadual: '111.111.111.111', cep: '01001-000', complemento: ' ' }))
      .toEqual({ tipoContribuinte: 'contribuinte', tipoCliente: 'revenda', inscricaoEstadual: '111111111111', cep: '01001000', complemento: undefined })
  })

  it('confere o CEP só quando informado', () => {
    expect(conferirCep(undefined)).toBeUndefined()
    expect(conferirCep('0100100')).toBe('O CEP tem 8 números.')
  })
})
