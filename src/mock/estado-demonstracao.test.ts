import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  alterarSaldo,
  abrirTurnoCaixa,
  anotarFicha,
  avisoLido,
  cancelarFicha,
  estornarMovimentoCaixa,
  estornarPagamento,
  fecharTurnoCaixa,
  registrarMovimentoCaixa,
  movimentarDinheiroCaixa,
  movimentosFisicosCaixa,
  resumoFinanceiro,
  resumoTurnoCaixa,
  buscar,
  cadastrarCliente,
  cadastrarProduto,
  completarProduto,
  definirProdutoAtivo,
  editarProduto,
  perdasServicos,
  servicosFeitos,
  editarCliente,
  marcarEnviadosEmitte,
  excluirProduto,
  marcarAvisosLidos,
  notificacoes,
  concluirFicha,
  movimentosFinanceiro,
  movimentosDoTurnoCaixa,
  notinhasDoCliente,
  obterBase,
  proximoNumeroFicha,
  receberNotinhas,
  restaurarDemonstracao,
  resumoDoCliente,
  resumoEstoque,
} from './estado-demonstracao'
import { carregarBase, normalizarBase } from './base/persistencia'

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

  it('bloqueia a venda sem saldo e não lança ficha, pagamento nem movimento', () => {
    const borracha = obterBase().produtos.find((p) => p.codigo === 'EST-0027')!
    expect(borracha.saldo).toBe(0)
    const antes = obterBase()
    const id = concluirFicha({
      clienteId: null, data: HOJE, horario: '15:00', desconto: 0, total: 250, forma: 'dinheiro',
      itens: [{ codigo: 'EST-0027', descricao: borracha.descricao, quantidade: 1, preco: 250 }],
      pagamentos: [{ data: HOJE, horario: '15:00', meio: 'dinheiro', valor: 250 }],
    })
    expect(id).toBeNull()
    expect(obterBase()).toBe(antes)
  })

  it('registra pagamento misto em linhas separadas, somando exatamente o total', () => {
    const produto = obterBase().produtos.find((item) => item.codigo === 'EST-0022')!
    expect(abrirTurnoCaixa(1000)).toBe(true)
    const turno = obterBase().turnosCaixa![0]
    const dados = {
      clienteId: null, data: HOJE, horario: '15:00', desconto: 0, total: 1250, forma: 'misto' as const,
      itens: [{ codigo: produto.codigo, descricao: produto.descricao, quantidade: 1, preco: 1250 }],
      pagamentos: [
        { data: HOJE, horario: '15:00', meio: 'dinheiro' as const, valor: 500 },
        { data: HOJE, horario: '15:00', meio: 'pix' as const, valor: 750 },
      ],
    }
    expect(concluirFicha({ ...dados, pagamentos: [{ ...dados.pagamentos[0], valor: 400 }, dados.pagamentos[1]] })).toBeNull()
    const id = concluirFicha(dados)
    expect(id).toBeTruthy()
    const ficha = obterBase().fichas.find((item) => item.id === id)!
    expect(ficha.pagamentos.map((pagamento) => [pagamento.meio, pagamento.valor])).toEqual([['dinheiro', 500], ['pix', 750]])
    expect(movimentosFinanceiro(obterBase()).filter((linha) => linha.ficha === id && linha.valor > 0).map((linha) => linha.valor).sort()).toEqual([500, 750].sort())
    expect(resumoTurnoCaixa(obterBase(), turno)).toMatchObject({ entradas: 500, esperado: 1500 })
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

  it('divide o recebimento parcial por meio e abate primeiro a notinha mais antiga', () => {
    const abertas = notinhasDoCliente(obterBase(), 'CLI-0117', HOJE)
      .filter((n) => n.emAberto > 0)
      .sort((a, b) => `${a.ficha.data} ${a.ficha.horario}`.localeCompare(`${b.ficha.data} ${b.ficha.horario}`))
    const [antiga, seguinte] = abertas
    const dinheiro = Math.floor(antiga.emAberto / 2)
    const parcial = Math.floor(seguinte.emAberto / 2)
    const pix = antiga.emAberto - dinheiro + parcial
    expect(abrirTurnoCaixa(1000)).toBe(true)
    const turno = obterBase().turnosCaixa![0]
    const resultado = receberNotinhas([seguinte.ficha.id, antiga.ficha.id], {
      data: HOJE, horario: '15:01', parcelas: [{ meio: 'dinheiro', valor: dinheiro }, { meio: 'pix', valor: pix }],
    })
    expect(resultado).toEqual([
      { id: antiga.ficha.id, valor: antiga.emAberto, quita: true },
      { id: seguinte.ficha.id, valor: parcial, quita: false },
    ])
    const recebidos = movimentosFinanceiro(obterBase()).filter((linha) => linha.data === HOJE && linha.horario === '15:01')
    expect(recebidos.filter((linha) => linha.meio === 'dinheiro').reduce((soma, linha) => soma + linha.valor, 0)).toBe(dinheiro)
    expect(recebidos.filter((linha) => linha.meio === 'pix').reduce((soma, linha) => soma + linha.valor, 0)).toBe(pix)
    expect(recebidos.every((linha) => linha.operador === obterBase().operador && linha.turnoCaixaId === turno.id)).toBe(true)
    expect(resumoTurnoCaixa(obterBase(), turno)).toMatchObject({ entradas: dinheiro, esperado: 1000 + dinheiro })
    const atualizadas = notinhasDoCliente(obterBase(), 'CLI-0117', HOJE)
    expect(atualizadas.find((n) => n.ficha.id === antiga.ficha.id)?.emAberto).toBe(0)
    expect(atualizadas.find((n) => n.ficha.id === seguinte.ficha.id)?.emAberto).toBe(seguinte.emAberto - parcial)
    const ficha = obterBase().fichas.find((item) => item.id === antiga.ficha.id)!
    const indiceDinheiro = ficha.pagamentos.findIndex((p) => p.horario === '15:01' && p.meio === 'dinheiro')
    expect(estornarPagamento(ficha.id, indiceDinheiro, 'Valor registrado por engano')).toBe(true)
    expect(notinhasDoCliente(obterBase(), 'CLI-0117', HOJE).find((n) => n.ficha.id === ficha.id)?.emAberto).toBe(dinheiro)
  })

  it('quita várias notinhas com três meios sem duplicar valores', () => {
    const abertas = notinhasDoCliente(obterBase(), 'CLI-0117', HOJE).filter((n) => n.emAberto > 0)
    const total = abertas.reduce((soma, n) => soma + n.emAberto, 0)
    const recebidos = receberNotinhas(abertas.map((n) => n.ficha.id), {
      data: HOJE, horario: '15:02',
      parcelas: [{ meio: 'dinheiro', valor: 100 }, { meio: 'pix', valor: 200 }, { meio: 'cartao', valor: total - 300 }],
    })
    expect(recebidos.every((abatimento) => abatimento.quita)).toBe(true)
    expect(resumoDoCliente(obterBase(), 'CLI-0117', HOJE).emAberto).toBe(0)
    const movimentos = movimentosFinanceiro(obterBase()).filter((linha) => linha.data === HOJE && linha.horario === '15:02')
    expect(movimentos.reduce((soma, linha) => soma + linha.valor, 0)).toBe(total)
    expect(movimentos.filter((linha) => linha.meio === 'cartao').reduce((soma, linha) => soma + linha.valor, 0)).toBe(total - 300)
  })

  it('recusa recebimentos inválidos sem gravar parte do pagamento', () => {
    const aberta = notinhasDoCliente(obterBase(), 'CLI-0117', HOJE).find((n) => n.emAberto > 0)!
    const antes = obterBase()
    for (const parcelas of [
      [], [{ meio: 'pix' as const, valor: -100 }], [{ meio: 'pix' as const, valor: 0.5 }],
      [{ meio: 'pix' as const, valor: aberta.emAberto + 1 }],
      [{ meio: 'pix' as const, valor: 100 }, { meio: 'pix' as const, valor: 100 }],
    ]) {
      expect(receberNotinhas([aberta.ficha.id], { data: HOJE, horario: '15:03', parcelas })).toEqual([])
      expect(obterBase()).toBe(antes)
    }
    expect(receberNotinhas([aberta.ficha.id, 'inexistente'], { data: HOJE, horario: '15:03', meio: 'pix', valor: 100 })).toEqual([])
    expect(receberNotinhas([aberta.ficha.id], { data: '2026-02-31', horario: '15:03', meio: 'pix', valor: 100 })).toEqual([])
    expect(obterBase()).toBe(antes)
  })
})

describe('cadastrarCliente', () => {
  it('cria com o próximo código e aparece na base', () => {
    const id = cadastrarCliente({ nome: 'Teste', documento: 'Sem documento', telefone: 'Sem telefone', endereco: '' })
    expect(id).toBe('CLI-0128')
    expect(obterBase().clientes.some((c) => c.id === id)).toBe(true)
  })

  it('recusa documento já cadastrado mesmo quando a pontuação muda', () => {
    const cadastro = { nome: 'Cliente A', documento: '123.456.789-00', telefone: '', endereco: '' }
    const id = cadastrarCliente(cadastro)
    expect(id).toBeTruthy()
    expect(cadastrarCliente({ ...cadastro, nome: 'Cliente B', documento: '12345678900' })).toBeNull()
    expect(obterBase().clientes.filter((cliente) => cliente.documento.replace(/\D/g, '') === '12345678900')).toHaveLength(1)
  })
})

describe('entrada de mercadoria', () => {
  it('guarda data física, fornecedor, referência e custo da compra no movimento', () => {
    const produto = obterBase().produtos.find((item) => item.codigo === 'EST-0022')!
    const entrada = { recebidaEm: '2026-09-24', fornecedor: 'Distribuidora', referencia: 'NF 123', observacoes: 'Volume conferido', custoUnitario: 735 }
    expect(alterarSaldo(produto.codigo, produto.saldo + 2, 'Recebimento de mercadorias', 'Entrada', entrada)).toBe(true)
    const movimento = obterBase().movimentosEstoque[0]
    expect(movimento).toMatchObject({ tipo: 'Entrada', antes: produto.saldo, depois: produto.saldo + 2, entrada, operador: obterBase().operador })
    expect(obterBase().produtos.find((item) => item.codigo === produto.codigo)?.custo).toBe(produto.custo)
    expect(alterarSaldo(produto.codigo, produto.saldo + 3, 'Recebimento', 'Entrada', { recebidaEm: '2026-02-31' })).toBe(false)
  })
})

describe('conferência do dinheiro', () => {
  it('preserva os caixas fechados e identifica cada abertura mesmo no mesmo instante', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-09-25T15:00:00Z'))
      const entradasAntes = resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE).entradas
      expect(abrirTurnoCaixa(10000)).toBe(true)
      const primeiro = obterBase().turnosCaixa![0]
      expect(resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE).entradas).toBe(entradasAntes)
      expect(movimentosDoTurnoCaixa(obterBase(), primeiro.id)).toEqual([])
      const retirada = { data: HOJE, horario: '12:00', descricao: 'Guardado no cofre', origem: 'Retirada do caixa', categoria: 'Retirada de caixa', meio: 'dinheiro' as const, valor: -2000 }
      const financeiroAntes = resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE)
      expect(registrarMovimentoCaixa(retirada)).toBe(true)
      const financeiroDepois = resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE)
      expect(financeiroDepois.entradas).toBe(financeiroAntes.entradas)
      expect(financeiroDepois.saidas).toBe(financeiroAntes.saidas)
      expect(financeiroDepois.liquido).toBe(financeiroAntes.liquido)
      expect(financeiroDepois.retiradas - financeiroAntes.retiradas).toBe(2000)
      expect(resumoTurnoCaixa(obterBase(), primeiro).esperado).toBe(8000)
      expect(fecharTurnoCaixa(primeiro.id, 7500, 'Diferença na contagem')).toBe(true)
      const fechado = obterBase().turnosCaixa![0]
      expect(fechado).toMatchObject({ esperadoFechamento: 8000, contadoFechamento: 7500, justificativaDiferenca: 'Diferença na contagem' })
      expect(fecharTurnoCaixa(primeiro.id, 8000, '')).toBe(false)
      expect(abrirTurnoCaixa(7500)).toBe(true)
      const segundo = obterBase().turnosCaixa![0]
      expect(segundo.id).not.toBe(primeiro.id)
      expect(registrarMovimentoCaixa({ ...retirada, valor: -1000 })).toBe(true)
      expect(resumoTurnoCaixa(obterBase(), segundo).esperado).toBe(6500)
      expect(resumoTurnoCaixa(obterBase(), fechado)).toMatchObject({ esperado: 8000, diferenca: -500 })
      expect(movimentosDoTurnoCaixa(obterBase(), primeiro.id)).toHaveLength(1)
    } finally { vi.useRealTimers() }
  })

  it('recusa retirada sem destino, em outro meio ou com valor inválido', () => {
    const antes = obterBase()
    const retirada = { data: HOJE, horario: '15:00', descricao: 'Cofre', origem: 'Retirada do caixa', categoria: 'Retirada de caixa', meio: 'dinheiro' as const, valor: -1000 }
    for (const mudanca of [{ descricao: '' }, { meio: 'pix' as const }, { valor: 1000 }, { valor: 0 }, { valor: -0.5 }]) {
      expect(registrarMovimentoCaixa({ ...retirada, ...mudanca })).toBe(false)
      expect(obterBase()).toBe(antes)
    }
  })

  it('conta somente movimentos em espécie do turno e exige justificativa na diferença', () => {
    expect(abrirTurnoCaixa(5000)).toBe(true)
    expect(abrirTurnoCaixa(1000)).toBe(false)
    const turno = obterBase().turnosCaixa![0]
    const lancar = (meio: 'dinheiro' | 'pix', valor: number, categoria = 'Recebimento avulso') =>
      registrarMovimentoCaixa({ data: HOJE, horario: '15:00', descricao: 'Teste', origem: 'Lançamento manual', categoria, meio, valor })
    lancar('dinheiro', 1200)
    lancar('pix', 3000)
    lancar('dinheiro', -400, 'Retirada de caixa')
    expect(resumoTurnoCaixa(obterBase(), turno)).toMatchObject({ entradas: 1200, saidas: 400, esperado: 5800 })
    expect(fecharTurnoCaixa(turno.id, 5700, '')).toBe(false)
    expect(fecharTurnoCaixa(turno.id, 5700, 'Troco não lançado')).toBe(true)
    const fechado = obterBase().turnosCaixa![0]
    expect(fechado).toMatchObject({ esperadoFechamento: 5800, contadoFechamento: 5700, justificativaDiferenca: 'Troco não lançado' })
    lancar('dinheiro', 900)
    expect(resumoTurnoCaixa(obterBase(), fechado)).toMatchObject({ esperado: 5800, diferenca: -100 })
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
  })!

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

  it('não deixa vender mais que o disponível, mesmo com saldo positivo', () => {
    const produto = obterBase().produtos.find((item) => item.codigo === 'EST-0022')!
    const antes = obterBase()
    expect(concluirFicha({
      clienteId: null, data: HOJE, horario: '15:00', desconto: 0, total: (produto.saldo + 1) * produto.preco, forma: 'pix',
      itens: [{ codigo: produto.codigo, descricao: produto.descricao, quantidade: produto.saldo + 1, preco: produto.preco }],
      pagamentos: [{ data: HOJE, horario: '15:00', meio: 'pix', valor: (produto.saldo + 1) * produto.preco }],
    })).toBeNull()
    expect(obterBase()).toBe(antes)
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

  it('reforço de troco e seu estorno mudam só a gaveta, preservando o fechamento', () => {
    expect(movimentarDinheiroCaixa('adicionar', 2000, 'Troco do cofre')).toBe(false)
    abrirTurnoCaixa(10000)
    const turno = obterBase().turnosCaixa![0]
    const antes = resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE)
    expect(movimentarDinheiroCaixa('adicionar', 2000, 'Troco do cofre')).toBe(true)
    const adicao = obterBase().movimentosCaixa[0]
    expect(adicao).toMatchObject({ valor: 2000, meio: 'dinheiro', turnoCaixaId: turno.id, operador: obterBase().operador })
    expect(resumoTurnoCaixa(obterBase(), turno).esperado).toBe(12000)
    expect(resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE)).toMatchObject({ entradas: antes.entradas, saidas: antes.saidas, liquido: antes.liquido })
    expect(fecharTurnoCaixa(turno.id, 12000, '')).toBe(true)
    abrirTurnoCaixa(12000)
    expect(estornarMovimentoCaixa(adicao.id, 'Dinheiro não foi colocado')).toBe(true)
    expect(resumoTurnoCaixa(obterBase(), obterBase().turnosCaixa![0]).esperado).toBe(10000)
    expect(resumoTurnoCaixa(obterBase(), obterBase().turnosCaixa![1])).toMatchObject({ esperado: 12000, diferenca: 0 })
    expect(resumoFinanceiro(movimentosFinanceiro(obterBase()), 'dia', HOJE)).toMatchObject({ entradas: antes.entradas, saidas: antes.saidas, liquido: antes.liquido })
    expect(movimentosFisicosCaixa(obterBase()).find((item) => item.id === adicao.id)?.estornado).toBe(true)
  })

  it('ações da gaveta recusam caixa fechado, valores inválidos e motivo vazio', () => {
    expect(movimentarDinheiroCaixa('retirar', 1000, 'Cofre')).toBe(false)
    abrirTurnoCaixa(5000)
    const antes = obterBase()
    for (const acao of ['adicionar', 'retirar'] as const) {
      for (const valor of [0, -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(movimentarDinheiroCaixa(acao, valor, 'Cofre')).toBe(false)
      expect(movimentarDinheiroCaixa(acao, 1000, '  ')).toBe(false)
    }
    expect(obterBase()).toBe(antes)
    expect(registrarMovimentoCaixa({ data: HOJE, horario: '15:00', descricao: 'Troco', origem: 'Cofre', categoria: 'Adição de caixa', meio: 'pix', valor: 1000 })).toBe(false)
    expect(movimentarDinheiroCaixa('retirar', 1000, 'Cofre')).toBe(true)
    expect(resumoTurnoCaixa(obterBase(), antes.turnosCaixa![0]).esperado).toBe(4000)
  })

  it('separa retirada física das despesas e recusa retirada por Pix', () => {
    const dados = { data: HOJE, horario: '15:00', descricao: 'Cofre', origem: 'Lançamento manual', categoria: 'Retirada de caixa', meio: 'dinheiro' as const, valor: -1000 }
    const quantidade = obterBase().movimentosCaixa.length
    expect(registrarMovimentoCaixa({ ...dados, meio: 'pix' })).toBe(false)
    expect(obterBase().movimentosCaixa).toHaveLength(quantidade)
    expect(registrarMovimentoCaixa(dados)).toBe(true)
    const original = obterBase().movimentosCaixa[0]
    const linhas = movimentosFinanceiro(obterBase()).filter((linha) => linha.id === original.id)
    expect(resumoFinanceiro(linhas, 'ano', HOJE)).toMatchObject({ retiradas: 1000, saidas: 0, entradas: 0 })
    expect(estornarMovimentoCaixa(original.id, 'Retirada não aconteceu')).toBe(true)
    const comEstorno = movimentosFinanceiro(obterBase()).filter((linha) => linha.id === original.id || linha.estornoDe === original.id)
    expect(resumoFinanceiro(comEstorno, 'ano', HOJE)).toMatchObject({ retiradas: 0, saidas: 0, entradas: 0 })
    expect(obterBase().movimentosCaixa[0].operador).toBe(obterBase().operador)
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

describe('marca de enviado à Emitte', () => {
  it('marca só os escolhidos e sobrevive a editar e completar', () => {
    const [a, b] = obterBase().produtos
    marcarEnviadosEmitte('produtos', [a.codigo])
    const marcado = obterBase().produtos.find((p) => p.codigo === a.codigo)!
    expect(marcado.emitteEnviadoEm).toBeTruthy()
    expect(obterBase().produtos.find((p) => p.codigo === b.codigo)!.emitteEnviadoEm).toBeUndefined()
    const { codigo: _c, saldo: _s, cadastroRapido: _r, inativo: _i, emitteEnviadoEm: _e, ...dados } = marcado
    expect(editarProduto(a.codigo, { ...dados, preco: dados.preco + 100 })).toBe(true)
    expect(obterBase().produtos.find((p) => p.codigo === a.codigo)!.emitteEnviadoEm).toBe(marcado.emitteEnviadoEm)
  })

  it('cliente marcado continua marcado ao editar', () => {
    const c = obterBase().clientes[0]
    marcarEnviadosEmitte('clientes', [c.id])
    const quando = obterBase().clientes[0].emitteEnviadoEm
    expect(editarCliente(c.id, { nome: c.nome, documento: c.documento, telefone: c.telefone, endereco: c.endereco })).toBe(true)
    expect(obterBase().clientes[0].emitteEnviadoEm).toBe(quando)
  })
})

describe('serviços', () => {
  const venda = (servicos: Parameters<typeof concluirFicha>[0]['servicos'], itens: Parameters<typeof concluirFicha>[0]['itens'] = []) => {
    const total = (servicos ?? []).reduce((t, s) => t + s.valor, 0) + itens.reduce((t, i) => t + i.preco * i.quantidade, 0)
    return concluirFicha({ clienteId: null, data: HOJE, horario: '15:00', itens, servicos, desconto: 0, total, forma: 'dinheiro', pagamentos: [{ data: HOJE, horario: '15:00', meio: 'dinheiro', valor: total }] })
  }
  const copia = { nome: 'Cópia P&B', valor: 100 }

  it('ficha só de serviço vale, com perda e observação, e não mexe no estoque', () => {
    const estoqueAntes = obterBase().movimentosEstoque.length
    const id = venda([{ ...copia, nome: '  2 cópias P&B  ', perdas: { quantidade: 4 }, observacao: 'Saíram 6, 4 manchadas' }])
    expect(id).toBeTruthy()
    const ficha = obterBase().fichas.find((f) => f.id === id)!
    expect(ficha.servicos?.[0]).toEqual({ nome: '2 cópias P&B', valor: 100, perdas: { quantidade: 4 }, observacao: 'Saíram 6, 4 manchadas' })
    expect(obterBase().movimentosEstoque.length).toBe(estoqueAntes)
    expect(perdasServicos(obterBase(), HOJE, HOJE)).toEqual([expect.objectContaining({ ficha: id, servico: '2 cópias P&B', quantidade: 4, observacao: 'Saíram 6, 4 manchadas' })])
  })

  it('serviço sem nome, perda sem quantidade e ficha vazia são recusados', () => {
    expect(venda([{ ...copia, nome: '   ' }])).toBeNull()
    expect(venda([{ ...copia, perdas: { quantidade: 0 } }])).toBeNull()
    expect(venda([{ ...copia, perdas: { quantidade: 1.5 } }])).toBeNull()
    expect(venda([])).toBeNull()
  })

  it('histórico: cada serviço com a ficha, marca a ficha com produtos e deixa a cancelada de fora', () => {
    const so = venda([{ ...copia, perdas: { quantidade: 2 } }])!
    const borracha = obterBase().produtos.find((p) => p.codigo === 'EST-0022')!
    const misto = venda([{ nome: 'Encadernação', valor: 800 }], [{ codigo: borracha.codigo, descricao: borracha.descricao, quantidade: 1, preco: borracha.preco }])!
    const cancelada = venda([{ nome: 'Plastificação', valor: 500, perdas: { quantidade: 1 } }])!
    expect(cancelarFicha(cancelada, 'Teste')).toBeTruthy()
    const feitos = servicosFeitos(obterBase(), HOJE, HOJE)
    expect(feitos.find((f) => f.ficha === so)).toMatchObject({ servico: 'Cópia P&B', valor: 100, perdas: 2, comProdutos: false })
    expect(feitos.find((f) => f.ficha === misto)).toMatchObject({ servico: 'Encadernação', valor: 800, perdas: 0, comProdutos: true })
    expect(feitos.some((f) => f.ficha === cancelada)).toBe(false)
    // A perda da cancelada continua: o material se perdeu do mesmo jeito.
    expect(perdasServicos(obterBase(), HOJE, HOJE).some((p) => p.ficha === cancelada)).toBe(true)
  })

  it('no Financeiro: só serviço é "Serviço"; com produto, "Venda e serviço"', () => {
    const so = venda([copia])!
    const borracha = obterBase().produtos.find((p) => p.codigo === 'EST-0022')!
    const misto = venda([copia], [{ codigo: borracha.codigo, descricao: borracha.descricao, quantidade: 1, preco: borracha.preco }])!
    const categoria = (ficha: string) => movimentosFinanceiro(obterBase()).find((l) => l.ficha === ficha)?.categoria
    expect(categoria(so)).toBe('Serviço')
    expect(movimentosFinanceiro(obterBase()).find((l) => l.ficha === so)?.descricao).toBe(`Serviço da ficha #${so}`)
    expect(categoria(misto)).toBe('Venda e serviço')
  })

  it('base gravada com o cadastro de serviços abre sem ele, e as fichas perdem código e motivo', () => {
    const id = venda([copia])!
    const atual = obterBase()
    const antigo = { codigo: 'SRV-0001', nome: 'Cópia P&B', valor: 100, perdas: { quantidade: 2, motivo: 'impressora' }, observacao: 'Manchou' }
    const gravada = {
      ...atual,
      servicos: [{ codigo: 'SRV-0001', nome: 'Cópia P&B', preco: 50 }],
      fichas: atual.fichas.map((f) => (f.id === id ? { ...f, servicos: [antigo] } : f)),
      rascunhoFicha: { ...(atual.rascunhoFicha ?? {}), servicos: [antigo] },
    }
    const aberta = normalizarBase(gravada)!
    expect('servicos' in aberta).toBe(false)
    expect(aberta.fichas.find((f) => f.id === id)?.servicos).toEqual([{ nome: 'Cópia P&B', valor: 100, perdas: { quantidade: 2 }, observacao: 'Manchou' }])
    expect(aberta.rascunhoFicha?.servicos).toEqual([{ nome: 'Cópia P&B', valor: 100, perdas: { quantidade: 2 }, observacao: 'Manchou' }])
  })
})
