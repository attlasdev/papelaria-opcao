import { RouterProvider } from 'react-router'
import { roteador } from './rotas'
import { recarregarOperadores, useOperadores } from './dados/operadores'
import { useSincronia } from './dados/sincronia'
import { Entrar, PrimeiraAbertura } from './telas/entrar/Entrar'

/** A loja só abre depois que a sincronia decidiu qual base vale e há administradora. */
export default function App() {
  const estado = useSincronia()
  if (estado.fase !== 'pronto') return <Entrar estado={estado} />
  return <Loja />
}

function Loja() {
  const operadores = useOperadores()
  if (operadores.fase === 'carregando') return <Entrar estado={{ fase: 'iniciando' }} />
  if (operadores.fase === 'erro') {
    return <Entrar estado={{ fase: 'erro', causa: operadores.causa, mensagem: operadores.mensagem, podeTentar: true }} tentarDeNovo={() => void recarregarOperadores()} />
  }
  if (!operadores.dado.pessoas.some((p) => p.admin)) return <PrimeiraAbertura />
  return <RouterProvider router={roteador} />
}
