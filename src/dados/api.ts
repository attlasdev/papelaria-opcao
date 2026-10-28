import type { Contrato } from '../../comum/contrato'
import { operadoresDaBase } from '../mock/operacoes/operadores'

/**
 * Por onde as telas migradas para a 1.0 chamam o contrato, durante a Fase 2.
 *
 * Até a Fase 3 a fonte da verdade é a base da demonstração (o documento que a
 * sincronia leva ao banco): as operações já migradas respondem por ela, aqui no
 * renderer, para o app continuar com uma base só (plano da 1.0, "Como a 1.0 é
 * feita"). O lado SQLite das mesmas operações já existe em `electron/` e passa
 * nos mesmos testes de contrato.
 *
 * Na Fase 3 isto vira `window.api` puro, e o arquivo some.
 *
 * Função, não constante: no navegador o mock só preenche `window.api` depois
 * que os módulos das telas já foram carregados.
 */
export const api = (): Contrato => ({ ...window.api, ...operadoresDaBase })
