import type { Contrato } from '../../comum/contrato'
import { comAviso } from './mudancas'

/**
 * Por onde as telas chamam o contrato (plano da 1.0, Fase 3.3).
 *
 * É o `window.api` com o aviso às telas por cima (`./mudancas`): no Electron,
 * a ponte para o banco da loja (`electron/preload.ts` → `electron/operacoes.ts`);
 * no navegador, o mock, com o atraso e a falha forçada (`src/mock/simular.ts`).
 *
 * `window.api` é lido a cada chamada: no navegador o mock só o preenche depois
 * que os módulos das telas já foram carregados, e o painel do mock pode trocá-lo.
 */
const comOAviso = comAviso(() => window.api)

export const api = (): Contrato => comOAviso
