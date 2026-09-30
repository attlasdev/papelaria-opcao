import { useLayoutEffect, useRef, useState } from 'react'

/** Ajusta a quantidade de linhas ao espaço da tela, preservando o rodapé e o conteúdo seguinte. */
export function useLinhasPorPagina(inicial = 5, limite = 12) {
  const referencia = useRef<HTMLDivElement>(null)
  const [linhasPorPagina, setLinhasPorPagina] = useState(inicial)

  useLayoutEffect(() => {
    const caixa = referencia.current
    const conteudo = caixa?.closest<HTMLElement>('.tela__conteudo')
    if (!caixa || !conteudo) return

    let quadro = 0
    const medir = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        const painel = caixa.querySelector<HTMLElement>('.painel')
        if (!painel) return
        const topo = painel.getBoundingClientRect().top - conteudo.getBoundingClientRect().top + conteudo.scrollTop
        const alturaFixa = (painel.querySelector('.painel__topo')?.getBoundingClientRect().height ?? 0)
          + (painel.querySelector('thead')?.getBoundingClientRect().height ?? 0)
          + (painel.querySelector('.paginacao')?.getBoundingClientRect().height ?? 0)
          + 2 // bordas do painel
        const alturaLinha = Math.max(56, painel.querySelector('tbody tr')?.getBoundingClientRect().height ?? 56)
        const seguinte = caixa.nextElementSibling
        const reservaSeguinte = seguinte instanceof HTMLElement
          ? seguinte.getBoundingClientRect().height + (Number.parseFloat(getComputedStyle(seguinte).marginTop) || 0)
          : 0
        const margemInferior = Number.parseFloat(getComputedStyle(conteudo).paddingBottom) || 0
        const disponivel = conteudo.clientHeight - topo - alturaFixa - reservaSeguinte - margemInferior
        const quantidade = Math.max(1, Math.min(limite, Math.floor(disponivel / alturaLinha)))
        setLinhasPorPagina((atual) => atual === quantidade ? atual : quantidade)
      })
    }

    const observador = new ResizeObserver(medir)
    observador.observe(conteudo)
    observador.observe(painelOuCaixa(caixa))
    medir()
    return () => { cancelAnimationFrame(quadro); observador.disconnect() }
  }, [limite])

  return { referencia, linhasPorPagina }
}

function painelOuCaixa(caixa: HTMLDivElement) {
  return caixa.querySelector<HTMLElement>('.painel') ?? caixa
}
