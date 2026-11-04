/** Clientes (`R-CLIENTE-08`, `B-001`). */
import { expect, test } from '@playwright/test'
import { abrir } from './apoio'

test('[R-CLIENTE-08] vendas sem identificação: o calendário aceita hoje e o passado, nunca o futuro', async ({ page }) => {
  await abrir(page, '/clientes/sem-identificacao')
  const campo = page.getByLabel('Filtrar fichas por data')
  await page.getByRole('button', { name: 'Abrir calendário' }).click()
  const calendario = page.getByRole('dialog', { name: /^Calendário/ })
  await expect(calendario.getByRole('button', { name: /^26 de outubro/ })).toBeEnabled()
  await expect(calendario.getByRole('button', { name: /^27 de outubro/ })).toBeEnabled()
  await expect(calendario.getByRole('button', { name: /^28 de outubro/ })).toBeDisabled()
  await expect(calendario.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()

  // Teclado: do dia de hoje, a seta para a frente não sai do lugar; para trás, anda.
  await calendario.getByRole('button', { name: /^27 de outubro/ }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(calendario.getByRole('button', { name: /^27 de outubro/ })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(calendario.getByRole('button', { name: /^26 de outubro/ })).toBeFocused()
  await page.keyboard.press('Escape')

  // Digitação: data futura fica marcada como inválida e não vira filtro.
  await campo.fill('28/10/2026')
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
  await campo.fill('20/10/2026')
  await expect(campo).not.toHaveAttribute('aria-invalid', 'true')
})

test('[B-001] Clientes mostra pelo menos 8 clientes por página, também no monitor da loja', async ({ page }) => {
  await abrir(page, '/clientes')
  const linhas = page.getByRole('row', { name: /^CLI-/ })
  await expect(page.getByText(/^Mostrando 1–\d+ de 24 clientes/)).toBeVisible()
  expect(await linhas.count()).toBeGreaterThanOrEqual(8)
})
