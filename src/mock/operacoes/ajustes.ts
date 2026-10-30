/**
 * O ajuste de estoque sobre a base da demonstração (1.0, tela 2.5;
 * `R-ESTOQUE-10`, `R-OPERADOR-06`). Lado "mock" dos testes de contrato e, até a
 * Fase 3, o que responde no app (`src/dados/api.ts`).
 *
 * As regras são as de `comum/regras/ajuste.ts` e `operador.ts`, as mesmas do SQLite.
 */
import { falha, type Contrato } from '../../../comum/contrato'
import { conferirAjuste, conferirSaldo } from '../../../comum/regras/ajuste'
import { MENSAGENS_ENTRADA } from '../../../comum/regras/entrada'
import { autorizar, criarTentativas } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import { gravarAjuste, gravarUltimoOperador, obterBase } from '../estado-demonstracao'
import { criarConferencia, tentativasDaBase } from './operadores'
import { criarProdutosDaBase } from './produtos'

export type OperacoesAjuste = Pick<Contrato, 'ajustarEstoque'>

export function criarAjustesDaBase(tentativas = criarTentativas()): OperacoesAjuste {
  const conferir = criarConferencia(tentativas)
  const produtos = criarProdutosDaBase(tentativas)
  return {
    async ajustarEstoque(bruto, quem, dona) {
      const ajuste = conferirAjuste(bruto)
      if ('ok' in ajuste) return ajuste
      const produto = obterBase().produtos.find((p) => p.codigo === ajuste.produtoId)
      if (!produto) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (produto.inativo) return falha('validacao', MENSAGENS_ENTRADA.desativado(produto.descricao))
      const problema = conferirSaldo(ajuste, produto.saldo)
      if (problema) return problema
      const assinado = await autorizar(conferir, quem, dona)
      if ('ok' in assinado) return assinado
      gravarAjuste(produto.codigo, ajuste.contagem, ajuste.motivo, assinado.quem.nome, assinado.autorizadoPor?.nome)
      gravarUltimoOperador(assinado.quem.id)
      return produtos.obterProduto(produto.codigo)
    },
  }
}

/** A do app, com a mesma conta de PINs errados dos operadores (`R-OPERADOR-04`). */
export const ajustesDaBase = criarAjustesDaBase(tentativasDaBase)
