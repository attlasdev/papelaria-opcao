/**
 * Detalhe da ficha (1.0, tela 4.2): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Ficha" e "Operadores e
 * login". A ficha nasce pela venda (`concluirFicha`, tela 4.1a).
 */
import { expect, it } from 'vitest'
import type { Assinatura, DadosCliente, DadosProduto, PagamentoVenda, Venda } from '../../comum/contrato'
import { MENSAGENS_FICHA } from '../../comum/regras/ficha'
import { criarTentativas, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { movimentosSqlite } from '../../electron/banco/movimentos'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarMovimentosDaBase, type OperacoesMovimento } from '../../src/mock/operacoes/movimentos'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesMovimento & OperacoesVenda & OperacoesFicha

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarMovimentosDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t) }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...movimentosSqlite(() => banco),
    ...vendasSqlite(() => banco, t), ...fichasSqlite(() => banco, t),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: '', categoria: 'Escolar', unidade: 'un', preco: 2500, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}
const CLIENTE: DadosCliente = {
  nome: '', documento: null, telefone: null, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/** Loja nova: a dona, o João, a Ana, um caderno (R$ 25, 10 un.) e uma venda de 2 cadernos em dinheiro. */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Caderno' }, 10, dona))
  const ana = dado(await api.cadastrarCliente({ ...CLIENTE, nome: 'Ana Souza' })).id
  const vender = async (pagamento: PagamentoVenda, resto: Partial<Venda> = {}, quantidade = 2) =>
    dado(await api.concluirFicha({ clienteId: null, itens: [{ produtoId: caderno.id, quantidade, precoVisto: 2500 }], servicos: [], desconto: 0, pagamento, ...resto }, joao)).id
  const venda = await vender({ forma: 'dinheiro', recebido: 5000 }, { clienteId: ana })
  return { dona, joao, caderno, ana, venda, vender }
}

const saldo = async (api: Api, id: string) => dado(await api.obterProduto(id)).saldo

testarContrato('detalhe da ficha', { mock, sqlite }, (abrir) => {
  it('a ficha inteira: cliente, quem vendeu, itens com o código, totais e pagamentos', async () => {
    const api = abrir('vazia')
    const { caderno, ana, venda } = await loja(api)
    const f = dado(await api.obterFicha(venda))
    expect(f).toMatchObject({
      id: venda, cliente: { id: ana, nome: 'Ana Souza' }, operador: 'João', forma: 'dinheiro', rotulo: null, vencimento: null,
      situacao: 'paga', pago: 5000, emAberto: 0, quitadaEm: null, subtotal: 5000, desconto: 0, total: 5000, servicos: [],
      itens: [{ produtoId: caderno.id, codigo: caderno.codigo, descricao: 'Caderno', quantidade: 2, preco: 2500 }],
      pagamentos: [{ tipo: 'venda', meio: 'dinheiro', valor: 5000, dia: HOJE, operador: 'João', estorno: null }],
      cancelamento: null, anotacoes: [],
    })
    expect(f.numero).toMatch(/^\d{4}$/)
    expect(f.registradoEm.slice(0, 10)).toBe(AGORA.toISOString().slice(0, 10))
    expect(await api.obterFicha('nao-existe')).toEqual({ ok: false, causa: 'nao-encontrado', erro: MENSAGENS_FICHA.naoEncontrada })
  })

  it('[R-FICHA-02] funcionário cancela só com o PIN dele: o estoque volta e a ficha fica aguardando a dona', async () => {
    const api = abrir('vazia')
    const { joao, caderno, venda } = await loja(api)
    expect(await saldo(api, caderno.id)).toBe(8)
    expect(await api.cancelarFicha(venda, '  ', joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_FICHA.motivo })
    expect(await api.cancelarFicha(venda, 'Cliente desistiu', { ...joao, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await api.cancelarFicha(venda, 'Cliente desistiu', null as never)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.semAssinatura })
    expect([dado(await api.obterFicha(venda)).cancelamento, await saldo(api, caderno.id)]).toEqual([null, 8])

    const f = dado(await api.cancelarFicha(venda, '  Cliente   desistiu ', joao))
    expect(f.cancelamento).toMatchObject({ dia: HOJE, motivo: 'Cliente desistiu', operador: 'João', conferidoPor: null })
    expect([f.situacao, f.emAberto]).toEqual(['cancelada', 0])
    expect(await saldo(api, caderno.id)).toBe(10)
    const devolvido = dado(await api.listarMovimentosEstoque({ produtoId: caderno.id, tipo: 'todas', aguardando: false }, 1, 10)).movimentos[0]
    expect([devolvido.tipo, devolvido.saldoAntes, devolvido.saldoDepois, devolvido.motivo]).toEqual(['cancelamento', 8, 10, 'Cliente desistiu'])
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
    // Não se cancela duas vezes, e o estoque não volta de novo.
    expect(await api.cancelarFicha(venda, 'De novo', joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_FICHA.jaCancelada })
    expect(await saldo(api, caderno.id)).toBe(10)
    expect(await api.cancelarFicha('nao-existe', 'x', joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-FICHA-02] só a dona confere; o cancelamento dela já nasce conferido', async () => {
    const api = abrir('vazia')
    const { dona, joao, venda, vender } = await loja(api)
    expect(await api.conferirCancelamento(venda, dona)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_FICHA.naoCancelada })
    dado(await api.cancelarFicha(venda, 'Cliente desistiu', joao))
    expect(await api.conferirCancelamento(venda, joao)).toMatchObject({ ok: false, causa: 'permissao' })
    expect(await api.conferirCancelamento(venda, { ...dona, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(dado(await api.obterFicha(venda)).cancelamento?.conferidoPor).toBeNull()
    expect(dado(await api.conferirCancelamento(venda, dona)).cancelamento).toMatchObject({ operador: 'João', conferidoPor: 'Helena' })
    // Conferir de novo não muda nada.
    expect(dado(await api.conferirCancelamento(venda, dona)).cancelamento?.conferidoPor).toBe('Helena')

    const outra = await vender({ forma: 'pix', maquininha: null }, {}, 1)
    expect(dado(await api.cancelarFicha(outra, 'Cobrado em dobro', dona)).cancelamento).toMatchObject({ operador: 'Helena', conferidoPor: 'Helena' })
  })

  it('[R-FICHA-03] anotar pede pessoa e PIN e só acrescenta, com quem anotou', async () => {
    const api = abrir('vazia')
    const { dona, joao, venda } = await loja(api)
    expect(await api.anotarFicha(venda, '   ', joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_FICHA.anotacao })
    expect(await api.anotarFicha(venda, 'x'.repeat(501), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_FICHA.longo(500) })
    expect(await api.anotarFicha(venda, 'Combinou pagar dia 15', { ...joao, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(dado(await api.obterFicha(venda)).anotacoes).toEqual([])
    dado(await api.anotarFicha(venda, ' Combinou pagar dia 15 ', joao))
    const f = dado(await api.anotarFicha(venda, 'Ligou pedindo mais prazo', dona))
    expect(f.anotacoes.map((a) => [a.texto, a.operador])).toEqual([['Combinou pagar dia 15', 'João'], ['Ligou pedindo mais prazo', 'Helena']])
    expect(await api.anotarFicha('nao-existe', 'x', joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-NOTINHA-03] notinha com entrada: pago e em aberto; cancelada, deixa de dever', async () => {
    const api = abrir('vazia')
    const { joao, ana, vender } = await loja(api)
    const notinha = await vender({ forma: 'notinha', vencimento: '2026-11-26', entrada: { meio: 'pix', valor: 1000 } }, { clienteId: ana })
    expect(dado(await api.obterFicha(notinha))).toMatchObject({
      forma: 'notinha', vencimento: '2026-11-26', situacao: 'a-vencer', pago: 1000, emAberto: 4000,
      pagamentos: [{ tipo: 'entrada', meio: 'pix', valor: 1000 }],
    })
    expect(dado(await api.cancelarFicha(notinha, 'Errou o cliente', joao))).toMatchObject({ situacao: 'cancelada', emAberto: 0 })
    expect(dado(await api.listarComprasDoCliente(ana, 'todas', 1, 10)).resumo).toMatchObject({ emAberto: 0, notinhasEmAberto: 0, situacao: 'em-dia' })
  })

  it('cartão: o rótulo do pagamento num meio só', async () => {
    const api = abrir('vazia')
    const { vender } = await loja(api)
    const f = dado(await api.obterFicha(await vender({ forma: 'cartao', cartao: 'debito', maquininha: 'sicoob', bandeira: null }, {}, 1)))
    expect([f.rotulo, f.pagamentos[0].rotulo]).toEqual(['Cartão débito · Sicoob', 'Cartão débito · Sicoob'])
  })

  it('na semente: toda compra do histórico abre, com o total e a situação iguais', async () => {
    const api = abrir('semente')
    // Todos: a semente tem recebimento estornado, que não conta como pago.
    const clientes = dado(await api.listarClientes('todos', '', 1, 100)).clientes.filter((c) => c.compras > 0)
    expect(clientes.length).toBeGreaterThan(0)
    for (const c of clientes) {
      for (const compra of dado(await api.listarComprasDoCliente(c.id, 'todas', 1, 100)).compras) {
        const f = dado(await api.obterFicha(compra.id))
        expect([f.total, f.situacao, f.emAberto], `${c.nome} #${compra.numero}`).toEqual([compra.total, compra.situacao, compra.emAberto])
      }
    }
  })
})
