/**
 * Boletos (1.0, tela 6.1): os mesmos cenários no mock (base da demonstração)
 * e no SQLite. Regras em Memoria.md, "Boletos"; excluir vira "excluído" (D7).
 */
import { expect, it } from 'vitest'
import type { Assinatura, DadosBoleto, FiltroBoletos } from '../../comum/contrato'
import { MENSAGENS_BOLETO } from '../../comum/regras/boleto'
import { criarTentativas, MENSAGENS } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from '../../electron/banco/banco'
import { boletosSqlite } from '../../electron/banco/boletos'
import { operadoresSqlite } from '../../electron/banco/operadores'
import { criarBoletosDaBase, type OperacoesBoleto } from '../../src/mock/operacoes/boletos'
import { criarOperadoresDaBase, type OperacoesOperador } from '../../src/mock/operacoes/operadores'
import { HOJE, testarContrato } from './estrutura'

type Api = OperacoesOperador & OperacoesBoleto

const mock = (): Api => {
  const t = criarTentativas()
  return { ...criarOperadoresDaBase(t), ...criarBoletosDaBase(t) }
}
const sqlite = (banco: Banco): Api => {
  const t = criarTentativas()
  return { ...operadoresSqlite(() => banco, t), ...boletosSqlite(() => banco, t) }
}

function dado<T>(r: { ok: true; dado: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro)
  return r.dado
}

const recusa = (erro: string) => ({ ok: false, causa: 'validacao', erro })

/**
 * Hoje é 27/10. Quatro boletos:
 *   Nº 7   Luz Energética   R$ 412,37  venceu em 20/10    (vencido)
 *   Nº 12  Tilibra          R$ 980,00  vence em 30/10     (vence em 3 dias)
 *   Nº 12  Aluguel          R$ 1.500   vence em 20/11     (a vencer; número repetido)
 *   Nº 3   Água             R$ 98,00   vence em 01/11     (vence em 5 dias)
 */
async function loja(api: Api) {
  const dona: Assinatura = { operadorId: dado(await api.cadastrarAdministradora('Helena', '1234')).id, pin: '1234' }
  const joao: Assinatura = { operadorId: dado(await api.cadastrarOperador('João', '2222', dona)).id, pin: '2222' }
  const novo = async (d: DadosBoleto) => dado(await api.cadastrarBoleto(d)).id
  const luz = await novo({ descricao: 'Luz Energética', valor: 41237, numero: '7', vencimento: '2026-10-20' })
  const tilibra = await novo({ descricao: 'Tilibra · NF 4821', valor: 98000, numero: '12', vencimento: '2026-10-30' })
  const aluguel = await novo({ descricao: 'Aluguel', valor: 150000, numero: ' 12 ', vencimento: '2026-11-20' })
  const agua = await novo({ descricao: 'Água', valor: 9800, numero: '3', vencimento: '2026-11-01' })
  return { dona, joao, luz, tilibra, aluguel, agua }
}

const lista = async (api: Api, filtro: FiltroBoletos = 'todos', busca = '') => dado(await api.listarBoletos(filtro, busca))

testarContrato('boletos', { mock, sqlite }, (abrir) => {
  it('[R-BOLETO-01] [R-BOLETO-02] cadastrar e editar: sem PIN; número repetido aceito; o cadastro não muda ao editar', async () => {
    const api = abrir('vazia')
    const { aluguel } = await loja(api)
    const antes = dado(await api.editarBoleto(aluguel, { descricao: ' Aluguel  novembro ', valor: 160000, numero: '12', vencimento: '2026-11-21' }))
    expect(antes).toMatchObject({ descricao: 'Aluguel novembro', valor: 160000, numero: '12', vencimento: '2026-11-21', situacao: 'a-vencer', dias: 25, pago: null })
    expect(antes.cadastradoEm).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/)
    const base: DadosBoleto = { descricao: 'X', valor: 100, numero: '1', vencimento: HOJE }
    expect(await api.cadastrarBoleto({ ...base, descricao: '  ' })).toEqual(recusa(MENSAGENS_BOLETO.descricao))
    expect(await api.cadastrarBoleto({ ...base, valor: 0 })).toEqual(recusa(MENSAGENS_BOLETO.valor))
    expect(await api.cadastrarBoleto({ ...base, numero: '' })).toEqual(recusa(MENSAGENS_BOLETO.numero))
    expect(await api.cadastrarBoleto({ ...base, vencimento: '2026-02-30' })).toEqual(recusa(MENSAGENS_BOLETO.vencimento))
    expect(await api.editarBoleto('nao-existe', base)).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })

  it('[R-BOLETO-06] a lista: em aberto pelo vencimento, pagos depois; cartões, abas e busca sem acento', async () => {
    const api = abrir('vazia')
    const { joao, luz, tilibra, aluguel, agua } = await loja(api)
    dado(await api.marcarBoletoPago(agua, joao))
    const r = await lista(api)
    expect(r.boletos.map((b) => [b.id, b.situacao, b.dias])).toEqual([
      [luz, 'vencido', -7], [tilibra, 'vencendo', 3], [aluguel, 'a-vencer', 24], [agua, 'pago', 5],
    ])
    expect(r.resumo).toEqual({
      vencidos: { quantidade: 1, valor: 41237 }, vencendo: { quantidade: 1, valor: 98000 }, aPagar: { quantidade: 3, valor: 289237 },
    })
    expect(r.contagem).toEqual({ 'a-pagar': 3, vencidos: 1, pagos: 1, todos: 4 })
    expect((await lista(api, 'a-pagar')).boletos.map((b) => b.id)).toEqual([luz, tilibra, aluguel])
    expect((await lista(api, 'vencidos')).boletos.map((b) => b.id)).toEqual([luz])
    expect((await lista(api, 'pagos')).boletos.map((b) => b.id)).toEqual([agua])
    expect((await lista(api, 'todos', 'AGUA')).boletos.map((b) => b.id)).toEqual([agua])
    expect((await lista(api, 'todos', '12')).boletos.map((b) => b.id)).toEqual([tilibra, aluguel])
    // A busca não muda os cartões nem as abas.
    expect((await lista(api, 'pagos', 'luz')).contagem).toEqual(r.contagem)
    expect(await api.listarBoletos('atrasados' as FiltroBoletos, '')).toMatchObject({ ok: false, causa: 'validacao' })
  })

  it('[R-BOLETO-03] pagar grava hoje e quem marcou, com PIN; desfazer pede motivo e PIN', async () => {
    const api = abrir('vazia')
    const { dona, joao, luz } = await loja(api)
    expect(await api.marcarBoletoPago(luz, { ...joao, pin: '0000' })).toEqual(recusa(MENSAGENS.pinErrado))
    expect(await api.marcarBoletoPago(luz, null as never)).toEqual(recusa(MENSAGENS_PRODUTO.semAssinatura))
    expect(await api.desfazerPagamentoBoleto(luz, 'Errado', joao)).toEqual(recusa(MENSAGENS_BOLETO.naoPago))
    expect(dado(await api.marcarBoletoPago(luz, joao))).toMatchObject({ situacao: 'pago', pago: { dia: HOJE, operador: 'João' } })
    expect(dado(await api.listarOperadores()).ultimoId).toBe(joao.operadorId)
    expect(await api.marcarBoletoPago(luz, joao)).toEqual(recusa(MENSAGENS_BOLETO.jaPago))
    expect(await api.desfazerPagamentoBoleto(luz, '  ', dona)).toEqual(recusa(MENSAGENS_BOLETO.motivo))
    expect(dado(await api.desfazerPagamentoBoleto(luz, 'Marcado no boleto errado', dona))).toMatchObject({ situacao: 'vencido', pago: null })
    expect(dado(await api.listarOperadores()).ultimoId).toBe(dona.operadorId)
    // Pagar de novo depois de desfazer vale.
    expect(dado(await api.marcarBoletoPago(luz, dona)).pago).toMatchObject({ operador: 'Helena' })
  })

  it('[R-BOLETO-06] excluir pede motivo e PIN; o excluído sai da lista, das abas e dos gestos', async () => {
    const api = abrir('vazia')
    const { joao, luz, tilibra } = await loja(api)
    expect(await api.excluirBoleto(tilibra, '', joao)).toEqual(recusa(MENSAGENS_BOLETO.motivo))
    expect(await api.excluirBoleto(tilibra, 'Cadastrado em dobro', { ...joao, pin: '0000' })).toEqual(recusa(MENSAGENS.pinErrado))
    expect((await lista(api)).contagem.todos).toBe(4)
    expect(dado(await api.excluirBoleto(tilibra, 'Cadastrado em dobro', joao))).toBeNull()
    const r = await lista(api)
    expect([r.contagem, r.resumo.vencendo.quantidade]).toEqual([{ 'a-pagar': 3, vencidos: 1, pagos: 0, todos: 3 }, 1])
    expect(r.boletos.some((b) => b.id === tilibra)).toBe(false)
    for (const gesto of [
      api.editarBoleto(tilibra, { descricao: 'X', valor: 1, numero: '1', vencimento: HOJE }),
      api.marcarBoletoPago(tilibra, joao),
      api.excluirBoleto(tilibra, 'De novo', joao),
    ]) expect(await gesto).toMatchObject({ ok: false, causa: 'nao-encontrado' })
    expect((await lista(api, 'vencidos')).boletos.map((b) => b.id)).toEqual([luz])
  })

  it('na semente: o excluído não aparece, e o pago e desfeito está em aberto', async () => {
    const api = abrir('semente')
    const r = await lista(api)
    expect(r.contagem.todos).toBe(r.boletos.length)
    expect(r.boletos.every((b) => (b.situacao === 'pago') === Boolean(b.pago))).toBe(true)
    expect(r.contagem['a-pagar'] + r.contagem.pagos).toBe(r.contagem.todos)
  })
})
