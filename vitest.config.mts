import { defineConfig } from 'vitest/config'

// Config própria: a vite.config.mts sobe o Electron, que o teste não precisa.
export default defineConfig({
  // Os modelos de planilha da Emitte são lidos com `?inline`, como no app.
  assetsInclude: ['**/*.xlsx'],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
