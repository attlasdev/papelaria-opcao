import { describe, expect, it } from 'vitest'
import { criarSemente } from './semente'

const HOJE = '2026-09-25'
const base = criarSemente(HOJE, 15 * 60)

describe('semente', () => {
  it('é determinística para a mesma data', () => {
    expect(JSON.stringify(criarSemente(HOJE, 15 * 60))).toBe(JSON.stringify(base))
  })

  it('tem ids únicos de ficha, em ordem de data e horário', () => {
    const ids = base.fichas.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    const ordem = base.fichas.map((f) => `${f.data} ${f.horario}`)
    expect([...ordem].sort()).toEqual(ordem)
  })

  it('não tem nada no futuro', () => {
    for (const f of base.fichas) {
      expect(f.data <= HOJE).toBe(true)
      if (f.data === HOJE) expect(f.horario <= '15:00').toBe(true)
      for (const p of f.pagamentos) expect(p.data <= HOJE).toBe(true)
    }
    for (const m of base.movimentosCaixa) expect(m.data <= HOJE).toBe(true)
  })

  it('fecha a conta de cada ficha', () => {
    for (const f of base.fichas) {
      const soma = f.itens.reduce((t, i) => t + i.preco * i.quantidade, 0)
      expect(f.total).toBe(soma - f.desconto)
      const pago = f.pagamentos.reduce((t, p) => t + p.valor, 0)
      if (f.forma === 'notinha') {
        expect(f.clienteId).not.toBeNull()
        expect(f.vencimento).toBeDefined()
        expect(pago).toBeLessThanOrEqual(f.total)
      } else {
        expect(pago).toBe(f.total)
        expect(f.pagamentos).toHaveLength(1)
        expect(f.pagamentos[0].meio).toBe(f.forma)
      }
    }
  })

  it('só referencia clientes e produtos que existem', () => {
    const clientes = new Set(base.clientes.map((c) => c.id))
    const produtos = new Set(base.produtos.map((p) => p.codigo))
    for (const f of base.fichas) {
      if (f.clienteId) expect(clientes.has(f.clienteId)).toBe(true)
      for (const i of f.itens) expect(produtos.has(i.codigo)).toBe(true)
    }
    for (const id of base.rascunhosNota) expect(base.fichas.some((f) => f.id === id)).toBe(true)
  })

  it('bate o saldo de cada produto com os movimentos do estoque', () => {
    for (const p of base.produtos) {
      // A lista vem da mais nova para a mais antiga.
      const movs = base.movimentosEstoque.filter((m) => m.produto === p.codigo).reverse()
      for (let i = 1; i < movs.length; i++) expect(movs[i].antes).toBe(movs[i - 1].depois)
      if (movs.length) expect(movs[movs.length - 1].depois).toBe(p.saldo)
      for (const m of movs) expect(m.antes).toBeGreaterThanOrEqual(0)
    }
  })

  it('garante os cenários de notinha', () => {
    const aberta = (cliente: string) =>
      base.fichas.filter((f) => f.clienteId === cliente && f.forma === 'notinha'
        && f.pagamentos.reduce((t, p) => t + p.valor, 0) < f.total)
    const mariana = aberta('CLI-0104')
    expect(mariana.some((f) => f.vencimento === '2026-10-07' && f.pagamentos[0]?.entrada && f.pagamentos[0].valor === 5000)).toBe(true)
    expect(aberta('CLI-0106').some((f) => f.vencimento === '2026-09-15')).toBe(true)
    expect(aberta('CLI-0117').filter((f) => (f.vencimento ?? '') < HOJE).length).toBeGreaterThanOrEqual(2)
    expect(base.fichas.some((f) => f.clienteId === 'CLI-0107' && f.forma === 'notinha')).toBe(false)
  })

  it('tem movimento hoje para o Início e o Financeiro', () => {
    expect(base.fichas.filter((f) => f.data === HOJE).length).toBeGreaterThanOrEqual(4)
    expect(base.fichas.some((f) => f.clienteId === null)).toBe(true)
  })
})
