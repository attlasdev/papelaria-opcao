import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { dataCurta } from '../../formatar'
import { Icone } from '../icone/Icone'
import './seletor-data.css'

type Props = {
  valor: string
  aoMudar: (data: string) => void
  dataInicial: string
  /** Dias fora do intervalo ficam apagados no calendário (YYYY-MM-DD). */
  min?: string
  max?: string
  /** Nome para leitor de tela; o campo de formulário passa o próprio rótulo. */
  rotulo?: string
  /**
   * filtro: pode ficar vazio ("Limpar filtro", "Data mais recente").
   * campo: sempre tem data, ocupa a largura do formulário ("Hoje").
   */
  variante?: 'filtro' | 'campo'
  erro?: boolean
}

const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
/** "Setembro de 2026": só a primeira letra maiúscula (capitalize fazia "De"). */
const nomeMes = { format: (data: Date) => { const t = formatoMes.format(data); return t.charAt(0).toUpperCase() + t.slice(1) } }
const nomeDia = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

function dataLocal(iso: string) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function isoLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function mascaraData(texto: string) {
  const digitos = texto.replace(/\D/g, '').slice(0, 8)
  return digitos.length <= 2 ? digitos : digitos.length <= 4
    ? `${digitos.slice(0, 2)}/${digitos.slice(2)}`
    : `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

function dataValida(texto: string) {
  if (texto.length !== 10) return ''
  const [dia, mes, ano] = texto.split('/').map(Number)
  const data = new Date(ano, mes - 1, dia)
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? isoLocal(data) : ''
}

/** Calendário do aplicativo: filtro por dia e campo de data dos formulários. */
export function SeletorData({ valor, aoMudar, dataInicial, min, max, rotulo = 'Filtrar fichas por data', variante = 'filtro', erro }: Props) {
  const id = useId()
  const controle = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [mesVisivel, setMesVisivel] = useState(() => {
    const data = dataLocal(valor || dataInicial)
    return new Date(data.getFullYear(), data.getMonth(), 1)
  })
  const [diaFocado, setDiaFocado] = useState(valor || dataInicial)
  const [posicao, setPosicao] = useState({ top: 0, left: 0 })
  const [texto, setTexto] = useState(valor ? dataCurta(valor) : '')
  const invalida = texto.length === 10 && !dataValida(texto)
  // Valor trocado por fora (ex.: Limpar ficha volta o vencimento): o texto acompanha.
  useEffect(() => {
    if (valor !== dataValida(texto) && (valor || texto.length === 10)) setTexto(valor ? dataCurta(valor) : '')
  }, [valor])
  const foraDoIntervalo = (iso: string) => Boolean((min && iso < min) || (max && iso > max))

  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth()
  const vazios = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const hoje = isoLocal(new Date())

  function posicionar() {
    const retangulo = controle.current?.getBoundingClientRect()
    if (!retangulo) return
    const largura = 300
    const altura = 356
    const espacoAbaixo = window.innerHeight - retangulo.bottom
    setPosicao({
      top: espacoAbaixo >= altura + 8 ? retangulo.bottom + 6 : Math.max(8, retangulo.top - altura - 6),
      left: Math.max(8, Math.min(retangulo.left, window.innerWidth - largura - 8)),
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
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fecharFora = (evento: PointerEvent) => {
      const alvo = evento.target as Node
      if (!controle.current?.contains(alvo) && !painel.current?.contains(alvo)) setAberto(false)
    }
    const fecharEscape = (evento: globalThis.KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      // Dentro de uma janela, Esc fecha só o calendário, não a janela inteira.
      evento.preventDefault()
      evento.stopPropagation()
      setAberto(false)
      entrada.current?.focus()
    }
    document.addEventListener('pointerdown', fecharFora)
    document.addEventListener('keydown', fecharEscape)
    return () => {
      document.removeEventListener('pointerdown', fecharFora)
      document.removeEventListener('keydown', fecharEscape)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const quadro = requestAnimationFrame(() => painel.current?.querySelector<HTMLButtonElement>(`[data-dia="${diaFocado}"]`)?.focus())
    return () => cancelAnimationFrame(quadro)
  }, [aberto, diaFocado, mesVisivel])

  function abrir() {
    if (aberto) { setAberto(false); return }
    const data = dataValida(texto) || valor || dataInicial
    const inicio = dataLocal(data)
    setMesVisivel(new Date(inicio.getFullYear(), inicio.getMonth(), 1))
    setDiaFocado(data)
    setAberto(true)
  }

  function mudarMes(deslocamento: number) {
    const proximo = new Date(ano, mes + deslocamento, 1)
    setMesVisivel(proximo)
    setDiaFocado(isoLocal(proximo))
  }

  function escolher(data: string) {
    setTexto(data ? dataCurta(data) : '')
    aoMudar(data)
    setAberto(false)
    entrada.current?.focus()
  }

  function digitar(textoDigitado: string) {
    const formatado = mascaraData(textoDigitado)
    setTexto(formatado)
    aoMudar(dataValida(formatado))
  }

  function tecladoDia(evento: KeyboardEvent<HTMLButtonElement>) {
    const deslocamento = evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1
      : evento.key === 'ArrowUp' ? -7 : evento.key === 'ArrowDown' ? 7 : 0
    if (!deslocamento) return
    evento.preventDefault()
    const proximo = dataLocal(diaFocado)
    proximo.setDate(proximo.getDate() + deslocamento)
    setMesVisivel(new Date(proximo.getFullYear(), proximo.getMonth(), 1))
    setDiaFocado(isoLocal(proximo))
  }

  return (
    <>
      <div ref={controle} className={['seletor-data__controle', variante === 'campo' && 'seletor-data__controle--campo', erro && 'seletor-data__controle--erro'].filter(Boolean).join(' ')}>
        <input
          ref={entrada}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={texto}
          maxLength={10}
          aria-label={rotulo}
          aria-invalid={invalida || erro || undefined}
          onChange={(evento) => digitar(evento.target.value)}
        />
        <button type="button" aria-label="Abrir calendário" aria-haspopup="dialog" aria-expanded={aberto} aria-controls={`${id}-calendario`} onClick={abrir}>
          <Icone nome="chevron-baixo" tamanho={16} />
        </button>
      </div>
      {aberto && createPortal(
        <div ref={painel} id={`${id}-calendario`} className="seletor-data__painel" role="dialog" aria-label={`Calendário: ${rotulo}`} style={posicao}>
          <div className="seletor-data__topo">
            <strong>{nomeMes.format(mesVisivel)}</strong>
            <div className="seletor-data__navegacao">
              <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><Icone nome="chevron-esquerda" tamanho={18} /></button>
              <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)}><Icone nome="chevron-direita" tamanho={18} /></button>
            </div>
          </div>
          <div className="seletor-data__grade" aria-label={nomeMes.format(mesVisivel)}>
            {diasSemana.map((dia, indice) => <span key={indice} className="seletor-data__semana" aria-hidden>{dia}</span>)}
            {Array.from({ length: vazios }, (_, indice) => <span key={`vazio-${indice}`} aria-hidden />)}
            {Array.from({ length: diasNoMes }, (_, indice) => {
              const data = new Date(ano, mes, indice + 1)
              const iso = isoLocal(data)
              return <button
                key={iso}
                type="button"
                data-dia={iso}
                className={iso === valor ? 'seletor-data__dia seletor-data__dia--selecionado' : 'seletor-data__dia'}
                aria-label={nomeDia.format(data)}
                aria-pressed={iso === valor}
                aria-current={iso === hoje ? 'date' : undefined}
                disabled={foraDoIntervalo(iso)}
                tabIndex={iso === diaFocado ? 0 : -1}
                onFocus={() => setDiaFocado(iso)}
                onKeyDown={tecladoDia}
                onClick={() => escolher(iso)}
              >{indice + 1}</button>
            })}
          </div>
          {variante === 'filtro' ? (
            <div className="seletor-data__rodape">
              <button type="button" disabled={!valor} onClick={() => escolher('')}>Limpar filtro</button>
              <button type="button" onClick={() => {
                const recente = dataLocal(dataInicial)
                setMesVisivel(new Date(recente.getFullYear(), recente.getMonth(), 1))
                setDiaFocado(dataInicial)
              }}>Data mais recente</button>
            </div>
          ) : (
            <div className="seletor-data__rodape seletor-data__rodape--fim">
              <button type="button" disabled={foraDoIntervalo(hoje)} onClick={() => escolher(hoje)}>Hoje</button>
            </div>
          )}
        </div>, document.body,
      )}
    </>
  )
}
