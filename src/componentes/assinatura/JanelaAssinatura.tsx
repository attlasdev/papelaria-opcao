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
  /** A operação do gesto, com a assinatura dentro: o back confere o PIN na mesma chamada. */
  fazer: (assinatura: Assinatura) => Promise<Resultado<T>>
  aoConcluir: (dado: T) => void
  aoFechar: () => void
}

/**
 * "Quem está fazendo?" (`R-OPERADOR-02`): no fim de cada gesto que grava, a
 * pessoa e o PIN dela. PIN errado deixa a janela aberta para tentar de novo.
 */
export function JanelaAssinatura<T>({ gesto, rotuloConfirmar, soDona, fazer, aoConcluir, aoFechar }: Props<T>) {
  const operadores = useOperadores()
  const pessoas = operadores.fase === 'pronto'
    ? operadores.dado.pessoas.filter((p) => p.ativo && p.temPin && (!soDona || p.admin))
    : []
  const marcada = soDona ? pessoas[0]?.id : operadores.fase === 'pronto' ? operadores.dado.ultimoId ?? undefined : undefined
  const [escolhida, setEscolhida] = useState<string | undefined>(marcada)
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const quem = escolhida ?? marcada

  async function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!quem || !pinCompleto(pin) || enviando) return
    setEnviando(true)
    setErro(null)
    const r = await fazer({ operadorId: quem, pin })
    setEnviando(false)
    if (r.ok) return aoConcluir(r.dado)
    setErro(r.causa === 'validacao' || r.causa === 'permissao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)
    setPin('')
    setTentativa((n) => n + 1)
  }

  return (
    <Modal
      estreito
      titulo={soDona ? 'PIN da administradora' : 'Quem está fazendo?'}
      subtitulo={gesto}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="janela-assinatura" variante="primario" disabled={!quem || !pinCompleto(pin) || enviando}>
            {enviando ? 'Conferindo…' : rotuloConfirmar}
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
      </form>
    </Modal>
  )
}
