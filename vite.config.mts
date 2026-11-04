import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// `PAPELARIA_SO_TELA=1`: so as telas, sem subir o Electron (testes de tela,
// `playwright.config.ts`). No navegador, o modo de desenvolvimento usa o mock.
const soTela = process.env.PAPELARIA_SO_TELA === '1'

// Sem modulo nativo de proposito — ver CLAUDE.md. Dependencia nativa obriga
// `electron-rebuild` e recompilacao por plataforma; nao adicionar sem discutir.
export default defineConfig({
  base: './',
  // Modelos de planilha da Emitte (recursos/emitte/), embutidos com `?inline`.
  assetsInclude: ['**/*.xlsx'],
  plugins: [
    react(),
    tailwindcss(),
    !soTela && electron({
      main: {
        entry: 'electron/main.ts',
        vite: { build: { outDir: 'dist-electron/main' } },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: { build: { outDir: 'dist-electron/preload' } },
      },
    }),
  ],
})
