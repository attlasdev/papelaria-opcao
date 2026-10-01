import { Fragment, useMemo, useRef, useState } from 'react'
import { gsap, movimentoReduzido, useGSAP } from '../../animacoes/gsap'
import { Link, Outlet } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloCompacto, SeloSituacao, type Tom } from '../../componentes/selo/Selo'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { Icone } from '../../componentes/icone/Icone'
import { dataCurta, reais } from '../../formatar'
import {
  hojeISO,
  clienteCorrespondeBusca,
  resumoDoCliente,
  rotuloForma,
  situacaoDaFicha,
  useEstadoDemonstracao,
  type Cliente,
  type ResumoCliente,
  type SituacaoCliente,
  type SituacaoNotinha,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './clientes.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

type Filtro = 'todos' | 'pendente' | 'vencido'

const selo: Record<SituacaoCliente, { tom: Tom; titulo: string }> = {
  'em-dia': { tom: 'ok', titulo: 'Em dia' },
  pendente: { tom: 'atencao', titulo: 'Notinhas a vencer' },
  vencido: { tom: 'critico', titulo: 'Notinhas em atraso' },
}

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter((parte) => parte.length > 2)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
}

const seloCompra: Record<SituacaoNotinha, { tom: Tom; titulo: string }> = {
  pago: { tom: 'ok', titulo: 'Pago' },
  pendente: { tom: 'atencao', titulo: 'A receber' },
  vencido: { tom: 'critico', titulo: 'Em atraso' },
  cancelada: { tom: 'neutro', titulo: 'Cancelada' },
}

type Linha = Cliente & { resumo: ResumoCliente }

function quantidadeClientes(total: number) {
  return `${total} ${total === 1 ? 'cliente' : 'clientes'}`
}

export function Clientes() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const { referencia: painelClientes, linhasPorPagina: clientesPorPagina } = useLinhasPorPagina(8)
  const base = useEstadoDemonstracao()
  // Um resumo por cliente, recalculado só quando a base muda (não a cada tecla da busca).
  const linhas = useMemo<Linha[]>(() => {
    const hoje = hojeISO()
    return base.clientes.map((c) => ({ ...c, resumo: resumoDoCliente(base, c.id, hoje) }))
  }, [base])
  // Mesmo período em que a página abre: hoje.
  const vendasSemIdentificacao = base.fichas.filter((ficha) => ficha.clienteId === null && ficha.data === hojeISO()).length
  const clientesComNotinhasAVencer = linhas.filter((l) => l.resumo.situacao === 'pendente').length
  const clientesComNotinhasEmAtraso = linhas.filter((l) => l.resumo.situacao === 'vencido').length

  const lista = linhas
    .filter((c) => filtro === 'todos' || c.resumo.situacao === filtro)
    .filter((c) => clienteCorrespondeBusca(c, busca))
  const totalPaginas = Math.max(1, Math.ceil(lista.length / clientesPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * clientesPorPagina
  const clientesDaPagina = lista.slice(inicioPagina, inicioPagina + clientesPorPagina)
  const resumoPagina = lista.length === 0
    ? 'Nenhum cliente encontrado'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + clientesDaPagina.length} de ${quantidadeClientes(lista.length)}`

  return (
    <Tela
      titulo="Clientes"
      subtitulo="Clientes e histórico de compras."
      acaoCabecalho={
        <Link className="botao botao--primario" to={rotas.cadastrarCliente}>
          <Icone nome="adicionar-pessoa" tamanho={18} /> Cadastrar cliente
        </Link>
      }
    >
      <div className="grade-resumo">
        <CartaoResumo rotulo="Clientes cadastrados" icone="clientes" valor={linhas.length} nota="Na base" />
        <CartaoResumo rotulo="Notinhas a vencer" icone="relogio" tom="atencao" valor={quantidadeClientes(clientesComNotinhasAVencer)} />
        <CartaoResumo
          rotulo="Notinhas em atraso"
          icone="alerta"
          tom="critico"
          valor={quantidadeClientes(clientesComNotinhasEmAtraso)}
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
            {vendasSemIdentificacao === 1 ? '1 venda hoje' : `${vendasSemIdentificacao} vendas hoje`} · consultar histórico
          </span>
        </span>
        <span className="clientes__sem-identificacao-ver">
          Ver vendas <Icone nome="seta-direita" tamanho={16} />
        </span>
      </Link>

      <div ref={painelClientes}>
      <Painel
        colado
        titulo={
          <label className="clientes__busca">
            <Icone nome="busca" tamanho={18} />
            <input
              type="search"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
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
              { valor: 'todos', rotulo: 'Todos', contagem: linhas.length },
              { valor: 'pendente', rotulo: 'Notinhas a vencer', contagem: clientesComNotinhasAVencer },
              { valor: 'vencido', rotulo: 'Notinhas em atraso', contagem: clientesComNotinhasEmAtraso },
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
                    <span className="clientes__codigo">{cliente.id}</span>
                  </td>
                  <td>
                    <div className="clientes__pessoa">
                      <span className="clientes__avatar" aria-hidden>
                        {iniciais(cliente.nome)}
                      </span>
                      <span>
                        <span className="celula-principal">{cliente.nome}</span>
                        <span className="celula-secundaria">{cliente.descricao}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="celula-principal codigo">{cliente.documento}</span>
                    <span className="celula-secundaria">{cliente.telefone}</span>
                  </td>
                  <td className="celula--centro numero clientes__compras">{cliente.resumo.compras} compras</td>
                  <td>
                    <SeloSituacao {...selo[cliente.resumo.situacao]} detalhe={cliente.resumo.detalheSituacao} />
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
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="clientes__vazio">
                  Nenhum cliente encontrado com esse filtro ou busca.
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

function ExpansaoCompras({ cliente }: { cliente: Linha }) {
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

function ComprasRecentes({ cliente }: { cliente: Linha }) {
  const abrirFicha = useAbrirFicha()
  const recentes = cliente.resumo.fichas.slice(0, 3)
  if (recentes.length === 0) {
    return <p className="clientes__sem-compras">Nenhuma compra registrada ainda.</p>
  }
  const hoje = hojeISO()
  return (
    <div className="clientes__recentes">
      <div className="clientes__recentes-topo">
        <span>
          <Icone nome="historico" tamanho={18} /> {recentes.length === 1 ? 'Compra mais recente' : `${recentes.length} compras mais recentes`}
        </span>
        <span className="celula-secundaria">
          {cliente.nome} · {cliente.id}
        </span>
      </div>
      <div className="clientes__cartoes">
        {recentes.map((ficha) => {
          const { situacao } = situacaoDaFicha(ficha, hoje)
          return (
            <article key={ficha.id} className="clientes__cartao">
              <div className="clientes__cartao-topo">
                <span className="codigo">Compra #{ficha.id}</span>
                <SeloCompacto tom={seloCompra[situacao].tom}>{seloCompra[situacao].titulo}</SeloCompacto>
              </div>
              <span className="celula-secundaria">{dataCurta(ficha.data)}, {ficha.horario}</span>
              <strong className="clientes__cartao-valor">{reais(ficha.total)}</strong>
              <div className="clientes__cartao-rodape">
                <span>{rotuloForma(ficha)}</span>
                <button type="button" className="clientes__abrir" onClick={() => abrirFicha(ficha.id)}>
                  Abrir ficha
                </button>
              </div>
            </article>
          )
        })}
      </div>
      <div className="clientes__recentes-rodape">
        <span>
          Total acumulado: <strong>{reais(cliente.resumo.totalComprado)}</strong>
        </span>
        <Link className="clientes__historico" to={rotas.cliente(cliente.id)}>
          Ver histórico completo ({cliente.resumo.compras} compras) <Icone nome="seta-direita" tamanho={16} />
        </Link>
      </div>
    </div>
  )
}
