import { defineConfig } from '@playwright/test'

/**
 * Testes de tela (1.0, Fase 3.6; `docs/testes.md`): as telas no navegador,
 * sobre o mock, com o atraso dele ligado. Sobe só o Vite, sem o Electron
 * (`PAPELARIA_SO_TELA`). Todo teste roda nos dois tamanhos da R-UI-09: a altura
 * útil do monitor da loja (1280x720 menos barra de tarefas e menu) e o grande.
 */
const PORTA = 5181

export default defineConfig({
  testDir: 'testes/tela',
  testMatch: '**/*.tela.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}/`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // As telas respeitam o movimento reduzido: sem animação no meio do clique.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: '1280x650', use: { browserName: 'chromium', viewport: { width: 1280, height: 650 } } },
    { name: '1920x1080', use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORTA} --strictPort`,
    env: { PAPELARIA_SO_TELA: '1' },
    url: `http://localhost:${PORTA}/`,
    reuseExistingServer: !process.env.CI,
  },
})
