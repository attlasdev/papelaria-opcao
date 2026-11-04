/**
 * Toda tela no monitor da loja (`R-UI-09`): nos dois tamanhos do
 * `playwright.config.ts`, a página não rola para o lado e a tabela paginada
 * mostra no mínimo 8 linhas (a página rola; nunca encolher até caber).
 */
import { expect, test } from '@playwright/test'
import { abrir } from './apoio'

const TELAS = [
  '/', '/busca?q=caderno', '/ficha/nova', '/clientes', '/clientes/sem-identificacao', '/clientes/CLI-0117',
  '/fichas/1131', '/financeiro', '/caixa', '/estoque', '/estoque/movimentacoes', '/estoque/entrada', '/servicos', '/boletos',
]

for (const rota of TELAS) {
  test(`[R-UI-09] ${rota}: sem rolagem para o lado e com pelo menos 8 linhas por página`, async ({ page }) => {
    await abrir(page, rota)
    await expect(page.getByRole('main')).toBeVisible()
    // Medir só com tudo carregado: carregando, a tabela tem uma linha e a paginação não diz quantas.
    await expect(page.getByRole('main').getByText(/Carregando/)).toHaveCount(0)

    const larguras = await page.evaluate(() => [document.documentElement, ...document.querySelectorAll('main, main *')]
      .filter((e) => e === document.documentElement || ['auto', 'scroll'].includes(getComputedStyle(e).overflowX) || e.tagName === 'MAIN')
      .filter((e) => !e.closest('table, [role="table"], .tabela'))
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => `${e.tagName.toLowerCase()}.${e.className} ${e.scrollWidth}>${e.clientWidth}`))
    expect(larguras).toEqual([])

    for (const paginas of await page.getByRole('navigation', { name: 'Páginas' }).all()) {
      const texto = (await paginas.innerText()).match(/Mostrando (\d+)–(\d+) de (\d+)/)
      if (!texto) continue
      const [, de, ate, total] = texto.map(Number)
      expect(ate - de + 1, `${rota}: ${texto[0]}`).toBeGreaterThanOrEqual(Math.min(8, total))
    }
  })
}
