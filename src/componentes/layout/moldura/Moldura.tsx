import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { gsap, movimentoReduzido, useGSAP } from '../../../animacoes/gsap'
import { BarraLateral } from '../barra-lateral/BarraLateral'
import { Icone } from '../../icone/Icone'
import { ProvedorAviso } from '../../aviso/Aviso'
import './moldura.css'

/** Barra lateral fixa à esquerda; a tela da rota atual ocupa o resto. */
export function Moldura() {
  const moldura = useRef<HTMLDivElement>(null)
  const barra = useRef<HTMLElement>(null)
  const larguraAnterior = useRef<number | null>(null)
  const [recolhida, setRecolhida] = useState(() => {
    try { return localStorage.getItem('papelaria-opcao:barra-lateral-recolhida') === 'true' }
    catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('papelaria-opcao:barra-lateral-recolhida', String(recolhida)) }
    catch { /* A preferência fica só nesta janela se o armazenamento não estiver disponível. */ }
  }, [recolhida])

  useGSAP(() => {
    const inicio = larguraAnterior.current
    larguraAnterior.current = null
    if (inicio === null || !moldura.current || movimentoReduzido()) return
    const tokenDestino = recolhida ? '--largura-barra-lateral-compacta' : '--largura-barra-lateral'
    const destino = Number.parseFloat(getComputedStyle(moldura.current).getPropertyValue(tokenDestino))
    if (!Number.isFinite(destino)) return
    gsap.fromTo(moldura.current,
      { '--largura-barra-lateral-atual': `${inicio}px` },
      {
        '--largura-barra-lateral-atual': `${destino}px`,
        duration: 0.28,
        ease: 'power2.inOut',
        clearProps: '--largura-barra-lateral-atual',
      },
    )
    if (!recolhida) {
      gsap.fromTo(
        '.barra-lateral__nome, .barra-lateral__item span, .barra-lateral__criar span, .barra-lateral__operador span',
        { opacity: 0 },
        { opacity: 1, duration: 0.1, delay: 0.17, ease: 'power1.out', clearProps: 'opacity' },
      )
    }
  }, { scope: moldura, dependencies: [recolhida], revertOnUpdate: true })

  function alternarBarra() {
    larguraAnterior.current = barra.current?.getBoundingClientRect().width ?? null
    setRecolhida((atual) => !atual)
  }

  return (
    <ProvedorAviso>
      <div ref={moldura} className={recolhida ? 'moldura moldura--compacta' : 'moldura'}>
        <BarraLateral ref={barra} recolhida={recolhida} />
        <button
          type="button"
          className="moldura__alternar"
          aria-label={recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          aria-controls="menu-principal"
          aria-expanded={!recolhida}
          title={recolhida ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          onClick={alternarBarra}
        >
          <Icone nome="painel-lateral" tamanho={24} />
        </button>
        <div className="moldura__tela">
          <Outlet />
        </div>
      </div>
    </ProvedorAviso>
  )
}
