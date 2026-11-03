import { describe, expect, it, vi } from 'vitest'
import { falha, ok, type Contrato } from '../../comum/contrato'
import { AVISA_AS_TELAS, comAviso } from './mudancas'

// O contador da versão é do módulo; o teste lê pelo que o React leria.
vi.mock('react', () => ({ useSyncExternalStore: (_inscrever: unknown, ler: () => number) => ler() }))
const { useDadosMudaram } = await import('./mudancas')

const contrato = (respostas: Partial<Record<keyof Contrato, unknown>>) =>
  Object.fromEntries(Object.keys(AVISA_AS_TELAS).map((nome) => [nome, async () => respostas[nome as keyof Contrato] ?? ok(null)])) as unknown as Contrato

describe('aviso às telas (Fase 3.2)', () => {
  it('gravação que deu certo soma a versão; falha e leitura, não', async () => {
    let fonte = contrato({ cadastrarCliente: ok({ id: '1' }), editarCliente: falha('validacao', 'Nome?') })
    const api = comAviso(() => fonte)
    const antes = useDadosMudaram()
    await api.listarClientes('todos', '', 1, 10)
    expect(useDadosMudaram()).toBe(antes)
    await api.editarCliente('1', {} as never)
    expect(useDadosMudaram()).toBe(antes)
    expect(await api.cadastrarCliente({} as never)).toEqual(ok({ id: '1' }))
    expect(useDadosMudaram()).toBe(antes + 1)
    // A fonte é lida na hora: trocar a operação depois vale.
    fonte = contrato({ listarClientes: falha('rede', 'Sem rede') })
    expect((await api.listarClientes('todos', '', 1, 10)).ok).toBe(false)
  })

  it('o rascunho da ficha e os avisos lidos não fazem as telas relerem', () => {
    expect([AVISA_AS_TELAS.salvarRascunhoFicha, AVISA_AS_TELAS.marcarAvisosLidos, AVISA_AS_TELAS.concluirFicha]).toEqual([false, false, true])
  })
})
