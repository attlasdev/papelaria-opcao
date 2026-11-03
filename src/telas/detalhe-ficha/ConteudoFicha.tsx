import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { Falha, FichaDetalhe, FormaFicha, PaginaCompras } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Botao } from '../../componentes/botao/Botao'
import { ModalMotivo } from '../../componentes/modal/ModalMotivo'
import { ComIcone, Icone, type NomeIcone } from '../../componentes/icone/Icone'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloSituacao } from '../../componentes/selo/Selo'
import { api } from '../../dados/api'
import { detalheDaSituacao, SELO_COMPRA } from '../../dados/situacao'
import { tituloFalha } from '../../falhas'
import { dataCurta, NOME_MEIO, reais, ROTULO_SEM_IDENTIFICACAO } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { hojeISO } from '../../datas'
import { rotas } from '../../rotas-caminhos'
import './detalhe-ficha.css'

/**
 * Pedaços da ficha, usados pela página (/fichas/:id) e pela janela do Início.
 * Quem usa decide a moldura (Painel na página, seções na janela); o conteúdo é
 * um só, para as duas nunca mostrarem coisas diferentes.
 */

export const iconeForma: Record<FormaFicha, NomeIcone> = {
  dinheiro: 'dinheiro',
  pix: 'pix',
  cartao: 'cartao',
  misto: 'financeiro',
  notinha: 'calendario',
}

const NOME_FORMA: Record<FormaFicha, string> = { ...NOME_MEIO, misto: 'Misto', notinha: 'Notinha' }

const mensagem = (r: Falha) => (r.causa === 'validacao' || r.causa === 'permissao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** Ficha sem cliente leva ao histórico das vendas sem identificação. */
export function paginaDoCliente(clienteId: string | null) {
  return clienteId ? rotas.cliente(clienteId) : rotas.vendasSemIdentificacao
}

/** Data e horário de São Paulo de um instante. */
export function quando(instante: string) {
  const [data, hora = ''] = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(instante)).split(', ')
  return { data, hora }
}

export const nomeDoCliente = (f: FichaDetalhe) => f.cliente?.nome ?? ROTULO_SEM_IDENTIFICACAO

/** "Ana Souza · 31/10/2026 · 18:49 · operador João Silva". */
export function subtituloFicha(f: FichaDetalhe) {
  const { data, hora } = quando(f.registradoEm)
  return `${nomeDoCliente(f)} · ${data} · ${hora} · operador ${f.operador}`
}

export type CargaFicha = { fase: 'carregando' } | { fase: 'erro'; mensagem: string; naoEncontrada: boolean } | { fase: 'pronto'; ficha: FichaDetalhe }

/**
 * A ficha pelo contrato. Relê quando a base da demonstração muda: até a Fase 3
 * é ela que responde, e um gesto em outra janela (o receber, por exemplo) muda
 * esta ficha.
 */
export function useFicha(id: string) {
  const base = useEstadoDemonstracao()
  const [carga, setCarga] = useState<{ de: string; carga: CargaFicha } | null>(null)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let vivo = true
    void api().obterFicha(id).then((r) => {
      if (vivo) setCarga({ de: id, carga: r.ok ? { fase: 'pronto', ficha: r.dado } : { fase: 'erro', mensagem: mensagem(r), naoEncontrada: r.causa === 'nao-encontrado' } })
    })
    return () => { vivo = false }
  }, [id, base, tentativa])
  return {
    carga: carga?.de === id ? carga.carga : { fase: 'carregando' } as CargaFicha,
    /** A ficha como o gesto devolveu. */
    atualizar: (ficha: FichaDetalhe) => setCarga({ de: id, carga: { fase: 'pronto', ficha } }),
    tentarDeNovo: () => setTentativa((n) => n + 1),
  }
}

export function DadosFicha({ ficha, colunas = 2 }: { ficha: FichaDetalhe; colunas?: 2 | 4 }) {
  const { data, hora } = quando(ficha.registradoEm)
  const situacao = { ...ficha, canceladaEm: ficha.cancelamento?.dia ?? null }
  return (
    <dl className={`detalhe-ficha__dados detalhe-ficha__dados--${colunas}`}>
      <div>
        <dt><ComIcone icone="pessoa">Cliente</ComIcone></dt>
        <dd>
          <Link className="detalhe-ficha__link" to={paginaDoCliente(ficha.cliente?.id ?? null)}>
            {nomeDoCliente(ficha)}
          </Link>
        </dd>
      </div>
      <div>
        <dt><ComIcone icone="calendario">Data e horário</ComIcone></dt>
        <dd>{data} · {hora}</dd>
      </div>
      <div>
        <dt><ComIcone icone={iconeForma[ficha.forma]}>Pagamento</ComIcone></dt>
        <dd>{ficha.rotulo ?? NOME_FORMA[ficha.forma]}</dd>
      </div>
      {ficha.vencimento && (
        <div>
          <dt><ComIcone icone="relogio">Vencimento</ComIcone></dt>
          <dd>{dataCurta(ficha.vencimento)}</dd>
        </div>
      )}
      <div>
        <dt>Situação</dt>
        <dd><SeloSituacao {...SELO_COMPRA[ficha.situacao]} detalhe={detalheDaSituacao(situacao, hojeEmSaoPaulo())} /></dd>
      </div>
    </dl>
  )
}

/** "2 tipos de itens · 4 unidades · 1 serviço". */
export function contagemItens(f: FichaDetalhe) {
  const unidades = f.itens.reduce((t, i) => t + i.quantidade, 0)
  const itens = f.itens.length ? `${f.itens.length} ${f.itens.length === 1 ? 'tipo de item' : 'tipos de itens'} · ${unidades} ${unidades === 1 ? 'unidade' : 'unidades'}` : ''
  const servicos = f.servicos.length ? `${f.servicos.length} ${f.servicos.length === 1 ? 'serviço' : 'serviços'}` : ''
  return [itens, servicos].filter(Boolean).join(' · ')
}

export function TabelaItensFicha({ ficha }: { ficha: FichaDetalhe }) {
  return (
    <Tabela larguraMinima={520}>
      <thead>
        <tr>
          <th>{ficha.servicos.length ? 'Produto ou serviço' : 'Produto'}</th>
          <th className="celula--numero">Qtd.</th>
          <th className="celula--numero">Preço</th>
          <th className="celula--numero">Total</th>
        </tr>
      </thead>
      <tbody>
        {ficha.itens.map((item) => (
          <tr key={item.produtoId}>
            <td>
              <span className="celula-principal">{item.descricao}</span>
              <span className="celula-secundaria codigo">{item.codigo}</span>
            </td>
            <td className="celula--numero numero">{item.quantidade}</td>
            <td className="celula--numero">{reais(item.preco)}</td>
            <td className="celula--numero detalhe-ficha__valor">{reais(item.preco * item.quantidade)}</td>
          </tr>
        ))}
        {ficha.servicos.map((s, i) => (
          <tr key={`servico-${i}`}>
            <td>
              <span className="celula-principal">{s.nome}</span>
              <span className="celula-secundaria">
                Serviço{s.perdas && ` · ${s.perdas} ${s.perdas === 1 ? 'perda' : 'perdas'}`}{s.observacao && ` · ${s.observacao}`}
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
export function TotaisFicha({ ficha }: { ficha: FichaDetalhe }) {
  return (
    <dl className="detalhe-ficha__saldo">
      {ficha.desconto > 0 && (
        <>
          <div>
            <dt>Subtotal</dt>
            <dd>{reais(ficha.subtotal)}</dd>
          </div>
          <div>
            <dt>Desconto</dt>
            <dd>− {reais(ficha.desconto)}</dd>
          </div>
        </>
      )}
      {ficha.forma === 'notinha' && (
        <>
          <div>
            <dt>Pago</dt>
            <dd>{reais(ficha.pago)}</dd>
          </div>
          <div>
            <dt>Em aberto</dt>
            <dd className={ficha.emAberto > 0 ? 'detalhe-ficha__aberto' : undefined}>{reais(ficha.emAberto)}</dd>
          </div>
        </>
      )}
    </dl>
  )
}

const TITULO_PAGAMENTO = { venda: 'Na venda', entrada: 'Entrada na venda', recebimento: 'Recebimento' } as const

/**
 * Os pagamentos da ficha. Só recebimento de notinha se estorna, e o estorno
 * desfaz o "Receber" inteiro (`R-CORRECAO-03`); venda ou entrada errada se
 * corrige cancelando a ficha.
 */
export function PagamentosFicha({ ficha, aoMudar }: { ficha: FichaDetalhe; aoMudar: (f: FichaDetalhe) => void }) {
  const [estornando, setEstornando] = useState<{ id: string; motivo: string | null } | null>(null)
  const [conferindo, setConferindo] = useState<string | null>(null)
  if (ficha.pagamentos.length === 0) return <p className="detalhe-ficha__resumo">Nenhum pagamento registrado ainda.</p>
  const alvo = estornando ? ficha.pagamentos.find((p) => p.id === estornando.id) : undefined
  return (
    <>
      <ul className="detalhe-ficha__pagamentos">
        {ficha.pagamentos.map((pagamento) => {
          const desfeito = pagamento.estorno ?? ficha.cancelamento
          return (
            <li key={pagamento.id} className={desfeito ? 'detalhe-ficha__pagamento--estornado' : undefined}>
              <span className="detalhe-ficha__pagamento-meio" title={NOME_MEIO[pagamento.meio]}>
                <Icone nome={iconeForma[pagamento.meio]} tamanho={18} />
              </span>
              <span className="detalhe-ficha__pagamento-texto">
                <strong>{TITULO_PAGAMENTO[pagamento.tipo]}</strong>
                <small>{dataCurta(pagamento.dia)} · {quando(pagamento.registradoEm).hora} · {pagamento.rotulo ?? NOME_MEIO[pagamento.meio]} · {pagamento.operador}</small>
                {desfeito && (
                  <small className="detalhe-ficha__estorno">
                    Estornado em {dataCurta(desfeito.dia)} · {desfeito.motivo} · {desfeito.operador}
                    {pagamento.estorno && (pagamento.estorno.conferidoPor
                      ? ` · conferido por ${pagamento.estorno.conferidoPor}`
                      : <strong className="detalhe-ficha__aguardando"> · aguardando a dona</strong>)}
                  </small>
                )}
              </span>
              <span className="detalhe-ficha__pagamento-valor">
                <strong className="numero">{reais(pagamento.valor)}</strong>
                {pagamento.tipo === 'recebimento' && !desfeito && (
                  <button type="button" className="detalhe-ficha__estornar" onClick={() => setEstornando({ id: pagamento.id, motivo: null })}>
                    Estornar
                  </button>
                )}
                {pagamento.estorno && !pagamento.estorno.conferidoPor && (
                  <button type="button" className="detalhe-ficha__estornar" onClick={() => setConferindo(pagamento.id)}>
                    Conferir
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {alvo && estornando && estornando.motivo === null && (
        <ModalMotivo
          titulo="Estornar recebimento"
          subtitulo={`Notinha #${ficha.numero} · ${reais(alvo.valor)} em ${dataCurta(alvo.dia)}`}
          consequencias={
            <ul>
              {alvo.mesmoRecebimento.length > 0 && (
                <li>
                  Este recebimento também abateu {alvo.mesmoRecebimento.map((o) => `a #${o.numero} (${reais(o.valor)})`).join(', ')}:
                  o estorno desfaz <strong>todas</strong>.
                </li>
              )}
              <li>O recebimento fica no registro, marcado como estornado.</li>
              <li>
                <strong>{reais(alvo.valor + alvo.mesmoRecebimento.reduce((t, o) => t + o.valor, 0))}</strong> saem do Financeiro hoje.
                {alvo.dia !== hojeISO() && ` O dia ${dataCurta(alvo.dia)} não muda.`}
              </li>
              <li>{alvo.mesmoRecebimento.length ? 'As notinhas voltam' : 'A notinha volta'} a dever esse valor.</li>
              <li>Se quem estorna não é a dona, o estorno fica aguardando o visto dela.</li>
            </ul>
          }
          textoConfirmar="Continuar"
          aoConfirmar={(motivo) => setEstornando({ id: alvo.id, motivo })}
          aoFechar={() => setEstornando(null)}
        />
      )}
      {alvo && estornando?.motivo && (
        <JanelaAssinatura
          gesto={`Estornar o recebimento · ${estornando.motivo}`}
          rotuloConfirmar="Estornar recebimento"
          fazer={(quem) => api().estornarRecebimento(alvo.id, estornando.motivo!, quem)}
          aoConcluir={(f) => { setEstornando(null); aoMudar(f) }}
          aoFechar={() => setEstornando(null)}
        />
      )}
      {conferindo && (
        <JanelaAssinatura
          soDona
          gesto={`Conferir o estorno na ficha #${ficha.numero}`}
          rotuloConfirmar="Conferir"
          fazer={(dona) => api().conferirEstorno(conferindo, dona)}
          aoConcluir={(f) => { setConferindo(null); aoMudar(f) }}
          aoFechar={() => setConferindo(null)}
        />
      )}
    </>
  )
}

/**
 * Ficha cancelada: quando, por quê e quem, acima de tudo. A de funcionário
 * aguarda o visto da dona, que confere aqui (`R-FICHA-02`).
 */
export function FaixaCancelada({ ficha, aoMudar }: { ficha: FichaDetalhe; aoMudar: (f: FichaDetalhe) => void }) {
  const [conferindo, setConferindo] = useState(false)
  const c = ficha.cancelamento
  if (!c) return null
  const { data, hora } = quando(c.registradoEm)
  return (
    <div className="detalhe-ficha__cancelada" role="status">
      <Icone nome="erro" tamanho={18} />
      <p>
        <strong>Ficha cancelada</strong> em {data} às {hora} · {c.motivo} · {c.operador}.
        Baixa de estoque revertida e pagamentos estornados.
        {c.conferidoPor ? ` Conferido por ${c.conferidoPor}.` : <strong className="detalhe-ficha__aguardando"> Aguardando a dona.</strong>}
      </p>
      {!c.conferidoPor && (
        <Botao tamanho="pequeno" icone="check" onClick={() => setConferindo(true)}>Conferir</Botao>
      )}
      {conferindo && (
        <JanelaAssinatura
          soDona
          gesto={`Conferir o cancelamento da ficha #${ficha.numero}`}
          rotuloConfirmar="Conferir"
          fazer={(dona) => api().conferirCancelamento(ficha.id, dona)}
          aoConcluir={(f) => { setConferindo(false); aoMudar(f) }}
          aoFechar={() => setConferindo(false)}
        />
      )}
    </div>
  )
}

/**
 * Desfaz a venda sem apagar: o estoque volta, o pago sai do caixa hoje e a ficha
 * fica no histórico como cancelada.
 */
export function BotaoCancelarFicha({ ficha, aoMudar }: { ficha: FichaDetalhe; aoMudar: (f: FichaDetalhe) => void }) {
  const [aberto, setAberto] = useState(false)
  if (ficha.cancelamento) return null
  return (
    <>
      <Botao variante="fantasma" icone="erro" className="detalhe-ficha__cancelar" onClick={() => setAberto(true)}>
        Cancelar ficha
      </Botao>
      {aberto && <ModalCancelarFicha ficha={ficha} aoFechar={() => setAberto(false)} aoCancelada={aoMudar} />}
    </>
  )
}

type PropsCancelar = { titulo?: string; textoConfirmar?: string; aoFechar: () => void; aoCancelada?: (f: FichaDetalhe) => void }

/**
 * A confirmação de cancelar a ficha: o motivo, e depois quem cancela
 * (`R-FICHA-02`). Usada pelo detalhe e pelo "Estornar" de uma venda no
 * Financeiro (`2026-10-19`): estornar a venda é cancelar a ficha inteira.
 */
export function ModalCancelarFicha({ ficha, titulo, textoConfirmar = 'Cancelar ficha', aoFechar, aoCancelada }: PropsCancelar & { ficha: FichaDetalhe }) {
  const [motivo, setMotivo] = useState<string | null>(null)
  const unidades = ficha.itens.reduce((t, i) => t + i.quantidade, 0)
  const validos = ficha.pagamentos.filter((p) => !p.estorno)
  const { data, hora } = quando(ficha.registradoEm)
  if (motivo !== null) {
    return (
      <JanelaAssinatura
        gesto={`Cancelar a ficha #${ficha.numero} · ${motivo}`}
        rotuloConfirmar={textoConfirmar}
        fazer={(quem) => api().cancelarFicha(ficha.id, motivo, quem)}
        aoConcluir={(f) => { aoCancelada?.(f); aoFechar() }}
        aoFechar={aoFechar}
      />
    )
  }
  return (
    <ModalMotivo
      titulo={titulo ?? `Cancelar ficha #${ficha.numero}`}
      subtitulo={`${reais(ficha.total)} · ${data} às ${hora}`}
      consequencias={
        <ul>
          {titulo && <li>A ficha <strong>#{ficha.numero}</strong> é cancelada inteira{validos.length > 1 && `, com os ${validos.length} pagamentos`}.</li>}
          <li>{unidades === 0 ? 'Nenhuma unidade volta' : unidades === 1 ? '1 unidade volta' : `${unidades} unidades voltam`} ao saldo registrado do estoque.</li>
          {ficha.pago > 0 && <li><strong>{reais(ficha.pago)}</strong> saem do Financeiro hoje, como estorno. Os dias já fechados não mudam.</li>}
          {ficha.emAberto > 0 && <li>Os {reais(ficha.emAberto)} em aberto deixam de ser cobrados.</li>}
          <li>A ficha continua no histórico, marcada como cancelada.</li>
          <li>Se quem cancela não é a dona, o cancelamento fica aguardando o visto dela.</li>
        </ul>
      }
      textoConfirmar="Continuar"
      aoConfirmar={setMotivo}
      aoFechar={aoFechar}
    />
  )
}

/** O cancelar pelo id da ficha (o Financeiro tem só o id): lê a ficha e abre a mesma janela. */
export function ModalCancelarFichaPorId({ id, ...resto }: PropsCancelar & { id: string }) {
  const { carga } = useFicha(id)
  if (carga.fase === 'pronto') return <ModalCancelarFicha ficha={carga.ficha} {...resto} />
  if (carga.fase === 'erro') {
    return (
      <ModalMotivo titulo="Cancelar ficha" consequencias={<p role="alert">{carga.mensagem}</p>} textoConfirmar="Fechar" aoConfirmar={resto.aoFechar} aoFechar={resto.aoFechar} />
    )
  }
  return null
}

/**
 * Lembretes da ficha, como um prazo combinado com o cliente. O vencimento da
 * notinha não muda: a anotação explica, a situação continua a verdadeira.
 * Anotar pede pessoa e PIN (`R-FICHA-03`).
 */
export function AnotacoesFicha({ ficha, aoMudar }: { ficha: FichaDetalhe; aoMudar: (f: FichaDetalhe) => void }) {
  const [texto, setTexto] = useState('')
  const [assinando, setAssinando] = useState(false)
  function anotar(evento: FormEvent) {
    evento.preventDefault()
    if (texto.trim()) setAssinando(true)
  }
  return (
    <div className="detalhe-ficha__anotacoes">
      {ficha.anotacoes.length > 0 && (
        <ul>
          {ficha.anotacoes.map((a, indice) => {
            const { data, hora } = quando(a.registradoEm)
            return (
              <li key={indice}>
                <small className="numero">{data} · {hora} · {a.operador}</small>
                <p>{a.texto}</p>
              </li>
            )
          })}
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
      {assinando && (
        <JanelaAssinatura
          gesto={`Anotar na ficha #${ficha.numero}`}
          rotuloConfirmar="Anotar"
          fazer={(quem) => api().anotarFicha(ficha.id, texto, quem)}
          aoConcluir={(f) => { setAssinando(false); setTexto(''); aoMudar(f) }}
          aoFechar={() => setAssinando(false)}
        />
      )}
    </div>
  )
}

/**
 * Na ficha pendente: avisa que o cliente deve outras notinhas, para a cobrança
 * não parar nesta. Não junta nada; só leva à mesma janela, com todas marcadas.
 * O resumo do cliente vem do back (`listarComprasDoCliente`).
 */
export function AvisoOutrasNotinhas({ ficha, aoReceberTodas }: { ficha: FichaDetalhe; aoReceberTodas: () => void }) {
  const clienteId = ficha.cliente?.id ?? null
  const comAberto = ficha.forma === 'notinha' && ficha.emAberto > 0
  const [resposta, setResposta] = useState<{ de: string; pagina: PaginaCompras } | null>(null)
  useEffect(() => {
    if (!clienteId || !comAberto) return
    let vivo = true
    void api().listarComprasDoCliente(clienteId, 'todas', 1, 1).then((r) => {
      if (vivo && r.ok) setResposta({ de: `${clienteId}:${ficha.emAberto}`, pagina: r.dado })
    })
    return () => { vivo = false }
  }, [clienteId, comAberto, ficha.emAberto])
  if (!clienteId || !comAberto || resposta?.de !== `${clienteId}:${ficha.emAberto}`) return null
  const { resumo } = resposta.pagina
  const outras = resumo.notinhasEmAberto - 1
  if (outras <= 0) return null
  const valorOutras = resumo.emAberto - ficha.emAberto
  const atrasada = resumo.contagem.emAtraso - (ficha.situacao === 'em-atraso' ? 1 : 0) > 0
  return (
    <div className={atrasada ? 'detalhe-ficha__outras detalhe-ficha__outras--atraso' : 'detalhe-ficha__outras'} role="status">
      <Icone nome={atrasada ? 'alerta' : 'info'} tamanho={18} />
      <p>
        <strong>{ficha.cliente!.nome}</strong> tem mais {outras === 1 ? '1 notinha' : `${outras} notinhas`} em aberto
        {atrasada && ' (com atraso)'} · {reais(valorOutras)}. Total devido: <strong>{reais(resumo.emAberto)}</strong>.
      </p>
      <Botao tamanho="pequeno" icone="dinheiro" onClick={aoReceberTodas}>
        Receber todas
      </Botao>
    </div>
  )
}
