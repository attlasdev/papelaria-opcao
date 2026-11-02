/**
 * O Financeiro no banco da 1.0 (tela 7.2; `R-FINANCEIRO-02` a `07`). As regras
 * estão em `comum/regras/financeiro.ts`, as mesmas do mock; aqui fica a
 * leitura dos pagamentos das fichas (com o estorno ou o cancelamento que os
 * desfez) e dos lançamentos manuais (com o estorno e o visto da dona). A gaveta
 * é outra tabela (`movimento_gaveta`) e não entra.
 */
import { falha, ok, type Contrato, type LinhaFinanceira } from '../../comum/contrato'
import { conferirPagina, conferirPeriodoCaixa } from '../../comum/regras/caixa'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { conferirTexto, MOTIVO_MAXIMO } from '../../comum/regras/ficha'
import {
  conferirFiltroFinanceiro, conferirLancamento, linhasDoPeriodo, linhasFinanceiras, MENSAGENS_FINANCEIRO, paginaFinanceiro,
  type LancamentoLido, type PagamentoLido,
} from '../../comum/regras/financeiro'
import { numeroFicha } from '../../comum/regras/movimentos'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import type { Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesFinanceiro = Pick<Contrato, 'consultarFinanceiro' | 'listarFinanceiroDoPeriodo' | 'registrarLancamento' | 'estornarLancamento' | 'conferirEstornoLancamento'>

/** Todas as linhas do banco, como o contrato as vê (o Início lê as do dia). */
export function todasAsLinhas(banco: Banco): LinhaFinanceira[] {
  const pagamentos = (banco.prepare(`
    select p.id, p.dia, p.registrado_em, p.tipo, p.meio, p.rotulo, p.valor, o.nome as operador,
           f.id as ficha_id, f.numero, f.forma, c.nome as cliente,
           exists (select 1 from ficha_item i where i.ficha_id = f.id) as tem_itens,
           exists (select 1 from ficha_servico s where s.ficha_id = f.id) as tem_servicos,
           e.dia as e_dia, e.registrado_em as e_em, e.motivo as e_motivo, eo.nome as e_operador,
           x.dia as x_dia, x.registrado_em as x_em, x.motivo as x_motivo, xo.nome as x_operador
    from pagamento p join ficha f on f.id = p.ficha_id join operador o on o.id = p.operador_id left join cliente c on c.id = f.cliente_id
    left join pagamento_estorno e on e.pagamento_id = p.id left join operador eo on eo.id = e.operador_id
    left join ficha_cancelamento x on x.ficha_id = f.id left join operador xo on xo.id = x.operador_id`).all() as {
      id: string; dia: string; registrado_em: string; tipo: PagamentoLido['tipo']; meio: PagamentoLido['meio']; rotulo: string | null; valor: number
      operador: string; ficha_id: string; numero: number; forma: string; cliente: string | null; tem_itens: number; tem_servicos: number
      e_dia: string | null; e_em: string | null; e_motivo: string | null; e_operador: string | null
      x_dia: string | null; x_em: string | null; x_motivo: string | null; x_operador: string | null
    }[]).map((p): PagamentoLido => ({
    id: p.id, dia: p.dia, registradoEm: p.registrado_em, tipo: p.tipo,
    ficha: { id: p.ficha_id, numero: numeroFicha(p.numero), forma: p.forma, temItens: p.tem_itens === 1, temServicos: p.tem_servicos === 1 },
    cliente: p.cliente, meio: p.meio, rotulo: p.rotulo, valor: p.valor, operador: p.operador,
    // O estorno vem antes: o recebimento estornado não sai de novo no cancelamento.
    desfeito: p.e_dia ? { estorno: true, dia: p.e_dia, registradoEm: p.e_em!, motivo: p.e_motivo!, operador: p.e_operador! }
      : p.x_dia ? { estorno: false, dia: p.x_dia, registradoEm: p.x_em!, motivo: p.x_motivo!, operador: p.x_operador! } : null,
  }))
  const lancamentos = (banco.prepare(`
    select l.id, l.dia, l.registrado_em, l.tipo, l.descricao, l.origem, l.meio, l.valor, o.nome as operador,
           e.id as e_id, e.dia as e_dia, e.registrado_em as e_em, e.motivo as e_motivo, eo.nome as e_operador, d.nome as conferido_por
    from lancamento l join operador o on o.id = l.operador_id
    left join lancamento e on e.estorno_de = l.id left join operador eo on eo.id = e.operador_id
    left join conferencia_lancamento cl on cl.estorno_id = e.id left join operador d on d.id = cl.operador_id
    where l.estorno_de is null`).all() as {
      id: string; dia: string; registrado_em: string; tipo: LancamentoLido['tipo']; descricao: string; origem: string; meio: LancamentoLido['meio']
      valor: number; operador: string; e_id: string | null; e_dia: string | null; e_em: string | null; e_motivo: string | null; e_operador: string | null
      conferido_por: string | null
    }[]).map((l): LancamentoLido => ({
    id: l.id, dia: l.dia, registradoEm: l.registrado_em, tipo: l.tipo, descricao: l.descricao, origem: l.origem, meio: l.meio, valor: l.valor,
    operador: l.operador,
    estorno: l.e_id ? { id: l.e_id, dia: l.e_dia!, registradoEm: l.e_em!, motivo: l.e_motivo ?? '', operador: l.e_operador!, conferidoPor: l.conferido_por } : null,
  }))
  return linhasFinanceiras(pagamentos, lancamentos)
}

export function financeiroSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesFinanceiro {
  const conferir = criarConferencia(banco, tentativas)
  const linhaPeloId = (id: unknown) => (typeof id === 'string' ? todasAsLinhas(banco()).find((l) => l.id === id) : undefined)
  const caixaAberto = () => (banco().prepare(`select c.id from caixa c
    where not exists (select 1 from caixa_fechamento f where f.caixa_id = c.id)`).get() as { id: string } | undefined)?.id ?? null

  return {
    async consultarFinanceiro(bruto, filtro, pagina, porPagina) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const problema = conferirFiltroFinanceiro(filtro) ?? conferirPagina(pagina, porPagina)
      if (problema) return problema
      return ok(paginaFinanceiro(linhasDoPeriodo(todasAsLinhas(banco()), periodo), filtro, pagina, porPagina))
    },

    async listarFinanceiroDoPeriodo(bruto) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      return ok(linhasDoPeriodo(todasAsLinhas(banco()), periodo))
    },

    async registrarLancamento(bruto, quem) {
      const dados = conferirLancamento(bruto)
      if ('ok' in dados) return dados
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      const id = crypto.randomUUID()
      banco().prepare(`insert into lancamento (id, tipo, descricao, origem, meio, valor, dia, caixa_id, operador_id, registrado_em)
        values (?, ?, ?, 'Lançamento manual', ?, ?, ?, ?, ?, ?)`)
        .run(id, dados.tipo, dados.descricao, dados.meio, dados.tipo === 'entrada' ? dados.valor : -dados.valor, hojeEmSaoPaulo(),
          dados.meio === 'dinheiro' ? caixaAberto() : null, pessoa.id, new Date().toISOString())
      gravarUltimoOperador(banco(), pessoa.id)
      return ok(linhaPeloId(id)!)
    },

    async estornarLancamento(id, bruto, quem) {
      const l = linhaPeloId(id)
      if (!l || l.ficha) return falha('nao-encontrado', MENSAGENS_FINANCEIRO.naoEncontrado)
      if (l.estornoDe) return falha('validacao', MENSAGENS_FINANCEIRO.ehEstorno)
      if (l.estornado) return falha('validacao', MENSAGENS_FINANCEIRO.jaEstornado)
      const motivo = conferirTexto(bruto, MENSAGENS_FINANCEIRO.motivo, MOTIVO_MAXIMO)
      if (typeof motivo !== 'string') return motivo
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      const original = banco().prepare('select tipo, descricao, origem, meio, valor from lancamento where id = ?').get(l.id) as
        { tipo: string; descricao: string; origem: string; meio: string; valor: number }
      const estorno = crypto.randomUUID()
      const agora = new Date().toISOString()
      // O estorno mantém o tipo e inverte o sinal; o banco recusa estornar duas vezes (único em `estorno_de`).
      banco().prepare(`insert into lancamento (id, tipo, descricao, origem, meio, valor, estorno_de, motivo, dia, caixa_id, operador_id, registrado_em)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(estorno, original.tipo, original.descricao, original.origem, original.meio, -original.valor, l.id, motivo, hojeEmSaoPaulo(),
          original.meio === 'dinheiro' ? caixaAberto() : null, pessoa.id, agora)
      // O da dona já nasce conferido (`R-FINANCEIRO-07`).
      if (pessoa.admin) banco().prepare('insert into conferencia_lancamento (estorno_id, operador_id, registrado_em) values (?, ?, ?)').run(estorno, pessoa.id, agora)
      gravarUltimoOperador(banco(), pessoa.id)
      return ok(linhaPeloId(estorno)!)
    },

    async conferirEstornoLancamento(id, dona) {
      const l = linhaPeloId(id)
      if (!l || l.ficha) return falha('nao-encontrado', MENSAGENS_FINANCEIRO.naoEncontrado)
      if (!l.estornoDe) return falha('validacao', MENSAGENS_FINANCEIRO.naoEhEstorno)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      banco().prepare('insert into conferencia_lancamento (estorno_id, operador_id, registrado_em) values (?, ?, ?) on conflict do nothing')
        .run(l.id, pessoa.id, new Date().toISOString())
      return ok(linhaPeloId(l.id)!)
    },
  }
}
