import { useId, useRef, useState, type FormEvent } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Modal } from '../../componentes/modal/Modal'
import { dataHora, reais } from '../../formatar'
import { abrirTurnoCaixa, fecharTurnoCaixa, resumoTurnoCaixa, textoDiferencaCaixa, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import './conferencia-caixa.css'

type Props = { acao: 'abrir' | 'fechar'; aoFechar: () => void; aoConcluir: (mensagem: string) => void }

/** Abertura e fechamento explícitos: sair da janela não encerra o caixa. */
export function ConferenciaCaixa({ acao, aoFechar, aoConcluir }: Props) {
  const id = useId()
  const formulario = useRef<HTMLFormElement>(null)
  const base = useEstadoDemonstracao()
  const aberto = (base.turnosCaixa ?? []).find((turno) => !turno.fechadoEm)
  const [contado, setContado] = useState<number | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const resumo = aberto ? resumoTurnoCaixa(base, aberto) : null
  const diferenca = resumo && contado !== null ? contado - resumo.esperado : null
  const fechamento = acao === 'fechar'

  function falhar(mensagem: string, campo = 'contado') {
    setErro(mensagem)
    formulario.current?.querySelector<HTMLInputElement>(`[name="${campo}"]`)?.focus()
  }

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (contado === null) return falhar('Informe quanto você contou na gaveta.')
    if (!fechamento) {
      if (!abrirTurnoCaixa(contado)) return falhar('Não foi possível abrir. Confira o valor e se já existe um caixa aberto.')
      aoConcluir(`Caixa aberto com ${reais(contado)}.`)
      return
    }
    if (!aberto) return falhar('Este caixa já foi fechado. Consulte o histórico.')
    if (diferenca !== 0 && !justificativa.trim()) return falhar('Informe o motivo da diferença para fechar o caixa.', 'justificativa')
    if (!fecharTurnoCaixa(aberto.id, contado, justificativa)) return falhar('Não foi possível fechar o caixa. Confira os valores.')
    aoConcluir(`Caixa fechado com ${reais(contado)}. ${textoDiferencaCaixa(diferenca ?? 0)}`)
  }

  return (
    <Modal estreito titulo={fechamento ? 'Fechar caixa' : 'Abrir caixa'} aoFechar={aoFechar}
      rodape={<><Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" icone="check" type="submit" form={id}>{fechamento ? 'Fechar caixa' : 'Abrir caixa'}</Botao></>}
    >
      <form ref={formulario} id={id} className="conferencia-caixa" onSubmit={confirmar} noValidate>
        {fechamento && aberto && resumo ? <>
          <p className="conferencia-caixa__nota">Aberto em {dataHora(aberto.abertoEm)} por {aberto.operadorAbertura}.</p>
          <dl className="conferencia-caixa__resumo">
            <div><dt>Dinheiro na abertura</dt><dd>{reais(aberto.fundoInicial)}</dd></div>
            <div><dt>Entradas em dinheiro</dt><dd>{reais(resumo.entradas)}</dd></div>
            <div><dt>Saídas em dinheiro, incluindo retiradas</dt><dd>{reais(resumo.saidas)}</dd></div>
            <div className="conferencia-caixa__esperado"><dt>Esperado na gaveta</dt><dd>{reais(resumo.esperado)}</dd></div>
          </dl>
        </> : <p className="conferencia-caixa__nota">Conte as notas e moedas da gaveta, incluindo o troco. Informe o total.</p>}
        <CampoMoeda rotulo={fechamento ? 'Quanto você contou na gaveta? (R$)' : 'Quanto há na gaveta? (R$)'} name="contado" valorCentavos={contado} aoMudar={(valor) => { setContado(valor); setErro('') }} autoFocus required erro={Boolean(erro) && contado === null} />
        {fechamento && diferenca !== null && <p className={`conferencia-caixa__diferenca${diferenca !== 0 ? ' conferencia-caixa__diferenca--atencao' : ''}`} role="status">{textoDiferencaCaixa(diferenca)}</p>}
        {fechamento && diferenca !== null && diferenca !== 0 && <Campo rotulo="Motivo da diferença" name="justificativa" required value={justificativa} onChange={(evento) => { setJustificativa(evento.target.value); setErro('') }} placeholder="Ex.: troco entregue e não lançado" erro={Boolean(erro) && !justificativa.trim()} />}
        {erro && <p className="conferencia-caixa__erro" role="alert">{erro}</p>}
      </form>
    </Modal>
  )
}
