/**
 * A entrada de mercadoria sobre a base da demonstração (1.0, telas 2.3 e 2.4;
 * `R-ESTOQUE-04`, `09`). Lado "mock" dos testes de contrato e, até a Fase 3, o
 * que responde no app (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/entrada.ts`, as mesmas do SQLite.
 */
import { falha, ok, type Contrato } from '../../../comum/contrato'
import { conferirEntrega, MENSAGENS_ENTRADA, MOTIVO_ENTRADA } from '../../../comum/regras/entrada'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import { gravarEntrada, gravarUltimoOperador, obterBase } from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'
import { criarProdutosDaBase } from './produtos'

export type OperacoesEntrada = Pick<Contrato, 'registrarEntrada'>

export function criarEntradasDaBase(tentativas = criarTentativas()): OperacoesEntrada {
  const conferir = criarConferencia(tentativas)
  const produtos = criarProdutosDaBase(tentativas)
  return {
    async registrarEntrada(bruta, quem) {
      const entrega = conferirEntrega(bruta)
      if ('ok' in entrega) return entrega
      // Tudo conferido antes de gravar: se um item não serve, nada entra.
      for (const item of entrega.itens) {
        const p = obterBase().produtos.find((x) => x.codigo === item.produtoId)
        if (!p) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
        if (p.inativo) return falha('validacao', MENSAGENS_ENTRADA.desativado(p.descricao))
      }
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      gravarEntrada(
        entrega.itens.map((i) => ({ codigo: i.produtoId, quantidade: i.quantidade, ...(i.custoUnitario === null ? {} : { custoUnitario: i.custoUnitario }) })),
        {
          recebidaEm: entrega.recebidaEm,
          ...(entrega.fornecedor && { fornecedor: entrega.fornecedor }),
          ...(entrega.referencia && { referencia: entrega.referencia }),
          ...(entrega.observacoes && { observacoes: entrega.observacoes }),
        },
        MOTIVO_ENTRADA,
        pessoa.nome,
      )
      gravarUltimoOperador(pessoa.id)
      const lidos = await Promise.all(entrega.itens.map((i) => produtos.obterProduto(i.produtoId)))
      const dados = lidos.flatMap((r) => (r.ok ? [r.dado] : []))
      // Na base, a entrega não tem id próprio: o instante do primeiro movimento a identifica.
      return ok({ id: obterBase().movimentosEstoque[0].id, produtos: dados })
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const entradasDaBase = criarEntradasDaBase(tentativasDaBase)
