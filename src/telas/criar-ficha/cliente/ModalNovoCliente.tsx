import { formatarDocumento, formatarTelefone } from '../../../../comum/regras/cliente'
import { JanelaCliente } from '../../formulario-cliente/JanelaCliente'
import type { ClienteFicha as Cliente } from '../tipos'

type Props = {
  /** Nome já digitado na busca, para não digitar duas vezes. */
  nomeInicial?: string
  aoSalvar: (cliente: Cliente) => void
  aoFechar: () => void
}

/** Cadastro sem sair da venda: o mesmo formulário de Clientes, em janela central. */
export function ModalNovoCliente({ nomeInicial, aoSalvar, aoFechar }: Props) {
  return (
    <JanelaCliente
      variante="central"
      nomeInicial={nomeInicial}
      subtitulo="Ao salvar, já entra na ficha."
      textoSalvar="Salvar e usar na ficha"
      aoFechar={aoFechar}
      aoSalvar={(c) => aoSalvar({
        id: c.id, nome: c.nome,
        documento: c.documento ? formatarDocumento(c.documento) : 'Sem documento',
        telefone: c.telefone ? formatarTelefone(c.telefone) : 'Sem telefone',
      })}
    />
  )
}
