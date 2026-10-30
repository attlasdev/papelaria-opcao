/**
 * O ajuste de estoque no banco da 1.0 (tela 2.5; `R-ESTOQUE-10`, `11`). As
 * regras estão em `comum/regras/ajuste.ts` e `operador.ts`, as mesmas do mock;
 * aqui fica o movimento de ajuste e a conferência da dona, à parte
 * (`conferencia_ajuste`, migration 0003). O saldo novo quem grava são os
 * gatilhos (P4).
 */
import { falha, ok, type Contrato } from '../../comum/contrato'
import { conferirAjuste, conferirIds, conferirSaldo, MENSAGEM_AJUSTE_NAO_ENCONTRADO } from '../../comum/regras/ajuste'
import { MENSAGENS_ENTRADA } from '../../comum/regras/entrada'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'
import { produtosSqlite } from './produtos'

type OperacoesAjuste = Pick<Contrato, 'ajustarEstoque' | 'conferirAjustes'>

type Linha = { descricao: string; ativo: number; saldo: number }

export function ajustesSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesAjuste {
  const conferir = criarConferencia(banco, tentativas)
  const produtos = produtosSqlite(banco, tentativas)
  const ler = (id: string) => banco().prepare('select descricao, ativo, saldo from produto where id = ?').get(id) as Linha | undefined
  const visto = (movimentoId: string, donaId: string, agora: string) =>
    banco().prepare('insert into conferencia_ajuste (movimento_id, operador_id, registrado_em) values (?, ?, ?) on conflict do nothing')
      .run(movimentoId, donaId, agora).changes

  return {
    async ajustarEstoque(bruto, quem) {
      const ajuste = conferirAjuste(bruto)
      if ('ok' in ajuste) return ajuste
      const produto = ler(ajuste.produtoId)
      if (!produto) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
      if (!produto.ativo) return falha('validacao', MENSAGENS_ENTRADA.desativado(produto.descricao))
      const problema = conferirSaldo(ajuste, produto.saldo)
      if (problema) return problema
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      // A assinatura antes da transação: conferir o PIN é lento (scrypt).
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa

      const mudou = transacao(banco(), () => {
        // Confere de novo dentro da transação: uma venda pode ter entrado durante a assinatura.
        const agora = ler(ajuste.produtoId)!
        const deNovo = conferirSaldo(ajuste, agora.saldo)
        if (deNovo) return deNovo
        const id = crypto.randomUUID()
        const instante = new Date().toISOString()
        banco().prepare(`insert into movimento_estoque
          (id, produto_id, tipo, quantidade, saldo_antes, saldo_depois, motivo, operador_id, registrado_em)
          values (?, ?, 'ajuste', ?, ?, ?, ?, ?, ?)`)
          .run(id, ajuste.produtoId, ajuste.contagem - agora.saldo, agora.saldo, ajuste.contagem, ajuste.motivo, pessoa.id, instante)
        // Feito pela dona, já nasce conferido; o de funcionário aguarda (`R-ESTOQUE-11`).
        if (pessoa.admin) visto(id, pessoa.id, instante)
        gravarUltimoOperador(banco(), pessoa.id)
        return null
      })
      return mudou ?? produtos.obterProduto(ajuste.produtoId)
    },

    async conferirAjustes(bruto, dona) {
      const ids = conferirIds(bruto)
      if (!Array.isArray(ids)) return ids
      const marcas = ids.map(() => '?').join(', ')
      const { n } = banco().prepare(`select count(*) as n from movimento_estoque where tipo = 'ajuste' and id in (${marcas})`).get(...ids) as { n: number }
      if (n !== ids.length) return falha('nao-encontrado', MENSAGEM_AJUSTE_NAO_ENCONTRADO)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      const conferidos = transacao(banco(), () => {
        const agora = new Date().toISOString()
        return ids.reduce((soma, id) => soma + Number(visto(id, pessoa.id, agora)), 0)
      })
      return ok({ conferidos })
    },
  }
}
