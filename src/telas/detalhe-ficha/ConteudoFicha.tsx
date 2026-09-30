import { Link } from 'react-router'
import { Botao } from '../../componentes/botao/Botao'
import { ComIcone, Icone, type NomeIcone } from '../../componentes/icone/Icone'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloSituacao, type Tom } from '../../componentes/selo/Selo'
import { dataCurta, reais } from '../../formatar'
import {
  NOME_MEIO,
  nomeCliente,
  notinha as notinhaDa,
  notinhasDoCliente,
  rotuloForma,
  situacaoDaFicha,
  type Base,
  type Ficha,
  type FormaVenda,
  type SituacaoNotinha,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './detalhe-ficha.css'

/**
 * Pedaços da ficha, usados pela página (/fichas/:id) e pela janela do Início.
 * Quem usa decide a moldura (Painel na página, seções na janela); o conteúdo é
 * um só, para as duas nunca mostrarem coisas diferentes.
 */

const situacoes: Record<SituacaoNotinha, { tom: Tom; titulo: string }> = {
  pago: { tom: 'ok', titulo: 'Pago' },
  pendente: { tom: 'atencao', titulo: 'Pendente' },
  vencido: { tom: 'critico', titulo: 'Vencido' },
}

export const iconeForma: Record<FormaVenda, NomeIcone> = {
  dinheiro: 'dinheiro',
  pix: 'pix',
  cartao: 'cartao',
  notinha: 'calendario',
}

/** Ficha sem cliente leva ao histórico das vendas sem identificação. */
export function paginaDoCliente(clienteId: string | null) {
  return clienteId ? rotas.cliente(clienteId) : rotas.vendasSemIdentificacao
}

type Props = { base: Base; ficha: Ficha; hoje: string }

export function DadosFicha({ base, ficha, hoje, colunas = 2 }: Props & { colunas?: 2 | 4 }) {
  const situacao = situacaoDaFicha(ficha, hoje)
  return (
    <dl className={`detalhe-ficha__dados detalhe-ficha__dados--${colunas}`}>
      <div>
        <dt><ComIcone icone="pessoa">Cliente</ComIcone></dt>
        <dd>
          <Link className="detalhe-ficha__link" to={paginaDoCliente(ficha.clienteId)}>
            {nomeCliente(base, ficha.clienteId)}
          </Link>
        </dd>
      </div>
      <div>
        <dt><ComIcone icone="calendario">Data e horário</ComIcone></dt>
        <dd>{dataCurta(ficha.data)} · {ficha.horario}</dd>
      </div>
      <div>
        <dt><ComIcone icone={iconeForma[ficha.forma]}>Pagamento</ComIcone></dt>
        <dd>{rotuloForma(ficha)}</dd>
      </div>
      {ficha.vencimento && (
        <div>
          <dt><ComIcone icone="relogio">Vencimento</ComIcone></dt>
          <dd>{dataCurta(ficha.vencimento)}</dd>
        </div>
      )}
      <div>
        <dt>Situação</dt>
        <dd><SeloSituacao {...situacoes[situacao.situacao]} detalhe={situacao.detalhe} /></dd>
      </div>
    </dl>
  )
}

export function TabelaItensFicha({ ficha }: { ficha: Ficha }) {
  return (
    <Tabela larguraMinima={520}>
      <thead>
        <tr>
          <th>Produto</th>
          <th className="celula--numero">Qtd.</th>
          <th className="celula--numero">Preço</th>
          <th className="celula--numero">Total</th>
        </tr>
      </thead>
      <tbody>
        {ficha.itens.map((item) => (
          <tr key={item.codigo}>
            <td>
              <span className="celula-principal">{item.descricao}</span>
              <span className="celula-secundaria codigo">{item.codigo}</span>
            </td>
            <td className="celula--numero numero">{item.quantidade}</td>
            <td className="celula--numero">{reais(item.preco)}</td>
            <td className="celula--numero detalhe-ficha__valor">{reais(item.preco * item.quantidade)}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  )
}

/** Subtotal e desconto quando houver; na notinha, pago e em aberto. */
export function TotaisFicha({ ficha, hoje }: Omit<Props, 'base'>) {
  const notinha = notinhaDa(ficha, hoje)
  const subtotal = ficha.itens.reduce((t, i) => t + i.preco * i.quantidade, 0)
  return (
    <dl className="detalhe-ficha__saldo">
      {ficha.desconto > 0 && (
        <>
          <div>
            <dt>Subtotal</dt>
            <dd>{reais(subtotal)}</dd>
          </div>
          <div>
            <dt>Desconto</dt>
            <dd>− {reais(ficha.desconto)}</dd>
          </div>
        </>
      )}
      {notinha && (
        <>
          <div>
            <dt>Pago</dt>
            <dd>{reais(notinha.pago)}</dd>
          </div>
          <div>
            <dt>Em aberto</dt>
            <dd className={notinha.emAberto > 0 ? 'detalhe-ficha__aberto' : undefined}>{reais(notinha.emAberto)}</dd>
          </div>
        </>
      )}
    </dl>
  )
}

export function PagamentosFicha({ ficha }: { ficha: Ficha }) {
  const notinha = ficha.forma === 'notinha'
  if (ficha.pagamentos.length === 0) return <p className="detalhe-ficha__resumo">Nenhum pagamento registrado ainda.</p>
  return (
    <ul className="detalhe-ficha__pagamentos">
      {ficha.pagamentos.map((pagamento, indice) => (
        <li key={indice}>
          <span className="detalhe-ficha__pagamento-meio" title={NOME_MEIO[pagamento.meio]}>
            <Icone nome={iconeForma[pagamento.meio]} tamanho={18} />
          </span>
          <span className="detalhe-ficha__pagamento-texto">
            <strong>{!notinha ? 'Na venda' : pagamento.entrada ? 'Entrada na venda' : 'Recebimento'}</strong>
            <small>{dataCurta(pagamento.data)} · {pagamento.horario} · {pagamento.rotulo ?? NOME_MEIO[pagamento.meio]}</small>
          </span>
          <strong className="numero">{reais(pagamento.valor)}</strong>
        </li>
      ))}
    </ul>
  )
}

/**
 * Na ficha pendente: avisa que o cliente deve outras notinhas, para a cobrança
 * não parar nesta. Não junta nada; só leva à mesma janela, com todas marcadas.
 */
export function AvisoOutrasNotinhas({ base, ficha, hoje, aoReceberTodas }: Props & { aoReceberTodas: () => void }) {
  const esta = notinhaDa(ficha, hoje)
  if (!ficha.clienteId || !esta || esta.emAberto === 0) return null
  const outras = notinhasDoCliente(base, ficha.clienteId, hoje).filter((n) => n.emAberto > 0 && n.ficha.id !== ficha.id)
  if (outras.length === 0) return null
  const valorOutras = outras.reduce((t, n) => t + n.emAberto, 0)
  const atrasada = outras.some((n) => n.situacao === 'vencido')
  return (
    <div className={atrasada ? 'detalhe-ficha__outras detalhe-ficha__outras--atraso' : 'detalhe-ficha__outras'} role="status">
      <Icone nome={atrasada ? 'alerta' : 'info'} tamanho={18} />
      <p>
        <strong>{nomeCliente(base, ficha.clienteId)}</strong> tem mais {outras.length === 1 ? '1 notinha' : `${outras.length} notinhas`} em aberto
        {atrasada && ' (com atraso)'} · {reais(valorOutras)}. Total devido: <strong>{reais(valorOutras + esta.emAberto)}</strong>.
      </p>
      <Botao tamanho="pequeno" icone="dinheiro" onClick={aoReceberTodas}>
        Receber todas
      </Botao>
    </div>
  )
}
