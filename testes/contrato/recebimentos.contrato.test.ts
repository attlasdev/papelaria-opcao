/**
 * Receber notinhas (1.0, tela 5.1): os mesmos cenários no mock (base da
 * demonstração) e no SQLite. Regras em Memoria.md, "Clientes" e "Notinha". As
 * notinhas nascem pela venda (`concluirFicha`), em dias passados: o relógio do
 * cenário anda para trás na hora da venda e volta para hoje.
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosProduto, Recebimento } from '../../comum/contrato'
import { criarTentativas, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { MENSAGENS_RECEBIMENTO } from '../../comum/regras/recebimento'
import type { Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { recebimentosSqlite } from '../../electron/banco/recebimentos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarRecebimentosDaBase, type OperacoesRecebimento } from '../../src/mock/operacoes/recebimentos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesRecebimento

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t), ...criarRecebimentosDaBase(t) }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco),
    ...vendasSqlite(() => banco, t), ...fichasSqlite(() => banco, t), ...recebimentosSqlite(() => banco, t),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: 'Caderno', categoria: 'Escolar', unidade: 'un', preco: 1000, custo: null, minimo: 0,
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

/**
 * A Ana deve duas notinhas: a #1, de 20/10 (R$ 50 com R$ 10 de entrada,
 * venceu em 25/10) e a #2, de 24/10 (R$ 30, vence em 30/11). Mais uma quitada
 * e uma cancelada, que não aparecem. A Bia deve uma de hoje.
 */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto(PRODUTO, 100, dona))
  const ana = dado(await api.cadastrarCliente({ ...CLIENTE, nome: 'Ana Souza' })).id
  const bia = dado(await api.cadastrarCliente({ ...CLIENTE, nome: 'Bia Lima' })).id
  const notinha = async (dia: string, cliente: string, quantidade: number, vencimento: string, entrada: number | null = null) => {
    vi.setSystemTime(new Date(`${dia}T10:00:00-03:00`))
    const venda = dado(await api.concluirFicha({
      clienteId: cliente, itens: [{ produtoId: caderno.id, quantidade, precoVisto: 1000 }], servicos: [], desconto: 0,
      pagamento: { forma: 'notinha', vencimento, entrada: entrada ? { meio: 'pix', valor: entrada } : null },
    }, joao)).id
    vi.setSystemTime(AGORA)
    return venda
  }
  const primeira = await notinha('2026-10-20', ana, 5, '2026-10-25', 1000)
  const segunda = await notinha('2026-10-24', ana, 3, '2026-11-30')
  const quitada = await notinha('2026-10-21', ana, 1, '2026-11-21')
  const cancelada = await notinha('2026-10-22', ana, 2, '2026-11-22')
  dado(await api.cancelarFicha(cancelada, 'Errou o cliente', joao))
  const daBia = await notinha(HOJE, bia, 2, '2026-11-27')
  dado(await api.receberNotinhas({ notinhas: [quitada], dia: HOJE, parcelas: [{ meio: 'pix', valor: 1000 }], cartao: null, recebido: null }, joao))
  return { dona, joao, ana, bia, primeira, segunda, quitada, cancelada, daBia }
}

const receber = (notinhas: string[], parcelas: Recebimento['parcelas'], resto: Partial<Recebimento> = {}): Recebimento =>
  ({ notinhas, dia: HOJE, parcelas, cartao: null, recebido: null, ...resto })
const recusa = (erro: string) => ({ ok: false, causa: 'validacao', erro })

testarContrato('receber notinhas', { mock, sqlite }, (abrir) => {
  it('as notinhas abertas do cliente, da mais antiga para a mais nova, sem a quitada nem a cancelada', async () => {
    const api = abrir('vazia')
    const { ana, primeira, segunda } = await loja(api)
    const r = dado(await api.listarNotinhasAbertas(ana))
    expect(r.cliente).toEqual({ id: ana, nome: 'Ana Souza' })
    expect(r.notinhas.map((n) => [n.id, n.dia, n.total, n.pago, n.emAberto, n.vencimento, n.situacao])).toEqual([
      [primeira, '2026-10-20', 5000, 1000, 4000, '2026-10-25', 'em-atraso'],
      [segunda, '2026-10-24', 3000, 0, 3000, '2026-11-30', 'a-vencer'],
    ])
    expect(r.notinhas[0].numero).toMatch(/^\d{4}$/)
    expect(await api.listarNotinhasAbertas('nao-existe')).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-CLIENTE-06] [R-NOTINHA-03] pagamento parcial abate da mais antiga, com quem recebeu', async () => {
    const api = abrir('vazia')
    const { dona, joao, ana, primeira, segunda } = await loja(api)
    // A dona assina por último antes: o receber tem de marcar o João.
    dado(await api.anotarFicha(segunda, 'Vem pagar sábado', dona))
    // Marcadas fora de ordem: abate da mais antiga do mesmo jeito.
    const feito = dado(await api.receberNotinhas(receber([segunda, primeira], [{ meio: 'pix', valor: 5000 }]), joao))
    expect(feito.abatimentos.map((a) => [a.fichaId, a.valor, a.quitada])).toEqual([[primeira, 4000, true], [segunda, 1000, false]])
    expect(dado(await api.listarNotinhasAbertas(ana)).notinhas.map((n) => [n.id, n.pago, n.emAberto])).toEqual([[segunda, 1000, 2000]])
    const recebido = dado(await api.obterFicha(primeira)).pagamentos.at(-1)
    expect(recebido).toMatchObject({ tipo: 'recebimento', meio: 'pix', valor: 4000, rotulo: 'Pix manual', dia: HOJE, operador: 'João' })
    expect(dado(await api.obterFicha(primeira))).toMatchObject({ situacao: 'paga', emAberto: 0, quitadaEm: HOJE })
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
  })

  it('[R-CLIENTE-06] [R-NOTINHA-06] misto repartido entre as notinhas; o cartão é manual no Sicoob', async () => {
    const api = abrir('vazia')
    const { joao, primeira, segunda } = await loja(api)
    const parcelas: Recebimento['parcelas'] = [{ meio: 'dinheiro', valor: 5000 }, { meio: 'cartao', valor: 2000 }, { meio: 'pix', valor: 0 }]
    expect(await api.receberNotinhas(receber([primeira, segunda], parcelas), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.cartao))
    dado(await api.receberNotinhas(receber([primeira, segunda], parcelas, { cartao: 'debito', recebido: 6000 }), joao))
    const linhas = async (id: string) => dado(await api.obterFicha(id)).pagamentos.filter((p) => p.tipo === 'recebimento').map((p) => [p.meio, p.valor, p.rotulo])
    expect(await linhas(primeira)).toEqual([['dinheiro', 4000, null]])
    expect(await linhas(segunda)).toEqual([['dinheiro', 1000, null], ['cartao', 2000, 'Cartão débito · Sicoob']])
  })

  it('[R-NOTINHA-05] em dinheiro a data é hoje; Pix e cartão aceitam data passada, mas não antes da venda', async () => {
    const api = abrir('vazia')
    const { joao, ana, primeira, segunda } = await loja(api)
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'dinheiro', valor: 1000 }], { dia: '2026-10-26' }), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.dinheiroHoje))
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 500 }, { meio: 'dinheiro', valor: 500 }], { dia: '2026-10-26' }), joao))
      .toEqual(recusa(MENSAGENS_RECEBIMENTO.dinheiroHoje))
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 1000 }], { dia: '2026-10-28' }), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.futuro))
    // O Pix de 22/10 cobre só a primeira (de 20/10); se passasse para a de 24/10, seria antes da venda dela.
    expect(await api.receberNotinhas(receber([primeira, segunda], [{ meio: 'pix', valor: 4500 }], { dia: '2026-10-22' }), joao))
      .toEqual(recusa(MENSAGENS_RECEBIMENTO.antesDaVenda('2026-10-24')))
    dado(await api.receberNotinhas(receber([primeira, segunda], [{ meio: 'pix', valor: 4000 }], { dia: '2026-10-22' }), joao))
    expect(dado(await api.obterFicha(primeira)).pagamentos.at(-1)).toMatchObject({ meio: 'pix', dia: '2026-10-22' })
    expect(dado(await api.listarNotinhasAbertas(ana)).notinhas.map((n) => n.id)).toEqual([segunda])
  })

  it('[R-CLIENTE-06] os bloqueios: nada grava', async () => {
    const api = abrir('vazia')
    const { joao, ana, primeira, segunda, quitada, cancelada, daBia } = await loja(api)
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 4001 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.acima('R$ 40,00')))
    expect(await api.receberNotinhas(receber([primeira, daBia], [{ meio: 'pix', valor: 1000 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.outroCliente))
    expect(await api.receberNotinhas(receber([quitada], [{ meio: 'pix', valor: 100 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.naoAberta))
    expect(await api.receberNotinhas(receber([cancelada], [{ meio: 'pix', valor: 100 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.naoAberta))
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 0 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.valor))
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 100 }, { meio: 'pix', valor: 100 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.meioRepetido))
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'dinheiro', valor: 1000 }], { recebido: 500 }), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.entregue))
    expect(await api.receberNotinhas(receber([], [{ meio: 'pix', valor: 100 }]), joao)).toEqual(recusa(MENSAGENS_RECEBIMENTO.semNotinha))
    expect(await api.receberNotinhas(receber(['nao-existe'], [{ meio: 'pix', valor: 100 }]), joao)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 100 }]), { ...joao, pin: '0000' })).toEqual(recusa(MENSAGENS.pinErrado))
    expect(await api.receberNotinhas(receber([primeira], [{ meio: 'pix', valor: 100 }]), null as never)).toEqual(recusa(MENSAGENS_PRODUTO.semAssinatura))
    expect(dado(await api.listarNotinhasAbertas(ana)).notinhas.map((n) => [n.id, n.emAberto])).toEqual([[primeira, 4000], [segunda, 3000]])
  })

  it('na semente: as notinhas abertas de cada cliente somam o em aberto da lista', async () => {
    const api = abrir('semente')
    for (const c of dado(await api.listarClientes('todos', '', 1, 100)).clientes) {
      const r = dado(await api.listarNotinhasAbertas(c.id))
      expect(r.notinhas.reduce((t, n) => t + n.emAberto, 0), c.nome).toBe(c.emAberto)
    }
  })
})
