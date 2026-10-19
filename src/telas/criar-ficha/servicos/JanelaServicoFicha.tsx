import { useState, type FormEvent } from 'react'
import { Botao } from '../../../componentes/botao/Botao'
import { Campo } from '../../../componentes/campo/Campo'
import { CampoMoeda } from '../../../componentes/campo/CampoMoeda'
import { Modal } from '../../../componentes/modal/Modal'
import type { ServicoVenda } from '../../../mock/estado-demonstracao'
import './servicos-ficha.css'

type Props = {
  /** Editar um serviço já posto na ficha; sem isto, é um novo. */
  atual?: ServicoVenda
  aoSalvar: (servico: ServicoVenda) => void
  aoFechar: () => void
}

/**
 * Pôr um serviço na ficha: o que foi feito (texto livre, sem cadastro), o valor
 * cobrado e, se houve, quantas unidades se perderam, com uma observação livre.
 * Perdas são só conferência: não mexem no estoque.
 */
export function JanelaServicoFicha({ atual, aoSalvar, aoFechar }: Props) {
  const [nome, setNome] = useState(atual?.nome ?? '')
  const [valor, setValor] = useState<number | null>(atual?.valor ?? null)
  const [perdas, setPerdas] = useState(atual?.perdas ? String(atual.perdas.quantidade) : '')
  const [observacao, setObservacao] = useState(atual?.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const qtdPerdas = perdas.trim() ? Number(perdas) : 0

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!nome.trim()) return setErro('Informe o serviço.')
    if (valor === null || valor < 0) return setErro('Informe o valor cobrado.')
    if (!Number.isInteger(qtdPerdas) || qtdPerdas < 0) return setErro('As perdas são um número inteiro.')
    aoSalvar({
      nome: nome.trim(),
      valor,
      ...(qtdPerdas > 0 ? { perdas: { quantidade: qtdPerdas } } : {}),
      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
    })
  }

  return (
    <Modal
      estreito
      titulo={atual ? 'Editar serviço da ficha' : 'Inserir serviço'}
      aoFechar={aoFechar}
      rodape={
        <>
          {erro && <span className="servico-ficha__erro" role="alert">{erro}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="check" type="submit" form="servico-ficha">{atual ? 'Salvar' : 'Inserir serviço'}</Botao>
        </>
      }
    >
      <form id="servico-ficha" className="servico-ficha" onSubmit={salvar} noValidate>
        <Campo rotulo="Serviço" autoFocus value={nome} onChange={(e) => { setNome(e.target.value); setErro(null) }} maxLength={80} placeholder="Ex.: 10 cópias coloridas" />
        <CampoMoeda rotulo="Valor cobrado (R$)" valorCentavos={valor} aoMudar={(v) => { setValor(v); setErro(null) }} />
        <Campo rotulo="Unidades perdidas" opcional type="number" min={0} inputMode="numeric" value={perdas} onChange={(e) => { setPerdas(e.target.value); setErro(null) }} placeholder="0" />
        <Campo rotulo="Observação" opcional value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={200} placeholder="Ex.: pediu 2 cópias; saíram 6, 4 manchadas pela impressora" />
      </form>
    </Modal>
  )
}
