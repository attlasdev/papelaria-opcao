/**
 * Se o mock do contrato está em `window.api` (navegador, `npm run dev` sem
 * Electron). Módulo à parte porque importar `src/mock/api.ts` já o instala.
 */
let instalado = false

export const mockInstalado = () => instalado
export const marcarMockInstalado = () => { instalado = true }
