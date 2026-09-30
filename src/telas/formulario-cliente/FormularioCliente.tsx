import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { rotas } from '../../rotas-caminhos'
import { JanelaCliente } from './JanelaCliente'

/**
 * Cadastrar e editar cliente como gaveta lateral, por cima da lista (/clientes/novo)
 * ou do detalhe (/clientes/:id/editar). Fechar volta para a tela de baixo.
 */
export function CadastrarCliente() {
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.clientes), [navegar])
  return <JanelaCliente variante="lateral" aoFechar={fechar} aoSalvar={(cliente) => navegar(rotas.cliente(cliente.id))} />
}

export function EditarCliente() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.cliente(id)), [navegar, id])
  return <JanelaCliente variante="lateral" clienteId={id} aoFechar={fechar} aoSalvar={fechar} />
}
