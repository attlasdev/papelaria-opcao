/**
 * As operações do cadastro de produto no banco da 1.0 (tela 2.1; `R-ESTOQUE-*`).
 * As regras estão em `comum/regras/produto.ts`, as mesmas do mock; aqui fica o
 * que é do banco: o número que nasce na sequência e o saldo inicial como
 * movimento (o saldo do produto quem mantém são os gatilhos, P4).
 */
import { falha, ok, type Assinatura, type Contrato, type DadosProduto, type Falha, type PaginaProdutos, type Produto, type Resultado } from '../../comum/contrato'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import {
  categoriaCanonica, codigoProduto, conferirPedidoDeLista, MENSAGENS_PRODUTO, MOTIVO_SALDO_INICIAL, ordenarCategorias, paginaQueExiste,
  paraBusca, produtoValido, saldoInicialValido,
} from '../../comum/regras/produto'
import { proximoNumero, transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesProduto = Pick<Contrato,
  'listarProdutos' | 'obterProduto' | 'buscarProdutoPorCodigoBarras' | 'listarCategorias' | 'cadastrarProduto' | 'editarProduto' | 'excluirProduto' | 'ativarProduto'>

type Linha = {
  id: string; numero: number; codigo_barras: string | null; descricao: string; categoria: string; unidade: Produto['unidade']
  preco: number; custo: number | null; saldo: number; minimo: number; marca: string | null; caracteristicas: string | null
  descricao_adicional: string | null; localizacao: string | null; embalagem: 'cx' | 'pct' | null
  pacotes_por_caixa: number | null; unidades_por_pacote: number | null; ncm: string | null; cest: string | null
  ativo: number; tem_historico: number
}

/**
 * Histórico (`R-ESTOQUE-02`): venda, ou movimento além do saldo inicial. É o
 * mesmo critério do gatilho que recusa apagar produto com histórico.
 */
const SELECT = `
  select p.*, (
    exists (select 1 from ficha_item i where i.produto_id = p.id)
    or exists (select 1 from movimento_estoque m where m.produto_id = p.id
               and not (m.tipo = 'entrada' and m.entrada_id is null and m.motivo = '${MOTIVO_SALDO_INICIAL}'))
  ) as tem_historico
  from produto p`

const paraProduto = (l: Linha): Produto => ({
  id: l.id, codigo: codigoProduto(l.numero), codigoBarras: l.codigo_barras, descricao: l.descricao, categoria: l.categoria,
  unidade: l.unidade, preco: l.preco, custo: l.custo, minimo: l.minimo, saldo: l.saldo,
  localizacao: l.localizacao, marca: l.marca, caracteristicas: l.caracteristicas, descricaoAdicional: l.descricao_adicional,
  conteudo: l.embalagem ? { embalagem: l.embalagem, pacotes: l.pacotes_por_caixa, unidades: l.unidades_por_pacote } : null,
  ncm: l.ncm, cest: l.cest, ativo: l.ativo === 1, temHistorico: l.tem_historico === 1,
})

/** As colunas do cadastro, na ordem de `valores`. Saldo, situação e a marca da Emitte não entram. */
const COLUNAS = ['codigo_barras', 'descricao', 'categoria', 'unidade', 'preco', 'custo', 'minimo', 'localizacao', 'marca',
  'caracteristicas', 'descricao_adicional', 'embalagem', 'pacotes_por_caixa', 'unidades_por_pacote', 'ncm', 'cest'] as const

const valores = (d: DadosProduto) => [d.codigoBarras, d.descricao, d.categoria, d.unidade, d.preco, d.custo, d.minimo, d.localizacao,
  d.marca, d.caracteristicas, d.descricaoAdicional, d.conteudo?.embalagem ?? null, d.conteudo?.pacotes ?? null,
  d.conteudo?.unidades ?? null, d.ncm, d.cest]

/** Zerado ou abaixo do mínimo: a mesma conta de `situacaoSaldo`, em SQL. */
const FORA_DO_NORMAL = '(p.saldo = 0 or p.saldo < p.minimo)'

/** O texto em que a busca procura, o mesmo do mock: código, código de barras, nome e categoria. */
const TEXTO_DA_BUSCA = "sem_acento('EST-' || printf('%04d', p.numero) || ' ' || coalesce(p.codigo_barras, '') || ' ' || p.descricao || ' ' || p.categoria)"

/**
 * O cadastro limpo pronto para gravar: o código de barras livre no catálogo e a
 * categoria já existente, se for a mesma com outra caixa ou acento. Chamar
 * dentro da transação que grava.
 */
export function prepararCadastro(banco: Banco, dados: DadosProduto, menos?: string): DadosProduto | Falha {
  const outro = dados.codigoBarras
    ? banco.prepare('select numero from produto where codigo_barras = ? and id is not ?').get(dados.codigoBarras, menos ?? null) as { numero: number } | undefined
    : undefined
  if (outro) return falha('validacao', MENSAGENS_PRODUTO.codigoRepetido(codigoProduto(outro.numero)))
  const existentes = (banco.prepare('select distinct categoria from produto').all() as { categoria: string }[]).map((c) => c.categoria)
  return { ...dados, categoria: categoriaCanonica(dados.categoria, existentes) }
}

/** Grava o produto com saldo 0 e o número da sequência (`R-ESTOQUE-08`); devolve o id. */
export function inserirProduto(banco: Banco, dados: DadosProduto, agora: string) {
  const id = crypto.randomUUID()
  banco.prepare(`insert into produto (id, numero, criado_em, ${COLUNAS.join(', ')}) values (?, ?, ?, ${COLUNAS.map(() => '?').join(', ')})`)
    .run(id, proximoNumero(banco, 'produto'), agora, ...valores(dados))
  return id
}

export function produtosSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesProduto {
  const conferir = criarConferencia(banco, tentativas)
  const buscar = (id: unknown) =>
    typeof id === 'string' ? (banco().prepare(`${SELECT} where p.id = ?`).get(id) as Linha | undefined) ?? null : null
  const devolver = (id: string): Resultado<Produto> => {
    const l = buscar(id)
    return l ? ok(paraProduto(l)) : falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
  }

  /** O dado limpo, com a categoria já existente e o código de barras livre. Dentro da transação. */
  function preparar(bruto: unknown, menos?: string): DadosProduto | Resultado<never> {
    const dados = produtoValido(bruto)
    return 'ok' in dados ? dados : prepararCadastro(banco(), dados, menos)
  }

  /** `R-ESTOQUE-07`: o fato pede quem está fazendo. */
  async function assinar(quem: Assinatura | null) {
    if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
    return conferir(quem)
  }

  return {
    async listarProdutos(filtro, busca, pagina, porPagina) {
      const problema = conferirPedidoDeLista(filtro, busca, pagina, porPagina)
      if (problema) return problema
      // Desativado só aparece na aba dele (`R-ESTOQUE-02`).
      const condicoes = [filtro === 'desativados' ? 'p.ativo = 0' : 'p.ativo = 1']
      const valores: (string | number)[] = []
      if (filtro === 'baixo') condicoes.push(FORA_DO_NORMAL)
      if (filtro === 'sem-codigo') condicoes.push('p.codigo_barras is null')
      if (typeof filtro === 'object') { condicoes.push('p.categoria = ?'); valores.push(filtro.categoria) }
      const termo = paraBusca(busca.trim())
      if (termo) { condicoes.push(`instr(${TEXTO_DA_BUSCA}, ?) > 0`); valores.push(termo) }
      const onde = `where ${condicoes.join(' and ')}`

      const { total } = banco().prepare(`select count(*) as total from produto p ${onde}`).get(...valores) as { total: number }
      const atual = paginaQueExiste(pagina, total, porPagina)
      const linhas = banco().prepare(`${SELECT} ${onde} order by p.numero limit ? offset ?`)
        .all(...valores, porPagina, (atual - 1) * porPagina) as Linha[]
      const resumo = banco().prepare(`
        select count(*) filter (where p.ativo = 1) as produtos,
               count(distinct p.categoria) filter (where p.ativo = 1) as categorias,
               count(*) filter (where p.ativo = 1 and ${FORA_DO_NORMAL}) as baixo,
               count(*) filter (where p.ativo = 1 and p.codigo_barras is null) as semCodigo,
               count(*) filter (where p.ativo = 0) as desativados
        from produto p`).get() as PaginaProdutos['resumo']
      const categorias = banco().prepare('select distinct categoria from produto where ativo = 1').all() as { categoria: string }[]
      return ok({
        produtos: linhas.map(paraProduto), total, pagina: atual, resumo: { ...resumo },
        categorias: ordenarCategorias(categorias.map((c) => c.categoria)),
      })
    },

    async obterProduto(id) {
      return devolver(String(id))
    },

    async buscarProdutoPorCodigoBarras(codigoBarras) {
      const codigo = typeof codigoBarras === 'string' ? codigoBarras.trim() : ''
      const l = codigo ? banco().prepare(`${SELECT} where p.codigo_barras = ?`).get(codigo) as Linha | undefined : undefined
      return ok(l ? paraProduto(l) : null)
    },

    async listarCategorias() {
      const linhas = banco().prepare('select distinct categoria from produto').all() as { categoria: string }[]
      return ok(ordenarCategorias(linhas.map((l) => l.categoria)))
    },

    async cadastrarProduto(bruto, saldoInicial, quem) {
      const problema = saldoInicialValido(saldoInicial)
      if (problema) return problema
      // A assinatura antes da transação: conferir o PIN é lento (scrypt).
      let operadorId: string | null = null
      if (saldoInicial > 0) {
        const pessoa = await assinar(quem)
        if ('ok' in pessoa) return pessoa
        operadorId = pessoa.id
      }
      return transacao(banco(), () => {
        const dados = preparar(bruto)
        if ('ok' in dados) return dados
        const agora = new Date().toISOString()
        const id = inserirProduto(banco(), dados, agora)
        if (operadorId) {
          banco().prepare(`insert into movimento_estoque (id, produto_id, tipo, quantidade, saldo_antes, saldo_depois, motivo, operador_id, registrado_em)
            values (?, ?, 'entrada', ?, 0, ?, ?, ?, ?)`).run(crypto.randomUUID(), id, saldoInicial, saldoInicial, MOTIVO_SALDO_INICIAL, operadorId, agora)
          gravarUltimoOperador(banco(), operadorId)
        }
        return devolver(id)
      })
    },

    async editarProduto(id, bruto) {
      return transacao(banco(), () => {
        const atual = buscar(id)
        if (!atual) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
        const dados = preparar(bruto, atual.id)
        if ('ok' in dados) return dados
        banco().prepare(`update produto set ${COLUNAS.map((c) => `${c} = ?`).join(', ')} where id = ?`).run(...valores(dados), atual.id)
        return devolver(atual.id)
      })
    },

    async excluirProduto(id, quem) {
      const atual = buscar(id)
      if (!atual) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (atual.tem_historico) return falha('validacao', MENSAGENS_PRODUTO.comHistorico)
      if (atual.saldo > 0) {
        const pessoa = await assinar(quem)
        if ('ok' in pessoa) return pessoa
        gravarUltimoOperador(banco(), pessoa.id)
      }
      // O gatilho recusa se o histórico apareceu no meio; o movimento do saldo inicial sai junto (cascade).
      banco().prepare('delete from produto where id = ?').run(atual.id)
      return ok(null)
    },

    async ativarProduto(id, ativo) {
      if (typeof ativo !== 'boolean') return falha('validacao', 'Pedido inválido.')
      const atual = buscar(id)
      if (!atual) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      banco().prepare('update produto set ativo = ? where id = ?').run(ativo ? 1 : 0, atual.id)
      return devolver(atual.id)
    },
  }
}
