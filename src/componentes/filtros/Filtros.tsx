import { useRef } from 'react'
import { gsap, movimentoReduzido, useGSAP } from '../../animacoes/gsap'
import './filtros.css'

export type OpcaoFiltro<T extends string> = { valor: T; rotulo: string; contagem?: number }

type Props<T extends string> = {
  opcoes: OpcaoFiltro<T>[]
  valor: T
  aoMudar: (valor: T) => void
  /** Nome do grupo para leitor de tela. */
  rotulo: string
}

/** Botões de filtro lado a lado, um ativo por vez (Todos / Pix / Cartão...). */
export function Filtros<T extends string>({ opcoes, valor, aoMudar, rotulo }: Props<T>) {
  const grupo = useRef<HTMLDivElement>(null)
  const anterior = useRef(valor)

  useGSAP(() => {
    if (anterior.current === valor) return
    anterior.current = valor
    if (movimentoReduzido()) return
    const ativo = grupo.current?.querySelector<HTMLElement>('.filtros__opcao--ativa')
    if (!ativo) return
    gsap.fromTo(ativo,
      { y: 2, scale: 0.98, opacity: 0.75 },
      { y: 0, scale: 1, opacity: 1, duration: 0.16, ease: 'power1.out', clearProps: 'transform,opacity' },
    )
  }, { scope: grupo, dependencies: [valor], revertOnUpdate: true })

  return (
    <div ref={grupo} className="filtros" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            className={ativo ? 'filtros__opcao filtros__opcao--ativa' : 'filtros__opcao'}
            onClick={() => aoMudar(opcao.valor)}
          >
            {opcao.rotulo}
            {opcao.contagem !== undefined && <span className="filtros__contagem">{opcao.contagem}</span>}
          </button>
        )
      })}
    </div>
  )
}
