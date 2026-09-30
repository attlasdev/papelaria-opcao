import { useEffect } from 'react'
import { Botao } from '../componentes/botao/Botao'
import { Icone } from '../componentes/icone/Icone'
import './painel-leitor.css'

/** Larguras das barras do desenho, em px. Só enfeite: não é um código válido. */
const barras = [2, 1, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 1]

export type UltimaLeitura = {
  titulo: string
  codigo: string
  novo: boolean
  /** Muda a cada bipe, para o visor e a última leitura reagirem de novo. */
  vez: number
}

type Props = {
  ultima: UltimaLeitura | null
  aoParar: () => void
}

/**
 * Mostra que o leitor está ligado: um visor com o laser varrendo o código, a
 * última leitura. A cada bipe o visor pisca verde, como a luz da
 * maquininha. A leitura em si é do `useLeitorCodigo`; isto é só o aviso.
 */
export function PainelLeitor({ ultima, aoParar }: Props) {
  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoParar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoParar])

  return (
    <div className="painel-leitor" role="status" aria-live="polite">
      <div className="painel-leitor__visor" aria-hidden>
        <span className="painel-leitor__canto painel-leitor__canto--a" />
        <span className="painel-leitor__canto painel-leitor__canto--b" />
        <span className="painel-leitor__canto painel-leitor__canto--c" />
        <span className="painel-leitor__canto painel-leitor__canto--d" />
        <div className="painel-leitor__barras">
          {barras.map((largura, indice) => <i key={indice} style={{ width: largura }} />)}
        </div>
        <div className="painel-leitor__laser" />
        {ultima && <div key={ultima.vez} className="painel-leitor__lido" />}
      </div>

      <div className="painel-leitor__texto">
        <strong>Pronto para ler</strong>
        <span>Bipe os produtos em sequência</span>
      </div>

      <div className="painel-leitor__ultima-area">
        {ultima && (
          <span key={ultima.vez} className={ultima.novo ? 'painel-leitor__ultima painel-leitor__ultima--novo' : 'painel-leitor__ultima'}>
            <Icone nome={ultima.novo ? 'mais' : 'check'} tamanho={14} />
            <span className="painel-leitor__ultima-nome">{ultima.titulo}</span>
            <small className="codigo">{ultima.codigo}</small>
          </span>
        )}
      </div>

      <Botao tamanho="pequeno" variante="fantasma" onClick={aoParar} title="Parar leitura (Esc)">
        Parar <kbd>Esc</kbd>
      </Botao>
    </div>
  )
}
