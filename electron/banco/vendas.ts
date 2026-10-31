/**
 * A venda no banco da 1.0 (tela 4.1; `R-VENDA-05` a `11`). As regras estão em
 * `comum/regras/venda.ts`, as mesmas do mock; aqui fica o que é do banco: o
 * número na sequência, a ficha com itens, serviços, pagamentos e a baixa do
 * estoque numa transação, com o preço e o saldo lidos dentro dela. O saldo
 * novo quem grava são os gatilhos (P4). O rascunho é estado de tela, em
 * `preferencia` como JSON.
 */
import { falha, ok, type Contrato, type Venda } from '../../comum/contrato'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { numeroFicha } from '../../comum/regras/movimentos'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { conferirRascunho, conferirVenda, MENSAGENS_VENDA, montarVenda, type ProdutoDaVenda } from '../../comum/regras/venda'
import { proximoNumero, transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesVenda = Pick<Contrato, 'concluirFicha' | 'obterRascunhoFicha' | 'salvarRascunhoFicha'>

const RASCUNHO = 'rascunho_ficha'

/** Preço, saldo e situação de agora dos produtos da venda. */
function lerProdutos(banco: Banco, venda: Venda) {
  const ler = banco.prepare('select id, descricao, preco, saldo, ativo from produto where id = ?')
  const produtos = new Map<string, ProdutoDaVenda>()
  for (const { produtoId } of venda.itens) {
    const p = ler.get(produtoId) as { id: string; descricao: string; preco: number; saldo: number; ativo: number } | undefined
    if (p) produtos.set(p.id, { ...p, ativo: p.ativo === 1 })
  }
  return produtos
}

export function vendasSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesVenda {
  const conferir = criarConferencia(banco, tentativas)
  return {
    async concluirFicha(bruta, quem) {
      const hoje = hojeEmSaoPaulo()
      const venda = conferirVenda(bruta, hoje)
      if ('ok' in venda) return venda
      if (venda.clienteId && !banco().prepare('select 1 from cliente where id = ?').get(venda.clienteId)) {
        return falha('nao-encontrado', MENSAGENS_VENDA.clienteNaoEncontrado)
      }
      // Conferida antes do PIN, para responder logo; de novo dentro da transação.
      const previa = montarVenda(venda, lerProdutos(banco(), venda))
      if ('ok' in previa) return previa
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      // A assinatura antes da transação: conferir o PIN é lento (scrypt).
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa

      return transacao(banco(), () => {
        // Preço e saldo de agora: outra venda pode ter entrado durante o PIN.
        const montada = montarVenda(venda, lerProdutos(banco(), venda))
        if ('ok' in montada) return montada
        const id = crypto.randomUUID()
        const numero = proximoNumero(banco(), 'ficha')
        const agora = new Date().toISOString()
        banco().prepare(`insert into ficha (id, numero, cliente_id, forma, subtotal, desconto, total, vencimento, dia, operador_id, registrado_em)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, numero, venda.clienteId, venda.pagamento.forma, montada.subtotal, montada.desconto, montada.total, montada.vencimento, hoje, pessoa.id, agora)
        const item = banco().prepare('insert into ficha_item (id, ficha_id, produto_id, descricao, quantidade, preco) values (?, ?, ?, ?, ?, ?)')
        // O saldo de agora, lido no próprio insert; o gatilho grava o saldo novo.
        const baixa = banco().prepare(`insert into movimento_estoque
          (id, produto_id, tipo, quantidade, saldo_antes, saldo_depois, ficha_id, operador_id, registrado_em)
          select ?, id, 'venda', ?, saldo, saldo - ?, ?, ?, ? from produto where id = ?`)
        for (const i of montada.itens) {
          item.run(crypto.randomUUID(), id, i.produtoId, i.descricao, i.quantidade, i.preco)
          baixa.run(crypto.randomUUID(), -i.quantidade, i.quantidade, id, pessoa.id, agora, i.produtoId)
        }
        const servico = banco().prepare('insert into ficha_servico (id, ficha_id, nome, valor, perdas, observacao) values (?, ?, ?, ?, ?, ?)')
        for (const s of montada.servicos) servico.run(crypto.randomUUID(), id, s.nome, s.valor, s.perdas, s.observacao)
        const caixa = banco().prepare(`select c.id from caixa c
          where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id)`).get() as { id: string } | undefined
        const pagamento = banco().prepare(`insert into pagamento
          (id, ficha_id, tipo, meio, valor, recebido, troco, maquininha, cartao, rotulo, dia, caixa_id, operador_id, registrado_em)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        for (const p of montada.pagamentos) {
          pagamento.run(crypto.randomUUID(), id, p.tipo, p.meio, p.valor, p.recebido, p.troco, p.maquininha, p.cartao, p.rotulo, hoje, caixa?.id ?? null, pessoa.id, agora)
        }
        banco().prepare('delete from preferencia where chave = ?').run(RASCUNHO)
        gravarUltimoOperador(banco(), pessoa.id)
        return ok({ id, numero: numeroFicha(numero) })
      })
    },

    async obterRascunhoFicha() {
      const linha = banco().prepare('select valor from preferencia where chave = ?').get(RASCUNHO) as { valor: string } | undefined
      if (!linha) return ok(null)
      // Gravado por versão antiga da tela, ou estragado: a ficha abre vazia.
      let bruto: unknown = null
      try { bruto = JSON.parse(linha.valor) } catch { return ok(null) }
      const r = conferirRascunho(bruto)
      return ok('ok' in r ? null : r)
    },

    async salvarRascunhoFicha(bruto) {
      if (bruto === null) {
        banco().prepare('delete from preferencia where chave = ?').run(RASCUNHO)
        return ok(null)
      }
      const r = conferirRascunho(bruto)
      if ('ok' in r) return r
      banco().prepare('insert into preferencia (chave, valor) values (?, ?) on conflict (chave) do update set valor = excluded.valor')
        .run(RASCUNHO, JSON.stringify(r))
      return ok(null)
    },
  }
}
