import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router'
import type { FiltroProdutos, PaginaProdutos } from '../../../comum/contrato'
import { POR_PAGINA_MAXIMO, situacaoSaldo, type SituacaoSaldo } from '../../../comum/regras/produto'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Etiqueta, SeloCompacto, type Tom } from '../../componentes/selo/Selo'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { Icone } from '../../componentes/icone/Icone'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { reais } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
// Exportação para a Emitte desligada em 2026-10-29 (ver ExportarEmitte.tsx).
// import { ExportarProdutosEmitte } from './ExportarEmitte'
import './estoque.css'

/** A aba marcada: uma das quatro fixas, ou o nome de uma categoria. */
type Filtro = string

const ABAS_FIXAS = ['todos', 'baixo', 'sem-codigo', 'desativados'] as const
const paraContrato = (filtro: Filtro): FiltroProdutos =>
  (ABAS_FIXAS as readonly string[]).includes(filtro) ? filtro as FiltroProdutos : { categoria: filtro }

type Carga = { dado: PaginaProdutos | null; carregando: boolean; erro: string | null }

const selo: Record<SituacaoSaldo, { tom: Tom; rotulo: string }> = {
  normal: { tom: 'ok', rotulo: 'Normal' },
  baixo: { tom: 'atencao', rotulo: 'Estoque baixo' },
  zerado: { tom: 'critico', rotulo: 'Zerado' },
}

/** O fundo da linha acompanha o tom do selo. */
const linha: Record<SituacaoSaldo, string | undefined> = {
  normal: undefined,
  baixo: 'linha--atencao',
  zerado: 'linha--critica',
}

export function Estoque() {
  const [parametros] = useSearchParams()
  const pedido = parametros.get('filtro')
  const [filtro, setFiltro] = useState<Filtro>(pedido ?? 'todos')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  // O sino e o card levam direto ao filtro, mesmo com o Estoque já aberto.
  useEffect(() => { if (pedido) { setFiltro(pedido); setPagina(1) } }, [pedido])
  const { referencia: painelProdutos, linhasPorPagina } = useLinhasPorPagina()
  const navegar = useNavigate()
  // A busca vai ao back depois de uma pausa na digitação.
  const [buscaEnviada, setBuscaEnviada] = useState('')
  useEffect(() => {
    const espera = setTimeout(() => setBuscaEnviada(busca.trim()), 250)
    return () => clearTimeout(espera)
  }, [busca])
  const [carga, setCarga] = useState<Carga>({ dado: null, carregando: true, erro: null })
  const [falhaAcao, setFalhaAcao] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: Entrada rápida, Ajustar e Registrar entrada ainda gravam direto na
  // base da demonstração; a lista relê sempre que ela muda. Na Fase 3 relê
  // depois de cada gesto.
  const base = useEstadoDemonstracao()
  const porPagina = Math.min(linhasPorPagina, POR_PAGINA_MAXIMO)

  useEffect(() => {
    let vivo = true
    setCarga((atual) => ({ ...atual, carregando: true }))
    void api().listarProdutos(paraContrato(filtro), buscaEnviada, pagina, porPagina).then((r) => {
      if (!vivo) return
      if (!r.ok) return setCarga((atual) => ({ ...atual, carregando: false, erro: r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}` }))
      setCarga({ dado: r.dado, carregando: false, erro: null })
      // O filtro encolheu a lista: o back devolveu a última página que existe.
      if (r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [filtro, buscaEnviada, pagina, porPagina, base, tentativa])

  const reativar = useCallback(async (id: string) => {
    setFalhaAcao(null)
    const r = await api().ativarProduto(id, true)
    if (!r.ok) setFalhaAcao(r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)
    setTentativa((n) => n + 1)
  }, [])

  const dado = carga.dado
  // Reativou o último desativado: a aba some, e a lista volta para Todos.
  useEffect(() => { if (filtro === 'desativados' && dado?.resumo.desativados === 0) setFiltro('todos') }, [filtro, dado])
  const resumo = dado?.resumo ?? { produtos: 0, categorias: 0, baixo: 0, semCodigo: 0, desativados: 0 }
  const categorias = dado?.categorias ?? []
  const produtosDaPagina = dado?.produtos ?? []
  const total = dado?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaAtual = dado?.pagina ?? pagina
  const inicioPagina = (paginaAtual - 1) * porPagina
  const resumoPagina = !dado
    ? 'Carregando…'
    : total === 0
    ? 'Nenhum produto encontrado'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + produtosDaPagina.length} de ${total} ${total === 1 ? 'produto' : 'produtos'}`
  const contagem = (n: number) => (dado ? `${n} ${n === 1 ? 'item' : 'itens'}` : '…')

  return (
    <Tela
      titulo="Estoque"
      subtitulo="Saldos, reposição e movimentação de mercadorias no balcão."
      acaoCabecalho={
        <Botao variante="primario" icone="mais" onClick={() => navegar(rotas.cadastrarProduto)}>
          Cadastrar produto
        </Botao>
      }
      acoesTitulo={
        <>
          <Botao icone="historico" onClick={() => navegar(rotas.movimentacoesEstoque())}>
            Movimentações
          </Botao>
          <Botao icone="ajustes" onClick={() => navegar(rotas.ajustarEstoque())}>
            Ajustar estoque
          </Botao>
          <Botao icone="entrada-estoque" onClick={() => navegar(rotas.registrarEntrada)}>
            Registrar entrada
          </Botao>
          {/* <ExportarProdutosEmitte /> */}
        </>
      }
    >
      <div className="grade-resumo">
        <CartaoResumo rotulo="Produtos cadastrados" icone="pacote" valor={dado ? new Intl.NumberFormat('pt-BR').format(resumo.produtos) : '…'} nota={dado ? `${resumo.categorias} categorias` : undefined} />
        <CartaoResumo
          rotulo="Estoque baixo"
          icone="alerta"
          tom="atencao"
          valor={contagem(resumo.baixo)}
          nota="Abaixo do mínimo"
        />
        <CartaoResumo rotulo="Sem código de barras" icone="codigo-barras" valor={contagem(resumo.semCodigo)} nota="Fracionados e avulsos" />
      </div>

      <div className="estoque__filtros">
        <Filtros
          rotulo="Filtrar produtos por saldo"
          valor={filtro}
          aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1) }}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos', contagem: dado?.resumo.produtos },
            { valor: 'baixo', rotulo: 'Estoque baixo', contagem: dado?.resumo.baixo },
            { valor: 'sem-codigo', rotulo: 'Sem código de barras', contagem: dado?.resumo.semCodigo },
            ...(resumo.desativados ? [{ valor: 'desativados', rotulo: 'Desativados', contagem: resumo.desativados }] : []),
          ]}
        />
        <div className="estoque__categorias">
          <Filtros
            rotulo="Filtrar produtos por categoria"
            valor={filtro}
            aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1) }}
            opcoes={categorias.map((categoria) => ({ valor: categoria, rotulo: categoria }))}
          />
        </div>
      </div>

      <label className="estoque__busca">
        <Icone nome="busca" tamanho={18} />
        <input
          type="search"
          placeholder="Buscar por descrição, categoria, código ou código de barras..."
          value={busca}
          onChange={(evento) => { setBusca(evento.target.value); setPagina(1) }}
          aria-label="Buscar produtos no estoque"
        />
      </label>

      {(carga.erro || falhaAcao) && (
        <div className="estoque__falha" role="alert">
          <span>{falhaAcao ?? carga.erro}</span>
          {carga.erro && !falhaAcao && <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>}
        </div>
      )}

      <div ref={painelProdutos}>
      <Painel colado titulo="Produtos">
        <Tabela larguraMinima={900} className="estoque__tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th className="celula--numero">Preço</th>
              <th>Saldo</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtosDaPagina.map((produto) => {
              const situacao = situacaoSaldo(produto.saldo, produto.minimo)
              return (
                <tr key={produto.id} className={!produto.ativo ? 'estoque__inativo' : linha[situacao]}>
                  <td>
                    <span className="celula-principal codigo">{produto.codigo}</span>
                    {produto.codigoBarras ? (
                      <span className="celula-secundaria codigo">{produto.codigoBarras}</span>
                    ) : (
                      <span className="celula-secundaria estoque__sem-codigo">Sem código de barras</span>
                    )}
                  </td>
                  <td>
                    <span className="estoque__descricao" title={produto.descricao}>
                      {produto.descricao}
                    </span>
                  </td>
                  <td>
                    <Etiqueta>{produto.categoria}</Etiqueta>
                  </td>
                  <td className="celula--numero">{reais(produto.preco)}</td>
                  <td>
                    <div className="estoque__saldo">
                      <span className="estoque__quantidade">
                        <span className={`estoque__qtd estoque__qtd--${situacao}`}>
                          {produto.saldo} {produto.unidade}
                        </span>
                        <span className="estoque__minimo">
                          Mínimo: {produto.minimo} {produto.unidade}
                        </span>
                      </span>
                      <SeloCompacto tom={selo[situacao].tom}>{selo[situacao].rotulo}</SeloCompacto>
                    </div>
                  </td>
                  <td className="celula--acoes">
                    {!produto.ativo ? (
                      <Botao tamanho="pequeno" className="estoque__entrada" onClick={() => void reativar(produto.id)}>
                        Reativar
                      </Botao>
                    ) : (
                    <Botao
                      tamanho="pequeno"
                      variante={situacao === 'normal' ? 'secundario' : 'primario'}
                      className="estoque__entrada"
                      onClick={() => navegar(rotas.entradaRapida(produto.id))}
                    >
                      + Entrada
                    </Botao>
                    )}
                    <BotaoIcone icone="editar" rotulo={`Editar ${produto.descricao}`} onClick={() => navegar(rotas.editarProduto(produto.id))} />
                    {produto.ativo && <BotaoIcone icone="ajustes" rotulo={`Ajustar contagem de ${produto.descricao}`} onClick={() => navegar(rotas.ajustarEstoque(produto.id))} />}
                    <BotaoIcone icone="historico" rotulo={`Histórico de ${produto.descricao}`} onClick={() => navegar(rotas.movimentacoesEstoque(produto.id))} />
                  </td>
                </tr>
              )
            })}
            {dado && total === 0 && <tr><td colSpan={6} className="estoque__vazio">Nenhum produto corresponde à busca ou ao filtro selecionado.</td></tr>}
            {!dado && <tr><td colSpan={6} className="estoque__vazio">{carga.erro ? 'Não foi possível carregar os produtos.' : 'Carregando os produtos…'}</td></tr>}
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

      <Outlet />
    </Tela>
  )
}
