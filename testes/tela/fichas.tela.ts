/** A ficha vista de outras telas (`R-FICHA-01`, `R-NOTINHA-04`), no cliente com notinhas em atraso. */
import { expect, test } from '@playwright/test'
import { abrir } from './apoio'

const GIRASSOL = '/clientes/CLI-0117'

test('[R-NOTINHA-04] ficha pendente avisa as outras notinhas do cliente e leva a receber todas', async ({ page }) => {
  await abrir(page, GIRASSOL)
  await page.getByRole('row', { name: /^#0959/ }).getByRole('button', { name: 'Ver ficha' }).click()
  const ficha = page.getByRole('dialog').first()
  const faixa = ficha.getByRole('status').filter({ hasText: 'em aberto' })
  await expect(faixa).toContainText('Associação Girassol tem mais 2 notinhas em aberto')
  await expect(faixa).toContainText('Total devido: R$ 308,50')
  await faixa.getByRole('button', { name: 'Receber todas' }).click()
  const receber = page.getByRole('dialog').last()
  await expect(receber.getByRole('checkbox', { checked: true })).toHaveCount(3)
})

test('[R-FICHA-01] "Ver ficha" abre janela; fechar devolve filtro, página e rolagem; Esc fecha só a de cima', async ({ page }) => {
  await abrir(page, GIRASSOL)
  await page.getByRole('navigation', { name: 'Páginas' }).getByRole('button', { name: '2', exact: true }).click()
  await expect(page.getByText('Mostrando 9–16 de 17 compras')).toBeVisible()
  const linha = page.getByRole('row').nth(5)
  await linha.scrollIntoViewIfNeeded()
  const rolagem = await page.evaluate(() => document.scrollingElement!.scrollTop + (document.querySelector('main')?.scrollTop ?? 0))

  await linha.getByRole('button', { name: 'Ver ficha' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page).toHaveURL(new RegExp(`#${GIRASSOL}$`))
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Mostrando 9–16 de 17 compras')).toBeVisible()
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop + (document.querySelector('main')?.scrollTop ?? 0))).toBe(rolagem)

  // Janela sobre janela: o recebimento e, por cima, a assinatura.
  await page.getByRole('radio', { name: /Notinhas em atraso/ }).click()
  await page.getByRole('row', { name: /^#0959/ }).getByRole('button', { name: 'Ver ficha' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Receber todas' }).click()
  await page.getByRole('dialog', { name: 'Receber notinhas' }).getByRole('button', { name: 'Confirmar recebimento' }).click()
  await expect(page.getByRole('dialog', { name: 'Quem está fazendo?' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog', { name: 'Receber notinhas' })).toBeVisible()
  // Fechar o recebimento volta à ficha de onde ele saiu; o próximo Esc fecha a ficha.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Ficha #0959' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /Notinhas em atraso/ })).toBeChecked()
})
