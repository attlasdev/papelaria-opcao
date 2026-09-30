import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { JanelaFicha } from './JanelaFicha'

const ContextoAbrirFicha = createContext<(id: string) => void>(() => {})

/**
 * Uma ficha sempre abre em janela sobre a tela atual, de qualquer lugar: ao
 * fechar, a pessoa está onde estava, com filtro, página e rolagem intactos.
 * A página /fichas/:id fica para depois da venda e para "Abrir página da ficha".
 */
export function ProvedorAbrirFicha({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState<string | null>(null)
  const { pathname } = useLocation()
  // Saiu da tela (ex.: "Abrir página da ficha"): a janela não vai junto.
  useEffect(() => setAberta(null), [pathname])

  return (
    <ContextoAbrirFicha.Provider value={setAberta}>
      {children}
      {aberta && <JanelaFicha id={aberta} aoFechar={() => setAberta(null)} />}
    </ContextoAbrirFicha.Provider>
  )
}

export function useAbrirFicha() {
  return useContext(ContextoAbrirFicha)
}
