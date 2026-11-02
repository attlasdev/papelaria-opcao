import { defineConfig } from 'vitest/config'

// Config própria: a vite.config.mts sobe o Electron, que o teste não precisa.
export default defineConfig({
  // Os modelos de planilha da Emitte são lidos com `?inline`, como no app.
  assetsInclude: ['**/*.xlsx'],
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'testes/**/*.test.ts'],
    environment: 'node',
    // Os testes com a semente montam 100 dias de loja e conferem PIN com scrypt;
    // em paralelo com a suíte inteira, passam dos 5 s padrão sem estar errados.
    testTimeout: 15_000,
  },
})
