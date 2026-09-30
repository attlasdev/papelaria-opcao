import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  anotarFicha,
  avisoLido,
  cancelarFicha,
  estornarMovimentoCaixa,
  estornarPagamento,
  registrarMovimentoCaixa,
  resumoFinanceiro,
  buscar,
  cadastrarCliente,
  cadastrarProduto,
  completarProduto,
  definirProdutoAtivo,
  editarProduto,
  excluirProduto,
  marcarAvisosLidos,
  notificacoes,
  concluirFicha,
  movimentosFinanceiro,
  notinhasDoCliente,
  obterBase,
  proximoNumeroFicha,
  receberNotinhas,
  restaurarDemonstracao,
  resumoDoCliente,
  resumoEstoque,
} from './estado-demonstracao'
import { carregarBase } from './base/persistencia'

const HOJE = '2026-09-25'
beforeEach(() => restaurarDemonstracao(HOJE, 15 * 60))
afterEach(() => vi.unstubAllGlobals())

describe('cadastrarProduto', () => {
  it('mantém produto sem saldo na base gravada e nas consultas de estoque', () => {
    const dados = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => dados.set(chave, valor),
      removeItem: (chave: string) => dados.delete(chave),
    })
    const antes = resumoEstoque(obterBase()).produtos
    const codigo = cadastrarProduto({ codigoBarras: '789999001', descricao: 'Produto de teste', categoria: 'Teste', grupo: 'artes', unidade: 'un', preco: 100, saldo: 0, minimo: 0 })
    const guardada = carregarBase()!
    expect(guardada.produtos.find((produto) => produto.codigo === codigo)?.saldo).toBe(0)
    expect(resumoEstoque(guardada).produtos).toBe(antes + 1)
    expect(buscar(guardada, '789999001').produtos[0].codigo).toBe(codigo)
  })
})

describe('cadastro rápido feito na venda', () => {
  const rapido = { codigoBarras: '789999002', descricao: 'Cola rápida', categoria: 'Escolar', grupo: 'artes' as const, unidade: 'un' as const, preco: 500, saldo: 0, minimo: 0, cadastroRapido: true as const }

  it('fica pendente no estoque e no sino até ser completado', () => {
    const codigo = cadastrarProduto(rapido)
    expect(resumoEstoque(obterBase()).aCompletar).toBe(1)
    expect(notificacoes(obterBase(), HOJE).some((a) => a.id === 'cadastro-rapido')).toBe(true)
    // Saldo sem contagem não é falta: não entra em zerado nem em baixo.
    expect(notificacoes(obterBase(), HOJE).find((a) => a.id === 'estoque-zerado')?.detalhe).not.toMatch(/Cola rápida/)

    const { saldo: _saldo, cadastroRapido: _marca, ...cadastro } = rapido
    expect(completarProduto(codigo, { ...cadastro, minimo: 5, custo: 250 }, 12)).toBe(true)

    const produto = obterBase().produtos.find((p) => p.codigo === codigo)!
    expect(produto).toMatchObject({ saldo: 12, minimo: 5, custo: 250 })
    expect(produto.cadastroRapido).toBeUndefined()
    expect(resumoEstoque(obterBase()).aCompletar).toBe(0)
    expect(notificacoes(obterBase(), HOJE).some((a) => a.id === 'cadastro-rapido')).toBe(false)
    expect(obterBase().movimentosEstoque[0]).toMatchObject({ tipo: 'Ajuste', produto: codigo, antes: 0, depois: 12 })
  })
})

describe('concluirFicha', () => {
  it('guarda a ficha, dá baixa no estoque e numera em sequência', () => {
    const antes = obterBase()
    const numero = proximoNumeroFicha(antes)
    const caderno = antes.produtos.find((p) => p.codigo === 'EST-0021')!
    const id = concluirFicha({
      clienteId: 'CLI-0107', data: HOJE, horario: '15:00', desconto: 0, total: 4980, forma: 'pix',
      itens: [{ codigo: 'EST-0021', descricao: caderno.descricao, quantidade: 2, preco: 2490 }],
      pagamentos: [{ data: HOJE, horario: '15:00', meio: 'pix', valor: 4980 }],
    })
    const depois = obterBase()
    expect(id).toBe(numero)
    expect(depois.produtos.find((p) => p.codigo === 'EST-0021')!.saldo).toBe(caderno.saldo - 2)
    expect(depois.movimentosEstoque[0]).toMatchObject({ tipo: 'Venda', produto: 'EST-0021', antes: caderno.saldo, depois: caderno.saldo - 2 })
    expect(movimentosFinanceiro(depois).some((l) => l.ficha === id && l.valor === 4980)).toBe(true)
  })

  it('não deixa o saldo negativo e avisa no movimento', () => {
    const borracha = obterBase().produtos.find((p) => p.codigo === 'EST-0027')!
    expect(borracha.saldo).toBe(0)
    concluirFicha({
      clienteId: null, data: HOJE, horario: '15:00', desconto: 0, total: 250, forma: 'dinheiro',
      itens: [{ codigo: 'EST-0027', descricao: borracha.descricao, quantidade: 1, preco: 250 }],
      pagamentos: [{ data: HOJE, horario: '15:00', meio: 'dinheiro', valor: 250 }],
    })
    expect(obterBase().produtos.find((p) => p.codigo === 'EST-0027')!.saldo).toBe(0)
    expect(obterBase().movimentosEstoque[0].motivo).toMatch(/saldo do sistema menor/)
  })
})

describe('receberNotinhas', () => {
  it('quita as notinhas, põe o cliente em dia e lança no Financeiro', () => {
    const abertas = notinhasDoCliente(obterBase(), 'CLI-0117', HOJE).filter((n) => n.emAberto > 0)
    const total = abertas.reduce((t, n) => t + n.emAberto, 0)
    receberNotinhas(abertas.map((n) => n.ficha.id), { data: HOJE, horario: '15:00', meio: 'dinheiro', valor: total })
    expect(resumoDoCliente(obterBase(), 'CLI-0117', HOJE).situacao).toBe('em-dia')
    const recebidos = movimentosFinanceiro(obterBase()).filter((l) => l.data === HOJE && l.horario === '15:00' && abertas.some((n) => n.ficha.id === l.ficha))
    expect(recebidos.reduce((t, l) => t + l.valor, 0)).toBe(total)
  })
})

describe('cadastrarCliente', () => {
  it('cria com o próximo código e aparece na base', () => {
    const id = cadastrarCliente({ nome: 'Teste', documento: 'Sem documento', telefone: 'Sem telefone', email: '', endereco: '' })
    expect(id).toBe('CLI-0128')
    expect(obterBase().clientes.some((c) => c.id === id)).toBe(true)
  })
})

describe('avisos lidos', () => {
  it('marca como lido e volta a ser novo quando o aviso muda', () => {
    const avisos = notificacoes(obterBase(), HOJE)
    marcarAvisosLidos(avisos)
    expect(notificacoes(obterBase(), HOJE).every((a) => avisoLido(obterBase(), a))).toBe(true)
    const girassol = notinhasDoCliente(obterBase(), 'CLI-0117', HOJE).filter((n) => n.situacao === 'vencido')
    receberNotinhas([girassol[0].ficha.id], { data: HOJE, horario: '15:00', meio: 'pix', valor: 1000 })
    const depois = notificacoes(obterBase(), HOJE).find((a) => a.id === 'atraso-CLI-0117')!
    expect(avisoLido(obterBase(), depois)).toBe(false)
  })
})

describe('editar, excluir e desativar produto', () => {
  const novo = { codigoBarras: '789999003', descricao: 'Clipe nº 2', categoria: 'Escritório', grupo: 'escritorio' as const, unidade: 'cx' as const, preco: 450, saldo: 7, minimo: 2 }

  it('edita o cadastro sem mexer no saldo', () => {
    const codigo = cadastrarProduto(novo)
    const { saldo: _saldo, ...cadastro } = novo
    expect(editarProduto(codigo, { ...cadastro, descricao: 'Clipe nº 2/0', preco: 500 })).toBe(true)
    expect(obterBase().produtos.find((p) => p.codigo === codigo)).toMatchObject({ descricao: 'Clipe nº 2/0', preco: 500, saldo: 7 })
  })

  it('apaga produto sem histórico', () => {
    const codigo = cadastrarProduto(novo)
    expect(excluirProduto(codigo)).toBe(true)
    expect(obterBase().produtos.some((p) => p.codigo === codigo)).toBe(false)
  })

  it('não apaga produto com histórico; desativa e tira das contas', () => {
    const antes = resumoEstoque(obterBase()).produtos
    expect(excluirProduto('EST-0021')).toBe(false)
    definirProdutoAtivo('EST-0021', false)
    expect(obterBase().produtos.find((p) => p.codigo === 'EST-0021')?.inativo).toBe(true)
    expect(resumoEstoque(obterBase())).toMatchObject({ produtos: antes - 1, desativados: 1 })
    definirProdutoAtivo('EST-0021', true)
    expect(obterBase().produtos.find((p) => p.codigo === 'EST-0021')?.inativo).toBeUndefined()
  })
})

describe('saldo inicial do cadastro', () => {
  it('vira a primeira entrada do histórico, sem impedir excluir cadastro por engano', () => {
    const codigo = cadastrarProduto({ descricao: 'Grampo 26/6', categoria: 'Escritório', grupo: 'escritorio', unidade: 'cx', preco: 800, saldo: 5, minimo: 1 })
    expect(obterBase().movimentosEstoque.filter((m) => m.produto === codigo)).toMatchObject([{ tipo: 'Entrada', antes: 0, depois: 5 }])
    expect(excluirProduto(codigo)).toBe(true)
    expect(obterBase().movimentosEstoque.some((m) => m.produto === codigo)).toBe(false)
  })
})

describe('cancelar ficha', () => {
  const venda = () => concluirFicha({
    clienteId: 'CLI-0107', data: HOJE, horario: '14:00', desconto: 0, total: 5600, forma: 'pix',
    itens: [{ codigo: 'EST-0021', descricao: 'Caderno', quantidade: 2, preco: 2800 }],
    pagamentos: [{ data: HOJE, horario: '14:00', meio: 'pix', valor: 5600 }],
  })

  it('devolve o estoque, estorna o pago e tira das compras do cliente', () => {
    const saldoAntes = obterBase().produtos.find((p) => p.codigo === 'EST-0021')!.saldo
    const id = venda()
    const comprasAntes = resumoDoCliente(obterBase(), 'CLI-0107', HOJE).totalComprado
    expect(cancelarFicha(id, '')).toBe(false)
    expect(cancelarFicha(id, 'Cliente desistiu')).toBe(true)
    expect(cancelarFicha(id, 'de novo')).toBe(false)
    expect(obterBase().produtos.find((p) => p.codigo === 'EST-0021')!.saldo).toBe(saldoAntes)
    expect(obterBase().movimentosEstoque[0]).toMatchObject({ tipo: 'Cancelamento', motivo: `Ficha #${id} cancelada · Cliente desistiu` })
    const linhas = movimentosFinanceiro(obterBase()).filter((l) => l.ficha === id)
    expect(linhas.map((l) => l.valor).sort((a, b) => a - b)).toEqual([-5600, 5600])
    expect(resumoDoCliente(obterBase(), 'CLI-0107', HOJE).totalComprado).toBe(comprasAntes - 5600)
  })

  it('notinha cancelada sai da cobrança', () => {
    const aberta = notinhasDoCliente(obterBase(), 'CLI-0106', HOJE).find((n) => n.emAberto > 0)!
    expect(cancelarFicha(aberta.ficha.id, 'Lançada no cliente errado')).toBe(true)
    expect(resumoDoCliente(obterBase(), 'CLI-0106', HOJE).abertas.some((n) => n.ficha.id === aberta.ficha.id)).toBe(false)
  })
})

describe('estornos', () => {
  it('recebimento estornado volta a dever e sai do caixa no dia do estorno', () => {
    const aberta = notinhasDoCliente(obterBase(), 'CLI-0106', HOJE).find((n) => n.emAberto > 0)!
    receberNotinhas([aberta.ficha.id], { data: HOJE, horario: '15:00', meio: 'dinheiro', valor: aberta.emAberto })
    const ficha = obterBase().fichas.find((f) => f.id === aberta.ficha.id)!
    expect(estornarPagamento(ficha.id, ficha.pagamentos.length - 1, 'Valor errado')).toBe(true)
    expect(notinhasDoCliente(obterBase(), 'CLI-0106', HOJE).find((n) => n.ficha.id === ficha.id)?.emAberto).toBe(aberta.emAberto)
    expect(estornarPagamento(ficha.id, ficha.pagamentos.length - 1, 'de novo')).toBe(false)
    const estorno = movimentosFinanceiro(obterBase()).find((l) => l.id === `${ficha.id}-${ficha.pagamentos.length - 1}-estorno`)
    expect(estorno).toMatchObject({ valor: -aberta.emAberto, categoria: 'Estorno' })
  })

  it('lançamento manual é anulado por outro de sinal contrário, uma vez só', () => {
    registrarMovimentoCaixa({ data: HOJE, horario: '15:00', descricao: 'Material de limpeza', origem: 'Lançamento manual', categoria: 'Despesa', meio: 'dinheiro', valor: -9000 })
    const original = obterBase().movimentosCaixa[0]
    expect(estornarMovimentoCaixa(original.id, 'Digitei 90 em vez de 9')).toBe(true)
    expect(estornarMovimentoCaixa(original.id, 'de novo')).toBe(false)
    expect(obterBase().movimentosCaixa[0]).toMatchObject({ valor: 9000, estornoDe: original.id })
    const linhas = movimentosFinanceiro(obterBase())
    expect(linhas.find((l) => l.id === original.id)).toMatchObject({ estornado: true, estornavel: false })
    // O estorno abate a saída; não vira entrada.
    const r = resumoFinanceiro(linhas.filter((l) => l.id === original.id || l.id === obterBase().movimentosCaixa[0].id), 'ano', HOJE)
    expect(r).toMatchObject({ entradas: 0, saidas: 0, liquido: 0, quantidadeSaidas: 1 })
  })
})

describe('anotação na ficha', () => {
  it('só acrescenta, com data', () => {
    const id = obterBase().fichas[0].id
    expect(anotarFicha(id, '  ')).toBe(false)
    expect(anotarFicha(id, 'Combinou pagar dia 15')).toBe(true)
    expect(obterBase().fichas.find((f) => f.id === id)?.anotacoes?.at(-1)?.texto).toBe('Combinou pagar dia 15')
  })
})

describe('comparação com o período anterior', () => {
  it('corta o dia anterior na mesma hora', () => {
    const linha = (data: string, horario: string, valor: number) => ({ id: `${data}${horario}`, data, horario, descricao: '', origem: '', categoria: 'Venda', meio: 'pix' as const, meioRotulo: 'Pix', valor })
    const linhas = [linha('2026-09-24', '09:00', 1000), linha('2026-09-24', '17:00', 9000), linha(HOJE, '09:30', 1000)]
    expect(resumoFinanceiro(linhas, 'dia', HOJE, '10:00').variacao?.texto).toBe('+0,0%')
    expect(resumoFinanceiro(linhas, 'dia', HOJE).variacao?.texto).toBe('-90,0%')
  })
})
