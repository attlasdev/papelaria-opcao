import { RouterProvider } from 'react-router'
import { roteador } from './rotas'
import { useSincronia } from './dados/sincronia'
import { Entrar } from './telas/entrar/Entrar'

/** A loja só abre depois que a sincronia decidiu qual base vale. */
export default function App() {
  const estado = useSincronia()
  if (estado.fase !== 'pronto') return <Entrar estado={estado} />
  return <RouterProvider router={roteador} />
}
