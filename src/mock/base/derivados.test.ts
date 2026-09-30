import { describe, expect, it } from 'vitest'
import { criarSemente } from './semente'
import {
  buscar,
  distribuir,
  movimentosFinanceiro,
  notificacoes,
  notinha,
  notinhasDoCliente,
  resumoDoCliente,
  resumoDoDia,
  resumoEstoque,
  resumoFinanceiro,
  resumoItens,
} from './derivados'
import type { Ficha } from './tipos'
import { reais } from '../../formatar'

const HOJE = '2026-09-25'
const base = criarSemente(HOJE, 15 * 60)

const fichaNotinha = (total: number, pagos: number[], vencimento: string, id = 'X', data = '2026-09-01'): Ficha => ({
  id, clienteId: 'CLI-0104', data, horario: '10:00', operador: 'João Silva',
  itens: [{ codigo: 'EST-0021', descricao: 'Caderno', quantidade: 1, preco: total }], desconto: 0, total,
  forma: 'notinha', vencimento, pagamentos: pagos.map((valor) => ({ data: '2026-09-02', horario: '10:00', meio: 'pix' as const, valor })),
})

describe('notinha', () => {
  it('calcula aberto, situação e texto do prazo', () => {
    expect(notinha(fichaNotinha(10000, [3000], '2026-10-07'), HOJE)).toMatchObject({ pago: 3000, emAberto: 7000, situacao: 'pendente', detalhe: 'Vence em 12 dias' })
    expect(notinha(fichaNotinha(10000, [], '2026-09-15'), HOJE)).toMatchObject({ situacao: 'vencido', detalhe: 'Venceu há 10 dias' })
    expect(notinha(fichaNotinha(10000, [4000, 6000], '2026-09-15'), HOJE)).toMatchObject({ situacao: 'pago', emAberto: 0, detalhe: 'Quitada em 02/09/2026' })
  })
  it('é nula para venda à vista', () => {
    expect(notinha(base.fichas.find((f) => f.forma === 'pix')!, HOJE)).toBeNull()
  })
})

describe('cliente', () => {
  it('Mariana está com notinha a vencer, visível no resumo', () => {
    const r = resumoDoCliente(base, 'CLI-0104', HOJE)
    expect(r.abertas.some((n) => n.ficha.vencimento === '2026-10-07')).toBe(true)
    expect(r.detalheSituacao).toBe(`${reais(r.emAberto)} em aberto`)
  })
  it('atraso pesa mais que prazo', () => {
    expect(resumoDoCliente(base, 'CLI-0106', HOJE).situacao).toBe('vencido')
  })
  it('Ana Beatriz está em dia e o total bate com as fichas', () => {
    const r = resumoDoCliente(base, 'CLI-0107', HOJE)
    expect(r.situacao).toBe('em-dia')
    expect(r.totalComprado).toBe(r.fichas.reduce((t, f) => t + f.total, 0))
  })
  it('a lista de notinhas do cliente é a mesma que o resumo usa', () => {
    const abertas = notinhasDoCliente(base, 'CLI-0117', HOJE).filter((n) => n.emAberto > 0)
    expect(resumoDoCliente(base, 'CLI-0117', HOJE).abertas.map((n) => n.ficha.id).sort()).toEqual(abertas.map((n) => n.ficha.id).sort())
  })
})

describe('distribuir', () => {
  it('abate da mais antiga para a mais nova', () => {
    const antiga = notinha(fichaNotinha(14500, [], '2026-09-10', 'A', '2026-08-01'), HOJE)!
    const nova = notinha(fichaNotinha(10220, [], '2026-10-20', 'B', '2026-09-20'), HOJE)!
    expect(distribuir([nova, antiga], 20000)).toEqual([
      { id: 'A', valor: 14500, quita: true },
      { id: 'B', valor: 5500, quita: false },
    ])
  })
})

describe('itens', () => {
  it('resume os itens com quantidade', () => {
    expect(resumoItens(fichaNotinha(2490, [], HOJE))).toBe('Caderno (1x)')
  })
})

describe('financeiro', () => {
  const linhas = movimentosFinanceiro(base)
  it('tem uma entrada por pagamento, nenhuma a mais', () => {
    const pagamentos = base.fichas.flatMap((f) => f.pagamentos)
    expect(linhas.filter((l) => l.ficha).length).toBe(pagamentos.length)
    expect(linhas.filter((l) => l.ficha).reduce((t, l) => t + l.valor, 0)).toBe(pagamentos.reduce((t, p) => t + p.valor, 0))
  })
  it('notinha sem pagamento não entra no caixa', () => {
    const semPagamento = base.fichas.find((f) => f.forma === 'notinha' && f.pagamentos.length === 0)!
    expect(linhas.some((l) => l.ficha === semPagamento.id)).toBe(false)
  })
  it('resume o dia com entradas, saídas e contagem por meio', () => {
    const r = resumoFinanceiro(linhas, 'dia', HOJE)
    const doDia = linhas.filter((l) => l.data === HOJE)
    expect(r.entradas).toBe(doDia.filter((l) => l.valor > 0).reduce((t, l) => t + l.valor, 0))
    expect(r.contagem.todos).toBe(doDia.length)
    expect(r.liquido).toBe(r.entradas - r.saidas)
  })
})

describe('início', () => {
  it('conta as vendas e os recebimentos de hoje', () => {
    const r = resumoDoDia(base, HOJE)
    expect(r.vendas).toBe(base.fichas.filter((f) => f.data === HOJE).length)
    expect(r.recebimentos).toBe(base.fichas.flatMap((f) => f.pagamentos).filter((p) => p.data === HOJE).reduce((t, p) => t + p.valor, 0)
      + base.movimentosCaixa.filter((m) => m.data === HOJE && m.valor > 0).reduce((t, m) => t + m.valor, 0))
  })
})

describe('estoque, busca e sino', () => {
  it('conta o estoque pela lista real', () => {
    expect(resumoEstoque(base)).toMatchObject({ produtos: 16, baixo: 5, semCodigo: 2 })
  })
  it('acha cliente, ficha e produto', () => {
    const r = buscar(base, 'mariana')
    expect(r.clientes.map((c) => c.id)).toContain('CLI-0104')
    expect(r.fichas.length).toBeGreaterThan(0)
    expect(r.fichas.every((f) => f.clienteId === 'CLI-0104')).toBe(true)
    expect(buscar(base, '789102711').produtos[0].codigo).toBe('EST-0021')
  })
  it('avisa notinhas em atraso, estoque e rascunhos, do mais grave para o menos grave', () => {
    const avisos = notificacoes(base, HOJE)
    const texto = avisos.map((n) => `${n.titulo} ${n.detalhe}`).join(' | ')
    expect(texto).toMatch(/Associação Girassol/)
    expect(texto).toMatch(/Carlos Eduardo Santos/)
    expect(avisos.find((n) => n.tipo === 'estoque-zerado')?.titulo).toBe('1 produto zerado')
    expect(avisos.find((n) => n.tipo === 'estoque-baixo')?.titulo).toBe('4 produtos com estoque baixo')
    expect(avisos.find((n) => n.tipo === 'rascunho')?.titulo).toBe('2 rascunhos de nota em revisão')
    const peso = { critico: 0, atencao: 1, neutro: 2 }
    const pesos = avisos.map((n) => peso[n.tom])
    expect([...pesos].sort((a, b) => a - b)).toEqual(pesos)
  })
  it('avisa notinha que vence em até 3 dias', () => {
    const hojeMais = '2026-10-05' // a notinha da Mariana vence em 07/10
    const avisos = notificacoes(base, hojeMais).filter((n) => n.tipo === 'vencendo')
    expect(avisos.some((n) => n.titulo === 'Mariana Costa' && /vence em 2 dias/.test(n.detalhe))).toBe(true)
  })
})
