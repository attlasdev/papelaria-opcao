import { describe, expect, it } from 'vitest'
import { falha, type Assinatura, type Falha } from '../../comum/contrato'
import { autorizar, conferirAssinatura, criarTentativas, MENSAGENS, type PessoaParaConferir } from '../../comum/regras/operador'

/** Pessoa de mentira com PIN 1234. */
const pessoa = (extra: Partial<PessoaParaConferir> = {}): PessoaParaConferir =>
  ({ ativo: true, admin: false, temPin: true, confere: (pin) => pin === '1234', ...extra })

const conferir = (p: PessoaParaConferir | null, pin = '1234', opcoes?: { soAdmin?: boolean }) =>
  conferirAssinatura({ operadorId: 'x', pin }, () => p, criarTentativas(), opcoes)

describe('assinatura de quem está fazendo', () => {
  it('[R-OPERADOR-02] pessoa ativa com o PIN certo assina; PIN errado não', async () => {
    expect(await conferir(pessoa())).toBeNull()
    expect(await conferir(pessoa(), '4321')).toEqual({ ok: false, causa: 'validacao', erro: MENSAGENS.pinErrado })
  })

  it('[R-OPERADOR-07] desativada não assina nem autoriza, mesmo com o PIN certo', async () => {
    expect(await conferir(pessoa({ ativo: false }))).toMatchObject({ causa: 'validacao', erro: MENSAGENS.inativo })
    expect(await conferir(pessoa({ ativo: false, admin: true }), '1234', { soAdmin: true })).toMatchObject({ erro: MENSAGENS.inativo })
  })

  it('[R-OPERADOR-01] sem PIN (de antes da 0002) não assina até a dona definir um', async () => {
    expect(await conferir(pessoa({ temPin: false }))).toMatchObject({ causa: 'validacao', erro: MENSAGENS.semPin })
  })

  it('[R-OPERADOR-03] gesto da dona recusa outra pessoa antes de olhar o PIN', async () => {
    let olhou = false
    const outra = pessoa({ confere: () => { olhou = true; return true } })
    expect(await conferir(outra, '1234', { soAdmin: true })).toMatchObject({ causa: 'permissao' })
    expect(olhou).toBe(false)
  })

  it('[R-OPERADOR-04] a espera é por pessoa', async () => {
    let agora = 0
    const tentativas = criarTentativas(() => agora)
    for (let i = 0; i < 5; i++) tentativas.errou('a')
    expect(tentativas.bloqueio('a')).toBe(MENSAGENS.espera(30))
    expect(tentativas.bloqueio('b')).toBeNull()
    agora = 30_000
    expect(tentativas.bloqueio('a')).toBeNull()
  })
})

describe('gesto sensível com o PIN da dona na hora', () => {
  type P = { id: string; admin: boolean }
  const pessoas: Record<string, P & { pin: string }> = {
    dona: { id: 'dona', admin: true, pin: '1234' },
    joao: { id: 'joao', admin: false, pin: '2222' },
  }
  /** Conferência de mentira: PIN certo devolve a pessoa; soAdmin recusa quem não é a dona. */
  const conferir = async (a: Assinatura | null | undefined, { soAdmin = false } = {}): Promise<P | Falha> => {
    const p = a ? pessoas[a.operadorId] : undefined
    if (!p) return falha('nao-encontrado', MENSAGENS.naoEncontrado)
    if (soAdmin && !p.admin) return falha('permissao', MENSAGENS.soAdmin)
    return a!.pin === p.pin ? { id: p.id, admin: p.admin } : falha('validacao', MENSAGENS.pinErrado)
  }
  const joao = { operadorId: 'joao', pin: '2222' }
  const dona = { operadorId: 'dona', pin: '1234' }

  it('[R-OPERADOR-06] quem faz assina e a dona autoriza; se é a dona, um PIN basta', async () => {
    expect(await autorizar(conferir, joao, dona)).toEqual({ quem: { id: 'joao', admin: false }, autorizadoPor: { id: 'dona', admin: true } })
    expect(await autorizar(conferir, dona, null)).toEqual({ quem: { id: 'dona', admin: true }, autorizadoPor: null })
  })

  it('[R-OPERADOR-06] sem a dona, PIN errado dela (dito que é dela) ou outra pessoa no lugar dela', async () => {
    expect(await autorizar(conferir, joao, null)).toEqual(falha('validacao', MENSAGENS.semDona))
    expect(await autorizar(conferir, joao, { ...dona, pin: '0000' })).toEqual(falha('validacao', `Administradora: ${MENSAGENS.pinErrado}`))
    expect(await autorizar(conferir, joao, joao)).toEqual(falha('permissao', MENSAGENS.soAdmin))
    expect(await autorizar(conferir, { ...joao, pin: '0000' }, dona)).toEqual(falha('validacao', MENSAGENS.pinErrado))
  })
})

