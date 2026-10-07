import { describe, expect, it } from 'vitest'
import { conferirComprovante, dinheiro, LARGURA, linhasComprovante, quebrar, textoComprovante, type Loja } from '../../comum/comprovante'
import type { DadosComprovante } from '../../comum/contrato'
import { interpretarConfigComprovante } from '../../electron/comprovante-arquivo'
import { bytesComprovante, codificarCp850 } from '../../electron/escpos'

const loja: Loja = { nome: 'Papelaria Opção', endereco: 'Rua Exemplo, 123 - Centro - Cidade/UF', telefone: '(00) 0000-0000', cnpj: '00.000.000/0001-00' }

const venda = (mudar: Partial<DadosComprovante> = {}): DadosComprovante => ({
  numero: '1043',
  dataHora: '2026-10-07T19:08:00.000Z',
  operador: 'Loja',
  itens: [
    { descricao: 'Caderno universitário 10 matérias', quantidade: 2, preco: 2590 },
    { descricao: 'Caneta esferográfica azul', quantidade: 3, preco: 250 },
  ],
  desconto: 0,
  total: 5930,
  pagamentos: [{ rotulo: 'Dinheiro', valor: 6000 }],
  troco: 70,
  demonstracao: false,
  segundaVia: false,
  ...mudar,
})

const papel = (d: DadosComprovante) => textoComprovante(linhasComprovante(d, loja, 'America/Sao_Paulo'))

describe('conferirComprovante', () => {
  it('aceita uma venda certa', () => {
    expect(conferirComprovante(venda())).toMatchObject({ numero: '1043', total: 5930 })
  })

  it('recusa quando itens menos desconto não batem com o total', () => {
    expect(conferirComprovante(venda({ total: 5900 }))).toMatch(/não bate com o total/)
  })

  it('confere o desconto na conta', () => {
    expect(typeof conferirComprovante(venda({ desconto: 430, total: 5500, troco: 500 }))).toBe('object')
  })

  it('recusa quando pagamentos menos troco não batem com o total', () => {
    expect(conferirComprovante(venda({ troco: 0 }))).toMatch(/pagamentos/)
  })

  it('recusa dinheiro que não é inteiro em centavos', () => {
    expect(typeof conferirComprovante(venda({ desconto: 1.5 }))).toBe('string')
    expect(typeof conferirComprovante({ ...venda(), itens: [{ descricao: 'x', quantidade: 1, preco: '10' }] })).toBe('string')
  })

  it('recusa venda sem itens, sem número ou com data inválida', () => {
    expect(typeof conferirComprovante(venda({ itens: [] }))).toBe('string')
    expect(typeof conferirComprovante(venda({ numero: ' ' }))).toBe('string')
    expect(typeof conferirComprovante(venda({ dataHora: 'ontem' }))).toBe('string')
    expect(typeof conferirComprovante(null)).toBe('string')
  })

  it('tira caractere de controle do texto (viraria comando da impressora)', () => {
    const r = conferirComprovante(venda({ itens: [{ descricao: 'Lápis\x1b\x69 preto', quantidade: 1, preco: 5930 }] }))
    expect(typeof r === 'object' && r.itens[0].descricao).toBe('Lápis i preto')
  })
})

describe('desenho do comprovante', () => {
  it('nenhuma linha passa de 48 colunas', () => {
    const longo = venda({
      cliente: 'Maria da Silva Pereira de Albuquerque Cavalcanti Rodrigues',
      itens: [{ descricao: 'Papel sulfite A4 75g/m² resma com 500 folhas marca boa qualidade premium', quantidade: 1, preco: 5930 }],
      pagamentos: [{ rotulo: 'Cartão crédito Mastercard · Mercado Pago com nome comprido', valor: 5930 }],
      troco: 0,
    })
    for (const linha of papel(longo).split('\n')) expect(linha.length).toBeLessThanOrEqual(LARGURA)
  })

  it('tem cabeçalho completo e o aviso fiscal no topo e no fim', () => {
    const t = papel(venda())
    expect(t).toContain('PAPELARIA OPÇÃO')
    expect(t).toContain('Tel: (00) 0000-0000')
    expect(t).toContain('CNPJ: 00.000.000/0001-00')
    expect(t.match(/NÃO É DOCUMENTO FISCAL/g)).toHaveLength(2)
  })

  it('mostra data no fuso da loja, itens, total, pagamento e troco', () => {
    const t = papel(venda())
    expect(t).toContain('07/10/2026 16:08')
    expect(t).toMatch(/2 x 25,90 +51,80/)
    expect(t).toMatch(/TOTAL R\$ +59,30/)
    expect(t).toMatch(/Troco +0,70/)
  })

  it('mostra subtotal e desconto só quando há desconto', () => {
    expect(papel(venda())).not.toContain('Desconto')
    expect(papel(venda({ desconto: 430, total: 5500, troco: 500 }))).toMatch(/Subtotal +59,30\nDesconto +-4,30/)
  })

  it('marca simulação e segunda via', () => {
    expect(papel(venda())).not.toMatch(/SIMULAÇÃO|2ª VIA/)
    expect(papel(venda({ demonstracao: true, segundaVia: true }))).toMatch(/SIMULAÇÃO[\s\S]*2ª VIA/)
  })

  it('formata dinheiro com milhar', () => {
    expect(dinheiro(123456)).toBe('1.234,56')
    expect(dinheiro(5)).toBe('0,05')
    expect(dinheiro(-430)).toBe('-4,30')
  })

  it('quebra palavra maior que a linha', () => {
    expect(quebrar('a'.repeat(50), 48)).toEqual(['a'.repeat(48), 'aa'])
  })
})

describe('ESC/POS', () => {
  it('acentos em CP850 (provados no papel)', () => {
    expect(codificarCp850('ção ÇÃO')).toEqual([0x87, 0xc6, 0x6f, 0x20, 0x80, 0xc7, 0x4f])
    expect(codificarCp850('áéíóú âêô õ R$')).toEqual([0xa0, 0x82, 0xa1, 0xa2, 0xa3, 0x20, 0x83, 0x88, 0x93, 0x20, 0xe4, 0x20, 0x52, 0x24])
  })

  it('caractere sem equivalente vira a letra sem acento ou "?"', () => {
    expect(codificarCp850('ŝ€')).toEqual([0x73, 0x3f])
  })

  it('nenhum byte de controle sai do texto', () => {
    expect(codificarCp850('a\x1b\x1d\nb').every((b) => b >= 0x20)).toBe(true)
  })

  it('começa reiniciando com CP850 e termina cortando', () => {
    const b = Array.from(bytesComprovante(linhasComprovante(venda(), loja)))
    expect(b.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x02])
    expect(b.slice(-7)).toEqual([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00])
  })

  it('negrito liga e desliga em volta da linha, e o recuo do centro se mantém', () => {
    const b = Array.from(bytesComprovante([{ texto: '  AB', negrito: true }]))
    expect(b.slice(5, -7)).toEqual([0x1b, 0x45, 1, 0x20, 0x20, 0x41, 0x42, 0x0a, 0x1b, 0x45, 0])
  })
})

describe('interpretarConfigComprovante', () => {
  const certo = { impressora: 'POS-80', loja }

  it('aceita o arquivo certo, com BOM do Windows', () => {
    expect(interpretarConfigComprovante('﻿' + JSON.stringify(certo))).toEqual(certo)
  })

  it('exige os quatro dados da loja', () => {
    expect(interpretarConfigComprovante(JSON.stringify({ ...certo, loja: { ...loja, cnpj: '' } }))).toMatch(/cnpj/)
  })

  it('recusa nome de impressora que viraria truque de comando', () => {
    expect(typeof interpretarConfigComprovante(JSON.stringify({ ...certo, impressora: 'POS-80 -o x' }))).toBe('string')
    expect(typeof interpretarConfigComprovante(JSON.stringify({ ...certo, impressora: '-dX' }))).toBe('string')
  })

  it('recusa JSON quebrado', () => {
    expect(interpretarConfigComprovante('{ impressora')).toMatch(/formato/)
  })
})
