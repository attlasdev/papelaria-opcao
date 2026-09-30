import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import './aviso.css'

type Avisar = (texto: string) => void

const ContextoAviso = createContext<Avisar>(() => {})

/**
 * Aviso curto no rodapé da janela. Nesta etapa serve para dizer que um botão
 * ainda não tem destino, para não confundir "não existe" com "quebrou".
 */
export function ProvedorAviso({ children }: { children: ReactNode }) {
  const [texto, setTexto] = useState<string | null>(null)
  const tempo = useRef<number | undefined>(undefined)

  const avisar = useCallback<Avisar>((novo) => {
    setTexto(novo)
    window.clearTimeout(tempo.current)
    tempo.current = window.setTimeout(() => setTexto(null), 2000)
  }, [])

  return (
    <ContextoAviso.Provider value={avisar}>
      {children}
      <div className={texto ? 'aviso aviso--visivel' : 'aviso'} role="status" aria-live="polite">
        {texto}
      </div>
    </ContextoAviso.Provider>
  )
}

/** Devolve uma função que marca uma ação como ainda sem destino no protótipo. */
export function useSemDestino() {
  const avisar = useContext(ContextoAviso)
  return useCallback((acao: string) => () => avisar(`Ainda sem destino: ${acao}`), [avisar])
}
