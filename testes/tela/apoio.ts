/**
 * O que todo teste de tela usa: o relógio parado no mesmo dia dos testes de
 * contrato (27/10/2026, 15h em São Paulo) e a abertura de uma rota do app.
 * Cada teste tem um navegador novo, então o mock começa da semente.
 */
import { expect, type Page } from '@playwright/test'

export const AGORA = new Date('2026-10-27T18:00:00.000Z')

/** Abre a rota (sem o `#`) com a hora fixa, sem o painel do mock, e espera a barra lateral. */
export async function abrir(page: Page, rota = '/') {
  await page.clock.setFixedTime(AGORA)
  await page.goto(`?painel=nao#${rota}`)
  await expect(page.getByRole('navigation').first()).toBeVisible()
}

/** Assina o gesto como João (operador da semente, PIN 2222). */
export async function assinarComoJoao(page: Page, confirmar: string) {
  const janela = page.getByRole('dialog').last()
  await janela.getByRole('radio', { name: 'João Silva' }).click()
  await janela.getByLabel('PIN').fill('2222')
  await janela.getByRole('button', { name: confirmar }).click()
}

/**
 * O leitor de código de barras: as teclas chegam com menos de 40 ms entre si
 * (`src/leitor/detector.ts`). Pelo teclado do Playwright, com a suíte rodando em
 * paralelo, o intervalo passa disso e vira digitação; por isso as teclas saem
 * de uma vez, de dentro da página, no campo em foco.
 */
export async function lerCodigo(page: Page, codigo: string) {
  await page.evaluate((teclas) => {
    const alvo = document.activeElement ?? document.body
    for (const key of teclas) alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  }, [...codigo, 'Enter'])
}
