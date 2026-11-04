/** A ficha de venda no balcão (`R-VENDA-01`, `R-VENDA-08`, `R-PAGAMENTO-01`). */
import { expect, test, type Page } from '@playwright/test'
import { abrir, assinarComoJoao } from './apoio'

const busca = (page: Page) => page.getByLabel('Buscar produto por nome, código interno ou código de barras')

/** Bipa o código e espera o item chegar: o mock responde com atraso. */
async function bipar(page: Page, codigo: string, descricao: string) {
  await busca(page).fill(codigo)
  await busca(page).press('Enter')
  await expect(page.getByLabel(`Quantidade de ${descricao}`)).toBeVisible()
}

test('[R-VENDA-01] uma tela só: cliente, itens, pagamento e revisão; a ficha abre vazia', async ({ page }) => {
  await abrir(page, '/ficha/nova')
  for (const titulo of ['Cliente', 'Itens da ficha', 'Forma de pagamento', 'Revisão']) {
    await expect(page.getByText(titulo, { exact: true }).first()).toBeVisible()
  }
  await expect(page.getByText('Nenhum item ainda.')).toBeVisible()
  await expect(page.getByText('Nenhum escolhido')).toBeVisible()
  await expect(page.getByText('0 itens · 0 unidades')).toBeVisible()
})

test('[R-VENDA-08] produto que a ficha não acha: cadastro por cima, e volta com ele inserido', async ({ page }) => {
  await abrir(page, '/ficha/nova')
  await busca(page).fill('7890000000017')
  await busca(page).press('Enter')
  await page.getByRole('link', { name: 'Cadastrar produto' }).click()

  // Cancelar volta à ficha, sem item.
  const janela = page.getByRole('dialog', { name: 'Cadastrar produto' }).or(page.getByRole('dialog', { name: 'Produto cadastrado' }))
  await expect(janela.getByLabel(/Código de barras/)).toHaveValue('7890000000017')
  await expect(page.getByText('Itens da ficha')).toBeAttached()
  await janela.getByRole('button', { name: 'Cancelar' }).click()
  await expect(janela).toBeHidden()
  await expect(page.getByText('Nenhum item ainda.')).toBeVisible()

  // Salvar volta à ficha com o produto, quantidade 1.
  await busca(page).fill('7890000000017')
  await busca(page).press('Enter')
  await page.getByRole('link', { name: 'Cadastrar produto' }).click()
  await janela.getByLabel(/Nome do produto/).fill('Régua Acrílica 30 cm')
  await janela.getByRole('button', { name: /Categoria/ }).click()
  await janela.getByRole('option').first().click()
  await janela.getByLabel(/Preço de venda/).fill('450')
  await janela.getByLabel(/Quantidade inicial/).fill('5')
  await janela.getByRole('button', { name: 'Salvar produto' }).click()
  await assinarComoJoao(page, 'Salvar produto')
  await expect(janela.getByText('Produto cadastrado')).toBeVisible()
  await janela.getByRole('contentinfo').getByRole('button', { name: 'Fechar' }).click()
  await expect(janela).toBeHidden()
  await expect(page).toHaveURL(/#\/ficha\/nova$/)
  await expect(page.getByLabel('Quantidade de Régua Acrílica 30 cm')).toHaveValue('1')
})

test('[R-PAGAMENTO-01] Pix manual: conferido no balcão, a venda grava paga, sem etapa de conferência', async ({ page }) => {
  await abrir(page, '/ficha/nova')
  await page.getByRole('button', { name: 'Vender sem identificação' }).click()
  await bipar(page, '789102711', 'Caderno Universitário Tilibra 10 Matérias Capa Dura 200 Fls')
  await page.getByRole('radio', { name: 'Pix', exact: true }).click()
  await page.getByRole('radio', { name: 'Pix manual' }).click()
  await expect(page.getByText('conclua só depois de conferir o recebimento')).toBeVisible()
  await page.getByRole('button', { name: 'Concluir ficha de venda' }).click()
  await assinarComoJoao(page, 'Concluir venda')
  await expect(page).toHaveURL(/#\/fichas\//)
  await expect(page.getByText('Pix').first()).toBeVisible()
  await expect(page.getByText(/aguardando confer/i)).toHaveCount(0)
})
