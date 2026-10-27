import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  CATEGORIA_ADICAO_CAIXA,
  CATEGORIA_ESTORNO,
  CATEGORIA_RETIRADA_CAIXA,
  movimentosOperacionaisFinanceiro,
  resumoFinanceiroIntervalo,
  type LinhaFinanceiro,
} from '../mock/base/derivados'
import { planilhaFinanceiro } from './exportar-financeiro'

/** Lê de volta uma aba: valores ({ A1: 'Data', J6: '12.5' }) e fórmulas ({ B13: 'SUM(B10:B12)' }). */
function lerAba(bytes: Uint8Array, numero: number) {
  const arquivos = unzipSync(bytes)
  const textos = [...strFromU8(arquivos['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(''))
  const xml = strFromU8(arquivos[`xl/worksheets/sheet${numero}.xml`])
  const valores: Record<string, string> = {}
  const formulas: Record<string, string> = {}
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(?:<f>([^<]*)<\/f>)?<v>([^<]*)<\/v><\/c>/g)) {
    valores[m[1]] = m[2].includes('t="s"') ? textos[Number(m[4])] : m[4]
    if (m[3]) formulas[m[1]] = m[3]
  }
  return { valores, formulas, xml, arquivos }
}

/** A primeira linha com o rótulo na coluna A; devolve a célula da coluna pedida. */
function aoLadoDe(valores: Record<string, string>, rotulo: string, coluna = 'B') {
  const ref = Object.keys(valores).find((r) => /^A\d+$/.test(r) && valores[r] === rotulo)
  return ref ? valores[`${coluna}${ref.slice(1)}`] : undefined
}

/** Cartão do Resumo: o rótulo numa linha, o valor logo abaixo. */
function abaixoDe(valores: Record<string, string>, rotulo: string) {
  const ref = Object.keys(valores).find((r) => valores[r] === rotulo)
  const [, coluna, linha] = /^([A-Z]+)(\d+)$/.exec(ref ?? '') ?? []
  return ref ? valores[`${coluna}${Number(linha) + 1}`] : undefined
}

const linha = (dados: Partial<LinhaFinanceiro> & Pick<LinhaFinanceiro, 'id' | 'data' | 'valor' | 'categoria'>): LinhaFinanceiro => ({
  horario: '10:00', descricao: dados.id, origem: 'Lançamento manual', meio: 'dinheiro', meioRotulo: 'Dinheiro', ...dados,
})

// Período: 01/09 a 30/09.
const linhas: LinhaFinanceiro[] = [
  linha({ id: '1-0', data: '2026-09-01', horario: '09:00', valor: 10000, categoria: 'Venda', meio: 'pix', meioRotulo: 'Pix manual', ficha: '1', cliente: 'Ana' }),
  linha({ id: '2-0', data: '2026-09-10', valor: 5000, categoria: 'Venda', ficha: '2', cliente: 'Não identificado' }),
  linha({ id: '2-0-estorno', data: '2026-09-11', valor: -5000, categoria: CATEGORIA_ESTORNO, ficha: '2' }),
  linha({ id: 'd1', data: '2026-09-15', valor: -3000, categoria: 'Despesa', meio: 'cartao', meioRotulo: 'Cartão' }),
  linha({ id: 'd1-est', data: '2026-09-16', valor: 3000, categoria: CATEGORIA_ESTORNO, meio: 'cartao', meioRotulo: 'Cartão', estornoDe: 'd1' }),
  linha({ id: 'd2', data: '2026-09-30', horario: '18:00', valor: -1500, categoria: 'Despesa' }),
  // Gaveta: fica de fora, com o estorno.
  linha({ id: 'g1', data: '2026-09-20', valor: 20000, categoria: CATEGORIA_ADICAO_CAIXA }),
  linha({ id: 'g2', data: '2026-09-21', valor: -10000, categoria: CATEGORIA_RETIRADA_CAIXA }),
  linha({ id: 'g2-est', data: '2026-09-22', valor: 10000, categoria: CATEGORIA_ESTORNO, estornoDe: 'g2' }),
  // Fora do período.
  linha({ id: '3-0', data: '2026-08-31', valor: 99900, categoria: 'Venda', ficha: '3' }),
  linha({ id: '4-0', data: '2026-10-01', valor: 88800, categoria: 'Venda', ficha: '4' }),
]

describe('[R-FINANCEIRO-06] planilha do período do Financeiro', () => {
  const { bytes, quantidade, nome } = planilhaFinanceiro(linhas, '2026-09-01', '2026-09-30', '2026-10-07T17:00:00.000Z')
  const resumo = lerAba(bytes, 1)
  const porDia = lerAba(bytes, 2)
  const movimentos = lerAba(bytes, 3)

  it('os cartões do Resumo são os da tela, estornos inclusive', () => {
    const tela = resumoFinanceiroIntervalo(movimentosOperacionaisFinanceiro(linhas), '2026-09-01', '2026-09-30')
    expect(tela).toMatchObject({ entradas: 10000, saidas: 1500, liquido: 8500 })
    expect(abaixoDe(resumo.valores, 'Entradas')).toBe('100')
    expect(abaixoDe(resumo.valores, 'Despesas')).toBe('15')
    expect(abaixoDe(resumo.valores, 'Entradas menos despesas')).toBe('85')
    expect(abaixoDe(resumo.valores, 'Movimentações')).toBe(String(tela.contagem.todos))
  })

  it('por meio e por categoria, cada coluna soma o total, com SOMA de verdade', () => {
    expect(aoLadoDe(resumo.valores, 'Pix')).toBe('100')
    // Venda em dinheiro cancelada: +50 e −50 nas entradas; a despesa de 15 fica.
    expect(aoLadoDe(resumo.valores, 'Dinheiro')).toBe('0')
    expect(aoLadoDe(resumo.valores, 'Dinheiro', 'C')).toBe('15')
    expect(aoLadoDe(resumo.valores, 'Dinheiro', 'D')).toBe('-15')
    // Despesa no cartão estornada: 30 − 30.
    expect(aoLadoDe(resumo.valores, 'Cartão', 'C')).toBe('0')
    expect(aoLadoDe(resumo.valores, 'Estorno')).toBe('-50')
    expect(aoLadoDe(resumo.valores, 'Estorno', 'C')).toBe('-30')
    expect(aoLadoDe(resumo.valores, 'Venda')).toBe('150')
    // O primeiro "Total" é o da tabela por meio: soma das três linhas acima.
    const total = Object.keys(resumo.valores).find((r) => /^A\d+$/.test(r) && resumo.valores[r] === 'Total')!
    const n = Number(total.slice(1))
    expect([resumo.valores[`B${n}`], resumo.valores[`C${n}`], resumo.valores[`D${n}`]]).toEqual(['100', '15', '85'])
    expect(resumo.formulas[`B${n}`]).toBe(`SUM(B${n - 3}:B${n - 1})`)
    expect(resumo.formulas[`D${n - 1}`]).toBe(`B${n - 1}-C${n - 1}`)
  })

  it('por dia: um dia por linha, inclusive os parados, e o total bate', () => {
    const dias = Object.keys(porDia.valores).filter((r) => /^A\d+$/.test(r) && /^\d\d\/09 · /.test(porDia.valores[r]))
    expect(dias).toHaveLength(30)
    expect(porDia.valores[dias[0]]).toBe('01/09 · ter')
    expect(aoLadoDe(porDia.valores, '01/09 · ter')).toBe('100')
    expect(aoLadoDe(porDia.valores, '02/09 · qua')).toBe('0')
    // Dia 11: só o cancelamento da venda do dia 10.
    expect(aoLadoDe(porDia.valores, '11/09 · sex')).toBe('-50')
    expect([aoLadoDe(porDia.valores, 'Total'), aoLadoDe(porDia.valores, 'Total', 'C'), aoLadoDe(porDia.valores, 'Total', 'D')]).toEqual(['100', '15', '85'])
    expect(porDia.xml).toContain('<dataBar>')
  })

  it('período longo vai mês a mês', () => {
    const ano = planilhaFinanceiro(linhas, '2026-01-01', '2026-10-07')
    const { valores } = lerAba(ano.bytes, 2)
    const meses = Object.keys(valores).filter((r) => /^A\d+$/.test(r) && /^\d\d\/2026$/.test(valores[r]))
    expect(meses.map((r) => valores[r])).toEqual(['01/2026', '02/2026', '03/2026', '04/2026', '05/2026', '06/2026', '07/2026', '08/2026', '09/2026', '10/2026'])
    expect(aoLadoDe(valores, '08/2026')).toBe('999')
    expect(strFromU8(unzipSync(ano.bytes)['xl/workbook.xml'])).toContain('name="Por mês"')
  })

  it('leva só o período, do primeiro ao último dia, e deixa a gaveta de fora', () => {
    expect(quantidade).toBe(6)
    const descricoes = Object.entries(movimentos.valores).filter(([r]) => /^C\d+$/.test(r) && Number(r.slice(1)) > 5).map(([, v]) => v)
    expect(descricoes).toEqual(['1-0', '2-0', '2-0-estorno', 'd1', 'd1-est', 'd2'])
    expect(nome).toBe('financeiro-2026-09-01-a-2026-09-30.xlsx')
  })

  it('cada movimento traz tipo, sinal, cliente e se foi estornado; o total respeita o filtro', () => {
    const v = movimentos.valores
    expect(v.A5).toBe('Data')
    expect(v.A6).toBe(String(Date.UTC(2026, 8, 1) / 86_400_000 + 25_569))
    expect([v.E6, v.F6, v.G6, v.H6, v.J6]).toEqual(['Entrada', 'Pix manual', '#1', 'Ana', '100'])
    expect([v.E7, v.L7]).toEqual(['Entrada', 'Estornado'])
    expect([v.E8, v.J8]).toEqual(['Estorno', '-50'])
    expect([v.E9, v.J9, v.L9]).toEqual(['Saída', '-30', 'Estornado'])
    expect(v.L11).toBeUndefined()
    expect([v.J12, movimentos.formulas.J12]).toEqual(['85', 'SUBTOTAL(9,J6:J11)'])
    expect(movimentos.xml).toContain('<autoFilter ref="A5:L11"/>')
  })

  it('é um .xlsx bem montado: três abas, sem texto "inline", impressão e estilos', () => {
    const { arquivos } = resumo
    const livro = strFromU8(arquivos['xl/workbook.xml'])
    expect([...livro.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1])).toEqual(['Resumo', 'Por dia', 'Movimentos'])
    expect(livro).toContain(`<definedName name="_xlnm.Print_Titles" localSheetId="2">'Movimentos'!$5:$5</definedName>`)
    for (const n of [1, 2, 3]) expect(lerAba(bytes, n).xml).not.toContain('inlineStr')
    expect(strFromU8(arquivos['[Content_Types].xml'])).toContain('/xl/worksheets/sheet3.xml')
    const estilos = strFromU8(arquivos['xl/styles.xml'])
    expect(Number(/<cellXfs count="(\d+)"/.exec(estilos)?.[1])).toBe([...estilos.matchAll(/<xf /g)].length - 1)
    expect(estilos).toContain('FF176B4D')
  })

  it('período sem movimento gera o arquivo com totais zerados e sem fórmula circular', () => {
    const vazio = planilhaFinanceiro(linhas, '2026-07-01', '2026-07-31')
    expect(vazio.quantidade).toBe(0)
    expect(abaixoDe(lerAba(vazio.bytes, 1).valores, 'Entradas')).toBe('0')
    const mov = lerAba(vazio.bytes, 3)
    expect(mov.formulas).toEqual({})
    expect(mov.valores.J6).toBe('0')
  })
})
