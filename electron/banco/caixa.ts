/**
 * O caixa no banco da 1.0 (tela 7.1; `R-CAIXA-02` a `10`). As regras estão em
 * `comum/regras/caixa.ts`, as mesmas do mock; aqui fica o que é do banco: um
 * caixa aberto por vez (gatilho `caixa_um_aberto`), o fechamento com o esperado
 * gravado, e a leitura dos movimentos em dinheiro que apontam o caixa
 * (pagamentos, estornos, cancelamentos, lançamentos e a gaveta).
 */
import { falha, ok, type CaixaDetalhe, type CaixaResumido, type Contrato, type MovimentoGaveta, type Resultado } from '../../comum/contrato'
import {
  conferirPagina, conferirPeriodoCaixa, detalheDoCaixa, MENSAGENS_CAIXA, paginaDeCaixas, paginaDeGaveta, valorContado, type MovimentoLido,
} from '../../comum/regras/caixa'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { numeroFicha } from '../../comum/regras/movimentos'
import { criarTentativas, type Tentativas } from '../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../comum/regras/produto'
import { transacao, type Banco } from './banco'
import { criarConferencia, gravarUltimoOperador } from './operadores'

type OperacoesCaixa = Pick<Contrato,
  'obterCaixaAtual' | 'abrirCaixa' | 'movimentarGaveta' | 'fecharCaixa' | 'conferirFechamento' | 'listarCaixas' | 'listarMovimentosGaveta' | 'obterCaixa'>

const CAIXAS = `
  select c.id, c.registrado_em as aberto_em, oa.nome as operador_abertura, c.dinheiro_abertura,
         f.id as fechamento_id, f.registrado_em as fechado_em, ofe.nome as operador_fechamento, f.contado, f.esperado, f.justificativa,
         d.nome as conferido_por
  from caixa c join operador oa on oa.id = c.operador_id
  left join caixa_fechamento f on f.caixa_id = c.id left join operador ofe on ofe.id = f.operador_id
  left join conferencia_fechamento cf on cf.fechamento_id = f.id left join operador d on d.id = cf.operador_id`

type Linha = {
  id: string; aberto_em: string; operador_abertura: string; dinheiro_abertura: number
  fechamento_id: string | null; fechado_em: string | null; operador_fechamento: string | null; contado: number | null; esperado: number | null
  justificativa: string | null; conferido_por: string | null
}

const paraCaixa = (l: Linha): CaixaResumido => ({
  id: l.id, abertoEm: l.aberto_em, operadorAbertura: l.operador_abertura, dinheiroAbertura: l.dinheiro_abertura,
  fechamento: l.fechamento_id ? {
    registradoEm: l.fechado_em!, operador: l.operador_fechamento!, contado: l.contado!, esperado: l.esperado!,
    diferenca: l.contado! - l.esperado!, justificativa: l.justificativa, conferidoPor: l.conferido_por,
  } : null,
})

/** Os movimentos em dinheiro que apontam o caixa: o mesmo dinheiro que o esperado da semente soma. */
function movimentosDoCaixa(banco: Banco, caixaId: string): MovimentoLido[] {
  const daFicha = (banco.prepare(`
    select p.id, p.registrado_em, p.tipo, p.valor, o.nome as operador, f.id as ficha_id, f.numero, f.forma,
           exists (select 1 from ficha_item i where i.ficha_id = f.id) as com_itens,
           (exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)
             or exists (select 1 from ficha_cancelamento x where x.ficha_id = f.id)) as estornado
    from pagamento p join ficha f on f.id = p.ficha_id join operador o on o.id = p.operador_id
    where p.caixa_id = ? and p.meio = 'dinheiro'`).all(caixaId) as {
      id: string; registrado_em: string; tipo: string; valor: number; operador: string; ficha_id: string; numero: number; forma: string; com_itens: number; estornado: number
    }[]).map((p): MovimentoLido => ({
    id: p.id, registradoEm: p.registrado_em,
    tipo: p.tipo === 'venda' ? (p.com_itens ? 'venda' : 'servico') : p.tipo === 'entrada' ? 'entrada' : 'recebimento',
    motivo: null, valor: p.valor, operador: p.operador, ficha: { id: p.ficha_id, numero: numeroFicha(p.numero) }, estornado: p.estornado === 1, texto: null,
  }))
  const estornos = (banco.prepare(`
    select e.id, e.registrado_em, e.motivo, p.valor, o.nome as operador, f.id as ficha_id, f.numero
    from pagamento_estorno e join pagamento p on p.id = e.pagamento_id join ficha f on f.id = p.ficha_id join operador o on o.id = e.operador_id
    where e.caixa_id = ? and p.meio = 'dinheiro'`).all(caixaId) as {
      id: string; registrado_em: string; motivo: string; valor: number; operador: string; ficha_id: string; numero: number
    }[]).map((e): MovimentoLido => ({
    id: e.id, registradoEm: e.registrado_em, tipo: 'estorno-recebimento', motivo: e.motivo, valor: -e.valor, operador: e.operador,
    ficha: { id: e.ficha_id, numero: numeroFicha(e.numero) }, estornado: false, texto: null,
  }))
  // O cancelamento tira o que ainda contava: o recebimento já estornado não sai de novo.
  const cancelamentos = (banco.prepare(`
    select x.id || '-' || p.id as id, x.registrado_em, x.motivo, p.valor, o.nome as operador, f.id as ficha_id, f.numero
    from ficha_cancelamento x join ficha f on f.id = x.ficha_id join pagamento p on p.ficha_id = f.id join operador o on o.id = x.operador_id
    where x.caixa_id = ? and p.meio = 'dinheiro' and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)`).all(caixaId) as {
      id: string; registrado_em: string; motivo: string; valor: number; operador: string; ficha_id: string; numero: number
    }[]).map((c): MovimentoLido => ({
    id: c.id, registradoEm: c.registrado_em, tipo: 'cancelamento', motivo: c.motivo, valor: -c.valor, operador: c.operador,
    ficha: { id: c.ficha_id, numero: numeroFicha(c.numero) }, estornado: false, texto: null,
  }))
  const lancamentos = (banco.prepare(`
    select l.id, l.registrado_em, l.descricao, l.motivo, l.valor, l.estorno_de, o.nome as operador, orig.descricao as original,
           exists (select 1 from lancamento x where x.estorno_de = l.id) as estornado
    from lancamento l join operador o on o.id = l.operador_id left join lancamento orig on orig.id = l.estorno_de
    where l.caixa_id = ? and l.meio = 'dinheiro'`).all(caixaId) as {
      id: string; registrado_em: string; descricao: string; motivo: string | null; valor: number; estorno_de: string | null; operador: string; original: string | null; estornado: number
    }[]).map((l): MovimentoLido => ({
    id: l.id, registradoEm: l.registrado_em, tipo: l.estorno_de ? 'estorno-lancamento' : 'lancamento',
    motivo: l.estorno_de ? l.motivo : l.descricao, valor: l.valor, operador: l.operador, ficha: null, estornado: l.estornado === 1,
    texto: l.estorno_de ? l.original : l.descricao,
  }))
  const gaveta = (banco.prepare(`
    select g.id, g.registrado_em, g.tipo, g.valor, g.motivo, g.estorno_de, o.nome as operador,
           exists (select 1 from movimento_gaveta x where x.estorno_de = g.id) as estornado
    from movimento_gaveta g join operador o on o.id = g.operador_id where g.caixa_id = ?`).all(caixaId) as {
      id: string; registrado_em: string; tipo: 'adicao' | 'retirada'; valor: number; motivo: string; estorno_de: string | null; operador: string; estornado: number
    }[]).map((g): MovimentoLido => ({
    id: g.id, registradoEm: g.registrado_em, tipo: g.estorno_de ? 'estorno-gaveta' : g.tipo, motivo: g.motivo,
    valor: g.tipo === 'adicao' ? g.valor : -g.valor, operador: g.operador, ficha: null, estornado: g.estornado === 1, texto: null,
  }))
  return [...daFicha, ...estornos, ...cancelamentos, ...lancamentos, ...gaveta]
}

export function caixaSqlite(banco: () => Banco, tentativas: Tentativas = criarTentativas()): OperacoesCaixa {
  const conferir = criarConferencia(banco, tentativas)
  const ler = (id: unknown) => (typeof id === 'string' ? banco().prepare(`${CAIXAS} where c.id = ?`).get(id) as Linha | undefined : undefined)
  const aberto = () => banco().prepare(`${CAIXAS} where f.id is null`).get() as Linha | undefined
  const detalhe = (l: Linha): CaixaDetalhe => detalheDoCaixa(paraCaixa(l), movimentosDoCaixa(banco(), l.id))
  const devolver = (id: string): Resultado<CaixaDetalhe> => {
    const l = ler(id)
    return l ? ok(detalhe(l)) : falha('nao-encontrado', MENSAGENS_CAIXA.naoEncontrado)
  }

  return {
    async obterCaixaAtual() {
      const l = aberto()
      return ok(l ? detalhe(l) : null)
    },

    async abrirCaixa(contado, quem) {
      if (!valorContado(contado)) return falha('validacao', MENSAGENS_CAIXA.valor)
      if (aberto()) return falha('validacao', MENSAGENS_CAIXA.jaAberto)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      return transacao(banco(), () => {
        if (aberto()) return falha('validacao', MENSAGENS_CAIXA.jaAberto)
        const id = crypto.randomUUID()
        banco().prepare('insert into caixa (id, dinheiro_abertura, operador_id, registrado_em) values (?, ?, ?, ?)')
          .run(id, contado, pessoa.id, new Date().toISOString())
        gravarUltimoOperador(banco(), pessoa.id)
        return devolver(id)
      })
    },

    async movimentarGaveta(tipo, valor, bruto, quem) {
      if (tipo !== 'adicao' && tipo !== 'retirada') return falha('validacao', 'Pedido inválido.')
      if (!valorContado(valor) || valor === 0) return falha('validacao', MENSAGENS_CAIXA.valorMovimento)
      const motivo = typeof bruto === 'string' ? bruto.trim() : ''
      if (!motivo) return falha('validacao', MENSAGENS_CAIXA.motivo)
      if (!aberto()) return falha('validacao', MENSAGENS_CAIXA.semAberto)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      return transacao(banco(), () => {
        const l = aberto()
        if (!l) return falha('validacao', MENSAGENS_CAIXA.semAberto)
        banco().prepare('insert into movimento_gaveta (id, caixa_id, tipo, valor, motivo, operador_id, registrado_em) values (?, ?, ?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), l.id, tipo, valor, motivo, pessoa.id, new Date().toISOString())
        gravarUltimoOperador(banco(), pessoa.id)
        return devolver(l.id)
      })
    },

    async fecharCaixa(contado, bruto, quem) {
      if (!valorContado(contado)) return falha('validacao', MENSAGENS_CAIXA.valor)
      const antes = aberto()
      if (!antes) return falha('validacao', MENSAGENS_CAIXA.semAberto)
      const justificativa = typeof bruto === 'string' ? bruto.trim() : ''
      if (contado !== detalhe(antes).resumo.esperado && !justificativa) return falha('validacao', MENSAGENS_CAIXA.justificativa)
      if (!quem) return falha('validacao', MENSAGENS_PRODUTO.semAssinatura)
      const pessoa = await conferir(quem)
      if ('ok' in pessoa) return pessoa
      return transacao(banco(), () => {
        const l = aberto()
        if (!l) return falha('validacao', MENSAGENS_CAIXA.semAberto)
        // O esperado de agora: uma venda pode ter entrado durante o PIN.
        const esperado = detalhe(l).resumo.esperado
        if (contado !== esperado && !justificativa) return falha('validacao', MENSAGENS_CAIXA.justificativa)
        const agora = new Date().toISOString()
        const fechamento = crypto.randomUUID()
        banco().prepare(`insert into caixa_fechamento (id, caixa_id, esperado, contado, justificativa, operador_id, registrado_em)
          values (?, ?, ?, ?, ?, ?, ?)`).run(fechamento, l.id, esperado, contado, contado === esperado ? null : justificativa, pessoa.id, agora)
        // Com diferença, a dona que fecha já confere (`R-CAIXA-10`).
        if (pessoa.admin && contado !== esperado) {
          banco().prepare('insert into conferencia_fechamento (fechamento_id, operador_id, registrado_em) values (?, ?, ?)').run(fechamento, pessoa.id, agora)
        }
        gravarUltimoOperador(banco(), pessoa.id)
        return devolver(l.id)
      })
    },

    async conferirFechamento(id, dona) {
      const l = ler(id)
      if (!l) return falha('nao-encontrado', MENSAGENS_CAIXA.naoEncontrado)
      if (!l.fechamento_id) return falha('validacao', MENSAGENS_CAIXA.naoFechado)
      if (l.contado === l.esperado) return falha('validacao', MENSAGENS_CAIXA.semDiferenca)
      const pessoa = await conferir(dona, { soAdmin: true })
      if ('ok' in pessoa) return pessoa
      banco().prepare('insert into conferencia_fechamento (fechamento_id, operador_id, registrado_em) values (?, ?, ?) on conflict do nothing')
        .run(l.fechamento_id, pessoa.id, new Date().toISOString())
      return devolver(l.id)
    },

    async listarCaixas(bruto, soFechados, pagina, porPagina) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const problema = conferirPagina(pagina, porPagina)
      if (problema) return problema
      return ok(paginaDeCaixas((banco().prepare(CAIXAS).all() as Linha[]).map(paraCaixa), periodo, soFechados === true, pagina, porPagina))
    },

    async listarMovimentosGaveta(bruto, pagina, porPagina) {
      const periodo = conferirPeriodoCaixa(bruto, hojeEmSaoPaulo())
      if ('ok' in periodo) return periodo
      const problema = conferirPagina(pagina, porPagina)
      if (problema) return problema
      const movimentos = (banco().prepare(`
        select g.id, g.registrado_em, g.tipo, g.valor, g.motivo, g.estorno_de, g.caixa_id, o.nome as operador,
               exists (select 1 from movimento_gaveta x where x.estorno_de = g.id) as estornado
        from movimento_gaveta g join operador o on o.id = g.operador_id`).all() as {
          id: string; registrado_em: string; tipo: 'adicao' | 'retirada'; valor: number; motivo: string; estorno_de: string | null; caixa_id: string; operador: string; estornado: number
        }[]).map((g): MovimentoGaveta => ({
        id: g.id, registradoEm: g.registrado_em, tipo: g.estorno_de ? 'estorno-gaveta' : g.tipo,
        descricao: g.estorno_de ? 'Estorno de adição ou retirada' : g.tipo === 'adicao' ? 'Dinheiro adicionado' : 'Dinheiro retirado',
        motivo: g.motivo, valor: g.tipo === 'adicao' ? g.valor : -g.valor, operador: g.operador, caixaId: g.caixa_id, estornado: g.estornado === 1,
      }))
      return ok(paginaDeGaveta(movimentos, periodo, pagina, porPagina))
    },

    async obterCaixa(id) {
      return devolver(String(id))
    },
  }
}
