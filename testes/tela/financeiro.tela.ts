/** Financeiro (`R-FINANCEIRO-01`). */
import { expect, test } from '@playwright/test'
import { abrir } from './apoio'

test('[R-FINANCEIRO-01] tela e item próprios; sem a gaveta do Caixa; "Registrar movimento" é Entrada ou Despesa', async ({ page }) => {
  await abrir(page, '/')
  await page.getByRole('navigation', { name: 'Seções' }).getByRole('link', { name: 'Financeiro' }).click()
  await expect(page).toHaveURL(/#\/financeiro$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Movimentações financeiras' })).toBeVisible()
  const tela = page.getByRole('main')
  for (const daGaveta of ['Caixa atual', 'Abrir caixa', 'Fechar caixa', 'Registrar retirada', 'Adicionar dinheiro']) {
    await expect(tela.getByText(daGaveta)).toHaveCount(0)
  }

  await page.getByRole('button', { name: 'Registrar movimento' }).click()
  const janela = page.getByRole('dialog')
  await expect(page.locator('.modal--central')).toHaveCount(1)
  await expect(janela.getByRole('radiogroup', { name: 'O que deseja registrar?' }).getByRole('radio')).toHaveText(['Entrada', 'Despesa'])
})
