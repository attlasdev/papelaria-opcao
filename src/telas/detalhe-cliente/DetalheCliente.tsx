import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import type { Cliente, CompraCliente, Falha, FiltroCompras, PaginaCompras, SituacaoCompra } from '../../../comum/contrato'
import { formatarDocumento, formatarTelefone } from '../../../comum/regras/cliente'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { POR_PAGINA_MAXIMO } from '../../../comum/regras/produto'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloSituacao, type Tom } from '../../componentes/selo/Selo'
import { ComIcone } from '../../componentes/icone/Icone'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { api } from '../../dados/api'
import { juntarEndereco } from '../../dados/endereco'
import { tituloFalha } from '../../falhas'
import { dataCurta, reais } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { ReceberNotinhas } from './receber/ReceberNotinhas'
import './detalhe-cliente.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

const selo: Record<SituacaoCompra, { tom: Tom; titulo: string }> = {
  paga: { tom: 'ok', titulo: 'Pago' },
  'a-vencer': { tom: 'atencao', titulo: 'Pendente' },
  'em-atraso': { tom: 'critico', titulo: 'Vencido' },
  cancelada: { tom: 'neutro', titulo: 'Cancelada' },
}

const NOME_FORMA = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', misto: 'Misto', notinha: 'Notinha' } as const

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** Dias de `de` até `ate`, os dois `AAAA-MM-DD`. */
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)

/** A segunda linha do selo: o prazo da notinha, ou o dia em que quitou ou cancelou. */
function detalheDoSelo(c: CompraCliente, hoje: string) {
  if (c.situacao === 'cancelada') return c.canceladaEm ? `Em ${dataCurta(c.canceladaEm)}` : undefined
  if (c.situacao === 'paga') return c.quitadaEm ? `Quitada em ${dataCurta(c.quitadaEm)}` : undefined
  const dias = diasEntre(hoje, c.vencimento ?? hoje)
  if (dias === 0) return 'Vence hoje'
  if (dias > 0) return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`
}

const textoItens = (c: CompraCliente) => [...c.itens.map((i) => `${i.descricao} (${i.quantidade}x)`), ...c.servicos].join(', ')

function contagemItens(c: CompraCliente) {
  const unidades = c.itens.reduce((t, i) => t + i.quantidade, 0)
  const itens = c.itens.length ? `${c.itens.length} ${c.itens.length === 1 ? 'tipo de item' : 'tipos de itens'} · ${unidades} ${unidades === 1 ? 'unidade' : 'unidades'}` : ''
  const servicos = c.servicos.length ? `${c.servicos.length} ${c.servicos.length === 1 ? 'serviço' : 'serviços'}` : ''
  return [itens, servicos].filter(Boolean).join(' · ')
}

/** Data e horário de São Paulo, separados para as duas linhas da célula. */
function dataEHora(instante: string) {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(instante)).split(', ')
  return { data: partes[0], hora: partes[1] ?? '' }
}

/** Inteiro no detalhe (`R-CLIENTE-05`). A base da demonstração só tem o meio do CPF. */
function documentoInteiro(d: string) {
  if (d.length === 11 || d.length === 14) return formatarDocumento(d)
  return `***.${d.slice(0, 3)}.${d.slice(3)}-**`
}

function enderecoEmLinha(c: Cliente) {
  const cidade = c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade ?? c.uf ?? ''
  const numero = [c.numero, c.complemento].filter(Boolean).join(', ')
  const endereco = juntarEndereco(c.rua ?? '', numero, c.bairro ?? '', cidade)
  const cep = c.cep ? `CEP ${c.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : ''
  return [endereco, cep].filter(Boolean).join(' · ')
}

// Cada resposta guarda de qual cliente veio: ao trocar de cliente, a do anterior não aparece.
type CargaCliente = { de: string } & ({ fase: 'nao-encontrado' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; cliente: Cliente })
type CargaCompras = { de: string; dado: PaginaCompras | null; erro: string | null }

export function DetalheCliente() {
  const abrirFicha = useAbrirFicha()
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState<FiltroCompras>('todas')
  const [pagina, setPagina] = useState(1)
  const { referencia: painelCompras, linhasPorPagina } = useLinhasPorPagina()
  const porPagina = Math.min(linhasPorPagina, POR_PAGINA_MAXIMO)
  /** Notinhas abertas na janela de recebimento; null = fechada. */
  // Janela de recebimento: 'todas' abre com todas marcadas; um id abre só com ela marcada.
  const [receber, setReceber] = useState<'todas' | string | null>(null)
  // Outro cliente pela mesma tela (busca do cabeçalho): começa de "Todas", na página 1.
  const [doCliente, setDoCliente] = useState(id)
  if (doCliente !== id) {
    setDoCliente(id)
    setFiltro('todas')
    setPagina(1)
    setReceber(null)
  }
  const [respostaCliente, setCargaCliente] = useState<CargaCliente | null>(null)
  const [respostaCompras, setCarga] = useState<CargaCompras | null>(null)
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: a edição, a venda e o recebimento ainda gravam direto na base da
  // demonstração; o detalhe relê sempre que ela muda.
  const base = useEstadoDemonstracao()
  const hoje = hojeEmSaoPaulo()

  useEffect(() => {
    let vivo = true
    void api().obterCliente(id).then((r) => {
      if (!vivo) return
      if (r.ok) setCargaCliente({ de: id, fase: 'pronto', cliente: r.dado })
      else setCargaCliente(r.causa === 'nao-encontrado' ? { de: id, fase: 'nao-encontrado' } : { de: id, fase: 'erro', mensagem: mensagem(r) })
    })
    return () => { vivo = false }
  }, [id, base, tentativa])

  useEffect(() => {
    let vivo = true
    void api().listarComprasDoCliente(id, filtro, pagina, porPagina).then((r) => {
      if (!vivo) return
      // Cliente que não existe: o aviso vem do cadastro.
      if (!r.ok) return setCarga((atual) => ({ de: id, dado: atual?.de === id ? atual.dado : null, erro: r.causa === 'nao-encontrado' ? null : mensagem(r) }))
      setCarga({ de: id, dado: r.dado, erro: null })
      if (r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [id, filtro, pagina, porPagina, base, tentativa])

  const cargaCliente = respostaCliente?.de === id ? respostaCliente : null
  const carga = respostaCompras?.de === id ? respostaCompras : null
  const cadastro = cargaCliente?.fase === 'pronto' ? cargaCliente.cliente : null
  const naoEncontrado = cargaCliente?.fase === 'nao-encontrado'
  const erro = cargaCliente?.fase === 'erro' ? cargaCliente.mensagem : carga?.erro ?? null
  const dado = carga?.dado ?? null
  const resumo = dado?.resumo
  const comprasDaPagina = dado?.compras ?? []
  const total = dado?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaAtual = dado?.pagina ?? pagina
  const inicioPagina = (paginaAtual - 1) * porPagina
  const resumoPagina = !dado
    ? ''
    : total === 0
      ? 'Nenhuma compra neste filtro'
      : `Mostrando ${inicioPagina + 1}–${inicioPagina + comprasDaPagina.length} de ${total} ${total === 1 ? 'compra' : 'compras'}`
  const desde = cadastro ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'short', year: 'numeric' }).format(new Date(cadastro.criadoEm)) : ''
  const temAberto = (resumo?.notinhasEmAberto ?? 0) > 0
  const tentarDeNovo = () => setTentativa((n) => n + 1)

  return (
    <Tela
      voltar={{ para: rotas.clientes, rotulo: 'Voltar para clientes' }}
      trilha={
        <>
          <Link className="detalhe-cliente__trilha-link" to={rotas.clientes}>
            Clientes
          </Link>{' '}
          / {cadastro?.nome ?? 'Cliente'}
        </>
      }
      titulo={cadastro?.nome ?? (naoEncontrado ? 'Cliente não encontrado' : 'Cliente')}
      subtitulo={cadastro ? `${cadastro.codigo} · cliente desde ${desde}` : naoEncontrado ? 'Volte à lista de clientes' : ''}
      acaoCabecalho={
        <Botao icone="editar" disabled={!cadastro} onClick={() => navegar(rotas.editarCliente(id))}>
          Editar dados
        </Botao>
      }
    >
      {naoEncontrado && <p className="detalhe-cliente__aviso">Cliente não encontrado.</p>}
      {erro && (
        <div className="detalhe-cliente__falha" role="alert">
          <span>{erro}</span>
          <Botao tamanho="pequeno" onClick={tentarDeNovo}>Tentar de novo</Botao>
        </div>
      )}

      <div className="detalhe-cliente__topo">
        <Painel titulo={<ComIcone icone="pessoa">Cadastro</ComIcone>}>
          <dl className="detalhe-cliente__dados">
            <div>
              <dt><ComIcone icone="documento">Documento</ComIcone></dt>
              <dd className="codigo">{cadastro?.documento ? documentoInteiro(cadastro.documento) : '—'}</dd>
            </div>
            <div>
              <dt><ComIcone icone="telefone">Telefone / WhatsApp</ComIcone></dt>
              <dd>{cadastro?.telefone ? formatarTelefone(cadastro.telefone) : '—'}</dd>
            </div>
            <div>
              <dt><ComIcone icone="endereco">Endereço</ComIcone></dt>
              <dd>{(cadastro && enderecoEmLinha(cadastro)) || '—'}</dd>
            </div>
          </dl>
        </Painel>
        <div className="detalhe-cliente__numeros">
          <CartaoResumo
            rotulo="Total comprado"
            icone="carrinho"
            tom="ok"
            valor={resumo?.compras ? reais(resumo.totalComprado) : '—'}
            nota={resumo ? `${resumo.compras} ${resumo.compras === 1 ? 'compra registrada' : 'compras registradas'}` : undefined}
          />
          {/* O número que a dona olha quando a cliente pergunta "quanto eu devo?" abre o recebimento. */}
          <button
            type="button"
            className="detalhe-cliente__cartao-acao"
            disabled={!temAberto}
            onClick={() => setReceber('todas')}
            aria-label={temAberto ? 'Receber notinhas em aberto' : 'Nenhuma notinha em aberto'}
          >
          <CartaoResumo
            rotulo="Notinhas em aberto"
            icone="relogio"
            tom={resumo?.situacao === 'em-atraso' ? 'critico' : temAberto ? 'atencao' : 'neutro'}
            valor={resumo && temAberto ? reais(resumo.emAberto) : '—'}
            nota={!resumo ? undefined : temAberto ? `${resumo.notinhasEmAberto} ${resumo.notinhasEmAberto === 1 ? 'notinha' : 'notinhas'} · clique para receber` : 'Nada a receber'}
          />
          </button>
          <CartaoResumo rotulo="Ticket médio" icone="recibo" valor={resumo?.compras ? reais(resumo.ticketMedio) : '—'} nota="Por compra" />
        </div>
      </div>

      <div ref={painelCompras}>
      <Painel
        colado
        titulo="Histórico de compras"
        acoes={
          <Filtros
            rotulo="Filtrar compras"
            valor={filtro}
            aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1) }}
            opcoes={[
              { valor: 'todas', rotulo: 'Todas', contagem: resumo?.contagem.todas },
              { valor: 'paga', rotulo: 'Pagas', contagem: resumo?.contagem.pagas },
              { valor: 'a-vencer', rotulo: 'Notinhas a vencer', contagem: resumo?.contagem.aVencer },
              { valor: 'em-atraso', rotulo: 'Notinhas em atraso', contagem: resumo?.contagem.emAtraso },
            ]}
          />
        }
      >
        <Tabela larguraMinima={900}>
          <thead>
            <tr>
              <th>Ficha</th>
              <th>Data</th>
              <th>Itens principais</th>
              <th>Pagamento</th>
              <th className="celula--numero">Valor</th>
              <th>Situação</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {comprasDaPagina.map((compra) => {
              const quando = dataEHora(compra.registradoEm)
              const itens = textoItens(compra)
              return (
                <tr key={compra.id} className={compra.situacao === 'em-atraso' ? 'linha--critica' : compra.situacao === 'a-vencer' ? 'linha--atencao' : undefined}>
                  <td className="codigo">#{compra.numero}</td>
                  <td>
                    <span className="celula-principal numero">{quando.data}</span>
                    <span className="celula-secundaria numero">{quando.hora}</span>
                  </td>
                  <td className="detalhe-cliente__itens">
                    <span className="celula-principal" title={itens}>
                      {itens || '—'}
                    </span>
                    <span className="celula-secundaria">{contagemItens(compra)}</span>
                  </td>
                  <td className="detalhe-cliente__pagamento">{compra.rotulo ?? NOME_FORMA[compra.forma]}</td>
                  <td className="celula--numero detalhe-cliente__valor">
                    <span className="celula-principal">{reais(compra.total)}</span>
                    {compra.emAberto > 0 && compra.emAberto < compra.total && (
                      <span className="celula-secundaria detalhe-cliente__aberto">{reais(compra.emAberto)} em aberto</span>
                    )}
                  </td>
                  <td>
                    <SeloSituacao {...selo[compra.situacao]} detalhe={detalheDoSelo(compra, hoje)} />
                  </td>
                  <td className="celula--acoes">
                    <Botao tamanho="pequeno" onClick={() => abrirFicha(compra.id)}>
                      Ver ficha
                    </Botao>
                    {compra.emAberto > 0 && (
                      <Botao tamanho="pequeno" variante="primario" onClick={() => setReceber(compra.id)}>
                        Receber
                      </Botao>
                    )}
                  </td>
                </tr>
              )
            })}
            {dado && total === 0 && (
              <tr>
                <td colSpan={7} className="detalhe-cliente__vazio">
                  {resumo?.contagem.todas ? 'Nenhuma compra nesta situação.' : 'Este cliente ainda não comprou.'}
                </td>
              </tr>
            )}
            {!dado && !naoEncontrado && (
              <tr>
                <td colSpan={7} className="detalhe-cliente__vazio">
                  {erro ? 'Não foi possível carregar as compras.' : 'Carregando as compras…'}
                </td>
              </tr>
            )}
          </tbody>
        </Tabela>
        <Paginacao
          resumo={resumoPagina}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudar={setPagina}
        />
      </Painel>
      </div>
      {receber && cadastro && (
        <ReceberNotinhas
          clienteId={id}
          marcadas={receber === 'todas' ? undefined : [receber]}
          aoFechar={() => setReceber(null)}
        />
      )}
      <Outlet />
    </Tela>
  )
}
