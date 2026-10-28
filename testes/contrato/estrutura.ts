/**
 * A estrutura dos testes de contrato (plano da 1.0, fundação, item 6): o mesmo
 * cenário roda contra os dois lados que implementam as operações.
 *
 *   mock    a base da demonstração em memória (`src/mock/estado-demonstracao.ts`),
 *           que as telas usam até a Fase 3
 *   sqlite  o banco da 1.0 (`electron/banco/`), num arquivo em memória
 *
 * Enquanto as telas migram, os dois têm de dar a mesma resposta para o mesmo
 * gesto: é o que deixa trocar o mock pelo SQLite na Fase 3 sem surpresa.
 *
 * O cenário não compara um lado com o outro (ids e números de exibição nascem
 * diferentes); confere o comportamento que o contrato promete, nos dois.
 *
 * Uso:
 *
 *   testarContrato('cadastro de cliente', { mock: () => ..., sqlite: (banco) => ... }, (abrir) => {
 *     it('[R-CLIENTE-04] recusa documento repetido', async () => {
 *       const api = abrir('vazia')
 *       ...
 *     })
 *   })
 */
import { afterEach, beforeEach, describe, vi } from 'vitest'
import { abrirBanco, type Banco } from '../../electron/banco/banco'
import { semearBanco } from '../../electron/banco/semente'
import { criarBaseVazia } from '../../src/mock/base/semente'
import { restaurarDemonstracao, substituirBase } from '../../src/mock/estado-demonstracao'

/** O relógio dos cenários, parado: os dois lados veem o mesmo "agora". */
export const HOJE = '2026-10-27'
export const MINUTO_ATUAL = 15 * 60
export const AGORA = new Date(`${HOJE}T15:00:00-03:00`)

export type BaseInicial = 'vazia' | 'semente'

export type Lados<Operacoes> = {
  /** Chamada depois que a base do mock está pronta. */
  mock: () => Operacoes
  sqlite: (banco: Banco) => Operacoes
}

export function testarContrato<Operacoes>(
  titulo: string,
  lados: Lados<Operacoes>,
  cenarios: (abrir: (base?: BaseInicial) => Operacoes) => void,
) {
  describe.each(['mock', 'sqlite'] as const)(`${titulo} · %s`, (lado) => {
    let banco: Banco | null = null

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(AGORA)
    })

    afterEach(() => {
      banco?.close()
      banco = null
      vi.useRealTimers()
    })

    cenarios((base = 'vazia') => {
      if (lado === 'mock') {
        if (base === 'semente') restaurarDemonstracao(HOJE, MINUTO_ATUAL)
        else substituirBase(criarBaseVazia(HOJE))
        return lados.mock()
      }
      banco?.close()
      banco = abrirBanco(':memory:')
      if (base === 'semente') semearBanco(banco, { hoje: HOJE, minutoAtual: MINUTO_ATUAL })
      return lados.sqlite(banco)
    })
  })
}
