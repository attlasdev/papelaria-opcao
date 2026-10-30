/**
 * Lista de Clientes e compras do cliente (1.0, tela 3.2): os mesmos cenários
 * no mock (base da demonstração) e no SQLite. Regras em Memoria.md, "Clientes".
 *
 * Ainda não há operação de venda (tela 4.1): cada lado monta as fichas direto
 * na própria base, só neste teste, como a venda e o recebimento vão gravar.
 */
import { expect, it } from 'vitest'
import type { DadosCliente, FiltroClientes, FormaFicha } from '../../comum/contrato'
import { proximoNumero, type Banco } from '../../electron/banco/banco'
import { clientesSqlite } from '../../electron/banco/clientes'
import type { Ficha } from '../../src/mock/base/tipos'
import { obterBase, proximoNumeroFicha, substituirBase } from '../../src/mock/estado-demonstracao'
import { criarClientesDaBase, type OperacoesCliente } from '../../src/mock/operacoes/clientes'
import { testarContrato } from './estrutura'

type PagamentoTeste = { valor: number; meio?: 'dinheiro' | 'pix' | 'cartao'; rotulo?: string; entrada?: boolean; estornado?: boolean }
type FichaTeste = {
  cliente: string | null; dia: string; horario?: string; total: number; forma: FormaFicha
  vencimento?: string; pagamentos?: PagamentoTeste[]; cancelada?: boolean
}
type Api = OperacoesCliente & { vender(f: FichaTeste): void }

const instante = (dia: string, horario: string) => new Date(`${dia}T${horario}:00-03:00`).toISOString()

const mock = (): Api => ({
  ...criarClientesDaBase(),
  vender({ cliente, dia, horario = '10:00', total, forma, vencimento, pagamentos = [], cancelada }) {
    const base = obterBase()
    const ocorrido = { data: dia, horario, motivo: 'Teste' }
    const ficha: Ficha = {
      id: proximoNumeroFicha(base), clienteId: cliente, data: dia, horario, operador: 'Teste', itens: [], desconto: 0, total, forma, vencimento,
      pagamentos: pagamentos.map((p) => ({
        data: dia, horario, meio: p.meio ?? 'dinheiro', valor: p.valor, entrada: p.entrada, rotulo: p.rotulo, estorno: p.estornado ? ocorrido : undefined,
      })),
      cancelamento: cancelada ? ocorrido : undefined,
    }
    substituirBase({ ...base, fichas: [...base.fichas, ficha] })
  },
})

const sqlite = (banco: Banco): Api => {
  let operador = ''
  const inserir = (tabela: string, linha: Record<string, string | number | null>) =>
    banco.prepare(`insert into ${tabela} (${Object.keys(linha).join(', ')}) values (${Object.keys(linha).map(() => '?').join(', ')})`).run(...Object.values(linha))
  return {
    ...clientesSqlite(() => banco),
    vender({ cliente, dia, horario = '10:00', total, forma, vencimento, pagamentos = [], cancelada }) {
      const quando = instante(dia, horario)
      if (!operador) inserir('operador', { id: (operador = crypto.randomUUID()), nome: 'Teste', pin_hash: 'scrypt$00$00', criado_em: quando })
      const quem = { operador_id: operador, dia, registrado_em: quando }
      const fichaId = crypto.randomUUID()
      inserir('ficha', {
        id: fichaId, numero: proximoNumero(banco, 'ficha'), cliente_id: cliente, forma, subtotal: total, total, vencimento: vencimento ?? null, ...quem,
      })
      for (const p of pagamentos) {
        const tipo = forma !== 'notinha' ? 'venda' : p.entrada ? 'entrada' : 'recebimento'
        const recebimento = tipo === 'recebimento' ? crypto.randomUUID() : null
        if (recebimento) inserir('recebimento', { id: recebimento, cliente_id: cliente, ...quem })
        const id = crypto.randomUUID()
        inserir('pagamento', { id, ficha_id: fichaId, recebimento_id: recebimento, tipo, meio: p.meio ?? 'dinheiro', valor: p.valor, rotulo: p.rotulo ?? null, ...quem })
        if (p.estornado) inserir('pagamento_estorno', { id: crypto.randomUUID(), pagamento_id: id, motivo: 'Teste', ...quem })
      }
      if (cancelada) inserir('ficha_cancelamento', { id: crypto.randomUUID(), ficha_id: fichaId, motivo: 'Teste', ...quem })
    },
  }
}

const VAZIO: DadosCliente = {
  nome: '', documento: null, telefone: null, rua: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, cep: null, fiscal: { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null },
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

/**
 * Seis clientes no dia 27/10, cada um num caso da conta:
 *   Ana     notinha vencida com entrada + notinha a vencer: em atraso (o atraso vence)
 *   Bruno   notinha que vence hoje: a vencer
 *   Caio    notinha quitada + notinha com o recebimento estornado: a vencer
 *   Dora    notinha cancelada + venda no cartão: em dia
 *   Érica   sem compras, com CPF e telefone
 *   Zeca    sem compras (a ordem alfabética põe o "É" antes do "Z")
 * E três vendas sem identificação: duas hoje (uma cancelada) e uma ontem.
 */
async function loja(api: Api) {
  const cadastrar = async (nome: string, mais: Partial<DadosCliente> = {}) => dado(await api.cadastrarCliente({ ...VAZIO, nome, ...mais })).id
  // Fora da ordem alfabética de propósito.
  const zeca = await cadastrar('Zeca Alves')
  const erica = await cadastrar('Érica Nunes', { documento: '529.982.247-25', telefone: '(33) 99999-1234' })
  const caio = await cadastrar('Caio Prado')
  const ana = await cadastrar('Ana Souza')
  const dora = await cadastrar('Dora Reis')
  const bruno = await cadastrar('Bruno Lima')

  api.vender({ cliente: ana, dia: '2026-10-05', total: 10000, forma: 'notinha', vencimento: '2026-10-20', pagamentos: [{ valor: 3000, meio: 'pix', entrada: true }] })
  api.vender({ cliente: ana, dia: '2026-10-25', total: 5000, forma: 'notinha', vencimento: '2026-11-05' })
  api.vender({ cliente: bruno, dia: '2026-10-20', total: 8000, forma: 'notinha', vencimento: '2026-10-27' })
  api.vender({ cliente: caio, dia: '2026-09-15', total: 6000, forma: 'notinha', vencimento: '2026-10-01', pagamentos: [{ valor: 6000 }] })
  api.vender({ cliente: caio, dia: '2026-10-20', total: 4000, forma: 'notinha', vencimento: '2026-11-10', pagamentos: [{ valor: 4000, estornado: true }] })
  api.vender({ cliente: dora, dia: '2026-10-05', total: 9000, forma: 'notinha', vencimento: '2026-10-10', cancelada: true })
  api.vender({ cliente: dora, dia: '2026-10-15', total: 2500, forma: 'cartao', pagamentos: [{ valor: 2500, meio: 'cartao', rotulo: 'Cartão crédito Visa' }] })
  api.vender({ cliente: null, dia: '2026-10-27', horario: '09:00', total: 1200, forma: 'pix', pagamentos: [{ valor: 1200, meio: 'pix' }] })
  api.vender({ cliente: null, dia: '2026-10-27', horario: '09:30', total: 800, forma: 'dinheiro', pagamentos: [{ valor: 800 }], cancelada: true })
  api.vender({ cliente: null, dia: '2026-10-26', total: 500, forma: 'dinheiro', pagamentos: [{ valor: 500 }] })
  return { ana, bruno, caio, dora, erica, zeca }
}

const lista = async (api: Api, filtro: FiltroClientes = 'todos', busca = '', pagina = 1, porPagina = 20) =>
  dado(await api.listarClientes(filtro, busca, pagina, porPagina))
const nomes = async (api: Api, filtro: FiltroClientes = 'todos', busca = '') => (await lista(api, filtro, busca)).clientes.map((c) => c.nome)

testarContrato('lista de clientes', { mock, sqlite }, (abrir) => {
  it('[R-CLIENTE-02] em ordem alfabética, com as compras, o em aberto e a situação de cada um', async () => {
    const api = abrir('vazia')
    await loja(api)
    const r = await lista(api)
    expect(r.clientes.map((c) => [c.nome, c.compras, c.emAberto, c.situacao])).toEqual([
      ['Ana Souza', 2, 12000, 'em-atraso'],
      ['Bruno Lima', 1, 8000, 'a-vencer'],
      ['Caio Prado', 2, 4000, 'a-vencer'],
      ['Dora Reis', 1, 0, 'em-dia'],
      ['Érica Nunes', 0, 0, 'em-dia'],
      ['Zeca Alves', 0, 0, 'em-dia'],
    ])
    expect(r.clientes[4]).toMatchObject({ codigo: 'CLI-0002', documento: '52998224725', telefone: '33999991234' })
    expect([r.total, r.pagina, r.vendasSemIdentificacaoHoje]).toEqual([6, 1, 2])
  })

  it('[R-CLIENTE-01] os cartões contam clientes; quem tem notinha em atraso não conta como a vencer', async () => {
    const api = abrir('vazia')
    await loja(api)
    expect((await lista(api)).resumo).toEqual({ clientes: 6, aVencer: 2, emAtraso: 1 })
    expect(await nomes(api, 'em-atraso')).toEqual(['Ana Souza'])
    expect(await nomes(api, 'a-vencer')).toEqual(['Bruno Lima', 'Caio Prado'])
    // O filtro e a busca não mudam os cartões.
    const filtrada = await lista(api, 'a-vencer', 'bruno')
    expect([filtrada.total, filtrada.resumo]).toEqual([1, { clientes: 6, aVencer: 2, emAtraso: 1 }])
  })

  it('[R-CLIENTE-03] busca sem acento no nome e no código; documento e telefone com ou sem pontuação', async () => {
    const api = abrir('vazia')
    await loja(api)
    for (const termo of ['erica', 'ÉRICA', '  érica   nunes ', 'cli-0002', '52998224725', '529.982.247-25', 'CPF 529982', '99999-1234', '(33) 99999', '33999991234']) {
      expect(await nomes(api, 'todos', termo), termo).toEqual(['Érica Nunes'])
    }
    expect(await nomes(api, 'todos', 'ra')).toEqual(['Caio Prado', 'Dora Reis'])
    // Letra com número não é documento nem telefone.
    expect(await nomes(api, 'todos', 'rua 529')).toEqual([])
    expect(await nomes(api, 'em-atraso', 'erica')).toEqual([])
  })

  it('pagina no back; a página que passou do fim volta a última', async () => {
    const api = abrir('vazia')
    await loja(api)
    expect((await lista(api, 'todos', '', 1, 2)).clientes.map((c) => c.nome)).toEqual(['Ana Souza', 'Bruno Lima'])
    const ultima = await lista(api, 'todos', '', 9, 2)
    expect([ultima.pagina, ultima.total, ultima.clientes.map((c) => c.nome)]).toEqual([3, 6, ['Érica Nunes', 'Zeca Alves']])
    expect(await api.listarClientes('todos', '', 1, 101)).toMatchObject({ ok: false, causa: 'validacao' })
    expect(await api.listarClientes('vencido' as FiltroClientes, '', 1, 10)).toMatchObject({ ok: false, causa: 'validacao' })
    const vazia = await lista(api, 'todos', 'ninguém')
    expect([vazia.total, vazia.pagina, vazia.clientes]).toEqual([0, 1, []])
  })

  it('[R-CLIENTE-02] as compras do cliente, da mais nova para a mais velha; a cancelada fica, mas não é compra', async () => {
    const api = abrir('vazia')
    const { ana, caio, dora, zeca } = await loja(api)
    const compras = async (id: string, pagina = 1, porPagina = 3) => dado(await api.listarComprasDoCliente(id, pagina, porPagina))

    const daAna = await compras(ana)
    expect(daAna.compras.map((c) => [c.total, c.forma, c.situacao, c.emAberto, c.rotulo])).toEqual([
      [5000, 'notinha', 'a-vencer', 5000, null],
      [10000, 'notinha', 'em-atraso', 7000, null],
    ])
    expect(daAna.compras[1].registradoEm).toBe('2026-10-05T13:00:00.000Z')
    expect(daAna.compras[0].numero).toMatch(/^\d{4}$/)

    // Recebimento estornado volta a dever; o que ficou quita.
    expect((await compras(caio)).compras.map((c) => [c.situacao, c.emAberto])).toEqual([['a-vencer', 4000], ['paga', 0]])

    const daDora = await compras(dora)
    expect(daDora.compras.map((c) => [c.forma, c.situacao, c.emAberto, c.rotulo])).toEqual([
      ['cartao', 'paga', 0, 'Cartão crédito Visa'],
      ['notinha', 'cancelada', 0, null],
    ])
    expect([daDora.total, daDora.resumo]).toEqual([2, { compras: 1, totalComprado: 2500 }])

    const segunda = await compras(dora, 2, 1)
    expect([segunda.pagina, segunda.compras.map((c) => c.situacao)]).toEqual([2, ['cancelada']])
    expect(await compras(zeca)).toEqual({ compras: [], total: 0, pagina: 1, resumo: { compras: 0, totalComprado: 0 } })
    expect(await api.listarComprasDoCliente('nao-existe', 1, 3)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect(await api.listarComprasDoCliente(ana, 0, 3)).toMatchObject({ ok: false, causa: 'validacao' })
  })

  it('na semente: todo cliente na lista, e as compras de cada um batem com a contagem', async () => {
    const api = abrir('semente')
    const r = await lista(api, 'todos', '', 1, 100)
    expect(r.total).toBe(r.resumo.clientes)
    expect(r.resumo.aVencer + r.resumo.emAtraso).toBeGreaterThan(0)
    for (const c of r.clientes) {
      const h = dado(await api.listarComprasDoCliente(c.id, 1, 100))
      expect(h.resumo.compras, c.nome).toBe(c.compras)
      expect(h.compras.reduce((soma, x) => soma + x.emAberto, 0), c.nome).toBe(c.emAberto)
    }
  })
})
