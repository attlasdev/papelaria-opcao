import { useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gsap, movimentoReduzido, useGSAP } from '../../animacoes/gsap'
import { Icone, type NomeIcone } from '../icone/Icone'
import './campo.css'

type Base = { rotulo: string; ajuda?: ReactNode; erro?: boolean; opcional?: boolean }
type PropsCampo = Base & InputHTMLAttributes<HTMLInputElement> & { icone?: NomeIcone }

export function Campo({ rotulo, ajuda, erro, opcional, icone, className, ...resto }: PropsCampo) {
  const ajudaId = useId()
  return (
    <label className={className ? `campo ${className}` : 'campo'}>
      <span className="campo__rotulo">{rotulo}{opcional && <span className="campo__opcional"> (opcional)</span>}</span>
      <span className={erro ? 'campo__caixa campo__caixa--erro' : 'campo__caixa'}>
        {icone && <Icone nome={icone} tamanho={18} />}
        <input
          {...resto}
          aria-invalid={erro || resto['aria-invalid']}
          aria-describedby={ajuda ? [resto['aria-describedby'], ajudaId].filter(Boolean).join(' ') : resto['aria-describedby']}
        />
      </span>
      {ajuda && <span id={ajudaId} className={erro ? 'campo__ajuda campo__ajuda--erro' : 'campo__ajuda'}>{ajuda}</span>}
    </label>
  )
}

export type OpcaoSelecao = string | { valor: string; rotulo: string }
type PropsSelecao = Base & {
  opcoes: OpcaoSelecao[]
  name?: string
  valor?: string
  valorInicial?: string
  aoMudar?: (valor: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
}

function dadosOpcao(opcao: OpcaoSelecao) {
  return typeof opcao === 'string' ? { valor: opcao, rotulo: opcao } : opcao
}

/** Lista visual única para os formulários, inclusive dentro de modais. */
export function Selecao({ rotulo, ajuda, erro, opcional, opcoes, name, valor, valorInicial, aoMudar, required, disabled, className }: PropsSelecao) {
  const id = useId()
  const botao = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const lista = opcoes.map(dadosOpcao)
  const [interno, setInterno] = useState(valorInicial ?? lista[0]?.valor ?? '')
  const selecionado = valor ?? interno
  const indiceSelecionado = Math.max(0, lista.findIndex((opcao) => opcao.valor === selecionado))
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(indiceSelecionado)
  const [posicao, setPosicao] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })

  function posicionar() {
    const retangulo = botao.current?.getBoundingClientRect()
    if (!retangulo) return
    const margem = 12
    const corpoModal = botao.current?.closest('.modal__corpo')?.getBoundingClientRect()
    const limiteSuperior = corpoModal?.top ?? 0
    const limiteInferior = corpoModal?.bottom ?? window.innerHeight
    const espacoAbaixo = limiteInferior - retangulo.bottom - margem
    const espacoAcima = retangulo.top - limiteSuperior - margem
    const alturaDesejada = Math.min(lista.length * 40 + 8, 240)
    const acima = espacoAbaixo < alturaDesejada && espacoAcima > espacoAbaixo
    const maxHeight = Math.max(80, Math.min(240, (acima ? espacoAcima : espacoAbaixo) - 8))
    setPosicao({
      top: acima ? retangulo.top - Math.min(alturaDesejada, maxHeight) - 4 : retangulo.bottom + 4,
      left: retangulo.left,
      width: retangulo.width,
      maxHeight,
    })
  }

  useLayoutEffect(() => {
    if (!aberto) return
    posicionar()
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [aberto, opcoes.length])

  useGSAP(() => {
    if (!aberto || !listaRef.current || movimentoReduzido()) return
    gsap.fromTo(listaRef.current,
      { y: -4, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.16, ease: 'power1.out', clearProps: 'transform,opacity' },
    )
  }, { scope: listaRef, dependencies: [aberto], revertOnUpdate: true })

  useEffect(() => {
    if (!aberto) return
    const fecharFora = (evento: PointerEvent) => {
      const alvo = evento.target as Node
      if (!botao.current?.contains(alvo) && !document.getElementById(`${id}-lista`)?.contains(alvo)) setAberto(false)
    }
    document.addEventListener('pointerdown', fecharFora)
    return () => document.removeEventListener('pointerdown', fecharFora)
  }, [aberto, id])

  useEffect(() => {
    if (aberto) document.getElementById(`${id}-opcao-${ativo}`)?.scrollIntoView({ block: 'nearest' })
  }, [aberto, ativo, id])

  function escolher(indice: number) {
    const proximo = lista[indice]
    if (!proximo) return
    if (valor === undefined) setInterno(proximo.valor)
    aoMudar?.(proximo.valor)
    setAtivo(indice)
    setAberto(false)
    botao.current?.focus()
  }

  function teclado(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key === 'Escape' && aberto) {
      evento.preventDefault()
      evento.stopPropagation()
      setAberto(false)
      return
    }
    if (evento.key === 'Tab') { setAberto(false); return }
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp' || evento.key === 'Home' || evento.key === 'End') {
      evento.preventDefault()
      const proximo = evento.key === 'Home' ? 0 : evento.key === 'End' ? lista.length - 1 : aberto
        ? (ativo + (evento.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length
        : indiceSelecionado
      setAtivo(proximo)
      setAberto(true)
      return
    }
    if ((evento.key === 'Enter' || evento.key === ' ') && aberto) {
      evento.preventDefault()
      escolher(ativo)
      return
    }
    if (aberto && evento.key.length === 1 && !evento.altKey && !evento.ctrlKey && !evento.metaKey) {
      const letra = evento.key.toLocaleLowerCase('pt-BR')
      const indice = lista.findIndex((opcao, posicao) => posicao > ativo && opcao.rotulo.toLocaleLowerCase('pt-BR').startsWith(letra))
      const primeiro = lista.findIndex((opcao) => opcao.rotulo.toLocaleLowerCase('pt-BR').startsWith(letra))
      if (indice >= 0 || primeiro >= 0) setAtivo(indice >= 0 ? indice : primeiro)
    }
  }

  return (
    <div className={className ? `campo ${className}` : 'campo'}>
      <span id={`${id}-rotulo`} className="campo__rotulo">{rotulo}{opcional && <span className="campo__opcional"> (opcional)</span>}</span>
      <button
        ref={botao}
        type="button"
        className={erro ? 'campo__seletor campo__seletor--erro' : 'campo__seletor'}
        role="combobox"
        aria-labelledby={`${id}-rotulo`}
        aria-controls={`${id}-lista`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-activedescendant={aberto ? `${id}-opcao-${ativo}` : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => { setAtivo(indiceSelecionado); setAberto(!aberto) }}
        onKeyDown={teclado}
      >
        <span className="campo__seletor-valor">{lista.find((opcao) => opcao.valor === selecionado)?.rotulo ?? 'Selecione'}</span>
        <Icone nome="chevron-baixo" tamanho={16} />
      </button>
      {name && <input type="hidden" name={name} value={selecionado} />}
      {ajuda && <span className={erro ? 'campo__ajuda campo__ajuda--erro' : 'campo__ajuda'}>{ajuda}</span>}
      {aberto && createPortal(
        <div ref={listaRef} id={`${id}-lista`} className="campo__lista" role="listbox" aria-labelledby={`${id}-rotulo`} style={posicao}>
          {lista.map((opcao, indice) => (
            <div
              key={opcao.valor}
              id={`${id}-opcao-${indice}`}
              role="option"
              aria-selected={opcao.valor === selecionado}
              className={indice === ativo ? 'campo__opcao campo__opcao--ativa' : 'campo__opcao'}
              onMouseEnter={() => setAtivo(indice)}
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => escolher(indice)}
            >{opcao.rotulo}</div>
          ))}
        </div>, document.body,
      )}
    </div>
  )
}
