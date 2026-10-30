import { Fragment, useEffect, useRef, useState } from 'react'
import { gsap, movimentoReduzido, useGSAP } from '../../animacoes/gsap'
import { Link, Outlet } from 'react-router'
import type { CompraCliente, Falha, FiltroClientes, LinhaCliente, PaginaClientes, PaginaCompras, SituacaoCliente, SituacaoCompra } from '../../../comum/contrato'
import { formatarDocumento, formatarTelefone } from '../../../comum/regras/cliente'
import { POR_PAGINA_MAXIMO } from '../../../comum/regras/produto'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloCompacto, SeloSituacao, type Tom } from '../../componentes/selo/Selo'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { Icone } from '../../componentes/icone/Icone'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataHora, reais } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
// Exportação para a Emitte desligada em 2026-10-29 (ver ExportarClientesEmitte.tsx).
// import { ExportarClientesEmitte } from './ExportarClientesEmitte'
import './clientes.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

const selo: Record<SituacaoCliente, { tom: Tom; titulo: string }> = {
  'em-dia': { tom: 'ok', titulo: 'Em dia' },
  'a-vencer': { tom: 'atencao', titulo: 'Notinhas a vencer' },
  'em-atraso': { tom: 'critico', titulo: 'Notinhas em atraso' },
}

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter((parte) => parte.length > 2)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
}

const seloCompra: Record<SituacaoCompra, { tom: Tom; titulo: string }> = {
  paga: { tom: 'ok', titulo: 'Pago' },
  'a-vencer': { tom: 'atencao', titulo: 'A receber' },
  'em-atraso': { tom: 'critico', titulo: 'Em atraso' },
  cancelada: { tom: 'neutro', titulo: 'Cancelada' },
}

const NOME_FORMA = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', misto: 'Misto', notinha: 'Notinha' } as const
const rotuloForma = (c: CompraCliente) => c.rotulo ?? NOME_FORMA[c.forma]

/**
 * Na lista, o CPF fica com parte escondida (a máscara é da tela, não do dado:
 * `docs/contrato/schema-1.0.md`); o CNPJ, de empresa, aparece inteiro. A base
 * da demonstração só tem o meio do CPF.
 */
function documentoNaLista(d: string | null) {
  if (!d) return 'Sem documento'
  if (d.length === 14) return `CNPJ ${formatarDocumento(d)}`
  const meio = d.length === 11 ? d.slice(3, 9) : d
  return `CPF ***.${meio.slice(0, 3)}.${meio.slice(3)}-**`
}

function quantidadeClientes(total: number) {
  return `${total} ${total === 1 ? 'cliente' : 'clientes'}`
}

const quantidadeCompras = (n: number) => `${n} ${n === 1 ? 'compra' : 'compras'}`

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

type Carga = { dado: PaginaClientes | null; erro: string | null }

export function Clientes() {
  const [filtro, setFiltro] = useState<FiltroClientes>('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const { referencia: painelClientes, linhasPorPagina } = useLinhasPorPagina(8)
  const porPagina = Math.min(linhasPorPagina, POR_PAGINA_MAXIMO)
  // A busca vai ao back depois de uma pausa na digitação.
  const [buscaEnviada, setBuscaEnviada] = useState('')
  useEffect(() => {
    const espera = setTimeout(() => setBuscaEnviada(busca.trim()), 250)
    return () => clearTimeout(espera)
  }, [busca])
  const [carga, setCarga] = useState<Carga>({ dado: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: a venda e o recebimento ainda gravam direto na base da demonstração;
  // a lista relê sempre que ela muda.
  const base = useEstadoDemonstracao()

  useEffect(() => {
    let vivo = true
    void api().listarClientes(filtro, buscaEnviada, pagina, porPagina).then((r) => {
      if (!vivo) return
      if (!r.ok) return setCarga((atual) => ({ ...atual, erro: mensagem(r) }))
      setCarga({ dado: r.dado, erro: null })
      // O filtro encolheu a lista: o back devolveu a última página que existe.
      if (r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [filtro, buscaEnviada, pagina, porPagina, base, tentativa])

  const dado = carga.dado
  const resumo = dado?.resumo
  const clientesDaPagina = dado?.clientes ?? []
  const total = dado?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaAtual = dado?.pagina ?? pagina
  const inicioPagina = (paginaAtual - 1) * porPagina
  const resumoPagina = !dado
    ? ''
    : total === 0
      ? 'Nenhum cliente encontrado'
      : `Mostrando ${inicioPagina + 1}–${inicioPagina + clientesDaPagina.length} de ${quantidadeClientes(total)}`
  const vendasSemIdentificacao = dado?.vendasSemIdentificacaoHoje

  return (
    <Tela
      titulo="Clientes"
      subtitulo="Clientes e histórico de compras."
      acaoCabecalho={
        <Link className="botao botao--primario" to={rotas.cadastrarCliente}>
          <Icone nome="adicionar-pessoa" tamanho={18} /> Cadastrar cliente
        </Link>
      }
      // acoesTitulo={<ExportarClientesEmitte />}
    >
      <div className="grade-resumo">
        <CartaoResumo rotulo="Clientes cadastrados" icone="clientes" valor={resumo ? resumo.clientes : '—'} nota="Na base" />
        <CartaoResumo rotulo="Notinhas a vencer" icone="relogio" tom="atencao" valor={resumo ? quantidadeClientes(resumo.aVencer) : '—'} />
        <CartaoResumo
          rotulo="Notinhas em atraso"
          icone="alerta"
          tom="critico"
          valor={resumo ? quantidadeClientes(resumo.emAtraso) : '—'}
          sinal="saida"
        />
      </div>

      <Link className="clientes__sem-identificacao" to={rotas.vendasSemIdentificacao}>
        <span className="clientes__avatar clientes__avatar--sem-identificacao" aria-hidden>
          <Icone nome="pessoa" tamanho={18} />
        </span>
        <span className="clientes__sem-identificacao-texto">
          <span className="celula-principal">Vendas sem identificação</span>
          <span className="celula-secundaria">
            {vendasSemIdentificacao === undefined ? 'Consultar histórico' : `${vendasSemIdentificacao === 1 ? '1 venda hoje' : `${vendasSemIdentificacao} vendas hoje`} · consultar histórico`}
          </span>
        </span>
        <span className="clientes__sem-identificacao-ver">
          Ver vendas <Icone nome="seta-direita" tamanho={16} />
        </span>
      </Link>

      {carga.erro && (
        <div className="clientes__falha" role="alert">
          <span>{carga.erro}</span>
          <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
        </div>
      )}

      <div ref={painelClientes}>
      <Painel
        colado
        titulo={
          <label className="clientes__busca">
            <Icone nome="busca" tamanho={18} />
            <input
              type="search"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
              aria-label="Buscar clientes"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(1); setAberto(null) }}
            />
          </label>
        }
        acoes={
          <Filtros
            rotulo="Filtrar por situação das compras"
            valor={filtro}
            aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1); setAberto(null) }}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos', contagem: resumo?.clientes },
              { valor: 'a-vencer', rotulo: 'Notinhas a vencer', contagem: resumo?.aVencer },
              { valor: 'em-atraso', rotulo: 'Notinhas em atraso', contagem: resumo?.emAtraso },
            ]}
          />
        }
      >
        <Tabela larguraMinima={880}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Documento / contato</th>
              <th className="celula--centro">Compras</th>
              <th>Situação das compras</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientesDaPagina.map((cliente) => (
              <Fragment key={cliente.id}>
                <tr className={aberto === cliente.id ? 'clientes__linha--aberta' : undefined}>
                  <td>
                    <span className="clientes__codigo">{cliente.codigo}</span>
                  </td>
                  <td>
                    <div className="clientes__pessoa">
                      <span className="clientes__avatar" aria-hidden>
                        {iniciais(cliente.nome)}
                      </span>
                      <span className="celula-principal">{cliente.nome}</span>
                    </div>
                  </td>
                  <td>
                    <span className="celula-principal codigo">{documentoNaLista(cliente.documento)}</span>
                    <span className="celula-secundaria">{cliente.telefone ? formatarTelefone(cliente.telefone) : 'Sem telefone'}</span>
                  </td>
                  <td className="celula--centro numero clientes__compras">{quantidadeCompras(cliente.compras)}</td>
                  <td>
                    <SeloSituacao {...selo[cliente.situacao]} detalhe={cliente.emAberto > 0 ? `${reais(cliente.emAberto)} em aberto` : undefined} />
                  </td>
                  <td className="celula--acoes">
                    <Link className="botao botao--secundario botao--pequeno" to={rotas.cliente(cliente.id)}>
                      <Icone nome="olho" tamanho={16} /> Ver
                    </Link>
                    <BotaoIcone
                      icone={aberto === cliente.id ? 'chevron-cima' : 'chevron-baixo'}
                      rotulo={aberto === cliente.id ? 'Recolher compras' : 'Mostrar compras recentes'}
                      onClick={() => setAberto(aberto === cliente.id ? null : cliente.id)}
                    />
                  </td>
                </tr>
                {aberto === cliente.id && (
                  <tr className="clientes__expansao">
                    <td colSpan={6}>
                      <ExpansaoCompras cliente={cliente} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {dado && total === 0 && (
              <tr>
                <td colSpan={6} className="clientes__vazio">
                  Nenhum cliente encontrado com esse filtro ou busca.
                </td>
              </tr>
            )}
            {!dado && (
              <tr>
                <td colSpan={6} className="clientes__vazio">
                  {carga.erro ? 'Não foi possível carregar os clientes.' : 'Carregando os clientes…'}
                </td>
              </tr>
            )}
          </tbody>
        </Tabela>
        <Paginacao
          resumo={resumoPagina}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          aoMudar={(proximaPagina) => { setPagina(proximaPagina); setAberto(null) }}
        />
      </Painel>
      </div>

      <p className="clientes__nota">Os prazos se referem às notinhas, não à pessoa.</p>
      <Outlet />
    </Tela>
  )
}

function ExpansaoCompras({ cliente }: { cliente: LinhaCliente }) {
  const conteudo = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!conteudo.current || movimentoReduzido()) return
    gsap.fromTo(conteudo.current,
      { y: -4, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.16, ease: 'power1.out', clearProps: 'transform,opacity' },
    )
  }, { scope: conteudo })

  return <div ref={conteudo}><ComprasRecentes cliente={cliente} /></div>
}

type CargaCompras = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; dado: PaginaCompras }

function ComprasRecentes({ cliente }: { cliente: LinhaCliente }) {
  const abrirFicha = useAbrirFicha()
  const [carga, setCarga] = useState<CargaCompras>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    void api().listarComprasDoCliente(cliente.id, 1, 3).then((r) => {
      if (vivo) setCarga(r.ok ? { fase: 'pronto', dado: r.dado } : { fase: 'erro', mensagem: mensagem(r) })
    })
    return () => { vivo = false }
  }, [cliente.id, tentativa])

  if (carga.fase === 'carregando') return <p className="clientes__sem-compras" role="status">Carregando as compras…</p>
  if (carga.fase === 'erro') {
    return (
      <div className="clientes__falha clientes__falha--compras" role="alert">
        <span>{carga.mensagem}</span>
        <Botao tamanho="pequeno" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa((n) => n + 1) }}>Tentar de novo</Botao>
      </div>
    )
  }
  const { compras: recentes, resumo } = carga.dado
  if (recentes.length === 0) {
    return <p className="clientes__sem-compras">Nenhuma compra registrada ainda.</p>
  }
  return (
    <div className="clientes__recentes">
      <div className="clientes__recentes-topo">
        <span>
          <Icone nome="historico" tamanho={18} /> {recentes.length === 1 ? 'Compra mais recente' : `${recentes.length} compras mais recentes`}
        </span>
        <span className="celula-secundaria">
          {cliente.nome} · {cliente.codigo}
        </span>
      </div>
      <div className="clientes__cartoes">
        {recentes.map((compra) => (
          <article key={compra.id} className="clientes__cartao">
            <div className="clientes__cartao-topo">
              <span className="codigo">Compra #{compra.numero}</span>
              <SeloCompacto tom={seloCompra[compra.situacao].tom}>{seloCompra[compra.situacao].titulo}</SeloCompacto>
            </div>
            <span className="celula-secundaria">{dataHora(compra.registradoEm)}</span>
            <strong className="clientes__cartao-valor">{reais(compra.total)}</strong>
            <div className="clientes__cartao-rodape">
              <span>{rotuloForma(compra)}</span>
              <button type="button" className="clientes__abrir" onClick={() => abrirFicha(compra.id)}>
                Abrir ficha
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="clientes__recentes-rodape">
        <span>
          Total acumulado: <strong>{reais(resumo.totalComprado)}</strong>
        </span>
        <Link className="clientes__historico" to={rotas.cliente(cliente.id)}>
          Ver histórico completo ({quantidadeCompras(resumo.compras)}) <Icone nome="seta-direita" tamanho={16} />
        </Link>
      </div>
    </div>
  )
}
