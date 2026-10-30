/**
 * O ajuste de estoque no banco da 1.0 (tela 2.5; `R-ESTOQUE-10`,
 * `R-OPERADOR-06`). As regras estão em `comum/regras/ajuste.ts` e `operador.ts`,
 * as mesmas do mock; aqui fica o movimento de ajuste com quem fez e quem
 * autorizou. O saldo novo quem grava são os gatilhos (P4).
 */
import { falha, type Contrato } from '../../comum/contrato'
import { conferirAjuste, conferirSaldo } from '../../comum/regras/ajuste'
import { MENSAGENS_ENTRADA } from '../../comum/regras/entrada'
import { autorizar, criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'
import { produtosSqlite } from './produtos'

type OperacoesAjuste = Pick<Contrato, 'ajustarEstoque'>

type Linha = { descricao: string; ativo: number; saldo: number }

export function ajustesSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesAjuste {
  const conferir = criarConferencia(banco, tentativas)
  const produtos = produtosSqlite(banco, tentativas)
  const ler = (id: string) => banco().prepare('select descricao, ativo, saldo from produto where id = ?').get(id) as Linha | undefined

  return {
    async ajustarEstoque(bruto, quem, dona) {
      const ajuste = conferirAjuste(bruto)
      if ('ok' in ajuste) return ajuste
      const produto = ler(ajuste.produtoId)
      if (!produto) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (!produto.ativo) return falha('validacao', MENSAGENS_ENTRADA.desativado(produto.descricao))
      const problema = conferirSaldo(ajuste, produto.saldo)
      if (problema) return problema
      // As assinaturas antes da transação: conferir o PIN é lento (scrypt).
      const assinado = await autorizar(conferir, quem, dona)
      if ('ok' in assinado) return assinado

      const mudou = transacao(banco(), () => {
        // Confere de novo dentro da transação: uma venda pode ter entrado durante a assinatura.
        const agora = ler(ajuste.produtoId)!
        const deNovo = conferirSaldo(ajuste, agora.saldo)
        if (deNovo) return deNovo
        banco().prepare(`insert into movimento_estoque
          (id, produto_id, tipo, quantidade, saldo_antes, saldo_depois, motivo, operador_id, autorizado_por_id, registrado_em)
          values (?, ?, 'ajuste', ?, ?, ?, ?, ?, ?, ?)`)
          .run(crypto.randomUUID(), ajuste.produtoId, ajuste.contagem - agora.saldo, agora.saldo, ajuste.contagem, ajuste.motivo,
            assinado.quem.id, assinado.autorizadoPor?.id ?? null, new Date().toISOString())
        gravarUltimoOperador(banco(), assinado.quem.id)
        return null
      })
      return mudou ?? produtos.obterProduto(ajuste.produtoId)
    },
  }
}
