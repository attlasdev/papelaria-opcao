import { createHashRouter } from 'react-router'
import { Moldura } from './componentes/layout/moldura/Moldura'
import { Inicio } from './telas/inicio/Inicio'
import { ResultadosBusca } from './telas/resultados-busca/ResultadosBusca'
import { CriarFicha } from './telas/criar-ficha/CriarFicha'
import { DetalheFicha } from './telas/detalhe-ficha/DetalheFicha'
import { Clientes } from './telas/clientes/Clientes'
import { DetalheCliente } from './telas/detalhe-cliente/DetalheCliente'
import { CadastrarCliente, EditarCliente } from './telas/formulario-cliente/FormularioCliente'
import { VendasSemIdentificacao } from './telas/vendas-sem-identificacao/VendasSemIdentificacao'
import { Financeiro } from './telas/financeiro/Financeiro'
import { Caixa } from './telas/caixa/Caixa'
import { RegistrarMovimento } from './telas/registrar-movimento/RegistrarMovimento'
import { Estoque } from './telas/estoque/Estoque'
import { CadastrarProduto, CompletarProduto, EditarProduto } from './telas/cadastrar-produto/CadastrarProduto'
import { RegistrarEntrada } from './telas/registrar-entrada/RegistrarEntrada'
import { EntradaRapida } from './telas/entrada-rapida/EntradaRapida'
import { AjustarEstoque } from './telas/ajustar-estoque/AjustarEstoque'
import { MovimentacoesEstoque } from './telas/movimentacoes-estoque/MovimentacoesEstoque'
import { NotasFiscais } from './telas/notas-fiscais/NotasFiscais'
import { RascunhosNotas } from './telas/rascunhos-notas/RascunhosNotas'
import { DetalheFiscal } from './telas/detalhe-fiscal/DetalheFiscal'

/**
 * Hash (#/clientes) e não caminho real: o app empacotado abre por file://, onde
 * não há servidor para responder /clientes. Os endereços ficam em rotas-caminhos.ts.
 */
export const roteador = createHashRouter([
  {
    element: <Moldura />,
    children: [
      { path: '/', element: <Inicio /> },
      { path: '/busca', element: <ResultadosBusca /> },
      { path: '/ficha/nova', element: <CriarFicha /> },
      { path: '/fichas/:id', element: <DetalheFicha /> },
      // Cadastrar e editar são gavetas por cima da lista e do detalhe (Outlet).
      { path: '/clientes', element: <Clientes />, children: [{ path: 'novo', element: <CadastrarCliente /> }] },
      { path: '/clientes/sem-identificacao', element: <VendasSemIdentificacao /> },
      { path: '/clientes/:id', element: <DetalheCliente />, children: [{ path: 'editar', element: <EditarCliente /> }] },
      { path: '/financeiro', element: <Financeiro />, children: [{ path: 'movimento/novo', element: <RegistrarMovimento /> }] },
      { path: '/caixa', element: <Caixa /> },
      {
        path: '/estoque',
        element: <Estoque />,
        children: [
          { path: 'ajustar', element: <AjustarEstoque /> },
          { path: 'entrada-rapida', element: <EntradaRapida /> },
          { path: 'movimentacoes', element: <MovimentacoesEstoque /> },
        ],
      },
      { path: '/estoque/produto/novo', element: <CadastrarProduto /> },
      { path: '/estoque/produto/:codigo/completar', element: <CompletarProduto /> },
      { path: '/estoque/produto/:codigo/editar', element: <EditarProduto /> },
      { path: '/estoque/entrada', element: <RegistrarEntrada /> },
      { path: '/notas-fiscais', element: <NotasFiscais /> },
      { path: '/notas-fiscais/rascunhos', element: <RascunhosNotas /> },
      { path: '/notas-fiscais/rascunhos/:id', element: <DetalheFiscal /> },
      { path: '/notas-fiscais/documentos/fornecedor', element: <DetalheFiscal /> },
    ],
  },
])
