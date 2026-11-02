/**
 * Caixa (1.0, tela 7.1): os mesmos cenários no mock (base da demonstração) e no
 * SQLite. Regras em Memoria.md, "Caixa". O dinheiro entra pelas vendas e pelo
 * receber; o relógio do cenário anda alguns minutos entre um gesto e outro, para
 * a ordem dos movimentos e dos caixas ficar clara.
 */
import { expect, it, vi } from 'vitest'
import type { Assinatura, DadosCliente, DadosProduto, PagamentoVenda } from '../../comum/contrato'
import { MENSAGENS_CAIXA } from '../../comum/regras/caixa'
import { criarTentativas, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from '../../electron/banco/banco'
import { caixaSqlite } from '../../electron/banco/caixa'
import { clientesSqlite } from '../../electron/banco/clientes'
import { fichasSqlite } from '../../electron/banco/fichas'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { produtosSqlite } from '../../electron/banco/produtos'
import { recebimentosSqlite } from '../../electron/banco/recebimentos'
import { vendasSqlite } from '../../electron/banco/vendas'
import { criarCaixaDaBase, type OperacoesCaixa } from '../../src/mock/operacoes/caixa'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { criarFichasDaBase, type OperacoesFicha } from '../../src/mock/operacoes/fichas'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { criarProdutosDaBase, type OperacoesProduto } from '../../src/mock/operacoes/produtos'
import { criarRecebimentosDaBase, type OperacoesRecebimento } from '../../src/mock/operacoes/recebimentos'
import { criarVendasDaBase, type OperacoesVenda } from '../../src/mock/operacoes/vendas'
import { AGORA, HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesProduto & OperacoesCliente & OperacoesVenda & OperacoesFicha & OperacoesRecebimento & OperacoesCaixa

const mock = (): Api => {
  const t = criarTentativas()
  return {
    ...criarOperadoresDaBase(t), ...criarProdutosDaBase(t), ...criarClientesDaBase(), ...criarVendasDaBase(t), ...criarFichasDaBase(t),
    ...criarRecebimentosDaBase(t), ...criarCaixaDaBase(t),
  }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return {
    ...operadoresSqlite(() => banco, t), ...produtosSqlite(() => banco, t), ...clientesSqlite(() => banco), ...vendasSqlite(() => banco, t),
    ...fichasSqlite(() => banco, t), ...recebimentosSqlite(() => banco, t), ...caixaSqlite(() => banco, t),
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

/** O relógio anda: cada gesto um minuto depois do anterior, a partir das 15h de hoje. */
function relogio() {
  let minuto = 0
  return () => vi.setSystemTime(new Date(AGORA.getTime() + ++minuto * 60_000))
}

async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const caderno = dado(await api.cadastrarProduto(PRODUTO, 100, dona))
  const ana = dado(await api.cadastrarCliente(CLIENTE)).id
  const anda = relogio()
  const vender = async (quantidade: number, pagamento: PagamentoVenda, clienteId: string | null = null) => {
    anda()
    return dado(await api.concluirFicha({ clienteId, itens: [{ produtoId: caderno.id, quantidade, precoVisto: 500 }], servicos: [], desconto: 0, pagamento }, joao)).id
  }
  return { dona, joao, ana, anda, vender }
}

/**
 * Um dia de caixa, aberto com R$ 100 pelo João:
 *   + 25  venda em dinheiro (5 cadernos)          que depois é cancelada (- 25)
 *   (Pix de R$ 10: não entra)
 *   + 5   parte em dinheiro de um misto
 *   + 10  entrada em dinheiro de uma notinha de R$ 50
 *   + 10  recebimento em dinheiro dessa notinha  que depois é estornado (- 10)
 *   + 50  adição de troco
 *   - 30  retirada para o cofre
 * Esperado: 100 + 25 + 5 + 10 + 10 - 25 - 10 + 50 - 30 = 135.
 */
async function umDia(api: Api) {
  const l = await loja(api)
  l.anda()
  const caixa = dado(await api.abrirCaixa(10000, l.joao))
  const avista = await l.vender(5, { forma: 'dinheiro', recebido: 3000 })
  await l.vender(2, { forma: 'pix', maquininha: null })
  await l.vender(3, { forma: 'misto', parcelas: [{ meio: 'dinheiro', valor: 500 }, { meio: 'cartao', valor: 1000 }], recebido: 500, cartao: { cartao: 'debito' } })
  const notinha = await l.vender(10, { forma: 'notinha', vencimento: '2026-11-26', entrada: { meio: 'dinheiro', valor: 1000 } }, l.ana)
  l.anda()
  dado(await api.receberNotinhas({ notinhas: [notinha], dia: HOJE, parcelas: [{ meio: 'dinheiro', valor: 1000 }], cartao: null, recebido: null }, l.joao))
  const recebido = dado(await api.obterFicha(notinha)).pagamentos.find((p) => p.tipo === 'recebimento')!
  l.anda()
  dado(await api.estornarRecebimento(recebido.id, 'Valor errado', l.joao))
  l.anda()
  dado(await api.cancelarFicha(avista, 'Cliente desistiu', l.joao))
  l.anda()
  dado(await api.movimentarGaveta('adicao', 5000, 'Troco do cofre', l.joao))
  l.anda()
  dado(await api.movimentarGaveta('retirada', 3000, 'Cofre', l.joao))
  return { ...l, caixa, avista, notinha }
}

testarContrato('caixa', { mock, sqlite }, (abrir) => {
  it('[R-CAIXA-05] [R-CAIXA-09] sem caixa aberto: abrir pede pessoa e PIN; um aberto por vez', async () => {
    const api = abrir('vazia')
    const { joao } = await loja(api)
    expect(dado(await api.obterCaixaAtual())).toBeNull()
    expect(await api.movimentarGaveta('adicao', 100, 'Troco', joao)).toEqual(recusa(MENSAGENS_CAIXA.semAberto))
    expect(await api.fecharCaixa(0, '', joao)).toEqual(recusa(MENSAGENS_CAIXA.semAberto))
    expect(await api.abrirCaixa(-1, joao)).toEqual(recusa(MENSAGENS_CAIXA.valor))
    expect(await api.abrirCaixa(10000, { ...joao, pin: '0000' })).toEqual(recusa(MENSAGENS.pinErrado))
    expect(await api.abrirCaixa(10000, null as never)).toEqual(recusa(MENSAGENS_PRODUTO.semAssinatura))
    const caixa = dado(await api.abrirCaixa(10000, joao))
    expect(caixa).toMatchObject({ operadorAbertura: 'João', dinheiroAbertura: 10000, fechamento: null, resumo: { entradas: 0, saidas: 0, esperado: 10000 }, movimentos: [] })
    expect(await api.abrirCaixa(5000, joao)).toEqual(recusa(MENSAGENS_CAIXA.jaAberto))
    expect(dado(await api.obterCaixaAtual())?.id).toBe(caixa.id)
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
  })

  it('[R-CAIXA-02] [R-CAIXA-03] o esperado: só o dinheiro do caixa, com estornos, cancelamento e a gaveta', async () => {
    const api = abrir('vazia')
    const { caixa, avista, notinha } = await umDia(api)
    const atual = dado(await api.obterCaixaAtual())!
    expect(atual.id).toBe(caixa.id)
    expect(atual.resumo).toEqual({ entradas: 10000, saidas: 6500, esperado: 13500 })
    expect(atual.movimentos.map((m) => [m.tipo, m.valor, m.estornado])).toEqual([
      ['venda', 2500, true], ['venda', 500, false], ['entrada', 1000, false], ['recebimento', 1000, true],
      ['estorno-recebimento', -1000, false], ['cancelamento', -2500, false], ['adicao', 5000, false], ['retirada', -3000, false],
    ])
    const [primeira, , entrada, , estorno, cancelamento, adicao, retirada] = atual.movimentos
    expect(primeira).toMatchObject({ ficha: { id: avista }, operador: 'João', motivo: null })
    expect(primeira.descricao).toMatch(/^Venda da ficha #\d{4}$/)
    expect([entrada.ficha?.id, entrada.descricao]).toEqual([notinha, `Entrada da notinha #${entrada.ficha?.numero}`])
    expect([estorno.motivo, estorno.descricao]).toEqual(['Valor errado', `Estorno do recebimento da notinha #${entrada.ficha?.numero}`])
    expect([cancelamento.motivo, cancelamento.descricao]).toEqual(['Cliente desistiu', `Cancelamento da ficha #${primeira.ficha?.numero}`])
    expect([adicao.descricao, adicao.motivo, retirada.descricao, retirada.motivo]).toEqual(['Dinheiro adicionado', 'Troco do cofre', 'Dinheiro retirado', 'Cofre'])
  })

  it('[R-CAIXA-04] [R-CAIXA-10] fechar grava o esperado; diferença pede motivo e fica aguardando a dona', async () => {
    const api = abrir('vazia')
    const { dona, joao, caixa, anda } = await umDia(api)
    expect(await api.fecharCaixa(13000, '  ', joao)).toEqual(recusa(MENSAGENS_CAIXA.justificativa))
    expect(await api.conferirFechamento(caixa.id, dona)).toEqual(recusa(MENSAGENS_CAIXA.naoFechado))
    anda()
    const fechado = dado(await api.fecharCaixa(13000, ' Troco entregue sem registro ', joao))
    expect(fechado.fechamento).toMatchObject({ operador: 'João', contado: 13000, esperado: 13500, diferenca: -500, justificativa: 'Troco entregue sem registro', conferidoPor: null })
    expect(fechado.resumo.esperado).toBe(13500)
    expect(dado(await api.obterCaixaAtual())).toBeNull()

    expect(await api.conferirFechamento(caixa.id, joao)).toMatchObject({ ok: false, causa: 'permissao' })
    expect(dado(await api.conferirFechamento(caixa.id, dona)).fechamento?.conferidoPor).toBe('Helena')
    expect(dado(await api.conferirFechamento(caixa.id, dona)).fechamento?.conferidoPor).toBe('Helena')

    // Sem diferença, não precisa de visto; o da dona com diferença já nasce conferido.
    anda()
    const segundo = dado(await api.abrirCaixa(5000, joao))
    anda()
    expect(dado(await api.fecharCaixa(5000, 'ignorado', joao)).fechamento).toMatchObject({ diferenca: 0, justificativa: null, conferidoPor: null })
    expect(await api.conferirFechamento(segundo.id, dona)).toEqual(recusa(MENSAGENS_CAIXA.semDiferenca))
    anda()
    dado(await api.abrirCaixa(5000, joao))
    anda()
    expect(dado(await api.fecharCaixa(5500, 'Sobrou', dona)).fechamento).toMatchObject({ diferenca: 500, operador: 'Helena', conferidoPor: 'Helena' })
  })

  it('[R-CAIXA-02] cancelar a ficha não tira de novo o recebimento já estornado', async () => {
    const api = abrir('vazia')
    const { joao, ana, anda, vender } = await loja(api)
    anda()
    dado(await api.abrirCaixa(0, joao))
    const notinha = await vender(10, { forma: 'notinha', vencimento: '2026-11-26', entrada: { meio: 'dinheiro', valor: 1000 } }, ana)
    anda()
    dado(await api.receberNotinhas({ notinhas: [notinha], dia: HOJE, parcelas: [{ meio: 'dinheiro', valor: 1000 }], cartao: null, recebido: null }, joao))
    anda()
    dado(await api.estornarRecebimento(dado(await api.obterFicha(notinha)).pagamentos.find((p) => p.tipo === 'recebimento')!.id, 'Errado', joao))
    anda()
    dado(await api.cancelarFicha(notinha, 'Venda errada', joao))
    const atual = dado(await api.obterCaixaAtual())!
    expect(atual.movimentos.map((m) => [m.tipo, m.valor])).toEqual([['entrada', 1000], ['recebimento', 1000], ['estorno-recebimento', -1000], ['cancelamento', -1000]])
    expect(atual.resumo.esperado).toBe(0)
  })

  it('[R-CAIXA-06] adicionar e retirar pedem valor, motivo e PIN', async () => {
    const api = abrir('vazia')
    const { joao, anda } = await loja(api)
    anda()
    dado(await api.abrirCaixa(1000, joao))
    expect(await api.movimentarGaveta('adicao', 0, 'Troco', joao)).toEqual(recusa(MENSAGENS_CAIXA.valorMovimento))
    expect(await api.movimentarGaveta('retirada', 500, '  ', joao)).toEqual(recusa(MENSAGENS_CAIXA.motivo))
    expect(await api.movimentarGaveta('retirada', 500, 'Cofre', { ...joao, pin: '0000' })).toEqual(recusa(MENSAGENS.pinErrado))
    anda()
    expect(dado(await api.movimentarGaveta('retirada', 500, 'Cofre', joao)).resumo.esperado).toBe(500)
  })

  it('[R-CAIXA-07] [R-CAIXA-08] o histórico: caixas pelo fechamento (o aberto pela abertura), e as adições e retiradas', async () => {
    const api = abrir('vazia')
    const { joao, caixa, anda } = await umDia(api)
    anda()
    dado(await api.fecharCaixa(13500, '', joao))
    anda()
    const segundo = dado(await api.abrirCaixa(13500, joao))
    const hoje = { de: HOJE, ate: HOJE }
    const r = dado(await api.listarCaixas(hoje, false, 1, 10))
    expect(r.caixas.map((c) => [c.id, Boolean(c.fechamento)])).toEqual([[segundo.id, false], [caixa.id, true]])
    expect(dado(await api.listarCaixas(hoje, true, 1, 10)).caixas.map((c) => c.id)).toEqual([caixa.id])
    expect(dado(await api.listarCaixas({ de: '2026-10-20', ate: '2026-10-26' }, false, 1, 10)).total).toBe(0)
    const gaveta = dado(await api.listarMovimentosGaveta(hoje, 1, 10))
    expect(gaveta.movimentos.map((m) => [m.tipo, m.valor, m.motivo, m.caixaId])).toEqual([['retirada', -3000, 'Cofre', caixa.id], ['adicao', 5000, 'Troco do cofre', caixa.id]])
    expect(dado(await api.obterCaixa(caixa.id)).movimentos).toHaveLength(8)
    expect(await api.obterCaixa('nao-existe')).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect(await api.listarCaixas({ de: HOJE, ate: '2026-10-28' }, false, 1, 10)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(await api.listarCaixas(hoje, false, 1, 101)).toMatchObject({ ok: false, causa: 'validacao' })
  })

  it('[R-CAIXA-08] o caixa aberto num dia e fechado no outro conta no dia do fechamento', async () => {
    const api = abrir('vazia')
    const { joao } = await loja(api)
    vi.setSystemTime(new Date('2026-10-26T22:00:00-03:00'))
    const noite = dado(await api.abrirCaixa(1000, joao))
    vi.setSystemTime(new Date('2026-10-27T08:00:00-03:00'))
    dado(await api.fecharCaixa(1000, '', joao))
    vi.setSystemTime(AGORA)
    expect(dado(await api.listarCaixas({ de: '2026-10-26', ate: '2026-10-26' }, false, 1, 10)).total).toBe(0)
    expect(dado(await api.listarCaixas({ de: HOJE, ate: HOJE }, true, 1, 10)).caixas.map((c) => c.id)).toEqual([noite.id])
  })

  it('na semente: em cada caixa fechado, abertura + entradas - saídas dá o esperado gravado', async () => {
    const api = abrir('semente')
    const r = dado(await api.listarCaixas({ de: '2026-07-01', ate: HOJE }, true, 1, 100))
    for (const c of r.caixas) {
      const d = dado(await api.obterCaixa(c.id))
      expect(d.dinheiroAbertura + d.resumo.entradas - d.resumo.saidas, c.abertoEm).toBe(c.fechamento!.esperado)
    }
  })
})
