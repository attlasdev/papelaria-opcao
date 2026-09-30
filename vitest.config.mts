import { defineConfig } from 'vitest/config'

// Config própria: a vite.config.mts sobe o Electron, que o teste não precisa.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
