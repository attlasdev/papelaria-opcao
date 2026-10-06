import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// Sem modulo nativo de proposito — ver CLAUDE.md. Dependencia nativa obriga
// `electron-rebuild` e recompilacao por plataforma; nao adicionar sem discutir.
export default defineConfig({
  base: './',
  // Modelos de planilha da Emitte (recursos/emitte/), embutidos com `?inline`.
  assetsInclude: ['**/*.xlsx'],
  plugins: [
    react(),
    tailwindcss(),
    electron({
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
