import { useState, type FormEvent } from 'react'
import type { Assinatura, Resultado } from '../../../comum/contrato'
import { useOperadores } from '../../dados/operadores'
import { tituloFalha } from '../../falhas'
import { Botao } from '../botao/Botao'
import { Filtros } from '../filtros/Filtros'
import { Modal } from '../modal/Modal'
import { CampoPin, pinCompleto } from './CampoPin'
import './janela-assinatura.css'

type Props<T> = {
  /** O gesto, ex.: "Marcar boleto como pago". Vai no subtítulo. */
  gesto: string
  rotuloConfirmar: string
  /** Gesto só da dona (`R-OPERADOR-03`): ela vem marcada e é a única opção. */
  soDona?: boolean
  /**
   * Gesto sensível (`R-OPERADOR-06`): depois de quem faz, o PIN da dona, que
   * autoriza. Se quem faz é a dona, um PIN basta.
   */
  sensivel?: boolean
  /**
   * A operação do gesto, com a assinatura dentro: o back confere o PIN na mesma
   * chamada. `dona` só nos gestos sensíveis, `null` quando quem faz é ela.
   */
  fazer: (assinatura: Assinatura, dona: Assinatura | null) => Promise<Resultado<T>>
  aoConcluir: (dado: T) => void
  aoFechar: () => void
}

/** Falha da autorização: o back põe "Administradora:" na frente (`comum/regras/operador.ts`). */
const PREFIXO_DONA = 'Administradora: '

/**
 * "Quem está fazendo?" (`R-OPERADOR-02`): no fim de cada gesto que grava, a
 * pessoa e o PIN dela; no gesto sensível, depois o PIN da administradora. PIN
 * errado deixa a janela aberta para tentar de novo.
 */
export function JanelaAssinatura<T>({ gesto, rotuloConfirmar, soDona, sensivel, fazer, aoConcluir, aoFechar }: Props<T>) {
  const operadores = useOperadores()
  const todas = operadores.fase === 'pronto' ? operadores.dado.pessoas.filter((p) => p.ativo && p.temPin) : []
  const pessoas = soDona ? todas.filter((p) => p.admin) : todas
  const dona = todas.find((p) => p.admin)
  const marcada = soDona ? pessoas[0]?.id : operadores.fase === 'pronto' ? operadores.dado.ultimoId ?? undefined : undefined
  const [escolhida, setEscolhida] = useState<string | undefined>(marcada)
  const [pin, setPin] = useState('')
  const [pinDona, setPinDona] = useState('')
  /** No gesto sensível, o segundo passo: a dona autoriza. */
  const [passo, setPasso] = useState<'quem' | 'dona'>('quem')
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const quem = escolhida ?? marcada
  const quemEDona = quem !== undefined && quem === dona?.id
  const pinDaVez = passo === 'dona' ? pinDona : pin

  async function enviar(autorizacao: Assinatura | null) {
    setEnviando(true)
    setErro(null)
    const r = await fazer({ operadorId: quem!, pin }, autorizacao)
    setEnviando(false)
    if (r.ok) return aoConcluir(r.dado)
    const mensagem = r.causa === 'validacao' || r.causa === 'permissao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`
    // Erro do PIN da dona fica no passo dela; o resto volta para quem faz.
    if (autorizacao && mensagem.startsWith(PREFIXO_DONA)) {
      setErro(mensagem.slice(PREFIXO_DONA.length))
      setPinDona('')
    } else {
      setErro(mensagem)
      setPin('')
      setPinDona('')
      setPasso('quem')
    }
    setTentativa((n) => n + 1)
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!quem || !pinCompleto(pinDaVez) || enviando) return
    if (passo === 'dona') return enviar({ operadorId: dona!.id, pin: pinDona })
    if (sensivel && !quemEDona) {
      setErro(null)
      setPasso('dona')
      return
    }
    return enviar(null)
  }

  const titulo = soDona || passo === 'dona' ? 'PIN da administradora' : 'Quem está fazendo?'
  const rotulo = sensivel && !quemEDona && passo === 'quem' ? 'Continuar' : rotuloConfirmar

  return (
    <Modal
      estreito
      titulo={titulo}
      subtitulo={gesto}
      aoFechar={aoFechar}
      rodape={
        <>
          {passo === 'dona'
            ? <Botao variante="fantasma" onClick={() => { setPasso('quem'); setPinDona(''); setErro(null) }}>Voltar</Botao>
            : <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>}
          <Botao type="submit" form="janela-assinatura" variante="primario" disabled={!quem || !pinCompleto(pinDaVez) || enviando}>
            {enviando ? 'Conferindo…' : rotulo}
          </Botao>
        </>
      }
    >
      <form id="janela-assinatura" className="janela-assinatura" onSubmit={confirmar}>
        {operadores.fase === 'carregando' && <p className="janela-assinatura__texto">Carregando as pessoas…</p>}
        {operadores.fase === 'erro' && <p className="janela-assinatura__erro">{operadores.mensagem}</p>}
        {operadores.fase === 'pronto' && pessoas.length === 0 && (
          <p className="janela-assinatura__erro">Nenhuma pessoa com PIN. A administradora precisa cadastrar.</p>
        )}
        {passo === 'dona' ? (
          <>
            <p className="janela-assinatura__texto">{dona?.nome} autoriza</p>
            <CampoPin
              key={`dona-${tentativa}`}
              rotulo="PIN da administradora"
              valor={pinDona}
              aoMudar={(novo) => { setPinDona(novo); setErro(null) }}
              erro={Boolean(erro)}
              ajuda={erro ?? undefined}
              autoFocus
              disabled={enviando}
            />
          </>
        ) : (
          <>
            {soDona && pessoas[0] && <p className="janela-assinatura__texto">{pessoas[0].nome}</p>}
            {!soDona && pessoas.length > 0 && (
              <Filtros
                rotulo="Pessoa"
                opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }))}
                valor={quem ?? ''}
                aoMudar={(id) => { setEscolhida(id); setErro(null) }}
              />
            )}
            {pessoas.length > 0 && (
              <CampoPin
                key={`${quem}-${tentativa}`}
                rotulo="PIN"
                valor={pin}
                aoMudar={(novo) => { setPin(novo); setErro(null) }}
                erro={Boolean(erro)}
                ajuda={erro ?? undefined}
                autoFocus={Boolean(quem)}
                disabled={!quem || enviando}
              />
            )}
            {sensivel && !quemEDona && quem && (
              <p className="janela-assinatura__nota">Depois, a administradora autoriza com o PIN dela.</p>
            )}
          </>
        )}
      </form>
    </Modal>
  )
}
