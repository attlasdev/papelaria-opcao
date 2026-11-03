import { RouterProvider } from 'react-router'
import { roteador } from './rotas'
import { recarregarOperadores, useOperadores } from './dados/operadores'
import { Entrar, PrimeiraAbertura } from './telas/entrar/Entrar'

/** A loja abre sobre o banco da loja, depois que há administradora. */
export default function App() {
  const operadores = useOperadores()
  if (operadores.fase === 'carregando') return <Entrar estado={{ fase: 'iniciando' }} />
  if (operadores.fase === 'erro') {
    return <Entrar estado={{ fase: 'erro', causa: operadores.causa, mensagem: operadores.mensagem, podeTentar: true }} tentarDeNovo={() => void recarregarOperadores()} />
  }
  if (!operadores.dado.pessoas.some((p) => p.admin)) return <PrimeiraAbertura />
  return <RouterProvider router={roteador} />
}
