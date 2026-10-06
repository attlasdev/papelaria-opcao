import { useEffect, useRef, useState } from 'react'
import type { Cobranca, MeioCobranca } from '../../../../comum/contrato'
import { Botao } from '../../../componentes/botao/Botao'
import { Icone, type NomeIcone } from '../../../componentes/icone/Icone'
import { Modal } from '../../../componentes/modal/Modal'
import { reais } from '../../../formatar'
import './janela-cobranca.css'

type Props = {
  valor: number
  meio: MeioCobranca
  /** Identifica a venda no extrato do Mercado Pago. */
  referencia: string
  /** Aprovada: a venda é registrada com o que a maquininha devolveu. */
  aoAprovar: (cobranca: Cobranca) => void
  /** Desistiu, ou vai usar outra forma: a cobrança aberta é cancelada antes. */
  aoFechar: () => void
}

const NOME_MEIO: Record<MeioCobranca, string> = { credito: 'Crédito', debito: 'Débito', pix: 'Pix' }
const CONSULTA_MS = 1500
/** Tempo para a pessoa ler "Aprovado" antes de a venda concluir sozinha. */
const LEITURA_MS = 1400

type Etapa = { chave: string; texto: string; icone: NomeIcone }

/**
 * Inícios de cobrança em fila. A maquininha aceita uma cobrança aberta por vez;
 * se a janela for montada de novo (o React em desenvolvimento monta duas vezes,
 * e um clique duplo faria o mesmo), a tentativa nova só começa depois que a
 * anterior desistiu e cancelou a dela. Sem isto, a segunda dava "já há uma
 * cobrança aberta".
 */
let fila: Promise<void> = Promise.resolve()

/**
 * A cobrança na maquininha integrada (Mercado Pago), do envio ao resultado.
 * Consulta a situação a cada 1,5 s; aprovada, conclui a venda sozinha.
 * Fechar a janela no meio cancela a cobrança: a maquininha aceita só uma
 * aberta por vez (visto na prova real contra o Mercado Pago).
 */
export function JanelaCobranca({ valor, meio, referencia, aoAprovar, aoFechar }: Props) {
  const [cobranca, setCobranca] = useState<Cobranca | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const atual = useRef<Cobranca | null>(null)
  const concluiu = useRef(false)

  // Uma cobrança por tentativa: inicia, consulta até terminar.
  useEffect(() => {
    let vivo = true
    let relogio: number | undefined
    setCobranca(null)
    setErro(null)
    async function consultar(id: string) {
      const r = await window.api.consultarCobranca(id)
      if (!vivo) return
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      atual.current = r.dado
      setCobranca(r.dado)
      if (r.dado.situacao === 'enviando' || r.dado.situacao === 'na-maquininha') relogio = window.setTimeout(() => void consultar(id), CONSULTA_MS)
    }
    const vez = fila.then(async () => {
      if (!vivo) return
      const r = await window.api.iniciarCobranca({ valor, meio, referencia })
      if (!vivo) {
        if (r.ok) await window.api.cancelarCobranca(r.dado.id)
        return
      }
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      atual.current = r.dado
      setCobranca(r.dado)
      relogio = window.setTimeout(() => void consultar(r.dado.id), CONSULTA_MS)
    })
    fila = vez.catch(() => {})
    return () => {
      vivo = false
      window.clearTimeout(relogio)
    }
  }, [valor, meio, referencia, tentativa])

  // Aprovada: mostra o resultado um instante e registra a venda.
  useEffect(() => {
    if (cobranca?.situacao !== 'aprovada' || concluiu.current) return
    concluiu.current = true
    const relogio = window.setTimeout(() => aoAprovar(cobranca), LEITURA_MS)
    return () => window.clearTimeout(relogio)
  }, [cobranca, aoAprovar])

  const aberta = cobranca && (cobranca.situacao === 'enviando' || cobranca.situacao === 'na-maquininha')

  /** Sair: se ainda está na maquininha, cancela lá primeiro. */
  async function sair() {
    if (concluiu.current) return
    const c = atual.current
    if (c && (c.situacao === 'enviando' || c.situacao === 'na-maquininha')) await window.api.cancelarCobranca(c.id)
    aoFechar()
  }

  async function simularRecusa() {
    if (!cobranca) return
    const r = await window.api.simularCobranca(cobranca.id, 'recusada')
    if (r.ok) {
      atual.current = r.dado
      setCobranca(r.dado)
    }
  }

  const naMaquininha = meio === 'pix'
    ? 'O QR Code apareceu na maquininha. Peça para o cliente pagar pelo app do banco.'
    : 'Peça para o cliente inserir ou aproximar o cartão na maquininha.'
  const etapas: Etapa[] = [
    { chave: 'enviando', texto: `Enviando ${reais(valor)} para a maquininha Mercado Pago`, icone: 'enviar' },
    { chave: 'na-maquininha', texto: naMaquininha, icone: meio === 'pix' ? 'pix' : 'cartao' },
    { chave: 'resultado', texto: 'Pagamento confirmado pela maquininha', icone: 'confirmado' },
  ]
  const ordem = ['enviando', 'na-maquininha', 'resultado']
  const passo = !cobranca ? 0 : cobranca.situacao === 'enviando' ? 0 : cobranca.situacao === 'na-maquininha' ? 1 : 2
  const final = cobranca && !aberta
  const sucesso = cobranca?.situacao === 'aprovada'

  const resultado = !cobranca ? null
    : cobranca.situacao === 'aprovada' ? { tom: 'ok', titulo: `Aprovado: ${NOME_MEIO[meio]}${cobranca.bandeira ? ` ${cobranca.bandeira}` : ''}`, texto: 'Registrando a venda…' }
    : cobranca.situacao === 'recusada' ? { tom: 'erro', titulo: 'Pagamento recusado', texto: cobranca.motivo ?? 'A maquininha recusou o pagamento.' }
    : cobranca.situacao === 'cancelada' ? { tom: 'erro', titulo: 'Cobrança cancelada', texto: 'A cobrança foi cancelada na maquininha.' }
    : cobranca.situacao === 'expirada' ? { tom: 'erro', titulo: 'O tempo acabou', texto: 'Ninguém pagou a tempo e a cobrança expirou.' }
    : null

  return (
    <Modal
      estreito
      titulo={`Cobrança na maquininha · ${NOME_MEIO[meio]}`}
      subtitulo={cobranca?.demonstracao ? 'Demonstração: a maquininha é simulada nesta versão.' : undefined}
      aoFechar={() => void sair()}
      rodape={
        erro || (final && !sucesso) ? (
          <>
            <Botao variante="fantasma" onClick={() => void sair()}>Usar outra forma</Botao>
            <Botao variante="primario" icone="historico" onClick={() => { concluiu.current = false; setTentativa((t) => t + 1) }}>Tentar de novo</Botao>
          </>
        ) : sucesso ? null : (
          <>
            {cobranca?.demonstracao && aberta && <Botao variante="fantasma" tamanho="pequeno" className="janela-cobranca__simular" onClick={() => void simularRecusa()}>Simular recusa</Botao>}
            <Botao variante="secundario" onClick={() => void sair()}>Cancelar cobrança</Botao>
          </>
        )
      }
    >
      <div className="janela-cobranca">
        <p className="janela-cobranca__valor">{reais(valor)}</p>
        {erro ? (
          <p className="janela-cobranca__erro" role="alert">
            <Icone nome="alerta" tamanho={18} /> {erro} Sem conexão com a maquininha? Use a maquininha Sicoob ou o Pix manual.
          </p>
        ) : (
          <ol className="janela-cobranca__etapas" aria-live="polite">
            {etapas.map((e, i) => {
              const estado = i < passo || (final && sucesso) ? 'feita' : i === passo && !final ? 'atual' : 'futura'
              if (e.chave === 'resultado' && final && !sucesso) return null
              return (
                <li key={e.chave} className={`janela-cobranca__etapa janela-cobranca__etapa--${estado}`} aria-current={estado === 'atual' ? 'step' : undefined}>
                  <span className="janela-cobranca__marca"><Icone nome={estado === 'feita' ? 'check' : e.icone} tamanho={16} /></span>
                  <span>{e.texto}{estado === 'atual' && ordem[i] !== 'resultado' && !e.texto.endsWith('.') ? '…' : ''}</span>
                </li>
              )
            })}
          </ol>
        )}
        {resultado && (
          <div className={`janela-cobranca__resultado janela-cobranca__resultado--${resultado.tom}`} role="status">
            <Icone nome={resultado.tom === 'ok' ? 'confirmado' : 'erro'} tamanho={22} />
            <div>
              <strong>{resultado.titulo}</strong>
              <p>{resultado.texto}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
