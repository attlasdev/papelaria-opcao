import { describe, expect, it } from 'vitest'
import { criarMaquininhaDemonstracao, TEMPOS } from '../../comum/maquininha-demonstracao'

function montar() {
  let t = 0
  const m = criarMaquininhaDemonstracao(() => t)
  return { m, passar: (ms: number) => { t += ms } }
}

const dados = { valor: 2490, meio: 'credito' as const, referencia: 'ficha-teste' }

describe('maquininha de demonstração', () => {
  it('enviando → na maquininha → aprovada, com bandeira', () => {
    const { m, passar } = montar()
    const c = m.iniciar(dados)
    expect(c).toMatchObject({ ok: true, dado: { situacao: 'enviando', demonstracao: true, valor: 2490 } })
    const id = c.ok ? c.dado.id : ''
    passar(TEMPOS.envio)
    expect(m.consultar(id)).toMatchObject({ dado: { situacao: 'na-maquininha' } })
    passar(TEMPOS.pagamento.credito)
    expect(m.consultar(id)).toMatchObject({ dado: { situacao: 'aprovada', bandeira: 'Visa' } })
  })

  it('Pix aprova sem bandeira', () => {
    const { m, passar } = montar()
    const c = m.iniciar({ ...dados, meio: 'pix' })
    passar(TEMPOS.pagamento.pix)
    expect(m.consultar(c.ok ? c.dado.id : '')).toMatchObject({ dado: { situacao: 'aprovada', bandeira: undefined } })
  })

  it('uma cobrança aberta por vez; cancelar libera a maquininha', () => {
    const { m } = montar()
    const a = m.iniciar(dados)
    expect(m.iniciar(dados)).toMatchObject({ ok: false, causa: 'conflito' })
    expect(m.cancelar(a.ok ? a.dado.id : '')).toMatchObject({ dado: { situacao: 'cancelada' } })
    expect(m.iniciar(dados).ok).toBe(true)
  })

  it('simular recusa termina na hora, com motivo; depois do fim não se simula mais', () => {
    const { m } = montar()
    const a = m.iniciar(dados)
    const id = a.ok ? a.dado.id : ''
    expect(m.simular(id, 'recusada')).toMatchObject({ dado: { situacao: 'recusada', motivo: 'Saldo insuficiente no cartão.' } })
    expect(m.simular(id, 'aprovada')).toMatchObject({ ok: false, causa: 'validacao' })
    expect(m.iniciar(dados).ok).toBe(true)
  })

  it('recusa valor inválido e cobrança desconhecida', () => {
    const { m } = montar()
    expect(m.iniciar({ ...dados, valor: 0 })).toMatchObject({ ok: false, causa: 'validacao' })
    expect(m.consultar('nada')).toMatchObject({ ok: false, causa: 'nao-encontrado' })
  })
})
