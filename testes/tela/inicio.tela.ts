/** Início (`B-002`). */
import { expect, test } from '@playwright/test'
import { abrir } from './apoio'

test('[B-002] Início: "Pagamento" não passa por cima de "Valor total"', async ({ page }) => {
  await abrir(page, '/')
  const tabela = page.getByRole('table')
  await expect(tabela.getByRole('row', { name: /^#\d+/ }).first()).toBeVisible()
  const cabecalhos = await tabela.getByRole('columnheader').allInnerTexts()
  const pagamento = cabecalhos.findIndex((c) => /pagamento/i.test(c))
  const valor = cabecalhos.findIndex((c) => /valor total/i.test(c))
  expect(valor).toBe(pagamento + 1)

  // O que está escrito em Pagamento termina antes de onde começa o texto do Valor total.
  const sobrepostas = await tabela.evaluate((t, [p, v]) => [...t.querySelectorAll('tbody tr')].flatMap((linha) => {
    const celulas = linha.querySelectorAll('td')
    const fim = Math.max(...[...celulas[p].querySelectorAll('*')].map((e) => e.getBoundingClientRect().right), celulas[p].getBoundingClientRect().left)
    const textoValor = document.createRange()
    textoValor.selectNodeContents(celulas[v])
    const inicio = textoValor.getBoundingClientRect().left
    return fim > inicio ? [linha.textContent?.slice(0, 40)] : []
  }), [pagamento, valor])
  expect(sobrepostas).toEqual([])
})
