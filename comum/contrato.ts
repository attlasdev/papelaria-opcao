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
}

/** Os nomes das operacoes, derivados. Usado no registro dos handlers. */
export type NomeOperacao = keyof Contrato
