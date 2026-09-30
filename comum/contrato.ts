/**
 * A FRONTEIRA.
 *
 * Este e o unico arquivo que os dois lados leem. Tudo em `src/` e do front;
 * tudo em `electron/` e `supabase/` e do back. Aqui no meio fica o acordo.
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
 * ESTA LISTA E PROVISORIA. Ela se fecha no passo 2 (ver `revisao-de-contrato.md`):
 * o front propoe as causas que a tela precisa distinguir, o back confirma quais
 * o banco realmente produz.
 */
export type CausaFalha =
  | 'rede'          // nao alcancei o servidor
  | 'banco'         // alcancei, mas o banco recusou ou nao esta na forma esperada
  | 'permissao'     // a operacao nao e permitida para este usuario
  | 'validacao'     // o dado enviado nao serve; a tela tem como corrigir
  | 'conflito'      // outra pessoa mexeu antes; o dado em tela esta velho
  | 'nao-encontrado'// o id nao existe mais
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
 *   const r = await window.api.ping()
 *   if (!r.ok) return <Erro causa={r.causa} texto={r.erro} />
 *   //  aqui dentro o TypeScript ja sabe que `r.dado` existe
 *   return <p>{r.dado.ambiente}</p>
 */
export type Resultado<T> = { ok: true; dado: T } | Falha

/** Atalhos para quem implementa. Nao sao obrigatorios, so poupam digitacao. */
export const ok = <T>(dado: T): Resultado<T> => ({ ok: true, dado })
export const falha = (causa: CausaFalha, erro: string): Falha => ({ ok: false, causa, erro })

// ---------------------------------------------------------------------------
// O contrato
// ---------------------------------------------------------------------------

/** EXEMPLO — apague junto com `ping` quando o contrato de verdade nascer. */
export type Pong = {
  /** De onde a resposta veio: o mock no navegador, ou o app de verdade. */
  ambiente: 'mock' | 'electron'
  /** ISO 8601. */
  quando: string
}

/**
 * As operacoes. Uma linha por coisa que a interface pode pedir.
 *
 * Quem escreve o primeiro corte e o FRONT: as operacoes saem da reuniao com o
 * cliente e das telas, nao do banco. O back faz uma passada tecnica depois
 * (`revisao-de-contrato.md`) e ajusta atomicidade, falhas e gestos irreversiveis.
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
  /**
   * EXEMPLO — apague quando o contrato de verdade nascer.
   * Serve para conferir que a tubulacao inteira esta ligada, e para o front ver
   * se esta rodando contra o mock ou contra o app real.
   */
  ping(): Promise<Resultado<Pong>>
}

/** Os nomes das operacoes, derivados. Usado no registro dos handlers. */
export type NomeOperacao = keyof Contrato
