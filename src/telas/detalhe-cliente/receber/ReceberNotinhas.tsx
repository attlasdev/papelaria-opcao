import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Assinatura, Falha, MeioPagamento, ModalidadeCartao, NotinhasAbertas, Recebimento } from '../../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../../comum/regras/entrada'
import { MENSAGENS } from '../../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../../comum/regras/produto'
import { JanelaAssinatura } from '../../../componentes/assinatura/JanelaAssinatura'
import { Botao } from '../../../componentes/botao/Botao'
import { CampoData } from '../../../componentes/campo/Campo'
import { CampoMoeda } from '../../../componentes/campo/CampoMoeda'
import { Filtros } from '../../../componentes/filtros/Filtros'
import { Modal } from '../../../componentes/modal/Modal'
import { api } from '../../../dados/api'
import { detalheDaSituacao } from '../../../dados/situacao'
import { tituloFalha } from '../../../falhas'
import { dataCurta, reais } from '../../../formatar'
import { NOME_MEIO } from '../../../mock/estado-demonstracao'
import './receber-notinhas.css'

type Props = {
  clienteId: string
  /** Notinhas que já abrem marcadas. Sem isto, todas as abertas vêm marcadas. */
  marcadas?: string[]
  aoFechar: () => void
}

const MEIOS = ['dinheiro', 'pix', 'cartao'] as const

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** Recusa da assinatura (pessoa, PIN): fica na janela do PIN. O resto é do recebimento. */
const daAssinatura = (r: Falha) => r.causa === 'permissao' || r.erro === MENSAGENS_PRODUTO.semAssinatura ||
  Object.values(MENSAGENS).some((m) => typeof m === 'string' && m === r.erro) || r.erro.startsWith('Muitas tentativas erradas')

/**
 * Recebe notinhas de um cliente. A janela sempre lista todas as abertas dele,
 * então quem entrou por uma ficha vê as outras e pode marcá-las junto. O valor
 * pode ser parcial: abate da mais antiga para a mais nova; cada notinha segue
 * separada. Quem grava e confere é o back (`receberNotinhas`).
 */
export function ReceberNotinhas({ clienteId, marcadas, aoFechar }: Props) {
  const [carga, setCarga] = useState<{ fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; dado: NotinhasAbertas }>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let vivo = true
    void api().listarNotinhasAbertas(clienteId).then((r) => {
      if (vivo) setCarga(r.ok ? { fase: 'pronto', dado: r.dado } : { fase: 'erro', mensagem: mensagem(r) })
    })
    return () => { vivo = false }
  }, [clienteId, tentativa])

  if (carga.fase !== 'pronto') {
    return (
      <Modal estreito titulo="Receber notinhas" aoFechar={aoFechar} rodape={<Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>}>
        {carga.fase === 'carregando'
          ? <p className="receber-notinhas__nota" role="status">Carregando as notinhas…</p>
          : (
            <p className="receber-notinhas__erro" role="alert">
              {carga.mensagem} <Botao tamanho="pequeno" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa((n) => n + 1) }}>Tentar de novo</Botao>
            </p>
          )}
      </Modal>
    )
  }
  return <Formulario dado={carga.dado} marcadas={marcadas} aoFechar={aoFechar} aoRecarregar={() => setTentativa((n) => n + 1)} />
}

function Formulario({ dado, marcadas, aoFechar, aoRecarregar }: { dado: NotinhasAbertas; marcadas?: string[]; aoFechar: () => void; aoRecarregar: () => void }) {
  const idFormulario = useId()
  const hoje = hojeEmSaoPaulo()
  const abertas = dado.notinhas
  const totalCliente = abertas.reduce((soma, item) => soma + item.emAberto, 0)
  const [selecionadas, setSelecionadas] = useState<string[]>(() =>
    abertas.map((n) => n.id).filter((id) => !marcadas || marcadas.includes(id)))
  const notinhas = abertas.filter((n) => selecionadas.includes(n.id))
  const totalAberto = notinhas.reduce((soma, item) => soma + item.emAberto, 0)
  const [valorCentavos, setValorCentavos] = useState<number | null>(totalAberto)

  /** Marcar ou desmarcar leva o valor a pagar para o total do que está marcado. */
  function alternar(id: string) {
    const proximas = selecionadas.includes(id) ? selecionadas.filter((item) => item !== id) : [...selecionadas, id]
    setSelecionadas(proximas)
    setValorCentavos(abertas.filter((n) => proximas.includes(n.id)).reduce((t, n) => t + n.emAberto, 0))
  }
  const [meio, setMeio] = useState<MeioPagamento | 'misto'>('dinheiro')
  const [divisao, setDivisao] = useState<Record<MeioPagamento, number>>({ dinheiro: 0, pix: 0, cartao: 0 })
  const [cartao, setCartao] = useState<ModalidadeCartao>('credito')
  const [dataEscolhida, setData] = useState(hoje)
  const [entregueCentavos, setEntregueCentavos] = useState<number | null>(null)
  const [erroRegistro, setErroRegistro] = useState<string | null>(null)
  const [assinando, setAssinando] = useState(false)

  const valor = valorCentavos ?? 0
  const entregue = entregueCentavos ?? 0
  // Prévia do abatimento, da mais antiga para a mais nova; quem grava é o back.
  let resto = valor
  const abatimentos = notinhas.map((n) => {
    const abatido = Math.min(resto, n.emAberto)
    resto -= abatido
    return { id: n.id, valor: abatido }
  }).filter((a) => a.valor > 0)
  const parcelas = meio === 'misto'
    ? MEIOS.map((item) => ({ meio: item, valor: divisao[item] })).filter((parcela) => parcela.valor > 0)
    : [{ meio, valor }]
  const faltaDistribuir = valor - parcelas.reduce((soma, parcela) => soma + parcela.valor, 0)
  const parteDinheiro = meio === 'misto' ? divisao.dinheiro : meio === 'dinheiro' ? valor : 0
  const comCartao = parcelas.some((p) => p.meio === 'cartao' && p.valor > 0)
  // Em dinheiro, a data é hoje (`R-NOTINHA-05`): a nota está na gaveta de hoje.
  const data = parteDinheiro > 0 ? hoje : dataEscolhida
  // Dinheiro entregue é a cédula do cliente, só para o troco; não pode ser menor que o valor pago.
  const faltaDinheiro = parteDinheiro > 0 && entregue > 0 && entregue < parteDinheiro
  // Pagamento não pode ser anterior à venda: a notinha mais nova que ele abate é o limite.
  const dataMinima = notinhas.filter((n) => abatimentos.some((a) => a.id === n.id)).reduce((maior, n) => (n.dia > maior ? n.dia : maior), notinhas[0]?.dia ?? hoje)
  const erro = notinhas.length === 0
    ? 'Marque ao menos uma notinha.'
    : valor <= 0
    ? 'Informe o valor a pagar agora.'
    : valor > totalAberto
      ? `O valor passa do total em aberto (${reais(totalAberto)}).`
      : meio === 'misto' && parcelas.length < 2
        ? 'Informe valores em pelo menos duas formas de pagamento.'
      : faltaDistribuir !== 0
        ? 'A soma das formas de pagamento deve ser igual ao valor a pagar agora.'
      : faltaDinheiro
        ? 'O dinheiro entregue não cobre o valor a pagar.'
        : !data
          ? 'Informe a data do pagamento.'
          : data > hoje
            ? 'A data do pagamento não pode ser depois de hoje.'
            : data < dataMinima
              ? `A data do pagamento é anterior à notinha (${dataCurta(dataMinima)}).`
              : null

  const recebimento: Recebimento = {
    notinhas: notinhas.map((n) => n.id), dia: data, parcelas,
    cartao: comCartao ? cartao : null, recebido: parteDinheiro > 0 && entregue > 0 ? entregue : null,
  }

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!erro) setAssinando(true)
  }

  async function registrar(quem: Assinatura) {
    const r = await api().receberNotinhas(recebimento, quem)
    if (r.ok || daAssinatura(r)) return r
    // A recusa é do recebimento (outro recebimento entrou antes, por exemplo): volta para a janela.
    setAssinando(false)
    setErroRegistro(mensagem(r))
    aoRecarregar()
    return r
  }

  return (
    <Modal
      estreito
      titulo="Receber notinhas"
      subtitulo={`${dado.cliente.nome} · ${reais(totalCliente)} em aberto no total. Marque o que vai pagar agora.`}
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form={idFormulario} variante="primario" icone="check" disabled={Boolean(erro)}>
            Confirmar recebimento
          </Botao>
        </>
      }
    >
      <form id={idFormulario} className="receber-notinhas" onSubmit={confirmar} onChange={() => setErroRegistro(null)}>
        {abertas.length === 0 && <p className="receber-notinhas__nota">Nenhuma notinha em aberto.</p>}
        <ul className="receber-notinhas__lista">
          {abertas.map((notinha) => {
            const id = notinha.id
            const marcada = selecionadas.includes(id)
            const abatido = abatimentos.find((item) => item.id === id)
            const resta = notinha.emAberto - (abatido?.valor ?? 0)
            return (
              <li key={id} className={marcada ? undefined : 'receber-notinhas__desmarcada'}>
                <label className="receber-notinhas__marcar">
                  <input type="checkbox" checked={marcada} onChange={() => alternar(id)} aria-label={`Incluir notinha #${notinha.numero}`} />
                  <span>
                    <strong className="codigo">#{notinha.numero}</strong>
                    <small>
                      {dataCurta(notinha.dia)} ·{' '}
                      <span className={notinha.situacao === 'em-atraso' ? 'receber-notinhas__atraso' : undefined}>
                        {detalheDaSituacao({ ...notinha, quitadaEm: null, canceladaEm: null }, hoje)}
                      </span>
                      {notinha.pago > 0 && ` · já pago ${reais(notinha.pago)} de ${reais(notinha.total)}`}
                    </small>
                  </span>
                </label>
                <span className="receber-notinhas__valores">
                  <strong>{reais(notinha.emAberto)}</strong>
                  <small className={marcada && resta === 0 ? 'receber-notinhas__quita' : undefined}>
                    {/* Prévia do que vai acontecer ao confirmar; nada muda antes disso. */}
                    {!marcada || !abatido ? 'Ainda pendente' : resta === 0 ? 'Será quitada' : `Ficará ${reais(resta)} em aberto`}
                  </small>
                </span>
              </li>
            )
          })}
        </ul>

        <div className="receber-notinhas__campos">
          <CampoMoeda
            rotulo="Valor a pagar agora (R$)"
            valorCentavos={valorCentavos}
            aoMudar={setValorCentavos}
            erro={valor > totalAberto}
            autoFocus
          />
          <CampoData
            rotulo="Data do pagamento"
            valor={data}
            min={parteDinheiro > 0 ? hoje : dataMinima}
            max={hoje}
            aoMudar={setData}
            erro={Boolean(data) && (data < dataMinima || data > hoje)}
            ajuda={parteDinheiro > 0 ? 'Em dinheiro, a data é hoje.' : undefined}
          />
        </div>

        <div className="receber-notinhas__meio">
          <span className="receber-notinhas__rotulo">Forma de pagamento</span>
          <Filtros
            rotulo="Forma de pagamento"
            valor={meio}
            aoMudar={setMeio}
            opcoes={[
              ...MEIOS.map((item) => ({ valor: item, rotulo: NOME_MEIO[item] })),
              { valor: 'misto', rotulo: 'Misto' },
            ]}
          />
        </div>

        {meio === 'misto' && (
          <div className="receber-notinhas__divisao">
            {MEIOS.map((item) => (
              <CampoMoeda
                key={item}
                rotulo={`${NOME_MEIO[item]} (R$)`}
                valorCentavos={divisao[item]}
                aoMudar={(valor) => setDivisao((atual) => ({ ...atual, [item]: valor ?? 0 }))}
              />
            ))}
            <p className={faltaDistribuir < 0 ? 'receber-notinhas__distribuicao receber-notinhas__erro' : 'receber-notinhas__distribuicao'}>
              {faltaDistribuir < 0 ? 'Acima do valor a pagar' : 'Falta distribuir'} <strong>{reais(Math.abs(faltaDistribuir))}</strong>
            </p>
          </div>
        )}

        {/* O cartão no receber é manual, na Sicoob (`R-NOTINHA-06`): só crédito ou débito. */}
        {comCartao && (
          <div className="receber-notinhas__meio">
            <span className="receber-notinhas__rotulo">Cartão (maquininha Sicoob)</span>
            <Filtros
              rotulo="Tipo de cartão"
              valor={cartao}
              aoMudar={setCartao}
              opcoes={[{ valor: 'credito', rotulo: 'Crédito' }, { valor: 'debito', rotulo: 'Débito' }]}
            />
          </div>
        )}

        {parteDinheiro > 0 && (
          <div className="receber-notinhas__campos">
            <CampoMoeda
              rotulo="Dinheiro entregue (R$)"
              opcional
              placeholder={reais(parteDinheiro)}
              valorCentavos={entregueCentavos}
              erro={faltaDinheiro}
              aoMudar={setEntregueCentavos}
            />
            <div className="receber-notinhas__troco">
              <span>{faltaDinheiro ? 'Faltam' : 'Troco'}</span>
              <strong className={faltaDinheiro ? 'receber-notinhas__falta' : undefined}>
                {entregue ? reais(Math.abs(entregue - parteDinheiro)) : '—'}
              </strong>
            </div>
          </div>
        )}

        <p className="receber-notinhas__nota">
          {meio === 'misto'
            ? `Recebimento em ${dataCurta(data || hoje)}: ${parcelas.map((parcela) => `${NOME_MEIO[parcela.meio]} ${reais(parcela.valor)}`).join(' · ')}.`
            : meio === 'dinheiro'
            ? `Entram ${reais(valor)} no caixa de hoje como recebimento de notinha.`
            : `Entram ${reais(valor)} no Financeiro em ${dataCurta(data || hoje)} como recebimento de notinha (${NOME_MEIO[meio]}).`}
        </p>
        {erro && valor !== 0 && <p className="receber-notinhas__erro" role="alert">{erro}</p>}
        {erroRegistro && <p className="receber-notinhas__erro" role="alert">{erroRegistro}</p>}
      </form>
      {assinando && (
        <JanelaAssinatura
          gesto={`Receber ${reais(valor)} de ${dado.cliente.nome}`}
          rotuloConfirmar="Confirmar recebimento"
          fazer={registrar}
          aoConcluir={() => { setAssinando(false); aoFechar() }}
          aoFechar={() => setAssinando(false)}
        />
      )}
    </Modal>
  )
}
