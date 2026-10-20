import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Etiqueta, SeloCompacto, type Tom } from '../../componentes/selo/Selo'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { useLinhasPorPagina } from '../../componentes/paginacao/useLinhasPorPagina'
import { Icone } from '../../componentes/icone/Icone'
import { reais } from '../../formatar'
import { definirProdutoAtivo, normalizar, resumoEstoque, situacaoSaldo, useEstadoDemonstracao, type SituacaoSaldo } from '../../mock/estado-demonstracao'
import { funcoes } from '../../funcoes'
import { rotas } from '../../rotas-caminhos'
import { ExportarProdutosEmitte } from './ExportarEmitte'
import './estoque.css'

type Filtro = string

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
  const base = useEstadoDemonstracao()
  const { produtos } = base
  const resumo = resumoEstoque(base)
  const categorias = [...new Set(produtos.filter((p) => !p.inativo).map((produto) => produto.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const termo = normalizar(busca.trim())

  const lista = produtos.filter((p) => {
    // Desativados só aparecem na aba deles, para poder reativar.
    if ((filtro === 'desativados') !== Boolean(p.inativo)) return false
    if (filtro === 'baixo' && (p.cadastroRapido || situacaoSaldo(p) === 'normal')) return false
    if (filtro === 'completar' && !p.cadastroRapido) return false
    if (filtro === 'sem-codigo' && p.codigoBarras) return false
    if (!['todos', 'baixo', 'completar', 'sem-codigo', 'desativados'].includes(filtro) && p.categoria !== filtro) return false
    return !termo || normalizar(`${p.codigo} ${p.codigoBarras ?? ''} ${p.descricao} ${p.categoria}`).includes(termo)
  })
  const totalPaginas = Math.max(1, Math.ceil(lista.length / linhasPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaAtual - 1) * linhasPorPagina
  const produtosDaPagina = lista.slice(inicioPagina, inicioPagina + linhasPorPagina)
  const resumoPagina = lista.length === 0
    ? 'Nenhum produto encontrado'
    : `Mostrando ${inicioPagina + 1}–${inicioPagina + produtosDaPagina.length} de ${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'}`

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
          <ExportarProdutosEmitte />
        </>
      }
    >
      <div className="grade-resumo">
        <CartaoResumo rotulo="Produtos cadastrados" icone="pacote" valor={new Intl.NumberFormat('pt-BR').format(resumo.produtos)} nota={`${resumo.categorias} categorias`} />
        <CartaoResumo
          rotulo="Estoque baixo"
          icone="alerta"
          tom="atencao"
          valor={`${resumo.baixo} ${resumo.baixo === 1 ? 'item' : 'itens'}`}
          nota="Abaixo do mínimo"
        />
        <CartaoResumo rotulo="Sem código de barras" icone="codigo-barras" valor={`${resumo.semCodigo} ${resumo.semCodigo === 1 ? 'item' : 'itens'}`} nota="Fracionados e avulsos" />
        {funcoes.cadastroRapido && (
          <CartaoResumo
            rotulo="Cadastro a completar"
            icone="pacote"
            tom={resumo.aCompletar ? 'atencao' : 'neutro'}
            valor={`${resumo.aCompletar} ${resumo.aCompletar === 1 ? 'item' : 'itens'}`}
            nota="Feitos às pressas na venda"
          />
        )}
      </div>

      <div className="estoque__filtros">
        <Filtros
          rotulo="Filtrar produtos por saldo"
          valor={filtro}
          aoMudar={(proximoFiltro) => { setFiltro(proximoFiltro); setPagina(1) }}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos', contagem: resumo.produtos },
            { valor: 'baixo', rotulo: 'Estoque baixo', contagem: resumo.baixo },
            ...(funcoes.cadastroRapido ? [{ valor: 'completar', rotulo: 'A completar', contagem: resumo.aCompletar }] : []),
            { valor: 'sem-codigo', rotulo: 'Sem código de barras', contagem: resumo.semCodigo },
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
              const situacao = situacaoSaldo(produto)
              const rapido = produto.cadastroRapido
              return (
                <tr key={produto.codigo} className={produto.inativo ? 'estoque__inativo' : rapido ? 'linha--atencao' : linha[situacao]}>
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
                    {rapido && (
                      <span className="celula-secundaria estoque__rapido">Cadastro rápido · falta completar e contar</span>
                    )}
                  </td>
                  <td>
                    <Etiqueta>{produto.categoria}</Etiqueta>
                  </td>
                  <td className="celula--numero">{reais(produto.preco)}</td>
                  <td>
                    <div className="estoque__saldo">
                      <span className="estoque__quantidade">
                        <span className={rapido ? 'estoque__qtd' : `estoque__qtd estoque__qtd--${situacao}`}>
                          {produto.saldo} {produto.unidade}
                        </span>
                        <span className="estoque__minimo">
                          Mínimo: {produto.minimo} {produto.unidade}
                        </span>
                      </span>
                      {rapido
                        ? <SeloCompacto tom="atencao">Sem contagem</SeloCompacto>
                        : <SeloCompacto tom={selo[situacao].tom}>{selo[situacao].rotulo}</SeloCompacto>}
                    </div>
                  </td>
                  <td className="celula--acoes">
                    {produto.inativo ? (
                      <Botao tamanho="pequeno" className="estoque__entrada" onClick={() => definirProdutoAtivo(produto.codigo, true)}>
                        Reativar
                      </Botao>
                    ) : rapido ? (
                      <Botao tamanho="pequeno" variante="primario" className="estoque__entrada" onClick={() => navegar(rotas.completarProduto(produto.codigo))}>
                        Completar
                      </Botao>
                    ) : (
                    <Botao
                      tamanho="pequeno"
                      variante={situacao === 'normal' ? 'secundario' : 'primario'}
                      className="estoque__entrada"
                      onClick={() => navegar(rotas.entradaRapida(produto.codigo))}
                    >
                      + Entrada
                    </Botao>
                    )}
                    {!rapido && <BotaoIcone icone="editar" rotulo={`Editar ${produto.descricao}`} onClick={() => navegar(rotas.editarProduto(produto.codigo))} />}
                    {!rapido && !produto.inativo && <BotaoIcone icone="ajustes" rotulo={`Ajustar contagem de ${produto.descricao}`} onClick={() => navegar(rotas.ajustarEstoque(produto.codigo))} />}
                    <BotaoIcone icone="historico" rotulo={`Histórico de ${produto.descricao}`} onClick={() => navegar(rotas.movimentacoesEstoque(produto.codigo))} />
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && <tr><td colSpan={6} className="estoque__vazio">{filtro === 'completar' && !termo ? 'Nenhum cadastro rápido pendente. Tudo completo.' : 'Nenhum produto corresponde à busca ou ao filtro selecionado.'}</td></tr>}
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
