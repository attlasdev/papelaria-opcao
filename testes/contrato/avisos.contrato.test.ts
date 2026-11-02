/**
 * Sino (1.0, tela 8.2): os mesmos cenários no mock (base da demonstração) e no
 * SQLite. Regras em Memoria.md, "Início e sino". Hoje é 27/10; as notinhas
 * vencidas nascem no começo do mês, com o relógio voltado.
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, Aviso, DadosCliente, DadosProduto } from '../../comum/contrato'
import { criarTentativas } from '../../comum/regras/operador'
import { ajustesSqlite } from '../../electron/banco/ajustes'
import { avisosSqlite } from '../../electron/banco/avisos'
import type { Banco } from '../../electron/banco/banco'
import { boletosSqlite } from '../../electron/banco/boletos'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { inicioSqlite } from '../../electron/banco/inicio'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { recebimentosSqlite } from '../../electron/banco/recebimentos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarAjustesDaBase, type OperacoesAjuste } from '../../src/mock/operacoes/ajustes'
import { criarAvisosDaBase, type OperacoesAvisos } from '../../src/mock/operacoes/avisos'
import { criarBoletosDaBase, type OperacoesBoleto } from '../../src/mock/operacoes/boletos'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarInicioDaBase, type OperacoesInicio } from '../../src/mock/operacoes/inicio'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarRecebimentosDaBase, type OperacoesRecebimento } from '../../src/mock/operacoes/recebimentos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesRecebimento
  & OperacoesBoleto & OperacoesInicio & OperacoesAvisos & OperacoesAjuste

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t),
    ...criarRecebimentosDaBase(t), ...criarBoletosDaBase(t), ...criarInicioDaBase(), ...criarAvisosDaBase(), ...criarAjustesDaBase(t),
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...vendasSqlite(() => banco, t),
    ...fichasSqlite(() => banco, t), ...recebimentosSqlite(() => banco, t), ...boletosSqlite(() => banco, t), ...inicioSqlite(() => banco),
    ...avisosSqlite(() => banco), ...ajustesSqlite(() => banco, t),
  }
}

const PRODUTO: DadosProduto = {
  codigoBarras: null, descricao: 'Caderno', categoria: 'Escolar', unidade: 'un', preco: 500, custo: null, minimo: 0,
  localizacao: null, marca: null, caracteristicas: null, descricaoAdicional: null, conteudo: null, ncm: null, cest: null,
}
const cliente = (nome: string): DadosCliente => ({
  nome, documento: null, telefone: null, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
})

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/**
 * Hoje é 27/10.
 *   Bia   notinha de R$ 5 que vence hoje                  (vencendo)
 *   Ana   notinha de R$ 20 vencida em 20/10                 (atraso)
 *         notinha de R$ 10 que vence em 29/10               (vencendo)
 *   Caio  notinha que vence em 30/10, daqui a 3 dias        (vencendo: o limite)
 *   Gil   notinha que vence em 31/10, daqui a 4 dias        (nada)
 *   Davi  notinha vencida, mas paga                         (nada)
 *   Eva   notinha vencida, cancelada pela dona              (nada)
 *   boletos: vencido, vencendo, longe, vencido mas pago, vencido mas excluído
 *   produtos: Cola zerada, Lápis baixo, Caderno normal, Tinta zerada mas desativada
 *   o João cancela uma venda à vista: aguarda a dona
 */
async function umaLoja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto({ ...PRODUTO, minimo: 2 }, 100, dona))
  dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Cola', minimo: 2 }, 0, null))
  const lapis = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Lápis', minimo: 5 }, 1, dona))
  const tinta = dado(await api.cadastrarProduto({ ...PRODUTO, descricao: 'Tinta', minimo: 2 }, 0, null))
  dado(await api.ativarProduto(tinta.id, false))
  const [bia, ana, caio, davi, eva, gil] = await Promise.all(['Bia', 'Ana', 'Caio', 'Davi', 'Eva', 'Gil'].map(async (n) => dado(await api.cadastrarCliente(cliente(n))).id))
  const notinha = async (clienteId: string, quantidade: number, vencimento: string, dia = HOJE) => {
    vi.setSystemTime(new Date(`${dia}T10:00:00-03:00`))
    const id = dado(await api.concluirFicha({
      clienteId, itens: [{ produtoId: caderno.id, quantidade, precoVisto: 500 }], servicos: [], desconto: 0,
      pagamento: { forma: 'notinha', vencimento, entrada: null },
    }, joao)).id
    vi.setSystemTime(AGORA)
    return id
  }
  await notinha(bia, 1, HOJE)
  await notinha(ana, 4, '2026-10-20', '2026-10-01')
  await notinha(ana, 2, '2026-10-29')
  await notinha(caio, 1, '2026-10-30')
  await notinha(gil, 1, '2026-10-31')
  const paga = await notinha(davi, 1, '2026-10-20', '2026-10-01')
  dado(await api.receberNotinhas({ notinhas: [paga], dia: HOJE, parcelas: [{ meio: 'pix', valor: 500 }], cartao: null, recebido: null }, joao))
  const cancelada = await notinha(eva, 1, '2026-10-20', '2026-10-01')
  dado(await api.cancelarFicha(cancelada, 'Lançada errado', dona))

  const boleto = async (descricao: string, vencimento: string) =>
    dado(await api.cadastrarBoleto({ descricao, valor: 10000, numero: descricao, vencimento })).id
  await boleto('Luz', '2026-10-20')
  await boleto('Água', '2026-10-30')
  await boleto('Aluguel', '2026-11-20')
  dado(await api.marcarBoletoPago(await boleto('Internet', '2026-10-15'), joao))
  dado(await api.excluirBoleto(await boleto('Telefone', '2026-10-10'), 'Cadastrado em dobro', joao))

  const avulsa = dado(await api.concluirFicha({
    clienteId: null, itens: [{ produtoId: caderno.id, quantidade: 1, precoVisto: 500 }], servicos: [], desconto: 0,
    pagamento: { forma: 'pix', maquininha: null },
  }, joao)).id
  dado(await api.cancelarFicha(avulsa, 'Cliente desistiu', joao))
  return { dona, joao, ana, bia, caio, lapis, caderno, avulsa }
}

const texto = (a: Aviso) => [a.tipo, a.tom, a.titulo, a.detalhe.replace(/\s/g, ' ')]
const avisos = async (api: Api) => dado(await api.listarAvisos())

testarContrato('sino', { mock, sqlite }, (abrir) => {
  it('[R-INICIO-05] do mais grave ao menos grave: atrasos, zerados, o que vence, estoque baixo e o que aguarda a dona', async () => {
    const api = abrir('vazia')
    const { ana, bia, caio } = await umaLoja(api)
    const r = await avisos(api)
    expect(r.map(texto)).toEqual([
      ['atraso', 'critico', 'Ana', '1 notinha em atraso · R$ 20,00'],
      ['boleto-vencido', 'critico', '1 boleto vencido', 'Luz · R$ 100,00'],
      ['estoque-zerado', 'critico', '1 produto zerado', 'Cola'],
      ['vencendo', 'atencao', 'Ana', 'Notinha vence em 2 dias · R$ 10,00'],
      ['vencendo', 'atencao', 'Bia', 'Notinha vence hoje · R$ 5,00'],
      ['vencendo', 'atencao', 'Caio', 'Notinha vence em 3 dias · R$ 5,00'],
      ['boleto-vencendo', 'atencao', '1 boleto vence em breve', 'Água · vence em 3 dias · R$ 100,00'],
      ['estoque-baixo', 'atencao', '1 produto com estoque baixo', 'Lápis'],
      ['aguardando-dona', 'atencao', '1 item aguardando a dona', 'A dona confere com o PIN dela'],
    ])
    expect(r.map((a) => a.destino)).toEqual([
      { tela: 'cliente', clienteId: ana }, { tela: 'boletos' }, { tela: 'estoque' }, { tela: 'cliente', clienteId: ana },
      { tela: 'cliente', clienteId: bia }, { tela: 'cliente', clienteId: caio }, { tela: 'boletos' }, { tela: 'estoque' }, { tela: 'aguardando' },
    ])
    expect(r.every((a) => !a.lido)).toBe(true)
    // O cliente com atraso e vencendo tem os dois avisos, com ids diferentes.
    expect(new Set(r.map((a) => a.id)).size).toBe(r.length)
  })

  it('[R-INICIO-05] sem pendência, o sino fica vazio', async () => {
    const api = abrir('vazia')
    expect(await avisos(api)).toEqual([])
  })

  it('[R-INICIO-05] marcar como lido grava o texto de agora; o texto mudou, volta a ser novo', async () => {
    const api = abrir('vazia')
    const { dona, caderno, avulsa } = await umaLoja(api)
    const marcados = dado(await api.marcarAvisosLidos(['estoque-zerado', 'aguardando-dona', 'nao-existe']))
    expect(marcados.filter((a) => a.lido).map((a) => a.id)).toEqual(['estoque-zerado', 'aguardando-dona'])
    expect((await avisos(api)).filter((a) => a.lido).map((a) => a.id)).toEqual(['estoque-zerado', 'aguardando-dona'])
    // Mais um produto zerado: o título muda e o aviso volta a ser novo.
    dado(await api.ajustarEstoque({ produtoId: caderno.id, contagem: 0, saldoVisto: (dado(await api.obterProduto(caderno.id))).saldo, motivo: 'Acabou' }, dona))
    const depois = await avisos(api)
    expect(depois.find((a) => a.id === 'estoque-zerado')).toMatchObject({ titulo: '2 produtos zerados', lido: false })
    expect(depois.find((a) => a.id === 'aguardando-dona')?.lido).toBe(true)
    // A dona confere: o aviso some.
    dado(await api.conferirCancelamento(avulsa, dona))
    expect((await avisos(api)).some((a) => a.id === 'aguardando-dona')).toBe(false)
  })

  it('[R-INICIO-05] o pedido fora do formato é recusado', async () => {
    const api = abrir('vazia')
    expect(await api.marcarAvisosLidos('estoque-zerado' as never)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(await api.marcarAvisosLidos([1] as never)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(dado(await api.marcarAvisosLidos([]))).toEqual([])
  })

  it('[R-INICIO-06] o aviso conta o mesmo que a lista do Início', async () => {
    const api = abrir('semente')
    const aguardando = dado(await api.listarAguardandoDona()).length
    const aviso = (await avisos(api)).find((a) => a.id === 'aguardando-dona')
    expect(aviso?.titulo).toBe(aguardando ? `${aguardando} ${aguardando === 1 ? 'item aguardando' : 'itens aguardando'} a dona` : undefined)
  })
})
