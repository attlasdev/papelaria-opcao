import { useNavigate, useSearchParams } from 'react-router'
import { rotas } from '../../rotas-caminhos'
import { ModalProduto } from '../cadastrar-produto/CadastrarProduto'
import { CriarFicha } from './CriarFicha'

/**
 * Cadastro completo aberto pela ficha, quando o produto bipado não existe. A
 * ficha fica atrás da janela e é para ela que se volta, salvando ou cancelando;
 * salvando, o produto novo já volta inserido com 1 (`2026-10-23`).
 */
export function CadastrarProdutoNaFicha() {
  const navegar = useNavigate()
  const [busca] = useSearchParams()
  return (
    <>
      <CriarFicha />
      <ModalProduto
        codigoInicial={busca.get('codigo') ?? ''}
        aoFechar={() => navegar(rotas.criarFicha)}
        aoSalvar={(codigo) => navegar(rotas.criarFicha, { state: { inserir: codigo } })}
      />
    </>
  )
}
