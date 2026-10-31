/**
 * O cadastro, a lista e o histórico de clientes no banco da 1.0 (telas 3.1 a
 * 3.3; `R-CLIENTE-01` a `05`, `09`, `10`). As regras estão em `comum/regras/`
 * (`cliente.ts`, `notinha.ts`), as mesmas do mock; aqui fica o que é do banco:
 * o número que nasce na sequência, o documento único pelos dígitos (restrição
 * `unique` do schema) e o que já foi pago, sem os pagamentos estornados.
 */
import { falha, ok, type Cliente, type Contrato, type DadosCliente, type Falha, type Resultado } from '../../comum/contrato'
import {
  clienteValido, codigoCliente, conferirPedidoDeClientes, conferirPedidoDeCompras, MENSAGENS_CLIENTE, paginaDeClientes, paginaDeCompras,
  type ClienteDaLista, type FichaDaCompra, type FichaDoHistorico,
} from '../../comum/regras/cliente'
import { hojeEmSaoPaulo } from '../../comum/regras/entrada'
import { numeroFicha } from '../../comum/regras/movimentos'
import { proximoNumero, transacao, type Banco } from './banco'

type OperacoesCliente = Pick<Contrato, 'obterCliente' | 'cadastrarCliente' | 'editarCliente' | 'listarClientes' | 'listarComprasDoCliente'>

type Linha = {
  id: string; numero: number; criado_em: string; nome: string; documento: string | null; telefone: string | null
  logradouro: string | null; numero_endereco: string | null; complemento: string | null; bairro: string | null
  cidade: string | null; uf: string | null; cep: string | null
  tipo_contribuinte: DadosCliente['fiscal']['tipoContribuinte']; tipo_cliente: DadosCliente['fiscal']['tipoCliente']; inscricao_estadual: string | null
}

const paraCliente = (l: Linha): Cliente => ({
  id: l.id, codigo: codigoCliente(l.numero), criadoEm: l.criado_em, nome: l.nome, documento: l.documento, telefone: l.telefone,
  rua: l.logradouro, numero: l.numero_endereco, complemento: l.complemento, bairro: l.bairro, cidade: l.cidade, uf: l.uf, cep: l.cep,
  fiscal: { tipoContribuinte: l.tipo_contribuinte, tipoCliente: l.tipo_cliente, inscricaoEstadual: l.inscricao_estadual },
})

/** As colunas do cadastro, na ordem de `valores`. */
const COLUNAS = ['nome', 'documento', 'telefone', 'logradouro', 'numero_endereco', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
  'tipo_contribuinte', 'tipo_cliente', 'inscricao_estadual'] as const

const valores = (d: DadosCliente) => [d.nome, d.documento, d.telefone, d.rua, d.numero, d.complemento, d.bairro, d.cidade, d.uf, d.cep,
  d.fiscal.tipoContribuinte, d.fiscal.tipoCliente, d.fiscal.inscricaoEstadual]

/**
 * A ficha com o que já foi pago e o rótulo do pagamento num meio só (o
 * primeiro lançado na venda). O filtro entra no fim.
 */
const FICHAS = `
  select f.id, f.numero, f.cliente_id, f.registrado_em, f.total, f.forma, f.vencimento,
         exists (select 1 from ficha_cancelamento c where c.ficha_id = f.id) as cancelada,
         (select coalesce(sum(p.valor), 0) from pagamento p
          where p.ficha_id = f.id and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)) as pago,
         (select p.rotulo from pagamento p where p.ficha_id = f.id and p.tipo = 'venda' order by p.rowid limit 1) as rotulo
  from ficha f`

type LinhaFicha = {
  id: string; numero: number; cliente_id: string; registrado_em: string; total: number; forma: FichaDaCompra['forma']
  vencimento: string | null; cancelada: number; pago: number; rotulo: string | null
}

const paraCompra = (l: LinhaFicha): FichaDaCompra => ({
  id: l.id, numero: numeroFicha(l.numero), registradoEm: l.registrado_em, total: l.total, forma: l.forma,
  vencimento: l.vencimento, cancelada: l.cancelada === 1, pago: l.pago,
  rotulo: l.forma === 'notinha' || l.forma === 'misto' ? null : l.rotulo,
})

export function clientesSqlite(banco: () => Banco): OperacoesCliente {
  const buscar = (id: unknown) =>
    typeof id === 'string' ? (banco().prepare('select * from cliente where id = ?').get(id) as Linha | undefined) ?? null : null
  const devolver = (id: string): Resultado<Cliente> => {
    const l = buscar(id)
    return l ? ok(paraCliente(l)) : falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
  }

  /** O dado limpo, ou a falha: formato, e documento repetido. Dentro da transação. */
  function preparar(bruto: unknown, menos?: string): DadosCliente | Falha {
    const dados = clienteValido(bruto)
    if ('ok' in dados) return dados
    const outro = dados.documento
      ? banco().prepare('select numero, nome from cliente where documento = ? and id is not ?').get(dados.documento, menos ?? null) as { numero: number; nome: string } | undefined
      : undefined
    return outro ? falha('validacao', MENSAGENS_CLIENTE.repetido(codigoCliente(outro.numero), outro.nome)) : dados
  }

  return {
    async obterCliente(id) {
      return devolver(String(id))
    },

    async cadastrarCliente(bruto) {
      return transacao(banco(), () => {
        const dados = preparar(bruto)
        if ('ok' in dados) return dados
        const id = crypto.randomUUID()
        banco().prepare(`insert into cliente (id, numero, criado_em, ${COLUNAS.join(', ')}) values (?, ?, ?, ${COLUNAS.map(() => '?').join(', ')})`)
          .run(id, proximoNumero(banco(), 'cliente'), new Date().toISOString(), ...valores(dados))
        return devolver(id)
      })
    },

    async editarCliente(id, bruto) {
      return transacao(banco(), () => {
        const atual = buscar(id)
        if (!atual) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
        const dados = preparar(bruto, atual.id)
        if ('ok' in dados) return dados
        banco().prepare(`update cliente set ${COLUNAS.map((c) => `${c} = ?`).join(', ')} where id = ?`).run(...valores(dados), atual.id)
        return devolver(atual.id)
      })
    },

    async listarClientes(filtro, busca, pagina, porPagina) {
      const problema = conferirPedidoDeClientes(filtro, busca, pagina, porPagina)
      if (problema) return problema
      const hoje = hojeEmSaoPaulo()
      const clientes = banco().prepare(`
        select c.id, c.numero, c.nome, c.documento, c.telefone,
               (select count(*) from ficha f where f.cliente_id = c.id
                and not exists (select 1 from ficha_cancelamento x where x.ficha_id = f.id)) as compras
        from cliente c`).all() as { id: string; numero: number; nome: string; documento: string | null; telefone: string | null; compras: number }[]
      // Só as notinhas que ainda podem dever: a quitada não muda a situação nem o em aberto.
      const notinhas = (banco().prepare(`select * from (${FICHAS} where f.forma = 'notinha') where cancelada = 0 and pago < total`).all() as LinhaFicha[])
      const doCliente = new Map<string, FichaDaCompra[]>()
      for (const n of notinhas) doCliente.set(n.cliente_id, [...(doCliente.get(n.cliente_id) ?? []), paraCompra(n)])
      const todos: ClienteDaLista[] = clientes.map((c) => ({
        id: c.id, codigo: codigoCliente(c.numero), nome: c.nome, documento: c.documento, telefone: c.telefone,
        compras: c.compras, notinhas: doCliente.get(c.id) ?? [],
      }))
      const { semIdentificacao } = banco().prepare('select count(*) as semIdentificacao from ficha where cliente_id is null and dia = ?').get(hoje) as { semIdentificacao: number }
      return ok(paginaDeClientes(todos, filtro, busca, pagina, porPagina, semIdentificacao, hoje))
    },

    async listarComprasDoCliente(clienteId, filtro, pagina, porPagina) {
      const problema = conferirPedidoDeCompras(clienteId, filtro, pagina, porPagina)
      if (problema) return problema
      if (!buscar(clienteId)) return falha('nao-encontrado', MENSAGENS_CLIENTE.naoEncontrado)
      const fichas = banco().prepare(`
        select l.*,
               (select c.dia from ficha_cancelamento c where c.ficha_id = l.id) as cancelada_em,
               (select max(p.dia) from pagamento p where p.ficha_id = l.id
                and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)) as ultimo_pagamento
        from (${FICHAS} where f.cliente_id = ?) l`).all(clienteId) as (LinhaFicha & { cancelada_em: string | null; ultimo_pagamento: string | null })[]
      const itens = banco().prepare(`
        select i.ficha_id, i.descricao, i.quantidade from ficha_item i join ficha f on f.id = i.ficha_id
        where f.cliente_id = ? order by i.rowid`).all(clienteId) as { ficha_id: string; descricao: string; quantidade: number }[]
      const servicos = banco().prepare(`
        select s.ficha_id, s.nome from ficha_servico s join ficha f on f.id = s.ficha_id
        where f.cliente_id = ? order by s.rowid`).all(clienteId) as { ficha_id: string; nome: string }[]
      const historico = fichas.map((l): FichaDoHistorico => ({
        ...paraCompra(l),
        itens: itens.filter((i) => i.ficha_id === l.id).map((i) => ({ descricao: i.descricao, quantidade: i.quantidade })),
        servicos: servicos.filter((x) => x.ficha_id === l.id).map((x) => x.nome),
        canceladaEm: l.cancelada_em,
        ultimoPagamento: l.ultimo_pagamento,
      }))
      return ok(paginaDeCompras(historico, filtro, pagina, porPagina, hojeEmSaoPaulo()))
    },
  }
}
