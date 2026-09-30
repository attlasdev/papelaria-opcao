import { JanelaCliente } from '../../formulario-cliente/JanelaCliente'
import type { ClienteFicha as Cliente } from '../dados-exemplo'

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
      aoSalvar={(c) => aoSalvar({ id: c.id, nome: c.nome, documento: c.documento, telefone: c.telefone })}
    />
  )
}
