/**
 * A entrada de mercadoria no banco da 1.0 (telas 2.3 e 2.4; `R-ESTOQUE-04`,
 * `09`). As regras estão em `comum/regras/entrada.ts`, as mesmas do mock; aqui
 * fica o que é do banco: o cabeçalho em `entrada_mercadoria`, um movimento por
 * item, tudo numa transação. O saldo novo quem grava são os gatilhos (P4).
 */
import { falha, ok, type Contrato } from '../../comum/contrato'
import { conferirEntrega, MENSAGENS_ENTRADA, MOTIVO_ENTRADA } from '../../comum/regras/entrada'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'
import { inserirProduto, prepararCadastro, produtosSqlite } from './produtos'

type OperacoesEntrada = Pick<Contrato, 'registrarEntrada'>

export function entradasSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesEntrada {
  const conferir = criarConferencia(banco, tentativas)
  const produtos = produtosSqlite(banco, tentativas)
  return {
    async registrarEntrada(bruta, quem) {
      const entrega = conferirEntrega(bruta)
      if ('ok' in entrega) return entrega
      for (const item of entrega.itens) {
        if ('novo' in item) {
          const livre = prepararCadastro(banco(), item.novo)
          if ('ok' in livre) return livre
          continue
        }
        const p = banco().prepare('select descricao, ativo from produto where id = ?').get(item.produtoId) as { descricao: string; ativo: number } | undefined
        if (!p) return falha('nao-encontrado', MENSAGENS_PRODUTO.naoEncontrado)
        if (!p.ativo) return falha('validacao', MENSAGENS_ENTRADA.desativado(p.descricao))
      }
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      // A assinatura antes da transação: conferir o PIN é lento (scrypt).
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa

      const id = crypto.randomUUID()
      const ids = transacao(banco(), () => {
        const agora = new Date().toISOString()
        banco().prepare(`insert into entrada_mercadoria (id, recebida_em, fornecedor, referencia, observacoes, operador_id, registrado_em)
          values (?, ?, ?, ?, ?, ?, ?)`).run(id, entrega.recebidaEm, entrega.fornecedor, entrega.referencia, entrega.observacoes, pessoa.id, agora)
        const movimento = banco().prepare(`insert into movimento_estoque
          (id, produto_id, tipo, quantidade, saldo_antes, saldo_depois, motivo, custo_unitario, entrada_id, operador_id, registrado_em)
          select ?, id, 'entrada', ?, saldo, saldo + ?, ?, ?, ?, ?, ? from produto where id = ?`)
        // O saldo de agora, lido dentro da transação: a tela manda só quanto somar.
        // O produto novo nasce aqui, com saldo 0 e o custo desta compra (`R-ESTOQUE-09`).
        const ids = entrega.itens.map((item) => {
          if (!('novo' in item)) return item.produtoId
          const pronto = prepararCadastro(banco(), item.novo)
          if ('ok' in pronto) throw new Error(pronto.erro)
          return inserirProduto(banco(), { ...pronto, custo: item.custoUnitario ?? pronto.custo }, agora)
        })
        entrega.itens.forEach((item, n) => {
          movimento.run(crypto.randomUUID(), item.quantidade, item.quantidade, MOTIVO_ENTRADA, item.custoUnitario, id, pessoa.id, agora, ids[n])
        })
        gravarUltimoOperador(banco(), pessoa.id)
        return ids
      })
      const lidos = await Promise.all(ids.map((produtoId) => produtos.obterProduto(produtoId)))
      return ok({ id, produtos: lidos.flatMap((r) => (r.ok ? [r.dado] : [])) })
    },
  }
}
