import { describe, expect, it } from 'vitest'
import { conferirAssinatura, criarTentativas, MENSAGENS, type PessoaParaConferir } from '../../comum/regras/operador'

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
