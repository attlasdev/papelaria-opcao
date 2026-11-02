import { useId, useRef, useState, type FormEvent } from 'react'
import type { CaixaDetalhe } from '../../../comum/contrato'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Botao } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Modal } from '../../componentes/modal/Modal'
import { api } from '../../dados/api'
import { dataHora, reais } from '../../formatar'
import { textoDiferencaCaixa } from './comum'
import './conferencia-caixa.css'

type Props = { acao: 'abrir' | 'fechar'; aberto: CaixaDetalhe | null; aoFechar: () => void; aoConcluir: (mensagem: string) => void }

/**
 * Abertura e fechamento explícitos: sair da janela não encerra o caixa. A
 * contagem e o motivo da diferença, depois quem está fazendo (`R-CAIXA-09`).
 * O esperado é o do back; ele confere de novo ao fechar.
 */
export function ConferenciaCaixa({ acao, aberto, aoFechar, aoConcluir }: Props) {
  const id = useId()
  const formulario = useRef<HTMLFormElement>(null)
  const [contado, setContado] = useState<number | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const [assinando, setAssinando] = useState(false)
  const resumo = aberto?.resumo ?? null
  const diferenca = resumo && contado !== null ? contado - resumo.esperado : null
  const fechamento = acao === 'fechar'

  function falhar(mensagem: string, campo = 'contado') {
    setErro(mensagem)
    formulario.current?.querySelector<HTMLInputElement>(`[name="${campo}"]`)?.focus()
  }

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (contado === null) return falhar('Informe quanto você contou na gaveta.')
    if (fechamento && diferenca !== 0 && !justificativa.trim()) return falhar('Informe o motivo da diferença para fechar o caixa.', 'justificativa')
    setAssinando(true)
  }

  if (assinando && contado !== null) {
    return (
      <JanelaAssinatura
        gesto={fechamento ? `Fechar o caixa com ${reais(contado)}` : `Abrir o caixa com ${reais(contado)}`}
        rotuloConfirmar={fechamento ? 'Fechar caixa' : 'Abrir caixa'}
        fazer={(quem) => (fechamento ? api().fecharCaixa(contado, justificativa, quem) : api().abrirCaixa(contado, quem))}
        aoConcluir={(caixa) => aoConcluir(fechamento
          ? `Caixa fechado com ${reais(contado)}. ${textoDiferencaCaixa(caixa.fechamento?.diferenca ?? 0)}${caixa.fechamento && caixa.fechamento.diferenca !== 0 && !caixa.fechamento.conferidoPor ? ' Aguarda o visto da dona.' : ''}`
          : `Caixa aberto com ${reais(contado)}.`)}
        aoFechar={() => setAssinando(false)}
      />
    )
  }

  return (
    <Modal estreito titulo={fechamento ? 'Fechar caixa' : 'Abrir caixa'} aoFechar={aoFechar}
      rodape={<><Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" icone="check" type="submit" form={id}>{fechamento ? 'Fechar caixa' : 'Abrir caixa'}</Botao></>}
    >
      <form ref={formulario} id={id} className="conferencia-caixa" onSubmit={confirmar} noValidate>
        {fechamento && aberto && resumo ? <>
          <p className="conferencia-caixa__nota">Aberto em {dataHora(aberto.abertoEm)} por {aberto.operadorAbertura}.</p>
          <dl className="conferencia-caixa__resumo">
            <div><dt>Dinheiro na abertura</dt><dd>{reais(aberto.dinheiroAbertura)}</dd></div>
            <div><dt>Entradas em dinheiro</dt><dd>{reais(resumo.entradas)}</dd></div>
            <div><dt>Saídas em dinheiro, incluindo retiradas</dt><dd>{reais(resumo.saidas)}</dd></div>
            <div className="conferencia-caixa__esperado"><dt>Esperado na gaveta</dt><dd>{reais(resumo.esperado)}</dd></div>
          </dl>
        </> : <p className="conferencia-caixa__nota">Conte as notas e moedas da gaveta, incluindo o troco. Informe o total.</p>}
        <CampoMoeda rotulo={fechamento ? 'Quanto você contou na gaveta? (R$)' : 'Quanto há na gaveta? (R$)'} name="contado" valorCentavos={contado} aoMudar={(valor) => { setContado(valor); setErro('') }} autoFocus required erro={Boolean(erro) && contado === null} />
        {fechamento && diferenca !== null && <p className={`conferencia-caixa__diferenca${diferenca !== 0 ? ' conferencia-caixa__diferenca--atencao' : ''}`} role="status">{textoDiferencaCaixa(diferenca)}</p>}
        {fechamento && diferenca !== null && diferenca !== 0 && <>
          <Campo rotulo="Motivo da diferença" name="justificativa" required value={justificativa} onChange={(evento) => { setJustificativa(evento.target.value); setErro('') }} placeholder="Ex.: troco entregue e não lançado" erro={Boolean(erro) && !justificativa.trim()} />
          <p className="conferencia-caixa__nota">Com diferença, o fechamento fica aguardando o visto da dona.</p>
        </>}
        {erro && <p className="conferencia-caixa__erro" role="alert">{erro}</p>}
      </form>
    </Modal>
  )
}
