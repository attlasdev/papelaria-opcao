import { diasEntre, somarDias } from './datas'
import {
  VERSAO_BASE,
  type Base,
  type Cliente,
  type Ficha,
  type ItemVenda,
  type Meio,
  type MovimentoCaixa,
  type MovimentoEstoque,
  type Produto,
  type Servico,
} from './tipos'

/**
 * Amostra da demonstração: cerca de 90 dias de balcão terminando em `hoje`.
 * Determinística (sorteio com semente fixa), para testes e capturas se repetirem.
 * Os sorteios não dependem da data, então a mesma história se desloca com o calendário.
 */

const DIAS = 90
const OPERADOR = 'João Silva'

function sorteador(semente: number) {
  let a = semente >>> 0
  const numero = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const inteiro = (min: number, max: number) => min + Math.floor(numero() * (max - min + 1))
  return {
    numero,
    inteiro,
    um: <T,>(lista: readonly T[]) => lista[Math.floor(numero() * lista.length)],
    chance: (p: number) => numero() < p,
  }
}

const horario = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

// [id, nome, documento, telefone, descricao, desde (dias atrás), compra na notinha?]
const CLIENTES: [string, string, string, string, string, number, boolean][] = [
  ['CLI-0104', 'Mariana Costa', 'CPF ***.452.198-**', '(11) 98452-1100', 'Cliente frequente', 1300, true],
  ['CLI-0105', 'Colégio Monteiro Lobato', 'CNPJ 12.345.678/0001-90', '(11) 3214-5500', 'Resp.: Diretoria Adm.', 900, true],
  ['CLI-0106', 'Carlos Eduardo Santos', 'CPF ***.781.902-**', '(11) 97123-4455', 'Atendido no balcão', 400, true],
  ['CLI-0107', 'Ana Beatriz Nogueira', 'CPF ***.312.449-**', '(11) 99876-5432', 'Cliente frequente', 700, false],
  ['CLI-0108', 'Papel e Arte Gráfica ME', 'CNPJ 98.765.432/0001-11', '(11) 4002-8922', 'Compras mensais', 1100, true],
  ['CLI-0109', 'Escola Futuro', 'CNPJ 45.210.987/0001-33', '(11) 3350-1200', 'Compras escolares', 600, true],
  ['CLI-0110', 'Renata Silveira', 'CPF ***.604.215-**', '(11) 98820-3311', 'Cliente de balcão', 200, false],
  ['CLI-0111', 'Mariano Souza Lima', 'CPF ***.991.048-**', '(11) 97771-2040', 'Cliente de balcão', 150, false],
  ['CLI-0112', 'Juliana Almeida', 'CPF ***.281.650-**', '(11) 90000-0112', 'Cliente de balcão', 320, false],
  ['CLI-0113', 'Oficina Criativa', 'CNPJ 31.450.112/0001-08', '(11) 90000-0113', 'Compras para cursos', 800, true],
  ['CLI-0114', 'Patrícia Nascimento', 'CPF ***.472.830-**', '(11) 90000-0114', 'Cliente frequente', 500, false],
  ['CLI-0115', 'Centro Educacional Aurora', 'CNPJ 27.652.340/0001-51', '(11) 90000-0115', 'Compras escolares', 950, true],
  ['CLI-0116', 'Beatriz Oliveira', 'CPF ***.394.720-**', '(11) 90000-0116', 'Cliente frequente', 450, false],
  ['CLI-0117', 'Associação Girassol', 'CNPJ 18.784.220/0001-70', '(11) 90000-0117', 'Compras para eventos', 1000, true],
  ['CLI-0118', 'Fernanda Ribeiro', 'CPF ***.516.940-**', '(11) 90000-0118', 'Cliente de balcão', 90, false],
  ['CLI-0119', 'Gráfica Horizonte', 'CNPJ 40.825.417/0001-02', '(11) 90000-0119', 'Compras mensais', 1200, true],
  ['CLI-0120', 'Rafael Martins', 'CPF ***.638.150-**', '(11) 90000-0120', 'Cliente de balcão', 230, false],
  ['CLI-0121', 'Ateliê das Letras', 'CNPJ 22.946.315/0001-44', '(11) 90000-0121', 'Material para oficinas', 850, true],
  ['CLI-0122', 'Camila Santos', 'CPF ***.750.260-**', '(11) 90000-0122', 'Cliente frequente', 380, false],
  ['CLI-0123', 'Biblioteca do Bairro', 'CNPJ 36.108.426/0001-19', '(11) 90000-0123', 'Compras para acervo', 1050, true],
  ['CLI-0124', 'Lucas Ferreira', 'Sem documento', '(11) 90000-0124', 'Cliente de balcão', 60, false],
  ['CLI-0125', 'Helena Duarte', 'CPF ***.118.304-**', '(11) 90000-0125', 'Cliente de balcão', 40, false],
  ['CLI-0126', 'Instituto Semear', 'CNPJ 50.331.908/0001-27', '(11) 90000-0126', 'Compras mensais', 720, true],
  ['CLI-0127', 'Thiago Moreira', 'CPF ***.905.672-**', '(11) 90000-0127', 'Cliente de balcão', 25, false],
]

const RUAS = ['Rua das Flores', 'Av. Brasil', 'Rua do Comércio', 'Rua Sete de Setembro', 'Rua das Acácias', 'Av. Paulista']
const BAIRROS = ['Centro', 'Jardim Paulista', 'Vila Nova', 'Bela Vista']

/** Saldo atual de cada produto: é o ponto de chegada dos movimentos gerados. */
const PRODUTOS: Produto[] = [
  { codigo: 'EST-0021', codigoBarras: '789102711', descricao: 'Caderno Universitário Tilibra 10 Matérias Capa Dura 200 Fls', categoria: 'Cadernos', grupo: 'cadernos', unidade: 'un', preco: 2490, saldo: 42, minimo: 15, custo: 1556 },
  { codigo: 'EST-0022', codigoBarras: '789102722', descricao: 'Caneta Gel Pentel Energel 0.7mm Azul Ponta Agulha', categoria: 'Escrita', grupo: 'escrita', unidade: 'un', preco: 1250, saldo: 6, minimo: 20, custo: 650 },
  { codigo: 'EST-0023', codigoBarras: '789102744', descricao: 'Sulfite A4 Chamex 75g 500fls Pacote Tradicional', categoria: 'Papéis', grupo: 'papeis', unidade: 'pct', preco: 2800, saldo: 85, minimo: 30, custo: 1820 },
  { codigo: 'EST-0024', descricao: 'Cartolina Cartão Duplex 250g Cores Sortidas 50x70cm Avulsa', categoria: 'Artes e papéis', grupo: 'artes', unidade: 'un', preco: 350, saldo: 18, minimo: 10 },
  { codigo: 'EST-0025', codigoBarras: '789102789', descricao: 'Bloco Adesivo Post-it Amarelo 76x76mm c/ 4 Blocos 400 Folhas', categoria: 'Escritório', grupo: 'escritorio', unidade: 'pct', preco: 1890, saldo: 3, minimo: 10, custo: 1050 },
  { codigo: 'EST-0026', codigoBarras: '789102795', descricao: 'Papel Fotográfico Glossy A4 180g Alta Definição Pacote com 100 Folhas Resistente à Água Premium Micro-poroso Secagem Instantânea', categoria: 'Papéis especiais', grupo: 'papeis', unidade: 'pct', preco: 4500, saldo: 12, minimo: 8 },
  { codigo: 'EST-0027', codigoBarras: '789102733', descricao: 'Borracha Escolar Branca Mercur Record 40 com Capa Protetora', categoria: 'Escolar', grupo: 'artes', unidade: 'un', preco: 250, saldo: 0, minimo: 50, custo: 125 },
  { codigo: 'EST-0028', codigoBarras: '789102806', descricao: 'Lápis Grafite Faber-Castell HB Nº 2 Caixa com 12 Unidades', categoria: 'Escrita', grupo: 'escrita', unidade: 'cx', preco: 1590, saldo: 24, minimo: 10 },
  { codigo: 'EST-0029', codigoBarras: '789102817', descricao: 'Pasta Suspensa Kraft com Haste Plástica', categoria: 'Escritório', grupo: 'escritorio', unidade: 'un', preco: 490, saldo: 36, minimo: 15 },
  { codigo: 'EST-0030', codigoBarras: '789102828', descricao: 'Agenda Permanente Capa Dura 160 Folhas', categoria: 'Agendas', grupo: 'cadernos', unidade: 'un', preco: 3290, saldo: 9, minimo: 12 },
  { codigo: 'EST-0031', descricao: 'Folha de EVA Lisa 40×60cm Azul Avulsa', categoria: 'Artes e papéis', grupo: 'artes', unidade: 'un', preco: 490, saldo: 55, minimo: 20 },
  { codigo: 'EST-0032', codigoBarras: '789102839', descricao: 'Caneta Esferográfica Azul 1.0mm Caixa com 50 Unidades', categoria: 'Escrita', grupo: 'escrita', unidade: 'cx', preco: 3990, saldo: 7, minimo: 8 },
  { codigo: 'EST-0033', codigoBarras: '789102840', descricao: 'Envelope Pardo Ofício 24×34cm Pacote com 100 Unidades', categoria: 'Escritório', grupo: 'escritorio', unidade: 'pct', preco: 2790, saldo: 18, minimo: 10 },
  { codigo: 'EST-0034', codigoBarras: '789102851', descricao: 'Papel Sulfite A3 75g Pacote com 500 Folhas', categoria: 'Papéis', grupo: 'papeis', unidade: 'pct', preco: 6490, saldo: 14, minimo: 6, custo: 4200 },
  { codigo: 'EST-0035', codigoBarras: '789102862', descricao: 'Marcador Permanente Preto Ponta Dupla', categoria: 'Escrita', grupo: 'escrita', unidade: 'un', preco: 890, saldo: 31, minimo: 12 },
  { codigo: 'EST-0036', codigoBarras: '789102873', descricao: 'Caderno Brochura Capa Flexível 96 Folhas', categoria: 'Cadernos', grupo: 'cadernos', unidade: 'un', preco: 990, saldo: 22, minimo: 15 },
]

const ROTULOS_CARTAO = ['Cartão débito', 'Cartão crédito (1x)', 'Cartão crédito (2x)']

type FichaSemId = Omit<Ficha, 'id'>

/** A base de uma loja que acabou de começar: nada cadastrado, nada vendido. */
/** Os serviços de exemplo (`2026-10-19`): só para demonstração e semente sob pedido. */
export const SERVICOS_EXEMPLO: Servico[] = [
  { codigo: 'SRV-0001', nome: 'Cópia P&B', preco: 50, descricao: 'Por cópia, A4.' },
  { codigo: 'SRV-0002', nome: 'Cópia colorida', preco: 200, descricao: 'Por cópia, A4.' },
  { codigo: 'SRV-0003', nome: 'Impressão', preco: 100, descricao: 'Arquivo enviado pelo cliente, por página.' },
  { codigo: 'SRV-0004', nome: 'Digitalização', preco: 150, descricao: 'Por página, enviada por e-mail ou WhatsApp.' },
  { codigo: 'SRV-0005', nome: 'Encadernação', preco: 800, descricao: 'Espiral com capa e contracapa.' },
]

export function criarBaseVazia(hoje: string, operador = 'Loja'): Base {
  return {
    versao: VERSAO_BASE,
    criadaEm: hoje,
    operador,
    clientes: [],
    produtos: [],
    servicos: [],
    fichas: [],
    movimentosCaixa: [],
    turnosCaixa: [],
    movimentosEstoque: [],
    rascunhosNota: [],
    rascunhoFicha: null,
    avisosLidos: {},
  }
}

export function criarSemente(hoje: string, minutoAtual = 24 * 60): Base {
  const s = sorteador(1043)

  const clientes: Cliente[] = CLIENTES.map(([id, nome, documento, telefone, descricao, desde], indice) => ({
    id, nome, documento, telefone, descricao,
    endereco: indice % 2 === 0 ? `${RUAS[indice % RUAS.length]}, ${100 + indice * 7} - ${BAIRROS[indice % BAIRROS.length]} - São Paulo/SP` : '',
    desde: somarDias(hoje, -desde),
  }))
  const fiado = new Set(CLIENTES.filter((c) => c[6]).map((c) => c[0]))
  const produtos = PRODUTOS.map((p) => ({ ...p }))
  const produto = (codigo: string) => produtos.find((p) => p.codigo === codigo)!

  const item = (codigo: string, quantidade: number): ItemVenda => {
    const p = produto(codigo)
    return { codigo, descricao: p.descricao, preco: p.preco, quantidade }
  }
  const itensSorteados = (): ItemVenda[] => {
    const quantos = s.inteiro(1, 4)
    const escolhidos = new Map<string, ItemVenda>()
    for (let i = 0; i < quantos; i++) {
      const p = s.um(produtos)
      const atual = escolhidos.get(p.codigo)
      const quantidade = p.unidade !== 'un' ? s.inteiro(1, 2) : s.inteiro(1, 3)
      escolhidos.set(p.codigo, item(p.codigo, (atual?.quantidade ?? 0) + quantidade))
    }
    return [...escolhidos.values()]
  }
  const soma = (itens: ItemVenda[]) => itens.reduce((t, i) => t + i.preco * i.quantidade, 0)

  const fichas: FichaSemId[] = []

  for (let atras = DIAS - 1; atras >= 0; atras--) {
    const data = somarDias(hoje, -atras)
    const quantas = atras === 0 ? 8 : s.inteiro(3, 6)
    const minutos = Array.from({ length: quantas }, () => s.inteiro(8 * 60, 18 * 60)).sort((a, b) => a - b)
    for (const minuto of minutos) {
      // Mesmos sorteios em qualquer dia; só a ficha de hoje depois de "agora" é descartada.
      const identificado = s.chance(0.75)
      const cliente = s.um(clientes)
      const itens = itensSorteados()
      const bruto = soma(itens)
      const desconto = s.chance(0.08) ? Math.round((bruto * 0.05) / 10) * 10 : 0
      const total = bruto - desconto
      const sorteioForma = s.numero()
      const querNotinha = s.chance(0.35)
      const sorteioPagamento = [s.numero(), s.numero(), s.numero(), s.inteiro(5, 40)] as const
      const rotuloCartao = s.um(ROTULOS_CARTAO)
      const meioQuitacao = s.um<Meio>(['dinheiro', 'pix', 'cartao'])
      if (atras === 0 && minuto > minutoAtual) continue

      const clienteId = identificado ? cliente.id : null
      const ficha: FichaSemId = { clienteId, data, horario: horario(minuto), operador: OPERADOR, itens, desconto, total, forma: 'pix', pagamentos: [] }

      if (clienteId && fiado.has(clienteId) && querNotinha) {
        ficha.forma = 'notinha'
        ficha.vencimento = somarDias(data, 30)
        let pago = 0
        if (sorteioPagamento[0] < 0.3) {
          const entrada = Math.round((total * 0.3) / 100) * 100
          if (entrada > 0) {
            ficha.pagamentos.push({ data, horario: ficha.horario, meio: sorteioPagamento[1] < 0.5 ? 'dinheiro' : 'pix', valor: entrada, entrada: true })
            pago = entrada
          }
        }
        const venceu = diasEntre(hoje, ficha.vencimento) < 0
        const quitou = venceu ? sorteioPagamento[2] < 0.93 : sorteioPagamento[2] < 0.25
        const diasAtePagar = Math.min(sorteioPagamento[3], diasEntre(data, hoje))
        if (quitou && pago < total && diasAtePagar > 0) {
          ficha.pagamentos.push({ data: somarDias(data, diasAtePagar), horario: '10:30', meio: meioQuitacao, valor: total - pago })
        }
      } else {
        const meio: Meio = sorteioForma < 0.45 ? 'pix' : sorteioForma < 0.75 ? 'cartao' : 'dinheiro'
        ficha.forma = meio
        ficha.pagamentos.push({ data, horario: ficha.horario, meio, valor: total, ...(meio === 'cartao' ? { rotulo: rotuloCartao } : {}) })
      }
      fichas.push(ficha)
    }
  }

  // Cenários garantidos, que as telas e os testes usam como referência.
  const cenario = (clienteId: string, atras: number, vencimento: number, itens: ItemVenda[], entrada?: number): FichaSemId => {
    const data = somarDias(hoje, -atras)
    return {
      clienteId, data, horario: '11:15', operador: OPERADOR, itens, desconto: 0, total: soma(itens), forma: 'notinha',
      vencimento: somarDias(hoje, vencimento),
      pagamentos: entrada ? [{ data, horario: '11:15', meio: 'pix', valor: entrada, entrada: true }] : [],
    }
  }
  fichas.push(
    cenario('CLI-0104', 18, 12, [item('EST-0021', 2), item('EST-0023', 2), item('EST-0022', 3)], 5000),
    cenario('CLI-0105', 10, 20, [item('EST-0023', 10), item('EST-0028', 5)]),
    cenario('CLI-0106', 40, -10, [item('EST-0033', 1), item('EST-0029', 12)]),
    cenario('CLI-0117', 50, -20, [item('EST-0024', 20), item('EST-0031', 15)]),
    cenario('CLI-0117', 45, -15, [item('EST-0035', 6), item('EST-0026', 1)]),
  )
  // Ana Beatriz é o exemplo de cliente sempre em dia: nenhuma notinha.
  for (const f of fichas) {
    if (f.clienteId === 'CLI-0107' && f.forma === 'notinha') {
      f.forma = 'pix'
      f.vencimento = undefined
      f.pagamentos = [{ data: f.data, horario: f.horario, meio: 'pix', valor: f.total }]
    }
  }

  fichas.sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`))
  const comId: Ficha[] = fichas.map((f, indice) => ({ ...f, id: String(700 + indice).padStart(4, '0') }))

  return {
    versao: VERSAO_BASE,
    criadaEm: hoje,
    operador: OPERADOR,
    clientes,
    produtos,
    servicos: SERVICOS_EXEMPLO.map((s) => ({ ...s })),
    fichas: comId,
    movimentosCaixa: caixaManual(hoje, minutoAtual),
    turnosCaixa: [],
    movimentosEstoque: historicoEstoque(produtos, comId, hoje),
    rascunhosNota: comId.filter((f) => f.clienteId).slice(-2).map((f) => f.id).reverse(),
    rascunhoFicha: null,
    avisosLidos: {},
  }
}

/** Lançamentos manuais recorrentes: fundo de troco, despesas, retiradas e avulsos. */
function caixaManual(hoje: string, minutoAtual: number): MovimentoCaixa[] {
  const lista: MovimentoCaixa[] = []
  for (let atras = DIAS - 1; atras >= 0; atras--) {
    const data = somarDias(hoje, -atras)
    const add = (minuto: number, m: Omit<MovimentoCaixa, 'id' | 'data' | 'horario'>) => {
      if (atras > 0 || minuto <= minutoAtual) lista.push({ ...m, id: `${data}-${minuto}-${m.categoria}`, data, horario: horario(minuto) })
    }
    add(8 * 60 + 5, { descricao: 'Reposição do fundo de troco', origem: 'Troco inicial do balcão', categoria: 'Troco', meio: 'dinheiro', valor: -3500 })
    if (atras % 2 === 0) add(12 * 60 + 45, { descricao: 'Serviço de cópias e plastificação', origem: 'Recebimento sem ficha vinculada', categoria: 'Avulso', meio: 'pix', valor: 2600 })
    if (atras % 3 === 0) add(17 * 60 + 30, { descricao: 'Retirada de caixa para o cofre', origem: 'Fechamento de turno', categoria: 'Saída de caixa', meio: 'dinheiro', valor: -30000 })
    if (atras % 7 === 0) add(10 * 60 + 20, { descricao: 'Material de limpeza do balcão', origem: 'Comprovante no caixa físico', categoria: 'Despesa', meio: 'dinheiro', valor: -5000 })
  }
  return lista
}

/**
 * Estoque de trás para frente: parte do saldo atual e desfaz cada venda e cada
 * reposição, para antes/depois sempre encadearem até o saldo de hoje. A lista
 * sai da mais nova para a mais antiga, na mesma ordem em que foi encadeada.
 */
function historicoEstoque(produtos: Produto[], fichas: Ficha[], hoje: string): MovimentoEstoque[] {
  type Evento = { quando: string; produto: Produto; tipo: 'Venda' | 'Entrada'; quantidade: number; motivo: string }
  const eventos: Evento[] = []
  for (const f of fichas) {
    for (const i of f.itens) {
      eventos.push({ quando: `${f.data}T${f.horario}`, produto: produtos.find((p) => p.codigo === i.codigo)!, tipo: 'Venda', quantidade: i.quantidade, motivo: `Ficha #${f.id}` })
    }
  }
  for (const produto of produtos) {
    for (const atras of [75, 35]) {
      eventos.push({ quando: `${somarDias(hoje, -atras)}T07:50`, produto, tipo: 'Entrada', quantidade: produto.minimo * 3, motivo: 'Reposição de mercadorias' })
    }
  }
  eventos.sort((a, b) => b.quando.localeCompare(a.quando))

  const saldo = new Map(produtos.map((p) => [p.codigo, p.saldo]))
  const movimentos: MovimentoEstoque[] = []
  for (const e of eventos) {
    const depois = saldo.get(e.produto.codigo)!
    const antes = e.tipo === 'Venda' ? depois + e.quantidade : depois - e.quantidade
    if (antes < 0) continue // reposição que deixaria saldo negativo no passado não aconteceu
    saldo.set(e.produto.codigo, antes)
    movimentos.push({ id: `${e.quando}-${e.produto.codigo}-${movimentos.length}`, data: `${e.quando}:00`, produto: e.produto.codigo, descricao: e.produto.descricao, tipo: e.tipo, antes, depois, motivo: e.motivo })
  }
  return movimentos
}
