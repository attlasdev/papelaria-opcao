import { useId, useState, type FormEvent } from 'react'
import { Botao } from '../../../componentes/botao/Botao'
import { CampoData } from '../../../componentes/campo/Campo'
import { CampoMoeda } from '../../../componentes/campo/CampoMoeda'
import { Filtros } from '../../../componentes/filtros/Filtros'
import { Modal } from '../../../componentes/modal/Modal'
import { dataCurta, reais } from '../../../formatar'
import {
  distribuir,
  hojeISO,
  NOME_MEIO,
  nomeCliente,
  notinhasDoCliente,
  receberNotinhas,
  useEstadoDemonstracao,
  type Meio,
} from '../../../mock/estado-demonstracao'
import './receber-notinhas.css'

type Props = {
  clienteId: string
  /** Notinhas que já abrem marcadas. Sem isto, todas as abertas vêm marcadas. */
  marcadas?: string[]
  aoFechar: () => void
}

/**
 * Recebe notinhas de um cliente. A janela sempre lista todas as abertas dele,
 * então quem entrou por uma ficha vê as outras e pode marcá-las junto. O valor
 * pode ser parcial: abate da mais antiga para a mais nova; cada notinha segue separada.
 */
export function ReceberNotinhas({ clienteId, marcadas, aoFechar }: Props) {
  const idFormulario = useId()
  const base = useEstadoDemonstracao()
  const abertas = notinhasDoCliente(base, clienteId, hojeISO())
    .filter((item) => item.emAberto > 0)
    .sort((a, b) => `${a.ficha.data} ${a.ficha.horario}`.localeCompare(`${b.ficha.data} ${b.ficha.horario}`))
  const totalCliente = abertas.reduce((soma, item) => soma + item.emAberto, 0)
  const [selecionadas, setSelecionadas] = useState<string[]>(() =>
    abertas.map((n) => n.ficha.id).filter((id) => !marcadas || marcadas.includes(id)))
  const notinhas = abertas.filter((n) => selecionadas.includes(n.ficha.id))
  const totalAberto = notinhas.reduce((soma, item) => soma + item.emAberto, 0)
  const [valorCentavos, setValorCentavos] = useState<number | null>(totalAberto)

  /** Marcar ou desmarcar leva o valor a pagar para o total do que está marcado. */
  function alternar(id: string) {
    const proximas = selecionadas.includes(id) ? selecionadas.filter((item) => item !== id) : [...selecionadas, id]
    setSelecionadas(proximas)
    setValorCentavos(abertas.filter((n) => proximas.includes(n.ficha.id)).reduce((t, n) => t + n.emAberto, 0))
  }
  const [meio, setMeio] = useState<Meio | 'misto'>('dinheiro')
  const [divisao, setDivisao] = useState<Record<Meio, number>>({ dinheiro: 0, pix: 0, cartao: 0 })
  const [data, setData] = useState(hojeISO())
  const [entregueCentavos, setEntregueCentavos] = useState<number | null>(null)
  const [erroRegistro, setErroRegistro] = useState<string | null>(null)

  const valor = valorCentavos ?? 0
  const entregue = entregueCentavos ?? 0
  const abatimentos = distribuir(notinhas, valor)
  const parcelas = meio === 'misto'
    ? (['dinheiro', 'pix', 'cartao'] as const).map((item) => ({ meio: item, valor: divisao[item] })).filter((parcela) => parcela.valor > 0)
    : [{ meio, valor }]
  const faltaDistribuir = valor - parcelas.reduce((soma, parcela) => soma + parcela.valor, 0)
  const parteDinheiro = meio === 'misto' ? divisao.dinheiro : meio === 'dinheiro' ? valor : 0
  // Dinheiro entregue é a cédula do cliente, só para o troco; não pode ser menor que o valor pago.
  const faltaDinheiro = parteDinheiro > 0 && entregue > 0 && entregue < parteDinheiro
  // Pagamento não pode ser anterior à venda: a notinha mais antiga marcada é o limite.
  const dataMinima = notinhas.reduce((menor, n) => (n.ficha.data < menor ? n.ficha.data : menor), hojeISO())
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
          : data > hojeISO()
            ? 'A data do pagamento não pode ser depois de hoje.'
            : data < dataMinima
              ? `A data do pagamento é anterior à notinha (${dataCurta(dataMinima)}).`
              : abatimentos.some((abatimento) => notinhas.find((n) => n.ficha.id === abatimento.id)!.ficha.data > data)
                ? 'A data do pagamento é anterior a uma das notinhas que serão abatidas.'
              : null

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (erro) return
    const horario = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date())
    const recebidos = receberNotinhas(notinhas.map((item) => item.ficha.id), { data, horario, parcelas })
    if (!recebidos.length) {
      setErroRegistro('Não foi possível registrar. Confira as notinhas selecionadas e os valores.')
      return
    }
    aoFechar()
  }

  return (
    <Modal
      estreito
      titulo="Receber notinhas"
      subtitulo={`${nomeCliente(base, clienteId)} · ${reais(totalCliente)} em aberto no total. Marque o que vai pagar agora.`}
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
        <ul className="receber-notinhas__lista">
          {abertas.map((notinha) => {
            const id = notinha.ficha.id
            const marcada = selecionadas.includes(id)
            const abatido = abatimentos.find((item) => item.id === id)
            const resta = notinha.emAberto - (abatido?.valor ?? 0)
            return (
              <li key={id} className={marcada ? undefined : 'receber-notinhas__desmarcada'}>
                <label className="receber-notinhas__marcar">
                  <input type="checkbox" checked={marcada} onChange={() => alternar(id)} aria-label={`Incluir notinha #${id}`} />
                  <span>
                    <strong className="codigo">#{id}</strong>
                    <small>
                      {dataCurta(notinha.ficha.data)} ·{' '}
                      <span className={notinha.situacao === 'vencido' ? 'receber-notinhas__atraso' : undefined}>{notinha.detalhe}</span>
                      {notinha.pago > 0 && ` · já pago ${reais(notinha.pago)} de ${reais(notinha.ficha.total)}`}
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
          <CampoData rotulo="Data do pagamento" valor={data} min={dataMinima} max={hojeISO()} aoMudar={setData} erro={Boolean(data) && (data < dataMinima || data > hojeISO())} />
        </div>

        <div className="receber-notinhas__meio">
          <span className="receber-notinhas__rotulo">Forma de pagamento</span>
          <Filtros
            rotulo="Forma de pagamento"
            valor={meio}
            aoMudar={setMeio}
            opcoes={[
              ...(['dinheiro', 'pix', 'cartao'] as const).map((item) => ({ valor: item, rotulo: NOME_MEIO[item] })),
              { valor: 'misto', rotulo: 'Misto' },
            ]}
          />
        </div>

        {meio === 'misto' && (
          <div className="receber-notinhas__divisao">
            {(['dinheiro', 'pix', 'cartao'] as const).map((item) => (
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
            ? `Recebimento em ${dataCurta(data || hojeISO())}: ${parcelas.map((parcela) => `${NOME_MEIO[parcela.meio]} ${reais(parcela.valor)}`).join(' · ')}.`
            : meio === 'dinheiro'
            ? `Entram ${reais(valor)} no caixa de ${dataCurta(data || hojeISO())} como recebimento de notinha.`
            : `Entram ${reais(valor)} no Financeiro em ${dataCurta(data || hojeISO())} como recebimento de notinha (${NOME_MEIO[meio]}).`}
        </p>
        {erro && valor !== 0 && <p className="receber-notinhas__erro" role="alert">{erro}</p>}
        {erroRegistro && <p className="receber-notinhas__erro" role="alert">{erroRegistro}</p>}
      </form>
    </Modal>
  )
}
