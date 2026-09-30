import type { Contrato } from '../../comum/contrato'

/**
 * O `window.api` do renderer E o contrato — sem copia, sem espelho para manter
 * em sincronia. Uma operacao nova em `comum/contrato.ts` ja aparece aqui com
 * autocomplete, sem ninguem editar este arquivo.
 *
 * No navegador (`npm run dev`) quem preenche `window.api` e `src/mock/api.ts`.
 * No app empacotado, `electron/preload.ts`. A tela nao sabe a diferenca.
 */
declare global {
  interface Window {
    api: Contrato
  }
}

export {}
