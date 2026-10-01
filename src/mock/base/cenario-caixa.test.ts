import { describe, expect, it } from 'vitest'
import { comFechamentosExemplo } from './cenario-caixa'
import { criarSemente } from './semente'
import { fechamentosCaixaNoPeriodo, movimentosFinanceiro, resumoFinanceiro, resumoTurnoCaixa } from './derivados'

describe('exemplos de fechamento', () => {
  it('acrescenta contagens coerentes sem substituir o caixa aberto nem alterar receitas/despesas', () => {
    const base = criarSemente('2026-10-01', 12 * 60)
    const aberto = { id: 'caixa-atual', abertoEm: '2026-09-30T18:11:00Z', operadorAbertura: base.operador, fundoInicial: 1000 }
    base.turnosCaixa = [aberto]
    const antes = resumoFinanceiro(movimentosFinanceiro(base), 'mes', '2026-09-30')
    const exemplo = comFechamentosExemplo(base, '2026-10-01')
    expect(exemplo.turnosCaixa?.[0]).toBe(aberto)
    expect(exemplo.turnosCaixa).toHaveLength(5)
    expect(fechamentosCaixaNoPeriodo(exemplo, '2026-09-25', '2026-10-01')).toHaveLength(3)
    const fechados = exemplo.turnosCaixa!.filter((turno) => turno.fechadoEm)
    expect(fechados.map((turno) => resumoTurnoCaixa(exemplo, turno).diferenca)).toEqual([0, -1000, 0, 0])
    for (const turno of fechados) {
      const resumo = resumoTurnoCaixa(exemplo, turno)
      expect(resumo.esperado).toBe(turno.fundoInicial + resumo.entradas - resumo.saidas)
    }
    expect(resumoFinanceiro(movimentosFinanceiro(exemplo), 'mes', '2026-09-30')).toMatchObject({ entradas: antes.entradas, saidas: antes.saidas, liquido: antes.liquido })
    expect(comFechamentosExemplo(exemplo, '2026-10-01')).toBe(exemplo)
    expect(base.movimentosCaixa).toHaveLength(exemplo.movimentosCaixa.length - 8)
  })
})
