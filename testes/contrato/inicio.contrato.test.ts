/**
 * Início (1.0, tela 8.1): os mesmos cenários no mock (base da demonstração) e
 * no SQLite. Regras em Memoria.md, "Início e sino". Tudo nasce pelos gestos
 * das outras telas; o relógio anda um minuto entre eles, para a ordem ficar
 * clara, e volta um dia para a venda de ontem.
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosLancamento, DadosProduto, FiltroFichas, PagamentoVenda } from '../../comum/contrato'
import { MENSAGENS_INICIO } from '../../comum/regras/inicio'
import { criarTentativas } from '../../comum/regras/operador'
import { ajustesSqlite } from '../../electron/banco/ajustes'
import type { Banco } from '../../electron/banco/banco'
import { caixaSqlite } from '../../electron/banco/caixa'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { financeiroSqlite } from '../../electron/banco/financeiro'
import { inicioSqlite } from '../../electron/banco/inicio'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { recebimentosSqlite } from '../../electron/banco/recebimentos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarAjustesDaBase, type OperacoesAjuste } from '../../src/mock/operacoes/ajustes'
import { criarCaixaDaBase, type OperacoesCaixa } from '../../src/mock/operacoes/caixa'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarFinanceiroDaBase, type OperacoesFinanceiro } from '../../src/mock/operacoes/financeiro'
import { criarInicioDaBase, type OperacoesInicio } from '../../src/mock/operacoes/inicio'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarRecebimentosDaBase, type OperacoesRecebimento } from '../../src/mock/operacoes/recebimentos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesRecebimento
  & OperacoesCaixa & OperacoesFinanceiro & OperacoesAjuste & OperacoesInicio

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t),
    ...criarRecebimentosDaBase(t), ...criarCaixaDaBase(t), ...criarFinanceiroDaBase(t), ...criarAjustesDaBase(t), ...criarInicioDaBase(),
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...vendasSqlite(() => banco, t),
    ...fichasSqlite(() => banco, t), ...recebimentosSqlite(() => banco, t), ...caixaSqlite(() => banco, t), ...financeiroSqlite(() => banco, t),
    ...ajustesSqlite(() => banco, t), ...inicioSqlite(() => banco),
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

/**
 * Ontem: v0, 2 cadernos em dinheiro (R$ 10). Hoje, nesta ordem:
 *   o primeiro caixa, aberto e fechado pela dona com diferença (já conferido)
 *   o segundo, fechado pelo João sem diferença (não precisa de visto)
 *   o caixa do João
 *   v1  1 caderno em dinheiro (R$ 5)
 *   v2  2 cadernos no Pix (R$ 10)                  cancelada pelo João
 *   v3  misto: cartão R$ 10 (primeiro, com rótulo) + dinheiro R$ 5
 *   v4  só serviço no cartão (R$ 7), da Ana
 *   n1  notinha da Ana, 4 cadernos (R$ 20), entrada no Pix R$ 10
 *   n2  notinha da Ana, 2 cadernos (R$ 10), sem entrada
 *   R   R$ 15 em dinheiro nas duas notinhas         estornado pelo João
 *   L1  despesa em dinheiro R$ 3                    estornada pelo João
 *   L2  despesa no Pix R$ 12
 *   v5  1 caderno em dinheiro (R$ 5)                cancelada pela dona
 *   L3  despesa em dinheiro R$ 1                    estornada pela dona
 *       retirada de R$ 20 da gaveta (fica no Caixa)
 *       ajuste da cola pelo João, e outro pela dona
 *       o caixa do João fechado com R$ 1 a menos
 */
async function umDia(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto(PRODUTO, 100, dona))
  const cola = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Cola' }, 10, dona))
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
  const lancar = async (d: DadosLancamento, quem: Assinatura) => { anda(); return dado(await api.registrarLancamento(d, quem)) }
  const esperado = async () => dado(await api.obterCaixaAtual())!.resumo.esperado

  vi.setSystemTime(new Date('2026-10-26T10:00:00-03:00'))
  const v0 = dado(await api.concluirFicha({ clienteId: null, itens: [{ produtoId: caderno.id, quantidade: 2, precoVisto: 500 }], servicos: [], desconto: 0, pagamento: { forma: 'dinheiro', recebido: 1000 } }, joao)).id
  anda()
  dado(await api.abrirCaixa(10000, dona))
  anda()
  dado(await api.fecharCaixa(9000, 'Contei errado de manhã', dona))
  anda()
  dado(await api.abrirCaixa(9000, dona))
  anda()
  dado(await api.fecharCaixa(await esperado(), '', joao))
  anda()
  const caixa = dado(await api.abrirCaixa(10000, joao)).id
  const v1 = await vender(1, { forma: 'dinheiro', recebido: 500 })
  const v2 = await vender(2, { forma: 'pix', maquininha: null })
  const v3 = await vender(3, { forma: 'misto', parcelas: [{ meio: 'cartao', valor: 1000 }, { meio: 'dinheiro', valor: 500 }], recebido: 500, cartao: { cartao: 'debito' } })
  const v4 = await vender(0, { forma: 'cartao', cartao: 'credito', maquininha: 'sicoob', bandeira: null }, { clienteId: ana, servico: 700 })
  const n1 = await vender(4, { forma: 'notinha', vencimento: '2026-11-26', entrada: { meio: 'pix', valor: 1000 } }, { clienteId: ana })
  const n2 = await vender(2, { forma: 'notinha', vencimento: '2026-11-26', entrada: null }, { clienteId: ana })
  anda()
  dado(await api.cancelarFicha(v2, 'Cliente desistiu', joao))
  anda()
  dado(await api.receberNotinhas({ notinhas: [n1, n2], dia: HOJE, parcelas: [{ meio: 'dinheiro', valor: 1500 }], cartao: null, recebido: null }, joao))
  anda()
  const recebido = dado(await api.obterFicha(n1)).pagamentos.find((p) => p.tipo === 'recebimento')!.id
  dado(await api.estornarRecebimento(recebido, 'Valor errado', joao))
  const l1 = await lancar({ tipo: 'despesa', meio: 'dinheiro', descricao: 'Lanche da equipe', valor: 300 }, joao)
  anda()
  const e1 = dado(await api.estornarLancamento(l1.id, 'Lançado em dobro', joao))
  await lancar({ tipo: 'despesa', meio: 'pix', descricao: 'Material de limpeza', valor: 1200 }, joao)
  const v5 = await vender(1, { forma: 'dinheiro', recebido: 500 })
  anda()
  dado(await api.cancelarFicha(v5, 'Cobrado errado', dona))
  const l3 = await lancar({ tipo: 'despesa', meio: 'dinheiro', descricao: 'Café', valor: 100 }, dona)
  anda()
  dado(await api.estornarLancamento(l3.id, 'Era do mês passado', dona))
  anda()
  dado(await api.movimentarGaveta('retirada', 2000, 'Depósito no banco', joao))
  anda()
  dado(await api.ajustarEstoque({ produtoId: cola.id, contagem: 8, saldoVisto: 10, motivo: 'Dois secos' }, joao))
  anda()
  dado(await api.ajustarEstoque({ produtoId: cola.id, contagem: 9, saldoVisto: 8, motivo: 'Achei uma' }, dona))
  anda()
  dado(await api.fecharCaixa(await esperado() - 100, 'Faltou troco', joao))
  vi.setSystemTime(AGORA)
  return { dona, joao, ana, cola, caixa, v0, v1, v2, v3, v4, v5, n1, n2, recebido, e1 }
}

const fichas = async (api: Api, filtro: Partial<FiltroFichas> = {}, pagina = 1, porPagina = 20) =>
  dado(await api.listarFichas({ dia: HOJE, pagamento: 'todos', ...filtro }, pagina, porPagina))
const ids = async (api: Api, filtro: Partial<FiltroFichas> = {}) => (await fichas(api, filtro)).fichas.map((f) => f.id)

testarContrato('início', { mock, sqlite }, (abrir) => {
  it('[R-INICIO-01] [R-INICIO-02] os cartões de hoje: o Financeiro do dia (sem a gaveta) e as fichas sem as canceladas', async () => {
    const api = abrir('vazia')
    await umDia(api)
    const r = dado(await api.obterResumoDoDia())
    // Só o dia e os valores: sem comparação com ontem (`R-INICIO-02`).
    expect(r).toEqual({ dia: HOJE, recebimentos: 3700, vendas: 5, ticketMedio: 1140, saidas: 1200, quantidadeSaidas: 3 })
    // A mesma conta do Financeiro do dia.
    const financeiro = dado(await api.consultarFinanceiro({ de: HOJE, ate: HOJE }, 'todos', 1, 1)).resumo
    expect([r.recebimentos, r.saidas, r.quantidadeSaidas]).toEqual([financeiro.entradas, financeiro.saidas, financeiro.quantidadeSaidas])
  })

  it('[R-INICIO-01] sem movimento, os cartões zeram', async () => {
    const api = abrir('vazia')
    expect(dado(await api.obterResumoDoDia())).toEqual({ dia: HOJE, recebimentos: 0, vendas: 0, ticketMedio: 0, saidas: 0, quantidadeSaidas: 0 })
  })

  it('[R-INICIO-04] o filtro de pagamento: o misto em cada meio, a notinha só em Notinha, as canceladas na lista', async () => {
    const api = abrir('vazia')
    const { v1, v2, v3, v4, v5, n1, n2 } = await umDia(api)
    expect(await ids(api)).toEqual([v5, n2, n1, v4, v3, v2, v1])
    expect(await ids(api, { pagamento: 'dinheiro' })).toEqual([v5, v3, v1])
    // A n1 teve entrada no Pix e a n2 recebeu em dinheiro: as duas ficam só em Notinha.
    expect(await ids(api, { pagamento: 'pix' })).toEqual([v2])
    expect(await ids(api, { pagamento: 'cartao' })).toEqual([v4, v3])
    expect(await ids(api, { pagamento: 'notinha' })).toEqual([n2, n1])
  })

  it('[R-INICIO-01] cada linha traz o cliente, o rótulo, os itens e os serviços', async () => {
    const api = abrir('vazia')
    const { ana, v2, v3, v4, n1 } = await umDia(api)
    const r = await fichas(api)
    const por = (id: string) => r.fichas.find((f) => f.id === id)!
    expect(por(v4)).toMatchObject({
      dia: HOJE, cliente: { id: ana, nome: 'Ana Souza' }, forma: 'cartao', total: 700, rotulo: 'Cartão crédito · Sicoob', cancelada: false,
      itens: [], servicos: ['Xerox'],
    })
    expect(por(v3)).toMatchObject({ cliente: null, forma: 'misto', total: 1500, rotulo: null, itens: [{ descricao: 'Caderno', quantidade: 3 }] })
    expect(por(n1)).toMatchObject({ forma: 'notinha', rotulo: null, total: 2000 })
    expect(por(v2)).toMatchObject({ rotulo: 'Pix manual', cancelada: true })
    expect(por(v2).numero).toMatch(/^\d{4}$/)
    expect(new Date(por(v2).registradoEm).toISOString()).toBe(por(v2).registradoEm)
  })

  it('[R-INICIO-03] qualquer dia passado, ou todo o histórico; o futuro e o pedido fora do formato são recusados', async () => {
    const api = abrir('vazia')
    const { v0, v1 } = await umDia(api)
    expect(await ids(api, { dia: '2026-10-26' })).toEqual([v0])
    expect(await ids(api, { dia: '2025-01-01' })).toEqual([])
    const tudo = await fichas(api, { dia: null })
    expect([tudo.total, tudo.fichas.at(-1)?.id, tudo.fichas.at(-2)?.id]).toEqual([8, v0, v1])
    const recusa = (erro: string) => ({ ok: false, causa: 'validacao', erro })
    expect(await api.listarFichas({ dia: '2026-10-28', pagamento: 'todos' }, 1, 10)).toEqual(recusa(MENSAGENS_INICIO.futuro))
    expect(await api.listarFichas({ dia: '27/10/2026', pagamento: 'todos' }, 1, 10)).toEqual(recusa(MENSAGENS_INICIO.dia))
    expect(await api.listarFichas({ dia: HOJE, pagamento: 'misto' as never }, 1, 10)).toEqual(recusa(MENSAGENS_INICIO.pedido))
    expect(await api.listarFichas(null as never, 1, 10)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(await api.listarFichas({ dia: HOJE, pagamento: 'todos' }, 1, 101)).toMatchObject({ ok: false, causa: 'validacao' })
  })

  it('pagina no back; página além do fim vira a última', async () => {
    const api = abrir('vazia')
    const { v1, v2 } = await umDia(api)
    const segunda = await fichas(api, {}, 2, 5)
    expect([segunda.pagina, segunda.total, segunda.fichas.map((f) => f.id)]).toEqual([2, 7, [v2, v1]])
    expect((await fichas(api, {}, 9, 5)).pagina).toBe(2)
  })

  it('[R-INICIO-06] aguardando a dona: os cinco tipos que o funcionário fez, sem os da dona; o recebimento é um item só', async () => {
    const api = abrir('vazia')
    const { caixa, v2, n1, n2 } = await umDia(api)
    const numero = async (id: string) => dado(await api.obterFicha(id)).numero
    const lista = dado(await api.listarAguardandoDona())
    expect(lista.map((a) => [a.tipo, a.descricao, a.operador, a.onde])).toEqual([
      ['fechamento', 'Fechamento do caixa com diferença', 'João', { tela: 'caixa', caixaId: caixa }],
      ['ajuste', 'Ajuste de estoque: Cola', 'João', { tela: 'movimentacoes' }],
      ['estorno-lancamento', 'Estorno do lançamento: Lanche da equipe', 'João', { tela: 'financeiro', dia: HOJE }],
      ['estorno-recebimento', `Estorno do recebimento das notinhas #${await numero(n1)}, #${await numero(n2)}`, 'João', { tela: 'ficha', fichaId: n1 }],
      ['cancelamento', `Cancelamento da ficha #${await numero(v2)}`, 'João', { tela: 'ficha', fichaId: v2 }],
    ])
    expect(lista.every((a) => new Date(a.registradoEm).toISOString() === a.registradoEm)).toBe(true)
  })

  it('[R-INICIO-06] conferido sai da lista; sem nada, a lista é vazia', async () => {
    const api = abrir('vazia')
    expect(dado(await api.listarAguardandoDona())).toEqual([])
    const { dona, caixa, v2, recebido, e1 } = await umDia(api)
    const ajuste = dado(await api.listarAguardandoDona()).find((a) => a.tipo === 'ajuste')!
    dado(await api.conferirFechamento(caixa, dona))
    dado(await api.conferirAjustes([ajuste.id], dona))
    dado(await api.conferirEstornoLancamento(e1.id, dona))
    expect(dado(await api.listarAguardandoDona()).map((a) => a.tipo)).toEqual(['estorno-recebimento', 'cancelamento'])
    dado(await api.conferirEstorno(recebido, dona))
    dado(await api.conferirCancelamento(v2, dona))
    expect(dado(await api.listarAguardandoDona())).toEqual([])
  })

  it('a semente: cada item aguardando leva a um registro que existe, com quem fez', async () => {
    // A do SQLite traz os cinco tipos (as patologias); a da demonstração, nenhum.
    const api = abrir('semente')
    for (const a of dado(await api.listarAguardandoDona())) {
      expect(a.operador && a.descricao).toBeTruthy()
      if (a.onde.tela === 'ficha') expect((await api.obterFicha(a.onde.fichaId)).ok).toBe(true)
      if (a.onde.tela === 'caixa') expect(dado(await api.obterCaixa(a.onde.caixaId)).fechamento?.conferidoPor).toBeNull()
    }
    expect(dado(await api.obterResumoDoDia()).dia).toBe(HOJE)
  })
})
