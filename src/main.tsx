import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Entrar } from './telas/entrar/Entrar'
import './estilos/index.css'

/**
 * A unica linha do front que sabe que existem dois mundos.
 *
 * Com Electron, `electron/preload.ts` ja definiu `window.api` antes do React subir.
 * Sem Electron (`npm run dev` no navegador), nao ha preload — entao o mock entra.
 *
 * Import dinamico e so no desenvolvimento, de proposito: a build do app tira o
 * mock inteiro (plano da 1.0, Fase 3.4). Sem a ponte fora do desenvolvimento,
 * a tela diz que nao abriu, em vez de cair num banco falso em silencio.
 * Nenhuma tela precisa de `if (mock)`; o resto de `src/` nunca menciona isso.
 */
async function iniciar() {
  if (import.meta.env.DEV && !window.api) await import('./mock/api')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {window.api
        ? <App />
        : <Entrar estado={{ fase: 'erro', causa: 'configuracao', mensagem: 'O aplicativo não conseguiu falar com o banco da loja. Feche e abra de novo; se continuar, chame o suporte.', podeTentar: true }} />}
    </StrictMode>,
  )
}

void iniciar()
