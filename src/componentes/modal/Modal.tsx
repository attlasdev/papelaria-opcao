import { useEffect, useRef, type ReactNode } from 'react'
import { gsap, movimentoReduzido, useGSAP } from '../../animacoes/gsap'
import { BotaoIcone } from '../botao/Botao'
import './modal.css'

type Props = {
  titulo: string
  subtitulo?: string
  variante?: 'central' | 'lateral'
  /** Janela central mais estreita, para formulário curto. */
  estreito?: boolean
  aoFechar: () => void
  /** Barra fixa no pé da janela: nota à esquerda e botões à direita. */
  rodape?: ReactNode
  children: ReactNode
}

/** Janela sobre a tela atual. Fecha com Esc, no X ou no fundo escurecido. */
export function Modal({ titulo, subtitulo, variante = 'central', estreito, aoFechar, rodape, children }: Props) {
  const janela = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!janela.current || movimentoReduzido()) return
    gsap.fromTo(janela.current,
      { x: variante === 'lateral' ? 12 : 0, y: variante === 'central' ? 6 : 0, opacity: 0 },
      { x: 0, y: 0, opacity: 1, duration: 0.16, ease: 'power1.out', clearProps: 'transform,opacity' },
    )
  }, { scope: janela })

  useEffect(() => {
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Campo com autoFocus dentro da janela mantém o foco; senão, a janela recebe.
    if (!janela.current?.contains(document.activeElement)) janela.current?.focus()
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        aoFechar()
      }
      if (evento.key !== 'Tab' || !janela.current) return
      const focaveis = Array.from(janela.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      if (focaveis.length === 0) { evento.preventDefault(); return }
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === janela.current)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => {
      window.removeEventListener('keydown', aoTeclar)
      focoAnterior?.focus()
    }
  }, [aoFechar])

  return (
    <div className={`modal modal--${variante}${estreito ? ' modal--estreito' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div ref={janela} className="modal__janela" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
        <header className="modal__topo">
          <div>
            <h2 className="modal__titulo">{titulo}</h2>
            {subtitulo && <p className="modal__subtitulo">{subtitulo}</p>}
          </div>
          <BotaoIcone icone="fechar" rotulo="Fechar" onClick={aoFechar} />
        </header>
        <div className="modal__corpo">{children}</div>
        {rodape && <footer className="modal__rodape">{rodape}</footer>}
      </div>
    </div>
  )
}
