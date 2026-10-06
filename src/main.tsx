import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './estilos/index.css'

/**
 * A unica linha do front que sabe que existem dois mundos.
 *
 * Com Electron, `electron/preload.ts` ja definiu `window.api` antes do React subir.
 * Sem Electron (`npm run dev` no navegador), nao ha preload — entao o mock entra.
 *
 * Import dinamico de proposito: no app empacotado o mock nao e sequer carregado.
 * Nenhuma tela precisa de `if (mock)`; o resto de `src/` nunca menciona isso.
 */
async function iniciar() {
  if (!window.api) await import('./mock/api')

  // Fora de qualquer componente: o StrictMode montaria duas vezes e abriria dois inícios.
  const { sincronia } = await import('./dados/sincronia')
  void sincronia.iniciar()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void iniciar()
