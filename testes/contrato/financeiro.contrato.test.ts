/**
 * Financeiro (1.0, tela 7.2): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Financeiro". O dinheiro
 * nasce pelas fichas, pelo receber e pelos lançamentos; o relógio anda um
 * minuto entre os gestos, para a ordem das linhas ficar clara.
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosLancamento, DadosProduto, FiltroFinanceiro, PagamentoVenda } from '../../comum/contrato'
import { MENSAGENS_FINANCEIRO } from '../../comum/regras/financeiro'
import { criarTentativas, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from '../../electron/banco/banco'
import { boletosSqlite } from '../../electron/banco/boletos'
import { caixaSqlite } from '../../electron/banco/caixa'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { financeiroSqlite } from '../../electron/banco/financeiro'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { recebimentosSqlite } from '../../electron/banco/recebimentos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarBoletosDaBase, type OperacoesBoleto } from '../../src/mock/operacoes/boletos'
import { criarCaixaDaBase, type OperacoesCaixa } from '../../src/mock/operacoes/caixa'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarFinanceiroDaBase, type OperacoesFinanceiro } from '../../src/mock/operacoes/financeiro'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarRecebimentosDaBase, type OperacoesRecebimento } from '../../src/mock/operacoes/recebimentos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesRecebimento
  & OperacoesCaixa & OperacoesBoleto & OperacoesFinanceiro

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t),
    ...criarRecebimentosDaBase(t), ...criarCaixaDaBase(t), ...criarBoletosDaBase(t), ...criarFinanceiroDaBase(t),
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...vendasSqlite(() => banco, t),
    ...fichasSqlite(() => banco, t), ...recebimentosSqlite(() => banco, t), ...caixaSqlite(() => banco, t), ...boletosSqlite(() => banco, t),
    ...financeiroSqlite(() => banco, t),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: 'Caderno', categoria: 'Escolar', unidade: 'un', preco: 500, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}
const CLIENTE: DadosCliente = {
  nome: 'Ana Souza', documento: null, telefone: null, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

const recusa = (erro: string) => ({ ok: false, causa: 'validacao', erro })
const HOJE_SO = { de: HOJE, ate: HOJE }

/**
 * Hoje, com o caixa aberto:
 *   V1  5 cadernos em dinheiro (R$ 25)               depois cancelada (- R$ 25)
 *   V2  só serviço no Pix (R$ 7)                      "Serviço"
 *   V3  2 cadernos + serviço no cartão (R$ 13)        "Venda e serviço"
 *   N   notinha de R$ 50, entrada no Pix (R$ 10)      "Recebimento de notinha"
 *   R   recebimento de R$ 10 em dinheiro na notinha   depois estornado (- R$ 10)
 *   L1  despesa em dinheiro (R$ 12)                   depois estornada (+ R$ 12)
 *   L2  entrada avulsa no Pix (R$ 5)
 * Fora do Financeiro: um boleto pago e uma adição na gaveta.
 */
async function umDia(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto(PRODUTO, 100, dona))
  const ana = dado(await api.cadastrarCliente(CLIENTE)).id
  let minuto = 0
  const anda = () => vi.setSystemTime(new Date(AGORA.getTime() + ++minuto * 60_000))
  const vender = async (quantidade: number, pagamento: PagamentoVenda, resto: { clienteId?: string; servico?: number } = {}) => {
    anda()
    return dado(await api.concluirFicha({
      clienteId: resto.clienteId ?? null, itens: quantidade ? [{ produtoId: caderno.id, quantidade, precoVisto: 500 }] : [],
      servicos: resto.servico ? [{ nome: 'Xerox', valor: resto.servico, perdas: null, observacao: null }] : [], desconto: 0, pagamento,
    }, joao)).id
  }
  const lancar = async (d: DadosLancamento) => { anda(); return dado(await api.registrarLancamento(d, joao)) }
  anda()
  dado(await api.abrirCaixa(10000, joao))
  const v1 = await vender(5, { forma: 'dinheiro', recebido: 2500 })
  const v2 = await vender(0, { forma: 'pix', maquininha: null }, { servico: 700 })
  const v3 = await vender(2, { forma: 'cartao', cartao: 'debito', maquininha: 'sicoob', bandeira: null }, { servico: 300 })
  const n = await vender(10, { forma: 'notinha', vencimento: '2026-11-26', entrada: { meio: 'pix', valor: 1000 } }, { clienteId: ana })
  anda()
  dado(await api.receberNotinhas({ notinhas: [n], dia: HOJE, parcelas: [{ meio: 'dinheiro', valor: 1000 }], cartao: null, recebido: null }, joao))
  anda()
  dado(await api.estornarRecebimento(dado(await api.obterFicha(n)).pagamentos.find((p) => p.tipo === 'recebimento')!.id, 'Valor errado', joao))
  anda()
  dado(await api.cancelarFicha(v1, 'Cliente desistiu', joao))
  const l1 = await lancar({ tipo: 'despesa', meio: 'dinheiro', descricao: 'Lanche da equipe', valor: 1200 })
  const l2 = await lancar({ tipo: 'entrada', meio: 'pix', descricao: 'Xerox avulso', valor: 500 })
  anda()
  const e2 = dado(await api.estornarLancamento(l1.id, 'Lançado em dobro', joao))
  anda()
  dado(await api.movimentarGaveta('adicao', 5000, 'Troco do cofre', joao))
  const boleto = dado(await api.cadastrarBoleto({ descricao: 'Conta de luz', valor: 41237, numero: '7', vencimento: HOJE })).id
  anda()
  dado(await api.marcarBoletoPago(boleto, joao))
  return { dona, joao, v1, v2, v3, n, l1, l2, e2, anda }
}

const consultar = async (api: Api, filtro: FiltroFinanceiro = 'todos', pagina = 1, porPagina = 20) =>
  dado(await api.consultarFinanceiro(HOJE_SO, filtro, pagina, porPagina))

testarContrato('financeiro', { mock, sqlite }, (abrir) => {
  it('[R-FINANCEIRO-03] [R-SERVICO-04] cada pagamento e lançamento vira linha; o estorno abate do próprio lado', async () => {
    const api = abrir('vazia')
    const { v1, v2, v3, n, l1, l2, e2 } = await umDia(api)
    const r = await consultar(api)
    const por = (cond: (l: typeof r.linhas[number]) => boolean) => r.linhas.find(cond)!
    expect(r.linhas.map((l) => [l.categoria, l.meio, l.valor, l.lado, l.estornado])).toEqual([
      ['Estorno', 'dinheiro', 1200, 'saida', false], ['Recebimento avulso', 'pix', 500, 'entrada', false], ['Despesa', 'dinheiro', -1200, 'saida', true],
      ['Estorno', 'dinheiro', -2500, 'entrada', false], ['Estorno', 'dinheiro', -1000, 'entrada', false], ['Recebimento de notinha', 'dinheiro', 1000, 'entrada', true],
      ['Recebimento de notinha', 'pix', 1000, 'entrada', false], ['Venda e serviço', 'cartao', 1300, 'entrada', false], ['Serviço', 'pix', 700, 'entrada', false],
      ['Venda', 'dinheiro', 2500, 'entrada', true],
    ])
    const venda = por((l) => l.ficha?.id === v1 && !l.estornoDe)
    expect(venda).toMatchObject({ origem: 'Balcão · Não identificado', vendaEstornavel: false, operador: 'João' })
    expect(venda.descricao).toBe(`Venda da ficha #${venda.ficha!.numero}`)
    expect(por((l) => l.ficha?.id === v2).descricao).toMatch(/^Serviço da ficha #/)
    expect(por((l) => l.ficha?.id === v3)).toMatchObject({ vendaEstornavel: true, rotulo: 'Cartão débito · Sicoob' })
    const cancelamento = por((l) => l.estornoDe === venda.id)
    expect([cancelamento.descricao, cancelamento.origem]).toEqual([`Cancelamento da ficha #${venda.ficha!.numero}`, 'Não identificado · Cliente desistiu'])
    expect(por((l) => l.ficha?.id === n && l.meio === 'pix').descricao).toMatch(/^Entrada da notinha #/)
    expect(por((l) => l.ficha?.id === n && l.categoria === 'Estorno')).toMatchObject({ origem: 'Ana Souza · Valor errado' })
    expect(por((l) => l.id === l1.id)).toMatchObject({ descricao: 'Lanche da equipe', origem: 'Lançamento manual', lancamentoEstornavel: false, estornado: true })
    expect(por((l) => l.id === l2.id)).toMatchObject({ lancamentoEstornavel: true })
    expect(e2).toMatchObject({ descricao: 'Estorno: Lanche da equipe', origem: 'Lançado em dobro', estornoDe: l1.id, aguardandoDona: true, conferidoPor: null })
  })

  it('[R-FINANCEIRO-04] os cartões e as contagens são do período inteiro; o filtro só escolhe as linhas', async () => {
    const api = abrir('vazia')
    await umDia(api)
    const r = await consultar(api)
    expect(r.resumo).toEqual({
      entradas: 3500, saidas: 0, liquido: 3500, quantidadeSaidas: 1,
      contagem: { todos: 10, dinheiro: 6, pix: 3, cartao: 1, estornos: 3 },
    })
    const estornos = await consultar(api, 'estornos')
    expect([estornos.total, estornos.linhas.every((l) => l.categoria === 'Estorno'), estornos.resumo]).toEqual([3, true, r.resumo])
    expect((await consultar(api, 'dinheiro')).total).toBe(6)
    const segunda = await consultar(api, 'todos', 2, 4)
    expect([segunda.pagina, segunda.total, segunda.linhas.length]).toEqual([2, 10, 4])
    // A planilha lê as mesmas linhas, sem paginar.
    expect(dado(await api.listarFinanceiroDoPeriodo(HOJE_SO)).map((l) => l.id)).toEqual(r.linhas.map((l) => l.id))
    expect(await api.consultarFinanceiro(HOJE_SO, 'notinha' as FiltroFinanceiro, 1, 10)).toMatchObject(recusa(MENSAGENS_FINANCEIRO.pedido))
    expect(await api.consultarFinanceiro({ de: HOJE, ate: '2026-10-28' }, 'todos', 1, 10)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(dado(await api.consultarFinanceiro({ de: '2026-10-26', ate: '2026-10-26' }, 'todos', 1, 10)).total).toBe(0)
  })

  it('[R-FINANCEIRO-05] [R-BOLETO-04] a gaveta e o boleto pago não entram no Financeiro', async () => {
    const api = abrir('vazia')
    await umDia(api)
    const r = await consultar(api)
    expect(r.linhas.some((l) => /Troco do cofre|Conta de luz/.test(`${l.descricao} ${l.origem}`))).toBe(false)
    expect(r.resumo.contagem.todos).toBe(10)
  })

  it('[R-FINANCEIRO-07] lançar pede PIN e, em dinheiro, entra no caixa aberto; estornar pede motivo e fica a conferir', async () => {
    const api = abrir('vazia')
    const { dona, joao, v3, l2, e2, anda } = await umDia(api)
    const antes = dado(await api.obterCaixaAtual())!.resumo.esperado
    const despesa: DadosLancamento = { tipo: 'despesa', meio: 'dinheiro', descricao: ' Material  de limpeza ', valor: 800 }
    expect(await api.registrarLancamento({ ...despesa, descricao: '  ' }, joao)).toEqual(recusa(MENSAGENS_FINANCEIRO.descricao))
    expect(await api.registrarLancamento({ ...despesa, valor: 0 }, joao)).toEqual(recusa(MENSAGENS_FINANCEIRO.valor))
    expect(await api.registrarLancamento(despesa, { ...joao, pin: '0000' })).toEqual(recusa(MENSAGENS.pinErrado))
    expect(await api.registrarLancamento(despesa, null as never)).toEqual(recusa(MENSAGENS_PRODUTO.semAssinatura))
    anda()
    const nova = dado(await api.registrarLancamento(despesa, joao))
    expect(nova).toMatchObject({ descricao: 'Material de limpeza', categoria: 'Despesa', valor: -800, lado: 'saida', dia: HOJE, operador: 'João' })
    expect(dado(await api.obterCaixaAtual())!.resumo.esperado).toBe(antes - 800)

    expect(await api.estornarLancamento(l2.id, '', joao)).toEqual(recusa(MENSAGENS_FINANCEIRO.motivo))
    expect(await api.estornarLancamento(e2.id, 'De novo', joao)).toEqual(recusa(MENSAGENS_FINANCEIRO.ehEstorno))
    expect(await api.estornarLancamento(e2.estornoDe!, 'De novo', joao)).toEqual(recusa(MENSAGENS_FINANCEIRO.jaEstornado))
    const daVenda = (await consultar(api)).linhas.find((l) => l.ficha?.id === v3)!
    expect(await api.estornarLancamento(daVenda.id, 'Não é lançamento', joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })

    expect(await api.conferirEstornoLancamento(e2.id, joao)).toMatchObject({ ok: false, causa: 'permissao' })
    expect(await api.conferirEstornoLancamento(l2.id, dona)).toEqual(recusa(MENSAGENS_FINANCEIRO.naoEhEstorno))
    expect(dado(await api.conferirEstornoLancamento(e2.id, dona))).toMatchObject({ conferidoPor: 'Helena', aguardandoDona: false })
    anda()
    expect(dado(await api.estornarLancamento(l2.id, 'Não entrou', dona))).toMatchObject({ valor: -500, lado: 'entrada', conferidoPor: 'Helena', aguardandoDona: false })
  })

  it('[R-FINANCEIRO-03] cancelar a notinha não desfaz de novo o recebimento já estornado', async () => {
    const api = abrir('vazia')
    const { joao, n, anda } = await umDia(api)
    anda()
    dado(await api.cancelarFicha(n, 'Venda errada', joao))
    const daNotinha = (await consultar(api)).linhas.filter((l) => l.ficha?.id === n && l.categoria === 'Estorno')
    expect(daNotinha.map((l) => [l.meio, l.valor, l.origem])).toEqual([
      ['pix', -1000, 'Ana Souza · Venda errada'], ['dinheiro', -1000, 'Ana Souza · Valor errado'],
    ])
  })

  it('na semente: os cartões batem com as linhas e as contagens com os meios', async () => {
    const api = abrir('semente')
    const periodo = { de: '2026-10-01', ate: HOJE }
    const r = dado(await api.consultarFinanceiro(periodo, 'todos', 1, 100))
    const linhas = dado(await api.listarFinanceiroDoPeriodo(periodo))
    expect(r.total).toBe(linhas.length)
    const { contagem, entradas, saidas, liquido } = r.resumo
    expect(contagem.todos).toBe(contagem.dinheiro + contagem.pix + contagem.cartao)
    expect(entradas).toBe(linhas.filter((l) => l.lado === 'entrada').reduce((t, l) => t + l.valor, 0))
    expect(liquido).toBe(entradas - saidas)
    expect(linhas.every((l) => l.ficha || l.categoria !== 'Venda')).toBe(true)
  })
})
