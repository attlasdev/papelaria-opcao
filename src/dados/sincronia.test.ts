import { describe, expect, it } from 'vitest'
import { falha, ok, type CausaFalha, type DocumentoBase } from '../../comum/contrato'
import { criarBaseVazia, criarSemente } from '../mock/base/semente'
import type { Base } from '../mock/base/tipos'
import { criarSincronia, decidirInicio, type Dependencias } from './sincronia'

const HOJE = '2026-10-06'
const vazia = () => criarBaseVazia(HOJE)
const cheia = () => criarSemente(HOJE, 10 * 60)
const doc = (conteudo: unknown, revisao: number): DocumentoBase => ({ conteudo, revisao, salvoEm: '2026-10-06T13:00:00Z' })

describe('decidirInicio', () => {
  it('primeira vez, sem nada em lugar nenhum: loja vazia', () => {
    const r = decidirInicio(null, null, null, vazia)
    expect(r).toMatchObject({ tipo: 'usar', marcador: { revisao: 0, pendente: false } })
    expect(r.tipo === 'usar' && r.base.produtos).toEqual([])
  })

  it('computador trocado: vale o banco', () => {
    const r = decidirInicio(null, null, doc(cheia(), 7), vazia)
    expect(r).toMatchObject({ tipo: 'usar', marcador: { revisao: 7, pendente: false } })
    expect(r.tipo === 'usar' && r.base.produtos.length).toBeGreaterThan(0)
  })

  it('fechado sem internet com mudança pendente: vale a cópia local e o envio continua', () => {
    const local = cheia()
    const r = decidirInicio(local, { revisao: 3, pendente: true }, doc(vazia(), 3), vazia)
    expect(r).toEqual({ tipo: 'usar', base: local, marcador: { revisao: 3, pendente: true } })
  })

  it('banco mudou por outro caminho: vale o banco e a local fica guardada à parte', () => {
    const local = cheia()
    const r = decidirInicio(local, { revisao: 3, pendente: true }, doc(vazia(), 5), vazia)
    expect(r).toMatchObject({ tipo: 'usar', marcador: { revisao: 5, pendente: false }, descartada: local })
  })

  it('cópia de antes da sincronia existir (a demonstração) não sobe: vale o banco', () => {
    const r = decidirInicio(cheia(), null, null, vazia)
    expect(r).toMatchObject({ tipo: 'usar', marcador: { revisao: 0, pendente: false } })
    expect(r.tipo === 'usar' && r.base.fichas).toEqual([])
  })

  it('sem pendência: vale o banco, mesmo havendo cópia local', () => {
    const r = decidirInicio(cheia(), { revisao: 4, pendente: false }, doc(vazia(), 4), vazia)
    expect(r.tipo === 'usar' && r.base.produtos).toEqual([])
  })

  it('conteúdo do banco em formato desconhecido não é usado nem sobrescrito', () => {
    expect(decidirInicio(cheia(), null, doc({ versao: 99 }, 2), vazia)).toEqual({ tipo: 'invalida' })
  })
})

/** Um banco falso e um relógio que só anda quando o teste manda. */
function montar(opcoes: { sessao?: boolean; nuvem?: DocumentoBase | null; local?: Base | null; falharCom?: CausaFalha[]; carregarFalha?: CausaFalha; marcador?: { revisao: number; pendente: boolean } } = {}) {
  let servidor: DocumentoBase | null = opcoes.nuvem ?? null
  const falhas = [...(opcoes.falharCom ?? [])]
  const chamadas: number[] = []
  const timers: (() => void)[] = []
  const guardado = new Map<string, string>()
  if (opcoes.marcador) guardado.set('papelaria-opcao:sincronia', JSON.stringify(opcoes.marcador))
  let base: Base = opcoes.local ?? vazia()
  let observador: () => void = () => {}

  const dep: Dependencias = {
    api: () => ({
      sessaoAtual: async () => ok(opcoes.sessao === false ? null : { email: 'loja@teste' }),
      entrar: async () => ok({ email: 'loja@teste' }),
      carregarBase: async () => (opcoes.carregarFalha ? falha(opcoes.carregarFalha, 'sem rede') : ok(servidor)),
      salvarBase: async (conteudo, revisaoEsperada) => {
        chamadas.push(revisaoEsperada)
        const causa = falhas.shift()
        if (causa) return falha(causa, `falhou: ${causa}`)
        if ((servidor?.revisao ?? 0) !== revisaoEsperada) return falha('conflito', 'conflito')
        servidor = doc(conteudo, revisaoEsperada + 1)
        return ok({ revisao: servidor.revisao, salvoEm: servidor.salvoEm })
      },
    }),
    lerLocal: () => opcoes.local ?? null,
    obterBase: () => base,
    substituirBase: (nova) => { base = nova },
    observarMudancas: (fn) => { observador = fn; return () => {} },
    vazia,
    armazenamento: { ler: (c) => guardado.get(c) ?? null, gravar: (c, v) => { guardado.set(c, v) } },
    esperar: (_ms, fazer) => { timers.push(fazer) },
  }
  const s = criarSincronia(dep)
  return {
    s,
    chamadas,
    servidor: () => servidor,
    mudar: () => { base = { ...base, operador: `${base.operador}+` }; observador() },
    /** Roda os envios agendados até não sobrar nenhum. */
    async correr() {
      for (let i = 0; i < 20 && timers.length; i++) {
        timers.shift()!()
        await new Promise((r) => setTimeout(r, 0))
      }
    },
  }
}

describe('sincronia', () => {
  it('sem sessão, pede login; depois de entrar, abre a loja', async () => {
    const m = montar({ sessao: false })
    await m.s.iniciar()
    expect(m.s.obter().fase).toBe('entrar')
  })

  it('mudança vai ao banco e fica marcada como salva', async () => {
    const m = montar()
    await m.s.iniciar()
    expect(m.s.obter()).toMatchObject({ fase: 'pronto', gravacao: 'salvo' })
    m.mudar()
    expect(m.s.obter()).toMatchObject({ gravacao: 'pendente' })
    await m.correr()
    expect(m.s.obter()).toMatchObject({ gravacao: 'salvo' })
    expect(m.servidor()?.revisao).toBe(1)
  })

  it('sem conexão: avisa, tenta de novo e envia quando volta', async () => {
    const m = montar({ falharCom: ['rede', 'rede'] })
    await m.s.iniciar()
    m.mudar()
    await m.correr()
    expect(m.chamadas).toEqual([0, 0, 0])
    expect(m.s.obter()).toMatchObject({ gravacao: 'salvo' })
  })

  it('conflito: para de enviar em vez de sobrescrever', async () => {
    const m = montar({ falharCom: ['conflito'] })
    await m.s.iniciar()
    m.mudar()
    await m.correr()
    m.mudar()
    await m.correr()
    expect(m.chamadas).toEqual([0])
    expect(m.s.obter()).toMatchObject({ gravacao: 'conflito' })
  })

  it('abre sem internet com a cópia do computador e envia o pendente depois', async () => {
    const local = cheia()
    const m = montar({ local, carregarFalha: 'rede', marcador: { revisao: 0, pendente: true } })
    await m.s.iniciar()
    expect(m.s.obter()).toMatchObject({ fase: 'pronto', gravacao: 'pendente' })
    await m.correr()
    expect(m.chamadas).toEqual([0])
    expect(m.s.obter()).toMatchObject({ gravacao: 'salvo' })
  })

  it('sem internet e só a demonstração antiga no computador: não abre', async () => {
    const m = montar({ local: cheia(), carregarFalha: 'rede' })
    await m.s.iniciar()
    expect(m.s.obter()).toMatchObject({ fase: 'erro', causa: 'rede' })
  })

  it('sem internet e sem cópia no computador: não abre uma loja vazia por cima', async () => {
    const m = montar({ carregarFalha: 'rede' })
    await m.s.iniciar()
    expect(m.s.obter()).toMatchObject({ fase: 'erro', causa: 'rede', podeTentar: true })
    expect(m.chamadas).toEqual([])
  })
})
