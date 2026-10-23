import { useState, type FormEvent } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Campo, CampoData } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Modal } from '../../componentes/modal/Modal'
import { dataHora } from '../../formatar'
import { boletoComMesmoNumero, cadastrarBoleto, dataCalendarioValida, editarBoleto, excluirBoleto, useEstadoDemonstracao, type Boleto } from '../../mock/estado-demonstracao'

type Props = {
  /** Corrigir um boleto já anotado; sem isto, é um novo. */
  atual?: Boleto
  aoFechar: () => void
}

/**
 * Anotar um boleto: o que é, quanto, o número do arquivo da dona e o
 * vencimento. A data de cadastro é gravada sozinha ao salvar.
 */
export function JanelaBoleto({ atual, aoFechar }: Props) {
  const base = useEstadoDemonstracao()
  const [descricao, setDescricao] = useState(atual?.descricao ?? '')
  const [valor, setValor] = useState<number | null>(atual?.valor ?? null)
  const [numero, setNumero] = useState(atual?.numero ?? '')
  const [vencimento, setVencimento] = useState(atual?.vencimento ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const repetido = boletoComMesmoNumero(base, numero, atual?.id)

  function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!descricao.trim()) return setErro('Informe a descrição do boleto.')
    if (valor === null || valor <= 0) return setErro('Informe o valor do boleto.')
    if (!numero.trim()) return setErro('Informe o número do boleto.')
    if (!dataCalendarioValida(vencimento)) return setErro('Informe o vencimento.')
    const dados = { descricao, valor, numero, vencimento }
    const certo = atual ? editarBoleto(atual.id, dados) : cadastrarBoleto(dados)
    if (!certo) return setErro('Não foi possível salvar. Confira os campos.')
    aoFechar()
  }

  return (
    <Modal
      estreito
      titulo={atual ? 'Editar boleto' : 'Cadastrar boleto'}
      aoFechar={aoFechar}
      rodape={
        <>
          {atual && <AcaoExcluir boleto={atual} aoConcluir={aoFechar} />}
          {erro && <span className="janela-boleto__erro" role="alert">{erro}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="check" type="submit" form="janela-boleto">{atual ? 'Salvar alterações' : 'Salvar boleto'}</Botao>
        </>
      }
    >
      <form id="janela-boleto" className="janela-boleto" onSubmit={salvar} noValidate>
        <Campo rotulo="Descrição" autoFocus value={descricao} onChange={(e) => { setDescricao(e.target.value); setErro(null) }} maxLength={120} placeholder="Ex.: Fornecedor Tilibra · NF 4821" />
        <CampoMoeda rotulo="Valor (R$)" valorCentavos={valor} aoMudar={(v) => { setValor(v); setErro(null) }} />
        <Campo
          rotulo="Número do boleto"
          value={numero}
          onChange={(e) => { setNumero(e.target.value); setErro(null) }}
          maxLength={30}
          placeholder="Como está no arquivo"
          ajuda={repetido ? `Já existe o boleto Nº ${repetido.numero}: ${repetido.descricao}.` : undefined}
        />
        {/* O do app, não o nativo: o nativo controlado pulava de campo no primeiro dígito (23 virava 02/03). */}
        <CampoData rotulo="Vencimento" valor={vencimento} aoMudar={(data) => { setVencimento(data); setErro(null) }} />
        <Campo rotulo="Cadastrado em" value={atual ? dataHora(atual.cadastradoEm) : 'Preenchido ao salvar'} readOnly />
      </form>
    </Modal>
  )
}

/** Boleto anotado por engano. Pede um segundo clique, como excluir produto. */
function AcaoExcluir({ boleto, aoConcluir }: { boleto: Boleto; aoConcluir: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  return (
    <Botao
      variante="fantasma"
      className={confirmando ? 'janela-boleto__excluir janela-boleto__excluir--confirmar' : 'janela-boleto__excluir'}
      onBlur={() => setConfirmando(false)}
      onClick={() => {
        if (!confirmando) return setConfirmando(true)
        excluirBoleto(boleto.id)
        aoConcluir()
      }}
    >
      {confirmando ? 'Confirmar: excluir boleto' : 'Excluir boleto'}
    </Botao>
  )
}
