/**
 * O ajuste de estoque sobre a base da demonstração (1.0, tela 2.5;
 * `R-ESTOQUE-10`, `11`). Lado "mock" dos testes de contrato e, até a Fase 3, o
 * que responde no app (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/ajuste.ts` e `operador.ts`, as mesmas do SQLite.
 */
import { falha, ok, type Contrato } from '../../../comum/contrato'
import { conferirAjuste, conferirIds, conferirSaldo, MENSAGEM_AJUSTE_NAO_ENCONTRADO } from '../../../comum/regras/ajuste'
import { MENSAGENS_ENTRADA } from '../../../comum/regras/entrada'
import { criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import { gravarAjuste, gravarConferencia, gravarUltimoOperador, obterBase } from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'
import { criarProdutosDaBase } from './produtos'

export type OperacoesAjuste = Pick<Contrato, 'ajustarEstoque' | 'conferirAjustes'>

export function criarAjustesDaBase(tentativas = criarTentativas()): OperacoesAjuste {
  const conferir = criarConferencia(tentativas)
  const produtos = criarProdutosDaBase(tentativas)
  return {
    async ajustarEstoque(bruto, quem) {
      const ajuste = conferirAjuste(bruto)
      if ('ok' in ajuste) return ajuste
      const produto = obterBase().produtos.find((p) => p.codigo === ajuste.produtoId)
      if (!produto) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (produto.inativo) return falha('validacao', MENSAGENS_ENTRADA.desativado(produto.descricao))
      const problema = conferirSaldo(ajuste, produto.saldo)
      if (problema) return problema
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      // Feito pela dona, já nasce conferido; o de funcionário aguarda (`R-ESTOQUE-11`).
      gravarAjuste(produto.codigo, ajuste.contagem, ajuste.motivo, pessoa.nome, pessoa.admin ? pessoa.nome : undefined)
      gravarUltimoOperador(pessoa.id)
      return produtos.obterProduto(produto.codigo)
    },

    async conferirAjustes(bruto, dona) {
      const ids = conferirIds(bruto)
      if (!Array.isArray(ids)) return ids
      const movimentos = obterBase().movimentosEstoque
      const ajustes = ids.map((id) => movimentos.find((m) => m.id === id && m.tipo === 'Ajuste'))
      if (ajustes.some((m) => !m)) return falha('nao-encontrado', MENSAGEM_AJUSTE_NAO_ENCONTRADO)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      const pendentes = ajustes.filter((m) => !m!.conferidoPor).map((m) => m!.id)
      if (pendentes.length) gravarConferencia(pendentes, pessoa.nome)
      return ok({ conferidos: pendentes.length })
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const ajustesDaBase = criarAjustesDaBase(tentativasDaBase)
