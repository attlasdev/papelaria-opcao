import type { Contrato } from '../../comum/contrato'
import { mockInstalado } from '../mock/instalado'
import { operadoresDaBase } from '../mock/operacoes/operadores'
import { produtosDaBase } from '../mock/operacoes/produtos'
import { entradasDaBase } from '../mock/operacoes/entradas'
import { ajustesDaBase } from '../mock/operacoes/ajustes'
import { movimentosDaBase } from '../mock/operacoes/movimentos'

/**
 * Por onde as telas migradas para a 1.0 chamam o contrato, durante a Fase 2.
 *
 * Até a Fase 3 a fonte da verdade é a base da demonstração (o documento que a
 * sincronia leva ao banco): as operações já migradas respondem por ela, aqui no
 * renderer, para o app continuar com uma base só (plano da 1.0, "Como a 1.0 é
 * feita"). O lado SQLite das mesmas operações já existe em `electron/` e passa
 * nos mesmos testes de contrato.
 *
 * No navegador, `window.api` já é o mock, que responde por estas mesmas
 * operações com o atraso e a falha forçada por cima (`src/mock/simular.ts`).
 *
 * Na Fase 3 isto vira `window.api` puro, e o arquivo some.
 *
 * Função, não constante: no navegador o mock só preenche `window.api` depois
 * que os módulos das telas já foram carregados.
 */
export const api = (): Contrato => (mockInstalado() ? window.api : { ...window.api, ...operadoresDaBase, ...produtosDaBase, ...entradasDaBase, ...ajustesDaBase, ...movimentosDaBase })
