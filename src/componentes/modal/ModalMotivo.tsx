import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Botao } from '../botao/Botao'
import { Campo } from '../campo/Campo'
import { Modal } from './Modal'
import './modal-motivo.css'

type Props = {
  titulo: string
  subtitulo?: string
  /** O que vai acontecer ao confirmar, dito antes: nada muda até lá. */
  consequencias: ReactNode
  textoConfirmar: string
  aoConfirmar: (motivo: string) => void
  aoFechar: () => void
}

/**
 * Desfazer algo já lançado (ficha, recebimento, lançamento do caixa). Nada é
 * apagado: o registro fica e ganha o motivo, que é obrigatório.
 */
export function ModalMotivo({ titulo, subtitulo, consequencias, textoConfirmar, aoConfirmar, aoFechar }: Props) {
  const idFormulario = useId()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState(false)

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!motivo.trim()) return setErro(true)
    aoConfirmar(motivo.trim())
  }

  return (
    <Modal
      estreito
      titulo={titulo}
      subtitulo={subtitulo}
      aoFechar={aoFechar}
      rodape={<>
        <Botao variante="fantasma" onClick={aoFechar}>Voltar</Botao>
        <Botao type="submit" form={idFormulario} variante="primario" icone="check">{textoConfirmar}</Botao>
      </>}
    >
      <form id={idFormulario} className="modal-motivo" onSubmit={confirmar} noValidate>
        <div className="modal-motivo__consequencias">{consequencias}</div>
        <Campo
          rotulo="Motivo"
          name="motivo"
          autoFocus
          value={motivo}
          onChange={(e) => { setMotivo(e.target.value); setErro(false) }}
          placeholder="Ex.: valor digitado errado"
          erro={erro}
          ajuda={erro ? 'Informe o motivo. Ele fica no registro.' : 'Fica no registro, junto com a data.'}
        />
      </form>
    </Modal>
  )
}
