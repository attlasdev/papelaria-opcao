import { useEffect, useState } from 'react'
import type { EstadoBackup } from '../../comum/contrato'
import { api } from './api'
import { useDadosMudaram } from './mudancas'

/**
 * Um tique por minuto. A cópia parada (`R-LOGIN-01`) chega com o tempo, sem
 * ninguém gravar nada: o rodapé e o sino releem neste ritmo também.
 */
export function useMinuto() {
  const [minuto, setMinuto] = useState(0)
  useEffect(() => {
    const relogio = setInterval(() => setMinuto((n) => n + 1), 60_000)
    return () => clearInterval(relogio)
  }, [])
  return minuto
}

/** O estado do backup para o rodapé; `null` enquanto carrega ou se a leitura falhou. */
export function useEstadoBackup() {
  const versaoDados = useDadosMudaram()
  const minuto = useMinuto()
  const [estado, setEstado] = useState<EstadoBackup | null>(null)
  useEffect(() => {
    let vivo = true
    void api().obterEstadoBackup().then((r) => { if (vivo && r.ok) setEstado(r.dado) })
    return () => { vivo = false }
  }, [versaoDados, minuto])
  return estado
}
