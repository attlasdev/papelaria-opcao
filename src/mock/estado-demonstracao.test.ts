import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  avisoLido,
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
