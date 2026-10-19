import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Botao } from '../../componentes/botao/Botao'
import { ModalMotivo } from '../../componentes/modal/ModalMotivo'
import { ComIcone, Icone, type NomeIcone } from '../../componentes/icone/Icone'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloSituacao, type Tom } from '../../componentes/selo/Selo'
import { dataCurta, reais } from '../../formatar'
import {
  anotarFicha,
  cancelarFicha,
  estornarPagamento,
  hojeISO,
  NOME_MEIO,
  nomeCliente,
  notinha as notinhaDa,
  notinhasDoCliente,
  pagamentosValidos,
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
  cancelada: { tom: 'neutro', titulo: 'Cancelada' },
}

export const iconeForma: Record<FormaVenda, NomeIcone> = {
  dinheiro: 'dinheiro',
  pix: 'pix',
  cartao: 'cartao',
  misto: 'financeiro',
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
          <th>{ficha.servicos?.length ? 'Produto ou serviço' : 'Produto'}</th>
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
        {(ficha.servicos ?? []).map((s, i) => (
          <tr key={`servico-${i}`}>
            <td>
              <span className="celula-principal">{s.nome}</span>
              <span className="celula-secundaria">
                Serviço{s.perdas && ` · ${s.perdas.quantidade} ${s.perdas.quantidade === 1 ? 'perda' : 'perdas'}`}{s.observacao && ` · ${s.observacao}`}
              </span>
            </td>
            <td className="celula--numero numero">—</td>
            <td className="celula--numero">{reais(s.valor)}</td>
            <td className="celula--numero detalhe-ficha__valor">{reais(s.valor)}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  )
}

/** Subtotal e desconto quando houver; na notinha, pago e em aberto. */
export function TotaisFicha({ ficha, hoje }: Omit<Props, 'base'>) {
  const notinha = notinhaDa(ficha, hoje)
  const subtotal = ficha.itens.reduce((t, i) => t + i.preco * i.quantidade, 0) + (ficha.servicos ?? []).reduce((t, s) => t + s.valor, 0)
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
  // Recebimento lançado errado se estorna aqui; venda à vista se corrige cancelando a ficha.
  const [estornando, setEstornando] = useState<number | null>(null)
  if (ficha.pagamentos.length === 0) return <p className="detalhe-ficha__resumo">Nenhum pagamento registrado ainda.</p>
  const alvo = estornando === null ? undefined : ficha.pagamentos[estornando]
  return (
    <>
      <ul className="detalhe-ficha__pagamentos">
        {ficha.pagamentos.map((pagamento, indice) => {
          const desfeito = pagamento.estorno ?? ficha.cancelamento
          return (
            <li key={indice} className={desfeito ? 'detalhe-ficha__pagamento--estornado' : undefined}>
              <span className="detalhe-ficha__pagamento-meio" title={NOME_MEIO[pagamento.meio]}>
                <Icone nome={iconeForma[pagamento.meio]} tamanho={18} />
              </span>
              <span className="detalhe-ficha__pagamento-texto">
                <strong>{!notinha ? 'Na venda' : pagamento.entrada ? 'Entrada na venda' : 'Recebimento'}</strong>
                <small>{dataCurta(pagamento.data)} · {pagamento.horario} · {pagamento.rotulo ?? NOME_MEIO[pagamento.meio]}{pagamento.operador && ` · ${pagamento.operador}`}</small>
                {desfeito && (
                  <small className="detalhe-ficha__estorno">
                    Estornado em {dataCurta(desfeito.data)} · {desfeito.motivo}{desfeito.operador && ` · ${desfeito.operador}`}
                  </small>
                )}
              </span>
              <span className="detalhe-ficha__pagamento-valor">
                <strong className="numero">{reais(pagamento.valor)}</strong>
                {notinha && !desfeito && (
                  <button type="button" className="detalhe-ficha__estornar" onClick={() => setEstornando(indice)}>
                    Estornar
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {alvo && estornando !== null && (
        <ModalMotivo
          titulo="Estornar recebimento"
          subtitulo={`Notinha #${ficha.id} · ${reais(alvo.valor)} em ${dataCurta(alvo.data)}`}
          consequencias={
            <ul>
              <li>O recebimento fica no registro, marcado como estornado.</li>
              <li><strong>{reais(alvo.valor)}</strong> saem do Financeiro hoje ({NOME_MEIO[alvo.meio]}).{alvo.data !== hojeISO() && ` O dia ${dataCurta(alvo.data)} não muda.`}</li>
              <li>A notinha volta a dever esse valor.</li>
            </ul>
          }
          textoConfirmar="Estornar recebimento"
          aoConfirmar={(motivo) => { estornarPagamento(ficha.id, estornando, motivo); setEstornando(null) }}
          aoFechar={() => setEstornando(null)}
        />
      )}
    </>
  )
}

/** Ficha cancelada: quando e por quê, acima de tudo. */
export function FaixaCancelada({ ficha }: { ficha: Ficha }) {
  if (!ficha.cancelamento) return null
  return (
    <div className="detalhe-ficha__cancelada" role="status">
      <Icone nome="erro" tamanho={18} />
      <p>
        <strong>Ficha cancelada</strong> em {dataCurta(ficha.cancelamento.data)} às {ficha.cancelamento.horario} · {ficha.cancelamento.motivo}{ficha.cancelamento.operador && ` · ${ficha.cancelamento.operador}`}.
        Baixa de estoque revertida e pagamentos estornados.
      </p>
    </div>
  )
}

/**
 * Desfaz a venda sem apagar: o estoque volta, o pago sai do caixa hoje e a ficha
 * fica no histórico como cancelada.
 */
export function BotaoCancelarFicha({ ficha }: { ficha: Ficha }) {
  const [aberto, setAberto] = useState(false)
  if (ficha.cancelamento) return null
  const unidades = ficha.itens.reduce((t, i) => t + (i.baixaEstoque ?? i.quantidade), 0)
  const semBaixa = ficha.itens.some((i) => (i.baixaEstoque ?? i.quantidade) < i.quantidade)
  const pago = pagamentosValidos(ficha).reduce((t, p) => t + p.valor, 0)
  const emAberto = ficha.forma === 'notinha' ? Math.max(0, ficha.total - pago) : 0
  return (
    <>
      <Botao variante="fantasma" icone="erro" className="detalhe-ficha__cancelar" onClick={() => setAberto(true)}>
        Cancelar ficha
      </Botao>
      {aberto && (
        <ModalMotivo
          titulo={`Cancelar ficha #${ficha.id}`}
          subtitulo={`${reais(ficha.total)} · ${dataCurta(ficha.data)} às ${ficha.horario}`}
          consequencias={
            <ul>
              <li>{unidades === 0 ? 'Nenhuma unidade volta' : unidades === 1 ? '1 unidade volta' : `${unidades} unidades voltam`} ao saldo registrado do estoque.</li>
              {semBaixa && <li>A venda passou com saldo insuficiente. Confira a prateleira e use Ajustar estoque se houver diferença física.</li>}
              {pago > 0 && <li><strong>{reais(pago)}</strong> saem do Financeiro hoje, como estorno. Os dias já fechados não mudam.</li>}
              {emAberto > 0 && <li>Os {reais(emAberto)} em aberto deixam de ser cobrados.</li>}
              <li>A ficha continua no histórico, marcada como cancelada.</li>
            </ul>
          }
          textoConfirmar="Cancelar ficha"
          aoConfirmar={(motivo) => { cancelarFicha(ficha.id, motivo); setAberto(false) }}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  )
}

/**
 * Lembretes da ficha, como um prazo combinado com o cliente. O vencimento da
 * notinha não muda: a anotação explica, a situação continua a verdadeira.
 */
export function AnotacoesFicha({ ficha }: { ficha: Ficha }) {
  const [texto, setTexto] = useState('')
  const anotacoes = ficha.anotacoes ?? []
  function anotar(evento: FormEvent) {
    evento.preventDefault()
    if (anotarFicha(ficha.id, texto)) setTexto('')
  }
  return (
    <div className="detalhe-ficha__anotacoes">
      {anotacoes.length > 0 && (
        <ul>
          {anotacoes.map((a, indice) => (
            <li key={indice}>
              <small className="numero">{dataCurta(a.data)} · {a.horario}</small>
              <p>{a.texto}</p>
            </li>
          ))}
        </ul>
      )}
      <form className="detalhe-ficha__anotar" onSubmit={anotar}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: combinou pagar dia 15"
          aria-label="Nova anotação"
        />
        <Botao type="submit" tamanho="pequeno" disabled={!texto.trim()}>Anotar</Botao>
      </form>
    </div>
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
