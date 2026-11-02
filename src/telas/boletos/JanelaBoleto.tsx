import { useEffect, useState, type FormEvent } from 'react'
import type { Boleto, Falha } from '../../../comum/contrato'
import { diaValido } from '../../../comum/regras/entrada'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Botao } from '../../componentes/botao/Botao'
import { Campo, CampoData } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Modal } from '../../componentes/modal/Modal'
import { ModalMotivo } from '../../componentes/modal/ModalMotivo'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataHora, reais } from '../../formatar'

type Props = {
  /** Corrigir um boleto já anotado; sem isto, é um novo. */
  atual?: Boleto
  aoFechar: () => void
  /** Gravou alguma coisa: a lista relê. */
  aoMudar: () => void
}

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)
const paraComparar = (numero: string) => numero.trim().toLowerCase()

/**
 * Anotar um boleto: o que é, quanto, o número do arquivo da dona e o
 * vencimento. A data de cadastro é gravada sozinha ao salvar. Cadastro: sem
 * PIN (`R-OPERADOR-02`); excluir pede motivo e PIN (D7).
 */
export function JanelaBoleto({ atual, aoFechar, aoMudar }: Props) {
  const [descricao, setDescricao] = useState(atual?.descricao ?? '')
  const [valor, setValor] = useState<number | null>(atual?.valor ?? null)
  const [numero, setNumero] = useState(atual?.numero ?? '')
  const [vencimento, setVencimento] = useState(atual?.vencimento ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Número repetido só avisa (`R-BOLETO-02`): os outros boletos vêm do back uma vez.
  const [outros, setOutros] = useState<Boleto[]>([])
  useEffect(() => {
    let vivo = true
    void api().listarBoletos('todos', '').then((r) => { if (vivo && r.ok) setOutros(r.dado.boletos) })
    return () => { vivo = false }
  }, [])
  const repetido = paraComparar(numero) ? outros.find((b) => b.id !== atual?.id && paraComparar(b.numero) === paraComparar(numero)) : undefined

  async function salvar(evento: FormEvent) {
    evento.preventDefault()
    if (!descricao.trim()) return setErro('Informe a descrição do boleto.')
    if (valor === null || valor <= 0) return setErro('Informe o valor do boleto.')
    if (!numero.trim()) return setErro('Informe o número do boleto.')
    if (!diaValido(vencimento)) return setErro('Informe o vencimento.')
    const dados = { descricao, valor, numero, vencimento }
    setEnviando(true)
    const r = atual ? await api().editarBoleto(atual.id, dados) : await api().cadastrarBoleto(dados)
    setEnviando(false)
    if (!r.ok) return setErro(mensagem(r))
    aoMudar()
    aoFechar()
  }

  return (
    <Modal
      estreito
      titulo={atual ? 'Editar boleto' : 'Cadastrar boleto'}
      aoFechar={aoFechar}
      rodape={
        <>
          {atual && <AcaoExcluir boleto={atual} aoConcluir={() => { aoMudar(); aoFechar() }} />}
          {erro && <span className="janela-boleto__erro" role="alert">{erro}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" icone="check" type="submit" form="janela-boleto" disabled={enviando}>{atual ? 'Salvar alterações' : 'Salvar boleto'}</Botao>
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

/** Boleto anotado por engano: o motivo, depois quem está fazendo; vira "excluído" (D7). */
function AcaoExcluir({ boleto, aoConcluir }: { boleto: Boleto; aoConcluir: () => void }) {
  const [passo, setPasso] = useState<'fechado' | 'motivo' | 'assinar'>('fechado')
  const [motivo, setMotivo] = useState('')
  return (
    <>
      <Botao variante="fantasma" className="janela-boleto__excluir" onClick={() => setPasso('motivo')}>
        Excluir boleto
      </Botao>
      {passo === 'motivo' && (
        <ModalMotivo
          titulo="Excluir boleto"
          subtitulo={`Nº ${boleto.numero} · ${boleto.descricao} · ${reais(boleto.valor)}`}
          consequencias={<ul><li>O boleto sai da lista e dos avisos do sino.</li><li>Fica registrado quem excluiu, quando e por quê.</li></ul>}
          textoConfirmar="Continuar"
          aoConfirmar={(texto) => { setMotivo(texto); setPasso('assinar') }}
          aoFechar={() => setPasso('fechado')}
        />
      )}
      {passo === 'assinar' && (
        <JanelaAssinatura
          gesto={`Excluir o boleto Nº ${boleto.numero} · ${motivo}`}
          rotuloConfirmar="Excluir boleto"
          fazer={(quem) => api().excluirBoleto(boleto.id, motivo, quem)}
          aoConcluir={aoConcluir}
          aoFechar={() => setPasso('fechado')}
        />
      )}
    </>
  )
}
