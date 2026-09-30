import { useId, useState, type FormEvent } from 'react'
import { Botao } from '../../../componentes/botao/Botao'
import { Campo } from '../../../componentes/campo/Campo'
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
  const [meio, setMeio] = useState<Meio>('dinheiro')
  const [data, setData] = useState(hojeISO())
  const [entregueCentavos, setEntregueCentavos] = useState<number | null>(null)

  const valor = valorCentavos ?? 0
  const entregue = entregueCentavos ?? 0
  const abatimentos = distribuir(notinhas, valor)
  // Dinheiro entregue é a cédula do cliente, só para o troco; não pode ser menor que o valor pago.
  const faltaDinheiro = meio === 'dinheiro' && entregue > 0 && entregue < valor
  const erro = notinhas.length === 0
    ? 'Marque ao menos uma notinha.'
    : valor <= 0
    ? 'Informe o valor a pagar agora.'
    : valor > totalAberto
      ? `O valor passa do total em aberto (${reais(totalAberto)}).`
      : faltaDinheiro
        ? 'O dinheiro entregue não cobre o valor a pagar.'
        : !data
          ? 'Informe a data do pagamento.'
          : null

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (erro) return
    const horario = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date())
    receberNotinhas(notinhas.map((item) => item.ficha.id), { data, horario, meio, valor })
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
      <form id={idFormulario} className="receber-notinhas" onSubmit={confirmar}>
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
          <Campo rotulo="Data do pagamento" type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} />
        </div>

        <div className="receber-notinhas__meio">
          <span className="receber-notinhas__rotulo">Forma de pagamento</span>
          <Filtros
            rotulo="Forma de pagamento"
            valor={meio}
            aoMudar={setMeio}
            opcoes={(['dinheiro', 'pix', 'cartao'] as const).map((item) => ({ valor: item, rotulo: NOME_MEIO[item] }))}
          />
        </div>

        {meio === 'dinheiro' && (
          <div className="receber-notinhas__campos">
            <CampoMoeda
              rotulo="Dinheiro entregue (R$)"
              opcional
              placeholder={reais(valor)}
              valorCentavos={entregueCentavos}
              erro={faltaDinheiro}
              aoMudar={setEntregueCentavos}
            />
            <div className="receber-notinhas__troco">
              <span>{faltaDinheiro ? 'Faltam' : 'Troco'}</span>
              <strong className={faltaDinheiro ? 'receber-notinhas__falta' : undefined}>
                {entregue ? reais(Math.abs(entregue - valor)) : '—'}
              </strong>
            </div>
          </div>
        )}

        <p className="receber-notinhas__nota">
          {meio === 'dinheiro'
            ? `Entram ${reais(valor)} no caixa de ${dataCurta(data || hojeISO())} como recebimento de notinha.`
            : `Entram ${reais(valor)} no Financeiro em ${dataCurta(data || hojeISO())} como recebimento de notinha (${NOME_MEIO[meio]}).`}
        </p>
        {erro && valor !== 0 && <p className="receber-notinhas__erro" role="alert">{erro}</p>}
      </form>
    </Modal>
  )
}
