import { useId, useRef, useState, type FormEvent } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Modal } from '../../componentes/modal/Modal'
import { reais } from '../../formatar'
import { movimentarDinheiroCaixa } from '../../mock/estado-demonstracao'
import './conferencia-caixa.css'

export function MovimentarDinheiro({ acao, aoFechar, aoConcluir }: { acao: 'adicionar' | 'retirar'; aoFechar: () => void; aoConcluir: (mensagem: string) => void }) {
  const id = useId()
  const formulario = useRef<HTMLFormElement>(null)
  const [valor, setValor] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const adicionando = acao === 'adicionar'
  const rotuloMotivo = adicionando ? 'Origem ou motivo' : 'Destino ou motivo'

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    const campo = valor === null || valor <= 0 ? 'valor' : !motivo.trim() ? 'motivo' : null
    if (campo) {
      setErro(campo === 'valor' ? 'Informe um valor maior que zero.' : `Informe ${adicionando ? 'a origem' : 'o destino'} ou motivo.`)
      formulario.current?.querySelector<HTMLInputElement>(`[name="${campo}"]`)?.focus()
      return
    }
    if (!movimentarDinheiroCaixa(acao, valor!, motivo)) { setErro('Não foi possível registrar. Confira o valor e se o caixa está aberto.'); return }
    aoConcluir(adicionando ? `${reais(valor!)} adicionados à gaveta.` : `Retirada de ${reais(valor!)} registrada.`)
  }

  return <Modal estreito titulo={adicionando ? 'Adicionar dinheiro' : 'Retirar dinheiro'} aoFechar={aoFechar}
    rodape={<><Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" icone="check" type="submit" form={id}>{adicionando ? 'Adicionar dinheiro' : 'Registrar retirada'}</Botao></>}
  >
    <form ref={formulario} id={id} className="conferencia-caixa" onSubmit={confirmar} noValidate>
      <CampoMoeda rotulo={adicionando ? 'Valor a adicionar (R$)' : 'Valor da retirada (R$)'} name="valor" valorCentavos={valor} aoMudar={(proximo) => { setValor(proximo); setErro('') }} autoFocus required erro={Boolean(erro) && (valor === null || valor <= 0)} />
      <Campo rotulo={rotuloMotivo} name="motivo" value={motivo} onChange={(evento) => { setMotivo(evento.target.value); setErro('') }} placeholder={adicionando ? 'Ex.: dinheiro do cofre para troco' : 'Ex.: guardado no cofre'} required erro={Boolean(erro) && !motivo.trim()} />
      <p className="conferencia-caixa__nota">{adicionando ? 'O valor aumenta o dinheiro esperado na gaveta e fica no histórico. Não entra como receita.' : 'O valor diminui o dinheiro esperado na gaveta e fica no histórico. Não entra como despesa.'}</p>
      <p className="conferencia-caixa__nota">{adicionando ? 'Para registrar uma venda ou receber uma notinha, use a ficha.' : 'Para pagar uma compra ou conta da papelaria, registre uma despesa.'}</p>
      {erro && <p className="conferencia-caixa__erro" role="alert">{erro}</p>}
    </form>
  </Modal>
}
