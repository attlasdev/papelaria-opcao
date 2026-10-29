/**
 * As operações do cadastro de produto sobre a base da demonstração (1.0, tela
 * 2.1; `R-ESTOQUE-*`). Lado "mock" dos testes de contrato e, até a Fase 3, o
 * que responde no app (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/produto.ts`, as mesmas do SQLite.
 */
import { falha, ok, type Assinatura, type Contrato, type DadosProduto, type Produto as ProdutoContrato, type Resultado } from '../../../comum/contrato'
import { criarTentativas } from '../../../comum/regras/operador'
import {
  categoriaCanonica, conferirPedidoDeLista, MENSAGENS_PRODUTO, ordenarCategorias, paginaQueExiste, paraBusca, produtoValido, saldoInicialValido, situacaoSaldo,
} from '../../../comum/regras/produto'
import { anotarNcmCest } from '../../dados/fiscal'
import type { Base, Grupo, Produto } from '../base/tipos'
import {
  cadastrarProduto, definirProdutoAtivo, editarProduto, excluirProduto, gravarUltimoOperador, obterBase, produtoTemHistorico,
} from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'

export type OperacoesProduto = Pick<Contrato,
  'listarProdutos' | 'obterProduto' | 'buscarProdutoPorCodigoBarras' | 'listarCategorias' | 'cadastrarProduto' | 'editarProduto' | 'excluirProduto' | 'ativarProduto'>

/** Na base, o código de exibição é o id. */
function paraProduto(base: Base, p: Produto): ProdutoContrato {
  return {
    id: p.codigo, codigo: p.codigo, codigoBarras: p.codigoBarras ?? null, descricao: p.descricao, categoria: p.categoria,
    unidade: p.unidade, preco: p.preco, custo: p.custo ?? null, minimo: p.minimo, saldo: p.saldo,
    localizacao: p.localizacao ?? null, marca: p.marca ?? null, caracteristicas: p.caracteristicas ?? null,
    descricaoAdicional: p.descricaoAdicional ?? null,
    conteudo: p.conteudo ? { embalagem: p.conteudo.embalagem, pacotes: p.conteudo.pacotes ?? null, unidades: p.conteudo.unidades ?? null } : null,
    ncm: p.fiscal?.ncm ?? null, cest: p.fiscal?.cest ?? null,
    ativo: !p.inativo, temHistorico: produtoTemHistorico(base, p.codigo),
  }
}

/** O grupo da 0.1 (ninguém lê; o documento do piloto ainda o tem). */
const grupoDa = (categoria: string): Grupo =>
  categoria.includes('Caderno') ? 'cadernos' : categoria.includes('Escrita') ? 'escrita' : categoria.includes('Papéis') ? 'papeis' : categoria.includes('Escritório') ? 'escritorio' : 'artes'

/** Do contrato para a base. `anterior`: o fiscal que a tela não mostra fica (`R-ESTOQUE-06`). */
export function paraBase(d: DadosProduto, anterior?: Produto): Omit<Produto, 'codigo' | 'saldo' | 'inativo'> {
  const opcional = <T,>(v: T | null) => v ?? undefined
  return {
    codigoBarras: opcional(d.codigoBarras), descricao: d.descricao, categoria: d.categoria, grupo: grupoDa(d.categoria),
    unidade: d.unidade, preco: d.preco, custo: opcional(d.custo), minimo: d.minimo,
    localizacao: opcional(d.localizacao), marca: opcional(d.marca), caracteristicas: opcional(d.caracteristicas),
    descricaoAdicional: opcional(d.descricaoAdicional),
    conteudo: d.conteudo ? { embalagem: d.conteudo.embalagem, pacotes: opcional(d.conteudo.pacotes), unidades: opcional(d.conteudo.unidades) } : undefined,
    fiscal: anotarNcmCest(anterior?.fiscal, d.ncm ?? '', d.cest ?? '').fiscal,
  }
}

export function criarProdutosDaBase(tentativas = criarTentativas()): OperacoesProduto {
  const conferir = criarConferencia(tentativas)
  const buscar = (id: unknown) => (typeof id === 'string' ? obterBase().produtos.find((p) => p.codigo === id) : undefined)
  const devolver = (codigo: string): Resultado<ProdutoContrato> => {
    const p = buscar(codigo)
    return p ? ok(paraProduto(obterBase(), p)) : falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
  }

  /** O dado limpo, com a categoria já existente e o código de barras livre. */
  function preparar(bruto: unknown, menos?: string): DadosProduto | Resultado<never> {
    const dados = produtoValido(bruto)
    if ('ok' in dados) return dados
    const outro = dados.codigoBarras ? obterBase().produtos.find((p) => p.codigoBarras === dados.codigoBarras && p.codigo !== menos) : undefined
    if (outro) return falha('validacao', MENSAGENS_PRODUTO.codigoRepetido(outro.codigo))
    return { ...dados, categoria: categoriaCanonica(dados.categoria, obterBase().produtos.map((p) => p.categoria)) }
  }

  /** `R-ESTOQUE-07`: o fato pede quem está fazendo. */
  async function assinar(quem: Assinatura | null) {
    if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
    const pessoa = await conferir(quem)
    if ('ok' in pessoa) return pessoa
    gravarUltimoOperador(pessoa.id)
    return pessoa
  }

  return {
    async listarProdutos(filtro, busca, pagina, porPagina) {
      const problema = conferirPedidoDeLista(filtro, busca, pagina, porPagina)
      if (problema) return problema
      const base = obterBase()
      const ativos = base.produtos.filter((p) => !p.inativo)
      const foraDoNormal = (p: Produto) => situacaoSaldo(p.saldo, p.minimo) !== 'normal'
      const termo = paraBusca(busca.trim())
      const achados = base.produtos
        .filter((p) => {
          // Desativado só aparece na aba dele (`R-ESTOQUE-02`).
          if ((filtro === 'desativados') !== Boolean(p.inativo)) return false
          if (filtro === 'baixo') return foraDoNormal(p)
          if (filtro === 'sem-codigo') return !p.codigoBarras
          if (typeof filtro === 'object') return p.categoria === filtro.categoria
          return true
        })
        .filter((p) => !termo || paraBusca(`${p.codigo} ${p.codigoBarras ?? ''} ${p.descricao} ${p.categoria}`).includes(termo))
        .sort((a, b) => Number(a.codigo.slice(4)) - Number(b.codigo.slice(4)))
      const atual = paginaQueExiste(pagina, achados.length, porPagina)
      return ok({
        produtos: achados.slice((atual - 1) * porPagina, atual * porPagina).map((p) => paraProduto(base, p)),
        total: achados.length,
        pagina: atual,
        resumo: {
          produtos: ativos.length,
          categorias: new Set(ativos.map((p) => p.categoria)).size,
          baixo: ativos.filter(foraDoNormal).length,
          semCodigo: ativos.filter((p) => !p.codigoBarras).length,
          desativados: base.produtos.length - ativos.length,
        },
        categorias: ordenarCategorias(ativos.map((p) => p.categoria)),
      })
    },

    async obterProduto(id) {
      return devolver(String(id))
    },

    async buscarProdutoPorCodigoBarras(codigoBarras) {
      const codigo = typeof codigoBarras === 'string' ? codigoBarras.trim() : ''
      const p = codigo ? obterBase().produtos.find((x) => x.codigoBarras === codigo) : undefined
      return ok(p ? paraProduto(obterBase(), p) : null)
    },

    async listarCategorias() {
      return ok(ordenarCategorias(obterBase().produtos.map((p) => p.categoria)))
    },

    async cadastrarProduto(bruto, saldoInicial, quem) {
      const dados = preparar(bruto)
      if ('ok' in dados) return dados
      const problema = saldoInicialValido(saldoInicial)
      if (problema) return problema
      let operador: string | undefined
      if (saldoInicial > 0) {
        const pessoa = await assinar(quem)
        if ('ok' in pessoa) return pessoa
        operador = pessoa.nome
      }
      return devolver(cadastrarProduto({ ...paraBase(dados), saldo: saldoInicial }, operador))
    },

    async editarProduto(id, bruto) {
      const atual = buscar(id)
      if (!atual) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      const dados = preparar(bruto, atual.codigo)
      if ('ok' in dados) return dados
      editarProduto(atual.codigo, paraBase(dados, atual))
      return devolver(atual.codigo)
    },

    async excluirProduto(id, quem) {
      const atual = buscar(id)
      if (!atual) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (produtoTemHistorico(obterBase(), atual.codigo)) return falha('validacao', MENSAGENS_PRODUTO.comHistorico)
      if (atual.saldo > 0) {
        const pessoa = await assinar(quem)
        if ('ok' in pessoa) return pessoa
      }
      excluirProduto(atual.codigo)
      return ok(null)
    },

    async ativarProduto(id, ativo) {
      const atual = buscar(id)
      if (!atual) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (typeof ativo !== 'boolean') return falha('validacao', 'Pedido inválido.')
      definirProdutoAtivo(atual.codigo, ativo)
      return devolver(atual.codigo)
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const produtosDaBase = criarProdutosDaBase(tentativasDaBase)
