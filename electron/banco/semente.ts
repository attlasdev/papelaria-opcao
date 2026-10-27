/**
 * Semente do banco da 1.0, para desenvolvimento, testes e o ambiente de teste
 * das migrations. Nunca vai para a loja: lá a base começa vazia.
 *
 * Parte da base de exemplo da 0.1 (`criarSemente`, a que a loja pediu para
 * testar) e acrescenta de propósito as falhas da realidade (`patologias`):
 * seed que só tem o caso feliz dá confiança falsa (regra global do seed).
 *
 * Tudo entra pelas regras do banco, na ordem em que aconteceu: o saldo vem dos
 * movimentos, os números vêm da `sequencia`, o caixa abre e fecha todo dia.
 * Se a semente montar algo que o banco recusa, ela falha, e isso é um achado.
 *
 * Determinística: o mesmo `hoje` dá a mesma base, com os mesmos ids.
 */
import { somarDias } from '../../src/mock/base/datas'
import { criarSemente } from '../../src/mock/base/semente'
import type { Ficha, Meio, Pagamento } from '../../src/mock/base/tipos'
import { proximoNumero, transacao, type Banco } from './banco'

type Valor = string | number | null
type Linha = Record<string, Valor>

export type OpcoesSemente = {
  /** Dia de hoje (`AAAA-MM-DD`, São Paulo). */
  hoje: string
  /** Minuto do dia de agora: nada de hoje acontece depois dele. */
  minutoAtual?: number
}

const ABERTURA_CAIXA = 10000

/** Instante UTC de um dia e horário de São Paulo (sem horário de verão desde 2019). */
function instante(dia: string, horario: string) {
  return new Date(`${dia}T${horario}:00-03:00`).toISOString()
}

export function semearBanco(banco: Banco, { hoje, minutoAtual = 24 * 60 - 1 }: OpcoesSemente) {
  const base = criarSemente(hoje, minutoAtual)
  const agora = instante(hoje, `${String(Math.floor(minutoAtual / 60)).padStart(2, '0')}:${String(minutoAtual % 60).padStart(2, '0')}`)

  let contador = 0
  const novoId = () => `00000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`

  const inserir = (tabela: string, linha: Linha) => {
    const colunas = Object.keys(linha)
    banco.prepare(`insert into ${tabela} (${colunas.join(', ')}) values (${colunas.map(() => '?').join(', ')})`).run(...Object.values(linha))
  }
  const um = <T>(sql: string, ...parametros: Valor[]) => banco.prepare(sql).get(...parametros) as T

  // A linha do tempo: cada fato com o instante em que aconteceu. Roda em ordem,
  // então o "último movimento" do banco (maior rowid) é o último no tempo.
  type Evento = { quando: string; fazer: () => void }
  const linhaDoTempo: Evento[] = []
  const quando = (dia: string, horario: string, fazer: () => void) => {
    const q = instante(dia, horario)
    if (q <= agora) linhaDoTempo.push({ quando: q, fazer })
  }

  transacao(banco, () => {
    // Operadores --------------------------------------------------------------
    // A Márcia saiu da loja: desativada no fim, o histórico continua citando.
    const operadores = { joao: novoId(), marcia: novoId() }
    const desde = instante(somarDias(hoje, -400), '09:00')
    inserir('operador', { id: operadores.joao, nome: base.operador, criado_em: desde })
    inserir('operador', { id: operadores.marcia, nome: 'Márcia Antunes', criado_em: desde })
    const operadorDoDia = (dia: string) => (dia < somarDias(hoje, -45) ? operadores.marcia : operadores.joao)

    // Clientes ----------------------------------------------------------------
    const clientes = new Map<string, string>()
    base.clientes.forEach((cliente, indice) => {
      const id = novoId()
      clientes.set(cliente.id, id)
      const endereco = cliente.endereco.match(/^(.*), (\S+) - (.*) - (.*)\/(\w\w)$/)
      inserir('cliente', {
        id, numero: proximoNumero(banco, 'cliente'), nome: cliente.nome,
        documento: documentoCompleto(cliente.documento, indice),
        telefone: cliente.telefone.replace(/\D/g, '') || null,
        logradouro: endereco?.[1] ?? null, numero_endereco: endereco?.[2] ?? null,
        bairro: endereco?.[3] ?? null, cidade: endereco?.[4] ?? null, uf: endereco?.[5] ?? null,
        criado_em: instante(cliente.desde, '09:00'),
      })
    })

    // Produtos e saldo inicial ------------------------------------------------
    // A 0.1 monta o estoque de trás para frente a partir do saldo de hoje; o
    // saldo inicial é o "antes" do movimento mais antigo de cada produto.
    const inicioDaLoja = somarDias(hoje, -100)
    const produtos = new Map<string, string>()
    const saldoInicial = new Map(base.produtos.map((p) => [p.codigo, p.saldo]))
    for (const m of base.movimentosEstoque) saldoInicial.set(m.produto, m.antes) // lista vem da mais nova para a mais antiga

    const movimentar = (produtoId: string, tipo: string, quantidade: number, momento: string, extra: Linha) => {
      const { saldo } = um<{ saldo: number }>('select saldo from produto where id = ?', produtoId)
      inserir('movimento_estoque', {
        id: novoId(), produto_id: produtoId, tipo, quantidade, saldo_antes: saldo, saldo_depois: saldo + quantidade,
        registrado_em: momento, ...extra,
      })
    }

    const cadastrarProduto = (linha: Linha, saldo: number, momento: string, operadorId: string) => {
      const id = novoId()
      inserir('produto', { id, numero: proximoNumero(banco, 'produto'), criado_em: momento, ...linha })
      if (saldo > 0) movimentar(id, 'entrada', saldo, momento, { motivo: 'Saldo inicial do cadastro', operador_id: operadorId })
      return id
    }

    for (const p of base.produtos) {
      produtos.set(p.codigo, cadastrarProduto({
        codigo_barras: p.codigoBarras ?? null, descricao: p.descricao, categoria: p.categoria, unidade: p.unidade,
        preco: p.preco, custo: p.custo ?? null, minimo: p.minimo,
      }, saldoInicial.get(p.codigo)!, instante(inicioDaLoja, '07:00'), operadores.marcia))
    }

    // Caixa: abre às 07:55 e fecha às 18:30 todo dia; hoje fica aberto ---------
    let caixaAberto: string | null = null
    const esperadoDoCaixa = (caixaId: string) => um<{ esperado: number }>(SQL_ESPERADO, caixaId).esperado
    const diferencas = new Map([
      [somarDias(hoje, -2), { diferenca: -1000, justificativa: 'Troco entregue sem registro.' }],
      [somarDias(hoje, -9), { diferenca: 500, justificativa: 'Sobrou: cliente não esperou o troco.' }],
    ])
    for (let atras = 99; atras >= 0; atras--) {
      const dia = somarDias(hoje, -atras)
      quando(dia, '07:55', () => {
        caixaAberto = novoId()
        inserir('caixa', { id: caixaAberto, dinheiro_abertura: ABERTURA_CAIXA, operador_id: operadorDoDia(dia), registrado_em: instante(dia, '07:55') })
      })
      // Retirada para o cofre a cada 3 dias, do que passou da abertura.
      if (atras % 3 === 0) {
        quando(dia, '17:30', () => {
          const sobra = Math.floor((esperadoDoCaixa(caixaAberto!) - ABERTURA_CAIXA) / 1000) * 1000
          if (sobra > 0) {
            inserir('movimento_gaveta', {
              id: novoId(), caixa_id: caixaAberto, tipo: 'retirada', valor: sobra, motivo: 'Cofre',
              operador_id: operadorDoDia(dia), registrado_em: instante(dia, '17:30'),
            })
          }
        })
      }
      if (atras > 0) {
        quando(dia, '18:30', () => {
          const esperado = esperadoDoCaixa(caixaAberto!)
          const diferenca = diferencas.get(dia)
          inserir('caixa_fechamento', {
            id: novoId(), caixa_id: caixaAberto, esperado, contado: esperado + (diferenca?.diferenca ?? 0),
            justificativa: diferenca?.justificativa ?? null, operador_id: operadorDoDia(dia), registrado_em: instante(dia, '18:30'),
          })
          caixaAberto = null
        })
      }
    }

    // Entradas de mercadoria: uma entrega por dia de reposição ----------------
    const entradasPorDia = new Map<string, typeof base.movimentosEstoque>()
    for (const m of base.movimentosEstoque) {
      if (m.tipo !== 'Entrada') continue
      const dia = m.data.slice(0, 10)
      entradasPorDia.set(dia, [...(entradasPorDia.get(dia) ?? []), m])
    }
    for (const [dia, itens] of entradasPorDia) {
      quando(dia, '07:50', () => {
        const entradaId = novoId()
        const operadorId = operadorDoDia(dia)
        inserir('entrada_mercadoria', {
          id: entradaId, recebida_em: somarDias(dia, -1), fornecedor: 'Distribuidora Central', referencia: `NF ${dia.replace(/-/g, '').slice(2)}`,
          operador_id: operadorId, registrado_em: instante(dia, '07:50'),
        })
        for (const m of itens) {
          const p = base.produtos.find((x) => x.codigo === m.produto)!
          movimentar(produtos.get(m.produto)!, 'entrada', m.depois - m.antes, instante(dia, '07:50'), {
            entrada_id: entradaId, custo_unitario: p.custo ?? null, operador_id: operadorId,
          })
        }
      })
    }

    // Vendas ------------------------------------------------------------------
    type ItemNovo = { codigo: string; quantidade: number }
    type ServicoNovo = { nome: string; valor: number; perdas?: number; observacao?: string }
    type PagamentoNovo = Omit<Linha, 'ficha_id'> & { meio: Meio; valor: number; tipo: string }

    /** Conclui uma ficha como o back vai fazer: preço e total vêm do cadastro, baixa na mesma transação. */
    const vender = (dia: string, horario: string, venda: {
      clienteId: string | null; forma: Ficha['forma']; itens: ItemNovo[]; servicos?: ServicoNovo[]
      desconto?: number; vencimento?: string; pagamentos: PagamentoNovo[] | ((total: number) => PagamentoNovo[])
    }) => {
      const momento = instante(dia, horario)
      const operadorId = operadorDoDia(dia)
      const itens = venda.itens.map((i) => ({
        ...i, produtoId: produtos.get(i.codigo)!,
        ...um<{ descricao: string; preco: number }>('select descricao, preco from produto where id = ?', produtos.get(i.codigo)!),
      }))
      const subtotal = itens.reduce((t, i) => t + i.preco * i.quantidade, 0) + (venda.servicos ?? []).reduce((t, s) => t + s.valor, 0)
      const desconto = venda.desconto ?? 0
      const fichaId = novoId()
      inserir('ficha', {
        id: fichaId, numero: proximoNumero(banco, 'ficha'), cliente_id: venda.clienteId, forma: venda.forma,
        subtotal, desconto, total: subtotal - desconto, vencimento: venda.vencimento ?? null, dia,
        operador_id: operadorId, registrado_em: momento,
      })
      for (const i of itens) {
        inserir('ficha_item', { id: novoId(), ficha_id: fichaId, produto_id: i.produtoId, descricao: i.descricao, quantidade: i.quantidade, preco: i.preco })
        movimentar(i.produtoId, 'venda', -i.quantidade, momento, { ficha_id: fichaId, operador_id: operadorId })
      }
      for (const s of venda.servicos ?? []) {
        inserir('ficha_servico', { id: novoId(), ficha_id: fichaId, nome: s.nome, valor: s.valor, perdas: s.perdas ?? null, observacao: s.observacao ?? null })
      }
      const pagamentos = typeof venda.pagamentos === 'function' ? venda.pagamentos(subtotal - desconto) : venda.pagamentos
      for (const p of pagamentos) pagar(fichaId, dia, momento, operadorId, p)
      return { fichaId, total: subtotal - desconto, itens }
    }

    const pagar = (fichaId: string, dia: string, momento: string, operadorId: string, p: PagamentoNovo) => {
      const id = novoId()
      inserir('pagamento', { id, ficha_id: fichaId, dia, caixa_id: caixaAberto, operador_id: operadorId, registrado_em: momento, ...p })
      return id
    }

    /** Cobrança na maquininha integrada: registrada antes, aprovada depois (A4). */
    const cobrar = (momento: string, meio: 'credito' | 'debito' | 'pix', valor: number, situacao: string, bandeira: string | null = 'Visa') => {
      const id = novoId()
      inserir('cobranca', { id, meio, valor, situacao: 'enviando', criada_em: momento, atualizada_em: momento })
      banco.prepare('update cobranca set situacao = ?, bandeira = ?, externo_id = ?, atualizada_em = ? where id = ?')
        .run(situacao, situacao === 'aprovada' ? bandeira : null, `ORD${String(contador).padStart(8, '0')}`, momento, id)
      return id
    }

    let dinheiros = 0
    let cartoes = 0
    /** Pagamento à vista ou entrada da notinha, com troco e maquininha como a 1.0 guarda. */
    const pagamentoNaHora = (tipo: string, pagamento: Pagamento, momento: string): PagamentoNovo => {
      if (pagamento.meio === 'dinheiro') {
        // Um em cada três sem o "recebido" (a pessoa não digitou): acontece.
        if (++dinheiros % 3 === 0) return { tipo, meio: 'dinheiro', valor: pagamento.valor }
        const recebido = Math.ceil(pagamento.valor / 1000) * 1000
        return { tipo, meio: 'dinheiro', valor: pagamento.valor, recebido, troco: recebido - pagamento.valor }
      }
      if (pagamento.meio === 'cartao') {
        const cartao = /débito/.test(pagamento.rotulo ?? '') ? 'debito' : 'credito'
        if (++cartoes % 2 === 0) {
          return { tipo, meio: 'cartao', valor: pagamento.valor, cartao, maquininha: 'mercado-pago',
            rotulo: `${pagamento.rotulo ?? 'Cartão'} · Mercado Pago`, cobranca_id: cobrar(momento, cartao, pagamento.valor, 'aprovada') }
        }
        return { tipo, meio: 'cartao', valor: pagamento.valor, cartao, maquininha: 'sicoob', rotulo: `${pagamento.rotulo ?? 'Cartão'} · Sicoob` }
      }
      return { tipo, meio: 'pix', valor: pagamento.valor }
    }

    // As fichas da 0.1, com as quitações de notinha agrupadas por cliente e dia
    // num "Receber" só, como a tela faz.
    const fichasDaBase = new Map<Ficha, string>()
    const quitacoes = new Map<string, { dia: string; clienteId: string; pagamentos: { ficha: Ficha; pagamento: Pagamento }[] }>()
    for (const ficha of base.fichas) {
      quando(ficha.data, ficha.horario, () => {
        const pagamentos = ficha.forma === 'notinha'
          ? ficha.pagamentos.filter((p) => p.entrada).map((p) => pagamentoNaHora('entrada', p, instante(ficha.data, ficha.horario)))
          : ficha.pagamentos.map((p) => pagamentoNaHora('venda', p, instante(ficha.data, ficha.horario)))
        const { fichaId } = vender(ficha.data, ficha.horario, {
          clienteId: ficha.clienteId ? clientes.get(ficha.clienteId)! : null, forma: ficha.forma,
          itens: ficha.itens.map((i) => ({ codigo: i.codigo, quantidade: i.quantidade })),
          desconto: ficha.desconto, vencimento: ficha.vencimento, pagamentos,
        })
        fichasDaBase.set(ficha, fichaId)
      })
      for (const pagamento of ficha.pagamentos) {
        if (ficha.forma !== 'notinha' || pagamento.entrada) continue
        const chave = `${ficha.clienteId} ${pagamento.data}`
        const grupo = quitacoes.get(chave) ?? { dia: pagamento.data, clienteId: ficha.clienteId!, pagamentos: [] }
        grupo.pagamentos.push({ ficha, pagamento })
        quitacoes.set(chave, grupo)
      }
    }
    const receber = (dia: string, horario: string, clienteId: string, pagamentos: { fichaId: string; meio: Meio; valor: number }[]) => {
      const momento = instante(dia, horario)
      const operadorId = operadorDoDia(dia)
      const recebimentoId = novoId()
      inserir('recebimento', { id: recebimentoId, cliente_id: clienteId, dia, operador_id: operadorId, registrado_em: momento })
      // Recebimento no cartão passa na Sicoob, a manual: cartão sem maquininha não existe na loja.
      const cartao = (meio: Meio): Linha => (meio === 'cartao' ? { maquininha: 'sicoob', cartao: 'debito', rotulo: 'Cartão débito · Sicoob' } : {})
      return pagamentos.map((p) => pagar(p.fichaId, dia, momento, operadorId, { tipo: 'recebimento', recebimento_id: recebimentoId, meio: p.meio, valor: p.valor, ...cartao(p.meio) }))
    }
    for (const grupo of quitacoes.values()) {
      quando(grupo.dia, '10:30', () => {
        receber(grupo.dia, '10:30', clientes.get(grupo.clienteId)!, grupo.pagamentos.map(({ ficha, pagamento }) => ({
          fichaId: fichasDaBase.get(ficha)!, meio: pagamento.meio, valor: pagamento.valor,
        })))
      })
    }

    // Lançamentos manuais da 0.1. "Troco" e "Saída de caixa" eram categorias
    // legadas: a retirada para o cofre já é movimento da gaveta, acima.
    for (const m of base.movimentosCaixa) {
      if (m.categoria !== 'Avulso' && m.categoria !== 'Despesa') continue
      quando(m.data, m.horario, () => {
        inserir('lancamento', {
          id: novoId(), tipo: m.valor > 0 ? 'entrada' : 'despesa', descricao: m.descricao, origem: m.origem, meio: m.meio,
          valor: m.valor, dia: m.data, caixa_id: m.meio === 'dinheiro' ? caixaAberto : null,
          operador_id: operadorDoDia(m.data), registrado_em: instante(m.data, m.horario),
        })
      })
    }

    // Patologias ----------------------------------------------------------------
    // Cada uma é um caso que quebra tela ou cálculo quando ninguém pensou nele.
    const dia = (atras: number) => somarDias(hoje, -atras)
    const cliente = (codigo: string) => clientes.get(codigo)!

    // Ficha vendida em dinheiro e cancelada à tarde: estoque volta, o dinheiro sai da gaveta.
    quando(dia(4), '14:00', () => {
      const venda = vender(dia(4), '14:00', {
        clienteId: cliente('CLI-0110'), forma: 'dinheiro', itens: [{ codigo: 'EST-0035', quantidade: 2 }, { codigo: 'EST-0029', quantidade: 3 }],
        pagamentos: (total) => [{ tipo: 'venda', meio: 'dinheiro', valor: total, recebido: 5000, troco: 5000 - total }],
      })
      const momento = instante(dia(4), '14:20')
      inserir('ficha_cancelamento', { id: novoId(), ficha_id: venda.fichaId, motivo: 'Cliente desistiu da compra', dia: dia(4), caixa_id: caixaAberto, operador_id: operadores.joao, registrado_em: momento })
      for (const i of venda.itens) movimentar(i.produtoId, 'cancelamento', i.quantidade, momento, { ficha_id: venda.fichaId, operador_id: operadores.joao })
    })

    // Notinha com entrada, recebimento estornado (cliente errado) e recebimento
    // parcial que fica: continua devendo o resto.
    let notinhaParcial = ''
    let recebimentoErrado = ''
    quando(dia(20), '15:40', () => {
      notinhaParcial = vender(dia(20), '15:40', {
        clienteId: cliente('CLI-0113'), forma: 'notinha', vencimento: dia(-10),
        itens: [{ codigo: 'EST-0034', quantidade: 2 }, { codigo: 'EST-0021', quantidade: 2 }],
        pagamentos: [{ tipo: 'entrada', meio: 'pix', valor: 5000 }],
      }).fichaId
    })
    quando(dia(12), '11:00', () => { [recebimentoErrado] = receber(dia(12), '11:00', cliente('CLI-0113'), [{ fichaId: notinhaParcial, meio: 'pix', valor: 6000 }]) })
    quando(dia(11), '09:10', () => {
      inserir('pagamento_estorno', { id: novoId(), pagamento_id: recebimentoErrado, motivo: 'Lançado no cliente errado', dia: dia(11), caixa_id: caixaAberto, operador_id: operadores.joao, registrado_em: instante(dia(11), '09:10') })
    })
    quando(dia(8), '16:00', () => { receber(dia(8), '16:00', cliente('CLI-0113'), [{ fichaId: notinhaParcial, meio: 'dinheiro', valor: 3000 }]) })

    // Serviços: só serviço, com perda; e item + serviço ("Venda e serviço").
    quando(dia(3), '10:05', () => {
      vender(dia(3), '10:05', {
        clienteId: null, forma: 'pix', itens: [],
        servicos: [{ nome: 'Cópias P&B', valor: 1000, perdas: 4, observacao: 'Pediu 20, saíram 24: 4 tortas' }],
        pagamentos: [{ tipo: 'venda', meio: 'pix', valor: 1000 }],
      })
    })
    quando(dia(1), '15:15', () => {
      vender(dia(1), '15:15', {
        clienteId: cliente('CLI-0109'), forma: 'dinheiro', itens: [{ codigo: 'EST-0023', quantidade: 1 }],
        servicos: [{ nome: 'Encadernação espiral', valor: 800 }],
        pagamentos: (total) => [{ tipo: 'venda', meio: 'dinheiro', valor: total, recebido: 4000, troco: 4000 - total }],
      })
    })

    // Venda mista (dinheiro + cartão) e a cobrança recusada antes da aprovada.
    quando(dia(2), '13:30', () => {
      const momento = instante(dia(2), '13:30')
      cobrar(momento, 'credito', 3000, 'recusada')
      vender(dia(2), '13:30', {
        clienteId: null, forma: 'misto', itens: [{ codigo: 'EST-0030', quantidade: 1 }, { codigo: 'EST-0036', quantidade: 1 }],
        pagamentos: (total): PagamentoNovo[] => [
          { tipo: 'venda', meio: 'dinheiro', valor: total - 3000, recebido: 2000, troco: 2000 - (total - 3000) },
          { tipo: 'venda', meio: 'cartao', valor: 3000, cartao: 'credito', maquininha: 'mercado-pago', rotulo: 'Cartão crédito Visa · Mercado Pago', cobranca_id: cobrar(momento, 'credito', 3000, 'aprovada') },
        ],
      })
    })

    // Despesa lançada em dobro e estornada; dinheiro do cofre reforçando o troco.
    quando(dia(6), '12:10', () => {
      const original = novoId()
      const comum = { tipo: 'despesa', descricao: 'Lanche da equipe', origem: 'Padaria', meio: 'dinheiro', dia: dia(6), caixa_id: caixaAberto, operador_id: operadores.joao }
      inserir('lancamento', { ...comum, id: original, valor: -1200, registrado_em: instante(dia(6), '12:10') })
      inserir('lancamento', { ...comum, id: novoId(), valor: 1200, estorno_de: original, motivo: 'Lançado em dobro', registrado_em: instante(dia(6), '12:12') })
    })
    quando(dia(1), '08:30', () => {
      inserir('movimento_gaveta', { id: novoId(), caixa_id: caixaAberto, tipo: 'adicao', valor: 5000, motivo: 'Troco do cofre', operador_id: operadores.joao, registrado_em: instante(dia(1), '08:30') })
    })

    // Cliente com nome colado de outro lugar: acento, espaço duplo e espaço que não quebra.
    quando(dia(30), '09:00', () => {
      inserir('cliente', { id: novoId(), numero: proximoNumero(banco, 'cliente'), nome: 'José  da Conceição Araújo\u00a0', documento: '98765432100', criado_em: instante(dia(30), '09:00') })
    })

    // Cobrança que ficou na maquininha quando o app caiu: a reconciliação ao abrir pega (A4).
    quando(hoje, '07:58', () => {
      const momento = instante(hoje, '07:58')
      inserir('cobranca', { id: novoId(), meio: 'debito', valor: 1590, situacao: 'na-maquininha', externo_id: 'ORD-PENDENTE', criada_em: momento, atualizada_em: momento })
    })

    // Roda a história em ordem.
    linhaDoTempo.sort((a, b) => a.quando.localeCompare(b.quando))
    for (const evento of linhaDoTempo) evento.fazer()

    // Depois de tudo: o que só acontece com o histórico já existente.
    const fim = agora
    // Produto cadastrado por engano, com nome colado do site do fornecedor: só o saldo inicial, ainda pode sair.
    cadastrarProduto({ descricao: 'Marca-texto\u00a0Stabilo Boss\u200b Amarelo', categoria: 'escrita ', unidade: 'un', preco: 790 }, 5, fim, operadores.joao)
    // Contagem da prateleira achou menos (quebrados) e um produto fora de linha, com histórico.
    const pasta = produtos.get('EST-0029')!
    const { saldo } = um<{ saldo: number }>('select saldo from produto where id = ?', pasta)
    if (saldo > 0) movimentar(pasta, 'ajuste', -Math.min(2, saldo), fim, { motivo: 'Contagem: 2 com a haste quebrada', operador_id: operadores.joao })
    banco.prepare('update produto set ativo = 0 where id = ?').run(produtos.get('EST-0036')!)
    // Boletos da 0.1, mais um pago e desfeito e um excluído (D7).
    for (const b of base.boletos) {
      const id = novoId()
      inserir('boleto', { id, numero_exibicao: proximoNumero(banco, 'boleto'), descricao: b.descricao, valor: b.valor, numero: b.numero, vencimento: b.vencimento, criado_em: b.cadastradoEm })
      if (b.pagoEm) inserir('boleto_evento', { id: novoId(), boleto_id: id, tipo: 'pago', dia: b.pagoEm, operador_id: operadores.joao, registrado_em: instante(b.pagoEm, '10:00') })
      if (b.numero === '3') {
        inserir('boleto_evento', { id: novoId(), boleto_id: id, tipo: 'pago', dia: dia(1), operador_id: operadores.joao, registrado_em: instante(dia(1), '10:00') })
        inserir('boleto_evento', { id: novoId(), boleto_id: id, tipo: 'pagamento-desfeito', motivo: 'Marcado no boleto errado', operador_id: operadores.joao, registrado_em: instante(dia(1), '10:05') })
      }
    }
    const duplicado = novoId()
    inserir('boleto', { id: duplicado, numero_exibicao: proximoNumero(banco, 'boleto'), descricao: 'Conta de luz', valor: 41237, numero: '7', vencimento: hoje, criado_em: instante(dia(5), '11:00') })
    inserir('boleto_evento', { id: novoId(), boleto_id: duplicado, tipo: 'excluido', motivo: 'Cadastrado em dobro', operador_id: operadores.joao, registrado_em: instante(dia(5), '11:02') })

    banco.prepare('update operador set ativo = 0 where id = ?').run(operadores.marcia)
    inserir('preferencia', { chave: 'operador_atual', valor: JSON.stringify(operadores.joao) })
  })
}

/** O dinheiro que deveria estar na gaveta: o mesmo cálculo que o Caixa vai usar. */
const SQL_ESPERADO = `
  select c.dinheiro_abertura
    + coalesce((select sum(valor) from pagamento where caixa_id = c.id and meio = 'dinheiro'), 0)
    - coalesce((select sum(p.valor) from pagamento_estorno e join pagamento p on p.id = e.pagamento_id
                where e.caixa_id = c.id and p.meio = 'dinheiro'), 0)
    - coalesce((select sum(p.valor) from ficha_cancelamento fc join pagamento p on p.ficha_id = fc.ficha_id
                where fc.caixa_id = c.id and p.meio = 'dinheiro'
                  and not exists (select 1 from pagamento_estorno e where e.pagamento_id = p.id)), 0)
    + coalesce((select sum(valor) from lancamento where caixa_id = c.id and meio = 'dinheiro'), 0)
    + coalesce((select sum(case tipo when 'adicao' then valor else -valor end) from movimento_gaveta where caixa_id = c.id), 0)
    as esperado
  from caixa c where c.id = ?`

/** A 0.1 guarda o documento mascarado; a 1.0 guarda os dígitos. Completa os escondidos sem sorteio. */
function documentoCompleto(mascarado: string, indice: number) {
  const digitos = mascarado.replace(/\D/g, '')
  if (!digitos) return null
  if (mascarado.startsWith('CNPJ')) return digitos
  return `${String(100 + indice).slice(-3)}${digitos}${String(10 + indice).slice(-2)}`
}
