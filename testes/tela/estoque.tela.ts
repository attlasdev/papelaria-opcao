/** Estoque (`R-ESTOQUE-03`, `M1`). */
import { expect, test } from '@playwright/test'
import { abrir, lerCodigo } from './apoio'

const CADERNO = 'Caderno Universitário Tilibra 10 Matérias Capa Dura 200 Fls'

test('[R-ESTOQUE-03] "+ Entrada" da linha abre a gaveta Entrada rápida, de um produto', async ({ page }) => {
  await abrir(page, '/estoque')
  await page.getByRole('row', { name: new RegExp(CADERNO) }).getByRole('button', { name: '+ Entrada' }).click()
  const gaveta = page.getByRole('dialog', { name: 'Entrada rápida' })
  await expect(gaveta).toBeVisible()
  await expect(gaveta).toContainText(CADERNO)
  await expect(gaveta).toHaveClass(/modal__janela/)
  await expect(page.locator('.modal--lateral')).toHaveCount(1)
})

test('[R-ESTOQUE-03] Registrar entrada: bipar de novo não duplica; produto novo espera o cadastro', async ({ page }) => {
  await abrir(page, '/estoque/entrada')
  const bipados = page.getByRole('region', { name: 'Códigos bipados aguardando quantidade' })
  await page.getByRole('button', { name: 'Ler códigos' }).click()
  await expect(page.getByText('Pronto para ler')).toBeVisible()
  await lerCodigo(page, '789102711')
  await expect(bipados).toContainText('Bipados · 1')
  await lerCodigo(page, '789102711')
  await expect(bipados).toContainText('Bipados · 1')
  await expect(bipados.getByText(CADERNO)).toHaveCount(1)

  await lerCodigo(page, '7890000000017')
  await expect(bipados).toContainText('Bipados · 2')
  // Com nome e tudo, o produto novo só vai para a tabela depois de "Completar cadastro".
  await bipados.getByLabel('Nome do produto 7890000000017').fill('Régua Acrílica 30 cm')
  await bipados.getByLabel(/^Quantas .* chegaram de 7890000000017$/).fill('10')
  await bipados.getByLabel(new RegExp(`^Quantas .* chegaram de ${CADERNO}$`)).fill('5')
  await expect(bipados).toContainText('Aguardando cadastro')
  await expect(bipados.getByRole('button', { name: 'Completar cadastro' })).toBeVisible()
  await expect(bipados.getByRole('button', { name: /Lançar prontos/ })).toHaveText(/\(1\)/)
})

test('[M1] o cadastro de produto não tem "Fornecedor" (o produto não guarda)', async ({ page }) => {
  await abrir(page, '/estoque/produto/novo')
  const janela = page.getByRole('dialog', { name: 'Cadastrar produto' })
  await expect(janela.getByLabel(/Nome do produto/)).toBeVisible()
  await expect(janela.getByText(/Fornecedor/i)).toHaveCount(0)
})
