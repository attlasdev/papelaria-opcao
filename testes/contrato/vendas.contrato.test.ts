/**
 * Nova ficha (1.0, tela 4.1a): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Venda (ficha)" e
 * "Notinha". O detalhe da ficha só entra no contrato na tela 4.2; até lá cada
 * lado mostra aqui a ficha que gravou (`ficha`).
 */
import { expect, it } from 'vitest'
import type { Assinatura, CartaoDoMisto, DadosCliente, DadosProduto, PagamentoVenda, RascunhoFicha, Venda } from '../../comum/contrato'
import { MENSAGENS, criarTentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { MENSAGENS_VENDA } from '../../comum/regras/venda'
import type { Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import { movimentosSqlite } from '../../electron/banco/movimentos'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { obterBase } from '../../src/mock/estado-demonstracao'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarMovimentosDaBase, type OperacoesMovimento } from '../../src/mock/operacoes/movimentos'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { HOJE, testarContrato } from './estrutura'

type PagamentoGravado = { tipo: 'venda' | 'entrada'; meio: string; valor: number; rotulo: string | null; maquininha: string | null; cartao: string | null }
type FichaGravada = {
  numero: string; clienteId: string | null; forma: string; desconto: number; total: number; vencimento: string | null; dia: string; operador: string
  itens: { descricao: string; quantidade: number; preco: number }[]; servicos: { nome: string; valor: number; perdas: number | null }[]
  pagamentos: PagamentoGravado[]
}
type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesMovimento & OperacoesVenda & {
  ficha: (id: string) => FichaGravada | null
  fichas: () => number
}

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarMovimentosDaBase(), ...criarVendasDaBase(t),
    fichas: () => obterBase().fichas.length,
    ficha: (id) => {
      const f = obterBase().fichas.find((x) => x.id === id)
      if (!f) return null
      return {
        numero: f.id, clienteId: f.clienteId, forma: f.forma, desconto: f.desconto, total: f.total, vencimento: f.vencimento ?? null, dia: f.data, operador: f.operador,
        itens: f.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, preco: i.preco })),
        servicos: (f.servicos ?? []).map((s) => ({ nome: s.nome, valor: s.valor, perdas: s.perdas?.quantidade ?? null })),
        pagamentos: f.pagamentos.map((p) => ({
          tipo: p.entrada ? 'entrada' : 'venda', meio: p.meio, valor: p.valor, rotulo: p.rotulo ?? null, maquininha: p.maquininha ?? null, cartao: p.cartao ?? null,
        })),
      }
    },
  }
}

const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...movimentosSqlite(() => banco), ...vendasSqlite(() => banco, t),
    fichas: () => (banco.prepare('select count(*) as n from ficha').get() as { n: number }).n,
    ficha: (id) => {
      const f = banco.prepare(`select f.*, o.nome as operador from ficha f join operador o on o.id = f.operador_id where f.id = ?`).get(id) as
        { numero: number; cliente_id: string | null; forma: string; desconto: number; total: number; vencimento: string | null; dia: string; operador: string } | undefined
      if (!f) return null
      return {
        numero: String(f.numero).padStart(4, '0'), clienteId: f.cliente_id, forma: f.forma, desconto: f.desconto, total: f.total, vencimento: f.vencimento, dia: f.dia, operador: f.operador,
        itens: (banco.prepare('select descricao, quantidade, preco from ficha_item where ficha_id = ? order by rowid').all(id) as FichaGravada['itens']).map((x) => ({ ...x })),
        servicos: (banco.prepare('select nome, valor, perdas from ficha_servico where ficha_id = ? order by rowid').all(id) as FichaGravada['servicos']).map((x) => ({ ...x })),
        pagamentos: (banco.prepare('select tipo, meio, valor, rotulo, maquininha, cartao from pagamento where ficha_id = ? order by rowid').all(id) as PagamentoGravado[]).map((x) => ({ ...x })),
      }
    },
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: '', categoria: 'Escolar', unidade: 'un', preco: 100, custo: null, minimo: 0,
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

/** Loja nova: a dona, o João, a Ana (cliente), um caderno (R$ 25, 10 un.), uma caneta (R$ 3,50, 2 un.) e uma cola desativada. */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Caderno' }, 10, dona))
  const caneta = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Caneta', preco: 350 }, 2, dona))
  const cola = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Cola' }, 5, dona))
  dado(await api.ativarProduto(cola.id, false))
  const ana = dado(await api.cadastrarCliente({ ...CLIENTE, nome: 'Ana Souza' })).id
  return { dona, joao, caderno: { ...caderno, preco: 2500 }, caneta, cola, ana, precoCaderno: await mudarPreco(api, caderno.id, 2500) }
}

async function mudarPreco(api: Api, id: string, preco: number) {
  const p = dado(await api.obterProduto(id))
  const { id: _id, codigo: _c, saldo: _s, ativo: _a, temHistorico: _t, ...dados } = p
  dado(await api.editarProduto(id, { ...dados, preco }))
  return preco
}

const venda = (itens: Venda['itens'], pagamento: PagamentoVenda, resto: Partial<Venda> = {}): Venda =>
  ({ clienteId: null, itens, servicos: [], desconto: 0, pagamento, ...resto })

const saldo = async (api: Api, id: string) => dado(await api.obterProduto(id)).saldo

const RASCUNHO: RascunhoFicha = {
  clienteId: null, semIdentificacao: true, itens: [{ produtoId: 'x', quantidade: 2 }],
  servicos: [{ nome: 'Xerox', valor: 50, perdas: 2, observacao: 'saiu torta' }], desconto: 100, forma: 'misto', recebido: 0,
  vencimento: '2026-11-26', entrada: 0, meioEntrada: 'pix', divisao: { dinheiro: 1000, pix: 500, cartao: 0 }, recebidoMisto: 2000,
  cartao: 'debito', maquininhaCartao: 'sicoob', pixNaMaquininha: false,
}

testarContrato('nova ficha', { mock, sqlite }, (abrir) => {
  it('[R-VENDA-02] [R-VENDA-10] [R-VENDA-11] sem identificação, em dinheiro: preço do cadastro, número na sequência, estoque baixado e quem vendeu', async () => {
    const api = abrir('vazia')
    const { joao, caderno, caneta } = await loja(api)
    dado(await api.salvarRascunhoFicha({ ...RASCUNHO, itens: [{ produtoId: caderno.id, quantidade: 2 }] }))

    const primeira = dado(await api.concluirFicha(venda(
      [{ produtoId: caderno.id, quantidade: 2, precoVisto: 2500 }, { produtoId: caneta.id, quantidade: 1, precoVisto: 350 }],
      { forma: 'dinheiro', recebido: 6000 }, { desconto: 50 },
    ), joao))
    expect(api.ficha(primeira.id)).toEqual({
      numero: primeira.numero, clienteId: null, forma: 'dinheiro', desconto: 50, total: 5300, vencimento: null, dia: HOJE, operador: 'João',
      itens: [{ descricao: 'Caderno', quantidade: 2, preco: 2500 }, { descricao: 'Caneta', quantidade: 1, preco: 350 }], servicos: [],
      pagamentos: [{ tipo: 'venda', meio: 'dinheiro', valor: 5300, rotulo: null, maquininha: null, cartao: null }],
    })
    expect([await saldo(api, caderno.id), await saldo(api, caneta.id)]).toEqual([8, 1])
    const movimentos = dado(await api.listarMovimentosEstoque({ produtoId: null, tipo: 'venda', aguardando: false }, 1, 10)).movimentos
    expect(movimentos.map((m) => [m.produto.descricao, m.saldoAntes, m.saldoDepois])).toEqual(expect.arrayContaining([['Caderno', 10, 8], ['Caneta', 2, 1]]))
    // Concluir limpa o rascunho e marca quem vendeu.
    expect(dado(await api.obterRascunhoFicha())).toBeNull()
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)

    const segunda = dado(await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }], { forma: 'dinheiro', recebido: 2500 }), joao))
    expect(Number(segunda.numero)).toBe(Number(primeira.numero) + 1)
    expect(segunda.numero).toMatch(/^\d{4}$/)
  })

  it('[R-VENDA-11] preço que mudou desde que entrou na ficha: recusa com o preço novo e não grava nada', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    const antes = dado(await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }], { forma: 'dinheiro', recebido: 2500 }), joao))
    await mudarPreco(api, caderno.id, 2800)
    const r = await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }], { forma: 'dinheiro', recebido: 5000 }), joao)
    expect(r).toEqual({ ok: false, causa: 'conflito', erro: MENSAGENS_VENDA.precoMudou('Caderno', 2500, 2800) })
    expect(MENSAGENS_VENDA.precoMudou('Caderno', 2500, 2800).replace(/\s/g, ' ')).toBe('O preço de Caderno mudou de R$ 25,00 para R$ 28,00. Confirme com o cliente.')
    expect([api.fichas(), await saldo(api, caderno.id)]).toEqual([1, 9])
    // Com o preço novo, vende; a recusa não gastou número.
    const certa = dado(await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2800 }], { forma: 'dinheiro', recebido: 5000 }), joao))
    expect(api.ficha(certa.id)).toMatchObject({ total: 2800 })
    expect(Number(certa.numero)).toBe(Number(antes.numero) + 1)
  })

  it('[R-VENDA-07] sem saldo ou desativado, sem venda: nada muda na ficha, no pagamento nem no estoque', async () => {
    const api = abrir('vazia')
    const { joao, caderno, caneta, cola } = await loja(api)
    const semSaldo = venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }, { produtoId: caneta.id, quantidade: 3, precoVisto: 350 }], { forma: 'dinheiro', recebido: 9000 })
    expect(await api.concluirFicha(semSaldo, joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.semSaldo('Caneta', 2, 3) })
    expect(await api.concluirFicha(venda([{ produtoId: cola.id, quantidade: 1, precoVisto: 100 }], { forma: 'dinheiro', recebido: 100 }), joao))
      .toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.desativado('Cola') })
    expect(await api.concluirFicha(venda([{ produtoId: 'nao-existe', quantidade: 1, precoVisto: 100 }], { forma: 'dinheiro', recebido: 100 }), joao))
      .toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect([api.fichas(), await saldo(api, caderno.id), await saldo(api, caneta.id)]).toEqual([0, 10, 2])
    // O saldo todo vende.
    dado(await api.concluirFicha(venda([{ produtoId: caneta.id, quantidade: 2, precoVisto: 350 }], { forma: 'dinheiro', recebido: 700 }), joao))
    expect(await saldo(api, caneta.id)).toBe(0)
  })

  it('[R-VENDA-06] os bloqueios ao concluir, cada um com a sua mensagem', async () => {
    const api = abrir('vazia')
    const { joao, caderno, ana } = await loja(api)
    const um = [{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }]
    const recusa = (erro: string) => ({ ok: false, causa: 'validacao', erro })
    expect(await api.concluirFicha(venda([], { forma: 'dinheiro', recebido: 0 }), joao)).toEqual(recusa(MENSAGENS_VENDA.semConteudo))
    expect(await api.concluirFicha(venda(um, { forma: 'dinheiro', recebido: 2500 }, { desconto: 2501 }), joao)).toEqual(recusa(MENSAGENS_VENDA.desconto(2500)))
    expect(await api.concluirFicha(venda(um, { forma: 'dinheiro', recebido: 2499 }), joao)).toEqual(recusa(MENSAGENS_VENDA.dinheiro))
    expect(await api.concluirFicha(venda(um, { forma: 'notinha', vencimento: '2026-11-26', entrada: null }), joao)).toEqual(recusa(MENSAGENS_VENDA.notinhaSemCliente))
    expect(await api.concluirFicha(venda(um, { forma: 'notinha', vencimento: '2026-10-26', entrada: null }, { clienteId: ana }), joao)).toEqual(recusa(MENSAGENS_VENDA.vencimentoPassado))
    expect(await api.concluirFicha(venda(um, { forma: 'notinha', vencimento: '26/11/2026', entrada: null }, { clienteId: ana }), joao)).toEqual(recusa(MENSAGENS_VENDA.vencimento))
    expect(await api.concluirFicha(venda(um, { forma: 'notinha', vencimento: HOJE, entrada: { meio: 'pix', valor: 2500 } }, { clienteId: ana }), joao)).toEqual(recusa(MENSAGENS_VENDA.entradaCobre))
    expect(await api.concluirFicha(venda([{ ...um[0], quantidade: 0 }], { forma: 'dinheiro', recebido: 0 }), joao)).toEqual(recusa(MENSAGENS_VENDA.quantidade))
    expect(await api.concluirFicha(venda([um[0], um[0]], { forma: 'dinheiro', recebido: 5000 }), joao)).toEqual(recusa(MENSAGENS_VENDA.repetido))
    expect(await api.concluirFicha(venda(um, { forma: 'dinheiro', recebido: 2500 }, { clienteId: 'nao-existe' }), joao))
      .toEqual({ ok: false, causa: 'nao-encontrado', erro: MENSAGENS_VENDA.clienteNaoEncontrado })
    expect(await api.concluirFicha({ ...venda(um, { forma: 'dinheiro', recebido: 2500 }), pagamento: { forma: 'fiado' } } as never, joao)).toEqual(recusa(MENSAGENS_VENDA.pedido))
    expect(api.fichas()).toBe(0)
  })

  it('[R-VENDA-09] misto: uma linha por meio, somando o total; o dinheiro entregue cobre a parte em espécie', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    const dois = [{ produtoId: caderno.id, quantidade: 2, precoVisto: 2500 }]
    const misto = (parcelas: { meio: 'dinheiro' | 'pix' | 'cartao'; valor: number }[], recebido: number | null, cartao: CartaoDoMisto | null = { cartao: 'debito', maquininha: 'sicoob' }): PagamentoVenda =>
      ({ forma: 'misto', parcelas, recebido, cartao })
    expect(await api.concluirFicha(venda(dois, misto([{ meio: 'dinheiro', valor: 2000 }, { meio: 'pix', valor: 2000 }], 2000)), joao))
      .toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.mistoTotal(5000) })
    expect(await api.concluirFicha(venda(dois, misto([{ meio: 'dinheiro', valor: 2000 }, { meio: 'pix', valor: 3000 }], 1000)), joao))
      .toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.mistoDinheiro })
    // Um meio só (o outro com zero) não é misto.
    expect(await api.concluirFicha(venda(dois, misto([{ meio: 'pix', valor: 5000 }, { meio: 'cartao', valor: 0 }], null)), joao))
      .toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.mistoMeios })
    const ok = dado(await api.concluirFicha(venda(dois, misto([{ meio: 'dinheiro', valor: 2000 }, { meio: 'cartao', valor: 3000 }, { meio: 'pix', valor: 0 }], 5000)), joao))
    expect(api.ficha(ok.id)?.pagamentos.map((p) => [p.meio, p.valor])).toEqual([['dinheiro', 2000], ['cartao', 3000]])
  })

  it('[R-VENDA-12] misto com cartão: a parte no cartão leva o tipo, a maquininha e o rótulo; sem eles, não grava', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    const dois = [{ produtoId: caderno.id, quantidade: 2, precoVisto: 2500 }]
    type Parcela = { meio: 'dinheiro' | 'pix' | 'cartao'; valor: number }
    const misto = (cartao: CartaoDoMisto | null, parcelas: Parcela[] = [{ meio: 'pix', valor: 1000 }, { meio: 'cartao', valor: 4000 }]): PagamentoVenda =>
      ({ forma: 'misto', parcelas, recebido: null, cartao })
    expect(await api.concluirFicha(venda(dois, misto(null)), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.mistoCartao })
    expect(await api.concluirFicha(venda(dois, misto({ cartao: 'pre-pago', maquininha: 'sicoob' } as never)), joao)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.mistoCartao })
    expect(api.fichas()).toBe(0)
    const pago = dado(await api.concluirFicha(venda(dois, misto({ cartao: 'credito', maquininha: 'mercado-pago' })), joao))
    expect(api.ficha(pago.id)?.pagamentos).toEqual([
      { tipo: 'venda', meio: 'pix', valor: 1000, rotulo: null, maquininha: null, cartao: null },
      { tipo: 'venda', meio: 'cartao', valor: 4000, rotulo: 'Cartão crédito · Mercado Pago', maquininha: 'mercado-pago', cartao: 'credito' },
    ])
    // Sem valor no cartão, o campo do cartão não vale.
    const semCartao = dado(await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }],
      { ...misto({ cartao: 'debito', maquininha: 'sicoob' }, [{ meio: 'pix', valor: 1000 }, { meio: 'dinheiro', valor: 1500 }]), recebido: 1500 } as PagamentoVenda), joao))
    expect(api.ficha(semCartao.id)?.pagamentos.map((p) => [p.meio, p.cartao, p.rotulo])).toEqual([['pix', null, null], ['dinheiro', null, null]])
  })

  it('[R-NOTINHA-03] notinha: a entrada paga na hora e o resto em aberto até o vencimento', async () => {
    const api = abrir('vazia')
    const { joao, caderno, ana } = await loja(api)
    const com = dado(await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 2, precoVisto: 2500 }],
      { forma: 'notinha', vencimento: '2026-11-26', entrada: { meio: 'pix', valor: 1000 } }, { clienteId: ana }), joao))
    expect(api.ficha(com.id)).toMatchObject({ forma: 'notinha', clienteId: ana, vencimento: '2026-11-26', total: 5000, pagamentos: [{ tipo: 'entrada', meio: 'pix', valor: 1000 }] })
    // Entrada zero é notinha sem entrada; vence hoje vale.
    const sem = dado(await api.concluirFicha(venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }],
      { forma: 'notinha', vencimento: HOJE, entrada: { meio: 'dinheiro', valor: 0 } }, { clienteId: ana }), joao))
    expect(api.ficha(sem.id)?.pagamentos).toEqual([])
    // O histórico do cliente lê o que a venda gravou.
    const historico = dado(await api.listarComprasDoCliente(ana, 'todas', 1, 10))
    expect([historico.resumo.emAberto, historico.resumo.notinhasEmAberto, historico.resumo.situacao]).toEqual([6500, 2, 'a-vencer'])
  })

  it('cartão e Pix: o rótulo nasce no back, com a maquininha e a bandeira', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    const um = [{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }]
    const pagos = async (pagamento: PagamentoVenda) => api.ficha(dado(await api.concluirFicha(venda(um, pagamento), joao)).id)!.pagamentos[0]
    expect(await pagos({ forma: 'cartao', cartao: 'credito', maquininha: 'mercado-pago', bandeira: ' Visa ' }))
      .toEqual({ tipo: 'venda', meio: 'cartao', valor: 2500, rotulo: 'Cartão crédito Visa · Mercado Pago', maquininha: 'mercado-pago', cartao: 'credito' })
    expect(await pagos({ forma: 'cartao', cartao: 'debito', maquininha: 'sicoob', bandeira: null })).toMatchObject({ rotulo: 'Cartão débito · Sicoob', cartao: 'debito' })
    expect(await pagos({ forma: 'pix', maquininha: null })).toMatchObject({ meio: 'pix', rotulo: 'Pix manual', maquininha: null })
    expect(await pagos({ forma: 'pix', maquininha: 'mercado-pago' })).toMatchObject({ rotulo: 'Pix · Mercado Pago', maquininha: 'mercado-pago' })
  })

  it('ficha só de serviço vale; total zero não gera pagamento', async () => {
    const api = abrir('vazia')
    const { joao } = await loja(api)
    const servicos = [{ nome: ' Xerox ', valor: 150, perdas: 2, observacao: null }, { nome: 'Encadernação', valor: 600, perdas: null, observacao: ' capa azul ' }]
    const so = dado(await api.concluirFicha(venda([], { forma: 'pix', maquininha: null }, { servicos }), joao))
    expect(api.ficha(so.id)).toMatchObject({ total: 750, itens: [], servicos: [{ nome: 'Xerox', valor: 150, perdas: 2 }, { nome: 'Encadernação', valor: 600, perdas: null }] })
    const gratis = dado(await api.concluirFicha(venda([], { forma: 'dinheiro', recebido: 0 }, { servicos: [servicos[0]], desconto: 150 }), joao))
    expect(api.ficha(gratis.id)).toMatchObject({ total: 0, pagamentos: [] })
    expect(await api.concluirFicha(venda([], { forma: 'dinheiro', recebido: 100 }, { servicos: [{ nome: '  ', valor: 100, perdas: null, observacao: null }] }), joao))
      .toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_VENDA.servico })
  })

  it('[R-OPERADOR-02] concluir pede quem vende: PIN errado ou sem assinatura não grava nada', async () => {
    const api = abrir('vazia')
    const { joao, caderno } = await loja(api)
    const v = venda([{ produtoId: caderno.id, quantidade: 1, precoVisto: 2500 }], { forma: 'dinheiro', recebido: 2500 })
    expect(await api.concluirFicha(v, { ...joao, pin: '0000' })).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
    expect(await api.concluirFicha(v, null as never)).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS_PRODUTO.semAssinatura })
    expect([api.fichas(), await saldo(api, caderno.id)]).toEqual([0, 10])
  })

  it('[R-VENDA-05] o rascunho: guarda, devolve igual, apaga com null e recusa o que não tem formato', async () => {
    const api = abrir('vazia')
    expect(dado(await api.obterRascunhoFicha())).toBeNull()
    dado(await api.salvarRascunhoFicha(RASCUNHO))
    expect(dado(await api.obterRascunhoFicha())).toEqual(RASCUNHO)
    dado(await api.salvarRascunhoFicha({ ...RASCUNHO, forma: 'notinha', clienteId: 'CLI-1', semIdentificacao: false }))
    expect(dado(await api.obterRascunhoFicha())).toMatchObject({ forma: 'notinha', clienteId: 'CLI-1' })
    expect(await api.salvarRascunhoFicha({ ...RASCUNHO, forma: 'fiado' } as never)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(await api.salvarRascunhoFicha({ ...RASCUNHO, itens: [{ produtoId: 'x', quantidade: 0 }] })).toMatchObject({ ok: false, causa: 'validacao' })
    dado(await api.salvarRascunhoFicha(null))
    expect(dado(await api.obterRascunhoFicha())).toBeNull()
  })

  it('na semente: vende o que tem saldo e o número segue a sequência da loja', async () => {
    const api = abrir('semente')
    const operadores = dado(await api.listarOperadores())
    const joao: Assinatura = { operadorId: operadores.pessoas.find((o) => o.nome.startsWith('João'))!.id, pin: '2222' }
    const p = dado(await api.listarProdutos('todos', '', 1, 100)).produtos.find((x) => x.saldo > 1)!
    const antes = api.fichas()
    const r = await api.concluirFicha(venda([{ produtoId: p.id, quantidade: 1, precoVisto: p.preco }], { forma: 'pix', maquininha: null }), joao)
    expect(r.ok, r.ok ? '' : r.erro).toBe(true)
    expect(api.fichas()).toBe(antes + 1)
    expect(await saldo(api, p.id)).toBe(p.saldo - 1)
  })
})
