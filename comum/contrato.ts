/**
 * A FRONTEIRA.
 *
 * Este e o unico arquivo que os dois lados leem. As telas (`src/`) sao do front;
 * `electron/`, `supabase/` e a camada de dados de `src/` sao do back, que
 * escreve este arquivo desde 2026-10-01. Aqui no meio fica o acordo.
 *
 * O tipo `Contrato` abaixo e implementado TRES vezes, e o compilador confere
 * as tres contra este arquivo:
 *
 *   electron/preload.ts   a ponte   — leva a chamada do front para o processo principal
 *   electron/operacoes.ts o real    — fala com o banco
 *   src/mock/api.ts       o falso   — dado inventado, roda no navegador sem Electron
 *
 * Consequencia pratica: se uma operacao entrar aqui, o build quebra nos tres
 * lugares que ainda nao a implementaram. Ninguem esquece metade.
 *
 * NAO entra neste arquivo: nome de tabela, SQL, nome de bucket, caminho de
 * arquivo em disco, chave, nada de Supabase. Se o front conseguisse deduzir o
 * schema do banco lendo daqui, a fronteira estaria no lugar errado.
 */

// ---------------------------------------------------------------------------
// Falha — o vocabulario de erro. A parte que todo mundo esquece.
// ---------------------------------------------------------------------------

/**
 * O que deu errado, e nao onde o codigo parou.
 *
 * A tela desenha uma mensagem diferente por causa, e a acao que ela oferece ao
 * usuario tambem muda: `rede` pede "tentar de novo", `validacao` pede "corrija o
 * campo", `permissao` nao pede nada — nenhum botao resolve.
 *
 * Erro como `string` solta parece mais simples e nao e: sem este tipo fechado a
 * tela nao tem como decidir o que oferecer, e todo erro vira um alerta generico.
 *
 * ESTA LISTA E PROVISORIA. Ela se fecha na 1.0, quando cada operacao declarar
 * as causas que devolve (`revisao-de-contrato.md`, item 2): so entra causa que
 * a tela precisa distinguir porque oferece acao diferente.
 */
export type CausaFalha =
  | 'rede'          // nao alcancei o servidor
  | 'sessao'        // ninguem entrou, ou a sessao venceu: a tela pede o login
  | 'configuracao'  // o app nao sabe a que banco se ligar (instalacao incompleta)
  | 'banco'         // alcancei, mas o banco recusou ou nao esta na forma esperada
  | 'permissao'     // a operacao nao e permitida para este usuario
  | 'validacao'     // o dado enviado nao serve; a tela tem como corrigir
  | 'conflito'      // outra pessoa mexeu antes; o dado em tela esta velho
  | 'nao-encontrado'// o id nao existe mais
  | 'impressora'    // a impressora nao recebeu: desligada, fila parada, sem cabo
  | 'desconhecida'

export type Falha = {
  ok: false
  /** Mensagem ja legivel, pronta para a tela. */
  erro: string
  causa: CausaFalha
}

/**
 * Toda operacao devolve isto. Nenhuma lanca excecao para o front:
 * `try/catch` espalhado por tela some, e o caminho de erro passa a ser tipado.
 *
 * Uso no front:
 *
 *   const r = await window.api.sessaoAtual()
 *   if (!r.ok) return <Erro causa={r.causa} texto={r.erro} />
 *   //  aqui dentro o TypeScript ja sabe que `r.dado` existe
 *   return <p>{r.dado?.email}</p>
 */
export type Resultado<T> = { ok: true; dado: T } | Falha

/** Atalhos para quem implementa. Nao sao obrigatorios, so poupam digitacao. */
export const ok = <T>(dado: T): Resultado<T> => ({ ok: true, dado })
export const falha = (causa: CausaFalha, erro: string): Falha => ({ ok: false, causa, erro })

// ---------------------------------------------------------------------------
// O contrato
// ---------------------------------------------------------------------------

/** Quem esta usando o app. No piloto e um usuario so, o da loja. */
export type Sessao = { email: string }

/**
 * PILOTO 0.1 — a base inteira da loja como um documento so (Memoria.md,
 * `2026-10-06`). O conteudo e o formato de `src/mock/base/tipos.ts`; quem o
 * confere e o front, que ja tem as regras. Na 1.0 isto da lugar a uma operacao
 * por gesto do usuario.
 */
export type DocumentoBase = {
  conteudo: unknown
  /** Sobe 1 a cada gravacao. Quem grava diz qual viu por ultimo. */
  revisao: number
  /** ISO 8601, UTC. */
  salvoEm: string
}

export type Gravacao = { revisao: number; salvoEm: string }

/** `salvo: false` quando a pessoa fechou a janela de salvar sem escolher. */
export type ArquivoSalvo = { salvo: boolean; nome?: string }

/**
 * Cobranca na maquininha integrada (Mercado Pago Point, Memoria.md `2026-10-06`).
 * O sistema manda o valor, a maquininha cobra, o sistema consulta ate o fim.
 * Os estados espelham a Orders API: created/at_terminal -> processed / failed /
 * canceled / expired.
 */
export type MeioCobranca = 'credito' | 'debito' | 'pix'
export type SituacaoCobranca = 'enviando' | 'na-maquininha' | 'aprovada' | 'recusada' | 'cancelada' | 'expirada'
export type Cobranca = {
  id: string
  situacao: SituacaoCobranca
  meio: MeioCobranca
  /** Centavos. */
  valor: number
  /** Piloto 0.1: a maquininha e simulada dentro do app. A tela avisa. */
  demonstracao: boolean
  /** Quando aprovada no cartao: "Visa", "Mastercard"... */
  bandeira?: string
  /** Quando recusada: o motivo, ja legivel. */
  motivo?: string
}

/**
 * Comprovante NAO FISCAL da venda, na impressora termica (Memoria.md,
 * `2026-10-07`). A tela manda o que foi vendido; o cabecalho da loja (nome,
 * endereco, telefone, CNPJ) e a impressora vem da configuracao da maquina,
 * lida pelo processo principal. Dinheiro em centavos.
 */
export type ItemComprovante = { descricao: string; quantidade: number; preco: number }
/** `rotulo`: como a tela ja mostra o meio, ex. "Cartão crédito Visa · Mercado Pago". */
export type PagamentoComprovante = { rotulo: string; valor: number }
export type DadosComprovante = {
  /** Numero da ficha, ex. "1043". */
  numero: string
  /** ISO 8601, UTC: quando a venda foi feita (na reimpressao, a data da venda). */
  dataHora: string
  operador: string
  /** Nome do cliente; ausente na venda sem identificacao. */
  cliente?: string
  itens: ItemComprovante[]
  desconto: number
  /** Ja com desconto. Tem que bater com itens - desconto, senao `validacao`. */
  total: number
  pagamentos: PagamentoComprovante[]
  troco: number
  /** Venda com dado inventado (piloto): o papel sai marcado "SIMULAÇÃO". */
  demonstracao: boolean
  /** Reimpressao pelo botao: o papel sai marcado "2ª VIA". */
  segundaVia: boolean
}

/**
 * Uma pessoa da loja (Memoria.md, "Operadores e login", `R-OPERADOR-*`). O PIN
 * nunca vem: so o back o confere.
 */
export type Operador = {
  id: string
  nome: string
  /** Desativada: some da escolha, nao assina; o historico continua citando. */
  ativo: boolean
  /** A dona. Uma so, sempre ativa. */
  admin: boolean
  /** Sem PIN (cadastrada antes do PIN existir): nao assina ate a dona definir um. */
  temPin: boolean
}

export type Operadores = {
  /** Todas, ativas e desativadas; a administradora primeiro, depois por nome. */
  pessoas: Operador[]
  /** Quem fez o ultimo gesto nesta maquina, para vir marcado. `null` se ninguem. */
  ultimoId: string | null
}

/**
 * Quem esta fazendo: a pessoa e o PIN de 4 digitos dela. Vai DENTRO da operacao
 * do gesto, e o back confere na mesma chamada: a tela nao tem como dizer "fui
 * eu" sem o PIN. PIN errado e `validacao` (a janela continua aberta para tentar
 * de novo); depois de 5 erros seguidos, `validacao` com a espera na mensagem.
 */
export type Assinatura = { operadorId: string; pin: string }

/**
 * O cadastro do cliente (tela 3.1). Documento e telefone vao com a pontuacao
 * que a pessoa digitou e voltam so com os digitos; vazio e `null`. O estado e a
 * sigla ("MG"); a tela mostra o nome completo.
 */
export type DadosCliente = {
  nome: string
  documento: string | null
  telefone: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  /** Para nota fiscal; oculto na tela, a edicao preserva o que havia. */
  fiscal: {
    tipoContribuinte: 'nao-contribuinte' | 'contribuinte' | 'isento' | null
    tipoCliente: 'consumidor' | 'revenda' | null
    inscricaoEstadual: string | null
  }
}

export type Cliente = DadosCliente & {
  id: string
  /** O codigo de exibicao, ex. "CLI-0104". Nasce no banco ao salvar. */
  codigo: string
  /** ISO 8601, UTC: o "cliente desde" do detalhe (3.3). */
  criadoEm: string
}

/**
 * Situacao do cliente pelas notinhas em aberto (`R-CLIENTE-01`): quem tem uma
 * em atraso e "em atraso", mesmo com outra a vencer.
 */
export type SituacaoCliente = 'em-dia' | 'a-vencer' | 'em-atraso'
export type FiltroClientes = 'todos' | 'a-vencer' | 'em-atraso'

/** Uma linha da lista de Clientes (tela 3.2). Dinheiro em centavos. */
export type LinhaCliente = {
  id: string
  codigo: string
  nome: string
  documento: string | null
  telefone: string | null
  /** Fichas do cliente, sem as canceladas. */
  compras: number
  /** Soma do que falta pagar nas notinhas. */
  emAberto: number
  situacao: SituacaoCliente
}

export type PaginaClientes = {
  clientes: LinhaCliente[]
  /** Quantos clientes o filtro e a busca acham, somando todas as paginas. */
  total: number
  /** A pagina devolvida: a pedida, ou a ultima se a pedida passou do fim. */
  pagina: number
  /** Os cartoes e as abas: contam clientes, sem filtro nem busca. */
  resumo: { clientes: number; aVencer: number; emAtraso: number }
  /** Fichas sem cliente feitas hoje (dia de Sao Paulo), canceladas inclusive. */
  vendasSemIdentificacaoHoje: number
}

export type FormaFicha = 'dinheiro' | 'pix' | 'cartao' | 'misto' | 'notinha'
/** A vista e sempre `paga`; a notinha, pelo que falta e pelo vencimento. */
export type SituacaoCompra = 'paga' | 'a-vencer' | 'em-atraso' | 'cancelada'
/** As abas do historico (3.3). A cancelada so aparece em `todas`. */
export type FiltroCompras = 'todas' | 'paga' | 'a-vencer' | 'em-atraso'

/** Uma ficha no historico do cliente. Dinheiro em centavos. */
export type CompraCliente = {
  id: string
  /** O numero da ficha como a loja le, ex. "1043". */
  numero: string
  /** ISO 8601, UTC. */
  registradoEm: string
  total: number
  forma: FormaFicha
  /** Pagamento num meio so: como ele foi registrado, ex. "Cartão crédito Visa". */
  rotulo: string | null
  situacao: SituacaoCompra
  emAberto: number
  /** So a notinha; `AAAA-MM-DD`. */
  vencimento: string | null
  /** Notinha paga: o dia do ultimo pagamento que vale; senao `null`. */
  quitadaEm: string | null
  /** O dia do cancelamento; `AAAA-MM-DD`. */
  canceladaEm: string | null
  /** Os produtos, na ordem da ficha, com o nome de quando foi vendido. */
  itens: { descricao: string; quantidade: number }[]
  /** Os nomes dos servicos da ficha. */
  servicos: string[]
}

export type PaginaCompras = {
  compras: CompraCliente[]
  /** Quantas fichas o filtro acha, somando todas as paginas. */
  total: number
  pagina: number
  /** Do cliente inteiro, sem filtro. Compras e ticket medio sem as canceladas. */
  resumo: {
    compras: number
    totalComprado: number
    /** Arredondado ao centavo; 0 sem compras. */
    ticketMedio: number
    /** Soma do que falta pagar nas notinhas, e quantas faltam. */
    emAberto: number
    notinhasEmAberto: number
    situacao: SituacaoCliente
    /** As abas: `todas` conta as canceladas; `pagas`, nao. */
    contagem: { todas: number; pagas: number; aVencer: number; emAtraso: number }
  }
}

/** Como o produto e vendido, e portanto contado no estoque. */
export type UnidadeProduto = 'un' | 'pct' | 'cx'

/**
 * Como costuma vir do fornecedor, so informativo. `pacotes`: por caixa;
 * `unidades`: por pacote se houver pacotes, senao por embalagem.
 */
export type ConteudoProduto = { embalagem: 'cx' | 'pct'; pacotes: number | null; unidades: number | null }

/** O que a tela manda ao cadastrar ou editar. Dinheiro em centavos; vazio e `null`. */
export type DadosProduto = {
  codigoBarras: string | null
  descricao: string
  /** Texto livre; mesma categoria com outra caixa ou sem acento vira a ja existente. */
  categoria: string
  unidade: UnidadeProduto
  preco: number
  custo: number | null
  minimo: number
  localizacao: string | null
  marca: string | null
  caracteristicas: string | null
  descricaoAdicional: string | null
  conteudo: ConteudoProduto | null
  /** Anotacao para a Emitte (`R-ESTOQUE-06`): 8 e 7 numeros, pontos aceitos. */
  ncm: string | null
  cest: string | null
}

export type Produto = DadosProduto & {
  id: string
  /** O codigo de exibicao, ex. "EST-0031". Nasce no banco ao salvar (`R-ESTOQUE-08`). */
  codigo: string
  saldo: number
  ativo: boolean
  /** Tem venda ou movimento alem do saldo inicial: nao se exclui, desativa (`R-ESTOQUE-02`). */
  temHistorico: boolean
}

/**
 * Um produto da entrega: a quantidade a SOMAR (nunca o saldo final) e o custo
 * desta compra. Ou um produto que ja existe (`produtoId`), ou um cadastro novo
 * (`novo`), criado na mesma transacao da entrada: cancelou, nao sobra produto.
 */
export type ItemEntrada =
  | { produtoId: string; quantidade: number; custoUnitario: number | null }
  | { novo: DadosProduto; quantidade: number; custoUnitario: number | null }

/**
 * Uma entrega de mercadoria (`R-ESTOQUE-04`). `recebidaEm` e o dia fisico do
 * recebimento ('AAAA-MM-DD', no maximo hoje); o instante do lancamento e o back
 * que poe.
 */
export type Entrega = {
  recebidaEm: string
  fornecedor: string | null
  referencia: string | null
  observacoes: string | null
  itens: ItemEntrada[]
}

/**
 * Correcao da contagem de um produto (`R-ESTOQUE-10`): a contagem da prateleira
 * e o saldo que a tela mostrava ao abrir, para o back saber se mudou no meio.
 */
export type Ajuste = { produtoId: string; contagem: number; saldoVisto: number; motivo: string }

export type TipoMovimento = 'entrada' | 'ajuste' | 'venda' | 'cancelamento'

/** Uma linha do historico do estoque (tela 2.6). Ninguem edita: e fato. */
export type MovimentoEstoque = {
  id: string
  /** Instante do lancamento, ISO 8601 UTC. */
  registradoEm: string
  tipo: TipoMovimento
  produto: { id: string; codigo: string; descricao: string }
  saldoAntes: number
  saldoDepois: number
  /**
   * O porque escrito: o motivo do ajuste, "Saldo inicial do cadastro",
   * "Recebimento de mercadorias", o motivo do cancelamento. Venda nao tem.
   */
  motivo: string | null
  /** Nome de quem fez. Vazio só em dado antigo da 0.1 (a semente tem venda sem quem fez). */
  operador: string
  /** Entrada de uma entrega (`R-ESTOQUE-04`); o saldo inicial do cadastro nao tem. */
  entrada: { recebidaEm: string; fornecedor: string | null; referencia: string | null; observacoes: string | null; custoUnitario: number | null } | null
  /** Venda e cancelamento: a ficha, para abrir. */
  ficha: { id: string; numero: string } | null
  /** So ajuste de funcionario sem o visto da dona (`R-ESTOQUE-11`). */
  aguardandoConferencia: boolean
  /** O visto da dona no ajuste: quem e quando (ISO). */
  conferencia: { por: string; em: string } | null
}

/** O recorte do historico. `aguardando` mostra so os ajustes sem o visto da dona. */
export type FiltroMovimentos = { produtoId: string | null; tipo: 'todas' | 'entrada' | 'ajuste' | 'venda'; aguardando: boolean }

export type PaginaMovimentos = {
  movimentos: MovimentoEstoque[]
  /** Quantos o filtro acha, somando todas as paginas. */
  total: number
  /** Ajustes aguardando a dona no mesmo produto (ou em todos), qualquer que seja o tipo filtrado. */
  aguardando: number
}

/** Os produtos da entrega como ficaram, com o saldo novo. */
export type EntradaRegistrada = { id: string; produtos: Produto[] }

/**
 * O recorte da lista do Estoque. Os quatro primeiros e a categoria sao
 * exclusivos, como as abas da tela; so `desativados` mostra desativado.
 */
export type FiltroProdutos = 'todos' | 'baixo' | 'sem-codigo' | 'desativados' | { categoria: string }

/** Os cartoes do Estoque, sempre sobre os produtos ativos (menos `desativados`). */
export type ResumoEstoque = { produtos: number; categorias: number; baixo: number; semCodigo: number; desativados: number }

export type PaginaProdutos = {
  produtos: Produto[]
  /** Quantos produtos o filtro e a busca acham, somando todas as paginas. */
  total: number
  /** A pagina devolvida: a pedida, ou a ultima se a pedida passou do fim. */
  pagina: number
  resumo: ResumoEstoque
  /** As categorias dos produtos ativos, para as abas, em ordem alfabetica. */
  categorias: string[]
}

export type MeioPagamento = 'dinheiro' | 'pix' | 'cartao'
export type Maquininha = 'mercado-pago' | 'sicoob'
export type ModalidadeCartao = 'credito' | 'debito'

/**
 * Um produto da venda (tela 4.1). `precoVisto`: o preco que a tela mostrou;
 * o back cobra o do cadastro e recusa se mudou (`R-VENDA-11`).
 */
export type ItemVendido = { produtoId: string; quantidade: number; precoVisto: number }
/** Servico sem cadastro (`R-SERVICO-01`): o nome e o valor sao os da loja. */
export type ServicoVendido = { nome: string; valor: number; perdas: number | null; observacao: string | null }

/**
 * A parte no cartao do misto (`R-VENDA-12`): obrigatoria quando ha valor no
 * cartao. O misto e manual: a maquininha e sempre a Sicoob, gravada pelo back.
 */
export type CartaoDoMisto = { cartao: ModalidadeCartao }

/**
 * Como a venda e paga. Dinheiro e misto levam o que a pessoa entregou (o troco
 * sai dele, `R-VENDA-09`); a notinha, o vencimento e a entrada na hora.
 * `bandeira`: a que a maquininha integrada devolveu (ate a 4.1b, quando o back
 * passa a le-la da cobranca gravada).
 */
export type PagamentoVenda =
  | { forma: 'dinheiro'; recebido: number }
  | { forma: 'pix'; maquininha: 'mercado-pago' | null }
  | { forma: 'cartao'; cartao: ModalidadeCartao; maquininha: Maquininha; bandeira: string | null }
  | { forma: 'misto'; parcelas: { meio: MeioPagamento; valor: number }[]; recebido: number | null; cartao: CartaoDoMisto | null }
  | { forma: 'notinha'; vencimento: string; entrada: { meio: MeioPagamento; valor: number } | null }

/** A venda do balcao. Sem cliente: venda sem identificacao (`R-VENDA-02`). */
export type Venda = {
  clienteId: string | null
  itens: ItemVendido[]
  servicos: ServicoVendido[]
  desconto: number
  pagamento: PagamentoVenda
}

/** O numero nasce ao concluir (`R-VENDA-10`), ex. "1131". */
export type FichaConcluida = { id: string; numero: string }

/**
 * A venda em andamento (`R-VENDA-05`): o estado da tela, guardado como esta.
 * Os produtos vao por id; ao retomar, a tela le o cadastro de novo.
 */
export type RascunhoFicha = {
  clienteId: string | null
  semIdentificacao: boolean
  itens: { produtoId: string; quantidade: number }[]
  servicos: ServicoVendido[]
  desconto: number
  forma: FormaFicha
  recebido: number
  vencimento: string
  entrada: number
  meioEntrada: MeioPagamento
  divisao: Record<MeioPagamento, number>
  recebidoMisto: number
  cartao: ModalidadeCartao
  maquininhaCartao: Maquininha
  pixNaMaquininha: boolean
}

/** Um pagamento da ficha. `dia`: o dia em que o dinheiro conta; `registradoEm`: o lancamento. */
export type PagamentoDaFicha = {
  id: string
  tipo: 'venda' | 'entrada' | 'recebimento'
  meio: MeioPagamento
  valor: number
  rotulo: string | null
  dia: string
  registradoEm: string
  operador: string
  /**
   * So no recebimento: as outras notinhas que o mesmo "Receber" abateu, e
   * quanto em cada uma. Estornar desfaz todas juntas (`R-CORRECAO-03`).
   */
  mesmoRecebimento: { fichaId: string; numero: string; valor: number }[]
  /**
   * Recebimento de notinha lancado por engano: nao conta como pago.
   * `conferidoPor`: a dona que deu o visto; `null` e "aguardando a dona".
   */
  estorno: { dia: string; motivo: string; operador: string; conferidoPor: string | null } | null
}

/** `conferidoPor`: a dona que deu o visto; `null` e "aguardando a dona" (`R-FICHA-02`). */
export type CancelamentoDaFicha = { dia: string; registradoEm: string; motivo: string; operador: string; conferidoPor: string | null }

export type AnotacaoDaFicha = { registradoEm: string; texto: string; operador: string }

/** A ficha inteira, para o detalhe (tela 4.2). Dinheiro em centavos. */
export type FichaDetalhe = {
  id: string
  numero: string
  /** `null`: venda sem identificacao. */
  cliente: { id: string; nome: string } | null
  registradoEm: string
  /** Quem vendeu. */
  operador: string
  forma: FormaFicha
  /** Pagamento num meio so: como foi registrado, ex. "Cartão crédito Visa · Mercado Pago". */
  rotulo: string | null
  vencimento: string | null
  situacao: SituacaoCompra
  /** O que vale como pago (sem os estornados) e o que falta, na notinha. */
  pago: number
  emAberto: number
  quitadaEm: string | null
  itens: { produtoId: string; codigo: string; descricao: string; quantidade: number; preco: number }[]
  servicos: ServicoVendido[]
  subtotal: number
  desconto: number
  total: number
  pagamentos: PagamentoDaFicha[]
  cancelamento: CancelamentoDaFicha | null
  /** Da mais velha para a mais nova. */
  anotacoes: AnotacaoDaFicha[]
}

/** Uma notinha que ainda deve (tela 5.1). Dinheiro em centavos. */
export type NotinhaAberta = {
  id: string
  numero: string
  /** O dia da venda: o recebimento nao pode ser antes dele. */
  dia: string
  total: number
  pago: number
  emAberto: number
  vencimento: string
  situacao: 'a-vencer' | 'em-atraso'
}

/** As notinhas abertas do cliente, da mais antiga para a mais nova. */
export type NotinhasAbertas = { cliente: { id: string; nome: string }; notinhas: NotinhaAberta[] }

/**
 * Um "Receber" (`R-CLIENTE-06`): as notinhas marcadas e o que entrou, por
 * meio. O valor e a soma das parcelas. `dia`: em dinheiro, sempre hoje
 * (`R-NOTINHA-05`). `cartao`: credito ou debito, obrigatorio com parcela no
 * cartao (manual no Sicoob, `R-NOTINHA-06`). `recebido`: o dinheiro que o
 * cliente entregou, para o troco.
 */
export type Recebimento = {
  notinhas: string[]
  dia: string
  parcelas: { meio: MeioPagamento; valor: number }[]
  cartao: ModalidadeCartao | null
  recebido: number | null
}

/** Quanto entrou em cada notinha, da mais antiga para a mais nova. */
export type RecebimentoFeito = { abatimentos: { fichaId: string; numero: string; valor: number; quitada: boolean }[] }

export type FiltroMeioVenda = 'todos' | MeioPagamento
/** Dias de Sao Paulo, `AAAA-MM-DD`, os dois inclusive; `null` e todo o historico. */
export type PeriodoVendas = { de: string; ate: string } | null

/** Uma venda sem cliente (tela 5.3). Sem cliente nao ha notinha. */
export type VendaSemIdentificacao = {
  id: string
  numero: string
  registradoEm: string
  total: number
  forma: Exclude<FormaFicha, 'notinha'>
  /** Pagamento num meio so: como foi registrado; no misto, `null`. */
  rotulo: string | null
  cancelada: boolean
  itens: { descricao: string; quantidade: number }[]
  servicos: string[]
}

export type PaginaVendasSemIdentificacao = {
  vendas: VendaSemIdentificacao[]
  /** Quantas vendas o periodo e o meio acham, somando todas as paginas. */
  total: number
  pagina: number
  /** Os cartoes, sem as canceladas: dinheiro que entrou no periodo. */
  resumo: { vendas: number; totalVendido: number; porMeio: Record<MeioPagamento, { valor: number; vendas: number }> }
  /** As abas: as linhas que cada uma mostra no periodo, canceladas inclusive (`R-CLIENTE-07`). */
  contagem: Record<FiltroMeioVenda, number>
}

/** O boleto da loja, so anotado (`R-BOLETO-01`). `numero`: o do arquivo da dona, texto livre. */
export type DadosBoleto = { descricao: string; valor: number; numero: string; vencimento: string }
/** `vencendo`: em ate 5 dias (`R-BOLETO-05`). */
export type SituacaoBoleto = 'pago' | 'vencido' | 'vencendo' | 'a-vencer'
export type Boleto = DadosBoleto & {
  id: string
  /** ISO 8601, UTC: gravado ao cadastrar; editar nao muda. */
  cadastradoEm: string
  situacao: SituacaoBoleto
  /** Dias de hoje ate o vencimento; negativo e atraso. */
  dias: number
  pago: { dia: string; operador: string } | null
}
export type FiltroBoletos = 'a-pagar' | 'vencidos' | 'pagos' | 'todos'
export type GrupoBoletos = { quantidade: number; valor: number }
export type ListaBoletos = {
  /** Em aberto primeiro, pelo vencimento; pagos depois, do mais recente. Sem os excluidos. */
  boletos: Boleto[]
  /** Os cartoes, sem filtro nem busca. */
  resumo: { vencidos: GrupoBoletos; vencendo: GrupoBoletos; aPagar: GrupoBoletos }
  contagem: Record<FiltroBoletos, number>
}

/** Um servico feito, com a ficha em que entrou (tela 6.2). `cliente`: `null` e venda sem identificacao. */
export type ServicoFeito = {
  fichaId: string
  numero: string
  registradoEm: string
  cliente: string | null
  servico: string
  observacao: string | null
  perdas: number
  valor: number
  /** A ficha tem produtos alem de servicos. */
  comProdutos: boolean
}

/** Uma perda anotada num servico: so conferencia, nao mexe no estoque (`R-SERVICO-03`). */
export type PerdaServico = { fichaId: string; numero: string; registradoEm: string; servico: string; quantidade: number; observacao: string | null }

export type ServicosDoPeriodo = {
  /** Sem as fichas canceladas (`R-SERVICO-02`). Da mais nova para a mais velha. */
  feitos: ServicoFeito[]
  /** Com as canceladas: o material se perdeu do mesmo jeito. */
  perdas: PerdaServico[]
  resumo: { feitos: number; valorFeitos: number; anotacoes: number; unidadesPerdidas: number }
}

/**
 * O que mexe no dinheiro da gaveta (tela 7.1). `venda`, `entrada` e
 * `recebimento` vem das fichas; `estorno-recebimento` e `cancelamento` os
 * desfazem; `lancamento` e o manual do Financeiro (e `estorno-lancamento`);
 * `adicao` e `retirada` sao a gaveta (e `estorno-gaveta`).
 */
export type TipoMovimentoCaixa =
  | 'venda' | 'servico' | 'entrada' | 'recebimento' | 'estorno-recebimento' | 'cancelamento'
  | 'lancamento' | 'estorno-lancamento' | 'adicao' | 'retirada' | 'estorno-gaveta'

/** Um movimento em dinheiro de um caixa. `valor` com sinal: + entra na gaveta, - sai. */
export type MovimentoCaixa = {
  id: string
  registradoEm: string
  tipo: TipoMovimentoCaixa
  /** "Venda da ficha #1131", "Retirada de caixa": pronto para a tela. */
  descricao: string
  /** O motivo do estorno, do cancelamento, da adicao ou da retirada; a descricao do lancamento. */
  motivo: string | null
  valor: number
  operador: string
  ficha: { id: string; numero: string } | null
  /** Ja desfeito por um estorno ou pelo cancelamento da ficha. */
  estornado: boolean
}

/** O fechamento: o esperado e gravado no momento (`R-CAIXA-10`). */
export type FechamentoCaixa = {
  registradoEm: string
  operador: string
  contado: number
  esperado: number
  /** contado - esperado: negativo e falta, positivo e sobra. */
  diferenca: number
  justificativa: string | null
  /** So com diferenca: a dona que deu o visto; `null` e "aguardando a dona". */
  conferidoPor: string | null
}

/** Um caixa (a gaveta de um turno). Dinheiro em centavos. */
export type CaixaResumido = {
  id: string
  abertoEm: string
  operadorAbertura: string
  dinheiroAbertura: number
  fechamento: FechamentoCaixa | null
}

export type CaixaDetalhe = CaixaResumido & {
  /** So o dinheiro (`R-CAIXA-02`): Pix e cartao nao entram. */
  resumo: { entradas: number; saidas: number; esperado: number }
  /** Do mais velho para o mais novo. */
  movimentos: MovimentoCaixa[]
}

/** Uma adicao, retirada ou o estorno delas, no historico (`R-CAIXA-08`). `caixaId` `null`: registro antigo sem caixa. */
export type MovimentoGaveta = {
  id: string
  registradoEm: string
  tipo: 'adicao' | 'retirada' | 'estorno-gaveta'
  descricao: string
  motivo: string
  valor: number
  operador: string
  caixaId: string | null
  estornado: boolean
}

export type PaginaCaixas = { caixas: CaixaResumido[]; total: number; pagina: number }
export type PaginaMovimentosGaveta = { movimentos: MovimentoGaveta[]; total: number; pagina: number }

/**
 * Uma linha do Financeiro (tela 7.2): um pagamento de ficha (em qualquer meio),
 * um lancamento manual, ou o estorno de um deles. A gaveta (adicao e retirada)
 * fica no Caixa (`R-FINANCEIRO-05`). `valor` com sinal; `lado` diz de qual
 * total ela faz parte: o estorno abate do proprio lado (`R-FINANCEIRO-03`).
 */
export type LinhaFinanceira = {
  id: string
  /** O dia em que o dinheiro conta, `AAAA-MM-DD`. */
  dia: string
  registradoEm: string
  descricao: string
  origem: string
  /** "Venda", "Venda e servico", "Servico", "Recebimento de notinha", "Recebimento avulso", "Despesa" ou "Estorno". */
  categoria: string
  meio: MeioPagamento
  /** Como foi registrado, ex. "Cartão crédito Visa · Mercado Pago"; sem rotulo, o nome do meio. */
  rotulo: string | null
  valor: number
  lado: 'entrada' | 'saida'
  operador: string
  ficha: { id: string; numero: string } | null
  cliente: string | null
  /** Linha de estorno: o id da linha que ela desfaz. */
  estornoDe: string | null
  /** Ja desfeita por um estorno ou pelo cancelamento da ficha. */
  estornado: boolean
  /** Venda a vista ativa: "Estornar" cancela a ficha inteira (`R-CORRECAO-02`). */
  vendaEstornavel: boolean
  /** Lancamento manual ativo: "Estornar" lanca o contrario (`R-FINANCEIRO-07`). */
  lancamentoEstornavel: boolean
  /** So no estorno de lancamento: a dona que deu o visto; `null` e "a conferir". */
  conferidoPor: string | null
  /** Estorno de lancamento sem o visto da dona. */
  aguardandoDona: boolean
}

export type FiltroFinanceiro = 'todos' | MeioPagamento | 'estornos'

export type ResumoFinanceiro = {
  entradas: number
  saidas: number
  /** Entradas menos despesas: nao e lucro nem saldo (`R-FINANCEIRO-04`). */
  liquido: number
  quantidadeSaidas: number
  contagem: Record<FiltroFinanceiro, number>
}

export type PaginaFinanceiro = { linhas: LinhaFinanceira[]; total: number; pagina: number; resumo: ResumoFinanceiro }

export type DadosLancamento = { tipo: 'entrada' | 'despesa'; meio: MeioPagamento; descricao: string; valor: number }

/**
 * As operacoes. Uma linha por coisa que a interface pode pedir.
 *
 * O vocabulario sai das telas e da loja, nao do banco. Quem escreve e o back
 * (desde 2026-10-01), conferindo cada operacao com `revisao-de-contrato.md`:
 * atomicidade, falhas e gestos irreversiveis.
 *
 * Regras de forma:
 *
 * 1. Toda operacao e `async` e devolve `Resultado<...>`. Sem excecao para o front.
 * 2. Argumentos sao dado simples: id, texto, numero, objeto de dado. NUNCA um
 *    caminho de arquivo — um `../outro` vindo da tela escreveria fora do lugar.
 *    A tela manda o id; o processo principal resolve o resto.
 * 3. O nome da funcao E o nome do canal de IPC. Nao ha canal generico: o conjunto
 *    de canais e exatamente as chaves deste tipo, fixo em tempo de build.
 * 4. Um botao que precisa de tres escritas juntas e UMA operacao aqui, nao tres.
 *    Tres chamadas separadas deixam estado meio-aplicado quando a segunda falha.
 */
export type Contrato = {
  /** `null`: ninguem entrou ainda. Falha `configuracao` se o app nao foi configurado. */
  sessaoAtual(): Promise<Resultado<Sessao | null>>
  /** Falha `validacao` quando e-mail ou senha nao conferem. */
  entrar(email: string, senha: string): Promise<Resultado<Sessao>>
  sair(): Promise<Resultado<null>>

  /** `null`: a loja ainda nao gravou nada. */
  carregarBase(): Promise<Resultado<DocumentoBase | null>>
  /**
   * Grava a base inteira. `revisaoEsperada` e a ultima que o app viu (0 se nunca
   * houve gravacao). Se outra gravacao entrou no meio, devolve `conflito` e nao
   * grava — sobrescrever apagaria a outra em silencio.
   */
  salvarBase(conteudo: unknown, revisaoEsperada: number): Promise<Resultado<Gravacao>>

  /**
   * Salva um arquivo gerado pela tela (ex.: produtos para a Emitte). A tela manda
   * o CONTEUDO e um nome sugerido; o lugar e escolhido pela pessoa na janela do
   * sistema, aberta pelo processo principal (regra 4: a tela nunca manda caminho).
   * So `.xml` e `.xlsx`.
   */
  salvarArquivo(nomeSugerido: string, conteudo: string | Uint8Array): Promise<Resultado<ArquivoSalvo>>

  /**
   * Manda a cobranca para a maquininha. So uma aberta por vez (a maquininha
   * recusa a segunda): com outra aberta, devolve `conflito`.
   * `referencia`: identifica a venda no extrato do Mercado Pago.
   */
  iniciarCobranca(dados: { valor: number; meio: MeioCobranca; referencia: string }): Promise<Resultado<Cobranca>>
  /** A tela consulta a cada ~2 s ate a situacao ser final. */
  consultarCobranca(id: string): Promise<Resultado<Cobranca>>
  /** Desistir antes do cliente pagar; libera a maquininha para outra cobranca. */
  cancelarCobranca(id: string): Promise<Resultado<Cobranca>>
  /**
   * So em demonstracao ou com credencial de TESTE do Mercado Pago (la vira o
   * endpoint de simulacao): faz a cobranca aberta terminar como aprovada ou
   * recusada. Em producao devolve `permissao`.
   */
  simularCobranca(id: string, resultado: 'aprovada' | 'recusada'): Promise<Resultado<Cobranca>>

  /**
   * Imprime o comprovante nao fiscal. `ok` quer dizer que a impressora ACEITOU
   * o trabalho, nao que saiu papel (sem bobina passa despercebido): por isso a
   * tela oferece reimprimir. Falha `impressora` quando a fila esta parada ou nao
   * existe; `configuracao` quando a maquina nao tem os dados da loja; `validacao`
   * quando a conta nao fecha. A venda ja gravada nunca depende disto.
   */
  imprimirComprovante(dados: DadosComprovante): Promise<Resultado<null>>

  // Operadores (1.0, tela 1) -------------------------------------------------
  // Toda assinatura falha com: `nao-encontrado` (pessoa nao existe), `permissao`
  // (o gesto e so da dona e assinou outra pessoa), `validacao` (desativada, sem
  // PIN, PIN errado ou na espera; a mensagem diz qual).

  listarOperadores(): Promise<Resultado<Operadores>>
  /**
   * Primeira abertura (`R-OPERADOR-05`): cadastra a dona como administradora.
   * So vale enquanto nao houver administradora: depois, `conflito`. Nome
   * repetido ou PIN fora do formato, `validacao`.
   */
  cadastrarAdministradora(nome: string, pin: string): Promise<Resultado<Operador>>
  /** Pessoa nova, com o PIN dela, assinado pela dona (`R-OPERADOR-03`). */
  cadastrarOperador(nome: string, pin: string, dona: Assinatura): Promise<Resultado<Operador>>
  renomearOperador(id: string, nome: string, dona: Assinatura): Promise<Resultado<Operador>>
  /** Desativar ou reativar. A administradora nao se desativa: `validacao`. */
  ativarOperador(id: string, ativo: boolean, dona: Assinatura): Promise<Resultado<Operador>>
  /** PIN esquecido: a dona define outro, tambem o dela. */
  redefinirPin(id: string, pin: string, dona: Assinatura): Promise<Resultado<Operador>>

  // Cliente (1.0, tela 3.1) ---------------------------------------------------
  // Cadastro editavel: sem assinatura (`R-OPERADOR-02`). Dado fora do formato,
  // `validacao` com a mensagem do primeiro campo errado: nome vazio, CPF/CNPJ
  // invalido (`R-CLIENTE-09`) ou ja cadastrado (diz em qual cliente), telefone
  // sem DDD (`R-CLIENTE-10`), CEP sem 8 numeros, estado desconhecido.

  obterCliente(id: string): Promise<Resultado<Cliente>>
  cadastrarCliente(dados: DadosCliente): Promise<Resultado<Cliente>>
  /** Duas maquinas editando o mesmo cliente: vale a ultima (e cadastro). */
  editarCliente(id: string, dados: DadosCliente): Promise<Resultado<Cliente>>
  /**
   * A lista de Clientes (tela 3.2), paginada no back, em ordem alfabetica.
   * `busca` ignora acento e maiuscula e procura no codigo e no nome; so com
   * numeros (e "CPF"/"CNPJ" na frente), no documento e no telefone, com ou sem
   * pontuacao (`R-CLIENTE-03`). `porPagina` de 1 a 100, senao `validacao`.
   */
  listarClientes(filtro: FiltroClientes, busca: string, pagina: number, porPagina: number): Promise<Resultado<PaginaClientes>>
  /**
   * As fichas do cliente, da mais nova para a mais velha: as tres recentes da
   * lista (3.2) e o historico do detalhe (3.3), com os cartoes e as abas.
   * Cliente que nao existe, `nao-encontrado`.
   */
  listarComprasDoCliente(clienteId: string, filtro: FiltroCompras, pagina: number, porPagina: number): Promise<Resultado<PaginaCompras>>

  // Produto (1.0, tela 2.1) --------------------------------------------------
  // Dado fora do formato, `validacao` com a mensagem do primeiro campo errado;
  // id que nao existe, `nao-encontrado`. A assinatura falha como a dos operadores.

  /**
   * A lista do Estoque (tela 2.2), paginada no back: o catalogo passa de mil
   * itens. `busca` ignora acento e maiuscula e procura no codigo, no codigo de
   * barras, no nome e na categoria; a tela espera a pessoa parar de digitar.
   * Em ordem de codigo. `porPagina` de 1 a 100, senao `validacao`.
   */
  listarProdutos(filtro: FiltroProdutos, busca: string, pagina: number, porPagina: number): Promise<Resultado<PaginaProdutos>>
  obterProduto(id: string): Promise<Resultado<Produto>>
  /** O bipe no cadastro (`R-ESTOQUE-05`): `null` se o codigo nao esta cadastrado. */
  buscarProdutoPorCodigoBarras(codigoBarras: string): Promise<Resultado<Produto | null>>
  /** As categorias ja usadas, em ordem alfabetica. */
  listarCategorias(): Promise<Resultado<string[]>>
  /**
   * Cadastra o produto e o numero dele. `saldoInicial` maior que 0 vira o
   * movimento "Saldo inicial do cadastro" e exige `quem` (`R-ESTOQUE-07`); com 0,
   * `quem` e ignorado. Uma operacao so: produto e movimento valem juntos.
   * Codigo de barras ja cadastrado, `validacao`.
   */
  cadastrarProduto(dados: DadosProduto, saldoInicial: number, quem: Assinatura | null): Promise<Resultado<Produto>>
  /**
   * Corrige o cadastro; saldo, situacao e a marca da Emitte nao mudam aqui
   * (`R-ESTOQUE-01`). Duas maquinas editando o mesmo produto: vale a ultima
   * (e cadastro, sem `conflito`).
   */
  editarProduto(id: string, dados: DadosProduto): Promise<Resultado<Produto>>
  /**
   * Apaga cadastro feito por engano (`R-ESTOQUE-02`); irreversivel, a tela pede
   * o segundo clique. Com historico, `validacao`: o caminho e desativar. Com
   * saldo (o do cadastro), exige `quem` (`R-ESTOQUE-07`).
   */
  excluirProduto(id: string, quem: Assinatura | null): Promise<Resultado<null>>
  /** Desativar ou reativar (`R-ESTOQUE-02`). Sem assinatura: e cadastro. */
  ativarProduto(id: string, ativo: boolean): Promise<Resultado<Produto>>

  // Entrada de mercadoria (1.0, telas 2.3 e 2.4) ------------------------------

  /**
   * Registra a entrega inteira numa transacao: o cabecalho e um movimento por
   * item. Uma operacao so para a Entrada rapida (um item) e a Registrar entrada
   * (varios): se um item nao serve, nada e gravado. Pede `quem` (`R-OPERADOR-02`).
   * `validacao`: sem item, produto repetido, quantidade que nao e inteiro maior
   * que zero, custo negativo, dia invalido ou depois de hoje, produto desativado,
   * cadastro novo fora do formato ou com codigo de barras ja cadastrado (ou
   * repetido na propria entrega). Produto que nao existe, `nao-encontrado`. O
   * custo fica no movimento; o do cadastro nao muda, menos no produto que nasce
   * na entrega, que recebe o custo desta compra (`R-ESTOQUE-09`).
   */
  registrarEntrada(entrega: Entrega, quem: Assinatura): Promise<Resultado<EntradaRegistrada>>

  /**
   * Corrige o saldo para a contagem da prateleira (1.0, tela 2.5): um movimento
   * de ajuste com a diferenca, assinado so por `quem`. Gesto sensivel com
   * conferencia depois (`R-OPERADOR-06`, `R-ESTOQUE-11`): o de funcionario fica
   * aguardando a dona; o da propria dona ja nasce conferido.
   * `validacao`: motivo vazio, contagem que nao e inteiro a partir de 0 ou igual
   * ao saldo, produto desativado. `conflito`: o saldo mudou desde que a tela
   * abriu (`R-ESTOQUE-10`), com o saldo de agora na mensagem.
   */
  ajustarEstoque(ajuste: Ajuste, quem: Assinatura): Promise<Resultado<Produto>>
  /**
   * A dona da o visto nos ajustes (`R-ESTOQUE-11`): um, ou todos os que ela esta
   * vendo, com um PIN. Ja conferido e ignorado; devolve quantos foram conferidos
   * agora. `permissao`: quem assinou nao e a administradora. Id que nao e de um
   * ajuste, `nao-encontrado`; lista vazia ou com mais de 500, `validacao`.
   */
  conferirAjustes(movimentoIds: string[], dona: Assinatura): Promise<Resultado<{ conferidos: number }>>

  /**
   * O historico do estoque (1.0, tela 2.6), do mais novo ao mais velho,
   * paginado no back: sao milhares de movimentos. `pagina` a partir de 1;
   * `porPagina` de 1 a 100, senao `validacao`. Cancelamento entra em "todas".
   */
  listarMovimentosEstoque(filtro: FiltroMovimentos, pagina: number, porPagina: number): Promise<Resultado<PaginaMovimentos>>

  // Venda (1.0, tela 4.1) ----------------------------------------------------
  /**
   * Conclui a venda: ficha, itens, servicos, pagamentos e a baixa do estoque
   * numa transacao, com o preco do cadastro e o numero na sequencia
   * (`R-VENDA-10`, `11`). Pede `quem` (`R-OPERADOR-02`) e limpa o rascunho.
   * `validacao` com a mensagem do primeiro problema (`R-VENDA-06`, `07`, `09`,
   * `R-NOTINHA-02`, `03`): sem item nem servico, saldo que nao cobre, produto
   * desativado, desconto maior que o subtotal, dinheiro que nao cobre, misto
   * que nao fecha, notinha sem cliente, vencida ou com entrada que cobre o
   * total. `nao-encontrado`: produto ou cliente que nao existe. `conflito`: o
   * preco mudou, com o preco novo na mensagem.
   */
  concluirFicha(venda: Venda, quem: Assinatura): Promise<Resultado<FichaConcluida>>
  /** A venda em andamento, uma so (`R-VENDA-05`); `null` se nao ha. */
  obterRascunhoFicha(): Promise<Resultado<RascunhoFicha | null>>
  /** Guarda a venda em andamento; `null` apaga. Fora do formato, `validacao`. */
  salvarRascunhoFicha(rascunho: RascunhoFicha | null): Promise<Resultado<null>>

  // Detalhe da ficha (1.0, tela 4.2) -------------------------------------------
  // Id que nao e de uma ficha, `nao-encontrado`. A assinatura falha como a dos
  // operadores. Cada gesto devolve a ficha como ficou.
  obterFicha(id: string): Promise<Resultado<FichaDetalhe>>
  /**
   * Desfaz a venda sem apagar (`R-FICHA-02`): o estoque volta o que a venda
   * baixou e o pago sai do Financeiro no dia de hoje, numa transacao. Assina
   * so quem cancela; o da dona ja nasce conferido. Motivo vazio ou ficha ja
   * cancelada, `validacao`.
   */
  cancelarFicha(id: string, motivo: string, quem: Assinatura): Promise<Resultado<FichaDetalhe>>
  /** O visto da dona no cancelamento. Ficha nao cancelada, `validacao`; ja conferido, nada muda. `permissao`: nao e a dona. */
  conferirCancelamento(fichaId: string, dona: Assinatura): Promise<Resultado<FichaDetalhe>>
  /** Lembrete na ficha (`R-FICHA-03`, `R-NOTINHA-02`): so se acrescenta. Texto vazio, `validacao`. */
  anotarFicha(id: string, texto: string, quem: Assinatura): Promise<Resultado<FichaDetalhe>>

  // Receber notinhas (1.0, tela 5.1) -------------------------------------------
  /** As notinhas do cliente que ainda devem. Cliente que nao existe, `nao-encontrado`. */
  listarNotinhasAbertas(clienteId: string): Promise<Resultado<NotinhasAbertas>>
  /**
   * Recebe uma ou varias notinhas do mesmo cliente numa transacao: um
   * pagamento por notinha e por meio, abatendo da mais antiga para a mais
   * nova (`R-CLIENTE-06`). Pede `quem` (`R-OPERADOR-02`). `validacao`:
   * notinha quitada, cancelada ou de outro cliente, valor acima do em aberto,
   * meio repetido, cartao sem credito ou debito, dinheiro com data que nao e
   * hoje (`R-NOTINHA-05`), data antes da venda ou depois de hoje, dinheiro
   * entregue menor que a parte em dinheiro. `nao-encontrado`: ficha que nao existe.
   */
  receberNotinhas(recebimento: Recebimento, quem: Assinatura): Promise<Resultado<RecebimentoFeito>>

  // Estornar recebimento (1.0, tela 5.2) ---------------------------------------
  /**
   * Desfaz o "Receber" inteiro de que este pagamento faz parte, em todas as
   * notinhas que ele abateu, numa transacao (`R-CORRECAO-03`); o dinheiro sai
   * da gaveta aberta hoje. Assina so quem estorna; o da dona ja nasce
   * conferido. Devolve a ficha deste pagamento como ficou. `validacao`: motivo
   * vazio, pagamento que nao e recebimento (venda, entrada), ja estornado ou
   * de ficha cancelada. Pagamento que nao existe, `nao-encontrado`.
   */
  estornarRecebimento(pagamentoId: string, motivo: string, quem: Assinatura): Promise<Resultado<FichaDetalhe>>
  /** O visto da dona no recebimento estornado, em todas as linhas dele. Nao estornado, `validacao`. `permissao`: nao e a dona. */
  conferirEstorno(pagamentoId: string, dona: Assinatura): Promise<Resultado<FichaDetalhe>>

  // Vendas sem identificacao (1.0, tela 5.3) -----------------------------------
  /**
   * As fichas sem cliente do periodo, da mais nova para a mais velha,
   * paginadas no back. O misto entra em cada meio usado (`R-CLIENTE-07`).
   * Dia invalido, `de` depois de `ate`, `ate` depois de hoje (`R-CLIENTE-08`)
   * ou `porPagina` fora de 1 a 100, `validacao`.
   */
  listarVendasSemIdentificacao(periodo: PeriodoVendas, meio: FiltroMeioVenda, pagina: number, porPagina: number): Promise<Resultado<PaginaVendasSemIdentificacao>>

  // Boletos (1.0, tela 6.1) ----------------------------------------------------
  // Id que nao e de um boleto (ou de um excluido), `nao-encontrado`. A
  // assinatura falha como a dos operadores.
  /** Todos os boletos que nao foram excluidos: sao dezenas, sem pagina. Busca na descricao e no numero, sem acento. */
  listarBoletos(filtro: FiltroBoletos, busca: string): Promise<Resultado<ListaBoletos>>
  /** Cadastro: sem assinatura. Numero repetido e aceito (`R-BOLETO-02`). Campo fora do formato, `validacao`. */
  cadastrarBoleto(dados: DadosBoleto): Promise<Resultado<Boleto>>
  /** Corrige os dados; o cadastro e o pagamento ficam como estavam. */
  editarBoleto(id: string, dados: DadosBoleto): Promise<Resultado<Boleto>>
  /** Pago hoje, por quem assina (`R-BOLETO-03`); nao lanca no Financeiro (`R-BOLETO-04`). Ja pago, `validacao`. */
  marcarBoletoPago(id: string, quem: Assinatura): Promise<Resultado<Boleto>>
  /** Desfaz o pagamento, com motivo (`R-BOLETO-03`). Nao pago ou motivo vazio, `validacao`. */
  desfazerPagamentoBoleto(id: string, motivo: string, quem: Assinatura): Promise<Resultado<Boleto>>
  /** Boleto lancado por engano vira "excluido", com motivo (D7): sai da lista e dos avisos. */
  excluirBoleto(id: string, motivo: string, quem: Assinatura): Promise<Resultado<null>>

  // Servicos (1.0, tela 6.2) ---------------------------------------------------
  /**
   * Os servicos feitos e as perdas anotadas no periodo (dia da ficha, de Sao
   * Paulo; os dois inclusive). Dia invalido, `de` depois de `ate` ou `ate`
   * depois de hoje, `validacao`.
   */
  listarServicos(periodo: { de: string; ate: string }): Promise<Resultado<ServicosDoPeriodo>>

  // Caixa (1.0, tela 7.1) ------------------------------------------------------
  // Um caixa aberto por vez (restricao do banco). O esperado e calculado pelo
  // back (`R-CAIXA-03`). Os gestos pedem pessoa e PIN (`R-CAIXA-09`) e devolvem
  // o caixa como ficou; a assinatura falha como a dos operadores.
  /** O caixa aberto, ou `null`. */
  obterCaixaAtual(): Promise<Resultado<CaixaDetalhe | null>>
  /** Abre com o dinheiro contado na gaveta. Ja ha um aberto ou valor fora do formato, `validacao`. */
  abrirCaixa(contado: number, quem: Assinatura): Promise<Resultado<CaixaDetalhe>>
  /** Adicao ou retirada na gaveta aberta (`R-CAIXA-06`). Sem caixa aberto, valor ou motivo vazio, `validacao`. */
  movimentarGaveta(tipo: 'adicao' | 'retirada', valor: number, motivo: string, quem: Assinatura): Promise<Resultado<CaixaDetalhe>>
  /**
   * Fecha o caixa aberto com o contado; grava o esperado de agora. Diferenca
   * sem justificativa, `validacao` (`R-CAIXA-04`). Com diferenca, fica
   * aguardando a dona, menos se quem fecha e ela (`R-CAIXA-10`).
   */
  fecharCaixa(contado: number, justificativa: string, quem: Assinatura): Promise<Resultado<CaixaDetalhe>>
  /** O visto da dona no fechamento com diferenca. Aberto ou sem diferenca, `validacao`. `permissao`: nao e a dona. */
  conferirFechamento(caixaId: string, dona: Assinatura): Promise<Resultado<CaixaDetalhe>>
  /**
   * Os caixas do periodo, do mais novo ao mais velho: o fechado pelo dia do
   * fechamento, o aberto pelo da abertura (`R-CAIXA-08`). `soFechados`: os
   * fechamentos recentes (`R-CAIXA-07`). Periodo invalido ou no futuro, ou
   * `porPagina` fora de 1 a 100, `validacao`.
   */
  listarCaixas(periodo: { de: string; ate: string }, soFechados: boolean, pagina: number, porPagina: number): Promise<Resultado<PaginaCaixas>>
  /** As adicoes, retiradas e os estornos delas no periodo, do mais novo ao mais velho. */
  listarMovimentosGaveta(periodo: { de: string; ate: string }, pagina: number, porPagina: number): Promise<Resultado<PaginaMovimentosGaveta>>
  /** Um caixa com o resumo e os movimentos em dinheiro. */
  obterCaixa(id: string): Promise<Resultado<CaixaDetalhe>>

  // Financeiro (1.0, tela 7.2) -------------------------------------------------
  /**
   * As linhas do periodo (dia em que o dinheiro conta), da mais nova para a
   * mais velha, paginadas, com os cartoes e as contagens dos filtros do periodo
   * inteiro (`R-FINANCEIRO-02` a `05`). Periodo invalido ou no futuro, ou
   * `porPagina` fora de 1 a 100, `validacao`.
   */
  consultarFinanceiro(periodo: { de: string; ate: string }, filtro: FiltroFinanceiro, pagina: number, porPagina: number): Promise<Resultado<PaginaFinanceiro>>
  /** Todas as linhas do periodo, sem paginar: so para a planilha (`R-FINANCEIRO-06`). */
  listarFinanceiroDoPeriodo(periodo: { de: string; ate: string }): Promise<Resultado<LinhaFinanceira[]>>
  /** Entrada avulsa ou despesa (`R-FINANCEIRO-07`); em dinheiro, no caixa aberto. Descricao vazia ou valor nao positivo, `validacao`. */
  registrarLancamento(dados: DadosLancamento, quem: Assinatura): Promise<Resultado<LinhaFinanceira>>
  /**
   * Lanca o contrario do lancamento manual, com motivo (`R-FINANCEIRO-07`);
   * devolve a linha do estorno. Ja estornado, e estorno, ou motivo vazio,
   * `validacao`; nao e lancamento manual, `nao-encontrado`.
   */
  estornarLancamento(id: string, motivo: string, quem: Assinatura): Promise<Resultado<LinhaFinanceira>>
  /** O visto da dona no estorno de lancamento (o id e o da linha do estorno). `permissao`: nao e a dona. */
  conferirEstornoLancamento(estornoId: string, dona: Assinatura): Promise<Resultado<LinhaFinanceira>>
}

/** Os nomes das operacoes, derivados. Usado no registro dos handlers. */
export type NomeOperacao = keyof Contrato
