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
}

/** Os nomes das operacoes, derivados. Usado no registro dos handlers. */
export type NomeOperacao = keyof Contrato
