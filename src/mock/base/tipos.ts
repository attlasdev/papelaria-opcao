/**
 * A base local da demonstração. Guarda só fatos; situação, totais e resumos
 * são calculados em derivados.ts, para nenhuma tela ter uma cópia que envelhece.
 */
export const VERSAO_BASE = 1

export type Meio = 'dinheiro' | 'pix' | 'cartao'
export type FormaVenda = Meio | 'misto' | 'notinha'
export type Grupo = 'papeis' | 'escrita' | 'cadernos' | 'escritorio' | 'artes'

export type Cliente = {
  id: string // CLI-0104
  nome: string
  documento: string // mascarado; "Sem documento" quando não informado
  telefone: string
  endereco: string // "Rua, nº - Bairro - Cidade/UF" ou ""
  descricao: string // "Cliente frequente"
  desde: string // YYYY-MM-DD
}

/**
 * Como o produto é vendido, e portanto contado no estoque. MVP: só o que existe
 * em toda papelaria. Folha avulsa conta como unidade.
 */
export type Unidade = 'un' | 'pct' | 'cx'

export type Produto = {
  codigo: string // EST-0021
  codigoBarras?: string
  descricao: string
  categoria: string
  grupo: Grupo
  unidade: Unidade
  preco: number // centavos
  saldo: number
  minimo: number
  /** Opcionais do cadastro. Custo em centavos. */
  custo?: number
  localizacao?: string
  marca?: string
  caracteristicas?: string
  descricaoAdicional?: string
  /** Como costuma vir do fornecedor: caixa ou pacote com tantas unidades. Só informativo. */
  /** `pacotes`: por caixa. `unidades`: por pacote se houver pacotes, senão por embalagem. */
  conteudo?: { embalagem: 'cx' | 'pct'; pacotes?: number; unidades?: number }
  /**
   * Cadastrado às pressas numa venda: só o essencial, saldo sem contagem. Fica
   * marcado até alguém completar o cadastro e contar a prateleira no Estoque.
   */
  cadastroRapido?: true
  /** Fora de linha: some da venda e da lista, mas o histórico continua citando. */
  inativo?: true
}

/** Desfazer sem apagar: o registro original fica, marcado com quando e por quê. */
export type Estorno = { data: string; horario: string; motivo: string; operador?: string; registradoEm?: string; turnoCaixaId?: string }

/** Lembrete da dona na ficha (ex.: prazo combinado). Só se acrescenta. */
export type Anotacao = { data: string; horario: string; texto: string }

export type ItemVenda = {
  codigo: string
  descricao: string
  quantidade: number
  preco: number
  /** Quanto esta venda realmente baixou do saldo registrado; pode ser menor se faltava saldo. */
  baixaEstoque?: number
}

/** Um dinheiro que entrou por causa de uma ficha. */
export type Pagamento = {
  data: string
  horario: string
  meio: Meio
  valor: number
  operador?: string
  registradoEm?: string // instante do lançamento, mesmo se o recebimento foi informado para outra data
  turnoCaixaId?: string
  /** Notinha: parte paga no ato da venda. */
  entrada?: boolean
  /** Rótulo mais preciso do meio, como "Cartão crédito (2x)". */
  rotulo?: string
  /** Recebimento lançado por engano: sai do pago e volta a dever. */
  estorno?: Estorno
}

export type Ficha = {
  id: string // '1043'
  clienteId: string | null // null = venda sem identificação
  data: string
  horario: string
  operador: string
  itens: ItemVenda[]
  desconto: number
  total: number // já com desconto
  forma: FormaVenda
  /** À vista: pagamentos na hora, separados por meio. Notinha: entrada e recebimentos, em ordem. */
  pagamentos: Pagamento[]
  vencimento?: string // só notinha
  /** Venda desfeita: estoque devolvido e pagamentos estornados na data do cancelamento. */
  cancelamento?: Estorno
  anotacoes?: Anotacao[]
}

/** Lançamento manual do caixa (despesa, retirada, troco, recebimento avulso). */
export type MovimentoCaixa = {
  id: string
  data: string
  horario: string
  descricao: string
  origem: string
  categoria: string
  meio: Meio
  valor: number // negativo = saída
  operador?: string
  registradoEm?: string
  turnoCaixaId?: string
  /** Este lançamento desfaz outro (id), com o valor invertido. */
  estornoDe?: string
}

/** Conferência do dinheiro físico; períodos anteriores não são recalculados. */
export type TurnoCaixa = {
  id: string
  abertoEm: string
  operadorAbertura: string
  fundoInicial: number
  fechadoEm?: string
  operadorFechamento?: string
  esperadoFechamento?: number
  contadoFechamento?: number
  justificativaDiferenca?: string
}

export type MovimentoEstoque = {
  id: string
  data: string // ISO com hora, para ordenar
  produto: string
  descricao: string
  tipo: 'Entrada' | 'Ajuste' | 'Venda' | 'Cancelamento'
  antes: number
  depois: number
  motivo: string
  operador?: string
  /** Dados da compra recebida, sem alterar a data em que o lançamento foi feito. */
  entrada?: {
    recebidaEm: string // YYYY-MM-DD, data informada pelo operador
    fornecedor?: string
    referencia?: string
    observacoes?: string
    custoUnitario?: number // centavos desta entrega, não do cadastro
  }
}

/** Ficha em andamento guardada para retomar depois. */
export type RascunhoFicha = {
  clienteId: string | null
  semIdentificacao: boolean
  itens: { codigo: string; quantidade: number }[]
  desconto: number
  forma: FormaVenda
  recebido: number
  prepararNota: boolean
  vencimento: string
  entrada: number
  meioEntrada: Meio
  divisaoPagamento?: Record<Meio, number>
  recebidoMisto?: number
}

export type Base = {
  versao: number
  criadaEm: string
  operador: string
  clientes: Cliente[]
  produtos: Produto[]
  fichas: Ficha[]
  movimentosCaixa: MovimentoCaixa[]
  turnosCaixa?: TurnoCaixa[] // opcional para bases locais anteriores
  movimentosEstoque: MovimentoEstoque[]
  rascunhosNota: string[] // ids de ficha
  rascunhoFicha: RascunhoFicha | null
  /** Aviso do sino já lido: id → assinatura do texto lido. Mudou o texto, volta a ser novo. */
  avisosLidos: Record<string, string>
}
