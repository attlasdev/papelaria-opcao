import { useCallback, useEffect, useState } from 'react'
import { RouterProvider } from 'react-router'
import { api } from './dados/api'
import { roteador } from './rotas'
import { recarregarOperadores, useOperadores } from './dados/operadores'
import { Entrar, PrimeiraAbertura } from './telas/entrar/Entrar'

/**
 * Na primeira abertura nesta máquina a loja entra antes (`R-LOGIN-01`): sem o
 * login a cópia na nuvem nunca sobe. Depois, perder a sessão não para a loja
 * (o sino avisa). Se nem der para saber, abre: o login serve só ao backup.
 */
export default function App() {
  const [abertura, setAbertura] = useState<'conferindo' | 'entrar' | 'loja'>('conferindo')
  const conferir = useCallback(async () => {
    const r = await api().obterEstadoBackup()
    setAbertura(r.ok && r.dado.precisaEntrar ? 'entrar' : 'loja')
  }, [])
  useEffect(() => { void conferir() }, [conferir])

  if (abertura === 'conferindo') return <Entrar estado={{ fase: 'iniciando' }} />
  if (abertura === 'entrar') return <Entrar estado={{ fase: 'entrar', aoEntrar: () => void conferir() }} />
  return <Loja />
}

/** A loja abre sobre o banco da loja, depois que há administradora. */
function Loja() {
  const operadores = useOperadores()
  if (operadores.fase === 'carregando') return <Entrar estado={{ fase: 'iniciando' }} />
  if (operadores.fase === 'erro') {
    return <Entrar estado={{ fase: 'erro', causa: operadores.causa, mensagem: operadores.mensagem, podeTentar: true }} tentarDeNovo={() => void recarregarOperadores()} />
  }
  if (!operadores.dado.pessoas.some((p) => p.admin)) return <PrimeiraAbertura />
  return <RouterProvider router={roteador} />
}
