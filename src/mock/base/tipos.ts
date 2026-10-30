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
  /** Só para nota fiscal de produto (NF-e); venda de balcão não precisa. */
  fiscal?: FiscalCliente
  /** Quando foi para a Emitte (ISO). A Emitte só cria na importação, nunca atualiza: vai uma vez. */
  emitteEnviadoEm?: string
}

/** O que a Emitte exige do cliente numa NF-e. Rua, número, bairro e cidade vêm do endereço. */
export type FiscalCliente = {
  tipoContribuinte: 'nao-contribuinte' | 'contribuinte' | 'isento'
  tipoCliente: 'consumidor' | 'revenda'
  inscricaoEstadual?: string
  cep?: string // 8 dígitos
  complemento?: string
}

/**
 * O que a nota fiscal precisa saber do produto. Os valores são decisão do
 * contador; o app só guarda e confere o formato.
 */
export type FiscalProduto = {
  tributacao: 'simples' | 'substituicao' // Simples (CSOSN 102) ou ST (CSOSN 500)
  origem: string // '0' a '8'; 0 = nacional
  cfopEstadual: string // ex.: 5102
  cfopInterestadual: string // ex.: 6102
  ncm?: string // 8 dígitos
  cest?: string // 7 dígitos, só com substituição tributária
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
  /** Para a nota fiscal. Sem isso, a nota leva os valores padrão. */
  fiscal?: FiscalProduto
  /** Quando foi para a Emitte (ISO). A Emitte só cria na importação, nunca atualiza: vai uma vez. */
  emitteEnviadoEm?: string
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

/**
 * As duas maquininhas da loja (Memoria.md, `2026-10-06`): a do Mercado Pago é
 * integrada (o sistema manda o valor e vê o "pago"); a do Sicoob é manual
 * (parcelado e plano B quando o sistema ou a internet caem).
 */
export type Maquininha = 'mercado-pago' | 'sicoob'
export type ModalidadeCartao = 'credito' | 'debito'

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
  /** Rótulo mais preciso do meio, como "Cartão crédito Visa · Mercado Pago". */
  rotulo?: string
  /** Por qual maquininha passou; ausente no dinheiro e no Pix manual. */
  maquininha?: Maquininha
  cartao?: ModalidadeCartao
  /** Cobrança feita pela maquininha integrada: o id dela e a bandeira devolvida. */
  cobranca?: { id: string; bandeira?: string; demonstracao?: boolean }
  /** Recebimento lançado por engano: sai do pago e volta a dever. */
  estorno?: Estorno
}

/**
 * Um serviço prestado numa ficha (cópia, impressão, encadernação…). Sem cadastro
 * (`2026-10-19`, Agostinho): o nome é o que a loja digitar, o valor é o cobrado.
 * Não mexe no estoque.
 */
export type ServicoVenda = {
  nome: string
  valor: number // centavos
  /** Ex.: pediu 2 cópias, saíram 6: 4 perdidas. Só conferência. */
  perdas?: { quantidade: number }
  observacao?: string
}

export type Ficha = {
  id: string // '1043'
  clienteId: string | null // null = venda sem identificação
  data: string
  horario: string
  operador: string
  itens: ItemVenda[]
  /** Serviços prestados na mesma ficha; o total soma itens e serviços. */
  servicos?: ServicoVenda[]
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
  /** Gesto sensível (`R-OPERADOR-06`): a administradora que autorizou, se não foi ela que fez. */
  autorizadoPor?: string
  /** Ajuste conferido pela dona (`R-ESTOQUE-11`): quem e quando (ISO). Sem isto, aguarda. */
  conferidoPor?: string
  conferidoEm?: string
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
  cartao?: ModalidadeCartao
  maquininhaCartao?: Maquininha
  pixNaMaquininha?: boolean
  servicos?: ServicoVenda[]
}

/**
 * Boleto a pagar da loja, só anotado (`2026-10-23`): pagar não lança no
 * Financeiro. `numero` é a organização da dona no arquivo físico: texto livre,
 * pode repetir.
 */
export type Boleto = {
  id: string // BOL-0001
  descricao: string
  valor: number // centavos
  numero: string
  vencimento: string // YYYY-MM-DD
  cadastradoEm: string // ISO 8601 UTC, gravado no cadastro; editar não muda
  pagoEm?: string // YYYY-MM-DD
  pagoPor?: string // operador que marcou
}

/**
 * Pessoa da loja na base da demonstração (1.0, tela 1). O PIN fica só como
 * hash (`sha256$<sal>$<hash>`): é a demonstração, o hash de verdade (scrypt)
 * é o do banco da 1.0.
 */
export type OperadorBase = { id: string; nome: string; ativo: boolean; admin: boolean; pinHash: string | null }

export type Base = {
  versao: number
  criadaEm: string
  /** 0.1: o nome gravado nos fatos das telas ainda não migradas para o operador com PIN. */
  operador: string
  operadores: OperadorBase[]
  /** Quem fez o último gesto assinado. */
  ultimoOperadorId: string | null
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
  boletos: Boleto[]
}
