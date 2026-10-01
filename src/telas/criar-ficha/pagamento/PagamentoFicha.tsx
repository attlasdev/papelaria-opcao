import { CampoData } from '../../../componentes/campo/Campo'
import { CampoMoeda } from '../../../componentes/campo/CampoMoeda'
import { Icone, type NomeIcone } from '../../../componentes/icone/Icone'
import { Filtros } from '../../../componentes/filtros/Filtros'
import { centavosDigitados, moedaDigitada, reais } from '../../../formatar'
import { hojeISO, NOME_MEIO, type Meio } from '../../../mock/estado-demonstracao'
import type { FormaPagamento } from '../tipos'
import './pagamento-ficha.css'

type Props = {
  subtotal: number
  desconto: number
  aoMudarDesconto: (centavos: number) => void
  forma: FormaPagamento
  aoMudarForma: (forma: FormaPagamento) => void
  recebido: number
  aoMudarRecebido: (centavos: number) => void
  /** Venda sem identificação: não existe notinha sem alguém para cobrar. */
  notinhaBloqueada?: boolean
  /** Notinha: data combinada (YYYY-MM-DD) e entrada paga na hora, se houver. */
  vencimento: string
  aoMudarVencimento: (data: string) => void
  entrada: number
  aoMudarEntrada: (centavos: number) => void
  meioEntrada: Meio
  aoMudarMeioEntrada: (meio: Meio) => void
  divisaoPagamento: Record<Meio, number>
  aoMudarDivisao: (meio: Meio, centavos: number) => void
  recebidoMisto: number
  aoMudarRecebidoMisto: (centavos: number) => void
  erroMisto?: string
  erroRecebido?: string
  erroVencimento?: string
  erroEntrada?: string
  erroDesconto?: string
}

const formas: { valor: FormaPagamento; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro', icone: 'dinheiro' },
  { valor: 'pix', rotulo: 'Pix', icone: 'pix' },
  { valor: 'cartao', rotulo: 'Cartão', icone: 'cartao' },
  { valor: 'misto', rotulo: 'Misto', icone: 'financeiro' },
  { valor: 'notinha', rotulo: 'Notinha', icone: 'calendario' },
]

/** Valores da ficha e forma de pagamento. */
export function PagamentoFicha(props: Props) {
  const { subtotal, desconto, forma, recebido, entrada } = props
  const total = Math.max(0, subtotal - desconto)
  const troco = recebido - total
  const totalMisto = Object.values(props.divisaoPagamento).reduce((soma, valor) => soma + valor, 0)
  const restaMisto = total - totalMisto

  return (
    <section className="pagamento-ficha">
      <h2 className="pagamento-ficha__titulo">Valores</h2>
      <dl className="pagamento-ficha__contas">
        <div>
          <dt>Subtotal dos itens</dt>
          <dd>{reais(subtotal)}</dd>
        </div>
        <div>
          <dt>Desconto</dt>
          <dd>
            <label className={props.erroDesconto ? 'pagamento-ficha__desconto pagamento-ficha__desconto--erro' : 'pagamento-ficha__desconto'}>
              <input
                inputMode="numeric"
                value={moedaDigitada(desconto)}
                onFocus={(evento) => evento.target.select()}
                onChange={(evento) => props.aoMudarDesconto(centavosDigitados(evento.target.value) ?? 0)}
                aria-label="Desconto em reais"
              />
            </label>
          </dd>
        </div>
        <div className="pagamento-ficha__total">
          <dt>Total da ficha</dt>
          <dd>{reais(total)}</dd>
        </div>
      </dl>
      {props.erroDesconto && <p className="pagamento-ficha__erro" role="alert">{props.erroDesconto}</p>}

      <h2 className="pagamento-ficha__titulo">Forma de pagamento</h2>
      <div className="pagamento-ficha__formas" role="radiogroup" aria-label="Forma de pagamento">
        {formas.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="radio"
            aria-checked={forma === f.valor}
            disabled={f.valor === 'notinha' && props.notinhaBloqueada}
            title={f.valor === 'notinha' && props.notinhaBloqueada ? 'Para vender na notinha, identifique o cliente' : undefined}
            className={forma === f.valor ? 'pagamento-ficha__forma pagamento-ficha__forma--ativa' : 'pagamento-ficha__forma'}
            onClick={() => props.aoMudarForma(f.valor)}
          >
            <Icone nome={f.valor === 'notinha' && props.notinhaBloqueada ? 'cadeado' : f.icone} tamanho={16} />
            {f.rotulo}
          </button>
        ))}
      </div>
      {props.notinhaBloqueada && (
        <p className="pagamento-ficha__nota">Notinha disponível apenas para cliente identificado.</p>
      )}

      {forma === 'dinheiro' && (
        <div className="pagamento-ficha__detalhe pagamento-ficha__dinheiro">
          <CampoMoeda
            rotulo="Valor recebido (R$)"
            valorCentavos={recebido}
            aoMudar={(valor) => props.aoMudarRecebido(valor ?? 0)}
            erro={Boolean(props.erroRecebido)}
            ajuda={props.erroRecebido}
          />
          <div className="pagamento-ficha__troco">
            <span>{troco < 0 ? 'Faltam' : 'Troco'}</span>
            <strong className={troco < 0 ? 'pagamento-ficha__falta' : undefined}>{reais(Math.abs(troco))}</strong>
          </div>
        </div>
      )}

      {(forma === 'pix' || forma === 'cartao') && (
        <p className="pagamento-ficha__nota pagamento-ficha__detalhe">
          <Icone nome="info" tamanho={16} />
          Conclua só depois de conferir o recebimento.
        </p>
      )}

      {forma === 'misto' && (
        <div className="pagamento-ficha__detalhe pagamento-ficha__misto">
          <p className="pagamento-ficha__nota">Informe quanto foi pago em cada meio. Confira Pix e cartão antes de concluir.</p>
          {(['dinheiro', 'pix', 'cartao'] as const).map((meio) => (
            <CampoMoeda
              key={meio}
              rotulo={`${NOME_MEIO[meio]} (R$)`}
              valorCentavos={props.divisaoPagamento[meio]}
              aoMudar={(valor) => props.aoMudarDivisao(meio, valor ?? 0)}
            />
          ))}
          <p className={restaMisto < 0 ? 'pagamento-ficha__misto-restante pagamento-ficha__misto-restante--erro' : 'pagamento-ficha__misto-restante'}>
            {restaMisto < 0 ? 'Acima do total' : 'Falta distribuir'} <strong>{reais(Math.abs(restaMisto))}</strong>
          </p>
          {props.divisaoPagamento.dinheiro > 0 && (
            <>
              <CampoMoeda
                rotulo="Dinheiro entregue (R$)"
                valorCentavos={props.recebidoMisto}
                aoMudar={(valor) => props.aoMudarRecebidoMisto(valor ?? 0)}
              />
              <p className="pagamento-ficha__misto-restante">{props.recebidoMisto < props.divisaoPagamento.dinheiro ? 'Falta em dinheiro' : 'Troco'} <strong>{reais(Math.abs(props.recebidoMisto - props.divisaoPagamento.dinheiro))}</strong></p>
            </>
          )}
          {props.erroMisto && <p className="pagamento-ficha__erro" role="alert">{props.erroMisto}</p>}
        </div>
      )}

      {forma === 'notinha' && (
        <div className="pagamento-ficha__detalhe pagamento-ficha__detalhe--notinha">
          <div className="pagamento-ficha__notinha">
            <CampoData
              rotulo="Vencimento"
              valor={props.vencimento}
              min={hojeISO()}
              aoMudar={props.aoMudarVencimento}
              erro={Boolean(props.erroVencimento)}
              ajuda={props.erroVencimento}
            />
            <CampoMoeda
              rotulo="Entrada agora (R$)"
              valorCentavos={entrada}
              aoMudar={(valor) => props.aoMudarEntrada(valor ?? 0)}
              erro={Boolean(props.erroEntrada)}
              ajuda={props.erroEntrada}
            />
          </div>
          {entrada > 0 && (
            <div className="pagamento-ficha__entrada">
              <span>Entrada em</span>
              <Filtros
                rotulo="Forma de pagamento da entrada"
                valor={props.meioEntrada}
                aoMudar={props.aoMudarMeioEntrada}
                opcoes={(['dinheiro', 'pix', 'cartao'] as const).map((meio) => ({ valor: meio, rotulo: NOME_MEIO[meio] }))}
              />
            </div>
          )}
          {/* Com entrada, o que fica em aberto aparece na Revisão. */}
          {entrada === 0 && <p className="pagamento-ficha__nota">Fica pendente no cliente até a baixa.</p>}
        </div>
      )}
    </section>
  )
}
