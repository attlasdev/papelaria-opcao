import { describe, expect, it } from 'vitest'
import { funcoes } from '../../funcoes'
import { criarSemente } from './semente'
import {
  buscar,
  clienteCorrespondeBusca,
  textoDiferencaCaixa,
  fechamentosCaixaNoPeriodo,
  turnosCaixaNoPeriodo,
  distribuir,
  movimentosFinanceiro,
  movimentosFisicosCaixa,
  movimentosOperacionaisFinanceiro,
  linhasFinanceiroNoIntervalo,
  notificacoes,
  notinha,
  notinhasDoCliente,
  resumoDoCliente,
  resumoDoDia,
  resumoEstoque,
  resumoFinanceiro,
  resumoFinanceiroIntervalo,
  resumoItens,
  type LinhaFinanceiro,
} from './derivados'
import { intervaloAtual } from './datas'
import type { Ficha, TurnoCaixa } from './tipos'
import { reais } from '../../formatar'

const HOJE = '2026-09-25'
const base = criarSemente(HOJE, 15 * 60)

const fichaNotinha = (total: number, pagos: number[], vencimento: string, id = 'X', data = '2026-09-01'): Ficha => ({
  id, clienteId: 'CLI-0104', data, horario: '10:00', operador: 'João Silva',
  itens: [{ codigo: 'EST-0021', descricao: 'Caderno', quantidade: 1, preco: total }], desconto: 0, total,
  forma: 'notinha', vencimento, pagamentos: pagos.map((valor) => ({ data: '2026-09-02', horario: '10:00', meio: 'pix' as const, valor })),
})

describe('consulta de fechamentos', () => {
  it('filtra sete dias inclusivos pelo fechamento em São Paulo, não pela abertura', () => {
    const turno = (id: string, abertoEm: string, fechadoEm?: string): TurnoCaixa => ({ id, abertoEm, fechadoEm, operadorAbertura: 'Operador', fundoInicial: 1000, contadoFechamento: fechadoEm ? 1000 : undefined, esperadoFechamento: fechadoEm ? 1000 : undefined })
    const amostra = { ...base, turnosCaixa: [
      turno('aberto', '2026-10-01T10:00:00Z'),
      turno('virou-dia', '2026-09-20T10:00:00Z', '2026-10-02T02:59:59Z'),
      turno('fora-futuro', '2026-10-01T10:00:00Z', '2026-10-02T03:00:00Z'),
      turno('limite', '2026-09-24T10:00:00Z', '2026-09-25T03:00:00Z'),
      turno('fora-passado', '2026-09-24T10:00:00Z', '2026-09-25T02:59:59Z'),
    ] }
    expect(fechamentosCaixaNoPeriodo(amostra, '2026-09-25', '2026-10-01').map((t) => t.id)).toEqual(['virou-dia', 'limite'])
    expect(fechamentosCaixaNoPeriodo(amostra, '2026-10-01', '2026-10-01').map((t) => t.id)).toEqual(['virou-dia'])
    expect(turnosCaixaNoPeriodo(amostra, '2026-10-01', '2026-10-01').map((t) => t.id)).toEqual(['virou-dia', 'aberto'])
    expect(fechamentosCaixaNoPeriodo(amostra, '2026-09-01', '2026-09-30').map((t) => t.id)).toEqual(['limite', 'fora-passado'])
    expect(turnosCaixaNoPeriodo(amostra, '2026-10-02', '2026-10-01')).toEqual([])
    expect(turnosCaixaNoPeriodo(amostra, '', '2026-10-01')).toEqual([])
    expect(turnosCaixaNoPeriodo(amostra, '2026-02-30', '2026-10-01')).toEqual([])
  })
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
  it('encontra documento e telefone com ou sem pontuação', () => {
    const cliente = { ...base.clientes[0], documento: 'CPF 123.456.789-00', telefone: '(11) 98452-1100' }
    for (const termo of ['12345678900', '123.456.789-00', 'CPF 12345678900', '11984521100', '(11) 98452-1100', '984521100', '98452 1100']) {
      expect(clienteCorrespondeBusca(cliente, termo), termo).toBe(true)
      expect(buscar({ ...base, clientes: [cliente] }, termo).clientes).toEqual([cliente])
    }
    expect(clienteCorrespondeBusca({ ...cliente, documento: '12345678900', telefone: '11984521100' }, '(11) 98452-1100')).toBe(true)
    expect(clienteCorrespondeBusca({ ...cliente, documento: '12345678900' }, '123.456.789-00')).toBe(true)
  })
  it('preserva nomes/códigos e não junta números de campos diferentes', () => {
    const cliente = { ...base.clientes[0], nome: 'João da Conceição', documento: '123.456', telefone: '789-000' }
    expect(clienteCorrespondeBusca(cliente, 'joao da conceicao')).toBe(true)
    expect(clienteCorrespondeBusca(cliente, cliente.id.toLowerCase())).toBe(true)
    expect(clienteCorrespondeBusca(cliente, '   ')).toBe(true)
    expect(clienteCorrespondeBusca(cliente, '456789')).toBe(false)
    expect(clienteCorrespondeBusca(cliente, 'outro nome 123')).toBe(false)
    expect(clienteCorrespondeBusca(cliente, '()---')).toBe(false)
  })
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
  it('consulta dias antigos e intervalos inclusivos, com cartões e lista no mesmo recorte', () => {
    const movimento = (id: string, data: string, valor: number, categoria: string, meio: 'pix' | 'dinheiro'): LinhaFinanceiro => ({
      id, data, horario: '10:00', descricao: id, origem: 'Teste', categoria, meio, meioRotulo: meio, valor,
    })
    const registros = [
      movimento('anterior', '2026-08-31', 900, 'Venda', 'pix'),
      movimento('venda', '2026-09-10', 10000, 'Venda', 'pix'),
      movimento('despesa', '2026-09-10', -3000, 'Despesa', 'dinheiro'),
      movimento('retirada', '2026-09-10', -2000, 'Retirada de caixa', 'dinheiro'),
      movimento('seguinte', '2026-09-11', 5000, 'Venda', 'dinheiro'),
    ]
    expect(linhasFinanceiroNoIntervalo(movimentosOperacionaisFinanceiro(registros), '2026-09-10', '2026-09-10').map((l) => l.id)).toEqual(['venda', 'despesa'])
    expect(resumoFinanceiroIntervalo(registros, '2026-09-10', '2026-09-10')).toMatchObject({
      entradas: 10000, saidas: 3000, retiradas: 2000, liquido: 7000, contagem: { todos: 2, pix: 1, dinheiro: 1 },
    })
    expect(resumoFinanceiroIntervalo(registros, '2026-09-10', '2026-09-11').entradas).toBe(15000)
    expect(linhasFinanceiroNoIntervalo(registros, '2026-09-11', '2026-09-10')).toEqual([])
    expect(linhasFinanceiroNoIntervalo(registros, '', '2026-09-10')).toEqual([])
  })
  it('separa também estornos físicos e categorias antigas sem mudar os registros', () => {
    const dados = { data: '2026-09-10', horario: '10:00', origem: 'Teste', meio: 'dinheiro' as const }
    const movimentosCaixa = [
      { ...dados, id: 'venda-avulsa', descricao: 'Venda avulsa', categoria: 'Avulso', valor: 5000 },
      { ...dados, id: 'adicao', data: '2026-09-09', descricao: 'Troco do cofre', categoria: 'Adição de caixa', valor: 2000 },
      { ...dados, id: 'estorno-adicao', descricao: 'Estorno: Troco do cofre', categoria: 'Estorno', valor: -2000, estornoDe: 'adicao' },
      { ...dados, id: 'troco-antigo', descricao: 'Reposição do fundo de troco', categoria: 'Troco', valor: -3500 },
      { ...dados, id: 'retirada-antiga', descricao: 'Retirada para o cofre', categoria: 'Saída de caixa', valor: -30000 },
    ]
    const cenario = { ...base, fichas: [], movimentosCaixa }
    const linhas = movimentosFinanceiro(cenario)
    expect(movimentosOperacionaisFinanceiro(linhas).map((linha) => linha.id)).toEqual(['venda-avulsa'])
    expect(movimentosFisicosCaixa(cenario).map((linha) => linha.id)).toEqual(['estorno-adicao', 'troco-antigo', 'retirada-antiga', 'adicao'])
    expect(resumoFinanceiroIntervalo(linhas, '2026-09-10', '2026-09-10')).toMatchObject({
      entradas: 5000, saidas: 0, liquido: 5000, contagem: { todos: 1, dinheiro: 1 },
    })
    expect(cenario.movimentosCaixa).toEqual(movimentosCaixa)
  })
  it('atalhos financeiros usam o período atual e terminam hoje', () => {
    expect(intervaloAtual('dia', '2026-10-01')).toEqual({ de: '2026-10-01', ate: '2026-10-01' })
    expect(intervaloAtual('semana', '2026-10-01')).toEqual({ de: '2026-09-27', ate: '2026-10-01' })
    expect(intervaloAtual('mes', '2026-10-01')).toEqual({ de: '2026-10-01', ate: '2026-10-01' })
    expect(intervaloAtual('ano', '2026-10-01')).toEqual({ de: '2026-01-01', ate: '2026-10-01' })
  })
  it('explica falta, sobra e valor conferido no caixa', () => {
    expect(textoDiferencaCaixa(-1000)).toBe('Faltam R$ 10,00 em relação ao esperado.')
    expect(textoDiferencaCaixa(1000)).toBe('Há R$ 10,00 a mais que o esperado.')
    expect(textoDiferencaCaixa(0)).toBe('O valor contado confere.')
  })
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
    expect(r.contagem.todos).toBe(movimentosOperacionaisFinanceiro(doDia).length)
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
  it('avisa notinhas em atraso, estoque e (com a área de notas ligada) rascunhos, do mais grave para o menos grave', () => {
    const avisos = notificacoes(base, HOJE)
    const texto = avisos.map((n) => `${n.titulo} ${n.detalhe}`).join(' | ')
    expect(texto).toMatch(/Associação Girassol/)
    expect(texto).toMatch(/Carlos Eduardo Santos/)
    expect(avisos.find((n) => n.tipo === 'estoque-zerado')?.titulo).toBe('1 produto zerado')
    expect(avisos.find((n) => n.tipo === 'estoque-baixo')?.titulo).toBe('4 produtos com estoque baixo')
    // Área de notas oculta: o rascunho não vira aviso (`2026-10-19`).
    expect(avisos.find((n) => n.tipo === 'rascunho')?.titulo).toBe(funcoes.notasFiscais ? '2 rascunhos de nota em revisão' : undefined)
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
